import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';

// ─── GET /api/v1/circles/:id/members ─────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const status = req.nextUrl.searchParams.get('status') || 'active';
    const db = getDB();
    const result = await db.prepare(
      `SELECT cm.*, u.username, u.display_name, u.avatar_url, u.bio, u.trust_level, u.trust_score
       FROM circle_members cm
       LEFT JOIN users u ON u.id = cm.user_id
       WHERE cm.circle_id = ? AND cm.status = ?
       ORDER BY cm.role = 'owner' DESC, cm.role = 'admin' DESC, cm.joined_at ASC
       LIMIT 100`
    ).bind(id, status).all<Record<string, unknown>>();
    return NextResponse.json({ data: result.results });
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
    const db = getDB();

    // Check caller is owner/admin
    const caller = await db.prepare(
      "SELECT role FROM circle_members WHERE circle_id = ? AND user_id = ? AND status = 'active'"
    ).bind(id, userId).first<{ role: string }>();
    if (!caller || !['owner', 'admin'].includes(caller.role)) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'Only owner/admin can manage members' } }, { status: 403 });
    }

    const body = await req.json();
    const { member_user_id, action } = body as { member_user_id: string; action: 'approve' | 'reject' };

    if (!member_user_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: { code: 'invalid_request', message: 'member_user_id and action (approve/reject) required' } }, { status: 400 });
    }

    if (action === 'approve') {
      const result = await db.prepare(
        "UPDATE circle_members SET status = 'active', joined_at = datetime('now') WHERE circle_id = ? AND user_id = ? AND status = 'pending'"
      ).bind(id, member_user_id).run();
      if ((result.meta?.changes ?? 0) > 0) {
        await db.prepare('UPDATE circles SET member_count = member_count + 1 WHERE id = ?').bind(id).run();
        await db.prepare('UPDATE users SET circles_count = circles_count + 1 WHERE id = ?').bind(member_user_id).run().catch(() => {});
        const circleRow = await db.prepare('SELECT name FROM circles WHERE id = ?').bind(id).first<{ name: string }>();
        notify(member_user_id, 'circle_activity', `Welcome to ${circleRow?.name}!`, 'Your join request was approved.', 'circle', id);
      }
      return NextResponse.json({ data: { action: 'approved', member_user_id } });
    } else {
      await db.prepare(
        "UPDATE circle_members SET status = 'left' WHERE circle_id = ? AND user_id = ? AND status = 'pending'"
      ).bind(id, member_user_id).run();
      return NextResponse.json({ data: { action: 'rejected', member_user_id } });
    }
  } catch (err) {
    console.error('[Circle Members PATCH]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to update member' } }, { status: 500 });
  }
}
