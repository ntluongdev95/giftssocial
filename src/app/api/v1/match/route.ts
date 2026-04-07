import { NextRequest, NextResponse } from 'next/server';
import { getDB, parseRow } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── Simple scoring-based matching engine ────────────────────────────────
// Future: replace scoring SQL with LLM/AI embeddings
// Current: category match + distance + trust + rating

// ─── GET /api/v1/match ───────────────────────────────────────────────────
// ?type=intent_to_business&signal_id=xxx
// ?type=people_nearby&lat=&lng=
// ?type=events_for_you

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const type = searchParams.get('type');
    const userId = await resolveUserId(req);

    switch (type) {
      case 'intent_to_business':
        return matchIntentToBusiness(searchParams);

      case 'people_nearby':
        return matchPeopleNearby(searchParams, userId);

      case 'events_for_you':
        return matchEventsForYou(userId);

      default:
        return NextResponse.json({ error: { code: 'invalid_request', message: 'type required: intent_to_business, people_nearby, events_for_you' } }, { status: 400 });
    }
  } catch (err) {
    console.error('[Match GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Matching failed' } }, { status: 500 });
  }
}

// ─── 1. Intent → Business matching ──────────────────────────────────────

async function matchIntentToBusiness(params: URLSearchParams) {
  const signalId = params.get('signal_id');
  const category = params.get('category');
  const lat = parseFloat(params.get('lat') || '0');
  const lng = parseFloat(params.get('lng') || '0');
  const radiusKm = Math.min(parseInt(params.get('radius') || '10000'), 50000) / 1000;

  const db = getDB();
  let signalLat = lat;
  let signalLng = lng;
  let signalCategory = category || '';

  // If signal_id provided, get signal location + category
  if (signalId) {
    const sig = await db.prepare('SELECT location_lat, location_lng, category, metadata FROM signals WHERE id = ?').bind(signalId).first<{ location_lat: number; location_lng: number; category: string; metadata: string }>();
    if (sig) {
      signalLat = sig.location_lat;
      signalLng = sig.location_lng;
      signalCategory = sig.category || signalCategory;
    }
  }

  if (signalLat === 0 && signalLng === 0) {
    return NextResponse.json({ data: [], message: 'No location available' });
  }

  // Score = category_match(10) + distance_score(0-8) + trust(0-5) + rating(0-5) + booking(3)
  // Note: SQLite doesn't support $N = ANY(array), using LOWER(category) = LOWER(?) only
  const result = await db.prepare(`
    SELECT *,
      (6371 * acos(MIN(1.0, cos(radians(?)) * cos(radians(location_lat)) * cos(radians(location_lng) - radians(?)) + sin(radians(?)) * sin(radians(location_lat))))) AS distance_km,
      (
        CASE WHEN LOWER(category) = LOWER(?) THEN 10 ELSE 0 END
        + CASE
            WHEN (6371 * acos(MIN(1.0, cos(radians(?)) * cos(radians(location_lat)) * cos(radians(location_lng) - radians(?)) + sin(radians(?)) * sin(radians(location_lat))))) < 1 THEN 8
            WHEN (6371 * acos(MIN(1.0, cos(radians(?)) * cos(radians(location_lat)) * cos(radians(location_lng) - radians(?)) + sin(radians(?)) * sin(radians(location_lat))))) < 3 THEN 5
            WHEN (6371 * acos(MIN(1.0, cos(radians(?)) * cos(radians(location_lat)) * cos(radians(location_lng) - radians(?)) + sin(radians(?)) * sin(radians(location_lat))))) < 10 THEN 2
            ELSE 0
          END
        + CASE WHEN trust_score >= 60 THEN 5 WHEN trust_score >= 30 THEN 2 ELSE 0 END
        + CASE WHEN rating_avg >= 4.5 THEN 5 WHEN rating_avg >= 4.0 THEN 3 WHEN rating_avg >= 3.5 THEN 1 ELSE 0 END
        + CASE WHEN booking_enabled = 1 THEN 3 ELSE 0 END
      ) AS match_score
    FROM businesses
    WHERE status = 'active'
      AND (6371 * acos(MIN(1.0, cos(radians(?)) * cos(radians(location_lat)) * cos(radians(location_lng) - radians(?)) + sin(radians(?)) * sin(radians(location_lat))))) < ?
    ORDER BY match_score DESC, distance_km ASC
    LIMIT 10
  `).bind(
    signalLat, signalLng, signalLat,                   // distance_km expr
    signalCategory,                                      // category match
    signalLat, signalLng, signalLat,                   // dist < 1
    signalLat, signalLng, signalLat,                   // dist < 3
    signalLat, signalLng, signalLat,                   // dist < 10
    signalLat, signalLng, signalLat, radiusKm          // WHERE clause
  ).all<Record<string, unknown>>();

  return NextResponse.json({
    data: result.results,
    meta: { type: 'intent_to_business', category: signalCategory, location: [signalLng, signalLat], results: result.results.length },
  });
}

// ─── 2. People nearby matching ──────────────────────────────────────────

