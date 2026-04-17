import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import {
  SEED_USERS,
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

  const db = getDB();
  const results: Record<string, string> = {};

  try {
    // ─── D1: Users ────────────────────────────────────────────────────
    for (const user of SEED_USERS) {
      await db.prepare(
        `INSERT OR IGNORE INTO users
           (id, username, display_name, email, avatar_url, bio, city,
            location_lat, location_lng, trust_score, trust_level, badges,
            role, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        user.id, user.username, user.display_name, user.email,
        user.avatar_url, user.bio, user.city,
        user.location_lat, user.location_lng,
        user.trust_score, user.trust_level, user.badges,
        user.role, user.status,
      ).run();
    }
    results.users = `${SEED_USERS.length} seeded`;

    // Resolve a system owner user ID for businesses
    const systemUser = await db.prepare('SELECT id FROM users LIMIT 1').first<{ id: string }>();
    const ownerUserId = systemUser?.id || 'user_system';

    // ─── D1: Businesses ───────────────────────────────────────────────
    for (const biz of SEED_BUSINESSES) {
      await db.prepare(
        `INSERT OR IGNORE INTO businesses (id, name, category, description, location_lat, location_lng,
          trust_score, trust_level, badges, proof_count, rating_avg, rating_count,
          booking_enabled, payment_enabled, status, hours, owner_user_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        biz.id, biz.name, biz.category, biz.description,
        biz.location_lat, biz.location_lng, biz.trust_score,
        biz.trust_level, biz.badges, biz.proof_count,
        biz.rating_avg, biz.rating_count, biz.booking_enabled ? 1 : 0,
        biz.payment_enabled ? 1 : 0, biz.status, JSON.stringify(biz.hours),
        ownerUserId,
      ).run();
    }
    results.businesses = `${SEED_BUSINESSES.length} seeded`;

    // ─── D1: Circles ──────────────────────────────────────────────────
    for (const circle of SEED_CIRCLES) {
      await db.prepare(
        `INSERT OR IGNORE INTO circles (id, name, slug, category, city, description, owner_id,
          visibility, verification_level, trust_score, trust_level, badges,
          member_count, event_count, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        circle.id, circle.name, circle.slug, circle.category,
        circle.city, circle.description, circle.owner_id,
        circle.visibility, circle.verification_level, circle.trust_score,
        circle.trust_level, circle.badges, circle.member_count,
        circle.event_count, circle.status,
      ).run();
    }
    results.circles = `${SEED_CIRCLES.length} seeded`;

    // ─── D1: Events ───────────────────────────────────────────────────
    for (const event of SEED_EVENTS) {
      await db.prepare(
        `INSERT OR IGNORE INTO events (id, title, description, host_type, host_id,
          location_name, location_lat, location_lng, start_time, end_time,
          capacity, joined_count, checkin_count, visibility, verified, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        event.id, event.title, event.description, event.host_type,
        event.host_id, event.location_name, event.location_lat,
        event.location_lng, event.start_time, event.end_time,
        event.capacity, event.joined_count, event.checkin_count,
        event.visibility, event.verified ? 1 : 0, event.status,
      ).run();
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
