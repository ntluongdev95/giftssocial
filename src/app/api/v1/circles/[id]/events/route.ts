import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDB();

    const result = await db.prepare(
      `SELECT * FROM events
       WHERE circle_id = ? AND status IN ('scheduled', 'live') AND start_time > datetime('now')
       ORDER BY start_time ASC LIMIT 20`
    ).bind(id).all<Record<string, unknown>>();

    return NextResponse.json({ data: result.results });
  } catch (err) {
    console.error('[Circle Events GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch circle events' } }, { status: 500 });
  }
}
