import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

/**
 * GET /api/v1/me/unlocked
 *
 * Returns the set of venues the current user has checked in to, for
 * the "paint your map" feature. The client uses this to render locked
 * (dim) vs unlocked (full-color) markers.
 *
 * Response shape: { data: { businesses: [id1, id2, ...], events: [...] } }
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ data: { businesses: [], events: [] } });

    const db = getDB();
    const { results } = await db.prepare(
      `SELECT target_type, target_id, MAX(verified) AS verified
       FROM checkins
       WHERE user_id = ? AND target_id IS NOT NULL
       GROUP BY target_type, target_id`
    ).bind(userId).all<{ target_type: string; target_id: string; verified: number }>();

    const businesses: { id: string; verified: boolean }[] = [];
    const events: { id: string; verified: boolean }[] = [];
    for (const r of results) {
      const entry = { id: r.target_id, verified: !!r.verified };
      if (r.target_type === 'business') businesses.push(entry);
      else if (r.target_type === 'event') events.push(entry);
    }

    return NextResponse.json({ data: { businesses, events } }, {
      headers: { 'Cache-Control': 'private, no-cache, must-revalidate' },
    });
  } catch (err) {
    console.error('[Me Unlocked GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch unlocked' } }, { status: 500 });
  }
}
