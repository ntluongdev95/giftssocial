import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';

// ─── GET /api/v1/events — Search nearby events ──────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radiusKm = Math.min(parseInt(searchParams.get('radius') || '10000'), 100000) / 1000;
    const category = searchParams.get('category');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const userId = await resolveUserId(req).catch(() => null);

    const conditions: string[] = ["e.status IN ('scheduled', 'live')", "e.start_time > datetime('now')"];
    const values: unknown[] = [];

    // Visibility filter
    if (userId) {
      conditions.push(`(
        e.visibility = 'public' OR e.visibility IS NULL
        OR (e.visibility = 'circle' AND e.circle_id IN (
          SELECT circle_id FROM circle_members WHERE user_id = ? AND status = 'active'
        ))
        OR e.host_user_id = ?
      )`);
      values.push(userId, userId);
    } else {
      conditions.push("(e.visibility = 'public' OR e.visibility IS NULL)");
    }

    if (category) {
      conditions.push(`e.category = ?`);
      values.push(category);
    }

    if (radiusKm > 0 && (lat !== 0 || lng !== 0)) {
      conditions.push(`(6371 * acos(MIN(1.0, cos(radians(?)) * cos(radians(e.location_lat)) * cos(radians(e.location_lng) - radians(?)) + sin(radians(?)) * sin(radians(e.location_lat))))) < ?`);
      values.push(lat, lng, lat, radiusKm);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    values.push(limit);

    const db = getDB();
    const result = await db.prepare(
      `SELECT e.* FROM events e ${where} ORDER BY e.start_time ASC LIMIT ?`
    ).bind(...values).all<Record<string, unknown>>();

    return NextResponse.json({ data: result.results });
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
  visibility: z.enum(['public', 'circle', 'private']).optional(),
  host_type: z.enum(['user', 'business', 'circle']).optional(),
  host_id: z.string().optional(),
  target_circle_id: z.string().optional(),
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

    const circleId = d.target_circle_id || (d.visibility === 'circle' && d.host_id ? d.host_id : null);

    const db = getDB();
    const id = genId('evt_');
    const row = await db.prepare(
      `INSERT INTO events (id, host_user_id, host_type, host_id, title, description, category, location_lat, location_lng, location_name, city, start_time, end_time, capacity, visibility, circle_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       RETURNING id, status, created_at`
    ).bind(
      id, userId, d.host_type || 'user', d.host_id || userId,
      d.title, d.description || '', d.category || 'general',
      latVal, lngVal, d.location_name || '', d.city || '',
      d.start_time, d.end_time, d.capacity || null,
      d.visibility || 'public', circleId
    ).first<Record<string, unknown>>();

    // Notify circle members if event is for a circle
    if (d.visibility === 'circle' && circleId) {
      try {
        const authorRow = await db.prepare('SELECT display_name, username FROM users WHERE id = ?').bind(userId).first<{ display_name: string; username: string }>();
        const name = authorRow?.display_name || authorRow?.username || 'Someone';
        const circleRow = await db.prepare('SELECT name FROM circles WHERE id = ?').bind(circleId).first<{ name: string }>();
        const cName = circleRow?.name || 'your circle';

        const members = await db.prepare(
          "SELECT user_id FROM circle_members WHERE circle_id = ? AND status = 'active' AND user_id != ?"
        ).bind(circleId, userId).all<{ user_id: string }>();

        for (const m of members.results) {
          notify(m.user_id, 'circle_activity', `New event in ${cName}`, `${name}: ${d.title}`, 'circle', circleId);
        }
      } catch {}
    }

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    console.error('[Events POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to create event' } }, { status: 500 });
  }
}
