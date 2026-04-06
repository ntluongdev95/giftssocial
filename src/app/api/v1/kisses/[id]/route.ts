import { NextRequest, NextResponse } from 'next/server';
import { getDB, getKV } from '@/lib/db';

/**
 * GET /api/v1/kisses/:id — Public: get a single kiss for share/replay
 * Cached in KV for 1 hour to handle viral sharing.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Check KV cache first
    try {
      const kv = getKV();
      const cached = await kv.get(`kiss:${id}`);
      if (cached) {
        const data = JSON.parse(cached as string);
        if (data._private) return NextResponse.json({ error: { code: 'private', message: 'This kiss is private' } }, { status: 403 });
        return NextResponse.json({ data }, {
          headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' },
        });
      }
    } catch { /* KV down, continue to DB */ }

    const db = getDB();
    const kiss = await db.prepare(
      `SELECT k.*,
        s.display_name AS sender_name, s.avatar_url AS sender_avatar,
        r.display_name AS receiver_name, r.avatar_url AS receiver_avatar
       FROM kisses k
       LEFT JOIN users s ON s.id = k.sender_id
       LEFT JOIN users r ON r.id = k.receiver_id
       WHERE k.id = ?`
    ).bind(id).first<Record<string, unknown>>();

    if (!kiss) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Kiss not found' } }, { status: 404 });
    }

    if (kiss.visibility === 'private') {
      try {
        const kv = getKV();
        await kv.put(`kiss:${id}`, JSON.stringify({ _private: true }), { expirationTtl: 300 });
      } catch {}
      return NextResponse.json({ error: { code: 'private', message: 'This kiss is private' } }, { status: 403 });
    }

    // Cache TTL = time remaining until 24h expiry (min 60s, max 86400s)
    const createdAt = new Date(kiss.created_at as string).getTime();
    const expiresAt = createdAt + 24 * 60 * 60 * 1000;
    const remainingSec = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000));
    const isExpired = remainingSec <= 60;

    if (isExpired && !kiss.opened) {
      return NextResponse.json({ error: { code: 'expired', message: 'This kiss has expired' } }, { status: 410 });
    }

    // Cache matches gift lifetime — auto-expires with the gift
    try {
      const kv = getKV();
      await kv.put(`kiss:${id}`, JSON.stringify(kiss), { expirationTtl: remainingSec });
    } catch {}

    const httpCache = Math.min(remainingSec, 3600); // max 1h HTTP cache
    return NextResponse.json({ data: kiss }, {
      headers: { 'Cache-Control': `public, s-maxage=${httpCache}, stale-while-revalidate=60` },
    });
  } catch (err) {
    console.error('[Kiss GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}
