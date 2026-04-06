import { NextRequest, NextResponse } from 'next/server';
import { getDB, parseRow } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDB();
    const row = await db.prepare('SELECT * FROM businesses WHERE id = ?').bind(id).first<Record<string, unknown>>();
    if (!row) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Business not found' } }, { status: 404 });
    }
    return NextResponse.json({ data: parseRow(row) });
  } catch (err) {
    console.error('[Business GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}
