import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── PATCH /api/v1/bookings/:id — Update status ─────────────────────────
// Status flow: pending → confirmed → completed / canceled / no_show

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { status, checkin } = body;

    // Verify ownership
    const check = await pgPool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (check.rows.length === 0) return NextResponse.json({ error: { code: 'not_found', message: 'Booking not found' } }, { status: 404 });

    const booking = check.rows[0];
    if (booking.user_id !== userId) return NextResponse.json({ error: { code: 'forbidden', message: 'Not your booking' } }, { status: 403 });

    const sets: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let idx = 1;

    if (status) {
      sets.push(`status = $${idx++}`);
      values.push(status);
    }

    if (checkin) {
      sets.push(`checkin_at = NOW()`);
      sets.push(`checkin_verified = true`);
    }

    values.push(id);
    const result = await pgPool.query(
      `UPDATE bookings SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    const updated = result.rows[0];

    // If completed → auto-create proof + update trust
    if (status === 'completed') {
      const targetType = booking.business_id ? 'business' : 'event';
      const targetId = booking.business_id || booking.event_id;

      // Create proof
      await pgPool.query(
        `INSERT INTO proofs (user_id, proof_type, target_type, target_id, evidence_type, booking_id, trust_points, verified)
         VALUES ($1, 'booking_completed', $2, $3, 'system', $4, 3, true)`,
        [userId, targetType, targetId, id]
      ).catch(() => {});

      // Recalculate trust
      await pgPool.query('SELECT recalculate_trust_score($1)', [userId]).catch(() => {});

      // Update user bookings count
      await pgPool.query('UPDATE users SET bookings_count = bookings_count + 1, updated_at = NOW() WHERE id = $1', [userId]).catch(() => {});
    }

    // If checkin → auto-create checkin proof
    if (checkin) {
      const targetType = booking.business_id ? 'business' : 'event';
      const targetId = booking.business_id || booking.event_id;

      await pgPool.query(
        `INSERT INTO proofs (user_id, proof_type, target_type, target_id, evidence_type, booking_id, trust_points, verified)
         VALUES ($1, 'checkin_verified', $2, $3, 'system', $4, 1, true)`,
        [userId, targetType, targetId, id]
      ).catch(() => {});

      await pgPool.query('SELECT recalculate_trust_score($1)', [userId]).catch(() => {});
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[Bookings PATCH]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to update booking' } }, { status: 500 });
  }
}
