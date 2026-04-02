import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// GET /api/v1/messages?room_type=event&room_id=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const roomType = searchParams.get('room_type') || 'event';
    const roomId = searchParams.get('room_id');
    const before = searchParams.get('before'); // cursor for pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    if (!roomId) return NextResponse.json({ error: { code: 'invalid_request', message: 'room_id required' } }, { status: 400 });

    let query = 'SELECT * FROM messages WHERE room_type = $1 AND room_id = $2';
    const values: unknown[] = [roomType, roomId];
    let idx = 3;

    if (before) {
      query += ` AND created_at < $${idx++}`;
      values.push(before);
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx}`;
    values.push(limit);

    const result = await pgPool.query(query, values);
    return NextResponse.json({ data: result.rows.reverse() });
  } catch (err) {
    console.error('[Messages GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch messages' } }, { status: 500 });
  }
}

// POST /api/v1/messages
export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const { room_type, room_id, body } = await req.json();

    if (!room_id || !body?.trim()) {
      return NextResponse.json({ error: { code: 'invalid_request', message: 'room_id and body required' } }, { status: 400 });
    }

    // Get sender info
    const userRes = await pgPool.query('SELECT display_name, avatar_url FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];

    const result = await pgPool.query(
      `INSERT INTO messages (room_type, room_id, sender_id, sender_name, sender_avatar, body)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [room_type || 'event', room_id, userId, user?.display_name || 'User', user?.avatar_url || null, body.trim()]
    );

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[Messages POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to send message' } }, { status: 500 });
  }
}
