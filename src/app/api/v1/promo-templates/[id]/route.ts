import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET — fetch one (public if status='published', else owner-only) ────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = getDB();
    const t = await db
      .prepare(
        `SELECT pt.*, b.name AS business_name, b.cover_image AS business_cover
         FROM promo_templates pt
         LEFT JOIN businesses b ON b.id = pt.business_id
         WHERE pt.id = ? LIMIT 1`,
      )
      .bind(id)
      .first<Record<string, unknown>>();
    if (!t) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

    // Drafts are private — only owner can read.
    if (t.status === 'draft') {
      const userId = await resolveUserId(req).catch(() => null);
      if (!userId || userId !== t.owner_user_id) {
        return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
      }
    }
    return NextResponse.json({ data: t });
  } catch (err) {
    console.error('[Promo template GET]', err);
    return NextResponse.json({ error: { code: 'internal_error' } }, { status: 500 });
  }
}

// ─── PATCH — owner-only partial update ────────────────────────────────

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  background_color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  background_image: z.string().nullable().optional(),
  background_gradient_to: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).nullable().optional(),
  elements_json: z.string().optional(),
  gift_card_template_id: z.string().nullable().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

    const { id } = await params;
    const db = getDB();
    const owner = await db
      .prepare(`SELECT owner_user_id FROM promo_templates WHERE id = ?`)
      .bind(id)
      .first<{ owner_user_id: string }>();
    if (!owner) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    if (owner.owner_user_id !== userId) {
      return NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_error', issues: parsed.error.flatten() } },
        { status: 400 },
      );
    }
    const d = parsed.data;

    // Validate elements_json shape if updated.
    if (d.elements_json !== undefined) {
      try {
        const arr = JSON.parse(d.elements_json);
        if (!Array.isArray(arr)) throw new Error();
      } catch {
        return NextResponse.json(
          { error: { code: 'validation_error', message: 'elements_json must be a JSON array' } },
          { status: 400 },
        );
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(d)) {
      if (v === undefined) continue;
      fields.push(`${k} = ?`);
      values.push(v);
    }
    if (!fields.length) {
      return NextResponse.json({ error: { code: 'no_changes' } }, { status: 400 });
    }
    fields.push(`updated_at = datetime('now')`);
    values.push(id);
    await db
      .prepare(`UPDATE promo_templates SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await db
      .prepare(`SELECT * FROM promo_templates WHERE id = ?`)
      .bind(id)
      .first<Record<string, unknown>>();
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[Promo template PATCH]', err);
    return NextResponse.json({ error: { code: 'internal_error' } }, { status: 500 });
  }
}

// ─── DELETE — owner-only ─────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

    const { id } = await params;
    const db = getDB();
    await db
      .prepare(`DELETE FROM promo_templates WHERE id = ? AND owner_user_id = ?`)
      .bind(id, userId)
      .run();
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error('[Promo template DELETE]', err);
    return NextResponse.json({ error: { code: 'internal_error' } }, { status: 500 });
  }
}
