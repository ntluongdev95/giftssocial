import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { buildLocationVisibilityClause } from '@/lib/visibility';

/**
 * GET /api/v1/users/map?lat=...&lng=...&radius=100000
 *
 * Returns users visible to the current viewer, respecting location_sharing
 * (exact / approximate / friends / circles / off), location_shared_until
 * expiration, and event_location_grants that grant access to co-attendees.
 *
 * Response is per-viewer — must not be shared-cacheable.
 */
export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get('lat') || '0');
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') || '0');
  const radiusKm = Math.min(parseInt(req.nextUrl.searchParams.get('radius') || '100000'), 500000) / 1000;
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '200'), 500);
  const hasGeo = lat !== 0 && lng !== 0;

  const viewerId = await resolveUserId(req).catch(() => null);
  const visibility = buildLocationVisibilityClause('u', viewerId);
  const db = getDB();

  try {
    let sql: string;
    const values: unknown[] = [];

    if (hasGeo) {
      const distExpr = `(6371 * acos(MIN(1, cos(radians(${lat})) * cos(radians(u.location_lat)) * cos(radians(u.location_lng) - radians(${lng})) + sin(radians(${lat})) * sin(radians(u.location_lat)))))`;
      sql = `SELECT u.id, u.display_name, u.username, u.avatar_url, u.location_lat, u.location_lng, u.city, u.trust_level, u.trust_score,
                    ${distExpr} AS distance
             FROM users u
             WHERE u.status = 'active'
               AND u.location_lat IS NOT NULL AND u.location_lng IS NOT NULL
               AND ${visibility.sql}
               AND ${distExpr} < ?
             ORDER BY distance ASC
             LIMIT ?`;
      values.push(...visibility.params, radiusKm, limit);
    } else {
      sql = `SELECT u.id, u.display_name, u.username, u.avatar_url, u.location_lat, u.location_lng, u.city, u.trust_level, u.trust_score
             FROM users u
             WHERE u.status = 'active'
               AND u.location_lat IS NOT NULL AND u.location_lng IS NOT NULL
               AND ${visibility.sql}
             ORDER BY u.last_seen_at DESC
             LIMIT ?`;
      values.push(...visibility.params, limit);
    }

    const { results: rows } = await db.prepare(sql).bind(...values).all<Record<string, unknown>>();

    const data = rows.map(r => ({
      id: r.id,
      display_name: r.display_name || r.username || 'User',
      username: r.username,
      avatar_url: r.avatar_url,
      location_lat: r.location_lat,
      location_lng: r.location_lng,
      city: r.city,
      trust_level: r.trust_level,
      trust_score: r.trust_score,
    }));

    return NextResponse.json({ data }, {
      headers: { 'Cache-Control': 'private, no-cache, must-revalidate' },
    });
  } catch (err) {
    console.error('[Users Map]', err);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
