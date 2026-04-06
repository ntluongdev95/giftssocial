import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pgPool } from '@/lib/db';
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
    let idx = 1;

    if (q) {
      conditions.push(`(to_tsvector('english', name) @@ plainto_tsquery('english', $${idx}) OR name ILIKE $${idx + 1})`);
      values.push(q, `%${q}%`);
      idx += 2;
    }
    if (category) { conditions.push(`category = $${idx++}`); values.push(category); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit);
    const result = await pgPool.query(`SELECT * FROM circles ${where} ORDER BY member_count DESC LIMIT $${idx}`, values);

    return NextResponse.json({ data: result.rows });
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

    const result = await pgPool.query(
      `INSERT INTO circles (owner_id, name, slug, category, description, city, visibility, join_mode, location_lat, location_lng, member_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1) RETURNING *`,
      [userId, d.name, slug, d.category, d.description, d.city || '', d.visibility, d.join_mode, d.location_lat ?? null, d.location_lng ?? null]
    );

    const circle = result.rows[0];

    // Auto-join as owner
    await pgPool.query(
      `INSERT INTO circle_members (circle_id, user_id, role, status) VALUES ($1, $2, 'owner', 'active')`,
      [circle.id, userId]
    );

    // Update user circles count
    await pgPool.query('UPDATE users SET circles_count = circles_count + 1 WHERE id = $1', [userId]).catch(() => {});

    return NextResponse.json({ data: circle }, { status: 201 });
  } catch (err) {
    console.error('[Circles POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to create circle' } }, { status: 500 });
  }
}
