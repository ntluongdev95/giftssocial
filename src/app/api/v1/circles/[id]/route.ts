import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/circles/:id — Single circle detail ────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await resolveUserId(req).catch(() => null);
    const db = getDB();

    const circle = await db.prepare('SELECT * FROM circles WHERE id = ?').bind(id).first<Record<string, unknown>>();
    if (!circle) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Circle not found' } }, { status: 404 });
    }

    // Attach caller's membership info
    let my_role: string | null = null;
    let my_status: string | null = null;
    if (userId) {
      const mem = await db.prepare(
        "SELECT role, status FROM circle_members WHERE circle_id = ? AND user_id = ? AND status IN ('active', 'pending')"
      ).bind(id, userId).first<{ role: string; status: string }>();
      if (mem) {
        my_role = mem.role;
        my_status = mem.status;
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
    const db = getDB();

    // Check owner
    const mem = await db.prepare(
      "SELECT role FROM circle_members WHERE circle_id = ? AND user_id = ? AND status = 'active'"
    ).bind(id, userId).first<{ role: string }>();
    if (!mem || !['owner', 'admin'].includes(mem.role)) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'Only owner/admin can edit' } }, { status: 403 });
    }

    const body = await req.json();
    const updates: string[] = [];
    const values: unknown[] = [];

    const allowed = ['name', 'description', 'city', 'avatar_url', 'cover_image', 'visibility', 'join_mode'] as const;
    for (const key of allowed) {
      if (body[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(body[key]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: { code: 'invalid_request', message: 'No fields to update' } }, { status: 400 });
    }

    values.push(id);
    const row = await db.prepare(
      `UPDATE circles SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ? RETURNING *`
    ).bind(...values).first();

    return NextResponse.json({ data: row });
  } catch (err) {
    console.error('[Circle PATCH]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to update circle' } }, { status: 500 });
  }
}
