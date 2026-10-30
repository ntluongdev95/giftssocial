import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/kisses/:id/claim-secret — Fetch a gift's claim secret ──
//
// Only for a REGISTERED receiver (kiss.receiver_id set): they're
// already identified by their own logged-in session, so they don't
// need to have gotten the secret from the share link/QR — this lets
// the claim UI fetch it for them automatically. A guest-receiver kiss
// (no receiver_id, no account to check a session against) is refused
// here on purpose: for those, the share link/QR itself is the only
// legitimate way to have the secret, and handing it out to "whoever is
// logged in and asks" would defeat the whole point of the mechanism
// (see contracts/kiss-chain claim_secret_hash).

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDB();
    const kiss = await db.prepare(
      'SELECT receiver_id, near_gift_status, near_claim_secret FROM kisses WHERE id = ?'
    ).bind(id).first<{ receiver_id: string | null; near_gift_status: string | null; near_claim_secret: string | null }>();

    if (!kiss) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Kiss not found' } }, { status: 404 });
    }
    if (!kiss.near_gift_status) {
      return NextResponse.json({ error: { code: 'no_gift', message: 'This kiss has no NEAR gift attached' } }, { status: 400 });
    }
    if (!kiss.receiver_id) {
      return NextResponse.json({ error: { code: 'guest_kiss', message: 'Guest-receiver gifts can only be claimed via their share link' } }, { status: 403 });
    }

    const userId = await resolveUserId(req);
    if (userId !== kiss.receiver_id) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'Only the intended receiver can fetch this' } }, { status: 403 });
    }

    return NextResponse.json({ data: { claim_secret: kiss.near_claim_secret } }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (err) {
    console.error('[Kiss claim-secret GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}
