import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db';
import { resolveAdminUserId } from '@/lib/admin';

// GET /api/v1/admin/occasions
// Returns ALL occasions including inactive ones. Also returns each
// occasion's template count so the list page can show it.
// Non-admins get 404 to avoid leaking the route.

export async function GET(req: NextRequest) {
  const admin = await resolveAdminUserId(req);
  if (!admin) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  try {
    const db = getDB();
    const res = await db.prepare(
      `SELECT o.*,
              (SELECT COUNT(*) FROM template_occasions to_ WHERE to_.occasion_id = o.id) AS template_count
       FROM occasions o
       ORDER BY o.sort_order, o.name`
    ).all<Record<string, unknown>>();
    return NextResponse.json({ data: res.results });
  } catch (err) {
    console.error('[admin/occasions GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}

// POST /api/v1/admin/occasions — create a new occasion.

const occasionSchema = z.object({
  id: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, 'lowercase letters, digits, hyphens only'),
  name: z.string().min(1).max(80),
  name_vi: z.string().max(80).optional(),
  emoji: z.string().min(1).max(10),
  theme_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be #RRGGBB').default('#ec4899'),
  bg_gradient: z.string().max(200).optional(),
  description: z.string().max(200).optional(),
  description_vi: z.string().max(200).optional(),
  date_month: z.number().int().min(1).max(12).optional(),
  date_day: z.number().int().min(1).max(31).optional(),
  is_lunar: z.boolean().default(false),
  evergreen: z.boolean().default(false),
  window_days: z.number().int().min(0).max(365).default(14),
  sort_order: z.number().int().default(0),
  active: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const admin = await resolveAdminUserId(req);
  if (!admin) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  try {
    const body = await req.json();
    const parsed = occasionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: 'invalid_request', message: parsed.error.issues[0].message } }, { status: 400 });
    }
    const d = parsed.data;
    const db = getDB();

    await db.prepare(
      `INSERT INTO occasions (id, name, name_vi, emoji, theme_color, bg_gradient, description, description_vi, date_month, date_day, is_lunar, evergreen, window_days, sort_order, active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      d.id, d.name, d.name_vi ?? null, d.emoji, d.theme_color,
      d.bg_gradient ?? null, d.description ?? null, d.description_vi ?? null,
      d.date_month ?? null, d.date_day ?? null,
      d.is_lunar ? 1 : 0, d.evergreen ? 1 : 0,
      d.window_days, d.sort_order, d.active ? 1 : 0,
    ).run();

    return NextResponse.json({ data: { id: d.id } }, { status: 201 });
  } catch (err) {
    console.error('[admin/occasions POST]', err);
    const msg = err instanceof Error && err.message.includes('UNIQUE') ? 'Occasion ID already exists' : 'Failed to create';
    return NextResponse.json({ error: { code: 'internal_error', message: msg } }, { status: 500 });
  }
}
