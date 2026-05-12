import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/users/me/location-shares ─────────────────────────────────
// Returns the list of users the caller has hand-picked to see their
// location on the map. Used by the "Specific people" audience mode in
// the privacy panel.

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });
    }
    const db = getDB();
    const rows = await db
      .prepare(
        `SELECT u.id, u.display_name, u.username, u.avatar_url,
                lss.created_at AS shared_at
         FROM location_specific_shares lss
         JOIN users u ON u.id = lss.recipient_user_id
         WHERE lss.user_id = ?
         ORDER BY lss.created_at DESC`,
      )
      .bind(userId)
      .all<Record<string, unknown>>();
    return NextResponse.json({ data: rows.results });
  } catch (err) {
    console.error('[LocationShares GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to load shares' } },
      { status: 500 },
    );
  }
}

// ─── POST /api/v1/users/me/location-shares ────────────────────────────────
// Adds a user to the caller's specific-share list. Idempotent — re-adding
// the same recipient is a no-op (composite PK + INSERT OR IGNORE).
//
// Body: { recipient_user_id: string }

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { recipient_user_id?: string };
    const recipientId = body.recipient_user_id?.trim();
    if (!recipientId) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'recipient_user_id is required' } },
        { status: 400 },
      );
    }
    if (recipientId === userId) {
      return NextResponse.json(
        { error: { code: 'self_share', message: 'You always see your own location.' } },
        { status: 400 },
      );
    }

    const db = getDB();
    const recipient = await db
      .prepare(`SELECT id FROM users WHERE id = ? AND status = 'active' LIMIT 1`)
      .bind(recipientId)
      .first<{ id: string }>();
    if (!recipient) {
      return NextResponse.json(
        { error: { code: 'recipient_not_found', message: 'User not found' } },
        { status: 404 },
      );
    }

    await db
      .prepare(
        `INSERT OR IGNORE INTO location_specific_shares (user_id, recipient_user_id)
         VALUES (?, ?)`,
      )
      .bind(userId, recipientId)
      .run();

    return NextResponse.json({ data: { user_id: userId, recipient_user_id: recipientId } }, { status: 201 });
  } catch (err) {
    console.error('[LocationShares POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to add share' } },
      { status: 500 },
    );
  }
}
