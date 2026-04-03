import { NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import {
  SEED_BUSINESSES,
  SEED_CIRCLES,
  SEED_EVENTS,
} from '@/lib/seed';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Seed not allowed in production' } },
      { status: 403 }
    );
  }

  const results: Record<string, string> = {};

  try {
    // ─── PostgreSQL: Businesses ────────────────────────────────────────
    for (const biz of SEED_BUSINESSES) {
      await pgPool.query(
        `INSERT INTO businesses (id, name, category, description, location_lat, location_lng,
          trust_score, trust_level, badges, proof_count, rating_avg, rating_count,
          booking_enabled, payment_enabled, status, hours, owner_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
                 COALESCE((SELECT id FROM users LIMIT 1), 'user_system'))
         ON CONFLICT (id) DO NOTHING`,
        [
          biz.id, biz.name, biz.category, biz.description,
          biz.location_lat, biz.location_lng, biz.trust_score,
          biz.trust_level, biz.badges, biz.proof_count,
          biz.rating_avg, biz.rating_count, biz.booking_enabled,
          biz.payment_enabled, biz.status, JSON.stringify(biz.hours),
        ]
      );
    }
    results.businesses = `${SEED_BUSINESSES.length} seeded`;

    // ─── PostgreSQL: Circles ──────────────────────────────────────────
    for (const circle of SEED_CIRCLES) {
      await pgPool.query(
        `INSERT INTO circles (id, name, slug, category, city, description, owner_id,
          visibility, verification_level, trust_score, trust_level, badges,
          member_count, event_count, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (id) DO NOTHING`,
        [
          circle.id, circle.name, circle.slug, circle.category,
          circle.city, circle.description, circle.owner_id,
          circle.visibility, circle.verification_level, circle.trust_score,
          circle.trust_level, circle.badges, circle.member_count,
          circle.event_count, circle.status,
        ]
      );
    }
    results.circles = `${SEED_CIRCLES.length} seeded`;

    // ─── PostgreSQL: Events ───────────────────────────────────────────
    for (const event of SEED_EVENTS) {
      await pgPool.query(
        `INSERT INTO events (id, title, description, host_type, host_id,
          location_name, location_lat, location_lng, start_time, end_time,
          capacity, joined_count, checkin_count, visibility, verified, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (id) DO NOTHING`,
        [
          event.id, event.title, event.description, event.host_type,
          event.host_id, event.location_name, event.location_lat,
          event.location_lng, event.start_time, event.end_time,
          event.capacity, event.joined_count, event.checkin_count,
          event.visibility, event.verified, event.status,
        ]
      );
    }
    results.events = `${SEED_EVENTS.length} seeded`;

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error('[Seed]', err);
    return NextResponse.json(
      { error: { code: 'seed_failed', message: String(err) } },
      { status: 500 }
    );
  }
}
