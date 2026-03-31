import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
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

  let signalLat = lat;
  let signalLng = lng;
  let signalCategory = category || '';

  // If signal_id provided, get signal location + category
  if (signalId) {
    const sig = await pgPool.query('SELECT location_lat, location_lng, category, metadata FROM signals WHERE id = $1', [signalId]);
    if (sig.rows.length > 0) {
      signalLat = sig.rows[0].location_lat;
      signalLng = sig.rows[0].location_lng;
      signalCategory = sig.rows[0].category || signalCategory;
    }
  }

  if (signalLat === 0 && signalLng === 0) {
    return NextResponse.json({ data: [], message: 'No location available' });
  }

  // Score = category_match(10) + distance_score(0-8) + trust(0-5) + rating(0-5) + booking(3)
  const result = await pgPool.query(`
    SELECT *,
      (6371 * acos(LEAST(1.0, cos(radians($1)) * cos(radians(location_lat)) * cos(radians(location_lng) - radians($2)) + sin(radians($1)) * sin(radians(location_lat))))) AS distance_km,
      (
        CASE WHEN LOWER(category) = LOWER($3) OR $3 = ANY(subcategories) THEN 10 ELSE 0 END
        + CASE
            WHEN (6371 * acos(LEAST(1.0, cos(radians($1)) * cos(radians(location_lat)) * cos(radians(location_lng) - radians($2)) + sin(radians($1)) * sin(radians(location_lat))))) < 1 THEN 8
            WHEN (6371 * acos(LEAST(1.0, cos(radians($1)) * cos(radians(location_lat)) * cos(radians(location_lng) - radians($2)) + sin(radians($1)) * sin(radians(location_lat))))) < 3 THEN 5
            WHEN (6371 * acos(LEAST(1.0, cos(radians($1)) * cos(radians(location_lat)) * cos(radians(location_lng) - radians($2)) + sin(radians($1)) * sin(radians(location_lat))))) < 10 THEN 2
            ELSE 0
          END
        + CASE WHEN trust_score >= 60 THEN 5 WHEN trust_score >= 30 THEN 2 ELSE 0 END
        + CASE WHEN rating_avg >= 4.5 THEN 5 WHEN rating_avg >= 4.0 THEN 3 WHEN rating_avg >= 3.5 THEN 1 ELSE 0 END
        + CASE WHEN booking_enabled THEN 3 ELSE 0 END
      ) AS match_score
    FROM businesses
    WHERE status = 'active'
      AND (6371 * acos(LEAST(1.0, cos(radians($1)) * cos(radians(location_lat)) * cos(radians(location_lng) - radians($2)) + sin(radians($1)) * sin(radians(location_lat))))) < $4
    ORDER BY match_score DESC, distance_km ASC
    LIMIT 10
  `, [signalLat, signalLng, signalCategory, radiusKm]);

  return NextResponse.json({
    data: result.rows,
    meta: { type: 'intent_to_business', category: signalCategory, location: [signalLng, signalLat], results: result.rows.length },
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

  // Get current user's profile for skill matching
  let mySkills: string[] = [];
  let myIndustry = '';
  if (userId) {
    const me = await pgPool.query('SELECT skills, industry FROM profiles WHERE user_id = $1', [userId]);
    if (me.rows.length > 0) {
      mySkills = me.rows[0].skills || [];
      myIndustry = me.rows[0].industry || '';
    }
  }

  // Score = distance(0-8) + same_industry(5) + shared_skills(2 each, max 10) + trust(0-5)
  const result = await pgPool.query(`
    SELECT p.*,
      u.username, u.display_name, u.avatar_url, u.trust_score AS user_trust_score, u.trust_level AS user_trust_level,
      (6371 * acos(LEAST(1.0, cos(radians($1)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians($2)) + sin(radians($1)) * sin(radians(p.lat))))) AS distance_km,
      (
        CASE
          WHEN (6371 * acos(LEAST(1.0, cos(radians($1)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians($2)) + sin(radians($1)) * sin(radians(p.lat))))) < 1 THEN 8
          WHEN (6371 * acos(LEAST(1.0, cos(radians($1)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians($2)) + sin(radians($1)) * sin(radians(p.lat))))) < 5 THEN 5
          WHEN (6371 * acos(LEAST(1.0, cos(radians($1)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians($2)) + sin(radians($1)) * sin(radians(p.lat))))) < 15 THEN 2
          ELSE 0
        END
        + CASE WHEN p.industry = $3 AND $3 != '' THEN 5 ELSE 0 END
        + LEAST(COALESCE(array_length(ARRAY(SELECT unnest(p.skills) INTERSECT SELECT unnest($4::text[])), 1), 0) * 2, 10)
        + CASE WHEN p.trust_score_snapshot >= 60 THEN 5 WHEN p.trust_score_snapshot >= 30 THEN 2 ELSE 0 END
      ) AS match_score
    FROM profiles p
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.status = 'active'
      AND p.user_id != COALESCE($5, '')
      AND (6371 * acos(LEAST(1.0, cos(radians($1)) * cos(radians(p.lat)) * cos(radians(p.lng) - radians($2)) + sin(radians($1)) * sin(radians(p.lat))))) < $6
    ORDER BY match_score DESC, distance_km ASC
    LIMIT 20
  `, [lat, lng, myIndustry, mySkills, userId || '', radiusKm]);

  // Format profiles
  const data = result.rows.map((r: Record<string, unknown>) => ({
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
  if (!userId) {
    // Not logged in — return popular upcoming events
    const result = await pgPool.query(`
      SELECT * FROM events
      WHERE status IN ('scheduled', 'live') AND start_time > NOW()
      ORDER BY joined_count DESC LIMIT 10
    `);
    return NextResponse.json({ data: result.rows });
  }

  // Get user's circles
  const circlesRes = await pgPool.query("SELECT circle_id FROM circle_members WHERE user_id = $1 AND status = 'active'", [userId]);
  const circleIds = circlesRes.rows.map(r => r.circle_id);

  // Get user's profile for industry/category matching
  const profileRes = await pgPool.query('SELECT industry, city FROM profiles WHERE user_id = $1', [userId]);
  const myIndustry = profileRes.rows[0]?.industry || '';
  const myCity = profileRes.rows[0]?.city || '';

  // Score = in_my_circle(10) + same_category_as_industry(5) + same_city(3) + popularity(0-5) + verified(3)
  const result = await pgPool.query(`
    SELECT *,
      (
        CASE WHEN circle_id = ANY($1::text[]) THEN 10 ELSE 0 END
        + CASE WHEN LOWER(category) = LOWER($2) THEN 5 ELSE 0 END
        + CASE WHEN LOWER(city) LIKE LOWER($3) THEN 3 ELSE 0 END
        + CASE WHEN joined_count > 50 THEN 5 WHEN joined_count > 20 THEN 3 WHEN joined_count > 5 THEN 1 ELSE 0 END
        + CASE WHEN verified THEN 3 ELSE 0 END
      ) AS match_score
    FROM events
    WHERE status IN ('scheduled', 'live') AND start_time > NOW()
    ORDER BY match_score DESC, start_time ASC
    LIMIT 10
  `, [circleIds.length > 0 ? circleIds : [''], myIndustry, `%${myCity.split(',')[0]}%`]);

  return NextResponse.json({ data: result.rows, meta: { type: 'events_for_you', results: result.rows.length } });
}
