import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// GET /api/v1/messages/conversations?signal_id=xxx
// Returns list of unique users who messaged about a signal (for signal owner)
export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const { searchParams } = req.nextUrl;
    const signalId = searchParams.get('signal_id');

    if (!signalId) return NextResponse.json({ error: { code: 'invalid_request', message: 'signal_id required' } }, { status: 400 });

    // Get distinct conversations for this signal's DM rooms
    // room_id format: signal_id:user_id
    const result = await pgPool.query(
      `SELECT DISTINCT ON (m.room_id)
        m.room_id,
        m.sender_name,
        m.body AS last_message,
        m.created_at AS last_message_at,
        (SELECT COUNT(*)::int FROM messages m2 WHERE m2.room_id = m.room_id AND m2.room_type = 'dm') AS message_count
       FROM messages m
       WHERE m.room_type = 'dm' AND m.room_id LIKE $1
         AND m.sender_id != $2
       ORDER BY m.room_id, m.created_at DESC`,
      [`${signalId}:%`, userId]
    );

    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error('[Conversations GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch conversations' } }, { status: 500 });
  }
}
