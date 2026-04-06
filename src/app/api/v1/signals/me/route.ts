import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/signals/me — My signals ─────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ data: [] });
    }

    const db = getDB();
    const result = await db.prepare(
      `SELECT * FROM signals WHERE author_id = ? AND status != 'hidden' ORDER BY created_at DESC LIMIT 50`
    ).bind(userId).all<Record<string, unknown>>();

    const data = result.results.map(r => ({
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
