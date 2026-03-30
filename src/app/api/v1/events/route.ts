import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/events — Search nearby events ──────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radiusKm = Math.min(parseInt(searchParams.get('radius') || '10000'), 100000) / 1000;
    const category = searchParams.get('category');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const conditions: string[] = ["status IN ('scheduled', 'live')", 'start_time > NOW()'];
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

    const where = `WHERE ${conditions.join(' AND ')}`;
    const result = await pgPool.query(
      `SELECT * FROM events ${where} ORDER BY start_time ASC LIMIT ${limit}`,
      values
    );

    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error('[Events GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch events' } }, { status: 500 });
  }
}

// ─── POST /api/v1/events — Create event ──────────────────────────────────

const eventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(50).optional(),
  location: z.object({ type: z.literal('Point').default('Point'), coordinates: z.tuple([z.number(), z.number()]) }),
  location_name: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  start_time: z.string(),
  end_time: z.string(),
  capacity: z.number().int().min(1).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  host_type: z.enum(['user', 'business', 'circle']).optional(),
  host_id: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: { code: 'unauthorized', message: 'Account required' } }, { status: 403 });
    }

    const body = await req.json();
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ error: { code: 'invalid_request', message: issue.message } }, { status: 400 });
    }

    const d = parsed.data;
    const [lngVal, latVal] = d.location.coordinates;

    const result = await pgPool.query(
      `INSERT INTO events (host_user_id, host_type, host_id, title, description, category, location_lat, location_lng, location_name, city, start_time, end_time, capacity, visibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id, status, created_at`,
      [userId, d.host_type || 'user', d.host_id || userId, d.title, d.description || '', d.category || 'general', latVal, lngVal, d.location_name || '', d.city || '', d.start_time, d.end_time, d.capacity || null, d.visibility || 'public']
    );

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[Events POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to create event' } }, { status: 500 });
  }
}
