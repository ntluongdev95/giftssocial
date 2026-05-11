import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── PATCH /api/v1/gift-cards/templates/[id] ──────────────────────────────
// Owner-only edit. All fields optional; only sent fields are updated.

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  type: z.enum(['voucher', 'stored_value', 'service', 'loyalty']).optional(),
  face_value: z.number().nonnegative().optional(),
  percent_off: z.number().int().min(0).max(100).optional(),
  amount_off: z.number().nonnegative().optional(),
  service_name: z.string().max(120).nullable().optional(),
  currency: z.string().min(2).max(8).optional(),
  // cover_image accepts URL or same-origin /upload path (see POST handler).
  cover_image: z.string()
    .refine((v) => v.startsWith('/') || /^https?:\/\//.test(v), 'Must be a URL or path')
    .nullable()
    .optional(),
  gradient_from: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  gradient_to: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  text_color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).nullable().optional(),
  text_color_business: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).nullable().optional(),
  text_color_value: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).nullable().optional(),
  text_color_name: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).nullable().optional(),
  pattern: z.enum(['none', 'dots', 'waves', 'stars', 'grid']).optional(),
  icon_emoji: z.string().max(8).nullable().optional(),
  tagline: z.string().max(80).nullable().optional(),
  max_claims: z.number().int().nonnegative().optional(),
  one_per_user: z.boolean().optional(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  expires_in_days: z.number().int().positive().max(3650).optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
});

async function assertOwner(req: NextRequest, id: string) {
  const userId = await resolveUserId(req);
  if (!userId) return { err: NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 }) };
  const db = getDB();
  const row = await db
    .prepare('SELECT id, owner_user_id FROM gift_card_templates WHERE id = ?')
    .bind(id)
    .first<{ id: string; owner_user_id: string }>();
  if (!row) return { err: NextResponse.json({ error: { code: 'not_found' } }, { status: 404 }) };
  if (row.owner_user_id !== userId) {
    return { err: NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 }) };
  }
  return { userId, db };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guard = await assertOwner(req, id);
    if ('err' in guard) return guard.err;
    const { db } = guard;

    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Invalid input', issues: parsed.error.flatten() } },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(d)) {
      if (v === undefined) continue;
      fields.push(`${k} = ?`);
      values.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
    }
    if (fields.length === 0) {
      return NextResponse.json({ error: { code: 'no_changes' } }, { status: 400 });
    }
    values.push(id);
    await db.prepare(`UPDATE gift_card_templates SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

    const updated = await db
      .prepare('SELECT * FROM gift_card_templates WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[GiftCard template PATCH]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to update template' } },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/v1/gift-cards/templates/[id] ─────────────────────────────
// If the template has been claimed by anyone, soft-archive it (claims stay
// valid). If untouched, hard-delete the row.

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guard = await assertOwner(req, id);
    if ('err' in guard) return guard.err;
    const { db } = guard;

    const claims = await db
      .prepare('SELECT COUNT(*) AS n FROM gift_cards WHERE template_id = ?')
      .bind(id)
      .first<{ n: number }>();
    const hasClaims = (claims?.n ?? 0) > 0;

    if (hasClaims) {
      await db
        .prepare("UPDATE gift_card_templates SET status = 'archived' WHERE id = ?")
        .bind(id)
        .run();
      return NextResponse.json({ data: { id, archived: true } });
    }

    await db.prepare('DELETE FROM gift_card_templates WHERE id = ?').bind(id).run();
    return NextResponse.json({ data: { id, deleted: true } });
  } catch (err) {
    console.error('[GiftCard template DELETE]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to delete template' } },
      { status: 500 }
    );
  }
}
