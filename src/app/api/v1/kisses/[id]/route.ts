import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { redis } from '@/lib/db';

/**
 * GET /api/v1/kisses/:id — Public: get a single kiss for share/replay
 * Cached in Redis for 1 hour to handle viral sharing.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Check Redis cache first
    try {
      const cached = await redis.get(`kiss:${id}`);
      if (cached) {
        const data = JSON.parse(cached);
        if (data._private) return NextResponse.json({ error: { code: 'private', message: 'This kiss is private' } }, { status: 403 });
        return NextResponse.json({ data }, {
          headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' },
        });
      }
    } catch { /* Redis down, continue to DB */ }

    const result = await pgPool.query(
      `SELECT k.*,
        s.display_name AS sender_name, s.avatar_url AS sender_avatar,
        r.display_name AS receiver_name, r.avatar_url AS receiver_avatar
       FROM kisses k
       LEFT JOIN users s ON s.id = k.sender_id
       LEFT JOIN users r ON r.id = k.receiver_id
       WHERE k.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Kiss not found' } }, { status: 404 });
    }

    const kiss = result.rows[0];

    if (kiss.visibility === 'private') {
      // Cache private flag too (avoid repeated DB hits)
      redis.setex(`kiss:${id}`, 3600, JSON.stringify({ _private: true })).catch(() => {});
      return NextResponse.json({ error: { code: 'private', message: 'This kiss is private' } }, { status: 403 });
    }

    // Cache for 1 hour
    redis.setex(`kiss:${id}`, 3600, JSON.stringify(kiss)).catch(() => {});

    return NextResponse.json({ data: kiss }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('[Kiss GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}
