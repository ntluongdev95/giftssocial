import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

/**
 * GET /api/v1/search?q=keyword&lat=...&lng=...&tab=top|people|businesses|events|places&limit=20
 *
 * Unified search across all entity types using SQLite LIKE + distance ranking.
 * Returns grouped results for "top" tab, or filtered results for specific tabs.
 *
 * Optimizations:
 * - Nominatim has a 3s timeout and runs in parallel — never blocks DB queries
 * - AbortController-friendly: clients can cancel in-flight requests
 * - Results are cache-controlled (10s swr + 30s stale)
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const tab = req.nextUrl.searchParams.get('tab') || 'top';
  const lat = parseFloat(req.nextUrl.searchParams.get('lat') || '0');
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') || '0');
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20'), 50);

  if (!q || q.length < 1) {
    return NextResponse.json({ data: { people: [], businesses: [], events: [], circles: [], places: [] } });
  }

  // Sanitize: escape SQL LIKE wildcards in user input
  const escaped = q.replace(/[%_]/g, '\\$&');
  const pattern = `%${escaped}%`;
  // Normalized pattern: lowercase, no spaces → "NTLuong" matches "Nt Luong", "ntluong"
  const normPattern = `%${escaped.replace(/\s+/g, '').toLowerCase()}%`;
  const hasGeo = lat !== 0 && lng !== 0;

  // Distance formula inlined with literal values (SQLite can't use $params in expressions used in ORDER BY)
  const distExpr = hasGeo
    ? `(6371 * acos(MIN(1, cos(radians(${lat})) * cos(radians(location_lat)) * cos(radians(location_lng) - radians(${lng})) + sin(radians(${lat})) * sin(radians(location_lat)))))`
    : '0';

  const db = getDB();

  try {
    const results: Record<string, unknown[]> = { people: [], businesses: [], events: [], circles: [], places: [] };

    const queries: Promise<void>[] = [];

    // ── People (users table) ──
    if (tab === 'top' || tab === 'people') {
      const pLimit = tab === 'top' ? 5 : limit;
      queries.push(
        db.prepare(
          `SELECT id, display_name, username, avatar_url, bio, location_lat, location_lng,
                  ${distExpr} AS distance
           FROM users
           WHERE status = 'active'
             AND (display_name LIKE ? OR username LIKE ? OR bio LIKE ?
                  OR REPLACE(LOWER(display_name), ' ', '') LIKE ?
                  OR REPLACE(LOWER(username), ' ', '') LIKE ?)
           ORDER BY ${hasGeo ? 'distance ASC,' : ''} trust_score DESC
           LIMIT ?`
        ).bind(pattern, pattern, pattern, normPattern, normPattern, pLimit).all<Record<string, unknown>>().then(({ results: rows }) => {
          results.people = rows.map(r => ({
            id: r.id, type: 'people',
            title: r.display_name || r.username || 'User',
            subtitle: r.username ? `@${r.username}` : (r.bio as string)?.slice(0, 60) || '',
            image: r.avatar_url, lat: r.location_lat, lng: r.location_lng,
            distance: r.distance ? Math.round((r.distance as number) * 10) / 10 : null,
          }));
        }).catch(() => {})
      );
    }

    // ── Businesses ──
    if (tab === 'top' || tab === 'businesses') {
      const bLimit = tab === 'top' ? 5 : limit;
      queries.push(
        db.prepare(
          `SELECT id, name, category, address, city, avatar_url, location_lat, location_lng, rating, review_count,
                  ${distExpr} AS distance
           FROM businesses
           WHERE (name LIKE ? OR category LIKE ? OR address LIKE ? OR city LIKE ?
                  OR REPLACE(LOWER(name), ' ', '') LIKE ?)
           ORDER BY ${hasGeo ? 'distance ASC,' : ''} rating DESC
           LIMIT ?`
        ).bind(pattern, pattern, pattern, pattern, normPattern, bLimit).all<Record<string, unknown>>().then(({ results: rows }) => {
          results.businesses = rows.map(r => ({
            id: r.id, type: 'business', title: r.name,
            subtitle: [r.category, r.city].filter(Boolean).join(' · '),
            image: r.avatar_url, lat: r.location_lat, lng: r.location_lng,
            distance: r.distance ? Math.round((r.distance as number) * 10) / 10 : null,
            rating: r.rating, reviewCount: r.review_count,
          }));
        }).catch(() => {})
      );
    }

    // ── Events ──
    if (tab === 'top' || tab === 'events') {
      const eLimit = tab === 'top' ? 5 : limit;
      queries.push(
        db.prepare(
          `SELECT id, title, description, location_name, city, location_lat, location_lng, start_time, status,
                  ${distExpr} AS distance
           FROM events
           WHERE (title LIKE ? OR description LIKE ? OR location_name LIKE ? OR city LIKE ?
                  OR REPLACE(LOWER(title), ' ', '') LIKE ?)
             AND end_time > datetime('now')
           ORDER BY ${hasGeo ? 'distance ASC,' : ''} start_time ASC
           LIMIT ?`
        ).bind(pattern, pattern, pattern, pattern, normPattern, eLimit).all<Record<string, unknown>>().then(({ results: rows }) => {
          results.events = rows.map(r => ({
            id: r.id, type: 'event', title: r.title,
            subtitle: [r.location_name, r.city].filter(Boolean).join(' · '),
            lat: r.location_lat, lng: r.location_lng,
            distance: r.distance ? Math.round((r.distance as number) * 10) / 10 : null,
            startTime: r.start_time, status: r.status,
          }));
        }).catch(() => {})
      );
    }

    // ── Circles ──
    if (tab === 'top' || tab === 'circles') {
      const cLimit = tab === 'top' ? 5 : limit;
      queries.push(
        db.prepare(
          `SELECT id, name, slug, category, city, avatar_url, description, member_count, location_lat, location_lng,
                  ${distExpr} AS distance
           FROM circles
           WHERE status = 'active'
             AND (name LIKE ? OR category LIKE ? OR city LIKE ? OR description LIKE ?
                  OR REPLACE(LOWER(name), ' ', '') LIKE ?)
           ORDER BY ${hasGeo ? 'distance ASC,' : ''} member_count DESC
           LIMIT ?`
        ).bind(pattern, pattern, pattern, pattern, normPattern, cLimit).all<Record<string, unknown>>().then(({ results: rows }) => {
          results.circles = rows.map(r => ({
            id: r.id, type: 'circle', title: r.name,
            subtitle: [r.category, r.city].filter(Boolean).join(' · '),
            image: r.avatar_url, lat: r.location_lat, lng: r.location_lng,
            distance: r.distance ? Math.round((r.distance as number) * 10) / 10 : null,
            memberCount: r.member_count,
          }));
        }).catch(() => {})
      );
    }

    // ── Places (OSM Nominatim) ──
    if (tab === 'top' || tab === 'places') {
      const pLimit = tab === 'top' ? 3 : limit;
      queries.push(
        fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=${pLimit}&addressdetails=1`,
          { headers: { 'User-Agent': 'GaoSocial/1.0' }, next: { revalidate: 60 }, signal: AbortSignal.timeout(3000) }
        ).then(async (osmRes) => {
          if (osmRes.ok) {
            const osmData = await osmRes.json();
            results.places = osmData.map((r: Record<string, unknown>) => ({
              id: `osm_${r.place_id}`, type: 'place',
              title: r.display_name as string, subtitle: (r.type as string) || '',
              lat: parseFloat(r.lat as string), lng: parseFloat(r.lon as string),
            }));
          }
        }).catch(() => {})
      );
    }

    // Use allSettled so one failing query doesn't block the rest
    await Promise.allSettled(queries);

    return NextResponse.json({ data: results }, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
    });
  } catch (err) {
    console.error('[Search]', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
