import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import type { UserRow } from '@/types/d1';

// GET /api/v1/users/me
export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const db = getDB();
    const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();
    if (!row) return NextResponse.json({ error: { code: 'not_found', message: 'User not found' } }, { status: 404 });

    return NextResponse.json({ data: row });
  } catch (err) {
    console.error('[Users Me GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch user' } }, { status: 500 });
  }
}

// PATCH /api/v1/users/me — Update profile
export async function PATCH(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const body = await req.json();
    const allowedFields = ['display_name', 'full_name', 'bio', 'avatar_url', 'background_url', 'photos', 'location_lat', 'location_lng', 'city'];
    const updates: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) return NextResponse.json({ error: { code: 'invalid_request', message: 'No fields to update' } }, { status: 400 });

    updates.push(`updated_at = datetime('now')`);
    values.push(userId);

    const db = getDB();
    const row = await db.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ? RETURNING *`
    ).bind(...values).first();

    return NextResponse.json({ data: row });
  } catch (err) {
    console.error('[Users Me PATCH]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to update' } }, { status: 500 });
  }
}
