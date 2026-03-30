import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';

// Haversine distance SQL
const haversine = (latP: number, lngP: number) =>
  `(6371 * acos(cos(radians($${latP})) * cos(radians(location_lat)) * cos(radians(location_lng) - radians($${lngP})) + sin(radians($${latP})) * sin(radians(location_lat))))`;

const profileHaversine = (latP: number, lngP: number) =>
  `(6371 * acos(cos(radians($${latP})) * cos(radians(lat)) * cos(radians(lng) - radians($${lngP})) + sin(radians($${latP})) * sin(radians(lat))))`;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const lat = parseFloat(searchParams.get('lat') || '32.7767');
    const lng = parseFloat(searchParams.get('lng') || '-96.797');
    const radiusKm = Math.min(parseInt(searchParams.get('radius') || '5000'), 50000) / 1000;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const [businesses, events, profiles] = await Promise.all([
      pgPool.query(
        `SELECT *, ${haversine(1, 2)} AS distance_km
         FROM businesses
         WHERE status = 'active' AND location_lat IS NOT NULL AND ${haversine(1, 2)} < $3
         ORDER BY trust_score DESC LIMIT $4`,
        [lat, lng, radiusKm, limit]
      ).then(r => r.rows).catch(() => []),

      pgPool.query(
        `SELECT *, ${haversine(1, 2)} AS distance_km
         FROM events
         WHERE status IN ('scheduled', 'live') AND start_time > NOW() AND location_lat IS NOT NULL AND ${haversine(1, 2)} < $3
         ORDER BY start_time ASC LIMIT 10`,
        [lat, lng, radiusKm]
      ).then(r => r.rows).catch(() => []),

      pgPool.query(
        `SELECT *, ${profileHaversine(1, 2)} AS distance_km
         FROM profiles
         WHERE status = 'active' AND available = true AND ${profileHaversine(1, 2)} < $3
         ORDER BY trust_score_snapshot DESC LIMIT $4`,
        [lat, lng, radiusKm, limit]
      ).then(r => r.rows).catch(() => []),
    ]);

    const profilesFormatted = profiles.map((p: Record<string, unknown>) => ({
      _id: p.id, user_id: p.user_id, headline: p.headline, bio: p.bio,
      industry: p.industry, skills: p.skills, experience: p.experience,
      education: p.education, languages: p.languages,
      location: { type: 'Point', coordinates: [p.lng, p.lat] },
      city: p.city, available: p.available, work_type: p.work_type,
      trust_score_snapshot: p.trust_score_snapshot, status: p.status, distance_km: p.distance_km,
    }));

    return NextResponse.json({
      data: { businesses, events, profiles: profilesFormatted, people: [], offers: [], agents: [] },
    });
  } catch (err) {
    console.error('[Nearby GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch nearby data' } },
      { status: 500 }
    );
  }
}
