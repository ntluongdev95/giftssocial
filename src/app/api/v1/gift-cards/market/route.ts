import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

// ─── GET /api/v1/gift-cards/market ────────────────────────────────────────
// Public browse endpoint. Lists templates that are:
//   - opted in via is_listed_in_market = 1
//   - status = 'active'
//   - within their starts_at / ends_at window (if set)
//   - not sold out (max_claims = 0 → unlimited; else current_claims < max)
//
// Query params:
//   q              — keyword (name/tagline/business name)
//   type           — voucher | stored_value | service | loyalty
//   city           — exact match on business city
//   max_price      — only cards priced <= this (in price_currency)
//   currency       — filter by price_currency (default any)
//   sort           — new | ending_soon | popular | price_asc | price_desc
//   limit          — 1..50, default 24
//   cursor         — created_at ISO for pagination
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get('q')?.trim() ?? '';
  const type = sp.get('type');
  const city = sp.get('city');
  const maxPrice = sp.get('max_price') ? Number(sp.get('max_price')) : null;
  const currency = sp.get('currency');
  const sort = sp.get('sort') ?? 'new';
  const limit = Math.min(Math.max(parseInt(sp.get('limit') || '24', 10), 1), 50);
  const cursor = sp.get('cursor');

  const db = getDB();

  try {
    const where: string[] = [
      't.is_listed_in_market = 1',
      "t.status = 'active'",
      "(t.starts_at IS NULL OR datetime(t.starts_at) <= datetime('now'))",
      "(t.ends_at IS NULL OR datetime(t.ends_at) >= datetime('now'))",
      '(t.max_claims = 0 OR t.current_claims < t.max_claims)',
    ];
    const binds: unknown[] = [];

    if (q) {
      const pat = `%${q.replace(/[%_]/g, '\\$&').toLowerCase()}%`;
      where.push(
        '(LOWER(t.name) LIKE ? OR LOWER(t.tagline) LIKE ? OR LOWER(t.description) LIKE ? OR LOWER(b.name) LIKE ?)',
      );
      binds.push(pat, pat, pat, pat);
    }
    if (type) {
      where.push('t.type = ?');
      binds.push(type);
    }
    if (city) {
      where.push('LOWER(b.city) = LOWER(?)');
      binds.push(city);
    }
    if (currency) {
      where.push('t.price_currency = ?');
      binds.push(currency);
    }
    if (maxPrice != null && !Number.isNaN(maxPrice)) {
      where.push('t.price <= ?');
      binds.push(maxPrice);
    }
    if (cursor && (sort === 'new' || sort === 'ending_soon')) {
      // Simple cursor: for 'new' it's created_at, for 'ending_soon' it's ends_at.
      // Both use the same '<' comparison since sort is DESC for new / ASC for ending_soon.
      where.push(sort === 'new' ? "datetime(t.created_at) < datetime(?)" : "datetime(t.ends_at) > datetime(?)");
      binds.push(cursor);
    }

    let orderBy: string;
    switch (sort) {
      case 'ending_soon':
        // Cards with ends_at set, soonest first. NULL ends_at sorts last.
        orderBy = "t.ends_at IS NULL, datetime(t.ends_at) ASC";
        break;
      case 'popular':
        orderBy = 't.current_claims DESC, t.created_at DESC';
        break;
      case 'price_asc':
        orderBy = 't.price ASC, t.created_at DESC';
        break;
      case 'price_desc':
        orderBy = 't.price DESC, t.created_at DESC';
        break;
      default:
        orderBy = 't.created_at DESC';
    }

    binds.push(limit + 1);

    const rows = await db
      .prepare(
        `SELECT t.id, t.business_id, t.name, t.description, t.tagline, t.type,
                t.face_value, t.percent_off, t.amount_off, t.service_name,
                t.currency, t.cover_image, t.gradient_from, t.gradient_to,
                t.pattern, t.icon_emoji, t.claim_token,
                t.price, t.price_currency,
                t.max_claims, t.current_claims, t.ends_at, t.expires_in_days,
                t.created_at,
                b.name AS business_name, b.cover_image AS business_cover,
                b.city AS business_city, b.category AS business_category
         FROM gift_card_templates t
         LEFT JOIN businesses b ON b.id = t.business_id
         WHERE ${where.join(' AND ')}
         ORDER BY ${orderBy}
         LIMIT ?`,
      )
      .bind(...binds)
      .all<Record<string, unknown>>();

    const list = rows.results || [];
    const hasMore = list.length > limit;
    const items = hasMore ? list.slice(0, limit) : list;
    let nextCursor: string | null = null;
    if (hasMore) {
      const last = items[items.length - 1] as Record<string, unknown>;
      nextCursor = (sort === 'ending_soon' ? last.ends_at : last.created_at) as string | null;
    }

    return NextResponse.json(
      { data: { items, next_cursor: nextCursor } },
      { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60' } },
    );
  } catch (err) {
    console.error('[GiftCard market GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch marketplace' } },
      { status: 500 },
    );
  }
}
