import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const result = await pgPool.query(
      `SELECT * FROM signals
       WHERE target_circle_id = $1 AND type = 'offer' AND status = 'active' AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 20`,
      [id]
    );

    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error('[Circle Offers GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch circle offers' } }, { status: 500 });
  }
}
