import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';

// ─── GET /api/v1/circles/:id/members ─────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const status = req.nextUrl.searchParams.get('status') || 'active';
    const result = await pgPool.query(
      `SELECT cm.*, u.username, u.display_name, u.avatar_url, u.bio, u.trust_level, u.trust_score
       FROM circle_members cm
       LEFT JOIN users u ON u.id = cm.user_id
       WHERE cm.circle_id = $1 AND cm.status = $2
       ORDER BY cm.role = 'owner' DESC, cm.role = 'admin' DESC, cm.joined_at ASC
       LIMIT 100`,
      [id, status]
    );
    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error('[Circle Members GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}

// ─── PATCH /api/v1/circles/:id/members — Approve or reject pending member ──

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const { id } = await params;

    // Check caller is owner/admin
    const caller = await pgPool.query(
      "SELECT role FROM circle_members WHERE circle_id = $1 AND user_id = $2 AND status = 'active'",
      [id, userId]
    );
    if (!caller.rows.length || !['owner', 'admin'].includes(caller.rows[0].role)) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'Only owner/admin can manage members' } }, { status: 403 });
    }

    const body = await req.json();
    const { member_user_id, action } = body as { member_user_id: string; action: 'approve' | 'reject' };

    if (!member_user_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: { code: 'invalid_request', message: 'member_user_id and action (approve/reject) required' } }, { status: 400 });
    }

    if (action === 'approve') {
      const result = await pgPool.query(
        "UPDATE circle_members SET status = 'active', joined_at = NOW() WHERE circle_id = $1 AND user_id = $2 AND status = 'pending' RETURNING id",
        [id, member_user_id]
      );
      if (result.rows.length > 0) {
        await pgPool.query('UPDATE circles SET member_count = member_count + 1 WHERE id = $1', [id]);
        await pgPool.query('UPDATE users SET circles_count = circles_count + 1 WHERE id = $1', [member_user_id]).catch(() => {});
        const circle = await pgPool.query('SELECT name FROM circles WHERE id = $1', [id]);
        notify(member_user_id, 'circle_activity', `Welcome to ${circle.rows[0]?.name}!`, 'Your join request was approved.', 'circle', id);
      }
      return NextResponse.json({ data: { action: 'approved', member_user_id } });
    } else {
      await pgPool.query(
        "UPDATE circle_members SET status = 'left' WHERE circle_id = $1 AND user_id = $2 AND status = 'pending'",
        [id, member_user_id]
      );
      return NextResponse.json({ data: { action: 'rejected', member_user_id } });
    }
  } catch (err) {
    console.error('[Circle Members PATCH]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to update member' } }, { status: 500 });
  }
}
