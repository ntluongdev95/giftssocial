import { NextRequest, NextResponse } from 'next/server';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// POST /api/v1/promo-templates/:id/send
//
// Fan-out: creates one notification row per recipient. The promo
// template stays in DB so each notification can deep-link to the
// public story view at /p/<id>.
//
// Body: { audience: 'all_followers' | 'recent_customers' | 'vip' }
//
// Auth: must own the template. Returns count of notifications inserted.

interface TemplateRow {
  id: string;
  owner_user_id: string;
  business_id: string;
  name: string;
  status: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { audience?: string };
    const audience = (body.audience || 'all_followers') as 'all_followers' | 'recent_customers' | 'vip';
    if (!['all_followers', 'recent_customers', 'vip'].includes(audience)) {
      return NextResponse.json({ error: { code: 'invalid_audience' } }, { status: 400 });
    }

    const db = getDB();
    const template = await db
      .prepare(`SELECT id, owner_user_id, business_id, name, status FROM promo_templates WHERE id = ?`)
      .bind(id)
      .first<TemplateRow>();
    if (!template) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    if (template.owner_user_id !== userId) {
      return NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 });
    }

    // Pull recipient IDs based on the chosen audience.
    let recipients: { id: string }[] = [];
    if (audience === 'all_followers') {
      // Followers of the business OWNER (covers the typical "merchant
      // builds a following on their personal/business profile" pattern).
      const r = await db
        .prepare(
          `SELECT DISTINCT follower_id AS id
           FROM follows
           WHERE following_user_id = ?`,
        )
        .bind(userId)
        .all<{ id: string }>();
      recipients = r.results || [];
    } else if (audience === 'recent_customers') {
      // Anyone who claimed a gift card from this business in last 90d.
      const r = await db
        .prepare(
          `SELECT DISTINCT claimed_by_user_id AS id
           FROM gift_cards
           WHERE business_id = ?
             AND claimed_at > datetime('now', '-90 days')`,
        )
        .bind(template.business_id)
        .all<{ id: string }>();
      recipients = r.results || [];
    } else if (audience === 'vip') {
      // 3+ redemptions from this business.
      const r = await db
        .prepare(
          `SELECT customer_user_id AS id
           FROM gift_card_redemptions
           WHERE business_id = ?
           GROUP BY customer_user_id
           HAVING COUNT(*) >= 3`,
        )
        .bind(template.business_id)
        .all<{ id: string }>();
      recipients = r.results || [];
    }

    if (!recipients.length) {
      return NextResponse.json(
        { data: { recipient_count: 0, delivered_count: 0 } },
      );
    }

    // Insert notifications + send log in parallel batches.
    // SQLite/D1 doesn't support bulk insert in one prepared statement
    // cleanly across many rows — we run each but limit to 500 max.
    const cappedRecipients = recipients.slice(0, 500);
    let delivered = 0;
    const businessRow = await db
      .prepare(`SELECT name FROM businesses WHERE id = ?`)
      .bind(template.business_id)
      .first<{ name: string }>();
    const businessLabel = businessRow?.name || 'A business';
    const title = `🎁 New promo from ${businessLabel}`;
    const notifBody = template.name;

    for (const r of cappedRecipients) {
      try {
        await db
          .prepare(
            `INSERT INTO notifications (id, user_id, type, title, body, ref_type, ref_id)
             VALUES (?, ?, 'system', ?, ?, 'promo', ?)`,
          )
          .bind(genId('notif_'), r.id, title, notifBody, template.id)
          .run();
        delivered++;
      } catch (err) {
        console.error('[Promo send] notif insert failed for', r.id, err);
      }
    }

    // Record the send.
    await db
      .prepare(
        `INSERT INTO promo_sends (id, template_id, business_id, audience, recipient_count, delivered_count)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(genId('psend_'), template.id, template.business_id, audience, cappedRecipients.length, delivered)
      .run();

    // Auto-publish on first send.
    if (template.status !== 'published') {
      await db
        .prepare(`UPDATE promo_templates SET status = 'published', updated_at = datetime('now') WHERE id = ?`)
        .bind(template.id)
        .run();
    }

    return NextResponse.json({
      data: {
        recipient_count: cappedRecipients.length,
        delivered_count: delivered,
        capped: recipients.length > cappedRecipients.length,
      },
    });
  } catch (err) {
    console.error('[Promo send]', err);
    return NextResponse.json({ error: { code: 'internal_error' } }, { status: 500 });
  }
}
