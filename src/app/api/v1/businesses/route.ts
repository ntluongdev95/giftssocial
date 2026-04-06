import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB, genId, parseRows } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/businesses — Search nearby businesses ───────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radiusKm = Math.min(parseInt(searchParams.get('radius') || '10000'), 100000) / 1000;
    const category = searchParams.get('category');
    const q = searchParams.get('q')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const conditions: string[] = ["status = 'active'"];
    const values: unknown[] = [];

    // Name search (LIKE — SQLite LIKE is case-insensitive for ASCII)
    if (q) {
      conditions.push(`(name LIKE ? OR address LIKE ? OR city LIKE ?)`);
      values.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (category) {
      conditions.push(`(category = ? OR subcategories LIKE '%"' || ? || '"%')`);
      values.push(category, category);
    }

    if (radiusKm > 0 && (lat !== 0 || lng !== 0)) {
      conditions.push(`(6371 * acos(LEAST(1.0, cos(radians(?)) * cos(radians(location_lat)) * cos(radians(location_lng) - radians(?)) + sin(radians(?)) * sin(radians(location_lat))))) < ?`);
      values.push(lat, lng, lat, radiusKm);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit);

    const db = getDB();
    const result = await db.prepare(
      `SELECT * FROM businesses ${where} ORDER BY trust_score DESC LIMIT ?`
    ).bind(...values).all<Record<string, unknown>>();

    return NextResponse.json({ data: parseRows(result.results) });
  } catch (err) {
    console.error('[Businesses GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch businesses' } }, { status: 500 });
  }
}

// ─── POST /api/v1/businesses — Create/update my business ─────────────────

const businessSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(50),
  description: z.string().max(1000).optional(),
  location: z.object({ type: z.literal('Point').default('Point'), coordinates: z.tuple([z.number(), z.number()]) }),
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  website: z.string().url().max(500).optional(),
  hours: z.record(z.string(), z.unknown()).optional(),
  booking_enabled: z.boolean().optional(),
  cover_image: z.string().optional(),
  images: z.array(z.string()).optional(),
  services: z.array(z.object({ name: z.string(), price: z.number(), duration: z.number() })).optional(),
  social_links: z.array(z.object({ platform: z.string(), url: z.string() })).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: { code: 'unauthorized', message: 'Account required' } }, { status: 403 });
    }

    const body = await req.json();
    const parsed = businessSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ error: { code: 'invalid_request', message: issue.message } }, { status: 400 });
    }

    const d = parsed.data;
    const [lngVal, latVal] = d.location.coordinates;
    const db = getDB();

    // SELECT + INSERT/UPDATE pattern (no ON CONFLICT on owner_user_id)
    const existing = await db.prepare('SELECT id FROM businesses WHERE owner_user_id = ? LIMIT 1').bind(userId).first<{ id: string }>();

    let row: Record<string, unknown> | null;
    if (existing) {
      row = await db.prepare(
        `UPDATE businesses SET
           name=?, category=?, description=?,
           location_lat=?, location_lng=?,
           address=?, city=?, phone=?, website=?,
           hours=?, booking_enabled=?,
           cover_image=?, images=?, services=?, social_links=?,
           status='active', updated_at=datetime('now')
         WHERE id=? RETURNING id, status, updated_at`
      ).bind(
        d.name, d.category, d.description || '', latVal, lngVal,
        d.address || '', d.city || '', d.phone || null, d.website || null,
        JSON.stringify(d.hours || {}), d.booking_enabled ? 1 : 0,
        d.cover_image || null, JSON.stringify(d.images || []),
        JSON.stringify(d.services || []), JSON.stringify(d.social_links || []),
        existing.id
      ).first<Record<string, unknown>>();
    } else {
      const newId = genId('biz_');
      row = await db.prepare(
        `INSERT INTO businesses (id, owner_user_id, name, category, description, location_lat, location_lng, address, city, phone, website, hours, booking_enabled, cover_image, images, services, social_links, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
         RETURNING id, status, updated_at`
      ).bind(
        newId, userId, d.name, d.category, d.description || '', latVal, lngVal,
        d.address || '', d.city || '', d.phone || null, d.website || null,
        JSON.stringify(d.hours || {}), d.booking_enabled ? 1 : 0,
        d.cover_image || null, JSON.stringify(d.images || []),
        JSON.stringify(d.services || []), JSON.stringify(d.social_links || [])
      ).first<Record<string, unknown>>();
    }

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    console.error('[Businesses POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to save business' } }, { status: 500 });
  }
}
