import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';

/**
 * GET /api/v1/search?q=keyword&lat=...&lng=...&tab=top|people|businesses|events|places&limit=20
 *
 * Unified search across all entity types using PostgreSQL ILIKE + distance ranking.
 * Returns grouped results for "top" tab, or filtered results for specific tabs.
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

  const pattern = `%${q}%`;
  const hasGeo = lat !== 0 && lng !== 0;

  // Distance formula (approximate km using Haversine shortcut)
  const distExpr = hasGeo
    ? `(6371 * acos(LEAST(1, cos(radians($lat)) * cos(radians(location_lat)) * cos(radians(location_lng) - radians($lng)) + sin(radians($lat)) * sin(radians(location_lat)))))`
    : '0';

  const distReplace = (sql: string) => sql.replace(/\$lat/g, String(lat)).replace(/\$lng/g, String(lng));

  try {
    const results: Record<string, unknown[]> = { people: [], businesses: [], events: [], circles: [], places: [] };

    // Build queries in parallel for speed (especially important for "top" tab)
    const queries: Promise<void>[] = [];

    // ── People (users table) ──
    if (tab === 'top' || tab === 'people') {
      const pLimit = tab === 'top' ? 5 : limit;
      queries.push(
        pgPool.query(
          `SELECT id, display_name, username, avatar_url, bio, location_lat, location_lng,
                  ${distReplace(distExpr)} AS distance
           FROM users
           WHERE status = 'active'
             AND (display_name ILIKE $1 OR username ILIKE $1 OR bio ILIKE $1)
           ORDER BY ${hasGeo ? 'distance ASC,' : ''} trust_score DESC NULLS LAST
           LIMIT $2`,
          [pattern, pLimit]
        ).then(({ rows }) => {
          results.people = rows.map(r => ({
            id: r.id, type: 'people',
            title: r.display_name || r.username || 'User',
            subtitle: r.username ? `@${r.username}` : r.bio?.slice(0, 60) || '',
            image: r.avatar_url, lat: r.location_lat, lng: r.location_lng,
            distance: r.distance ? Math.round(r.distance * 10) / 10 : null,
          }));
        }).catch(() => {})
      );
    }

    // ── Businesses ──
    if (tab === 'top' || tab === 'businesses') {
      const bLimit = tab === 'top' ? 5 : limit;
      queries.push(
        pgPool.query(
          `SELECT id, name, category, address, city, avatar_url, location_lat, location_lng, rating, review_count,
                  ${distReplace(distExpr)} AS distance
           FROM businesses
           WHERE (name ILIKE $1 OR category ILIKE $1 OR address ILIKE $1 OR city ILIKE $1)
           ORDER BY ${hasGeo ? 'distance ASC,' : ''} rating DESC NULLS LAST
           LIMIT $2`,
          [pattern, bLimit]
        ).then(({ rows }) => {
          results.businesses = rows.map(r => ({
            id: r.id, type: 'business', title: r.name,
            subtitle: [r.category, r.city].filter(Boolean).join(' · '),
            image: r.avatar_url, lat: r.location_lat, lng: r.location_lng,
            distance: r.distance ? Math.round(r.distance * 10) / 10 : null,
            rating: r.rating, reviewCount: r.review_count,
          }));
        }).catch(() => {})
      );
    }

    // ── Events ──
    if (tab === 'top' || tab === 'events') {
      const eLimit = tab === 'top' ? 5 : limit;
      queries.push(
        pgPool.query(
          `SELECT id, title, description, location_name, city, location_lat, location_lng, start_time, status,
                  ${distReplace(distExpr)} AS distance
           FROM events
           WHERE (title ILIKE $1 OR description ILIKE $1 OR location_name ILIKE $1 OR city ILIKE $1)
             AND end_time > NOW()
           ORDER BY ${hasGeo ? 'distance ASC,' : ''} start_time ASC
           LIMIT $2`,
          [pattern, eLimit]
        ).then(({ rows }) => {
          results.events = rows.map(r => ({
            id: r.id, type: 'event', title: r.title,
            subtitle: [r.location_name, r.city].filter(Boolean).join(' · '),
            lat: r.location_lat, lng: r.location_lng,
            distance: r.distance ? Math.round(r.distance * 10) / 10 : null,
            startTime: r.start_time, status: r.status,
          }));
        }).catch(() => {})
      );
    }

    // ── Circles ──
    if (tab === 'top' || tab === 'circles') {
      const cLimit = tab === 'top' ? 5 : limit;
      queries.push(
        pgPool.query(
          `SELECT id, name, slug, category, city, avatar_url, description, member_count, location_lat, location_lng,
                  ${distReplace(distExpr)} AS distance
           FROM circles
           WHERE status = 'active'
             AND (name ILIKE $1 OR category ILIKE $1 OR city ILIKE $1 OR description ILIKE $1)
           ORDER BY ${hasGeo ? 'distance ASC,' : ''} member_count DESC NULLS LAST
           LIMIT $2`,
          [pattern, cLimit]
        ).then(({ rows }) => {
          results.circles = rows.map(r => ({
            id: r.id, type: 'circle', title: r.name,
            subtitle: [r.category, r.city].filter(Boolean).join(' · '),
            image: r.avatar_url, lat: r.location_lat, lng: r.location_lng,
            distance: r.distance ? Math.round(r.distance * 10) / 10 : null,
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

    await Promise.all(queries);

    return NextResponse.json({ data: results }, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
    });
  } catch (err) {
    console.error('[Search]', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
