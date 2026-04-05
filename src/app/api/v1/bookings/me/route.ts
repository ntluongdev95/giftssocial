import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/bookings/me — My bookings ──────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ data: [] });

    const result = await pgPool.query(
      `SELECT b.*,
              biz.name AS business_name, biz.category AS business_category, biz.city AS business_city,
              evt.title AS event_title, evt.start_time AS event_start_time, evt.location_name AS event_location
       FROM bookings b
       LEFT JOIN businesses biz ON biz.id = b.business_id
       LEFT JOIN events evt ON evt.id = b.event_id
       WHERE b.user_id = $1 AND b.status != 'cancelled'
       ORDER BY b.created_at DESC
       LIMIT 50`,
      [userId]
    );

    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error('[Bookings Me GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch bookings' } }, { status: 500 });
  }
}
