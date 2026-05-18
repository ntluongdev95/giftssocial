import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// POST /api/v1/stories/[id]/view — record a single view per (story, viewer).
// Idempotent via the PRIMARY KEY on story_views. Increments view_count only
// when the row is actually inserted.
export async function POST(
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
    // Don't credit views to the author themselves.
    const story = await db
      .prepare(
        `SELECT author_id, expires_at FROM stories
         WHERE id = ? AND deleted_at IS NULL`,
      )
      .bind(id)
      .first<{ author_id: string; expires_at: string }>();
    if (!story) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }
    if (story.author_id === userId) {
      return NextResponse.json({ data: { recorded: false, reason: 'own_story' } });
    }
    if (new Date(story.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ data: { recorded: false, reason: 'expired' } });
    }

    const insertRes = await db
      .prepare(
        `INSERT OR IGNORE INTO story_views (story_id, viewer_id) VALUES (?, ?)`,
      )
      .bind(id, userId)
      .run();

    const changes = (insertRes.meta as { changes?: number } | undefined)?.changes ?? 0;
    if (changes > 0) {
      await db
        .prepare('UPDATE stories SET view_count = view_count + 1 WHERE id = ?')
        .bind(id)
        .run();
    }

    return NextResponse.json({ data: { recorded: changes > 0 } });
  } catch (err) {
    console.error('[Story view POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to record view' } },
      { status: 500 },
    );
  }
}
