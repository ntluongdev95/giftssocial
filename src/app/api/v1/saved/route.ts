import { NextRequest, NextResponse } from 'next/server';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── POST /api/v1/saved — Save an item ──────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });
    }

    const { item_type, item_id, collection } = await req.json();

    if (!item_type || !item_id) {
      return NextResponse.json({ error: { code: 'invalid_request', message: 'item_type and item_id required' } }, { status: 400 });
    }

    const db = getDB();

    // Check if already saved
    const existing = await db.prepare(
      'SELECT id FROM saved_items WHERE user_id = ? AND item_type = ? AND item_id = ?'
    ).bind(userId, item_type, item_id).first<{ id: string }>();

    if (existing) {
      return NextResponse.json({ data: { saved: true, id: existing.id } }, { status: 201 });
    }

    const id = genId('sav_');
    await db.prepare(
      `INSERT INTO saved_items (id, user_id, item_type, item_id, collection) VALUES (?, ?, ?, ?, ?)`
    ).bind(id, userId, item_type, item_id, collection || 'default').run();

    return NextResponse.json({ data: { saved: true, id } }, { status: 201 });
  } catch (err) {
    console.error('[Saved POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to save' } }, { status: 500 });
  }
}

// ─── GET /api/v1/saved — List my saved items ─────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ data: [] });
    }

    const { searchParams } = req.nextUrl;
    const itemType = searchParams.get('type');
    const db = getDB();

    if (itemType) {
      const result = await db.prepare(
        `SELECT s.*,
          e.title AS event_title, e.start_time AS event_start_time, e.city AS event_city,
          b.name AS business_name, b.category AS business_category, b.city AS business_city
         FROM saved_items s
         LEFT JOIN events e ON s.item_type = 'event' AND s.item_id = e.id
         LEFT JOIN businesses b ON s.item_type = 'business' AND s.item_id = b.id
         WHERE s.user_id = ? AND s.item_type = ?
         ORDER BY s.created_at DESC LIMIT 50`
      ).bind(userId, itemType).all<Record<string, unknown>>();
      return NextResponse.json({ data: result.results });
    } else {
      const result = await db.prepare(
        `SELECT s.*,
          e.title AS event_title, e.start_time AS event_start_time, e.city AS event_city,
          b.name AS business_name, b.category AS business_category, b.city AS business_city
         FROM saved_items s
         LEFT JOIN events e ON s.item_type = 'event' AND s.item_id = e.id
         LEFT JOIN businesses b ON s.item_type = 'business' AND s.item_id = b.id
         WHERE s.user_id = ?
         ORDER BY s.created_at DESC LIMIT 50`
      ).bind(userId).all<Record<string, unknown>>();
      return NextResponse.json({ data: result.results });
    }
  } catch (err) {
    console.error('[Saved GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch saved items' } }, { status: 500 });
  }
}

// ─── DELETE /api/v1/saved — Unsave an item ───────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });
    }

    const { item_type, item_id } = await req.json();

    const db = getDB();
    await db.prepare(
      'DELETE FROM saved_items WHERE user_id = ? AND item_type = ? AND item_id = ?'
    ).bind(userId, item_type, item_id).run();

    return NextResponse.json({ data: { saved: false } });
  } catch (err) {
    console.error('[Saved DELETE]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to unsave' } }, { status: 500 });
  }
}
