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
      // My kisses (sent + received) — only within 24h or already opened
      query = `SELECT k.*,
        s.display_name AS sender_name, s.avatar_url AS sender_avatar,
        r.display_name AS receiver_name, r.avatar_url AS receiver_avatar
       FROM kisses k
       LEFT JOIN users s ON s.id = k.sender_id
       LEFT JOIN users r ON r.id = k.receiver_id
       WHERE (k.sender_id = $1 OR k.receiver_id = $1)
         AND (k.opened = true OR k.created_at > NOW() - INTERVAL '24 hours')
       ORDER BY k.created_at DESC LIMIT $2`;
      values = [userId, limit];
    } else if (userId) {
      // Public kisses + my private kisses — hide expired unopened
      query = `SELECT k.*,
        s.display_name AS sender_name, s.avatar_url AS sender_avatar,
        r.display_name AS receiver_name, r.avatar_url AS receiver_avatar
       FROM kisses k
       LEFT JOIN users s ON s.id = k.sender_id
       LEFT JOIN users r ON r.id = k.receiver_id
       WHERE k.created_at > NOW() - INTERVAL '7 days'
         AND (k.opened = true OR k.created_at > NOW() - INTERVAL '24 hours')
         AND (k.visibility = 'public' OR k.sender_id = $1 OR k.receiver_id = $1)
       ORDER BY k.created_at DESC LIMIT $2`;
      values = [userId, limit];
    } else {
      // Not logged in — public only, hide expired
      query = `SELECT k.*,
        s.display_name AS sender_name, s.avatar_url AS sender_avatar,
        r.display_name AS receiver_name, r.avatar_url AS receiver_avatar
       FROM kisses k
       LEFT JOIN users s ON s.id = k.sender_id
       LEFT JOIN users r ON r.id = k.receiver_id
       WHERE k.visibility = 'public'
         AND (k.opened = true OR k.created_at > NOW() - INTERVAL '24 hours')
         AND k.created_at > NOW() - INTERVAL '7 days'
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

    // Get receiver info (location optional — kiss still sent)
    const receiver = await pgPool.query('SELECT display_name, location_lat, location_lng FROM users WHERE id = $1', [d.receiver_id]);
    if (!receiver.rows[0]) return NextResponse.json({ error: { code: 'not_found', message: 'User not found' } }, { status: 404 });

    const receiverHasLocation = !!receiver.rows[0].location_lat;

    // If receiver has no location, use sender location as placeholder (will be updated when receiver shares location)
    const recLat = receiver.rows[0].location_lat || sender.rows[0].location_lat;
    const recLng = receiver.rows[0].location_lng || sender.rows[0].location_lng;

    const result = await pgPool.query(
      `INSERT INTO kisses (sender_id, receiver_id, message, emoji, visibility, sender_lat, sender_lng, receiver_lat, receiver_lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [userId, d.receiver_id, d.message, d.emoji, d.visibility,
       sender.rows[0].location_lat, sender.rows[0].location_lng, recLat, recLng]
    );

    // Notify receiver
    const senderName = sender.rows[0].display_name || 'Someone';
    if (receiverHasLocation) {
      notify(d.receiver_id, 'system', `${d.emoji} ${senderName} sent you a kiss!`, 'Open it on the map 🎁✨', 'kiss', result.rows[0].id);
    } else {
      notify(d.receiver_id, 'system', `${d.emoji} ${senderName} sent you a kiss!`, 'Tap here to share your location and see it fly to you! 📍✈️', 'kiss', result.rows[0].id);
    }

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[Kisses POST]', err);
    const msg = err instanceof Error ? err.message : 'Failed to send kiss';
    return NextResponse.json({ error: { code: 'internal_error', message: msg } }, { status: 500 });
  }
}

// ─── PATCH /api/v1/kisses — Open a kiss ─────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

    const body = await req.json();
    const { id, receiver_lat, receiver_lng } = body;

    // Check kiss exists and belongs to receiver
    const kiss = await pgPool.query(
      'SELECT * FROM kisses WHERE id = $1 AND receiver_id = $2',
      [id, userId]
    );

    if (kiss.rows.length === 0) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Kiss not found' } }, { status: 404 });
    }

    // Check 24h expiry
    const createdAt = new Date(kiss.rows[0].created_at).getTime();
    const hoursElapsed = (Date.now() - createdAt) / (1000 * 60 * 60);
    if (hoursElapsed > 24) {
      return NextResponse.json({ error: { code: 'expired', message: 'This kiss has expired (24h limit)' } }, { status: 410 });
    }

    // Update: set opened + optionally update receiver coords
    const updates = ['opened = true', 'opened_at = NOW()'];
    const values: unknown[] = [id, userId];
    let idx = 3;

    if (receiver_lat && receiver_lng) {
      updates.push(`receiver_lat = $${idx++}`, `receiver_lng = $${idx++}`);
      values.push(receiver_lat, receiver_lng);
    }

    const result = await pgPool.query(
      `UPDATE kisses SET ${updates.join(', ')} WHERE id = $1 AND receiver_id = $2 RETURNING *`,
      values
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (err) {
    console.error('[Kisses PATCH]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed' } }, { status: 500 });
  }
}
