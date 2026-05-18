import { NextRequest, NextResponse } from 'next/server';
import { getDB, parseRow } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// GET /api/v1/stories/business/[id] — active stories at this venue, ordered
// newest first. Visibility filter same as the rail feed.
//
// Returned shape gives the BusinessDetailPage banner everything it needs to
// render thumbnails + the "X stories" count without extra round-trips.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  const viewerId = await resolveUserId(req).catch(() => null);
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '30', 10), 100);

  const db = getDB();

  try {
    const visibilityClause = viewerId
      ? `(s.author_id = ?2
          OR s.visibility = 'public'
          OR (s.visibility = 'friends' AND s.author_id IN (
            SELECT following_user_id FROM follows
            WHERE follower_id = ?2 AND following_user_id IS NOT NULL
          ))
          OR (s.visibility = 'circles' AND EXISTS (
            SELECT 1 FROM circle_members cm
            WHERE cm.user_id = ?2
              AND instr(s.circle_ids, '"' || cm.circle_id || '"') > 0
          )))`
      : `s.visibility = 'public'`;

    const binds: unknown[] = [id];
    if (viewerId) binds.push(viewerId);
    binds.push(limit);

    // `viewed_by_me` LEFT JOIN only meaningful when authed; unauthed gets 0.
    const viewedExpr = viewerId
      ? `CASE WHEN sv.viewer_id IS NULL THEN 0 ELSE 1 END AS viewed_by_me`
      : `0 AS viewed_by_me`;
    const viewedJoin = viewerId
      ? `LEFT JOIN story_views sv ON sv.story_id = s.id AND sv.viewer_id = ?2`
      : '';

    const rows = await db
      .prepare(
        `SELECT s.id, s.author_id, s.media_url, s.thumbnail_url, s.caption,
                s.posted_at, s.expires_at, s.view_count,
                u.display_name AS author_name, u.username AS author_username,
                u.avatar_url AS author_avatar,
                ${viewedExpr}
         FROM stories s
         LEFT JOIN users u ON u.id = s.author_id
         ${viewedJoin}
         WHERE s.business_id = ?1
           AND s.deleted_at IS NULL
           AND datetime(s.expires_at) > datetime('now')
           AND ${visibilityClause}
         ORDER BY s.posted_at DESC
         LIMIT ?${viewerId ? '3' : '2'}`,
      )
      .bind(...binds)
      .all<Record<string, unknown>>();

    const items = (rows.results || []).map(r => parseRow(r));
    return NextResponse.json(
      { data: { items, count: items.length } },
      {
        headers: {
          'Cache-Control': viewerId ? 'private, max-age=10' : 'public, s-maxage=10, stale-while-revalidate=30',
        },
      },
    );
  } catch (err) {
    console.error('[Stories business GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch stories' } },
      { status: 500 },
    );
  }
}
