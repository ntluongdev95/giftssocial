import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await pgPool.query('SELECT * FROM businesses WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Business not found' } }, { status: 404 });
    }
    return NextResponse.json({ data: result.rows[0] });
  } catch (err) {
    console.error('[Business GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}
