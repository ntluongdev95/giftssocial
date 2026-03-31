import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/circles/me — My circles ─────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ data: [] });

    const result = await pgPool.query(
      `SELECT c.*, cm.role AS my_role
       FROM circle_members cm
       JOIN circles c ON c.id = cm.circle_id
       WHERE cm.user_id = $1 AND cm.status = 'active'
       ORDER BY cm.joined_at DESC`,
      [userId]
    );

    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error('[Circles Me GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}
