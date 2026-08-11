import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import {
  computeCurrentStreak,
  computeLongestStreak,
  computeCompletionRate,
  parseSchedule,
} from '@/lib/streaks';

// GET /api/v1/streaks/[id]?today=YYYY-MM-DD — detail page payload.
// Returns the streak + everyone's checkins (last 120 days) + everyone's
// reactions + computed metrics per participant.
export async function GET(
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

  const today = req.nextUrl.searchParams.get('today') ||
    new Date().toISOString().slice(0, 10);

  const db = getDB();
  try {
    const streak = await db
      .prepare(
        `SELECT s.*,
                u.display_name AS owner_name, u.username AS owner_username,
                u.avatar_url AS owner_avatar
         FROM streaks s
         LEFT JOIN users u ON u.id = s.owner_id
         WHERE s.id = ? AND s.status != 'archived'`,
      )
      .bind(id)
      .first<Record<string, unknown>>();
    if (!streak) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }

    // Permission: owner or active partner.
    const isOwner = streak.owner_id === userId;
    const partnerRow = await db
      .prepare(
        `SELECT 1 AS ok FROM streak_partners
         WHERE streak_id = ? AND partner_id = ? AND status = 'active' LIMIT 1`,
      )
      .bind(id, userId)
      .first<{ ok: number }>();
    if (!isOwner && !partnerRow) {
      // Don't leak existence — 404 instead of 403.
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }

    const schedule = parseSchedule(streak.schedule_json as string);

    // Partners with user info
    const partnersRes = await db
      .prepare(
        `SELECT sp.partner_id, sp.status,
                u.display_name, u.username, u.avatar_url
         FROM streak_partners sp
         LEFT JOIN users u ON u.id = sp.partner_id
         WHERE sp.streak_id = ? AND sp.status = 'active'`,
      )
      .bind(id)
      .all<{
        partner_id: string; status: string;
        display_name?: string | null; username?: string | null; avatar_url?: string | null;
      }>();

    // All checkins (last 120 days for the heatmap)
    const checkinsRes = await db
      .prepare(
        `SELECT user_id, date, value, note, created_at,
                photo_url, confirmation_state
         FROM streak_checkins
         WHERE streak_id = ?
           AND date >= date('now', '-120 days')`,
      )
      .bind(id)
      .all<{
        user_id: string; date: string; value: number; note: string; created_at: string;
        photo_url: string | null; confirmation_state: 'pending' | 'confirmed' | 'rejected';
      }>();

    // All votes (mirrors the same 120-day window via JOIN on checkins).
    const votesRes = await db
      .prepare(
        `SELECT checkin_user_id, checkin_date, voter_id, vote
         FROM streak_tick_votes
         WHERE streak_id = ?
           AND checkin_date >= date('now', '-120 days')`,
      )
      .bind(id)
      .all<{ checkin_user_id: string; checkin_date: string; voter_id: string; vote: 'approve' | 'reject' }>();
    const votesByCheckin = new Map<string, Array<{ voter_id: string; vote: 'approve' | 'reject' }>>();
    for (const v of votesRes.results || []) {
      const key = `${v.checkin_user_id}|${v.checkin_date}`;
      const arr = votesByCheckin.get(key) ?? [];
      arr.push({ voter_id: v.voter_id, vote: v.vote });
      votesByCheckin.set(key, arr);
    }

    // Reactions — group by checkin (streak_id+user_id+date)
    const reactionsRes = await db
      .prepare(
        `SELECT checkin_user_id, checkin_date, reactor_id, emoji
         FROM streak_reactions
         WHERE streak_id = ?
           AND checkin_date >= date('now', '-120 days')`,
      )
      .bind(id)
      .all<{ checkin_user_id: string; checkin_date: string; reactor_id: string; emoji: string }>();

    // Group checkins per user. `dates` only stores CONFIRMED ones — that's
    // what the streak math counts. Pending/rejected ticks live in `rows`
    // tagged with their state so the feed can render them with a badge.
    const byUser = new Map<string, {
      dates: Set<string>;
      rows: Array<{
        date: string; value: number; note: string; created_at: string;
        photo_url: string | null; confirmation_state: 'pending' | 'confirmed' | 'rejected';
      }>;
    }>();
    for (const ck of checkinsRes.results || []) {
      const entry = byUser.get(ck.user_id) ?? { dates: new Set(), rows: [] };
      if (ck.confirmation_state === 'confirmed') entry.dates.add(ck.date);
      entry.rows.push({
        date: ck.date, value: ck.value, note: ck.note, created_at: ck.created_at,
        photo_url: ck.photo_url, confirmation_state: ck.confirmation_state,
      });
      byUser.set(ck.user_id, entry);
    }

    // Index reactions by checkin
    const reactionsByCheckin = new Map<string, Array<{ reactor_id: string; emoji: string }>>();
    for (const r of reactionsRes.results || []) {
      const key = `${r.checkin_user_id}|${r.checkin_date}`;
      const arr = reactionsByCheckin.get(key) ?? [];
      arr.push({ reactor_id: r.reactor_id, emoji: r.emoji });
      reactionsByCheckin.set(key, arr);
    }

    // Build participants: owner + partners
    type Participant = {
      id: string;
      name: string;
      avatar: string | null;
      is_owner: boolean;
      current_streak: number;
      longest_streak: number;
      completion_30d: number;
      ticked_today: boolean;
      checkins: Array<{
        date: string;
        value: number;
        note: string;
        created_at: string;
        photo_url: string | null;
        confirmation_state: 'pending' | 'confirmed' | 'rejected';
        votes: Array<{ voter_id: string; vote: 'approve' | 'reject' }>;
        reactions: Array<{ reactor_id: string; emoji: string }>;
      }>;
    };
    const participants: Participant[] = [];

    const ownerEntry = byUser.get(streak.owner_id as string) ?? { dates: new Set<string>(), rows: [] };
    participants.push({
      id: streak.owner_id as string,
      name: (streak.owner_name as string) || (streak.owner_username as string) || 'User',
      avatar: (streak.owner_avatar as string) || null,
      is_owner: true,
      current_streak: computeCurrentStreak(ownerEntry.dates, schedule, today),
      longest_streak: computeLongestStreak(ownerEntry.dates, schedule),
      completion_30d: computeCompletionRate(ownerEntry.dates, schedule, today, 30),
      ticked_today: ownerEntry.dates.has(today),
      checkins: ownerEntry.rows.map(r => ({
        ...r,
        votes: votesByCheckin.get(`${streak.owner_id}|${r.date}`) ?? [],
        reactions: reactionsByCheckin.get(`${streak.owner_id}|${r.date}`) ?? [],
      })),
    });

    for (const p of partnersRes.results || []) {
      const entry = byUser.get(p.partner_id) ?? { dates: new Set<string>(), rows: [] };
      participants.push({
        id: p.partner_id,
        name: p.display_name || p.username || 'User',
        avatar: p.avatar_url || null,
        is_owner: false,
        current_streak: computeCurrentStreak(entry.dates, schedule, today),
        longest_streak: computeLongestStreak(entry.dates, schedule),
        completion_30d: computeCompletionRate(entry.dates, schedule, today, 30),
        ticked_today: entry.dates.has(today),
        checkins: entry.rows.map(r => ({
          ...r,
          votes: votesByCheckin.get(`${p.partner_id}|${r.date}`) ?? [],
          reactions: reactionsByCheckin.get(`${p.partner_id}|${r.date}`) ?? [],
        })),
      });
    }

    // For couple streaks: compute synced_days = number of distinct dates
    // where BOTH partners ticked AND both ticks are confirmed. This is
    // the canonical "pet grew today" signal.
    let syncedDays = 0;
    let lastSyncDate: string | null = null;
    if (streak.streak_type === 'couple') {
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
      const rows = syncedRes.results || [];
      syncedDays = rows.length;
      lastSyncDate = rows[0]?.date ?? null;
    }

    return NextResponse.json({
      data: {
        ...streak,
        schedule: Array.from(schedule).sort(),
        participants,
        synced_days: syncedDays,
        last_sync_date: lastSyncDate,
      },
    });
  } catch (err) {
    console.error('[Streak detail GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch streak' } },
      { status: 500 },
    );
  }
}

// DELETE /api/v1/streaks/[id] — owner-only archive (soft delete).
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

  const db = getDB();
  try {
    const res = await db
      .prepare(
        `UPDATE streaks SET status = 'archived', updated_at = datetime('now')
         WHERE id = ? AND owner_id = ?`,
      )
      .bind(id, userId)
      .run();
    const changes = (res.meta as { changes?: number } | undefined)?.changes ?? 0;
    if (changes === 0) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }
    return NextResponse.json({ data: { id, archived: true } });
  } catch (err) {
    console.error('[Streak DELETE]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to archive' } },
      { status: 500 },
    );
  }
}
