import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';

// ─── GET /api/v1/kisses — List public kisses (for globe) ───────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const mine = searchParams.get('mine') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const userId = await resolveUserId(req).catch(() => null);

    let query: string;
    let values: unknown[];

    if (mine && userId) {
      // My kisses (sent + received)
      query = `SELECT k.*,
        s.display_name AS sender_name, s.avatar_url AS sender_avatar,
        r.display_name AS receiver_name, r.avatar_url AS receiver_avatar
       FROM kisses k
       LEFT JOIN users s ON s.id = k.sender_id
       LEFT JOIN users r ON r.id = k.receiver_id
       WHERE k.sender_id = $1 OR k.receiver_id = $1
       ORDER BY k.created_at DESC LIMIT $2`;
      values = [userId, limit];
    } else if (userId) {
      // Public kisses + my private kisses
      query = `SELECT k.*,
        s.display_name AS sender_name, s.avatar_url AS sender_avatar,
        r.display_name AS receiver_name, r.avatar_url AS receiver_avatar
       FROM kisses k
       LEFT JOIN users s ON s.id = k.sender_id
       LEFT JOIN users r ON r.id = k.receiver_id
       WHERE k.created_at > NOW() - INTERVAL '7 days'
         AND (k.visibility = 'public' OR k.sender_id = $1 OR k.receiver_id = $1)
       ORDER BY k.created_at DESC LIMIT $2`;
      values = [userId, limit];
    } else {
      // Not logged in — public only
      query = `SELECT k.*,
        s.display_name AS sender_name, s.avatar_url AS sender_avatar,
        r.display_name AS receiver_name, r.avatar_url AS receiver_avatar
       FROM kisses k
       LEFT JOIN users s ON s.id = k.sender_id
       LEFT JOIN users r ON r.id = k.receiver_id
       WHERE k.visibility = 'public' AND k.created_at > NOW() - INTERVAL '7 days'
       ORDER BY k.created_at DESC LIMIT $1`;
      values = [limit];
    }

    const result = await pgPool.query(query, values);
    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error('[Kisses GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}

// ─── POST /api/v1/kisses — Send a kiss ──────────────────────────────────

const kissSchema = z.object({
  receiver_id: z.string().min(1),
  message: z.string().max(200).default(''),
  emoji: z.string().max(10).default('💋'),
  visibility: z.enum(['public', 'private']).default('public'),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const body = await req.json();
    const parsed = kissSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: { code: 'invalid_request', message: parsed.error.issues[0].message } }, { status: 400 });

    const d = parsed.data;

    if (d.receiver_id === userId) return NextResponse.json({ error: { code: 'invalid_request', message: "Can't send a kiss to yourself" } }, { status: 400 });

    // Get sender location
    const sender = await pgPool.query('SELECT display_name, location_lat, location_lng FROM users WHERE id = $1', [userId]);
    if (!sender.rows[0]?.location_lat) return NextResponse.json({ error: { code: 'no_location', message: 'Please enable location sharing in your profile first' } }, { status: 400 });

    // Get receiver location
    const receiver = await pgPool.query('SELECT display_name, location_lat, location_lng FROM users WHERE id = $1', [d.receiver_id]);
    if (!receiver.rows[0]) return NextResponse.json({ error: { code: 'not_found', message: 'User not found' } }, { status: 404 });
    if (!receiver.rows[0].location_lat) return NextResponse.json({ error: { code: 'no_location', message: `${receiver.rows[0].display_name || 'This user'} hasn't shared their location yet` } }, { status: 400 });

    const result = await pgPool.query(
      `INSERT INTO kisses (sender_id, receiver_id, message, emoji, visibility, sender_lat, sender_lng, receiver_lat, receiver_lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [userId, d.receiver_id, d.message, d.emoji, d.visibility,
       sender.rows[0].location_lat, sender.rows[0].location_lng,
       receiver.rows[0].location_lat, receiver.rows[0].location_lng]
    );

    // Notify receiver
    const senderName = sender.rows[0].display_name || 'Someone';
    notify(d.receiver_id, 'system', `${d.emoji} ${senderName} sent you a kiss!`, 'A top-secret surprise is waiting for you! Open it on the map 🎁✨', 'kiss', result.rows[0].id);

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[Kisses POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to send kiss' } }, { status: 500 });
  }
}

// ─── PATCH /api/v1/kisses — Open a kiss ─────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

    const { id } = await req.json();
    const result = await pgPool.query(
      "UPDATE kisses SET opened = true, opened_at = NOW() WHERE id = $1 AND receiver_id = $2 AND opened = false RETURNING *",
      [id, userId]
    );

    if (result.rows.length === 0) return NextResponse.json({ error: { code: 'not_found', message: 'Kiss not found or already opened' } }, { status: 404 });

    return NextResponse.json({ data: result.rows[0] });
  } catch (err) {
    console.error('[Kisses PATCH]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed' } }, { status: 500 });
  }
}
