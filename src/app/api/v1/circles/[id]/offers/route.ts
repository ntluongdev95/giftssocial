import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDB();

    const result = await db.prepare(
      `SELECT * FROM signals
       WHERE target_circle_id = ? AND type = 'offer' AND status = 'active' AND expires_at > datetime('now')
       ORDER BY created_at DESC LIMIT 20`
    ).bind(id).all<Record<string, unknown>>();

    return NextResponse.json({ data: result.results });
  } catch (err) {
    console.error('[Circle Offers GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch circle offers' } }, { status: 500 });
  }
}
