import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';

// ─── Default durations per signal type ───────────────────────────────────

const DEFAULT_HOURS: Record<string, number> = {
  presence: 2, intent: 4, offer: 8, event: 24, update: 24, proof: 168,
};

// ─── GET /api/v1/signals — List signals by location ──────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radiusKm = Math.min(parseInt(searchParams.get('radius') || '5000'), 50000) / 1000;
    const types = searchParams.get('types')?.split(',').filter(Boolean);
    const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100);

    // Resolve caller for visibility filtering
    const userId = await resolveUserId(req).catch(() => null);

    const conditions: string[] = ["s.status = 'active'", "s.expires_at > datetime('now')"];
    const values: unknown[] = [];

    // Visibility filter: only show signals the user is allowed to see
    if (userId) {
      conditions.push(`(
        s.visibility = 'public'
        OR (s.visibility = 'circle' AND s.target_circle_id IN (
          SELECT circle_id FROM circle_members WHERE user_id = ? AND status = 'active'
        ))
        OR s.author_id = ?
        OR (s.visibility = 'trusted_only' AND EXISTS (
          SELECT 1 FROM users WHERE id = ? AND trust_score >= 30
        ))
      )`);
      values.push(userId, userId, userId);
    } else {
      // Not logged in → only public signals
      conditions.push("s.visibility = 'public'");
    }

    if (types && types.length > 0) {
      conditions.push(`s.type IN (${types.map(() => '?').join(',')})`);
      values.push(...types);
    }

    if (lat !== 0 || lng !== 0) {
      conditions.push(`(6371 * acos(LEAST(1.0, cos(radians(?)) * cos(radians(s.location_lat)) * cos(radians(s.location_lng) - radians(?)) + sin(radians(?)) * sin(radians(s.location_lat))))) < ?`);
      values.push(lat, lng, lat, radiusKm);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const db = getDB();
    const result = await db.prepare(
      `SELECT s.*, u.username AS author_username, u.display_name AS author_name, u.avatar_url AS author_avatar, u.trust_level AS author_trust_level
       FROM signals s
       LEFT JOIN users u ON u.id = s.author_id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT ?`
    ).bind(...values, limit).all<Record<string, unknown>>();

    // Transform to frontend format
    const data = result.results.map(r => ({
      ...r,
      location: { type: 'Point', coordinates: [r.location_lng, r.location_lat] },
    }));

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[Signals GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch signals' } },
      { status: 500 }
    );
  }
}

// ─── POST /api/v1/signals — Create signal ────────────────────────────────

const signalSchema = z.object({
  type: z.enum(['presence', 'intent', 'offer', 'event', 'update', 'proof']),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(50).default('general'),
  location: z.object({
    type: z.literal('Point').default('Point'),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  radius: z.number().min(50).max(50000).default(300),
  visibility: z.enum(['public', 'circle', 'private', 'trusted_only']).default('public'),
  target_circle_id: z.string().optional(),
  target_business_id: z.string().optional(),
  expires_at: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Account required to create signals' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = signalSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: { code: 'invalid_request', message: issue.message, field: String(issue.path[0]) } },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const [lngVal, latVal] = d.location.coordinates;

    // Calculate expiry
    const expiresAt = d.expires_at
      ? new Date(d.expires_at)
      : new Date(Date.now() + (DEFAULT_HOURS[d.type] || 8) * 60 * 60 * 1000);

    // Max 7 days
    const maxExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (expiresAt > maxExpiry) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Expiry cannot exceed 7 days' } },
        { status: 400 }
      );
    }

    const db = getDB();

    // Get trust score from local users table
    let trustScore = 0;
    try {
      const userRow = await db.prepare('SELECT trust_score FROM users WHERE id = ?').bind(userId).first<{ trust_score: number }>();
      if (userRow) trustScore = userRow.trust_score;
    } catch {}

    const id = genId('sig_');
    const row = await db.prepare(
      `INSERT INTO signals (id, author_id, type, title, description, category, location_lat, location_lng, radius, visibility, target_circle_id, target_business_id, trust_score_snapshot, verified, expires_at, metadata)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       RETURNING id, type, title, status, created_at, expires_at`
    ).bind(
      id, userId, d.type, d.title, d.description || '', d.category,
      latVal, lngVal, d.radius, d.visibility,
      d.target_circle_id || null, d.target_business_id || null,
      trustScore, trustScore >= 30 ? 1 : 0, expiresAt.toISOString(),
      JSON.stringify(d.metadata),
    ).first<Record<string, unknown>>();

    // Notify circle members if signal is for a circle
    if (d.visibility === 'circle' && d.target_circle_id) {
      try {
        const authorRow = await db.prepare('SELECT display_name, username FROM users WHERE id = ?').bind(userId).first<{ display_name: string; username: string }>();
        const name = authorRow?.display_name || authorRow?.username || 'Someone';
        const circleRow = await db.prepare('SELECT name FROM circles WHERE id = ?').bind(d.target_circle_id).first<{ name: string }>();
        const cName = circleRow?.name || 'your circle';
        const typeLabel = d.type === 'event' ? 'event' : 'signal';

        // Get all active members except the author
        const members = await db.prepare(
          "SELECT user_id FROM circle_members WHERE circle_id = ? AND status = 'active' AND user_id != ?"
        ).bind(d.target_circle_id, userId).all<{ user_id: string }>();

        for (const m of members.results) {
          notify(m.user_id, 'circle_activity', `New ${typeLabel} in ${cName}`, `${name}: ${d.title}`, 'circle', d.target_circle_id);
        }
      } catch {}
    }

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    console.error('[Signals POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create signal' } },
      { status: 500 }
    );
  }
}
