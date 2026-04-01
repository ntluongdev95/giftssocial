import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const result = await pgPool.query(
      `SELECT * FROM events
       WHERE circle_id = $1 AND status IN ('scheduled', 'live') AND start_time > NOW()
       ORDER BY start_time ASC LIMIT 20`,
      [id]
    );

    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error('[Circle Events GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch circle events' } }, { status: 500 });
  }
}
