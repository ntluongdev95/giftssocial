import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db';
import { resolveAdminUserId } from '@/lib/admin';

// GET    /api/v1/admin/templates/[id] — single template + linked occasions
// PATCH  /api/v1/admin/templates/[id] — partial update (metadata + schema/effects + occasion links)
// DELETE /api/v1/admin/templates/[id] — soft delete (active=0)

interface RouteCtx { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const admin = await resolveAdminUserId(req);
  if (!admin) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  const { id } = await ctx.params;

  try {
    const db = getDB();
    const [tpl, links] = await Promise.all([
      db.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first<Record<string, unknown>>(),
      db.prepare(
        `SELECT occasion_id, sort_order, featured FROM template_occasions WHERE template_id = ?`
      ).bind(id).all<Record<string, unknown>>(),
    ]);
    if (!tpl) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    return NextResponse.json({ data: { ...tpl, occasions: links.results } });
  } catch (err) {
    console.error('[admin/templates/[id] GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed' } }, { status: 500 });
  }
}

const patchSchema = z.object({
  component_key: z.string().min(1).max(60).optional(),
  name: z.string().min(1).max(80).optional(),
  name_vi: z.string().max(80).nullable().optional(),
  description: z.string().max(300).nullable().optional(),
  description_vi: z.string().max(300).nullable().optional(),
  emoji: z.string().min(1).max(10).optional(),
  thumbnail_bg: z.string().max(200).nullable().optional(),
  thumbnail_url: z.string().max(500).nullable().optional(),
  preview_video: z.string().max(500).nullable().optional(),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  premium: z.boolean().optional(),
  coins: z.number().int().min(0).optional(),
  author: z.string().max(60).optional(),
  active: z.boolean().optional(),
  fields_schema: z.unknown().optional(), // pass null to clear; array/object to set
  effects: z.unknown().optional(),
  // Full replacement of the join table. Each entry: { occasion_id, sort_order?, featured? }
  occasions: z.array(z.object({
    occasion_id: z.string().min(1).max(60),
    sort_order: z.number().int().default(0),
    featured: z.boolean().default(false),
  })).optional(),
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
    const db = getDB();

    // Metadata + JSON columns
    const cols: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(d)) {
      if (v === undefined) continue;
      if (k === 'occasions') continue;
      cols.push(`${k} = ?`);
      if (k === 'fields_schema' || k === 'effects') {
        vals.push(v === null ? null : JSON.stringify(v));
      } else if (typeof v === 'boolean') {
        vals.push(v ? 1 : 0);
      } else {
        vals.push(v);
      }
    }

    const stmts = [];
    if (cols.length > 0) {
      cols.push(`updated_at = datetime('now')`);
      stmts.push(db.prepare(`UPDATE templates SET ${cols.join(', ')} WHERE id = ?`).bind(...vals, id));
    }

    // Occasion links — full replacement
    if (d.occasions) {
      stmts.push(db.prepare('DELETE FROM template_occasions WHERE template_id = ?').bind(id));
      for (const link of d.occasions) {
        stmts.push(db.prepare(
          `INSERT INTO template_occasions (template_id, occasion_id, sort_order, featured) VALUES (?,?,?,?)`
        ).bind(id, link.occasion_id, link.sort_order, link.featured ? 1 : 0));
      }
    }

    if (stmts.length === 0) return NextResponse.json({ error: { code: 'invalid_request', message: 'No changes' } }, { status: 400 });

    await db.batch(stmts);
    return NextResponse.json({ data: { id, updated: true } });
  } catch (err) {
    console.error('[admin/templates/[id] PATCH]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to update' } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const admin = await resolveAdminUserId(req);
  if (!admin) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  const { id } = await ctx.params;

  try {
    const db = getDB();
    await db.prepare('UPDATE templates SET active = 0, updated_at = datetime(\'now\') WHERE id = ?').bind(id).run();
    return NextResponse.json({ data: { id, active: false } });
  } catch (err) {
    console.error('[admin/templates/[id] DELETE]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed' } }, { status: 500 });
  }
}
