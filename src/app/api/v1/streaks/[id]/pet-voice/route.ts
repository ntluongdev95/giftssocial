import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { BOND_SPECIES, getBirthType, parseAgreedBy } from '@/lib/bond-pet';
import {
  diaryPrompt,
  greetingPrompt,
  milestonePrompt,
  appendDiary,
  parseDiary,
  type DiaryEntry,
  type DiaryEntryType,
  type PetContext,
} from '@/lib/pet-voice';

// POST /api/v1/streaks/[id]/pet-voice
//
// Body: { purpose: 'diary' | 'greeting' | 'milestone', tick_type?, milestone_label? }
//
// Generates one line of AI-driven pet speech for the requesting viewer.
// All purposes are best-effort: if the AI is unavailable or fails, we
// return 503 with `ai_not_configured` and the UI hides the speech.
//
// `diary` is also called server-internally by the tick endpoint after a
// successful confirmed tick on couple streaks. Re-tagged with `type='tick'`
// so the dedup logic in appendDiary keeps just one tick entry per date.
const bodySchema = z.object({
  purpose: z.enum(['diary', 'greeting', 'milestone']),
  tick_type: z.enum(['tick', 'miss', 'milestone', 'born']).optional(),
  milestone_label: z.string().max(80).optional(),
});

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

  const db = getDB();
  try {
    const streak = await db
      .prepare(
        `SELECT s.id, s.owner_id, s.title, s.streak_type, s.bond_species,
                s.bond_species_agreed_by, s.bond_breed_label, s.pet_diary,
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
        pet_diary: string | null;
        owner_name: string | null;
        owner_username: string | null;
      }>();
    if (!streak) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }
    if (streak.streak_type !== 'couple') {
      return NextResponse.json(
        { error: { code: 'invalid_streak_type', message: 'Voice is couple-only.' } },
        { status: 400 },
      );
    }

    // Permission: owner OR active partner
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

    // AI config — prefer local Ollama in dev (free), fall back to Anthropic
    // in prod. If neither is configured, return 503 and the UI silently
    // hides the speech sections.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (getCloudflareContext as any)().env as Record<string, string | undefined>;
    const apiKey = env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
    const ollamaUrl = (env.OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL)?.trim();
    const ollamaModel = (env.OLLAMA_MODEL || process.env.OLLAMA_MODEL)?.trim() || 'llama3.2:3b';
    if (!apiKey && !ollamaUrl) {
      return NextResponse.json(
        {
          error: {
            code: 'ai_not_configured',
            message: 'Pet voice unavailable — AI not configured.',
          },
        },
        { status: 503 },
      );
    }

    // Resolve other partner name for context
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
    const partnerName = partnerRow2?.display_name || partnerRow2?.username || null;

    // Compute syncedDays + last sync to feed the prompt
    const syncedRes = await db
      .prepare(
        `SELECT date FROM streak_checkins
         WHERE streak_id = ? AND confirmation_state = 'confirmed'
         GROUP BY date
         HAVING COUNT(DISTINCT user_id) >= 2
         ORDER BY date DESC`,
      )
      .bind(id)
      .all<{ date: string }>();
    const syncedRows = syncedRes.results || [];
    const syncedDays = syncedRows.length;
    const lastSync = syncedRows[0]?.date ?? null;
    const today = new Date().toISOString().slice(0, 10);
    const daysSinceLastSync = lastSync
      ? Math.max(
          0,
          Math.round(
            (new Date(`${today}T00:00:00Z`).getTime() - new Date(`${lastSync}T00:00:00Z`).getTime()) /
              (24 * 3600 * 1000),
          ),
        )
      : 999;

    const speciesEmoji = streak.bond_species ?? '🐾';
    const speciesName =
      BOND_SPECIES.find(s => s.emoji === speciesEmoji)?.name ?? 'pet';

    const ctx: PetContext = {
      speciesName,
      speciesEmoji,
      breedLabel: streak.bond_breed_label,
      birthType: getBirthType(speciesEmoji),
      streakTitle: streak.title,
      ownerName: streak.owner_name || streak.owner_username || 'their human',
      partnerName,
      syncedDays,
      eventDate: today,
      daysSinceLastSync,
    };

    // Resolve viewer name for greeting prompt
    const me = await db
      .prepare('SELECT display_name, username FROM users WHERE id = ?')
      .bind(userId)
      .first<{ display_name?: string; username?: string }>();
    const viewerName = me?.display_name || me?.username || 'friend';

    // Pet hasn't hatched yet — both partners must agree on species first.
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

    // Build the prompt
    let prompt: string;
    switch (parsed.data.purpose) {
      case 'diary':
        prompt = diaryPrompt(ctx, parsed.data.tick_type ?? 'tick');
        break;
      case 'greeting':
        prompt = greetingPrompt(ctx, viewerName);
        break;
      case 'milestone':
        prompt = milestonePrompt(ctx, parsed.data.milestone_label ?? 'a big moment');
        break;
    }

    // Ollama (local) takes precedence over Anthropic when configured —
    // dev runs free and offline. Both providers are asked for JSON; Ollama
    // gets a native format=json hint that constrains decoding.
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
          options: { temperature: 0.8, num_predict: 200 },
        }),
      });
      if (!r.ok) {
        const detail = await r.text().catch(() => '');
        console.error('[Pet voice Ollama]', r.status, detail.slice(0, 200));
        return NextResponse.json(
          { error: { code: 'ai_unreachable', message: `Ollama returned ${r.status}` } },
          { status: 502 },
        );
      }
      const j = (await r.json()) as { response?: string };
      raw = (j.response ?? '{}').trim().replace(/^```json\s*|\s*```$/g, '');
    } else {
      const client = new Anthropic({ apiKey: apiKey! });
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      });
      const textBlock = response.content.find(b => b.type === 'text');
      raw = (textBlock ? textBlock.text : '{}').trim().replace(/^```json\s*|\s*```$/g, '');
    }

    let payload: { line: string; mood: string };
    try {
      payload = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: { code: 'ai_parse_error', message: 'Could not parse pet voice.' } },
        { status: 502 },
      );
    }
    if (!payload.line || typeof payload.line !== 'string') {
      return NextResponse.json(
        { error: { code: 'ai_invalid_response', message: 'Pet voice missing line.' } },
        { status: 502 },
      );
    }
    const mood = (payload.mood && typeof payload.mood === 'string') ? payload.mood : '💕';

    const now = new Date().toISOString();

    if (parsed.data.purpose === 'greeting') {
      await db
        .prepare('UPDATE streaks SET pet_greeting = ?, pet_greeting_at = ? WHERE id = ?')
        .bind(payload.line, now, id)
        .run();
      return NextResponse.json({
        data: { line: payload.line, mood, generated_at: now, purpose: 'greeting' },
      });
    }

    // diary or milestone → append to diary array
    const entry: DiaryEntry = {
      date: today,
      line: payload.line,
      mood,
      type: parsed.data.purpose === 'milestone'
        ? 'milestone'
        : (parsed.data.tick_type ?? 'tick') as DiaryEntryType,
    };
    const next = appendDiary(parseDiary(streak.pet_diary), entry);
    await db
      .prepare('UPDATE streaks SET pet_diary = ? WHERE id = ?')
      .bind(JSON.stringify(next), id)
      .run();

    return NextResponse.json({
      data: { line: payload.line, mood, generated_at: now, purpose: parsed.data.purpose, entry },
    });
  } catch (err) {
    console.error('[Pet voice POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to generate pet voice.' } },
      { status: 500 },
    );
  }
}
