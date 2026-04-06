import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';

// ─── Visibility filter helper ───────────────────────────────────────────
// public → everyone sees
// circle → only members of target_circle_id
// private → only the author
// trusted_only → only users with trust_score >= 30

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

    const conditions: string[] = ["s.status = 'active'", 's.expires_at > NOW()'];
    const values: unknown[] = [];
    let idx = 1;

    // Visibility filter: only show signals the user is allowed to see
    if (userId) {
      conditions.push(`(
        s.visibility = 'public'
        OR (s.visibility = 'circle' AND s.target_circle_id IN (
          SELECT circle_id FROM circle_members WHERE user_id = $${idx} AND status = 'active'
        ))
        OR s.author_id = $${idx}
        OR (s.visibility = 'trusted_only' AND EXISTS (
          SELECT 1 FROM users WHERE id = $${idx} AND trust_score >= 30
        ))
      )`);
      values.push(userId);
      idx++;
    } else {
      // Not logged in → only public signals
      conditions.push("s.visibility = 'public'");
    }

    if (types && types.length > 0) {
      conditions.push(`s.type = ANY($${idx++})`);
      values.push(types);
    }

    if (lat !== 0 || lng !== 0) {
      conditions.push(`(6371 * acos(LEAST(1.0, cos(radians($${idx})) * cos(radians(s.location_lat)) * cos(radians(s.location_lng) - radians($${idx + 1})) + sin(radians($${idx})) * sin(radians(s.location_lat))))) < $${idx + 2}`);
      values.push(lat, lng, radiusKm);
      idx += 3;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const result = await pgPool.query(
      `SELECT s.*, u.username AS author_username, u.display_name AS author_name, u.avatar_url AS author_avatar, u.trust_level AS author_trust_level
       FROM signals s
       LEFT JOIN users u ON u.id = s.author_id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${idx}`,
      [...values, limit]
    );

    // Transform to frontend format
    const data = result.rows.map(r => ({
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

    // Get trust score from local users table
    let trustScore = 0;
    try {
      const userRes = await pgPool.query('SELECT trust_score FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length > 0) trustScore = userRes.rows[0].trust_score;
    } catch {}

    const result = await pgPool.query(
      `INSERT INTO signals (author_id, type, title, description, category, location_lat, location_lng, radius, visibility, target_circle_id, target_business_id, trust_score_snapshot, verified, expires_at, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id, type, title, status, created_at, expires_at`,
      [
        userId, d.type, d.title, d.description || '', d.category,
        latVal, lngVal, d.radius, d.visibility,
        d.target_circle_id || null, d.target_business_id || null,
        trustScore, trustScore >= 30, expiresAt,
        JSON.stringify(d.metadata),
      ]
    );

    // Notify circle members if signal is for a circle
    if (d.visibility === 'circle' && d.target_circle_id) {
      try {
        const authorName = await pgPool.query('SELECT display_name, username FROM users WHERE id = $1', [userId]);
        const name = authorName.rows[0]?.display_name || authorName.rows[0]?.username || 'Someone';
        const circleName = await pgPool.query('SELECT name FROM circles WHERE id = $1', [d.target_circle_id]);
        const cName = circleName.rows[0]?.name || 'your circle';
        const typeLabel = d.type === 'event' ? 'event' : 'signal';

        // Get all active members except the author
        const members = await pgPool.query(
          "SELECT user_id FROM circle_members WHERE circle_id = $1 AND status = 'active' AND user_id != $2",
          [d.target_circle_id, userId]
        );

        for (const m of members.rows) {
          notify(m.user_id, 'circle_activity', `New ${typeLabel} in ${cName}`, `${name}: ${d.title}`, 'circle', d.target_circle_id);
        }
      } catch {}
    }

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[Signals POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create signal' } },
      { status: 500 }
    );
  }
}
