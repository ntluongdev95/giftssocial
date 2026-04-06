import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── POST /api/v1/reviews — Create review ────────────────────────────────

const reviewSchema = z.object({
  business_id: z.string().optional(),
  event_id: z.string().optional(),
  booking_id: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).default(''),
  body: z.string().max(2000).default(''),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const data = await req.json();
    const parsed = reviewSchema.safeParse(data);
    if (!parsed.success) return NextResponse.json({ error: { code: 'invalid_request', message: parsed.error.issues[0].message } }, { status: 400 });

    const d = parsed.data;
    if (!d.business_id && !d.event_id) return NextResponse.json({ error: { code: 'invalid_request', message: 'business_id or event_id required' } }, { status: 400 });

    const db = getDB();

    // Check if booking exists → verified visit
    let verifiedVisit = false;
    if (d.booking_id) {
      const bk = await db.prepare(
        "SELECT id FROM bookings WHERE id = ? AND user_id = ? AND status = 'completed'"
      ).bind(d.booking_id, userId).first();
      verifiedVisit = !!bk;
    }

    // Get user trust score snapshot
    let trustScore = 0;
    try {
      const u = await db.prepare('SELECT trust_score FROM users WHERE id = ?').bind(userId).first<{ trust_score: number }>();
      if (u) trustScore = u.trust_score;
    } catch {}

    const id = genId('rev_');
    const row = await db.prepare(
      `INSERT INTO reviews (id, author_id, business_id, event_id, booking_id, rating, title, body, verified_visit, author_trust_score)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       RETURNING *`
    ).bind(id, userId, d.business_id || null, d.event_id || null, d.booking_id || null, d.rating, d.title, d.body, verifiedVisit ? 1 : 0, trustScore).first<Record<string, unknown>>();

    // Auto-create proof
    const targetType = d.business_id ? 'business' : 'event';
    const targetId = d.business_id || d.event_id;
    const proofId = genId('prf_');
    await db.prepare(
      `INSERT INTO proofs (id, user_id, proof_type, target_type, target_id, evidence_type, review_id, trust_points, verified)
       VALUES (?, ?, 'review_submitted', ?, ?, 'system', ?, 2, 1)`
    ).bind(proofId, userId, targetType, targetId, id).run().catch(() => {});

    // Update user reviews count
    await db.prepare("UPDATE users SET reviews_count = reviews_count + 1, updated_at = datetime('now') WHERE id = ?").bind(userId).run().catch(() => {});

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    console.error('[Reviews POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to create review' } }, { status: 500 });
  }
}

// ─── GET /api/v1/reviews?business_id=&event_id= ─────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const businessId = searchParams.get('business_id');
    const eventId = searchParams.get('event_id');

    const db = getDB();

    if (businessId) {
      const result = await db.prepare(
        `SELECT r.*, u.username AS author_username, u.display_name AS author_name, u.avatar_url AS author_avatar
         FROM reviews r LEFT JOIN users u ON u.id = r.author_id
         WHERE r.status = 'active' AND r.business_id = ?
         ORDER BY r.created_at DESC LIMIT 50`
      ).bind(businessId).all<Record<string, unknown>>();
      return NextResponse.json({ data: result.results });
    } else if (eventId) {
      const result = await db.prepare(
        `SELECT r.*, u.username AS author_username, u.display_name AS author_name, u.avatar_url AS author_avatar
         FROM reviews r LEFT JOIN users u ON u.id = r.author_id
         WHERE r.status = 'active' AND r.event_id = ?
         ORDER BY r.created_at DESC LIMIT 50`
      ).bind(eventId).all<Record<string, unknown>>();
      return NextResponse.json({ data: result.results });
    } else {
      return NextResponse.json({ data: [] });
    }
  } catch (err) {
    console.error('[Reviews GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch reviews' } }, { status: 500 });
  }
}
