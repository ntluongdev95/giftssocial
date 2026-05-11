import { NextRequest, NextResponse } from 'next/server';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// POST /api/v1/gift-cards/:id/transfer
//
// Re-gift an already-claimed card to another Gao Social user. Distinct
// from /gift-cards/send which creates a NEW card from a template:
// transfer changes ownership in place, so the sender's wallet loses the
// card the moment the recipient gains it. No template counter is bumped
// because the card already exists in circulation.
//
// Body:
//   { recipient_user_id: string, gift_message?: string }
//
// Constraints:
//   • caller must currently own the card and be authenticated
//   • card status must be 'active' (not redeemed/expired/revoked)
//   • recipient must be a different, active user
//   • if the template enforces one_per_user, recipient must not already
//     have a live (active|redeemed) card from the same template

interface CardRow {
  id: string;
  template_id: string;
  claimed_by_user_id: string;
  status: 'active' | 'redeemed' | 'expired' | 'revoked';
}

interface TemplateRow {
  id: string;
  name: string;
  one_per_user: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const senderId = await resolveUserId(req);
    if (!senderId) {
      return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });
    }

    const { id: cardId } = await params;
    if (!cardId) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Missing card id' } },
        { status: 400 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      recipient_user_id?: string;
      gift_message?: string;
    };
    const recipientId = body.recipient_user_id?.trim();
    const giftMessage = (body.gift_message || '').trim().slice(0, 280);

    if (!recipientId) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'recipient_user_id is required' } },
        { status: 400 },
      );
    }
    if (recipientId === senderId) {
      return NextResponse.json(
        { error: { code: 'self_gift', message: 'You cannot transfer a card to yourself' } },
        { status: 400 },
      );
    }

    const db = getDB();

    // ── Load card and validate ownership + status ────────────────────
    const card = await db
      .prepare(`SELECT id, template_id, claimed_by_user_id, status FROM gift_cards WHERE id = ? LIMIT 1`)
      .bind(cardId)
      .first<CardRow>();
    if (!card) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Card not found' } }, { status: 404 });
    }
    if (card.claimed_by_user_id !== senderId) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'You do not own this card' } },
        { status: 403 },
      );
    }
    if (card.status !== 'active') {
      const reason =
        card.status === 'redeemed' ? 'This card has already been used.'
        : card.status === 'expired' ? 'This card has expired.'
        : 'This card cannot be transferred.';
      return NextResponse.json(
        { error: { code: 'not_active', message: reason } },
        { status: 400 },
      );
    }

    // ── Validate recipient ───────────────────────────────────────────
    const recipient = await db
      .prepare(`SELECT id, display_name, username FROM users WHERE id = ? AND status = 'active' LIMIT 1`)
      .bind(recipientId)
      .first<{ id: string; display_name: string | null; username: string | null }>();
    if (!recipient) {
      return NextResponse.json(
        { error: { code: 'recipient_not_found', message: 'Recipient user not found' } },
        { status: 404 },
      );
    }

    // ── Honour template's one_per_user against the RECIPIENT ─────────
    const template = await db
      .prepare(`SELECT id, name, one_per_user FROM gift_card_templates WHERE id = ? LIMIT 1`)
      .bind(card.template_id)
      .first<TemplateRow>();

    if (template?.one_per_user) {
      const existing = await db
        .prepare(
          `SELECT id FROM gift_cards
           WHERE template_id = ? AND claimed_by_user_id = ? AND status IN ('active','redeemed')
             AND id != ?
           LIMIT 1`,
        )
        .bind(card.template_id, recipientId, cardId)
        .first<{ id: string }>();
      if (existing) {
        return NextResponse.json(
          {
            error: {
              code: 'recipient_already_has',
              message: 'This person already has this card.',
            },
          },
          { status: 409 },
        );
      }
    }

    // ── In-place transfer ────────────────────────────────────────────
    // Keep claimed_at + expires_at intact (the card was already in
    // circulation — transferring doesn't reset its lifecycle). Overwrite
    // gifter + message so the recipient sees who handed it to them.
    await db
      .prepare(
        `UPDATE gift_cards
         SET claimed_by_user_id = ?,
             gifter_user_id     = ?,
             gift_message       = ?
         WHERE id = ?`,
      )
      .bind(recipientId, senderId, giftMessage || null, cardId)
      .run();

    // ── Notify recipient — best-effort ───────────────────────────────
    try {
      const sender = await db
        .prepare(`SELECT display_name, username FROM users WHERE id = ? LIMIT 1`)
        .bind(senderId)
        .first<{ display_name: string | null; username: string | null }>();
      const senderLabel =
        sender?.display_name
        || (sender?.username ? `@${sender.username}` : 'Someone');
      const title = `🎁 ${senderLabel} sent you a gift card`;
      const notifBody = giftMessage
        ? `"${giftMessage.slice(0, 120)}"`
        : `You received "${template?.name || 'a gift card'}". Tap to open your wallet.`;
      await db
        .prepare(
          `INSERT INTO notifications (id, user_id, type, title, body, ref_type, ref_id)
           VALUES (?, ?, 'system', ?, ?, 'gift_card', ?)`,
        )
        .bind(genId('notif_'), recipientId, title, notifBody, cardId)
        .run();
    } catch (err) {
      console.error('[GiftCard transfer] notification insert failed:', err);
    }

    const updated = await db
      .prepare('SELECT * FROM gift_cards WHERE id = ?')
      .bind(cardId)
      .first<Record<string, unknown>>();

    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (err) {
    console.error('[GiftCard transfer POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to transfer card' } },
      { status: 500 },
    );
  }
}
