import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET — list the caller's promo templates ─────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });
    const db = getDB();
    const result = await db
      .prepare(
        `SELECT pt.*, b.name AS business_name
         FROM promo_templates pt
         LEFT JOIN businesses b ON b.id = pt.business_id
         WHERE pt.owner_user_id = ?
         ORDER BY pt.updated_at DESC
         LIMIT 100`,
      )
      .bind(userId)
      .all<Record<string, unknown>>();
    return NextResponse.json({ data: result.results });
  } catch (err) {
    console.error('[Promo templates GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch promos' } },
      { status: 500 },
    );
  }
}

// ─── POST — create a draft promo template ────────────────────────────────
// The elements_json comes from the visual builder. Light schema check
// (must be a JSON array); the renderer is forgiving of unknown fields.

const createSchema = z.object({
  business_id: z.string().min(1),
  name: z.string().min(1).max(120).default('Untitled promo'),
  description: z.string().max(500).default(''),
  background_color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).default('#fde3e0'),
  background_image: z.string().nullable().optional(),
  background_gradient_to: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).nullable().optional(),
  elements_json: z.string().default('[]'),
  gift_card_template_id: z.string().nullable().optional(),
  status: z.enum(['draft', 'published']).default('draft'),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Invalid input', issues: parsed.error.flatten() } },
        { status: 400 },
      );
    }
    const d = parsed.data;

    // Permission — must own the business.
    const db = getDB();
    const biz = await db
      .prepare(`SELECT id, owner_user_id FROM businesses WHERE id = ? AND status = 'active'`)
      .bind(d.business_id)
      .first<{ id: string; owner_user_id: string }>();
    if (!biz) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Business not found' } }, { status: 404 });
    }
    if (biz.owner_user_id !== userId) {
      return NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 });
    }

    // Smoke-test elements_json is valid JSON array — reject otherwise.
    try {
      const parsedEls = JSON.parse(d.elements_json);
      if (!Array.isArray(parsedEls)) throw new Error();
    } catch {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'elements_json must be a JSON array' } },
        { status: 400 },
      );
    }

    const id = genId('promo_');
    await db
      .prepare(
        `INSERT INTO promo_templates
         (id, business_id, owner_user_id, name, description,
          background_color, background_image, background_gradient_to,
          elements_json, gift_card_template_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id, d.business_id, userId, d.name, d.description,
        d.background_color, d.background_image ?? null, d.background_gradient_to ?? null,
        d.elements_json, d.gift_card_template_id ?? null, d.status,
      )
      .run();

    const created = await db
      .prepare(`SELECT * FROM promo_templates WHERE id = ?`)
      .bind(id)
      .first<Record<string, unknown>>();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error('[Promo templates POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create promo' } },
      { status: 500 },
    );
  }
}
