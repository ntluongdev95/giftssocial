import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/gift-cards/mine ──────────────────────────────────────────
// Returns the caller's claimed gift cards, joined with their template + the
// merchant's business so the wallet can render premium previews end-to-end.
// Auto-flips status='active' rows whose expires_at has lapsed to 'expired' so
// the UI never shows stale active cards (cheap maintenance pass).

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });
    }

    const db = getDB();

    // Lazy expiry sweep — only touches the caller's own rows.
    const nowIso = new Date().toISOString();
    await db
      .prepare(
        `UPDATE gift_cards
         SET status = 'expired'
         WHERE claimed_by_user_id = ?
           AND status = 'active'
           AND expires_at IS NOT NULL
           AND expires_at < ?`
      )
      .bind(userId, nowIso)
      .run();

    const result = await db
      .prepare(
        `SELECT
           gc.id, gc.template_id, gc.business_id, gc.claimed_at, gc.expires_at,
           gc.value_remaining, gc.uses_remaining, gc.status,
           gc.gifter_user_id, gc.gift_message,
           t.name           AS name,
           t.description    AS description,
           t.type           AS type,
           t.face_value     AS face_value,
           t.percent_off    AS percent_off,
           t.amount_off     AS amount_off,
           t.service_name   AS service_name,
           t.currency       AS currency,
           t.gradient_from  AS gradient_from,
           t.gradient_to    AS gradient_to,
           t.cover_image    AS cover_image,
           t.pattern        AS pattern,
           t.icon_emoji     AS icon_emoji,
           t.tagline        AS tagline,
           t.expires_in_days AS expires_in_days,
           b.name           AS business_name,
           b.cover_image    AS business_cover,
           gu.display_name  AS gifter_display_name,
           gu.username      AS gifter_username,
           gu.avatar_url    AS gifter_avatar_url
         FROM gift_cards gc
         LEFT JOIN gift_card_templates t ON t.id = gc.template_id
         LEFT JOIN businesses b ON b.id = gc.business_id
         LEFT JOIN users gu ON gu.id = gc.gifter_user_id
         WHERE gc.claimed_by_user_id = ?
         ORDER BY
           CASE gc.status
             WHEN 'active'   THEN 0
             WHEN 'redeemed' THEN 1
             WHEN 'expired'  THEN 2
             ELSE 3
           END,
           gc.claimed_at DESC
         LIMIT 200`
      )
      .bind(userId)
      .all<Record<string, unknown>>();

    return NextResponse.json({ data: result.results });
  } catch (err) {
    console.error('[GiftCard mine GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to load cards' } },
      { status: 500 }
    );
  }
}
