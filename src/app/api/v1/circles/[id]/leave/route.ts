import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── POST /api/v1/circles/:id/leave ──────────────────────────────────────

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const { id } = await params;

    const result = await pgPool.query(
      "UPDATE circle_members SET status = 'left' WHERE circle_id = $1 AND user_id = $2 AND status = 'active' RETURNING id",
      [id, userId]
    );

    if (result.rows.length > 0) {
      await pgPool.query('UPDATE circles SET member_count = GREATEST(member_count - 1, 0) WHERE id = $1', [id]);
      await pgPool.query('UPDATE users SET circles_count = GREATEST(circles_count - 1, 0) WHERE id = $1', [userId]).catch(() => {});
    }

    return NextResponse.json({ data: { circle_id: id, left: true } });
  } catch (err) {
    console.error('[Circle Leave]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to leave' } }, { status: 500 });
  }
}
