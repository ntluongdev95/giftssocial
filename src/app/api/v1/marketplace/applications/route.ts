import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { resolveAdminUserId } from '@/lib/admin';
import { notify } from '@/lib/notify';

// Application submitted by a business owner to unlock marketplace listing.
const createSchema = z.object({
  business_id: z.string().min(1),
  legal_name: z.string().min(2).max(200),
  tax_id: z.string().min(2).max(50),
  gao_domain: z.string().min(2).max(120),
  contact_phone: z.string().min(6).max(30),
  contact_email: z.string().email(),
  description: z.string().max(1000).default(''),
});

// ─── POST /api/v1/marketplace/applications ────────────────────────────────
// Submit an application. Caller must own the business. One pending or
// approved application per business — re-submit only allowed if previous
// was rejected (resets the row).
export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Login required' } },
        { status: 401 },
      );
    }
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Invalid input', issues: parsed.error.flatten() } },
        { status: 400 },
      );
    }
    const d = parsed.data;
    const db = getDB();

    // Permission: caller must own the business.
    const biz = await db
      .prepare('SELECT id, name, owner_user_id, marketplace_enabled FROM businesses WHERE id = ?')
      .bind(d.business_id)
      .first<{ id: string; name: string; owner_user_id: string; marketplace_enabled: number }>();
    if (!biz) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Business not found' } }, { status: 404 });
    }
    if (biz.owner_user_id !== userId) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'Not your business' } }, { status: 403 });
    }
    if (biz.marketplace_enabled === 1) {
      return NextResponse.json(
        { error: { code: 'already_approved', message: 'Business is already approved for marketplace' } },
        { status: 409 },
      );
    }

    // Replace any prior rejected app; block if pending.
    const prior = await db
      .prepare('SELECT id, status FROM marketplace_applications WHERE business_id = ? ORDER BY submitted_at DESC LIMIT 1')
      .bind(d.business_id)
      .first<{ id: string; status: string }>();
    if (prior && prior.status === 'pending') {
      return NextResponse.json(
        { error: { code: 'already_pending', message: 'Application is already under review' } },
        { status: 409 },
      );
    }
    if (prior && prior.status === 'rejected') {
      await db.prepare('DELETE FROM marketplace_applications WHERE id = ?').bind(prior.id).run();
    }

    const id = genId('mkapp_');
    await db
      .prepare(
        `INSERT INTO marketplace_applications
         (id, business_id, owner_user_id, business_name, legal_name, tax_id,
          gao_domain, contact_phone, contact_email, description, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,'pending')`,
      )
      .bind(
        id, d.business_id, userId, biz.name,
        d.legal_name, d.tax_id, d.gao_domain,
        d.contact_phone, d.contact_email, d.description,
      )
      .run();

    const created = await db
      .prepare('SELECT * FROM marketplace_applications WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();

    // Fan out a notification to every admin. Fire-and-forget — never block
    // the response on this. Pulls only the id column so the loop stays
    // tight even with many admins.
    try {
      const admins = await db
        .prepare("SELECT id FROM users WHERE is_admin = 1")
        .all<{ id: string }>();
      const title = 'New marketplace application';
      const body = `${biz.name} submitted for review`;
      for (const a of admins.results || []) {
        await notify(a.id, 'marketplace_application_pending', title, body, 'marketplace_application', id);
      }
    } catch (e) {
      console.error('[Marketplace applications POST] admin notify failed', e);
    }

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error('[Marketplace applications POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to submit application' } },
      { status: 500 },
    );
  }
}

// ─── GET /api/v1/marketplace/applications ─────────────────────────────────
// Default: caller's own applications (most-recent first per business).
// ?scope=admin&status=pending|approved|rejected — admin-only list of all.
export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get('scope');
  const db = getDB();

  try {
    if (scope === 'admin') {
      const adminId = await resolveAdminUserId(req);
      if (!adminId) {
        return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
      }
      const statusFilter = req.nextUrl.searchParams.get('status');
      const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('limit') || '50', 10), 1), 200);

      const where = statusFilter ? 'WHERE a.status = ?' : '';
      const stmt = db.prepare(
        `SELECT a.*, b.cover_image AS business_cover, b.city AS business_city,
                u.display_name AS owner_display_name, u.username AS owner_username,
                u.trust_score AS owner_trust_score
         FROM marketplace_applications a
         LEFT JOIN businesses b ON b.id = a.business_id
         LEFT JOIN users u ON u.id = a.owner_user_id
         ${where}
         ORDER BY a.submitted_at DESC
         LIMIT ?`,
      );
      const rows = statusFilter
        ? await stmt.bind(statusFilter, limit).all<Record<string, unknown>>()
        : await stmt.bind(limit).all<Record<string, unknown>>();
      return NextResponse.json({ data: rows.results });
    }

    // Caller-only listing
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Login required' } },
        { status: 401 },
      );
    }
    const rows = await db
      .prepare(
        `SELECT a.*, b.name AS business_current_name, b.cover_image AS business_cover
         FROM marketplace_applications a
         LEFT JOIN businesses b ON b.id = a.business_id
         WHERE a.owner_user_id = ?
         ORDER BY a.submitted_at DESC`,
      )
      .bind(userId)
      .all<Record<string, unknown>>();
    return NextResponse.json({ data: rows.results });
  } catch (err) {
    console.error('[Marketplace applications GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch applications' } },
      { status: 500 },
    );
  }
}
