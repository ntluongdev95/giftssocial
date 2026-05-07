import { NextRequest, NextResponse } from 'next/server';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';

// ─── POST /api/v1/checkins — Check in at a location ─────────────────────

// Haversine distance in meters
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

const MAX_VENUE_DISTANCE_METERS = 120;  // generous — GPS accuracy varies indoor
const MAX_GPS_ACCURACY_METERS = 80;     // reject readings worse than this
const CHECKIN_COOLDOWN_PER_VENUE_HOURS = 12;
const MIN_GAP_BETWEEN_CHECKINS_SECONDS = 90;

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const { target_type, target_id, location_lat, location_lng, accuracy, method, booking_id } = await req.json();

    if (!target_type || location_lat == null || location_lng == null) {
      return NextResponse.json({ error: { code: 'invalid_request', message: 'target_type, location_lat, location_lng required' } }, { status: 400 });
    }

    const db = getDB();

    // Geo verification — only for location-based check-ins (QR/NFC bypass, manual stays server-trusted)
    if ((method || 'location') === 'location' && target_type === 'business' && target_id) {
      if (typeof accuracy === 'number' && accuracy > MAX_GPS_ACCURACY_METERS) {
        return NextResponse.json({ error: { code: 'low_accuracy', message: "Can't verify you're at the venue. Turn on precise location, make sure you're standing at the spot, and try again." } }, { status: 400 });
      }
      const venue = await db.prepare('SELECT location_lat AS lat, location_lng AS lng FROM businesses WHERE id = ?')
        .bind(target_id).first<{ lat: number; lng: number }>();
      if (!venue || venue.lat == null || venue.lng == null) {
        return NextResponse.json({ error: { code: 'not_found', message: 'Venue not found' } }, { status: 404 });
      }
      const d = distanceMeters(Number(location_lat), Number(location_lng), venue.lat, venue.lng);
      const tolerance = MAX_VENUE_DISTANCE_METERS + (typeof accuracy === 'number' ? accuracy : 0);
      if (d > tolerance) {
        return NextResponse.json({ error: { code: 'too_far', message: `You're not at the venue yet — about ${Math.round(d)}m away. Walk closer to check in.` } }, { status: 400 });
      }

      // Cooldown: same venue once per 12h
      const recent = await db.prepare(
        `SELECT id FROM checkins
         WHERE user_id = ? AND target_type = ? AND target_id = ?
           AND datetime(created_at) > datetime('now', '-' || ? || ' hours')
         LIMIT 1`
      ).bind(userId, target_type, target_id, CHECKIN_COOLDOWN_PER_VENUE_HOURS).first();
      if (recent) {
        return NextResponse.json({ error: { code: 'cooldown', message: 'Already checked in here recently' } }, { status: 429 });
      }

      // Anti-teleport: can't check-in anywhere within 90 seconds
      const tooSoon = await db.prepare(
        `SELECT id FROM checkins
         WHERE user_id = ?
           AND datetime(created_at) > datetime('now', '-' || ? || ' seconds')
         LIMIT 1`
      ).bind(userId, MIN_GAP_BETWEEN_CHECKINS_SECONDS).first();
      if (tooSoon) {
        return NextResponse.json({ error: { code: 'throttled', message: 'Slow down — wait a minute before the next check-in' } }, { status: 429 });
      }
    }

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
