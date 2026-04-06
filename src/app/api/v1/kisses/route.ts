import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';

// ─── GET /api/v1/kisses — List public kisses (for globe) ───────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const mine = searchParams.get('mine') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const userId = await resolveUserId(req).catch(() => null);

    const db = getDB();

    if (mine && userId) {
      // My kisses (sent + received) — only within 24h or already opened
      const result = await db.prepare(
        `SELECT k.*,
          s.display_name AS sender_name, s.avatar_url AS sender_avatar,
          r.display_name AS receiver_name, r.avatar_url AS receiver_avatar
         FROM kisses k
         LEFT JOIN users s ON s.id = k.sender_id
         LEFT JOIN users r ON r.id = k.receiver_id
         WHERE (k.sender_id = ? OR k.receiver_id = ?)
           AND (k.opened = 1 OR k.created_at > datetime('now', '-1 day'))
         ORDER BY k.created_at DESC LIMIT ?`
      ).bind(userId, userId, limit).all<Record<string, unknown>>();
      return NextResponse.json({ data: result.results });
    } else if (userId) {
      // Public kisses + my private kisses — hide expired unopened
      const result = await db.prepare(
        `SELECT k.*,
          s.display_name AS sender_name, s.avatar_url AS sender_avatar,
          r.display_name AS receiver_name, r.avatar_url AS receiver_avatar
         FROM kisses k
         LEFT JOIN users s ON s.id = k.sender_id
         LEFT JOIN users r ON r.id = k.receiver_id
         WHERE k.created_at > datetime('now', '-7 days')
           AND (k.opened = 1 OR k.created_at > datetime('now', '-1 day'))
           AND (k.visibility = 'public' OR k.sender_id = ? OR k.receiver_id = ?)
         ORDER BY k.created_at DESC LIMIT ?`
      ).bind(userId, userId, limit).all<Record<string, unknown>>();
      return NextResponse.json({ data: result.results });
    } else {
      // Not logged in — public only, hide expired
      const result = await db.prepare(
        `SELECT k.*,
          s.display_name AS sender_name, s.avatar_url AS sender_avatar,
          r.display_name AS receiver_name, r.avatar_url AS receiver_avatar
         FROM kisses k
         LEFT JOIN users s ON s.id = k.sender_id
         LEFT JOIN users r ON r.id = k.receiver_id
         WHERE k.visibility = 'public'
           AND (k.opened = 1 OR k.created_at > datetime('now', '-1 day'))
           AND k.created_at > datetime('now', '-7 days')
         ORDER BY k.created_at DESC LIMIT ?`
      ).bind(limit).all<Record<string, unknown>>();
      return NextResponse.json({ data: result.results });
    }
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
  kiss_type: z.enum(['kiss', 'declaration']).default('kiss'),
  receiver_lat: z.number().optional(),
  receiver_lng: z.number().optional(),
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

    const db = getDB();

    // Get sender location
    const sender = await db.prepare('SELECT display_name, location_lat, location_lng FROM users WHERE id = ?').bind(userId).first<{ display_name: string; location_lat: number | null; location_lng: number | null }>();
    if (!sender?.location_lat) return NextResponse.json({ error: { code: 'no_location', message: 'Please enable location sharing in your profile first' } }, { status: 400 });

    // Get receiver info (location optional — kiss still sent)
    const receiver = await db.prepare('SELECT display_name, location_lat, location_lng FROM users WHERE id = ?').bind(d.receiver_id).first<{ display_name: string; location_lat: number | null; location_lng: number | null }>();
    if (!receiver) return NextResponse.json({ error: { code: 'not_found', message: 'User not found' } }, { status: 404 });

    const receiverHasLocation = !!receiver.location_lat;
    const senderProvidedAddress = !!(d.receiver_lat && d.receiver_lng);
    const hasValidDestination = receiverHasLocation || senderProvidedAddress;

    // If no valid destination, store 0 so frontend knows not to animate
    const recLat = hasValidDestination ? (d.receiver_lat || receiver.location_lat) : 0;
    const recLng = hasValidDestination ? (d.receiver_lng || receiver.location_lng) : 0;

    const id = genId('kiss_');
    const row = await db.prepare(
      `INSERT INTO kisses (id, sender_id, receiver_id, message, emoji, visibility, kiss_type, sender_lat, sender_lng, receiver_lat, receiver_lng)
       VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING *`
    ).bind(id, userId, d.receiver_id, d.message, d.emoji, d.visibility, d.kiss_type,
      sender.location_lat, sender.location_lng, recLat, recLng).first<Record<string, unknown>>();

    // Notify receiver
    const senderName = sender.display_name || 'Someone';
    const isDeclaration = d.kiss_type === 'declaration';
    if (isDeclaration) {
      notify(d.receiver_id, 'system', `🌍❤️ ${senderName} declared love to you!`, 'The whole world can see it! Open to watch 🌏✨', 'kiss', id);
    } else if (hasValidDestination) {
      notify(d.receiver_id, 'system', `${d.emoji} ${senderName} sent you a kiss!`, 'Open it on the map 🎁✨', 'kiss', id);
    } else {
      notify(d.receiver_id, 'system', `${d.emoji} ${senderName} sent you a kiss!`, 'Tap here to share your location and see it fly to you! 📍✈️', 'kiss', id);
    }

    return NextResponse.json({ data: row }, { status: 201 });
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

    const db = getDB();

    // Check kiss exists and belongs to receiver
    const kiss = await db.prepare(
      'SELECT * FROM kisses WHERE id = ? AND receiver_id = ?'
    ).bind(id, userId).first<Record<string, unknown>>();

    if (!kiss) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Kiss not found' } }, { status: 404 });
    }

    // Check 24h expiry
    const createdAt = new Date(kiss.created_at as string).getTime();
    const hoursElapsed = (Date.now() - createdAt) / (1000 * 60 * 60);
    if (hoursElapsed > 24) {
      return NextResponse.json({ error: { code: 'expired', message: 'This kiss has expired (24h limit)' } }, { status: 410 });
    }

    // Update: set opened + optionally update receiver coords
    const updates: string[] = ['opened = 1', "opened_at = datetime('now')"];
    const values: unknown[] = [];

    if (receiver_lat && receiver_lng) {
      updates.push(`receiver_lat = ?`, `receiver_lng = ?`);
      values.push(receiver_lat, receiver_lng);
    }

    values.push(id, userId);
    const row = await db.prepare(
      `UPDATE kisses SET ${updates.join(', ')} WHERE id = ? AND receiver_id = ? RETURNING *`
    ).bind(...values).first();

    return NextResponse.json({ data: row });
  } catch (err) {
    console.error('[Kisses PATCH]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed' } }, { status: 500 });
  }
}
