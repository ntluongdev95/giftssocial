import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── POST /api/v1/circles/:id/leave ──────────────────────────────────────

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const { id } = await params;
    const db = getDB();

    // Get current status before updating
    const current = await db.prepare(
      "SELECT status FROM circle_members WHERE circle_id = ? AND user_id = ? AND status IN ('active', 'pending')"
    ).bind(id, userId).first<{ status: string }>();

    const result = await db.prepare(
      "UPDATE circle_members SET status = 'left' WHERE circle_id = ? AND user_id = ? AND status IN ('active', 'pending')"
    ).bind(id, userId).run();

    if ((result.meta?.changes ?? 0) > 0 && current?.status === 'active') {
      // Only decrement counts if was an active member (not pending)
      await db.prepare('UPDATE circles SET member_count = MAX(member_count - 1, 0) WHERE id = ?').bind(id).run();
      await db.prepare('UPDATE users SET circles_count = MAX(circles_count - 1, 0) WHERE id = ?').bind(userId).run().catch(() => {});
    }

    return NextResponse.json({ data: { circle_id: id, left: true } });
  } catch (err) {
    console.error('[Circle Leave]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to leave' } }, { status: 500 });
  }
}
