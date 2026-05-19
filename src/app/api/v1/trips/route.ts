import { NextRequest, NextResponse } from 'next/server';
import { getDB, genId, parseRow } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { tripCreateSchema, rollupTotals, normalizeForSearch } from '@/lib/trips';
import { extractTagsFromText, upsertAndLinkTags } from '@/lib/tags';

// ─── POST /api/v1/trips — Create a new trip ──────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Login required' } },
        { status: 401 },
      );
    }
    const body = await req.json().catch(() => ({}));
    const parsed = tripCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_error', issues: parsed.error.flatten() } },
        { status: 400 },
      );
    }
    const d = parsed.data;
    const totals = rollupTotals(d.stops);

    const db = getDB();
    const tripId = genId('trip_');

    await db
      .prepare(
        `INSERT INTO trips
          (id, author_id, title, cover_image, description, city,
           total_cost, total_currency, total_minutes, stop_count,
           visibility, status,
           title_normalized, city_normalized)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,'active',?,?)`,
      )
      .bind(
        tripId, userId, d.title, d.cover_image ?? null, d.description, d.city ?? null,
        totals.total_cost, totals.total_currency, totals.total_minutes, d.stops.length,
        d.visibility,
        normalizeForSearch(d.title), normalizeForSearch(d.city ?? ''),
      )
      .run();

    // Insert stops in order. Using a single batched INSERT … VALUES would
    // be marginally faster but D1 lacks variadic bind helpers — sequential
    // is fine for the 20-stop max.
    for (let i = 0; i < d.stops.length; i++) {
      const s = d.stops[i];
      await db
        .prepare(
          `INSERT INTO trip_stops
            (id, trip_id, position, place_name, activity, cost, cost_currency,
             duration_minutes, notes, photos, place_lat, place_lng)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          genId('tstop_'), tripId, i,
          s.place_name, s.activity, s.cost, s.cost_currency,
          s.duration_minutes, s.notes, JSON.stringify(s.photos),
          s.place_lat ?? null, s.place_lng ?? null,
        )
        .run();
    }

    // Parse #hashtags from title + description + per-stop notes so trips
    // surface on /t/<slug> pages. Reuse 'checkin' entity_type until we
    // extend the CHECK constraint to include 'trip'.
    const tagText = [d.title, d.description, ...d.stops.map(s => `${s.activity} ${s.notes}`)].join(' ');
    const rawTags = extractTagsFromText(tagText);
    if (rawTags.length > 0) {
      try {
        await upsertAndLinkTags(db, rawTags, { type: 'checkin', id: tripId, authorId: userId });
      } catch (e) {
        console.error('[Trips POST] tag link failed', e);
      }
    }

    const created = await db
      .prepare('SELECT * FROM trips WHERE id = ?')
      .bind(tripId)
      .first<Record<string, unknown>>();
    return NextResponse.json({ data: parseRow(created) }, { status: 201 });
  } catch (err) {
    console.error('[Trips POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create trip' } },
      { status: 500 },
    );
  }
}

// ─── GET /api/v1/trips ────────────────────────────────────────────────────
// Public discover by default. `scope=mine` returns the caller's trips
// (including non-public ones). `author_id=…` filters to one user's public
// trips — used by the profile sheet's Trips section. `?q=` filters by
// title/description/city, `?city=`, `?sort=new|popular`, cursor pagination.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const scope = sp.get('scope');
  const authorId = sp.get('author_id');
  const q = sp.get('q')?.trim() ?? '';
  const city = sp.get('city');
  const sort = sp.get('sort') ?? 'new';
  const limit = Math.min(Math.max(parseInt(sp.get('limit') || '20', 10), 1), 50);

  const db = getDB();

  try {
    if (scope === 'mine') {
      const userId = await resolveUserId(req);
      if (!userId) {
        return NextResponse.json(
          { error: { code: 'unauthorized', message: 'Login required' } },
          { status: 401 },
        );
      }
      const rows = await db
        .prepare(
          `SELECT t.*, u.display_name AS author_name, u.username AS author_username,
                  u.avatar_url AS author_avatar
           FROM trips t
           LEFT JOIN users u ON u.id = t.author_id
           WHERE t.author_id = ? AND t.status = 'active'
           ORDER BY t.created_at DESC
           LIMIT ?`,
        )
        .bind(userId, limit)
        .all<Record<string, unknown>>();
      return NextResponse.json({ data: rows.results });
    }

    // Public discover (default) or single-author public listing.
    const where: string[] = ["t.status = 'active'", "t.visibility = 'public'"];
    const binds: unknown[] = [];
    if (authorId) {
      where.push('t.author_id = ?');
      binds.push(authorId);
    }
    if (q) {
      const pat = `%${q.replace(/[%_]/g, '\\$&').toLowerCase()}%`;
      where.push('(LOWER(t.title) LIKE ? OR LOWER(t.description) LIKE ? OR LOWER(t.city) LIKE ?)');
      binds.push(pat, pat, pat);
    }
    if (city) {
      where.push('LOWER(t.city) = LOWER(?)');
      binds.push(city);
    }
    const orderBy =
      sort === 'popular'
        ? 't.save_count DESC, t.view_count DESC, t.created_at DESC'
        : 't.created_at DESC';
    binds.push(limit);

    const rows = await db
      .prepare(
        `SELECT t.*, u.display_name AS author_name, u.username AS author_username,
                u.avatar_url AS author_avatar
         FROM trips t
         LEFT JOIN users u ON u.id = t.author_id
         WHERE ${where.join(' AND ')}
         ORDER BY ${orderBy}
         LIMIT ?`,
      )
      .bind(...binds)
      .all<Record<string, unknown>>();

    return NextResponse.json(
      { data: rows.results },
      { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' } },
    );
  } catch (err) {
    console.error('[Trips GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch trips' } },
      { status: 500 },
    );
  }
}
