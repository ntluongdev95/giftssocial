import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/signals/me — My signals ─────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ data: [] });
    }

    const result = await pgPool.query(
      `SELECT * FROM signals WHERE author_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );

    const data = result.rows.map(r => ({
      ...r,
      location: { type: 'Point', coordinates: [r.location_lng, r.location_lat] },
    }));

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[Signals Me GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch signals' } },
      { status: 500 }
    );
  }
}
