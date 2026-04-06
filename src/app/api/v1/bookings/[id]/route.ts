import { NextRequest, NextResponse } from 'next/server';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';

// ─── PATCH /api/v1/bookings/:id — Update status ─────────────────────────
// Status flow: pending → confirmed → completed / canceled / no_show

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { status, checkin } = body;

    const db = getDB();

    // Verify ownership
    const booking = await db.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first<Record<string, unknown>>();
    if (!booking) return NextResponse.json({ error: { code: 'not_found', message: 'Booking not found' } }, { status: 404 });
    if (booking.user_id !== userId) return NextResponse.json({ error: { code: 'forbidden', message: 'Not your booking' } }, { status: 403 });

    const sets: string[] = ["updated_at = datetime('now')"];
    const values: unknown[] = [];

    if (status) {
      sets.push(`status = ?`);
      values.push(status);
    }

    if (checkin) {
      sets.push(`checkin_at = datetime('now')`);
      sets.push(`checkin_verified = 1`);
    }

    values.push(id);
    const updated = await db.prepare(
      `UPDATE bookings SET ${sets.join(', ')} WHERE id = ? RETURNING *`
    ).bind(...values).first<Record<string, unknown>>();

    // If completed → auto-create proof + update trust
    if (status === 'completed') {
      const targetType = booking.business_id ? 'business' : 'event';
      const targetId = (booking.business_id || booking.event_id) as string;

      // Create proof
      const proofId = genId('prf_');
      await db.prepare(
        `INSERT INTO proofs (id, user_id, proof_type, target_type, target_id, evidence_type, booking_id, trust_points, verified)
         VALUES (?, ?, 'booking_completed', ?, ?, 'system', ?, 3, 1)`
      ).bind(proofId, userId, targetType, targetId, id).run().catch(() => {});

      // Update user bookings count
      await db.prepare('UPDATE users SET bookings_count = bookings_count + 1, updated_at = datetime(\'now\') WHERE id = ?').bind(userId).run().catch(() => {});

      // Earn Gao points
      await db.prepare("UPDATE users SET gao_points = gao_points + 10, updated_at = datetime('now') WHERE id = ?").bind(userId).run().catch(() => {});

      // Get new balance
      const userRow = await db.prepare('SELECT gao_points FROM users WHERE id = ?').bind(userId).first<{ gao_points: number }>();
      const newBalance = userRow?.gao_points ?? 0;
      const txId = genId('tx_');
      await db.prepare(
        `INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, source, ref_type, ref_id, description)
         VALUES (?, ?, 'earn', 10, ?, 'booking_complete', 'booking', ?, 'Booking completed reward')`
      ).bind(txId, userId, newBalance, id).run().catch(() => {});

      // Notification
      notify(userId, 'proof_earned', 'Booking completed! +3 trust +10 points', `Earned proof for ${booking.service_name || 'booking'}`, 'booking', id);
    }

    // If checkin → auto-create checkin proof
    if (checkin) {
      const targetType = booking.business_id ? 'business' : 'event';
      const targetId = (booking.business_id || booking.event_id) as string;

      const proofId = genId('prf_');
      await db.prepare(
        `INSERT INTO proofs (id, user_id, proof_type, target_type, target_id, evidence_type, booking_id, trust_points, verified)
         VALUES (?, ?, 'checkin_verified', ?, ?, 'system', ?, 1, 1)`
      ).bind(proofId, userId, targetType, targetId, id).run().catch(() => {});
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[Bookings PATCH]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to update booking' } }, { status: 500 });
  }
}
