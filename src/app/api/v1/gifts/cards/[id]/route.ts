import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

// GET /api/v1/gifts/cards/[id]
//
// Fetch a public Gao Gift card. No auth required — this is the endpoint
// backing /gifts/card/{id} viewer + it also handles view-count bumps for
// viral analytics. The bump is fire-and-forget so a slow write never
// blocks the fetch.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9]{6,16}$/.test(id)) {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }

  const db = getDB();
  try {
    const row = await db
      .prepare(
        `SELECT id, kind, data_json, photo_url, creator_id, view_count, created_at
         FROM public_gift_cards
         WHERE id = ? LIMIT 1`,
      )
      .bind(id)
      .first<{
        id: string;
        kind: string;
        data_json: string;
        photo_url: string | null;
        creator_id: string | null;
        view_count: number;
        created_at: string;
      }>();
    if (!row) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }

    // View-count bump — best-effort. If the increment silently fails
    // (e.g. transient D1 hiccup) the fetch still succeeds. We rate-cap
    // silently: the same viewer refreshing 100× won't inflate too much
    // because we only count 1 per request (view_count is a raw counter,
    // not deduplicated by IP — good enough for MVP virality signal).
    db.prepare('UPDATE public_gift_cards SET view_count = view_count + 1 WHERE id = ?')
      .bind(id)
      .run()
      .catch(() => { /* ignore */ });

    let data: Record<string, unknown> = {};
    try { data = JSON.parse(row.data_json); } catch { /* corrupt row → return raw */ }

    return NextResponse.json({
      data: {
        id: row.id,
        kind: row.kind,
        data,
        photo_url: row.photo_url,
        view_count: row.view_count,
        created_at: row.created_at,
      },
    });
  } catch (err) {
    console.error('[public gift card GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to load card' } },
      { status: 500 },
    );
  }
}
