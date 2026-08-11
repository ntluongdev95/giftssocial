import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { BOND_SPECIES, getBirthType, parseAgreedBy } from '@/lib/bond-pet';
import {
  CARE_ACTIONS,
  appendActionLog,
  carePrompt,
  clampStat,
  isOffCooldown,
  parseActionLog,
  type ActionLogEntry,
  type CareAction,
} from '@/lib/pet-care';

// POST /api/v1/streaks/[id]/pet-action
//
// Body: { action: 'pet' | 'feed' | 'play' | 'walk' }
//
// Performs a Tamagotchi-style care action: bumps stats, throttles spam,
// runs the AI to produce a per-action reaction line, and appends the
// reaction to the streak's action log. Returns the new stats and line
// so the UI can animate immediately.

const bodySchema = z.object({
  action: z.enum(['pet', 'feed', 'play', 'walk']),
});

const ACTION_FIELD: Record<CareAction, string> = {
  pet: 'pet_last_pet_at',
  feed: 'pet_last_fed_at',
  play: 'pet_last_played_at',
  walk: 'pet_last_walked_at',
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Login required' } },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: parsed.error.issues[0].message } },
      { status: 400 },
    );
  }

  const actionId = parsed.data.action;
  const actionSpec = CARE_ACTIONS.find(a => a.id === actionId)!;

  const db = getDB();
  try {
    const streak = await db
      .prepare(
        `SELECT s.id, s.owner_id, s.title, s.streak_type, s.bond_species,
                s.bond_species_agreed_by, s.bond_breed_label,
                s.pet_happiness, s.pet_energy, s.pet_bond,
                s.pet_last_pet_at, s.pet_last_fed_at, s.pet_last_played_at, s.pet_last_walked_at,
                s.pet_action_log,
                u.display_name AS owner_name, u.username AS owner_username
         FROM streaks s
         LEFT JOIN users u ON u.id = s.owner_id
         WHERE s.id = ? AND s.status = 'active'`,
      )
      .bind(id)
      .first<{
        id: string;
        owner_id: string;
        title: string;
        streak_type: string;
        bond_species: string | null;
        bond_species_agreed_by: string;
        bond_breed_label: string | null;
        pet_happiness: number | null;
        pet_energy: number | null;
        pet_bond: number | null;
        pet_last_pet_at: string | null;
        pet_last_fed_at: string | null;
        pet_last_played_at: string | null;
        pet_last_walked_at: string | null;
        pet_action_log: string | null;
        owner_name: string | null;
        owner_username: string | null;
      }>();
    if (!streak) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }
    if (streak.streak_type !== 'couple') {
      return NextResponse.json(
        { error: { code: 'invalid_streak_type', message: 'Care is couple-only.' } },
        { status: 400 },
      );
    }

    // Permission: owner OR active partner.
    const isOwner = streak.owner_id === userId;
    const partnerRow = await db
      .prepare(
        `SELECT 1 AS ok FROM streak_partners
         WHERE streak_id = ? AND partner_id = ? AND status = 'active' LIMIT 1`,
      )
      .bind(id, userId)
      .first<{ ok: number }>();
    if (!isOwner && !partnerRow) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }

    // Pet must have hatched first.
    const agreed = parseAgreedBy(streak.bond_species_agreed_by);
    const participantsRes = await db
      .prepare(
        `SELECT owner_id AS id FROM streaks WHERE id = ?
         UNION
         SELECT partner_id AS id FROM streak_partners
         WHERE streak_id = ? AND status = 'active'`,
      )
      .bind(id, id)
      .all<{ id: string }>();
    const allParticipantIds = (participantsRes.results || []).map(r => r.id);
    const fullyAgreed = allParticipantIds.every(pid => agreed.includes(pid));
    if (!fullyAgreed) {
      return NextResponse.json(
        { error: { code: 'not_hatched', message: 'Pet has not been born yet.' } },
        { status: 409 },
      );
    }

    // Cooldown check.
    const lastIso =
      actionId === 'pet'  ? streak.pet_last_pet_at
      : actionId === 'feed' ? streak.pet_last_fed_at
      : actionId === 'play' ? streak.pet_last_played_at
      : streak.pet_last_walked_at;
    const nowMs = Date.now();
    if (!isOffCooldown(lastIso, actionSpec.cooldown, nowMs)) {
      const remaining = actionSpec.cooldown - Math.floor((nowMs - new Date(lastIso!).getTime()) / 1000);
      return NextResponse.json(
        {
          error: {
            code: 'cooldown',
            message: `Pet is still recovering. Try again in ${remaining}s.`,
            remaining_sec: remaining,
          },
        },
        { status: 429 },
      );
    }

    // Apply stat deltas.
    const happiness = clampStat((streak.pet_happiness ?? 75) + actionSpec.delta.happiness);
    const energy    = clampStat((streak.pet_energy ?? 75)    + actionSpec.delta.energy);
    const bond      = clampStat((streak.pet_bond ?? 50)      + actionSpec.delta.bond);

    // Compose AI prompt + call provider. Falls back to a canned reaction
    // when AI is not configured so the care game still feels responsive.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (getCloudflareContext as any)().env as Record<string, string | undefined>;
    const apiKey = env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
    const ollamaUrl = (env.OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL)?.trim();
    const ollamaModel = (env.OLLAMA_MODEL || process.env.OLLAMA_MODEL)?.trim() || 'llama3.2:3b';

    const speciesEmoji = streak.bond_species ?? '🐾';
    const speciesName = BOND_SPECIES.find(s => s.emoji === speciesEmoji)?.name ?? 'pet';

    const me = await db
      .prepare('SELECT display_name, username FROM users WHERE id = ?')
      .bind(userId)
      .first<{ display_name?: string; username?: string }>();
    const viewerName = me?.display_name || me?.username || 'friend';

    const partnerRow2 = await db
      .prepare(
        `SELECT u.display_name, u.username
         FROM streak_partners sp
         LEFT JOIN users u ON u.id = sp.partner_id
         WHERE sp.streak_id = ? AND sp.status = 'active' AND sp.partner_id != ?
         LIMIT 1`,
      )
      .bind(id, streak.owner_id)
      .first<{ display_name?: string; username?: string }>();

    const prompt = carePrompt(
      {
        speciesName,
        breedLabel: streak.bond_breed_label,
        birthType: getBirthType(speciesEmoji),
        petName: null,
        ownerName: streak.owner_name || streak.owner_username || 'their human',
        partnerName: partnerRow2?.display_name || partnerRow2?.username || null,
        viewerName,
        happiness,
        energy,
        bond,
      },
      actionId,
    );

    let line = '';
    let mood = '💕';
    try {
      let raw: string;
      if (ollamaUrl) {
        const r = await fetch(`${ollamaUrl.replace(/\/$/, '')}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            prompt,
            stream: false,
            format: 'json',
            options: { temperature: 0.9, num_predict: 120 },
          }),
        });
        if (!r.ok) throw new Error(`ollama ${r.status}`);
        const j = (await r.json()) as { response?: string };
        raw = (j.response ?? '{}').trim().replace(/^```json\s*|\s*```$/g, '');
      } else if (apiKey) {
        const client = new Anthropic({ apiKey });
        const resp = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 150,
          messages: [{ role: 'user', content: prompt }],
        });
        const block = resp.content.find(b => b.type === 'text');
        raw = (block ? block.text : '{}').trim().replace(/^```json\s*|\s*```$/g, '');
      } else {
        // No AI configured — return a canned line so the game still feels alive.
        const fallback: Record<CareAction, { line: string; mood: string }> = {
          pet:  { line: '*leans into your hand* mmm, more please...', mood: '😌' },
          feed: { line: '*chomp chomp* yes! the best treat ever!',    mood: '😋' },
          play: { line: '*tail wags furiously* AGAIN! Throw it again!', mood: '🎾' },
          walk: { line: 'OUTSIDE?! YES! Walkies walkies walkies!',     mood: '🚶' },
        };
        line = fallback[actionId].line;
        mood = fallback[actionId].mood;
        raw = '';
      }
      if (raw) {
        const payload = JSON.parse(raw);
        if (payload.line && typeof payload.line === 'string') line = payload.line;
        if (payload.mood && typeof payload.mood === 'string') mood = payload.mood;
      }
    } catch (e) {
      console.error('[Pet action AI]', e);
      // Soft-fail: still record the action with a generic line.
      line = '*reacts happily*';
    }

    const now = new Date().toISOString();
    const newEntry: ActionLogEntry = { at: now, action: actionId, line, mood };
    const newLog = appendActionLog(parseActionLog(streak.pet_action_log), newEntry);

    // Update DB. ACTION_FIELD maps cleanly to a single column so we use
    // a per-action UPDATE — safer than templating a column name.
    const actionField = ACTION_FIELD[actionId];
    await db
      .prepare(
        `UPDATE streaks SET
           pet_happiness = ?,
           pet_energy    = ?,
           pet_bond      = ?,
           ${actionField} = ?,
           pet_action_log = ?
         WHERE id = ?`,
      )
      .bind(happiness, energy, bond, now, JSON.stringify(newLog), id)
      .run();

    return NextResponse.json({
      data: {
        action: actionId,
        line,
        mood,
        happiness,
        energy,
        bond,
        at: now,
      },
    });
  } catch (err) {
    console.error('[Pet action POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to run pet action.' } },
      { status: 500 },
    );
  }
}
