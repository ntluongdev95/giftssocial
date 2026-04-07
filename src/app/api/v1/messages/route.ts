import { NextRequest, NextResponse } from 'next/server';
import { getDB, genId } from '@/lib/db';
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

    const db = getDB();
    const values: unknown[] = [roomType, roomId];

    let query = 'SELECT * FROM messages WHERE room_type = ? AND room_id = ?';
    if (before) {
      query += ` AND created_at < ?`;
      values.push(before);
    }
    query += ` ORDER BY created_at DESC LIMIT ?`;
    values.push(limit);

    const result = await db.prepare(query).bind(...values).all<Record<string, unknown>>();
    return NextResponse.json({ data: result.results.reverse() });
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

    const db = getDB();

    // Get sender info
    const user = await db.prepare('SELECT display_name, avatar_url FROM users WHERE id = ?').bind(userId).first<{ display_name: string; avatar_url: string | null }>();

    const msgId = genId('msg_');
    const row = await db.prepare(
      `INSERT INTO messages (id, room_type, room_id, sender_id, sender_name, sender_avatar, body)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    ).bind(msgId, room_type || 'event', room_id, userId, user?.display_name || 'User', user?.avatar_url || null, body.trim()).first<Record<string, unknown>>();

    // Auto-reply if host hasn't responded yet
    if (room_type === 'event' || !room_type) {
      try {
        // Get event host
        const evt = await db.prepare('SELECT host_user_id, title FROM events WHERE id = ?').bind(room_id).first<{ host_user_id: string; title: string }>();

        if (evt && evt.host_user_id !== userId) {
          // Check if host has ever replied in this room
          const hostReply = await db.prepare(
            'SELECT id FROM messages WHERE room_type = ? AND room_id = ? AND sender_id = ? LIMIT 1'
          ).bind(room_type || 'event', room_id, evt.host_user_id).first<{ id: string }>();

          if (!hostReply) {
            // Check if auto-reply already sent
            const autoReply = await db.prepare(
              "SELECT id FROM messages WHERE room_type = ? AND room_id = ? AND sender_id = 'system_auto' LIMIT 1"
            ).bind(room_type || 'event', room_id).first<{ id: string }>();

            if (!autoReply) {
              // Send auto-reply
              const autoId = genId('msg_');
              await db.prepare(
                `INSERT INTO messages (id, room_type, room_id, sender_id, sender_name, sender_avatar, body)
                 VALUES (?, ?, ?, 'system_auto', ?, NULL, ?)`
              ).bind(
                autoId,
                room_type || 'event',
                room_id,
                evt.title || 'Event Host',
                `Thank you for your interest! 🎉 The event host will respond shortly. In the meantime, feel free to check the event details and invite your friends!`,
              ).run();
            }
          }
        }
      } catch {}
    }

    // Create notification for other participants in the room
    try {
      // Find all unique senders in this room (except current user)
      const participants = await db.prepare(
        `SELECT DISTINCT sender_id FROM messages WHERE room_type = ? AND room_id = ? AND sender_id != ? AND sender_id != 'system_auto'`
      ).bind(room_type || 'event', room_id, userId).all<{ sender_id: string }>();

      // Also notify the other party
      let ownerId: string | null = null;
      if (room_type === 'dm') {
        if (room_id.startsWith('dm_')) {
          const dmParts = room_id.replace('dm_', '').split('_');
          ownerId = dmParts.find((id: string) => id !== userId) || dmParts[0] || null;
        } else {
          const sigRes = await db.prepare('SELECT author_id FROM signals WHERE id = ?').bind(room_id).first<{ author_id: string }>();
          ownerId = sigRes?.author_id || null;
        }
      } else if (room_type === 'event') {
        const evtRes = await db.prepare('SELECT host_user_id FROM events WHERE id = ?').bind(room_id).first<{ host_user_id: string }>();
        ownerId = evtRes?.host_user_id || null;
      }

      const notifyIds = new Set(participants.results.map((r) => r.sender_id));
      if (ownerId && ownerId !== userId) notifyIds.add(ownerId);

      for (const targetId of notifyIds) {
        // Check for existing unread notification for this room
        const existing = await db.prepare(
          `SELECT id FROM notifications WHERE user_id = ? AND type = 'new_message' AND ref_id = ? AND read = 0 LIMIT 1`
        ).bind(targetId, room_id).first<{ id: string }>();

        if (existing) {
          // Update existing — show latest message
          await db.prepare(
            `UPDATE notifications SET title = ?, body = ?, created_at = datetime('now') WHERE id = ?`
          ).bind(`New message from ${user?.display_name || 'Someone'}`, body.trim().slice(0, 100), existing.id).run().catch(() => {});
        } else {
          // Create new
          const notifId = genId('notif_');
          await db.prepare(
            `INSERT INTO notifications (id, user_id, type, title, body, ref_type, ref_id)
             VALUES (?, ?, 'new_message', ?, ?, ?, ?)`
          ).bind(notifId, targetId, `New message from ${user?.display_name || 'Someone'}`, body.trim().slice(0, 100), room_type || 'event', room_id).run().catch(() => {});
        }
      }
    } catch (err) { console.error('[Messages] notify block error:', err); }

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    console.error('[Messages POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to send message' } }, { status: 500 });
  }
}
