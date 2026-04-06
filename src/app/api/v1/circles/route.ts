import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/circles — List circles ──────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const category = searchParams.get('category');
    const q = searchParams.get('q')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const conditions: string[] = ["status = 'active'"];
    const values: unknown[] = [];

    if (q) {
      conditions.push(`(name LIKE ? OR category LIKE ?)`);
      values.push(`%${q}%`, `%${q}%`);
    }
    if (category) {
      conditions.push(`category = ?`);
      values.push(category);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit);

    const db = getDB();
    const result = await db.prepare(
      `SELECT * FROM circles ${where} ORDER BY member_count DESC LIMIT ?`
    ).bind(...values).all<Record<string, unknown>>();

    return NextResponse.json({ data: result.results });
  } catch (err) {
    console.error('[Circles GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch circles' } }, { status: 500 });
  }
}

// ─── POST /api/v1/circles — Create circle ────────────────────────────────

const circleSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().max(50).default('general'),
  description: z.string().max(2000).default(''),
  city: z.string().max(100).optional(),
  visibility: z.enum(['public', 'private', 'invite_only']).default('public'),
  join_mode: z.enum(['open', 'request', 'invite_only']).default('open'),
  location_lat: z.number().min(-90).max(90).nullable().optional(),
  location_lng: z.number().min(-180).max(180).nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const body = await req.json();
    const parsed = circleSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: { code: 'invalid_request', message: parsed.error.issues[0].message } }, { status: 400 });

    const d = parsed.data;
    const slug = d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const id = genId('cir_');

    const db = getDB();
    const circle = await db.prepare(
      `INSERT INTO circles (id, owner_id, name, slug, category, description, city, visibility, join_mode, location_lat, location_lng, member_count)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,1) RETURNING *`
    ).bind(id, userId, d.name, slug, d.category, d.description, d.city || '', d.visibility, d.join_mode, d.location_lat ?? null, d.location_lng ?? null).first<Record<string, unknown>>();

    // Auto-join as owner
    await db.prepare(
      `INSERT INTO circle_members (circle_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`
    ).bind(id, userId).run();

    // Update user circles count
    await db.prepare('UPDATE users SET circles_count = circles_count + 1 WHERE id = ?').bind(userId).run().catch(() => {});

    return NextResponse.json({ data: circle }, { status: 201 });
  } catch (err) {
    console.error('[Circles POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to create circle' } }, { status: 500 });
  }
}
