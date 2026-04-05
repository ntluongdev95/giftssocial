import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const result = await pgPool.query(
      `SELECT id, username, display_name, avatar_url, bio, photos, city, trust_level, trust_score, followers_count, following_count, created_at
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) return NextResponse.json({ error: { code: 'not_found', message: 'User not found' } }, { status: 404 });

    const user = result.rows[0];

    // Fetch public activity in parallel
    const [signalsRes, reviewsRes, checkinsRes] = await Promise.all([
      pgPool.query(
        `SELECT id, type, title, category, created_at FROM signals
         WHERE author_id = $1 AND visibility = 'public' AND status = 'active'
         ORDER BY created_at DESC LIMIT 10`,
        [id]
      ).catch(() => ({ rows: [] })),
      pgPool.query(
        `SELECT r.id, r.rating, r.title, r.body, r.created_at, r.verified_visit,
                b.name AS business_name, b.avatar_url AS business_avatar
         FROM reviews r LEFT JOIN businesses b ON b.id = r.business_id
         WHERE r.author_id = $1 AND r.status = 'active'
         ORDER BY r.created_at DESC LIMIT 10`,
        [id]
      ).catch(() => ({ rows: [] })),
      pgPool.query(
        `SELECT c.id, c.target_type, c.target_id, c.created_at,
                COALESCE(b.name, e.title) AS target_name
         FROM checkins c
         LEFT JOIN businesses b ON c.target_type = 'business' AND b.id = c.target_id
         LEFT JOIN events e ON c.target_type = 'event' AND e.id = c.target_id
         WHERE c.user_id = $1
         ORDER BY c.created_at DESC LIMIT 10`,
        [id]
      ).catch(() => ({ rows: [] })),
    ]);

    return NextResponse.json({
      data: {
        ...user,
        signals: signalsRes.rows,
        reviews: reviewsRes.rows,
        checkins: checkinsRes.rows,
      },
    });
  } catch (err) {
    console.error('[Users GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch user' } }, { status: 500 });
  }
}
