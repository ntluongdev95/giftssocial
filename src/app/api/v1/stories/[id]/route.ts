import { NextRequest, NextResponse } from 'next/server';
import { getDB, parseRow } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { parseCircleIds } from '@/lib/stories';

// GET /api/v1/stories/[id] — detail for the viewer. Visibility check is
// strict: friends-only stories return 404 (not 403) so we don't leak the
// story's existence to unauthorised viewers.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  const viewerId = await resolveUserId(req).catch(() => null);
  const db = getDB();

  try {
    const story = await db
      .prepare(
        `SELECT s.*,
                u.display_name AS author_name, u.username AS author_username,
                u.avatar_url AS author_avatar, u.trust_score AS author_trust,
                b.name AS business_display_name, b.cover_image AS business_cover,
                b.city AS business_city
         FROM stories s
         LEFT JOIN users u ON u.id = s.author_id
         LEFT JOIN businesses b ON b.id = s.business_id
         WHERE s.id = ? AND s.deleted_at IS NULL`,
      )
      .bind(id)
      .first<Record<string, unknown>>();

    if (!story) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }

    const expiresAt = String(story.expires_at);
    if (new Date(expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { error: { code: 'expired', message: 'Story has expired' } },
        { status: 410 },
      );
    }

    const visibility = story.visibility as 'public' | 'friends' | 'circles';
    const authorId = story.author_id as string;

    // Visibility check
    if (visibility !== 'public' && viewerId !== authorId) {
      if (!viewerId) {
        return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
      }
      if (visibility === 'friends') {
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
      } else if (visibility === 'circles') {
        const circleIds = parseCircleIds(story.circle_ids as string);
        if (circleIds.length === 0) {
          return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
        }
        const placeholders = circleIds.map(() => '?').join(',');
        const m = await db
          .prepare(
            `SELECT 1 AS ok FROM circle_members
             WHERE user_id = ? AND circle_id IN (${placeholders}) LIMIT 1`,
          )
          .bind(viewerId, ...circleIds)
          .first<{ ok: number }>();
        if (!m) {
          return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
        }
      }
    }

    return NextResponse.json({ data: parseRow(story) });
  } catch (err) {
    console.error('[Story GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch story' } },
      { status: 500 },
    );
  }
}

// DELETE /api/v1/stories/[id] — author-only soft delete.
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
  try {
    const story = await db
      .prepare('SELECT author_id FROM stories WHERE id = ? AND deleted_at IS NULL')
      .bind(id)
      .first<{ author_id: string }>();
    if (!story) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }
    if (story.author_id !== userId) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'Not your story' } },
        { status: 403 },
      );
    }
    await db
      .prepare("UPDATE stories SET deleted_at = datetime('now') WHERE id = ?")
      .bind(id)
      .run();
    return NextResponse.json({ data: { id, deleted: true } });
  } catch (err) {
    console.error('[Story DELETE]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to delete story' } },
      { status: 500 },
    );
  }
}
