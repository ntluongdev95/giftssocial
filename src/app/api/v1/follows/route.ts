import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';

// ─── POST /api/v1/follows — Follow user/business/circle ─────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const { user_id, business_id, circle_id } = await req.json();
    if (!user_id && !business_id && !circle_id) {
      return NextResponse.json({ error: { code: 'invalid_request', message: 'Provide user_id, business_id, or circle_id' } }, { status: 400 });
    }

    await pgPool.query(
      `INSERT INTO follows (follower_id, following_user_id, following_business_id, following_circle_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [userId, user_id || null, business_id || null, circle_id || null]
    );

    // Update counts
    if (user_id) {
      await pgPool.query('UPDATE users SET followers_count = followers_count + 1 WHERE id = $1', [user_id]).catch(() => {});
      await pgPool.query('UPDATE users SET following_count = following_count + 1 WHERE id = $1', [userId]).catch(() => {});
      notify(user_id, 'follow_new', 'New follower!', 'Someone started following you', 'user', userId);
    }

    return NextResponse.json({ data: { following: true } }, { status: 201 });
  } catch (err) {
    console.error('[Follows POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to follow' } }, { status: 500 });
  }
}

// ─── DELETE /api/v1/follows — Unfollow ───────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

    const { user_id, business_id, circle_id } = await req.json();

    let condition = 'follower_id = $1';
    const values: unknown[] = [userId];

    if (user_id) { condition += ' AND following_user_id = $2'; values.push(user_id); }
    else if (business_id) { condition += ' AND following_business_id = $2'; values.push(business_id); }
    else if (circle_id) { condition += ' AND following_circle_id = $2'; values.push(circle_id); }
    else return NextResponse.json({ error: { code: 'invalid_request' } }, { status: 400 });

    const result = await pgPool.query(`DELETE FROM follows WHERE ${condition} RETURNING id`, values);

    if (result.rows.length > 0 && user_id) {
      await pgPool.query('UPDATE users SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = $1', [user_id]).catch(() => {});
      await pgPool.query('UPDATE users SET following_count = GREATEST(following_count - 1, 0) WHERE id = $1', [userId]).catch(() => {});
    }

    return NextResponse.json({ data: { following: false } });
  } catch (err) {
    console.error('[Follows DELETE]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to unfollow' } }, { status: 500 });
  }
}

// ─── GET /api/v1/follows?type=following|followers ────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ data: [] });

    const { searchParams } = req.nextUrl;
    const type = searchParams.get('type') || 'following';

    if (type === 'followers') {
      const result = await pgPool.query(
        `SELECT f.*, u.username, u.display_name, u.avatar_url, u.trust_level
         FROM follows f LEFT JOIN users u ON u.id = f.follower_id
         WHERE f.following_user_id = $1 ORDER BY f.created_at DESC LIMIT 100`,
        [userId]
      );
      return NextResponse.json({ data: result.rows });
    } else {
      const result = await pgPool.query(
        `SELECT f.*, u.username AS user_username, u.display_name AS user_name, u.avatar_url AS user_avatar,
                b.name AS biz_name, b.category AS biz_category,
                c.name AS circle_name, c.category AS circle_category
         FROM follows f
         LEFT JOIN users u ON u.id = f.following_user_id
         LEFT JOIN businesses b ON b.id = f.following_business_id
         LEFT JOIN circles c ON c.id = f.following_circle_id
         WHERE f.follower_id = $1 ORDER BY f.created_at DESC LIMIT 100`,
        [userId]
      );
      return NextResponse.json({ data: result.rows });
    }
  } catch (err) {
    console.error('[Follows GET]', err);
    return NextResponse.json({ error: { code: 'internal_error' } }, { status: 500 });
  }
}
