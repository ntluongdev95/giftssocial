import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
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

    // Create checkin
    const result = await pgPool.query(
      `INSERT INTO checkins (user_id, target_type, target_id, location_lat, location_lng, method, booking_id, verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *`,
      [userId, target_type, target_id || null, location_lat, location_lng, method || 'location', booking_id || null]
    );

    const checkin = result.rows[0];

    // Auto-create proof
    await pgPool.query(
      `INSERT INTO proofs (user_id, proof_type, target_type, target_id, evidence_type, trust_points, verified)
       VALUES ($1, 'checkin_verified', $2, $3, $4, 1, true)`,
      [userId, target_type, target_id || null, method || 'location']
    ).catch(() => {});

    // Recalculate trust
    await pgPool.query('SELECT recalculate_trust_score($1)', [userId]).catch(() => {});

    // Earn Gao points
    await pgPool.query('UPDATE users SET gao_points = gao_points + 5, updated_at = NOW() WHERE id = $1', [userId]).catch(() => {});
    await pgPool.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, source, ref_type, ref_id, description)
       VALUES ($1, 'earn', 5, (SELECT gao_points FROM users WHERE id = $1), 'checkin', 'checkin', $2, 'Check-in reward')`,
      [userId, checkin.id]
    ).catch(() => {});

    // Notification
    notify(userId, 'proof_earned', 'Check-in verified! +5 Gao Points', `Earned proof at ${target_type}`, 'checkin', checkin.id);

    // If business checkin, update business proof count
    if (target_type === 'business' && target_id) {
      await pgPool.query('UPDATE businesses SET proof_count = proof_count + 1 WHERE id = $1', [target_id]).catch(() => {});
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

    const result = await pgPool.query(
      'SELECT * FROM checkins WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [userId]
    );
    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error('[Checkins GET]', err);
    return NextResponse.json({ error: { code: 'internal_error' } }, { status: 500 });
  }
}
