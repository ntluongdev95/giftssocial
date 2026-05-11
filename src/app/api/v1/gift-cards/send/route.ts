import { NextRequest, NextResponse } from 'next/server';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// POST /api/v1/gift-cards/send
//
// Send a gift card to another Gao Social user. This is the social/P2P
// path — instead of dropping a link and waiting for the recipient to
// claim, the sender hand-picks a user and the card lands in their wallet
// immediately (with a notification).
//
// Auth: required. Anyone signed in can send any active template — the
// merchant flow (gift a customer from /me/gift-cards) and the
// peer-to-peer flow (share a discovered drop) both call this endpoint.
//
// Body:
//   {
//     template_id:        string,
//     recipient_user_id:  string,
//     gift_message?:      string   // max 280 chars
//   }
//
// Side effects:
//   • inserts a row in gift_cards with gifter_user_id + gift_message set
//   • bumps gift_card_templates.current_claims
//   • inserts a notification for the recipient (type='system',
//     ref_type='gift_card', ref_id=card.id) — failure tolerated.

interface TemplateRow {
  id: string;
  business_id: string;
  owner_user_id: string;
  type: 'voucher' | 'stored_value' | 'service' | 'loyalty';
  face_value: number;
  status: 'draft' | 'active' | 'paused' | 'archived';
  starts_at: string | null;
  ends_at: string | null;
  max_claims: number;
  current_claims: number;
  one_per_user: number;
  expires_in_days: number;
  name: string;
}

export async function POST(req: NextRequest) {
  try {
    const senderId = await resolveUserId(req);
    if (!senderId) {
      return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      template_id?: string;
      recipient_user_id?: string;
      gift_message?: string;
    };
    const templateId = body.template_id?.trim();
    const recipientId = body.recipient_user_id?.trim();
    const giftMessage = (body.gift_message || '').trim().slice(0, 280);

    if (!templateId || !recipientId) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'template_id and recipient_user_id are required' } },
        { status: 400 },
      );
    }
    if (recipientId === senderId) {
      return NextResponse.json(
        { error: { code: 'self_gift', message: 'You cannot gift a card to yourself' } },
        { status: 400 },
      );
    }

    const db = getDB();

    // ── Load + validate template ─────────────────────────────────────
    const t = await db
      .prepare(`SELECT * FROM gift_card_templates WHERE id = ? LIMIT 1`)
      .bind(templateId)
      .first<TemplateRow>();
    if (!t) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Template not found' } }, { status: 404 });
    }
    if (t.status !== 'active') {
      return NextResponse.json({ error: { code: 'not_active', message: 'This drop is not active' } }, { status: 400 });
    }
    const now = Date.now();
    if (t.starts_at && Date.parse(t.starts_at) > now) {
      return NextResponse.json({ error: { code: 'not_started', message: 'This drop has not started yet' } }, { status: 400 });
    }
    if (t.ends_at && Date.parse(t.ends_at) < now) {
      return NextResponse.json({ error: { code: 'ended', message: 'This drop has ended' } }, { status: 400 });
    }
    if (t.max_claims > 0 && t.current_claims >= t.max_claims) {
      return NextResponse.json({ error: { code: 'sold_out', message: 'No claims left on this drop' } }, { status: 400 });
    }

    // ── Validate recipient exists ────────────────────────────────────
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

    // ── one_per_user — check against the RECIPIENT, not the sender ──
    if (t.one_per_user) {
      const existing = await db
        .prepare(
          `SELECT id FROM gift_cards
           WHERE template_id = ? AND claimed_by_user_id = ? AND status IN ('active','redeemed')
           LIMIT 1`,
        )
        .bind(t.id, recipientId)
        .first<{ id: string }>();
      if (existing) {
        return NextResponse.json(
          {
            error: {
              code: 'recipient_already_has',
              message: 'This person already has this gift card',
            },
          },
          { status: 409 },
        );
      }
    }

    // ── Create the card on the recipient's behalf ───────────────────
    const cardId = genId('gc_');
    const expiresAt = new Date(now + t.expires_in_days * 24 * 60 * 60 * 1000).toISOString();
    const valueRemaining = t.type === 'stored_value' ? t.face_value : 0;
    const usesRemaining = t.type === 'loyalty' ? Math.max(t.face_value || 10, 1) : 1;

    await db
      .prepare(
        `INSERT INTO gift_cards
         (id, template_id, business_id, claimed_by_user_id, expires_at,
          value_remaining, uses_remaining, status, gifter_user_id, gift_message)
         VALUES (?,?,?,?,?,?,?,'active',?,?)`,
      )
      .bind(
        cardId,
        t.id,
        t.business_id,
        recipientId,
        expiresAt,
        valueRemaining,
        usesRemaining,
        senderId,
        giftMessage || null,
      )
      .run();

    await db
      .prepare(`UPDATE gift_card_templates SET current_claims = current_claims + 1 WHERE id = ?`)
      .bind(t.id)
      .run();

    // ── Notify recipient — best-effort, don't fail the gift if this errors.
    // Uses type='system' because the table's CHECK constraint doesn't
    // include a gift-specific type yet. ref_type/ref_id let the client
    // deep-link straight to the wallet card.
    try {
      const sender = await db
        .prepare(`SELECT display_name, username FROM users WHERE id = ? LIMIT 1`)
        .bind(senderId)
        .first<{ display_name: string | null; username: string | null }>();
      const senderLabel = sender?.display_name || (sender?.username ? `@${sender.username}` : 'Someone');
      const title = `🎁 ${senderLabel} sent you a gift`;
      const notifBody = giftMessage
        ? `"${giftMessage.slice(0, 120)}"`
        : `You received "${t.name}". Tap to open your wallet.`;
      await db
        .prepare(
          `INSERT INTO notifications (id, user_id, type, title, body, ref_type, ref_id)
           VALUES (?, ?, 'system', ?, ?, 'gift_card', ?)`,
        )
        .bind(genId('notif_'), recipientId, title, notifBody, cardId)
        .run();
    } catch (err) {
      console.error('[GiftCard send] notification insert failed:', err);
    }

    const created = await db
      .prepare('SELECT * FROM gift_cards WHERE id = ?')
      .bind(cardId)
      .first<Record<string, unknown>>();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error('[GiftCard send POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to send gift' } },
      { status: 500 },
    );
  }
}
