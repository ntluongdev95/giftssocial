import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { z } from 'zod';

// ─── GET /api/v1/signals/:id ─────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDB();
    const r = await db.prepare(
      `SELECT s.*, u.username AS author_username, u.display_name AS author_name, u.avatar_url AS author_avatar
       FROM signals s LEFT JOIN users u ON u.id = s.author_id
       WHERE s.id = ?`
    ).bind(id).first<Record<string, unknown>>();

    if (!r) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Signal not found' } }, { status: 404 });
    }
    return NextResponse.json({ data: { ...r, location: { type: 'Point', coordinates: [r.location_lng, r.location_lat] } } });
  } catch (err) {
    console.error('[Signal GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch signal' } }, { status: 500 });
  }
}

// ─── PATCH /api/v1/signals/:id — Edit signal ─────────────────────────────

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(50).optional(),
  visibility: z.enum(['public', 'circle', 'private', 'trusted_only']).optional(),
  expires_at: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });
    }

    const { id } = await params;
    const db = getDB();

    // Check ownership
    const check = await db.prepare('SELECT author_id, status, expires_at FROM signals WHERE id = ?').bind(id).first<{ author_id: string; status: string; expires_at: string }>();
    if (!check) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Signal not found' } }, { status: 404 });
    }
    if (check.author_id !== userId) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'Not your signal' } }, { status: 403 });
    }
    if (check.status !== 'active' || new Date(check.expires_at) < new Date()) {
      return NextResponse.json({ error: { code: 'expired', message: 'Cannot edit expired signal' } }, { status: 400 });
    }

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: 'invalid_request', message: parsed.error.issues[0].message } }, { status: 400 });
    }

    const d = parsed.data;
    const sets: string[] = [];
    const values: unknown[] = [];

    if (d.title) { sets.push(`title = ?`); values.push(d.title); }
    if (d.description !== undefined) { sets.push(`description = ?`); values.push(d.description); }
    if (d.category) { sets.push(`category = ?`); values.push(d.category); }
    if (d.visibility) { sets.push(`visibility = ?`); values.push(d.visibility); }
    if (d.expires_at) { sets.push(`expires_at = ?`); values.push(d.expires_at); }

    if (sets.length === 0) {
      return NextResponse.json({ error: { code: 'invalid_request', message: 'Nothing to update' } }, { status: 400 });
    }

    sets.push(`updated_at = datetime('now')`);
    values.push(id);

    const row = await db.prepare(
      `UPDATE signals SET ${sets.join(', ')} WHERE id = ? RETURNING id, title, status, updated_at`
    ).bind(...values).first<{ id: string; title: string | null; status: string; updated_at: string }>();

    return NextResponse.json({ data: row });
  } catch (err) {
    console.error('[Signal PATCH]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to update signal' } }, { status: 500 });
  }
}

// ─── DELETE /api/v1/signals/:id ──────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });
    }

    const { id } = await params;
    const db = getDB();

    // Check ownership
    const check = await db.prepare('SELECT author_id FROM signals WHERE id = ?').bind(id).first<{ author_id: string }>();
    if (!check) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Signal not found' } }, { status: 404 });
    }
    if (check.author_id !== userId) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'Not your signal' } }, { status: 403 });
    }

    // Soft delete
    await db.prepare("UPDATE signals SET status = 'hidden', updated_at = datetime('now') WHERE id = ?").bind(id).run();

    return NextResponse.json({ data: { id, status: 'hidden' } });
  } catch (err) {
    console.error('[Signal DELETE]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to delete signal' } }, { status: 500 });
  }
}
