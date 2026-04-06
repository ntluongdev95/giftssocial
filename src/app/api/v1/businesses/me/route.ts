import { NextRequest, NextResponse } from 'next/server';
import { getDB, parseRow } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ data: null });

    const db = getDB();
    const row = await db.prepare('SELECT * FROM businesses WHERE owner_user_id = ?').bind(userId).first<Record<string, unknown>>();
    return NextResponse.json({ data: parseRow(row) });
  } catch (err) {
    console.error('[Business Me GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}
