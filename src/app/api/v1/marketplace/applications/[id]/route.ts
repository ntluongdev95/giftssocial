import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db';
import { resolveAdminUserId } from '@/lib/admin';
import { notify } from '@/lib/notify';

// Admin-only: review (approve / reject) one application. Approving flips
// businesses.marketplace_enabled = 1 atomically so the merchant can begin
// listing immediately.
const patchSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewer_notes: z.string().max(2000).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await resolveAdminUserId(req);
  if (!adminId) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  const { id } = await params;
  const db = getDB();
  const row = await db
    .prepare(
      `SELECT a.*, b.cover_image AS business_cover, b.city AS business_city,
              u.display_name AS owner_display_name, u.username AS owner_username,
              u.trust_score AS owner_trust_score, u.gao_domain AS owner_gao_domain
       FROM marketplace_applications a
       LEFT JOIN businesses b ON b.id = a.business_id
       LEFT JOIN users u ON u.id = a.owner_user_id
       WHERE a.id = ?`,
    )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!row) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  return NextResponse.json({ data: row });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await resolveAdminUserId(req);
  if (!adminId) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_error', issues: parsed.error.flatten() } },
        { status: 400 },
      );
    }
    const { status, reviewer_notes } = parsed.data;

    const db = getDB();
    const app = await db
      .prepare('SELECT id, business_id, owner_user_id, business_name, status FROM marketplace_applications WHERE id = ?')
      .bind(id)
      .first<{ id: string; business_id: string; owner_user_id: string; business_name: string; status: string }>();
    if (!app) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    if (app.status !== 'pending') {
      return NextResponse.json(
        { error: { code: 'already_reviewed', message: `Application is already ${app.status}` } },
        { status: 409 },
      );
    }

    await db
      .prepare(
        `UPDATE marketplace_applications
            SET status = ?, reviewer_id = ?, reviewer_notes = ?, reviewed_at = datetime('now')
          WHERE id = ?`,
      )
      .bind(status, adminId, reviewer_notes ?? null, id)
      .run();

    if (status === 'approved') {
      await db
        .prepare('UPDATE businesses SET marketplace_enabled = 1 WHERE id = ?')
        .bind(app.business_id)
        .run();
    }

    // Notify the applicant of the decision (fire-and-forget).
    try {
      const title = status === 'approved'
        ? 'Marketplace access approved'
        : 'Marketplace application rejected';
      const body = status === 'approved'
        ? `${app.business_name} can now list cards on the marketplace.`
        : (reviewer_notes?.trim() || `Your application for ${app.business_name} was not approved.`);
      await notify(
        app.owner_user_id,
        status === 'approved' ? 'marketplace_approved' : 'marketplace_rejected',
        title,
        body,
        'marketplace_application',
        id,
      );
    } catch (e) {
      console.error('[Marketplace application PATCH] applicant notify failed', e);
    }

    const updated = await db
      .prepare('SELECT * FROM marketplace_applications WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[Marketplace application PATCH]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to review' } },
      { status: 500 },
    );
  }
}
