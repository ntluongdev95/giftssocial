import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
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

    const result = await pgPool.query(
      `INSERT INTO saved_items (user_id, item_type, item_id, collection)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, item_type, item_id) DO NOTHING
       RETURNING id`,
      [userId, item_type, item_id, collection || 'default']
    );

    return NextResponse.json({ data: { saved: true, id: result.rows[0]?.id } }, { status: 201 });
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

    let query = 'SELECT * FROM saved_items WHERE user_id = $1';
    const values: unknown[] = [userId];

    if (itemType) {
      query += ' AND item_type = $2';
      values.push(itemType);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const result = await pgPool.query(query, values);
    return NextResponse.json({ data: result.rows });
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

    await pgPool.query(
      'DELETE FROM saved_items WHERE user_id = $1 AND item_type = $2 AND item_id = $3',
      [userId, item_type, item_id]
    );

    return NextResponse.json({ data: { saved: false } });
  } catch (err) {
    console.error('[Saved DELETE]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to unsave' } }, { status: 500 });
  }
}
