import { NextRequest, NextResponse } from 'next/server';
import ngeohash from 'ngeohash';
import { connectMongo, pgPool, redis } from '@/lib/db';
import Signal from '@/models/Signal';
import AgentModel from '@/models/Agent';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const lat = parseFloat(searchParams.get('lat') || '32.7767');
    const lng = parseFloat(searchParams.get('lng') || '-96.797');
    const radius = Math.min(parseInt(searchParams.get('radius') || '5000'), 50000);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    // ─── Check Redis cache ────────────────────────────────────────────
    const geohash6 = ngeohash.encode(lat, lng, 6);
    const cacheKey = `nearby:${geohash6}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return NextResponse.json({ data: JSON.parse(cached) });
      }
    } catch {
      // Redis down — continue without cache
    }

    // ─── Parallel queries ─────────────────────────────────────────────

    await connectMongo();

    const geoQuery = {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radius,
      },
    };

    const [signals, businesses, events, agents] = await Promise.all([
      // MongoDB — active signals
      Signal.find({
        location: geoQuery,
        status: 'active',
        expires_at: { $gt: new Date() },
        visibility: 'public',
      })
        .limit(30)
        .lean(),

      // PostgreSQL — businesses
      pgPool
        .query(
          `SELECT *,
            (6371000 * acos(
              cos(radians($1)) * cos(radians(location_lat)) *
              cos(radians(location_lng) - radians($2)) +
              sin(radians($1)) * sin(radians(location_lat))
            )) AS distance_meters
          FROM businesses
          WHERE status = 'active'
            AND location_lat IS NOT NULL
            AND (6371000 * acos(
              cos(radians($1)) * cos(radians(location_lat)) *
              cos(radians(location_lng) - radians($2)) +
              sin(radians($1)) * sin(radians(location_lat))
            )) < $3
          ORDER BY trust_score DESC
          LIMIT $4`,
          [lat, lng, radius, limit]
        )
        .then((r) => r.rows)
        .catch(() => []),

      // PostgreSQL — upcoming events
      pgPool
        .query(
          `SELECT *,
            (6371000 * acos(
              cos(radians($1)) * cos(radians(location_lat)) *
              cos(radians(location_lng) - radians($2)) +
              sin(radians($1)) * sin(radians(location_lat))
            )) AS distance_meters
          FROM events
          WHERE status IN ('scheduled', 'live')
            AND start_time > NOW()
            AND location_lat IS NOT NULL
            AND (6371000 * acos(
              cos(radians($1)) * cos(radians(location_lat)) *
              cos(radians(location_lng) - radians($2)) +
              sin(radians($1)) * sin(radians(location_lat))
            )) < $3
          ORDER BY start_time ASC
          LIMIT 10`,
          [lat, lng, radius]
        )
        .then((r) => r.rows)
        .catch(() => []),

      // MongoDB — agents
      AgentModel.find({
        location: geoQuery,
        status: 'active',
        map_visible: true,
      })
        .limit(10)
        .lean(),
    ]);

    // ─── Separate signals by type ─────────────────────────────────────
    const offers = signals.filter((s) => s.type === 'offer');
    const people = signals.filter((s) => s.type === 'presence' || s.type === 'intent');

    const result = {
      people,
      businesses,
      events,
      offers,
      agents,
    };

    // ─── Cache in Redis (30s TTL) ─────────────────────────────────────
    try {
      await redis.setex(cacheKey, 30, JSON.stringify(result));
    } catch {
      // Redis down — skip cache
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error('[Nearby GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch nearby data' } },
      { status: 500 }
    );
  }
}
