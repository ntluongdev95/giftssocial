import { NextRequest, NextResponse } from 'next/server';
import { getDB, genId } from '@/lib/db';
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

    const db = getDB();

    // Check if already following to avoid duplicate
    const existing = await db.prepare(
      'SELECT id FROM follows WHERE follower_id = ? AND following_user_id IS ? AND following_business_id IS ? AND following_circle_id IS ?'
    ).bind(userId, user_id || null, business_id || null, circle_id || null).first<{ id: string }>();

    if (!existing) {
      const id = genId('fol_');
      await db.prepare(
        `INSERT INTO follows (id, follower_id, following_user_id, following_business_id, following_circle_id)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(id, userId, user_id || null, business_id || null, circle_id || null).run();

      // Update counts
      if (user_id) {
        await db.prepare('UPDATE users SET followers_count = followers_count + 1 WHERE id = ?').bind(user_id).run().catch(() => {});
        await db.prepare('UPDATE users SET following_count = following_count + 1 WHERE id = ?').bind(userId).run().catch(() => {});
        notify(user_id, 'follow_new', 'New follower!', 'Someone started following you', 'user', userId);
      }
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

    const db = getDB();
    let result;

    if (user_id) {
      result = await db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_user_id = ?').bind(userId, user_id).run();
    } else if (business_id) {
      result = await db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_business_id = ?').bind(userId, business_id).run();
    } else if (circle_id) {
      result = await db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_circle_id = ?').bind(userId, circle_id).run();
    } else {
      return NextResponse.json({ error: { code: 'invalid_request' } }, { status: 400 });
    }

    if (((result.meta?.changes as number | undefined) ?? 0) > 0 && user_id) {
      await db.prepare('UPDATE users SET followers_count = MAX(followers_count - 1, 0) WHERE id = ?').bind(user_id).run().catch(() => {});
      await db.prepare('UPDATE users SET following_count = MAX(following_count - 1, 0) WHERE id = ?').bind(userId).run().catch(() => {});
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
    const db = getDB();

    if (type === 'followers') {
      const result = await db.prepare(
        `SELECT f.*, u.username, u.display_name, u.avatar_url, u.bio, u.trust_level
         FROM follows f LEFT JOIN users u ON u.id = f.follower_id
         WHERE f.following_user_id = ? ORDER BY f.created_at DESC LIMIT 100`
      ).bind(userId).all<Record<string, unknown>>();
      return NextResponse.json({ data: result.results });
    } else {
      const result = await db.prepare(
        `SELECT f.*, u.username AS user_username, u.display_name AS user_name, u.avatar_url AS user_avatar, u.bio AS user_bio,
                b.name AS biz_name, b.category AS biz_category,
                c.name AS circle_name, c.category AS circle_category
         FROM follows f
         LEFT JOIN users u ON u.id = f.following_user_id
         LEFT JOIN businesses b ON b.id = f.following_business_id
         LEFT JOIN circles c ON c.id = f.following_circle_id
         WHERE f.follower_id = ? ORDER BY f.created_at DESC LIMIT 100`
      ).bind(userId).all<Record<string, unknown>>();
      return NextResponse.json({ data: result.results });
    }
  } catch (err) {
    console.error('[Follows GET]', err);
    return NextResponse.json({ error: { code: 'internal_error' } }, { status: 500 });
  }
}
