import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// DELETE /api/v1/users/me/location-shares/:recipient_id
// Removes a user from the caller's specific-share list. Always returns
// 200 — re-deleting a missing row is fine.

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ recipient_id: string }> },
) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });
    }

    const { recipient_id } = await params;
    if (!recipient_id) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'recipient_id is required' } },
        { status: 400 },
      );
    }

    const db = getDB();
    await db
      .prepare(
        `DELETE FROM location_specific_shares
         WHERE user_id = ? AND recipient_user_id = ?`,
      )
      .bind(userId, recipient_id)
      .run();

    return NextResponse.json({ data: { removed: true } });
  } catch (err) {
    console.error('[LocationShares DELETE]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to remove share' } },
      { status: 500 },
    );
  }
}
