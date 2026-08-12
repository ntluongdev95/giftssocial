import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db';
import { resolveAdminUserId } from '@/lib/admin';

// GET  /api/v1/admin/templates            — list ALL templates (incl. inactive)
// POST /api/v1/admin/templates            — create a template + link it to occasions

export async function GET(req: NextRequest) {
  const admin = await resolveAdminUserId(req);
  if (!admin) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  try {
    const db = getDB();
    const res = await db.prepare(
      `SELECT t.*,
              GROUP_CONCAT(to_.occasion_id) AS occasion_ids
       FROM templates t
       LEFT JOIN template_occasions to_ ON to_.template_id = t.id
       GROUP BY t.id
       ORDER BY t.name`
    ).all<Record<string, unknown>>();
    return NextResponse.json({ data: res.results });
  } catch (err) {
    console.error('[admin/templates GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}

// Body accepts both metadata + occasion_ids array. All occasions get
// sort_order=99 by default; edit later on the per-template page.
const createSchema = z.object({
  id: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
  component_key: z.string().min(1).max(60).default('data-driven'),
  name: z.string().min(1).max(80),
  name_vi: z.string().max(80).optional(),
  description: z.string().max(300).optional(),
  description_vi: z.string().max(300).optional(),
  emoji: z.string().min(1).max(10),
  thumbnail_bg: z.string().max(200).optional(),
  thumbnail_url: z.string().max(500).optional(),
  preview_video: z.string().max(500).optional(),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  premium: z.boolean().default(false),
  coins: z.number().int().min(0).default(0),
  author: z.string().max(60).default('gao'),
  active: z.boolean().default(true),
  occasion_ids: z.array(z.string().min(1).max(60)).default([]),
  fields_schema: z.unknown().optional(), // arbitrary JSON, validated shape lives client-side
  effects: z.unknown().optional(),
});

export async function POST(req: NextRequest) {
  const admin = await resolveAdminUserId(req);
  if (!admin) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: 'invalid_request', message: parsed.error.issues[0].message } }, { status: 400 });
    }
    const d = parsed.data;
    const db = getDB();

    await db.prepare(
      `INSERT INTO templates (id, component_key, name, name_vi, description, description_vi, emoji, thumbnail_bg, thumbnail_url, preview_video, accent_color, premium, coins, author, active, fields_schema, effects)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      d.id, d.component_key, d.name, d.name_vi ?? null,
      d.description ?? null, d.description_vi ?? null, d.emoji,
      d.thumbnail_bg ?? null, d.thumbnail_url ?? null, d.preview_video ?? null,
      d.accent_color ?? null, d.premium ? 1 : 0, d.coins, d.author, d.active ? 1 : 0,
      d.fields_schema ? JSON.stringify(d.fields_schema) : null,
      d.effects ? JSON.stringify(d.effects) : null,
    ).run();

    // Link to occasions — sort_order 99 puts new templates at the end.
    if (d.occasion_ids.length > 0) {
      const stmts = d.occasion_ids.map(oid =>
        db.prepare(
          `INSERT OR IGNORE INTO template_occasions (template_id, occasion_id, sort_order, featured)
           VALUES (?, ?, 99, 0)`
        ).bind(d.id, oid)
      );
      await db.batch(stmts);
    }

    return NextResponse.json({ data: { id: d.id } }, { status: 201 });
  } catch (err) {
    console.error('[admin/templates POST]', err);
    const msg = err instanceof Error && err.message.includes('UNIQUE') ? 'Template ID already exists' : 'Failed to create';
    return NextResponse.json({ error: { code: 'internal_error', message: msg } }, { status: 500 });
  }
}
