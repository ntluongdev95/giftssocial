import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';

// ─── POST /api/v1/circles/:id/join ───────────────────────────────────────

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const { id } = await params;
    const db = getDB();

    // Check circle exists
    const circle = await db.prepare('SELECT * FROM circles WHERE id = ?').bind(id).first<Record<string, unknown>>();
    if (!circle) return NextResponse.json({ error: { code: 'not_found', message: 'Circle not found' } }, { status: 404 });

    // Check if already member
    const existing = await db.prepare(
      "SELECT id FROM circle_members WHERE circle_id = ? AND user_id = ? AND status = 'active'"
    ).bind(id, userId).first<{ id: string }>();
    if (existing) return NextResponse.json({ error: { code: 'already_member', message: 'Already a member' } }, { status: 400 });

    const joinMode = circle.join_mode as string;
    const status = joinMode === 'open' ? 'active' : 'pending';

    // Check if pending record exists to update, else insert
    const pendingRow = await db.prepare(
      "SELECT id FROM circle_members WHERE circle_id = ? AND user_id = ?"
    ).bind(id, userId).first<{ id: string }>();

    if (pendingRow) {
      await db.prepare(
        "UPDATE circle_members SET status = ?, joined_at = datetime('now') WHERE circle_id = ? AND user_id = ?"
      ).bind(status, id, userId).run();
    } else {
      await db.prepare(
        `INSERT INTO circle_members (circle_id, user_id, role, status) VALUES (?, ?, 'member', ?)`
      ).bind(id, userId, status).run();
    }

    if (status === 'pending') {
      // Notify circle owner about the join request
      const ownerId = circle.owner_id as string;
      const userRow = await db.prepare('SELECT display_name FROM users WHERE id = ?').bind(userId).first<{ display_name: string }>();
      const displayName = userRow?.display_name || 'Someone';
      const circleName = circle.name as string;
      notify(ownerId, 'circle_join_request', `${displayName} wants to join ${circleName}`, `Approve or decline in your circle settings.`, 'circle', id);
    }

    if (status === 'active') {
      await db.prepare('UPDATE circles SET member_count = member_count + 1 WHERE id = ?').bind(id).run();
      await db.prepare('UPDATE users SET circles_count = circles_count + 1 WHERE id = ?').bind(userId).run().catch(() => {});

      // Auto proof
      await db.prepare(
        `INSERT INTO proofs (user_id, proof_type, target_type, target_id, evidence_type, trust_points, verified)
         VALUES (?, 'circle_contributed', 'circle', ?, 'system', 2, 1)`
      ).bind(userId, id).run().catch(() => {});
    }

    return NextResponse.json({ data: { circle_id: id, status, joined: status === 'active' } }, { status: 201 });
  } catch (err) {
    console.error('[Circle Join]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to join' } }, { status: 500 });
  }
}
