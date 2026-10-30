import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { verifyNearFunctionCall } from '@/lib/near/verify-tx';
import { notify } from '@/lib/notify';

// ─── POST /api/v1/kisses/:id/claim — Record a NEAR gift claim ─────────
//
// The actual mint/transfer/payout already happened on-chain — the
// receiver's browser called `claim_gift` directly via their own NEAR
// account (created through NEAR Auth/passkey right before this). This
// route just verifies that transaction really happened and records it,
// the same "trust the chain, not the client" pattern as the lock side
// in POST /api/v1/kisses.
//
// Claiming is separate from Open: anyone can still open/view a kiss as
// before (unchanged) — only the actual intended receiver can claim a
// money-carrying one. A kiss sent to a specific registered user
// (receiver_id set) requires being logged in as exactly that user; a
// guest-receiver kiss (no account tied to it) has no stronger identity
// to check against, so the on-chain contract's own "first claim wins,
// Pending -> Bloomed" transition is the real guard there — this route's
// `near_gift_status = 'locked'` condition on the UPDATE enforces the
// same single-claim rule on our side.

const schema = z.object({
  near_claim_tx_hash: z.string().min(10).max(128),
  near_claimer_account_id: z.string().min(2).max(64),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: 'invalid_request', message: parsed.error.issues[0].message } }, { status: 400 });
    }
    const { near_claim_tx_hash, near_claimer_account_id } = parsed.data;

    const db = getDB();
    const kiss = await db.prepare('SELECT * FROM kisses WHERE id = ?').bind(id).first<Record<string, unknown>>();
    if (!kiss) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Kiss not found' } }, { status: 404 });
    }
    if (!kiss.near_gift_status) {
      return NextResponse.json({ error: { code: 'no_gift', message: 'This kiss has no NEAR gift attached' } }, { status: 400 });
    }
    if (kiss.near_gift_status !== 'locked') {
      return NextResponse.json({ error: { code: 'already_claimed', message: 'This gift was already claimed' } }, { status: 409 });
    }

    // Registered-receiver kisses: only the intended receiver may claim.
    // Guest-receiver kisses have no account to check against — the
    // on-chain and DB "first claim wins" transitions are the guard.
    if (kiss.receiver_id) {
      const userId = await resolveUserId(req);
      if (userId !== kiss.receiver_id) {
        return NextResponse.json({ error: { code: 'forbidden', message: 'Only the intended receiver can claim this gift' } }, { status: 403 });
      }
    }

    let verified;
    try {
      verified = await verifyNearFunctionCall(near_claim_tx_hash, near_claimer_account_id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not verify the NEAR transaction';
      return NextResponse.json({ error: { code: 'near_verify_failed', message: msg } }, { status: 400 });
    }
    if (verified.methodName !== 'claim_gift') {
      return NextResponse.json({ error: { code: 'near_verify_failed', message: `Expected a claim_gift call, got ${verified.methodName}` } }, { status: 400 });
    }
    if (verified.args.gao_kiss_id !== id) {
      return NextResponse.json({ error: { code: 'near_verify_failed', message: 'This transaction claimed a different gift' } }, { status: 400 });
    }

    const row = await db.prepare(
      `UPDATE kisses SET near_gift_status = 'claimed', near_claimer_account_id = ?, near_claim_tx_hash = ?, near_claimed_at = datetime('now')
       WHERE id = ? AND near_gift_status = 'locked' RETURNING *`
    ).bind(verified.signerId, near_claim_tx_hash, id).first<Record<string, unknown>>();

    if (!row) {
      // Lost a race against another claim attempt between our read above and this write.
      return NextResponse.json({ error: { code: 'already_claimed', message: 'This gift was already claimed' } }, { status: 409 });
    }

    const senderId = row.sender_id as string;
    if (senderId) {
      notify(senderId, 'system', '💎 Your NEAR gift was claimed!', `${verified.signerId} just claimed the gift you sent.`, 'kiss', id);
    }

    return NextResponse.json({ data: row });
  } catch (err) {
    console.error('[Kiss claim POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to record claim' } }, { status: 500 });
  }
}
