import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pgPool } from '@/lib/db';
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

    // Check if booking exists → verified visit
    let verifiedVisit = false;
    if (d.booking_id) {
      const bk = await pgPool.query("SELECT id FROM bookings WHERE id = $1 AND user_id = $2 AND status = 'completed'", [d.booking_id, userId]);
      verifiedVisit = bk.rows.length > 0;
    }

    // Get user trust score snapshot
    let trustScore = 0;
    try {
      const u = await pgPool.query('SELECT trust_score FROM users WHERE id = $1', [userId]);
      if (u.rows.length > 0) trustScore = u.rows[0].trust_score;
    } catch {}

    const result = await pgPool.query(
      `INSERT INTO reviews (author_id, business_id, event_id, booking_id, rating, title, body, verified_visit, author_trust_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [userId, d.business_id || null, d.event_id || null, d.booking_id || null, d.rating, d.title, d.body, verifiedVisit, trustScore]
    );

    // Update business rating
    if (d.business_id) {
      await pgPool.query('SELECT update_business_rating($1)', [d.business_id]).catch(() => {});
    }

    // Auto-create proof
    const targetType = d.business_id ? 'business' : 'event';
    const targetId = d.business_id || d.event_id;
    await pgPool.query(
      `INSERT INTO proofs (user_id, proof_type, target_type, target_id, evidence_type, review_id, trust_points, verified)
       VALUES ($1, 'review_submitted', $2, $3, 'system', $4, 2, true)`,
      [userId, targetType, targetId, result.rows[0].id]
    ).catch(() => {});

    // Recalculate trust
    await pgPool.query('SELECT recalculate_trust_score($1)', [userId]).catch(() => {});
    await pgPool.query('UPDATE users SET reviews_count = reviews_count + 1, updated_at = NOW() WHERE id = $1', [userId]).catch(() => {});

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
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

    let query = `SELECT r.*, u.username AS author_username, u.display_name AS author_name, u.avatar_url AS author_avatar
                 FROM reviews r LEFT JOIN users u ON u.id = r.author_id WHERE r.status = 'active'`;
    const values: unknown[] = [];

    if (businessId) { query += ` AND r.business_id = $1`; values.push(businessId); }
    else if (eventId) { query += ` AND r.event_id = $1`; values.push(eventId); }
    else return NextResponse.json({ data: [] });

    query += ' ORDER BY r.created_at DESC LIMIT 50';

    const result = await pgPool.query(query, values);
    return NextResponse.json({ data: result.rows });
  } catch (err) {
    console.error('[Reviews GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch reviews' } }, { status: 500 });
  }
}
