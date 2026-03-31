import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── POST /api/v1/circles/:id/join ───────────────────────────────────────

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const { id } = await params;

    // Check circle exists
    const circle = await pgPool.query('SELECT * FROM circles WHERE id = $1', [id]);
    if (circle.rows.length === 0) return NextResponse.json({ error: { code: 'not_found', message: 'Circle not found' } }, { status: 404 });

    // Check if already member
    const existing = await pgPool.query("SELECT id FROM circle_members WHERE circle_id = $1 AND user_id = $2 AND status = 'active'", [id, userId]);
    if (existing.rows.length > 0) return NextResponse.json({ error: { code: 'already_member', message: 'Already a member' } }, { status: 400 });

    const joinMode = circle.rows[0].join_mode;
    const status = joinMode === 'open' ? 'active' : 'pending';

    await pgPool.query(
      `INSERT INTO circle_members (circle_id, user_id, role, status)
       VALUES ($1, $2, 'member', $3)
       ON CONFLICT (circle_id, user_id) DO UPDATE SET status = $3, joined_at = NOW()`,
      [id, userId, status]
    );

    if (status === 'active') {
      await pgPool.query('UPDATE circles SET member_count = member_count + 1 WHERE id = $1', [id]);
      await pgPool.query('UPDATE users SET circles_count = circles_count + 1 WHERE id = $1', [userId]).catch(() => {});

      // Auto proof
      await pgPool.query(
        `INSERT INTO proofs (user_id, proof_type, target_type, target_id, evidence_type, trust_points, verified)
         VALUES ($1, 'circle_contributed', 'circle', $2, 'system', 2, true)`,
        [userId, id]
      ).catch(() => {});
      await pgPool.query('SELECT recalculate_trust_score($1)', [userId]).catch(() => {});
    }

    return NextResponse.json({ data: { circle_id: id, status, joined: status === 'active' } }, { status: 201 });
  } catch (err) {
    console.error('[Circle Join]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to join' } }, { status: 500 });
  }
}
