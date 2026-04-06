import { NextRequest, NextResponse } from 'next/server';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';

// ─── POST /api/v1/checkins — Check in at a location ─────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const { target_type, target_id, location_lat, location_lng, method, booking_id } = await req.json();

    if (!target_type || !location_lat || !location_lng) {
      return NextResponse.json({ error: { code: 'invalid_request', message: 'target_type, location_lat, location_lng required' } }, { status: 400 });
    }

    const db = getDB();
    const id = genId('ci_');

    // Create checkin
    const checkin = await db.prepare(
      `INSERT INTO checkins (id, user_id, target_type, target_id, location_lat, location_lng, method, booking_id, verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1) RETURNING *`
    ).bind(id, userId, target_type, target_id || null, location_lat, location_lng, method || 'location', booking_id || null).first<Record<string, unknown>>();

    // Auto-create proof
    const proofId = genId('prf_');
    await db.prepare(
      `INSERT INTO proofs (id, user_id, proof_type, target_type, target_id, evidence_type, trust_points, verified)
       VALUES (?, ?, 'checkin_verified', ?, ?, ?, 1, 1)`
    ).bind(proofId, userId, target_type, target_id || null, method || 'location').run().catch(() => {});

    // Earn Gao points
    await db.prepare("UPDATE users SET gao_points = gao_points + 5, updated_at = datetime('now') WHERE id = ?").bind(userId).run().catch(() => {});
    const userRow = await db.prepare('SELECT gao_points FROM users WHERE id = ?').bind(userId).first<{ gao_points: number }>();
    const newBalance = userRow?.gao_points ?? 0;
    const txId = genId('tx_');
    await db.prepare(
      `INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, source, ref_type, ref_id, description)
       VALUES (?, ?, 'earn', 5, ?, 'checkin', 'checkin', ?, 'Check-in reward')`
    ).bind(txId, userId, newBalance, checkin?.id || id).run().catch(() => {});

    // Notification
    notify(userId, 'proof_earned', 'Check-in verified! +5 Gao Points', `Earned proof at ${target_type}`, 'checkin', checkin?.id as string || id);

    // If business checkin, update business proof count
    if (target_type === 'business' && target_id) {
      await db.prepare('UPDATE businesses SET proof_count = proof_count + 1 WHERE id = ?').bind(target_id).run().catch(() => {});
    }

    return NextResponse.json({ data: { ...checkin, points_earned: 5 } }, { status: 201 });
  } catch (err) {
    console.error('[Checkins POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to check in' } }, { status: 500 });
  }
}

// ─── GET /api/v1/checkins — My checkins ──────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ data: [] });

    const db = getDB();
    const result = await db.prepare(
      'SELECT * FROM checkins WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    ).bind(userId).all<Record<string, unknown>>();
    return NextResponse.json({ data: result.results });
  } catch (err) {
    console.error('[Checkins GET]', err);
    return NextResponse.json({ error: { code: 'internal_error' } }, { status: 500 });
  }
}
