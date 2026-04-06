import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';

/**
 * GET /api/v1/kisses/:id — Public: get a single kiss for share/replay
 * Only returns public kisses, or private kisses if the requester is sender/receiver.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const result = await pgPool.query(
      `SELECT k.*,
        s.display_name AS sender_name, s.avatar_url AS sender_avatar,
        r.display_name AS receiver_name, r.avatar_url AS receiver_avatar
       FROM kisses k
       LEFT JOIN users s ON s.id = k.sender_id
       LEFT JOIN users r ON r.id = k.receiver_id
       WHERE k.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Kiss not found' } }, { status: 404 });
    }

    const kiss = result.rows[0];

    // Private kisses: don't expose to public
    if (kiss.visibility === 'private') {
      return NextResponse.json({ error: { code: 'private', message: 'This kiss is private' } }, { status: 403 });
    }

    return NextResponse.json({ data: kiss });
  } catch (err) {
    console.error('[Kiss GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}
