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

    // Auto-reply if host hasn't responded yet
    if (room_type === 'event' || !room_type) {
      try {
        // Get event host
        const evtRes = await pgPool.query('SELECT host_user_id, title FROM events WHERE id = $1', [room_id]);
        const evt = evtRes.rows[0];

        if (evt && evt.host_user_id !== userId) {
          // Check if host has ever replied in this room
          const hostReply = await pgPool.query(
            'SELECT id FROM messages WHERE room_type = $1 AND room_id = $2 AND sender_id = $3 LIMIT 1',
            [room_type || 'event', room_id, evt.host_user_id]
          );

          if (hostReply.rows.length === 0) {
            // Check if auto-reply already sent
            const autoReply = await pgPool.query(
              "SELECT id FROM messages WHERE room_type = $1 AND room_id = $2 AND sender_id = 'system_auto' LIMIT 1",
              [room_type || 'event', room_id]
            );

            if (autoReply.rows.length === 0) {
              // Send auto-reply after short delay
              await pgPool.query(
                `INSERT INTO messages (room_type, room_id, sender_id, sender_name, sender_avatar, body)
                 VALUES ($1, $2, 'system_auto', $3, NULL, $4)`,
                [
                  room_type || 'event',
                  room_id,
                  evt.title || 'Event Host',
                  `Thank you for your interest! 🎉 The event host will respond shortly. In the meantime, feel free to check the event details and invite your friends!`,
                ]
              );
            }
          }
        }
      } catch {}
    }

    // Create notification for other participants in the room
    try {
      // Find all unique senders in this room (except current user)
      const participants = await pgPool.query(
        `SELECT DISTINCT sender_id FROM messages WHERE room_type = $1 AND room_id = $2 AND sender_id != $3 AND sender_id != 'system_auto'`,
        [room_type || 'event', room_id, userId]
      );

      // Also notify the other party
      let ownerId: string | null = null;
      console.log('[Messages] notify check:', { room_type, room_id, userId, participantCount: participants.rows.length });
      if (room_type === 'dm') {
        if (room_id.startsWith('dm_')) {
          // User-to-user DM: room_id = dm_{targetUserId}
          ownerId = room_id.replace('dm_', '');
        } else {
          // Signal DM: room_id = signal_id
          const sigRes = await pgPool.query('SELECT author_id FROM signals WHERE id = $1', [room_id]);
          ownerId = sigRes.rows[0]?.author_id || null;
        }
      } else if (room_type === 'event') {
        const evtRes2 = await pgPool.query('SELECT host_user_id FROM events WHERE id = $1', [room_id]);
        ownerId = evtRes2.rows[0]?.host_user_id || null;
      }

      const notifyIds = new Set(participants.rows.map((r: Record<string, unknown>) => r.sender_id as string));
      if (ownerId && ownerId !== userId) notifyIds.add(ownerId);

      for (const targetId of notifyIds) {
        // Check for existing unread notification for this room
        const existing = await pgPool.query(
          `SELECT id FROM notifications WHERE user_id = $1 AND type = 'new_message' AND ref_id = $2 AND read = false LIMIT 1`,
          [targetId, room_id]
        );

        if (existing.rows.length > 0) {
          // Update existing — show latest message
          await pgPool.query(
            `UPDATE notifications SET title = $1, body = $2, created_at = NOW() WHERE id = $3`,
            [`New message from ${user?.display_name || 'Someone'}`, body.trim().slice(0, 100), existing.rows[0].id]
          ).catch(() => {});
        } else {
          // Create new
          await pgPool.query(
            `INSERT INTO notifications (user_id, type, title, body, ref_type, ref_id)
             VALUES ($1, 'new_message', $2, $3, $4, $5)`,
            [targetId, `New message from ${user?.display_name || 'Someone'}`, body.trim().slice(0, 100), room_type || 'event', room_id]
          ).catch(() => {});
        }
      }
    } catch (err) { console.error('[Messages] notify block error:', err); }

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[Messages POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to send message' } }, { status: 500 });
  }
}
