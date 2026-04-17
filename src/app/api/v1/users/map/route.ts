import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

/**
 * GET /api/v1/users/map?lat=...&lng=...&radius=100000
 *
 * Returns all active users with location for map display.
 * Lightweight: only fields needed for markers.
 */
export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get('lat') || '0');
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') || '0');
  const radiusKm = Math.min(parseInt(req.nextUrl.searchParams.get('radius') || '100000'), 500000) / 1000;
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '200'), 500);
  const hasGeo = lat !== 0 && lng !== 0;

  const db = getDB();

  try {
    let sql: string;
    const values: unknown[] = [];

    if (hasGeo) {
      const distExpr = `(6371 * acos(MIN(1, cos(radians(${lat})) * cos(radians(location_lat)) * cos(radians(location_lng) - radians(${lng})) + sin(radians(${lat})) * sin(radians(location_lat)))))`;
      sql = `SELECT id, display_name, username, avatar_url, location_lat, location_lng, city, trust_level, trust_score,
                    ${distExpr} AS distance
             FROM users
             WHERE status = 'active'
               AND location_lat IS NOT NULL AND location_lng IS NOT NULL
               AND (location_sharing IS NULL OR location_sharing != 'off')
               AND ${distExpr} < ?
             ORDER BY distance ASC
             LIMIT ?`;
      values.push(radiusKm, limit);
    } else {
      sql = `SELECT id, display_name, username, avatar_url, location_lat, location_lng, city, trust_level, trust_score
             FROM users
             WHERE status = 'active'
               AND location_lat IS NOT NULL AND location_lng IS NOT NULL
               AND (location_sharing IS NULL OR location_sharing != 'off')
             ORDER BY last_seen_at DESC
             LIMIT ?`;
      values.push(limit);
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
