import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
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

    const db = getDB();

    // Get distinct conversations for this signal's DM rooms
    // room_id format: signal_id:user_id
    // SQLite doesn't have DISTINCT ON, so use GROUP BY + subquery for last message
    const result = await db.prepare(
      `SELECT m.room_id,
        m.sender_name,
        m.body AS last_message,
        m.created_at AS last_message_at,
        (SELECT COUNT(*) FROM messages m2 WHERE m2.room_id = m.room_id AND m2.room_type = 'dm') AS message_count
       FROM messages m
       WHERE m.room_type = 'dm' AND m.room_id LIKE ?
         AND m.sender_id != ?
         AND m.created_at = (
           SELECT MAX(m3.created_at) FROM messages m3
           WHERE m3.room_id = m.room_id AND m3.room_type = 'dm'
         )
       GROUP BY m.room_id`
    ).bind(`${signalId}:%`, userId).all<Record<string, unknown>>();

    return NextResponse.json({ data: result.results });
  } catch (err) {
    console.error('[Conversations GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch conversations' } }, { status: 500 });
  }
}
