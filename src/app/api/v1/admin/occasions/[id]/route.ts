import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db';
import { resolveAdminUserId } from '@/lib/admin';

// GET / PATCH / DELETE a single occasion. GET also returns its templates
// (with join-table sort_order + featured) so the edit page can show them.

interface RouteCtx { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const admin = await resolveAdminUserId(req);
  if (!admin) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  const { id } = await ctx.params;

  try {
    const db = getDB();
    const [occRes, tplRes] = await Promise.all([
      db.prepare('SELECT * FROM occasions WHERE id = ?').bind(id).first<Record<string, unknown>>(),
      db.prepare(
        `SELECT t.*, to_.sort_order AS occ_sort, to_.featured
         FROM templates t
         JOIN template_occasions to_ ON to_.template_id = t.id
         WHERE to_.occasion_id = ?
         ORDER BY to_.sort_order`
      ).bind(id).all<Record<string, unknown>>(),
    ]);
    if (!occRes) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    return NextResponse.json({ data: { ...occRes, templates: tplRes.results } });
  } catch (err) {
    console.error('[admin/occasions/[id] GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  name_vi: z.string().max(80).nullable().optional(),
  emoji: z.string().min(1).max(10).optional(),
  theme_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  bg_gradient: z.string().max(200).nullable().optional(),
  description: z.string().max(200).nullable().optional(),
  description_vi: z.string().max(200).nullable().optional(),
  date_month: z.number().int().min(1).max(12).nullable().optional(),
  date_day: z.number().int().min(1).max(31).nullable().optional(),
  is_lunar: z.boolean().optional(),
  evergreen: z.boolean().optional(),
  window_days: z.number().int().min(0).max(365).optional(),
  sort_order: z.number().int().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const admin = await resolveAdminUserId(req);
  if (!admin) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  const { id } = await ctx.params;

  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: 'invalid_request', message: parsed.error.issues[0].message } }, { status: 400 });
    }
    const d = parsed.data;

    const cols: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(d)) {
      if (v === undefined) continue;
      cols.push(`${k} = ?`);
      // booleans → 0/1 for SQLite
      vals.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
    }
    if (cols.length === 0) return NextResponse.json({ error: { code: 'invalid_request', message: 'No changes' } }, { status: 400 });

    cols.push(`updated_at = datetime('now')`);
    vals.push(id);

    const db = getDB();
    await db.prepare(`UPDATE occasions SET ${cols.join(', ')} WHERE id = ?`).bind(...vals).run();
    return NextResponse.json({ data: { id, updated: cols.length - 1 } });
  } catch (err) {
    console.error('[admin/occasions/[id] PATCH]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to update' } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const admin = await resolveAdminUserId(req);
  if (!admin) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  const { id } = await ctx.params;

  try {
    const db = getDB();
    // Soft delete — flip active=0 rather than losing history.
    await db.prepare('UPDATE occasions SET active = 0, updated_at = datetime(\'now\') WHERE id = ?').bind(id).run();
    return NextResponse.json({ data: { id, active: false } });
  } catch (err) {
    console.error('[admin/occasions/[id] DELETE]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to delete' } }, { status: 500 });
  }
}
