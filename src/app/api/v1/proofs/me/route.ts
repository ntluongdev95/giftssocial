import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ data: [] });

    const result = await pgPool.query(
      'SELECT * FROM proofs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [userId]
    );

    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error('[Proofs Me GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}
