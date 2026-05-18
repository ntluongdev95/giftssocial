import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

// GET /api/v1/tags?q=&limit=&window=
//   q       — optional search prefix (matches slug or display_name)
//   limit   — 1..50, default 20
//   window  — "7d" | "30d" | "all" (default "7d") for trending ranking
//
// Returns top tags ordered by recent activity (link count in window).
// Falls back to use_count if window=all.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('limit') || '20', 10), 1), 50);
  const window = req.nextUrl.searchParams.get('window') || '7d';

  const db = getDB();

  try {
    if (window === 'all') {
      const escaped = q.replace(/[%_]/g, '\\$&').toLowerCase();
      const pattern = `%${escaped}%`;
      const rows = q
        ? await db
            .prepare(
              `SELECT id, slug, display_name, use_count
               FROM tags
               WHERE LOWER(slug) LIKE ? OR LOWER(display_name) LIKE ?
               ORDER BY use_count DESC
               LIMIT ?`,
            )
            .bind(pattern, pattern, limit)
            .all<Record<string, unknown>>()
        : await db
            .prepare(
              `SELECT id, slug, display_name, use_count
               FROM tags
               ORDER BY use_count DESC
               LIMIT ?`,
            )
            .bind(limit)
            .all<Record<string, unknown>>();
      return NextResponse.json({ data: rows.results });
    }

    const hours = window === '30d' ? 30 * 24 : 7 * 24;
    const escaped = q.replace(/[%_]/g, '\\$&').toLowerCase();
    const pattern = `%${escaped}%`;

    const rows = q
      ? await db
          .prepare(
            `SELECT t.id, t.slug, t.display_name, t.use_count,
                    COUNT(l.tag_id) AS recent_count
             FROM tags t
             LEFT JOIN tag_links l ON l.tag_id = t.id
               AND datetime(l.created_at) > datetime('now', '-' || ? || ' hours')
             WHERE LOWER(t.slug) LIKE ? OR LOWER(t.display_name) LIKE ?
             GROUP BY t.id
             ORDER BY recent_count DESC, t.use_count DESC
             LIMIT ?`,
          )
          .bind(hours, pattern, pattern, limit)
          .all<Record<string, unknown>>()
      : await db
          .prepare(
            `SELECT t.id, t.slug, t.display_name, t.use_count,
                    COUNT(l.tag_id) AS recent_count
             FROM tags t
             LEFT JOIN tag_links l ON l.tag_id = t.id
               AND datetime(l.created_at) > datetime('now', '-' || ? || ' hours')
             GROUP BY t.id
             ORDER BY recent_count DESC, t.use_count DESC
             LIMIT ?`,
          )
          .bind(hours, limit)
          .all<Record<string, unknown>>();

    return NextResponse.json({ data: rows.results });
  } catch (err) {
    console.error('[Tags GET]', err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: msg } },
      { status: 500 },
    );
  }
}
