import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ data: null });

    const result = await pgPool.query('SELECT * FROM businesses WHERE owner_user_id = $1', [userId]);
    return NextResponse.json({ data: result.rows[0] || null });
  } catch (err) {
    console.error('[Business Me GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}
