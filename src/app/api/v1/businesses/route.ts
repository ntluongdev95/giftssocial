import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/businesses — Search nearby businesses ───────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radiusKm = Math.min(parseInt(searchParams.get('radius') || '10000'), 100000) / 1000;
    const category = searchParams.get('category');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const conditions: string[] = ["status = 'active'"];
    const values: unknown[] = [];
    let idx = 1;

    if (category) {
      conditions.push(`category = $${idx++}`);
      values.push(category);
    }

    if (lat !== 0 || lng !== 0) {
      conditions.push(`(6371 * acos(cos(radians($${idx})) * cos(radians(location_lat)) * cos(radians(location_lng) - radians($${idx + 1})) + sin(radians($${idx})) * sin(radians(location_lat)))) < $${idx + 2}`);
      values.push(lat, lng, radiusKm);
      idx += 3;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pgPool.query(
      `SELECT * FROM businesses ${where} ORDER BY trust_score DESC LIMIT ${limit}`,
      values
    );

    return NextResponse.json({ data: result.rows });
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

    const result = await pgPool.query(
      `INSERT INTO businesses (owner_user_id, name, category, description, location_lat, location_lng, address, city, phone, website, hours, booking_enabled, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
       ON CONFLICT (owner_user_id) DO UPDATE SET
         name=EXCLUDED.name, category=EXCLUDED.category, description=EXCLUDED.description,
         location_lat=EXCLUDED.location_lat, location_lng=EXCLUDED.location_lng,
         address=EXCLUDED.address, city=EXCLUDED.city, phone=EXCLUDED.phone, website=EXCLUDED.website,
         hours=EXCLUDED.hours, booking_enabled=EXCLUDED.booking_enabled, status='active', updated_at=NOW()
       RETURNING id, status, updated_at`,
      [userId, d.name, d.category, d.description || '', latVal, lngVal, d.address || '', d.city || '', d.phone || null, d.website || null, JSON.stringify(d.hours || {}), d.booking_enabled ?? false]
    );

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[Businesses POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to save business' } }, { status: 500 });
  }
}
