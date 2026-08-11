import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';
import { resolveState } from '@/lib/streak-verify';

// POST /api/v1/streaks/[id]/votes — peer approves or rejects a tick.
// Body: { user_id, date, vote: 'approve'|'reject' }
//
// Voter must be a different active participant (owner OR active partner).
// Tickers can't vote on their own ticks. Re-voting overwrites the prior
// vote — handy if someone changed their mind.
//
// After the vote lands the server recomputes the state using
// streak-verify::resolveState. If it flips to confirmed/rejected, the
// ticker gets a notification.
const voteSchema = z.object({
  user_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vote: z.enum(['approve', 'reject']),
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
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: parsed.error.issues[0].message } },
      { status: 400 },
    );
  }
  const { user_id, date, vote } = parsed.data;

  if (user_id === userId) {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: "Can't vote on your own tick" } },
      { status: 400 },
    );
  }

  const db = getDB();
  try {
    // Verify the streak + voter is an active participant.
    const streak = await db
      .prepare(
        `SELECT owner_id, title, icon FROM streaks WHERE id = ? AND status = 'active'`,
      )
      .bind(id)
      .first<{ owner_id: string; title: string; icon: string }>();
    if (!streak) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }
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
        return NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 });
      }
    }

    // The target checkin must exist + still be pending. Voting on already-
    // resolved ticks is a no-op (returns the existing state).
    const ck = await db
      .prepare(
        `SELECT confirmation_state FROM streak_checkins
         WHERE streak_id = ? AND user_id = ? AND date = ? LIMIT 1`,
      )
      .bind(id, user_id, date)
      .first<{ confirmation_state: 'pending' | 'confirmed' | 'rejected' }>();
    if (!ck) {
      return NextResponse.json({ error: { code: 'not_found', message: 'No tick on that day' } }, { status: 404 });
    }
    if (ck.confirmation_state !== 'pending') {
      return NextResponse.json({
        data: { state: ck.confirmation_state, already_resolved: true },
      });
    }

    // Upsert the vote (re-voting overwrites).
    await db
      .prepare(
        `INSERT INTO streak_tick_votes
           (streak_id, checkin_user_id, checkin_date, voter_id, vote)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(streak_id, checkin_user_id, checkin_date, voter_id)
         DO UPDATE SET vote = excluded.vote, created_at = datetime('now')`,
      )
      .bind(id, user_id, date, userId, vote)
      .run();

    // Recompute the state from current tallies.
    const tallyRes = await db
      .prepare(
        `SELECT vote, COUNT(*) AS n FROM streak_tick_votes
         WHERE streak_id = ? AND checkin_user_id = ? AND checkin_date = ?
         GROUP BY vote`,
      )
      .bind(id, user_id, date)
      .all<{ vote: 'approve' | 'reject'; n: number }>();
    let approves = 0, rejects = 0;
    for (const t of tallyRes.results || []) {
      if (t.vote === 'approve') approves = t.n;
      if (t.vote === 'reject') rejects = t.n;
    }

    // Count OTHER active participants (anyone except the ticker).
    const othersRow = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM (
           SELECT owner_id AS u FROM streaks WHERE id = ?1 AND owner_id != ?2
           UNION
           SELECT partner_id AS u FROM streak_partners
           WHERE streak_id = ?1 AND status = 'active' AND partner_id != ?2
         )`,
      )
      .bind(id, user_id)
      .first<{ n: number }>();
    const others = othersRow?.n ?? 0;

    const newState = resolveState(approves, rejects, others);

    if (newState !== 'pending') {
      await db
        .prepare(
          `UPDATE streak_checkins SET confirmation_state = ?
           WHERE streak_id = ? AND user_id = ? AND date = ?`,
        )
        .bind(newState, id, user_id, date)
        .run();

      // Tell the ticker the verdict.
      notify(
        user_id,
        'system',
        newState === 'confirmed'
          ? `Your tick for "${streak.title}" was approved 🎉`
          : `Your tick for "${streak.title}" was rejected`,
        newState === 'confirmed'
          ? `${approves} of ${others} ${others === 1 ? 'peer' : 'peers'} approved`
          : `${rejects} of ${others} ${others === 1 ? 'peer' : 'peers'} rejected`,
        'streak',
        id,
      );
    }

    return NextResponse.json({
      data: { state: newState, approves, rejects, others },
    });
  } catch (err) {
    console.error('[Streak votes POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to vote' } },
      { status: 500 },
    );
  }
}
