import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/notifications — List my notifications ───────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ data: [] });

    const result = await pgPool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );

    return NextResponse.json({ data: result.rows });
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

    if (body.id) {
      // Mark single
      await pgPool.query('UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2', [body.id, userId]);
    } else {
      // Mark all
      await pgPool.query('UPDATE notifications SET read = true WHERE user_id = $1 AND read = false', [userId]);
    }

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error('[Notifications PATCH]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to update' } }, { status: 500 });
  }
}
