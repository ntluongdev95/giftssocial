import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { buildLocationVisibilityClause } from '@/lib/visibility';
import type { BusinessRow, EventRow, CircleRow } from '@/types/d1';

const haversine = (lat: number, lng: number) =>
  `(6371 * acos(MIN(1.0, cos(radians(${lat})) * cos(radians(location_lat)) * cos(radians(location_lng) - radians(${lng})) + sin(radians(${lat})) * sin(radians(location_lat)))))`;

const profileHaversine = (lat: number, lng: number) =>
  `(6371 * acos(MIN(1.0, cos(radians(${lat})) * cos(radians(lat)) * cos(radians(lng) - radians(${lng})) + sin(radians(${lat})) * sin(radians(lat)))))`;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const lat = parseFloat(searchParams.get('lat') || '32.7767');
    const lng = parseFloat(searchParams.get('lng') || '-96.797');
    const radiusKm = Math.min(parseInt(searchParams.get('radius') || '50000'), 500000) / 1000;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const db = getDB();
    const viewerId = await resolveUserId(req).catch(() => null);
    const visibility = buildLocationVisibilityClause('u', viewerId);

    const [businesses, events, profiles, signals, circles] = await Promise.all([
      db.prepare(
        `SELECT *, ${haversine(lat, lng)} AS distance_km
         FROM businesses
         WHERE status = 'active' AND location_lat IS NOT NULL AND ${haversine(lat, lng)} < ?
         ORDER BY trust_score DESC LIMIT ?`
      ).bind(radiusKm, limit).all<BusinessRow & { distance_km: number }>().then(r => parseRows(r.results as unknown as Record<string, unknown>[])).catch(() => []),

      db.prepare(
        `SELECT *, ${haversine(lat, lng)} AS distance_km
         FROM events
         WHERE status IN ('scheduled', 'live') AND start_time > datetime('now') AND location_lat IS NOT NULL AND ${haversine(lat, lng)} < ?
         ORDER BY start_time ASC LIMIT 10`
      ).bind(radiusKm).all<EventRow & { distance_km: number }>().then(r => parseRows(r.results as unknown as Record<string, unknown>[])).catch(() => []),

      (() => {
        const dist = `(6371 * acos(MIN(1.0, cos(radians(${lat})) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(${lng})) + sin(radians(${lat})) * sin(radians(p.lat)))))`;
        return db.prepare(
          `SELECT p.*, ${dist} AS distance_km
           FROM profiles p
           LEFT JOIN users u ON u.id = p.user_id
           WHERE p.status = 'active' AND p.available = 1
             AND ${visibility.sql}
             AND ${dist} < ?
           ORDER BY p.trust_score_snapshot DESC LIMIT ?`
        ).bind(...visibility.params, radiusKm, limit).all<Record<string, unknown>>().then(r => r.results).catch(() => []);
      })(),

      db.prepare(
        `SELECT s.*, u.username AS author_username, u.display_name AS author_name, u.avatar_url AS author_avatar,
                (6371 * acos(MIN(1.0, cos(radians(?)) * cos(radians(s.location_lat)) * cos(radians(s.location_lng) - radians(?)) + sin(radians(?)) * sin(radians(s.location_lat))))) AS distance_km
         FROM signals s
         LEFT JOIN users u ON u.id = s.author_id
         WHERE s.status = 'active' AND s.expires_at > datetime('now') AND s.visibility = 'public'
           AND (6371 * acos(MIN(1.0, cos(radians(?)) * cos(radians(s.location_lat)) * cos(radians(s.location_lng) - radians(?)) + sin(radians(?)) * sin(radians(s.location_lat))))) < ?
         ORDER BY s.created_at DESC LIMIT ?`
      ).bind(lat, lng, lat, lat, lng, lat, radiusKm, limit).all<Record<string, unknown>>().then(r => r.results).catch(err => { console.error('[Nearby signals]', err); return []; }),

      db.prepare(
        `SELECT *, ${haversine(lat, lng)} AS distance_km
         FROM circles
         WHERE status = 'active' AND location_lat IS NOT NULL AND ${haversine(lat, lng)} < ?
         ORDER BY member_count DESC LIMIT ?`
      ).bind(radiusKm, limit).all<CircleRow & { distance_km: number }>().then(r => parseRows(r.results as unknown as Record<string, unknown>[])).catch(() => []),
    ]);

    // Separate signals by type
    const offers = signals.filter((s: Record<string, unknown>) => s.type === 'offer');
    const people = signals.filter((s: Record<string, unknown>) => s.type === 'presence' || s.type === 'intent');

    const profilesFormatted = profiles.map((p: Record<string, unknown>) => ({
      _id: p.id, user_id: p.user_id, headline: p.headline, bio: p.bio,
      industry: p.industry, skills: p.skills, experience: p.experience,
      education: p.education, languages: p.languages,
      location: { type: 'Point', coordinates: [p.lng, p.lat] },
      city: p.city, available: p.available, work_type: p.work_type,
      trust_score_snapshot: p.trust_score_snapshot, status: p.status, distance_km: p.distance_km,
    }));

    const signalsFormatted = signals.map((s: Record<string, unknown>) => ({
      ...s,
      location: { type: 'Point', coordinates: [s.location_lng, s.location_lat] },
    }));

    return NextResponse.json({
      data: {
        businesses,
        events,
        profiles: profilesFormatted,
        people,
        offers,
        signals: signalsFormatted,
        circles,
        agents: [],
      },
    });
  } catch (err) {
    console.error('[Nearby GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch nearby data' } },
      { status: 500 }
    );
  }
}
