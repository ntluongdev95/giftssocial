import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// GET /api/v1/stories/[id]/viewers — author-only list of who viewed the
// story, most recent first. Visibility leak prevention: only the story's
// author may see this list; others get 404 (not 403) to avoid revealing
// the story's existence.
export async function GET(
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
  try {
    const story = await db
      .prepare('SELECT author_id FROM stories WHERE id = ? AND deleted_at IS NULL')
      .bind(id)
      .first<{ author_id: string }>();
    if (!story || story.author_id !== userId) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }

    const rows = await db
      .prepare(
        `SELECT sv.viewer_id, sv.viewed_at,
                u.display_name, u.username, u.avatar_url
         FROM story_views sv
         LEFT JOIN users u ON u.id = sv.viewer_id
         WHERE sv.story_id = ?
         ORDER BY sv.viewed_at DESC
         LIMIT 200`,
      )
      .bind(id)
      .all<{
        viewer_id: string;
        viewed_at: string;
        display_name: string | null;
        username: string | null;
        avatar_url: string | null;
      }>();

    const items = (rows.results || []).map(r => ({
      id: r.viewer_id,
      name: r.display_name || r.username || 'User',
      username: r.username,
      avatar: r.avatar_url,
      viewed_at: r.viewed_at,
    }));

    return NextResponse.json({ data: { items, count: items.length } });
  } catch (err) {
    console.error('[Story viewers GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch viewers' } },
      { status: 500 },
    );
  }
}
