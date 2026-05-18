import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/gift-cards/templates ─────────────────────────────────────
// Returns templates for businesses owned by the caller. Used by the merchant
// dashboard at /me/gift-cards to manage their own card drops.

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });
    }
    const db = getDB();
    const result = await db
      .prepare(
        `SELECT t.*, b.name AS business_name, b.cover_image AS business_cover
         FROM gift_card_templates t
         LEFT JOIN businesses b ON b.id = t.business_id
         WHERE t.owner_user_id = ?
         ORDER BY t.created_at DESC
         LIMIT 100`
      )
      .bind(userId)
      .all<Record<string, unknown>>();
    return NextResponse.json({ data: result.results });
  } catch (err) {
    console.error('[GiftCard templates GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch templates' } },
      { status: 500 }
    );
  }
}

// ─── POST /api/v1/gift-cards/templates ────────────────────────────────────

const createSchema = z.object({
  business_id: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(''),
  type: z.enum(['voucher', 'stored_value', 'service', 'loyalty']),
  // Type-specific (validated below)
  face_value: z.number().nonnegative().default(0),
  percent_off: z.number().int().min(0).max(100).default(0),
  amount_off: z.number().nonnegative().default(0),
  service_name: z.string().max(120).optional(),
  currency: z.string().min(2).max(8).default('VND'),
  // Visual customization (migration-008). cover_image accepts either a
  // full https:// URL (paste) or a same-origin relative path (uploaded
  // via /api/v1/upload) — hence url() OR string starting with '/'.
  cover_image: z.string()
    .refine((v) => v.startsWith('/') || /^https?:\/\//.test(v), 'Must be a URL or path')
    .optional(),
  gradient_from: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).default('#00d4ff'),
  gradient_to: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).default('#a78bfa'),
  text_color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  text_color_business: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  text_color_value: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  text_color_name: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  pattern: z.enum(['none', 'dots', 'waves', 'stars', 'grid']).default('none'),
  // Single emoji or short cluster — max 8 chars to permit ZWJ sequences.
  icon_emoji: z.string().max(8).optional(),
  tagline: z.string().max(80).optional(),
  max_claims: z.number().int().nonnegative().default(0),
  one_per_user: z.boolean().default(true),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  expires_in_days: z.number().int().positive().max(3650).default(30),
  status: z.enum(['draft', 'active']).default('active'),
  // Marketplace (migration-017). Price is currency-agnostic; default currency
  // is Gao Points. is_listed_in_market controls whether this template shows
  // on the public /gift-cards/market browse page.
  price: z.number().nonnegative().default(0),
  price_currency: z.string().min(2).max(8).default('GAO'),
  is_listed_in_market: z.boolean().default(false),
});

function genClaimToken(): string {
  // Short URL-safe token. 14 chars of base36 ≈ 70 bits — collision-safe for QR.
  const bytes = crypto.getRandomValues(new Uint8Array(11));
  return Array.from(bytes).map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
}

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Invalid input', issues: parsed.error.flatten() } },
        { status: 400 }
      );
    }
    const d = parsed.data;

    // Type-specific validation: at least one discount/value field must be set.
    if (d.type === 'stored_value' && d.face_value <= 0) {
      return NextResponse.json({ error: { code: 'validation_error', message: 'Stored-value cards need face_value > 0' } }, { status: 400 });
    }
    if (d.type === 'voucher' && d.percent_off === 0 && d.amount_off === 0) {
      return NextResponse.json({ error: { code: 'validation_error', message: 'Voucher needs percent_off or amount_off' } }, { status: 400 });
    }
    if (d.type === 'service' && !d.service_name) {
      return NextResponse.json({ error: { code: 'validation_error', message: 'Service voucher needs service_name' } }, { status: 400 });
    }

    const db = getDB();

    // Permission: caller must own the business.
    const biz = await db
      .prepare('SELECT id, owner_user_id, marketplace_enabled FROM businesses WHERE id = ? AND status = ?')
      .bind(d.business_id, 'active')
      .first<{ id: string; owner_user_id: string; marketplace_enabled: number }>();
    if (!biz) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Business not found' } }, { status: 404 });
    }
    if (biz.owner_user_id !== userId) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'You do not own this business' } }, { status: 403 });
    }

    // Marketplace gate: require manual approval before listing publicly. The
    // template itself is still created (claimable via QR/link); only the
    // public listing flag is forced off.
    if (d.is_listed_in_market && biz.marketplace_enabled !== 1) {
      return NextResponse.json(
        {
          error: {
            code: 'marketplace_not_approved',
            message: 'Apply for marketplace access first at /me/marketplace',
          },
        },
        { status: 403 },
      );
    }

    const id = genId('gct_');
    const claim_token = genClaimToken();

    await db
      .prepare(
        `INSERT INTO gift_card_templates
         (id, business_id, owner_user_id, name, description, type, face_value, percent_off, amount_off,
          service_name, currency, cover_image, gradient_from, gradient_to, claim_token,
          max_claims, one_per_user, starts_at, ends_at, expires_in_days, status,
          pattern, icon_emoji, tagline,
          text_color, text_color_business, text_color_value, text_color_name,
          price, price_currency, is_listed_in_market)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .bind(
        id, d.business_id, userId, d.name, d.description, d.type,
        d.face_value, d.percent_off, d.amount_off,
        d.service_name ?? null, d.currency, d.cover_image ?? null,
        d.gradient_from, d.gradient_to, claim_token,
        d.max_claims, d.one_per_user ? 1 : 0,
        d.starts_at ?? null, d.ends_at ?? null,
        d.expires_in_days, d.status,
        d.pattern, d.icon_emoji ?? null, d.tagline ?? null,
        d.text_color ?? null,
        d.text_color_business ?? null,
        d.text_color_value ?? null,
        d.text_color_name ?? null,
        d.price, d.price_currency, d.is_listed_in_market ? 1 : 0
      )
      .run();

    const created = await db
      .prepare('SELECT * FROM gift_card_templates WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error('[GiftCard templates POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create template' } },
      { status: 500 }
    );
  }
}
