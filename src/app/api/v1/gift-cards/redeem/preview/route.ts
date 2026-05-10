import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── POST /api/v1/gift-cards/redeem/preview ────────────────────────────────
// Merchant scans a card QR; before committing the redemption we look the
// card up so the merchant can confirm details (and enter an amount for
// stored-value cards) on screen.

const previewSchema = z.object({
  card_id: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const parsed = previewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Invalid input' } },
        { status: 400 }
      );
    }
    const db = getDB();
    const card = await db
      .prepare(
        `SELECT
           gc.id, gc.template_id, gc.business_id, gc.claimed_by_user_id,
           gc.expires_at, gc.value_remaining, gc.uses_remaining, gc.status,
           gc.claimed_at,
           t.type, t.name, t.description, t.face_value, t.percent_off,
           t.amount_off, t.currency, t.gradient_from, t.gradient_to,
           b.owner_user_id AS business_owner_id, b.name AS business_name,
           u.display_name AS customer_name, u.username AS customer_username,
           u.avatar_url AS customer_avatar
         FROM gift_cards gc
         LEFT JOIN gift_card_templates t ON t.id = gc.template_id
         LEFT JOIN businesses b ON b.id = gc.business_id
         LEFT JOIN users u ON u.id = gc.claimed_by_user_id
         WHERE gc.id = ?
         LIMIT 1`
      )
      .bind(parsed.data.card_id)
      .first<Record<string, unknown>>();

    if (!card) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Card not found' } }, { status: 404 });
    }

    if (card.business_owner_id !== userId) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'You do not own the business that issued this card' } },
        { status: 403 }
      );
    }

    // Compute eligibility hint
    let eligibility: 'ok' | 'redeemed' | 'expired' | 'revoked' | 'inactive' = 'ok';
    if (card.status === 'redeemed') eligibility = 'redeemed';
    else if (card.status === 'revoked') eligibility = 'revoked';
    else if (card.status === 'expired') eligibility = 'expired';
    else if (card.expires_at && Date.parse(card.expires_at as string) < Date.now()) eligibility = 'expired';
    else if (card.status !== 'active') eligibility = 'inactive';

    return NextResponse.json({ data: { ...card, eligibility } });
  } catch (err) {
    console.error('[GiftCard redeem preview]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to preview' } },
      { status: 500 }
    );
  }
}
