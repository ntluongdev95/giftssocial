import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/notifications — List my notifications ───────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ data: [] });

    const db = getDB();
    const result = await db.prepare(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    ).bind(userId).all<Record<string, unknown>>();

    return NextResponse.json({ data: result.results });
  } catch (err) {
    console.error('[Notifications GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}

// ─── PATCH /api/v1/notifications — Mark all as read ──────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const db = getDB();

    if (body.id) {
      // Mark single
      await db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').bind(body.id, userId).run();
    } else {
      // Mark all
      await db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0').bind(userId).run();
    }

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error('[Notifications PATCH]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to update' } }, { status: 500 });
  }
}

// ─── DELETE /api/v1/notifications — Clear all notifications ─────────────

export async function DELETE(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

    const db = getDB();
    await db.prepare('DELETE FROM notifications WHERE user_id = ?').bind(userId).run();

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error('[Notifications DELETE]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to clear' } }, { status: 500 });
  }
}
