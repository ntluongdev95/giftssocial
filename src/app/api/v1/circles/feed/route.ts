import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

/**
 * GET /api/v1/circles/feed
 * Returns personalized circle feed GROUPED BY CIRCLE:
 * - my_circles: array of { circle, events, signals, new_member_count }
 *   sorted by activity (live events first, then recent activity)
 * - recommended: circles not joined, matching interests
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    const db = getDB();

    let myCircleIds: string[] = [];
    let myCategories: string[] = [];

    if (userId) {
      const myCircles = await db.prepare(
        `SELECT c.id, c.category FROM circle_members cm
         JOIN circles c ON c.id = cm.circle_id
         WHERE cm.user_id = ? AND cm.status = 'active'`
      ).bind(userId).all<{ id: string; category: string }>();
      myCircleIds = myCircles.results.map(c => c.id);
      myCategories = [...new Set(myCircles.results.map(c => c.category))];
    }

    // ── Build per-circle data ──
    const circleGroups: Record<string, unknown>[] = [];

    if (myCircleIds.length > 0) {
      const ph = myCircleIds.map(() => '?').join(',');

      // Get circle details
      const circles = await db.prepare(
        `SELECT * FROM circles WHERE id IN (${ph})`
      ).bind(...myCircleIds).all<Record<string, unknown>>().then(r => r.results);

      // Events per circle (live + upcoming 7 days)
      const events = await db.prepare(
        `SELECT e.* FROM events e
         WHERE e.circle_id IN (${ph})
           AND e.end_time > datetime('now')
           AND e.start_time < datetime('now', '+7 days')
         ORDER BY e.start_time ASC`
      ).bind(...myCircleIds).all<Record<string, unknown>>().then(r => r.results).catch(() => []);

      // Signals per circle (last 24h)
      const signals = await db.prepare(
        `SELECT s.*, u.display_name AS author_name, u.avatar_url AS author_avatar
         FROM signals s
         LEFT JOIN users u ON u.id = s.author_id
         WHERE s.target_circle_id IN (${ph})
           AND s.status = 'active'
           AND s.created_at > datetime('now', '-24 hours')
         ORDER BY s.created_at DESC`
      ).bind(...myCircleIds).all<Record<string, unknown>>().then(r => r.results).catch(() => []);

      // New members per circle (last 24h)
      const newMembers = await db.prepare(
        `SELECT cm.circle_id, COUNT(*) AS new_count
         FROM circle_members cm
         WHERE cm.circle_id IN (${ph})
           AND cm.joined_at > datetime('now', '-24 hours')
           AND cm.status = 'active'
         GROUP BY cm.circle_id`
      ).bind(...myCircleIds).all<{ circle_id: string; new_count: number }>().then(r => r.results).catch(() => []);

      // Online members per circle
      const onlineMembers = await db.prepare(
        `SELECT cm.circle_id, u.id, u.display_name, u.avatar_url
         FROM circle_members cm
         JOIN users u ON u.id = cm.user_id
         WHERE cm.circle_id IN (${ph})
           AND cm.status = 'active'
           ${userId ? `AND cm.user_id != ?` : ''}
           AND u.last_seen_at > datetime('now', '-1 hour')
         ORDER BY u.last_seen_at DESC`
      ).bind(...myCircleIds, ...(userId ? [userId] : [])).all<Record<string, unknown>>().then(r => r.results).catch(() => []);

      // Group by circle
      const newMemberMap = new Map(newMembers.map(m => [m.circle_id, m.new_count]));

      for (const circle of circles) {
        const cid = circle.id as string;
        const circleEvents = events.filter(e => e.circle_id === cid);
        const circleSignals = signals.filter(s => s.target_circle_id === cid);
        const circleOnline = onlineMembers.filter(m => m.circle_id === cid);
        const hasLive = circleEvents.some(e => e.status === 'live');
        const activityScore =
          (hasLive ? 1000 : 0) +
          circleEvents.length * 10 +
          circleSignals.length * 5 +
          (newMemberMap.get(cid) || 0) * 2 +
          circleOnline.length;

        circleGroups.push({
          circle,
          events: circleEvents.slice(0, 3),
          signals: circleSignals.slice(0, 5),
          new_member_count: newMemberMap.get(cid) || 0,
          online_members: circleOnline.slice(0, 6),
          has_live: hasLive,
          activity_score: activityScore,
        });
      }

      // Sort: live first, then by activity score
      circleGroups.sort((a, b) => (b.activity_score as number) - (a.activity_score as number));
    }

    // ── Recommended ──
    let recommended: Record<string, unknown>[] = [];

    if (myCategories.length > 0 && myCircleIds.length > 0) {
      const catPh = myCategories.map(() => '?').join(',');
      const idPh = myCircleIds.map(() => '?').join(',');
      recommended = await db.prepare(
        `SELECT * FROM circles WHERE status = 'active' AND category IN (${catPh}) AND id NOT IN (${idPh}) ORDER BY member_count DESC LIMIT 6`
      ).bind(...myCategories, ...myCircleIds).all<Record<string, unknown>>().then(r => r.results).catch(() => []);
    }

    if (recommended.length < 3) {
      const excludeIds = [...myCircleIds, ...recommended.map(r => r.id as string)];
      if (excludeIds.length > 0) {
        const exPh = excludeIds.map(() => '?').join(',');
        const popular = await db.prepare(
          `SELECT * FROM circles WHERE status = 'active' AND id NOT IN (${exPh}) ORDER BY member_count DESC LIMIT ${6 - recommended.length}`
        ).bind(...excludeIds).all<Record<string, unknown>>().then(r => r.results).catch(() => []);
        recommended.push(...popular);
      } else {
        const popular = await db.prepare(
          `SELECT * FROM circles WHERE status = 'active' ORDER BY member_count DESC LIMIT 6`
        ).all<Record<string, unknown>>().then(r => r.results).catch(() => []);
        recommended.push(...popular);
      }
    }

    return NextResponse.json({
      data: {
        circle_groups: circleGroups,
        recommended,
      },
    });
  } catch (err) {
    console.error('[Circles Feed GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch feed' } }, { status: 500 });
  }
}
