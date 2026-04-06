import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/friends — Mutual follows with location ────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ data: [] });

    const db = getDB();

    // Mutual follows: I follow them AND they follow me
    const result = await db.prepare(
      `SELECT u.id, u.display_name, u.username, u.avatar_url, u.trust_level, u.trust_score,
              u.location_lat, u.location_lng, u.location_sharing, u.last_seen_at
       FROM follows f1
       JOIN follows f2 ON f1.following_user_id = f2.follower_id AND f2.following_user_id = f1.follower_id
       JOIN users u ON u.id = f1.following_user_id
       WHERE f1.follower_id = ? AND u.status = 'active'
       LIMIT 100`
    ).bind(userId).all<Record<string, unknown>>();

    const friends = result.results.map((r) => ({
      id: r.id,
      display_name: r.display_name || r.username || 'Unknown',
      avatar_url: r.avatar_url || null,
      trust_level: r.trust_level || 'new',
      trust_score: r.trust_score || 0,
      location_sharing: r.location_sharing || 'off',
      location: r.location_lat && r.location_lng
        ? { type: 'Point', coordinates: [r.location_lng, r.location_lat] }
        : null,
      is_online: r.last_seen_at ? (Date.now() - new Date(r.last_seen_at as string).getTime()) < 5 * 60 * 1000 : false,
      last_seen_at: r.last_seen_at || null,
    }));

    return NextResponse.json({ data: friends });
  } catch (err) {
    console.error('[Friends GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch friends' } }, { status: 500 });
  }
}
