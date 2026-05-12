import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDB();

    const user = await db.prepare(
      `SELECT id, username, display_name, avatar_url, bio, city, trust_level, trust_score, followers_count, following_count, location_lat, location_lng, created_at
       FROM users WHERE id = ?`
    ).bind(id).first<Record<string, unknown>>();

    if (!user) return NextResponse.json({ error: { code: 'not_found', message: 'User not found' } }, { status: 404 });

    // Fetch public activity in parallel
    const [signalsResult, reviewsResult, checkinsResult] = await Promise.all([
      db.prepare(
        `SELECT id, type, title, category, created_at FROM signals
         WHERE author_id = ? AND visibility = 'public' AND status = 'active'
         ORDER BY created_at DESC LIMIT 10`
      ).bind(id).all<Record<string, unknown>>().catch(() => ({ results: [] })),

      db.prepare(
        `SELECT r.id, r.rating, r.title, r.body, r.created_at, r.verified_visit,
                b.name AS business_name, b.cover_image AS business_avatar
         FROM reviews r LEFT JOIN businesses b ON b.id = r.business_id
         WHERE r.author_id = ? AND r.status = 'active'
         ORDER BY r.created_at DESC LIMIT 10`
      ).bind(id).all<Record<string, unknown>>().catch(() => ({ results: [] })),

      db.prepare(
        `SELECT c.id, c.target_type, c.target_id, c.created_at,
                COALESCE(b.name, e.title) AS target_name
         FROM checkins c
         LEFT JOIN businesses b ON c.target_type = 'business' AND b.id = c.target_id
         LEFT JOIN events e ON c.target_type = 'event' AND e.id = c.target_id
         WHERE c.user_id = ?
         ORDER BY c.created_at DESC LIMIT 10`
      ).bind(id).all<Record<string, unknown>>().catch(() => ({ results: [] })),
    ]);

    return NextResponse.json({
      data: {
        ...user,
        signals: signalsResult.results,
        reviews: reviewsResult.results,
        checkins: checkinsResult.results,
      },
    });
  } catch (err) {
    console.error('[Users GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch user' } }, { status: 500 });
  }
}
