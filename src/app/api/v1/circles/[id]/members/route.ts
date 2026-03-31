import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';

// ─── GET /api/v1/circles/:id/members ─────────────────────────────────────

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await pgPool.query(
      `SELECT cm.*, u.username, u.display_name, u.avatar_url, u.trust_level, u.trust_score
       FROM circle_members cm
       LEFT JOIN users u ON u.id = cm.user_id
       WHERE cm.circle_id = $1 AND cm.status = 'active'
       ORDER BY cm.role = 'owner' DESC, cm.role = 'admin' DESC, cm.joined_at ASC
       LIMIT 100`,
      [id]
    );
    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error('[Circle Members GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}
