import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB, genId, parseRow } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { extractTagsFromText, upsertAndLinkTags } from '@/lib/tags';
import {
  STORY_MAX_VENUE_DISTANCE_METERS,
  STORY_MAX_GPS_ACCURACY_METERS,
  STORY_PUBLIC_TRUST_THRESHOLD,
  STORY_RATE_PER_USER_PER_HOURS,
  computeExpiry,
  distanceMeters,
} from '@/lib/stories';

// ─── POST /api/v1/stories — Create a new Now story ───────────────────────

// MVP1 is photo-only. The schema accepts `video` so adding it later is a
// validator change, not a migration.
const createSchema = z.object({
  business_id: z.string().optional(),
  event_id: z.string().optional(),
  location_lat: z.number().min(-90).max(90),
  location_lng: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
  media_url: z.string().url(),
  media_type: z.enum(['photo']).default('photo'),
  thumbnail_url: z.string().url().optional(),
  caption: z.string().max(280).default(''),
  visibility: z.enum(['public', 'friends', 'circles']).default('friends'),
  circle_ids: z.array(z.string()).max(10).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Login required' } },
        { status: 401 },
      );
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: parsed.error.issues[0].message } },
        { status: 400 },
      );
    }
    const d = parsed.data;

    const db = getDB();

    // Rate limit: STORY_RATE_PER_USER_PER_HOURS per author
    const recent = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM stories
         WHERE author_id = ? AND deleted_at IS NULL
           AND datetime(posted_at) > datetime('now', '-' || ? || ' hours')`,
      )
      .bind(userId, STORY_RATE_PER_USER_PER_HOURS.hours)
      .first<{ n: number }>();
    if (recent && recent.n >= STORY_RATE_PER_USER_PER_HOURS.count) {
      return NextResponse.json(
        {
          error: {
            code: 'rate_limited',
            message: `Too many stories in the last ${STORY_RATE_PER_USER_PER_HOURS.hours}h. Try again later.`,
          },
        },
        { status: 429 },
      );
    }

    // GPS accuracy gate (only if user provided a reading)
    if (typeof d.accuracy === 'number' && d.accuracy > STORY_MAX_GPS_ACCURACY_METERS) {
      return NextResponse.json(
        {
          error: {
            code: 'low_accuracy',
            message: "Can't verify your location — turn on precise GPS and try again.",
          },
        },
        { status: 400 },
      );
    }

    // Resolve venue + denormalize place_name. If business_id is set, require
    // the user to physically be at the venue (≤120m + accuracy bonus).
    let placeName: string | null = null;
    if (d.business_id) {
      const biz = await db
        .prepare('SELECT name, location_lat AS lat, location_lng AS lng FROM businesses WHERE id = ?')
        .bind(d.business_id)
        .first<{ name: string; lat: number | null; lng: number | null }>();
      if (!biz) {
        return NextResponse.json(
          { error: { code: 'not_found', message: 'Business not found' } },
          { status: 404 },
        );
      }
      if (biz.lat == null || biz.lng == null) {
        return NextResponse.json(
          { error: { code: 'venue_no_location', message: 'Venue has no location' } },
          { status: 400 },
        );
      }
      const dist = distanceMeters(d.location_lat, d.location_lng, biz.lat, biz.lng);
      const tolerance = STORY_MAX_VENUE_DISTANCE_METERS + (d.accuracy ?? 0);
      if (dist > tolerance) {
        return NextResponse.json(
          {
            error: {
              code: 'too_far',
              message: `You're not at this venue — about ${Math.round(dist)}m away. Move closer to post.`,
            },
          },
          { status: 400 },
        );
      }
      placeName = biz.name;
    } else if (d.event_id) {
      const ev = await db
        .prepare('SELECT title FROM events WHERE id = ?')
        .bind(d.event_id)
        .first<{ title: string }>();
      placeName = ev?.title ?? null;
    }

    // Trust gate for public visibility — prevents spam on rail.
    let effectiveVisibility = d.visibility;
    if (effectiveVisibility === 'public') {
      const u = await db
        .prepare('SELECT trust_score FROM users WHERE id = ?')
        .bind(userId)
        .first<{ trust_score: number }>();
      if (!u || (u.trust_score ?? 0) < STORY_PUBLIC_TRUST_THRESHOLD) {
        // Soft demote to friends rather than reject — better UX.
        effectiveVisibility = 'friends';
      }
    }

    const id = genId('sty_');
    const postedAt = new Date().toISOString();
    const expiresAt = computeExpiry(postedAt);

    await db
      .prepare(
        `INSERT INTO stories
           (id, author_id, business_id, event_id, location_lat, location_lng,
            place_name, media_url, media_type, thumbnail_url, caption,
            visibility, circle_ids, posted_at, expires_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        id,
        userId,
        d.business_id || null,
        d.event_id || null,
        d.location_lat,
        d.location_lng,
        placeName,
        d.media_url,
        d.media_type,
        d.thumbnail_url || null,
        d.caption,
        effectiveVisibility,
        JSON.stringify(d.circle_ids),
        postedAt,
        expiresAt,
      )
      .run();

    // Parse #hashtags in caption — links via the existing tags pipeline so
    // story content shows up on /t/<slug> pages.
    if (d.caption) {
      const raw = extractTagsFromText(d.caption);
      if (raw.length > 0) {
        try {
          // Re-use the 'checkin' entity_type — semantically closest existing
          // bucket. Migrate to a dedicated 'story' enum value when we extend
          // CHECK constraint in a future migration.
          await upsertAndLinkTags(db, raw, { type: 'checkin', id, authorId: userId });
        } catch (e) {
          console.error('[Stories POST] tag link failed', e);
        }
      }
    }

    const created = await db
      .prepare('SELECT * FROM stories WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();

    return NextResponse.json({ data: parseRow(created) }, { status: 201 });
  } catch (err) {
    console.error('[Stories POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create story' } },
      { status: 500 },
    );
  }
}

// ─── GET /api/v1/stories?scope=rail|map&lat=&lng=&bbox= ──────────────────
//
// scope=rail  — active stories from friends + public, 1 per author, newest
// scope=map   — active stories with location (for map markers) within bbox
//
// Friends-only stories require the viewer to follow the author. Public
// stories show to everyone. Circles stories show if the viewer is a member
// of any listed circle.
export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get('scope') || 'rail';
  const viewerId = await resolveUserId(req).catch(() => null);

  const db = getDB();

  try {
    if (scope === 'rail') {
      if (!viewerId) {
        // Public-only fallback for unauthed clients. No viewed_by_me — they
        // can't view-track without an account anyway.
        const rows = await db
          .prepare(
            `SELECT s.*,
                    u.display_name AS author_name, u.username AS author_username,
                    u.avatar_url AS author_avatar,
                    b.name AS business_display_name, b.cover_image AS business_cover,
                    b.city AS business_city,
                    0 AS viewed_by_me
             FROM stories s
             LEFT JOIN users u ON u.id = s.author_id
             LEFT JOIN businesses b ON b.id = s.business_id
             WHERE s.deleted_at IS NULL
               AND datetime(s.expires_at) > datetime('now')
               AND s.visibility = 'public'
             ORDER BY s.author_id, s.posted_at ASC
             LIMIT 200`,
          )
          .all<Record<string, unknown>>();
        return NextResponse.json(
          { data: (rows.results || []).map(r => parseRow(r)) },
          { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } },
        );
      }

      // Authenticated rail. Each story gets a `viewed_by_me` flag so the
      // client can grey out fully-seen author rings. We return every active
      // story (no GROUP BY) and the client groups by author — that way the
      // viewer can swipe through ALL of an author's stories, not just one.
      const rows = await db
        .prepare(
          `SELECT s.*,
                  u.display_name AS author_name, u.username AS author_username,
                  u.avatar_url AS author_avatar,
                  b.name AS business_display_name, b.cover_image AS business_cover,
                  b.city AS business_city,
                  CASE WHEN sv.viewer_id IS NULL THEN 0 ELSE 1 END AS viewed_by_me
           FROM stories s
           LEFT JOIN users u ON u.id = s.author_id
           LEFT JOIN businesses b ON b.id = s.business_id
           LEFT JOIN story_views sv ON sv.story_id = s.id AND sv.viewer_id = ?1
           WHERE s.deleted_at IS NULL
             AND datetime(s.expires_at) > datetime('now')
             AND (
               s.author_id = ?1
               OR s.visibility = 'public'
               OR (s.visibility = 'friends' AND s.author_id IN (
                 SELECT following_user_id FROM follows
                 WHERE follower_id = ?1 AND following_user_id IS NOT NULL
               ))
               OR (s.visibility = 'circles' AND EXISTS (
                 SELECT 1 FROM circle_members cm
                 WHERE cm.user_id = ?1
                   AND instr(s.circle_ids, '"' || cm.circle_id || '"') > 0
               ))
             )
           ORDER BY s.author_id, s.posted_at ASC
           LIMIT 200`,
        )
        .bind(viewerId)
        .all<Record<string, unknown>>();

      return NextResponse.json(
        { data: (rows.results || []).map(r => parseRow(r)) },
        { headers: { 'Cache-Control': 'private, max-age=10' } },
      );
    }

    if (scope === 'map') {
      // bbox=minLng,minLat,maxLng,maxLat
      const bbox = req.nextUrl.searchParams.get('bbox')?.split(',').map(Number);
      if (!bbox || bbox.length !== 4 || bbox.some(n => Number.isNaN(n))) {
        return NextResponse.json(
          { error: { code: 'invalid_bbox', message: 'bbox=minLng,minLat,maxLng,maxLat required' } },
          { status: 400 },
        );
      }
      const [minLng, minLat, maxLng, maxLat] = bbox;
      const baseFilter = viewerId
        ? `(s.author_id = ?5
            OR s.visibility = 'public'
            OR (s.visibility = 'friends' AND s.author_id IN (
              SELECT following_user_id FROM follows
              WHERE follower_id = ?5 AND following_user_id IS NOT NULL
            )))`
        : `s.visibility = 'public'`;

      const binds: unknown[] = [minLng, minLat, maxLng, maxLat];
      if (viewerId) binds.push(viewerId);

      const rows = await db
        .prepare(
          `SELECT s.id, s.author_id, s.business_id, s.location_lat, s.location_lng,
                  s.place_name, s.media_url, s.thumbnail_url, s.posted_at, s.expires_at,
                  u.display_name AS author_name, u.avatar_url AS author_avatar
           FROM stories s
           LEFT JOIN users u ON u.id = s.author_id
           WHERE s.deleted_at IS NULL
             AND datetime(s.expires_at) > datetime('now')
             AND s.location_lng BETWEEN ?1 AND ?3
             AND s.location_lat BETWEEN ?2 AND ?4
             AND ${baseFilter}
           ORDER BY s.posted_at DESC
           LIMIT 200`,
        )
        .bind(...binds)
        .all<Record<string, unknown>>();

      return NextResponse.json({ data: rows.results || [] });
    }

    return NextResponse.json(
      { error: { code: 'invalid_scope', message: 'scope must be rail or map' } },
      { status: 400 },
    );
  } catch (err) {
    console.error('[Stories GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch stories' } },
      { status: 500 },
    );
  }
}
