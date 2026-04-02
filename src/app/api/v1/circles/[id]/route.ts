import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/circles/:id — Single circle detail ────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await resolveUserId(req).catch(() => null);

    const result = await pgPool.query('SELECT * FROM circles WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Circle not found' } }, { status: 404 });
    }

    const circle = result.rows[0];

    // Attach caller's membership info
    let my_role: string | null = null;
    let my_status: string | null = null;
    if (userId) {
      const mem = await pgPool.query(
        "SELECT role, status FROM circle_members WHERE circle_id = $1 AND user_id = $2 AND status IN ('active', 'pending')",
        [id, userId]
      );
      if (mem.rows.length > 0) {
        my_role = mem.rows[0].role;
        my_status = mem.rows[0].status;
      }
    }

    return NextResponse.json({ data: { ...circle, my_role, my_status } });
  } catch (err) {
    console.error('[Circle GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch circle' } }, { status: 500 });
  }
}

// ─── PATCH /api/v1/circles/:id — Update circle (owner only) ────────────

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const { id } = await params;

    // Check owner
    const mem = await pgPool.query(
      "SELECT role FROM circle_members WHERE circle_id = $1 AND user_id = $2 AND status = 'active'",
      [id, userId]
    );
    if (!mem.rows.length || !['owner', 'admin'].includes(mem.rows[0].role)) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'Only owner/admin can edit' } }, { status: 403 });
    }

    const body = await req.json();
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const allowed = ['name', 'description', 'city', 'avatar_url', 'cover_image', 'visibility', 'join_mode'] as const;
    for (const key of allowed) {
      if (body[key] !== undefined) {
        updates.push(`${key} = $${idx++}`);
        values.push(body[key]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: { code: 'invalid_request', message: 'No fields to update' } }, { status: 400 });
    }

    values.push(id);
    const result = await pgPool.query(
      `UPDATE circles SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      values
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (err) {
    console.error('[Circle PATCH]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to update circle' } }, { status: 500 });
  }
}
