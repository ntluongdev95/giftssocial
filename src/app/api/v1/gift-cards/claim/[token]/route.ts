import { NextRequest, NextResponse } from 'next/server';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── Shared helpers ───────────────────────────────────────────────────────

interface TemplateRow {
  id: string;
  business_id: string;
  owner_user_id: string;
  name: string;
  description: string;
  type: 'voucher' | 'stored_value' | 'service' | 'loyalty';
  face_value: number;
  percent_off: number;
  amount_off: number;
  service_name: string | null;
  currency: string;
  cover_image: string | null;
  gradient_from: string;
  gradient_to: string;
  claim_token: string;
  max_claims: number;
  current_claims: number;
  one_per_user: number;
  starts_at: string | null;
  ends_at: string | null;
  expires_in_days: number;
  status: 'draft' | 'active' | 'paused' | 'archived';
  business_name: string | null;
  business_cover: string | null;
}

type EligibilityCode =
  | 'ok'
  | 'not_active'
  | 'not_started'
  | 'ended'
  | 'sold_out'
  | 'already_claimed';

function checkEligibility(t: TemplateRow): EligibilityCode {
  if (t.status !== 'active') return 'not_active';
  const now = Date.now();
  if (t.starts_at && Date.parse(t.starts_at) > now) return 'not_started';
  if (t.ends_at && Date.parse(t.ends_at) < now) return 'ended';
  if (t.max_claims > 0 && t.current_claims >= t.max_claims) return 'sold_out';
  return 'ok';
}

// ─── GET — public template lookup + per-user eligibility ──────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!token) return NextResponse.json({ error: { code: 'invalid_token' } }, { status: 400 });

    const db = getDB();
    // JOIN approved marketplace application to surface the biz's registered
    // Gao domain — used by the wallet-payment flow to look up the recipient
    // chain/address. A biz may have multiple applications over time; we take
    // the most recent approved one.
    const t = await db
      .prepare(
        `SELECT t.*, b.name AS business_name, b.cover_image AS business_cover,
                (
                  SELECT a.gao_domain FROM marketplace_applications a
                  WHERE a.business_id = t.business_id AND a.status = 'approved'
                  ORDER BY a.reviewed_at DESC LIMIT 1
                ) AS business_gao_domain
         FROM gift_card_templates t
         LEFT JOIN businesses b ON b.id = t.business_id
         WHERE t.claim_token = ?
         LIMIT 1`
      )
      .bind(token)
      .first<TemplateRow & { business_gao_domain: string | null }>();
    if (!t) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

    let alreadyClaimed = false;
    let myCardId: string | null = null;
    const userId = await resolveUserId(req).catch(() => null);
    if (userId && t.one_per_user) {
      const existing = await db
        .prepare(
          `SELECT id FROM gift_cards
           WHERE template_id = ? AND claimed_by_user_id = ? AND status IN ('active','redeemed')
           LIMIT 1`
        )
        .bind(t.id, userId)
        .first<{ id: string }>();
      if (existing) {
        alreadyClaimed = true;
        myCardId = existing.id;
      }
    }

    const baseEligibility = checkEligibility(t);
    const eligibility: EligibilityCode = alreadyClaimed ? 'already_claimed' : baseEligibility;

    return NextResponse.json({
      data: {
        template: t,
        eligibility,
        is_logged_in: !!userId,
        my_card_id: myCardId,
      },
    });
  } catch (err) {
    console.error('[GiftCard claim GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to load drop' } },
      { status: 500 }
    );
  }
}

// ─── POST — actually claim the card (auth required) ──────────────────────

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

    const db = getDB();
    const t = await db
      .prepare(`SELECT * FROM gift_card_templates WHERE claim_token = ? LIMIT 1`)
      .bind(token)
      .first<TemplateRow>();
    if (!t) return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });

    // Self-claim prevention: business owner shouldn't claim their own drop.
    if (t.owner_user_id === userId) {
      return NextResponse.json(
        { error: { code: 'owner_cannot_claim', message: 'You cannot claim your own gift card' } },
        { status: 400 }
      );
    }

    const eligibility = checkEligibility(t);
    if (eligibility !== 'ok') {
      return NextResponse.json({ error: { code: eligibility } }, { status: 400 });
    }

    // One-per-user check
    if (t.one_per_user) {
      const existing = await db
        .prepare(
          `SELECT id FROM gift_cards
           WHERE template_id = ? AND claimed_by_user_id = ? AND status IN ('active','redeemed')
           LIMIT 1`
        )
        .bind(t.id, userId)
        .first<{ id: string }>();
      if (existing) {
        return NextResponse.json(
          { error: { code: 'already_claimed', message: 'You already claimed this card' }, data: { card_id: existing.id } },
          { status: 409 }
        );
      }
    }

    // Compute card-level fields
    const cardId = genId('gc_');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + t.expires_in_days * 24 * 60 * 60 * 1000).toISOString();

    // Initial mutable state per type
    const valueRemaining = t.type === 'stored_value' ? t.face_value : 0;
    const usesRemaining = t.type === 'loyalty' ? Math.max(t.face_value || 10, 1) : 1; // loyalty stamps default 10 if not set

    await db
      .prepare(
        `INSERT INTO gift_cards
         (id, template_id, business_id, claimed_by_user_id, expires_at,
          value_remaining, uses_remaining, status)
         VALUES (?,?,?,?,?,?,?,'active')`
      )
      .bind(cardId, t.id, t.business_id, userId, expiresAt, valueRemaining, usesRemaining)
      .run();

    // Bump claims counter
    await db
      .prepare(`UPDATE gift_card_templates SET current_claims = current_claims + 1 WHERE id = ?`)
      .bind(t.id)
      .run();

    const created = await db
      .prepare('SELECT * FROM gift_cards WHERE id = ?')
      .bind(cardId)
      .first<Record<string, unknown>>();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error('[GiftCard claim POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to claim' } },
      { status: 500 }
    );
  }
}
