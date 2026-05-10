import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── POST /api/v1/gift-cards/redeem ────────────────────────────────────────
// Merchant scans a customer's per-claim QR (or pastes the card_id) to mark
// the card used. Permission: caller must own the business that issued the
// card. Logic per template type:
//   voucher / service  → status=redeemed (one-shot)
//   stored_value       → deduct amount from value_remaining, redeemed when 0
//   loyalty            → decrement uses_remaining, redeemed when 0

const redeemSchema = z.object({
  card_id: z.string().min(1),
  amount: z.number().nonnegative().optional(),  // required for stored_value
  location_lat: z.number().optional(),
  location_lng: z.number().optional(),
});

interface CardRow {
  id: string;
  template_id: string;
  business_id: string;
  claimed_by_user_id: string;
  expires_at: string | null;
  value_remaining: number;
  uses_remaining: number;
  status: 'active' | 'redeemed' | 'expired' | 'revoked';
  type: 'voucher' | 'stored_value' | 'service' | 'loyalty';
  face_value: number;
  percent_off: number;
  amount_off: number;
  currency: string;
  name: string;
  description: string;
  gradient_from: string;
  gradient_to: string;
  business_owner_id: string;
  business_name: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const parsed = redeemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Invalid input', issues: parsed.error.flatten() } },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const db = getDB();

    // Lookup card joined with template + business owner
    const card = await db
      .prepare(
        `SELECT
           gc.id, gc.template_id, gc.business_id, gc.claimed_by_user_id,
           gc.expires_at, gc.value_remaining, gc.uses_remaining, gc.status,
           t.type, t.face_value, t.percent_off, t.amount_off, t.currency,
           t.name, t.description, t.gradient_from, t.gradient_to,
           b.owner_user_id AS business_owner_id, b.name AS business_name
         FROM gift_cards gc
         LEFT JOIN gift_card_templates t ON t.id = gc.template_id
         LEFT JOIN businesses b ON b.id = gc.business_id
         WHERE gc.id = ?
         LIMIT 1`
      )
      .bind(d.card_id)
      .first<CardRow>();

    if (!card) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Card not found' } }, { status: 404 });
    }

    // Permission — only the business owner can redeem
    if (card.business_owner_id !== userId) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'You do not own the business that issued this card' } },
        { status: 403 }
      );
    }

    // Status check
    if (card.status !== 'active') {
      return NextResponse.json(
        { error: { code: 'invalid_status', message: `Card is ${card.status}` }, data: { card } },
        { status: 400 }
      );
    }

    // Expiry — auto-flip to expired before rejecting
    if (card.expires_at && Date.parse(card.expires_at) < Date.now()) {
      await db
        .prepare("UPDATE gift_cards SET status = 'expired' WHERE id = ? AND status = 'active'")
        .bind(d.card_id)
        .run();
      return NextResponse.json(
        { error: { code: 'expired', message: 'Card has expired' } },
        { status: 400 }
      );
    }

    // Type-specific bookkeeping
    let amountUsed = 0;
    let newValueRemaining = card.value_remaining;
    let newUsesRemaining = card.uses_remaining;
    let newStatus: 'active' | 'redeemed' | 'expired' | 'revoked' = 'active';

    if (card.type === 'stored_value') {
      if (d.amount === undefined || d.amount <= 0) {
        return NextResponse.json(
          { error: { code: 'amount_required', message: 'Specify amount used for stored-value cards' } },
          { status: 400 }
        );
      }
      if (d.amount > card.value_remaining) {
        return NextResponse.json(
          { error: { code: 'insufficient_balance', message: `Only ${card.value_remaining} ${card.currency} left` } },
          { status: 400 }
        );
      }
      amountUsed = d.amount;
      newValueRemaining = card.value_remaining - d.amount;
      newStatus = newValueRemaining <= 0 ? 'redeemed' : 'active';
    } else if (card.type === 'voucher' || card.type === 'service') {
      newStatus = 'redeemed';
      newUsesRemaining = Math.max(0, card.uses_remaining - 1);
    } else if (card.type === 'loyalty') {
      newUsesRemaining = Math.max(0, card.uses_remaining - 1);
      newStatus = newUsesRemaining <= 0 ? 'redeemed' : 'active';
    }

    // Update card row
    await db
      .prepare(
        `UPDATE gift_cards
         SET value_remaining = ?, uses_remaining = ?, status = ?
         WHERE id = ?`
      )
      .bind(newValueRemaining, newUsesRemaining, newStatus, d.card_id)
      .run();

    // Audit row
    const redemptionId = genId('gcr_');
    await db
      .prepare(
        `INSERT INTO gift_card_redemptions
         (id, card_id, template_id, business_id, customer_user_id, merchant_user_id,
          amount_used, location_lat, location_lng)
         VALUES (?,?,?,?,?,?,?,?,?)`
      )
      .bind(
        redemptionId,
        d.card_id,
        card.template_id,
        card.business_id,
        card.claimed_by_user_id,
        userId,
        amountUsed,
        d.location_lat ?? null,
        d.location_lng ?? null
      )
      .run();

    return NextResponse.json({
      data: {
        redemption_id: redemptionId,
        card_id: d.card_id,
        card_name: card.name,
        business_name: card.business_name,
        type: card.type,
        currency: card.currency,
        amount_used: amountUsed,
        new_status: newStatus,
        value_remaining: newValueRemaining,
        uses_remaining: newUsesRemaining,
        gradient_from: card.gradient_from,
        gradient_to: card.gradient_to,
      },
    });
  } catch (err) {
    console.error('[GiftCard redeem POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to redeem' } },
      { status: 500 }
    );
  }
}
