import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

// GET /api/v1/tags/[slug]?cursor=&limit=
//   cursor — ISO timestamp of last item's created_at (for pagination)
//   limit  — 1..50, default 20
//
// Returns tag info + a chronological feed of content tagged with it. For
// now this is reviews only; the SELECT is structured so adding checkins/
// events later is a UNION ALL change without touching the response shape.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  const cursor = req.nextUrl.searchParams.get('cursor');
  const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('limit') || '20', 10), 1), 50);

  const db = getDB();

  try {
    const tag = await db
      .prepare('SELECT id, slug, display_name, description, use_count FROM tags WHERE slug = ?')
      .bind(slug)
      .first<{
        id: string;
        slug: string;
        display_name: string;
        description: string;
        use_count: number;
      }>();

    if (!tag) {
      return NextResponse.json(
        {
          data: {
            tag: { slug, display_name: slug.replace(/-/g, ' '), use_count: 0, description: '' },
            items: [],
            next_cursor: null,
          },
        },
        { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } },
      );
    }

    // Reviews tagged with this slug. Filter by tag_links → join reviews →
    // join users for author info, businesses for venue card.
    const cursorClause = cursor ? 'AND datetime(l.created_at) < datetime(?)' : '';
    const bindArgs: unknown[] = [tag.id];
    if (cursor) bindArgs.push(cursor);
    bindArgs.push(limit + 1);

    const itemsRes = await db
      .prepare(
        `SELECT r.id, r.author_id, r.business_id, r.event_id, r.rating, r.title, r.body,
                r.verified_visit, r.helpful_count, r.created_at AS review_created_at,
                l.created_at AS tagged_at,
                u.username AS author_username, u.display_name AS author_name, u.avatar_url AS author_avatar,
                b.name AS business_name, b.city AS business_city, b.cover_image AS business_cover
         FROM tag_links l
         JOIN reviews r ON r.id = l.entity_id AND l.entity_type = 'review'
         LEFT JOIN users u ON u.id = r.author_id
         LEFT JOIN businesses b ON b.id = r.business_id
         WHERE l.tag_id = ?
           AND r.status = 'active'
           ${cursorClause}
         ORDER BY l.created_at DESC
         LIMIT ?`,
      )
      .bind(...bindArgs)
      .all<Record<string, unknown>>();

    const rows = itemsRes.results || [];
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(r => ({
      type: 'review' as const,
      id: r.id,
      author: {
        id: r.author_id,
        name: r.author_name || r.author_username,
        username: r.author_username,
        avatar: r.author_avatar,
      },
      business: r.business_id
        ? {
            id: r.business_id,
            name: r.business_name,
            city: r.business_city,
            cover: r.business_cover,
          }
        : null,
      event_id: r.event_id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      verified_visit: !!r.verified_visit,
      helpful_count: r.helpful_count,
      created_at: r.review_created_at,
      tagged_at: r.tagged_at,
    }));

    const nextCursor = hasMore ? (rows[limit - 1].tagged_at as string) : null;

    return NextResponse.json(
      {
        data: {
          tag: {
            slug: tag.slug,
            display_name: tag.display_name,
            description: tag.description,
            use_count: tag.use_count,
          },
          items,
          next_cursor: nextCursor,
        },
      },
      { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } },
    );
  } catch (err) {
    console.error('[Tag detail GET]', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: msg } },
      { status: 500 },
    );
  }
}
