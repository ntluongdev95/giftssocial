import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

// GET /api/v1/gifts/hearts/[id]
//
// Fetch a published 3D particle heart. Rows live in public_gift_cards
// where kind='heart_3d'. 404 for anything else (a cards short-id
// won't accidentally leak through /gifts/heart/).

export async function GET(
  _req: NextRequest,
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
        `SELECT id, kind, data_json, creator_id, view_count, created_at
         FROM public_gift_cards
         WHERE id = ? AND kind = 'heart_3d' LIMIT 1`,
      )
      .bind(id)
      .first<{
        id: string;
        kind: string;
        data_json: string;
        creator_id: string | null;
        view_count: number;
        created_at: string;
      }>();
    if (!row) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }

    db.prepare('UPDATE public_gift_cards SET view_count = view_count + 1 WHERE id = ?')
      .bind(id)
      .run()
      .catch(() => { /* ignore */ });

    let data: Record<string, unknown> = {};
    try { data = JSON.parse(row.data_json); } catch { /* corrupt row */ }

    return NextResponse.json({
      data: {
        id: row.id,
        kind: row.kind,
        data,
        view_count: row.view_count,
        created_at: row.created_at,
      },
    });
  } catch (err) {
    console.error('[particle-heart GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to load heart' } },
      { status: 500 },
    );
  }
}
