import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';

// POST /api/v1/streaks/[id]/tick — mark today done for the current user.
// Idempotent via PRIMARY KEY (streak_id, user_id, date).
//
// Body: { date: 'YYYY-MM-DD', value?: number, note?: string }
//
// `date` MUST be provided by the client — it's the user's local date so
// midnight rollover is per-user. The server only sanity-checks that it
// isn't more than 1 day off from UTC today (anti-cheat).
const tickSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number().int().min(1).max(10_000).default(1),
  note: z.string().max(200).default(''),
  // Required for streaks with require_proof=true; ignored otherwise.
  photo_url: z.string().url().optional(),
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
  const parsed = tickSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: parsed.error.issues[0].message } },
      { status: 400 },
    );
  }
  const { date, value, note, photo_url } = parsed.data;

  // Sanity check — the user's local date should be within 1 day of UTC.
  // Anything wilder is almost certainly a bug or back-dating attempt.
  const utcToday = new Date().toISOString().slice(0, 10);
  const diffDays = Math.abs(
    (new Date(`${date}T00:00:00Z`).getTime() - new Date(`${utcToday}T00:00:00Z`).getTime()) /
    (24 * 3600 * 1000),
  );
  if (diffDays > 1.5) {
    return NextResponse.json(
      { error: { code: 'invalid_date', message: 'Date too far from today' } },
      { status: 400 },
    );
  }

  const db = getDB();
  try {
    const streak = await db
      .prepare(
        `SELECT s.id, s.owner_id, s.title, s.icon, s.require_proof,
                s.streak_type, s.bond_species FROM streaks s
         WHERE s.id = ? AND s.status = 'active'`,
      )
      .bind(id)
      .first<{
        id: string; owner_id: string; title: string; icon: string;
        require_proof: number;
        streak_type: 'solo' | 'group' | 'couple';
        bond_species: string | null;
      }>();
    if (!streak) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }

    // Proof-required streaks must carry a photo URL. If missing → 400.
    const needsProof = !!streak.require_proof;
    if (needsProof && !photo_url) {
      return NextResponse.json(
        { error: { code: 'proof_required', message: 'Photo proof required for this streak' } },
        { status: 400 },
      );
    }

    // Permission: owner or active partner
    const isOwner = streak.owner_id === userId;
    if (!isOwner) {
      const partner = await db
        .prepare(
          `SELECT 1 AS ok FROM streak_partners
           WHERE streak_id = ? AND partner_id = ? AND status = 'active' LIMIT 1`,
        )
        .bind(id, userId)
        .first<{ ok: number }>();
      if (!partner) {
        return NextResponse.json(
          { error: { code: 'forbidden', message: 'Not part of this streak' } },
          { status: 403 },
        );
      }
    }

    // For proof streaks: count other active participants. If zero (solo),
    // auto-confirm — there's no one to vote. Otherwise start pending.
    let initialState: 'confirmed' | 'pending' = 'confirmed';
    if (needsProof) {
      const otherCountRow = await db
        .prepare(
          `SELECT COUNT(*) AS n FROM (
             SELECT owner_id AS u FROM streaks WHERE id = ?1 AND owner_id != ?2
             UNION
             SELECT partner_id AS u FROM streak_partners
             WHERE streak_id = ?1 AND status = 'active' AND partner_id != ?2
           )`,
        )
        .bind(id, userId)
        .first<{ n: number }>();
      const others = otherCountRow?.n ?? 0;
      initialState = others > 0 ? 'pending' : 'confirmed';
    }

    const insertRes = await db
      .prepare(
        `INSERT OR IGNORE INTO streak_checkins
           (streak_id, user_id, date, value, note, photo_url, confirmation_state)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, userId, date, value, note, photo_url ?? null, initialState)
      .run();
    const changes = (insertRes.meta as { changes?: number } | undefined)?.changes ?? 0;

    // Streak length — only confirmed ticks count. Pending ones don't grow
    // the chain until peers approve.
    const myCheckinsRes = await db
      .prepare(
        `SELECT date FROM streak_checkins
         WHERE streak_id = ? AND user_id = ?
           AND confirmation_state = 'confirmed'
         ORDER BY date DESC LIMIT 365`,
      )
      .bind(id, userId)
      .all<{ date: string }>();
    const dates = new Set((myCheckinsRes.results || []).map(r => r.date));

    // Reuse the same algorithm as /streaks GET so the count is consistent.
    const { parseSchedule, computeCurrentStreak } = await import('@/lib/streaks');
    const scheduleRow = await db
      .prepare('SELECT schedule_json FROM streaks WHERE id = ?')
      .bind(id)
      .first<{ schedule_json: string }>();
    const schedule = parseSchedule(scheduleRow?.schedule_json);
    const currentStreak = computeCurrentStreak(dates, schedule, date);

    // Notify other participants — but only on a fresh tick (not a re-tick).
    if (changes > 0) {
      const me = await db
        .prepare('SELECT display_name, username FROM users WHERE id = ?')
        .bind(userId)
        .first<{ display_name?: string; username?: string }>();
      const myLabel = me?.display_name || me?.username || 'A friend';
      // Recipients = owner (if not me) + active partners (excluding me)
      const partnersRes = await db
        .prepare(
          `SELECT partner_id FROM streak_partners
           WHERE streak_id = ? AND status = 'active'`,
        )
        .bind(id)
        .all<{ partner_id: string }>();
      const recipients = new Set<string>();
      if (streak.owner_id !== userId) recipients.add(streak.owner_id);
      for (const r of partnersRes.results || []) {
        if (r.partner_id !== userId) recipients.add(r.partner_id);
      }
      for (const rid of recipients) {
        // Pending = first-person plea so the buddy feels asked, not informed.
        // Confirmed = straight celebration of the streak count.
        const title = initialState === 'pending'
          ? `${myLabel} needs your help verifying`
          : `${myLabel} ticked "${streak.title}" ${streak.icon}`;
        const bodyText = initialState === 'pending'
          ? `"Just finished ${streak.title} ${streak.icon} — can you confirm?"`
          : currentStreak > 1 ? `${currentStreak} day streak 🔥` : "Day 1 — let's go!";
        notify(rid, 'system', title, bodyText, 'streak', id);
      }
    }

    // Bond milestone detection — fire only on a NEW synced day for
    // couple streaks. Compute synced_days before vs after this tick.
    let milestoneReached: { id: string; label: string; flair?: string; babies: number; species: string | null } | null = null;
    let syncedAfter = 0;
    if (streak.streak_type === 'couple' && changes > 0 && initialState === 'confirmed') {
      const syncedRes = await db
        .prepare(
          `SELECT date FROM streak_checkins
           WHERE streak_id = ? AND confirmation_state = 'confirmed'
           GROUP BY date
           HAVING COUNT(DISTINCT user_id) >= 2`,
        )
        .bind(id)
        .all<{ date: string }>();
      syncedAfter = (syncedRes.results || []).length;
      // Before this tick, the *same* date wouldn't have qualified yet only
      // if this user's tick today was the second one. Approximate "before"
      // by subtracting 1 if today is in the synced list (i.e. the partner
      // already ticked today and we just made it 2).
      const todayCounted = (syncedRes.results || []).some(r => r.date === date);
      const syncedBefore = todayCounted ? syncedAfter - 1 : syncedAfter;
      const { justReachedMilestone, getStage } = await import('@/lib/bond-pet');
      const stage = justReachedMilestone(syncedBefore, syncedAfter);
      if (stage) {
        milestoneReached = {
          id: stage.id,
          label: stage.label,
          flair: stage.flair,
          babies: stage.babies,
          species: streak.bond_species,
        };
        // Notify the OTHER partner so they get the celebration too.
        const partnersRes = await db
          .prepare(
            `SELECT partner_id FROM streak_partners
             WHERE streak_id = ? AND status = 'active'`,
          )
          .bind(id)
          .all<{ partner_id: string }>();
        const others = new Set<string>();
        if (streak.owner_id !== userId) others.add(streak.owner_id);
        for (const r of partnersRes.results || []) {
          if (r.partner_id !== userId) others.add(r.partner_id);
        }
        for (const rid of others) {
          notify(
            rid,
            'system',
            `${streak.bond_species ?? '✨'} ${stage.label}`,
            `Your family on "${streak.title}" just hit ${syncedAfter} days together`,
            'streak',
            id,
          );
        }
      }
    } else if (streak.streak_type === 'couple') {
      // Even if no milestone, compute current syncedAfter for response.
      const syncedRes = await db
        .prepare(
          `SELECT COUNT(*) AS n FROM (
             SELECT date FROM streak_checkins
             WHERE streak_id = ? AND confirmation_state = 'confirmed'
             GROUP BY date
             HAVING COUNT(DISTINCT user_id) >= 2
           )`,
        )
        .bind(id)
        .first<{ n: number }>();
      syncedAfter = syncedRes?.n ?? 0;
    }

    // Fire-and-forget AI diary generation for couple streaks. Don't await
    // — the tick response shouldn't block on AI latency. If it fails, the
    // user just won't see a new diary entry until next tick.
    if (
      streak.streak_type === 'couple' &&
      changes > 0 &&
      initialState === 'confirmed'
    ) {
      const origin = new URL(req.url).origin;
      const cookie = req.headers.get('cookie') ?? '';
      // Different purpose if this tick also crossed a milestone — the
      // milestone overlay will surface that entry as a heartfelt speech.
      const purpose = milestoneReached ? 'milestone' : 'diary';
      const milestoneLabel = milestoneReached?.label;
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fetch(`${origin}/api/v1/streaks/${id}/pet-voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          purpose,
          tick_type: 'tick',
          milestone_label: milestoneLabel,
        }),
      }).catch(() => { /* best-effort */ });
    }

    return NextResponse.json({
      data: {
        recorded: changes > 0,
        date,
        current_streak: currentStreak,
        confirmation_state: initialState,
        synced_days: syncedAfter || undefined,
        milestone_reached: milestoneReached,
      },
    });
  } catch (err) {
    console.error('[Streak tick POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to tick' } },
      { status: 500 },
    );
  }
}

// DELETE /api/v1/streaks/[id]/tick?date=YYYY-MM-DD — un-tick (fix mistake).
export async function DELETE(
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
  const date = req.nextUrl.searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: 'date=YYYY-MM-DD required' } },
      { status: 400 },
    );
  }
  const db = getDB();
  try {
    await db
      .prepare('DELETE FROM streak_checkins WHERE streak_id = ? AND user_id = ? AND date = ?')
      .bind(id, userId, date)
      .run();
    return NextResponse.json({ data: { id, date, removed: true } });
  } catch (err) {
    console.error('[Streak untick DELETE]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to untick' } },
      { status: 500 },
    );
  }
}