async function matchPeopleNearby(params: URLSearchParams, userId: string | null) {
  const lat = parseFloat(params.get('lat') || '0');
  const lng = parseFloat(params.get('lng') || '0');
  const radiusKm = Math.min(parseInt(params.get('radius') || '10000'), 50000) / 1000;

  if (lat === 0 && lng === 0) {
    return NextResponse.json({ data: [] });
  }

  const db = getDB();

  // Get current user's profile for skill matching
  let mySkills: string[] = [];
  let myIndustry = '';
  if (userId) {
    const me = await db.prepare('SELECT skills, industry FROM profiles WHERE user_id = ?').bind(userId).first<{ skills: string; industry: string }>();
    if (me) {
      // skills stored as JSON string
      try { mySkills = JSON.parse(me.skills || '[]'); } catch { mySkills = []; }
      myIndustry = me.industry || '';
    }
  }

  // Score = distance(0-8) + same_industry(5) + trust(0-5)
  // Skills overlap simplified: check if any of mySkills appear in skills text
  const skillMatch = mySkills.length > 0
    ? mySkills.map(() => `skills LIKE ?`).join(' + ')
    : '0';
  const skillValues = mySkills.map(s => `%${s}%`);

  const result = await db.prepare(`
    SELECT p.*,
      u.username, u.display_name, u.avatar_url, u.trust_score AS user_trust_score, u.trust_level AS user_trust_level,
      (6371 * acos(MIN(1.0, cos(radians(?)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(?)) + sin(radians(?)) * sin(radians(p.lat))))) AS distance_km,
      (
        CASE
          WHEN (6371 * acos(MIN(1.0, cos(radians(?)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(?)) + sin(radians(?)) * sin(radians(p.lat))))) < 1 THEN 8
          WHEN (6371 * acos(MIN(1.0, cos(radians(?)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(?)) + sin(radians(?)) * sin(radians(p.lat))))) < 5 THEN 5
          WHEN (6371 * acos(MIN(1.0, cos(radians(?)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(?)) + sin(radians(?)) * sin(radians(p.lat))))) < 15 THEN 2
          ELSE 0
        END
        + CASE WHEN p.industry = ? AND ? != '' THEN 5 ELSE 0 END
        + CASE WHEN p.trust_score_snapshot >= 60 THEN 5 WHEN p.trust_score_snapshot >= 30 THEN 2 ELSE 0 END
      ) AS match_score
    FROM profiles p
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.status = 'active'
      AND p.user_id != COALESCE(?, '')
      AND (6371 * acos(MIN(1.0, cos(radians(?)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(?)) + sin(radians(?)) * sin(radians(p.lat))))) < ?
    ORDER BY match_score DESC, distance_km ASC
    LIMIT 20
  `).bind(
    lat, lng, lat,              // distance_km
    lat, lng, lat,              // dist < 1
    lat, lng, lat,              // dist < 5
    lat, lng, lat,              // dist < 15
    myIndustry, myIndustry,    // industry match
    userId || '',              // exclude self
    lat, lng, lat, radiusKm   // WHERE distance < radius
  ).all<Record<string, unknown>>();

  // Format profiles
  const data = result.results.map((r: Record<string, unknown>) => ({
    _id: r.id, user_id: r.user_id, headline: r.headline, bio: r.bio,
    industry: r.industry, skills: r.skills, experience: r.experience,
    education: r.education, languages: r.languages,
    location: { type: 'Point', coordinates: [r.lng, r.lat] },
    city: r.city, available: r.available, work_type: r.work_type,
    trust_score_snapshot: r.trust_score_snapshot,
    username: r.username, display_name: r.display_name, avatar_url: r.avatar_url,
    user_trust_level: r.user_trust_level,
    match_score: r.match_score, distance_km: r.distance_km,
  }));

  return NextResponse.json({ data, meta: { type: 'people_nearby', results: data.length } });
}

// ─── 3. Events for you ──────────────────────────────────────────────────

async function matchEventsForYou(userId: string | null) {
  const db = getDB();

  if (!userId) {
    // Not logged in — return popular upcoming events
    const result = await db.prepare(`
      SELECT * FROM events
      WHERE status IN ('scheduled', 'live') AND start_time > datetime('now')
      ORDER BY joined_count DESC LIMIT 10
    `).all<Record<string, unknown>>();
    return NextResponse.json({ data: result.results });
  }

  // Get user's circles
  const circlesRes = await db.prepare(
    "SELECT circle_id FROM circle_members WHERE user_id = ? AND status = 'active'"
  ).bind(userId).all<{ circle_id: string }>();
  const circleIds = circlesRes.results.map(r => r.circle_id);

  // Get user's profile for industry/category matching
  const profileRes = await db.prepare('SELECT industry, city FROM profiles WHERE user_id = ?').bind(userId).first<{ industry: string; city: string }>();
  const myIndustry = profileRes?.industry || '';
  const myCity = profileRes?.city?.split(',')[0] || '';

  // Score = in_my_circle(10) + same_category_as_industry(5) + same_city(3) + popularity(0-5) + verified(3)
  // circle_id = ANY(circleIds) → circle_id IN (...)
  let circleInClause = '0';
  const circleBindValues: string[] = [];
  if (circleIds.length > 0) {
    circleInClause = `CASE WHEN circle_id IN (${circleIds.map(() => '?').join(',')}) THEN 10 ELSE 0 END`;
    circleBindValues.push(...circleIds);
  }

  const result = await db.prepare(`
    SELECT *,
      (
        ${circleInClause}
        + CASE WHEN LOWER(category) = LOWER(?) THEN 5 ELSE 0 END
        + CASE WHEN LOWER(city) LIKE ? THEN 3 ELSE 0 END
        + CASE WHEN joined_count > 50 THEN 5 WHEN joined_count > 20 THEN 3 WHEN joined_count > 5 THEN 1 ELSE 0 END
        + CASE WHEN verified = 1 THEN 3 ELSE 0 END
      ) AS match_score
    FROM events
    WHERE status IN ('scheduled', 'live') AND start_time > datetime('now')
    ORDER BY match_score DESC, start_time ASC
    LIMIT 10
  `).bind(...circleBindValues, myIndustry, `%${myCity}%`).all<Record<string, unknown>>();

  return NextResponse.json({ data: result.results, meta: { type: 'events_for_you', results: result.results.length } });
}
