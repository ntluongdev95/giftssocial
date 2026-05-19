import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB, parseRow } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { stopSchema, rollupTotals, normalizeForSearch } from '@/lib/trips';

// Fields a trip owner is allowed to update. Stops are replaced wholesale
// when sent — partial stop edits go through the same array.
const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  cover_image: z.string().nullable().optional(),
  description: z.string().max(2000).optional(),
  city: z.string().max(100).nullable().optional(),
  visibility: z.enum(['public', 'friends', 'private']).optional(),
  stops: z.array(stopSchema).min(1).max(20).optional(),
});

// ─── GET /api/v1/trips/[id] ───────────────────────────────────────────────
// Public + owner. Private/friends visibility logic mirrors stories. Each
// call increments view_count for non-author viewers (idempotency via SWR
// dedupe + the 10s public cache header keeps the rate sane).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const viewerId = await resolveUserId(req).catch(() => null);
  const db = getDB();

  try {
    const trip = await db
      .prepare(
        `SELECT t.*, u.display_name AS author_name, u.username AS author_username,
                u.avatar_url AS author_avatar
         FROM trips t
         LEFT JOIN users u ON u.id = t.author_id
         WHERE t.id = ? AND t.status = 'active'`,
      )
      .bind(id)
      .first<Record<string, unknown>>();
    if (!trip) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

    const visibility = trip.visibility as 'public' | 'friends' | 'private';
    const authorId = trip.author_id as string;
    if (visibility !== 'public' && viewerId !== authorId) {
      if (visibility === 'private' || !viewerId) {
        return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
      }
      const follows = await db
        .prepare(
          `SELECT 1 AS ok FROM follows
           WHERE follower_id = ? AND following_user_id = ? LIMIT 1`,
        )
        .bind(viewerId, authorId)
        .first<{ ok: number }>();
      if (!follows) {
        return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
      }
    }

    const stopsRes = await db
      .prepare('SELECT * FROM trip_stops WHERE trip_id = ? ORDER BY position ASC')
      .bind(id)
      .all<Record<string, unknown>>();
    const stops = (stopsRes.results || []).map(s => parseRow(s));

    // Increment view_count for non-author viewers.
    if (viewerId !== authorId) {
      try {
        await db
          .prepare('UPDATE trips SET view_count = view_count + 1 WHERE id = ?')
          .bind(id)
          .run();
      } catch {}
    }

    return NextResponse.json(
      { data: { ...parseRow(trip), stops } },
      { headers: { 'Cache-Control': visibility === 'public' ? 'public, s-maxage=10, stale-while-revalidate=30' : 'private, no-store' } },
    );
  } catch (err) {
    console.error('[Trip GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch trip' } },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/v1/trips/[id] — owner only ────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Login required' } },
      { status: 401 },
    );
  }
  const db = getDB();
  const owner = await db
    .prepare('SELECT author_id FROM trips WHERE id = ?')
    .bind(id)
    .first<{ author_id: string }>();
  if (!owner) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  if (owner.author_id !== userId) {
    return NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'validation_error', issues: parsed.error.flatten() } },
      { status: 400 },
    );
  }
  const d = parsed.data;

  try {
    const setParts: string[] = [];
    const values: unknown[] = [];
    if (d.title !== undefined) {
      setParts.push('title = ?', 'title_normalized = ?');
      values.push(d.title, normalizeForSearch(d.title));
    }
    if (d.cover_image !== undefined) { setParts.push('cover_image = ?'); values.push(d.cover_image); }
    if (d.description !== undefined) { setParts.push('description = ?'); values.push(d.description); }
    if (d.city !== undefined) {
      setParts.push('city = ?', 'city_normalized = ?');
      values.push(d.city, normalizeForSearch(d.city ?? ''));
    }
    if (d.visibility !== undefined) { setParts.push('visibility = ?'); values.push(d.visibility); }

    if (d.stops) {
      const totals = rollupTotals(d.stops);
      setParts.push('total_cost = ?', 'total_currency = ?', 'total_minutes = ?', 'stop_count = ?');
      values.push(totals.total_cost, totals.total_currency, totals.total_minutes, d.stops.length);
    }

    if (setParts.length > 0) {
      setParts.push("updated_at = datetime('now')");
      values.push(id);
      await db
        .prepare(`UPDATE trips SET ${setParts.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();
    }

    if (d.stops) {
      // Wipe + reinsert is simpler than diffing positions. Stops are
      // bounded at 20 each so the cost is negligible.
      await db.prepare('DELETE FROM trip_stops WHERE trip_id = ?').bind(id).run();
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
            `tstop_${Date.now()}_${i}`, id, i,
            s.place_name, s.activity, s.cost, s.cost_currency,
            s.duration_minutes, s.notes, JSON.stringify(s.photos),
            s.place_lat ?? null, s.place_lng ?? null,
          )
          .run();
      }
    }

    const updated = await db
      .prepare('SELECT * FROM trips WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();
    return NextResponse.json({ data: parseRow(updated) });
  } catch (err) {
    console.error('[Trip PATCH]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to update trip' } },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/v1/trips/[id] — soft archive ─────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Login required' } },
      { status: 401 },
    );
  }
  const db = getDB();
  const owner = await db
    .prepare('SELECT author_id FROM trips WHERE id = ?')
    .bind(id)
    .first<{ author_id: string }>();
  if (!owner) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  if (owner.author_id !== userId) {
    return NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 });
  }
  await db
    .prepare("UPDATE trips SET status = 'archived', updated_at = datetime('now') WHERE id = ?")
    .bind(id)
    .run();
  return NextResponse.json({ data: { id, archived: true } });
}
