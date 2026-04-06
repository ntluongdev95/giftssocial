import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── POST /api/v1/bookings — Create booking ─────────────────────────────

const bookingSchema = z.object({
  business_id: z.string().optional(),
  event_id: z.string().optional(),
  service_name: z.string().max(200).optional(),
  slot_time: z.string().optional(),
  party_size: z.number().int().min(1).default(1),
  notes: z.string().max(500).default(''),
  amount: z.number().min(0).default(0),
  currency: z.string().max(3).default('USD'),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const body = await req.json();
    const parsed = bookingSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: { code: 'invalid_request', message: parsed.error.issues[0].message } }, { status: 400 });

    const d = parsed.data;
    if (!d.business_id && !d.event_id) return NextResponse.json({ error: { code: 'invalid_request', message: 'business_id or event_id required' } }, { status: 400 });

    const db = getDB();
    const id = genId('bk_');
    const row = await db.prepare(
      `INSERT INTO bookings (id, user_id, business_id, event_id, service_name, slot_time, party_size, notes, amount, currency)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       RETURNING *`
    ).bind(id, userId, d.business_id || null, d.event_id || null, d.service_name || null, d.slot_time || null, d.party_size, d.notes, d.amount, d.currency).first();

    // If booking an event, increment joined_count
    if (d.event_id) {
      await db.prepare('UPDATE events SET joined_count = joined_count + 1 WHERE id = ?').bind(d.event_id).run().catch(() => {});
    }

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    console.error('[Bookings POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to create booking' } }, { status: 500 });
  }
}
