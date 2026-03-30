import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectMongo } from '@/lib/db';
import { pgPool, redis } from '@/lib/db';
import Signal from '@/models/Signal';

// ─── GET /api/v1/signals ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const lat = parseFloat(searchParams.get('lat') || '32.7767');
    const lng = parseFloat(searchParams.get('lng') || '-96.797');
    const radius = Math.min(parseInt(searchParams.get('radius') || '5000'), 50000);
    const types = searchParams.get('types')?.split(',');
    const categories = searchParams.get('categories')?.split(',');
    const verifiedOnly = searchParams.get('verified_only') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const cursor = searchParams.get('cursor');

    await connectMongo();

    const query: Record<string, unknown> = {
      location: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radius,
        },
      },
      status: 'active',
      expires_at: { $gt: new Date() },
      visibility: 'public',
    };

    if (types && types.length > 0) query.type = { $in: types };
    if (categories && categories.length > 0) query.category = { $in: categories };
    if (verifiedOnly) query.trust_score_snapshot = { $gte: 60 };
    if (cursor) query._id = { $gt: cursor };

    const signals = await Signal.find(query).limit(limit + 1).lean();

    const hasMore = signals.length > limit;
    const items = hasMore ? signals.slice(0, limit) : signals;
    const nextCursor = hasMore ? items[items.length - 1]._id : null;

    return NextResponse.json({
      data: items,
      pagination: { cursor: nextCursor, limit, has_more: hasMore },
    });
  } catch (err) {
    console.error('[Signals GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch signals' } },
      { status: 500 }
    );
  }
}

// ─── POST /api/v1/signals ─────────────────────────────────────────────────

const createSchema = z.object({
  type: z.enum(['presence', 'intent', 'offer', 'event', 'update', 'proof']),
  title: z.string().min(1).max(120),
  category: z.string().min(1).default('general'),
  description: z.string().max(500).optional(),
  location: z.object({
    type: z.literal('Point').default('Point'),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  radius: z.number().min(50).max(50000).default(300),
  visibility: z.enum(['public', 'circle', 'private']).default('public'),
  expires_at: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

const DEFAULT_DURATIONS: Record<string, number> = {
  presence: 2 * 60 * 60 * 1000,
  intent: 4 * 60 * 60 * 1000,
  offer: 8 * 60 * 60 * 1000,
  event: 24 * 60 * 60 * 1000,
  update: 24 * 60 * 60 * 1000,
  proof: 7 * 24 * 60 * 60 * 1000,
};

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    const userRole = req.headers.get('x-user-role');

    if (!userId || userRole === 'guest') {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Account required to create signals' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: { code: 'invalid_request', message: issue.message, field: String(issue.path[0]) } },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Rate limit: 10 signals per hour
    const rateLimitKey = `rate_limit:user:${userId}:signals`;
    try {
      const count = await redis.get(rateLimitKey);
      if (count && parseInt(count) >= 10) {
        return NextResponse.json(
          { error: { code: 'rate_limited', message: 'Max 10 signals per hour' } },
          { status: 429 }
        );
      }
    } catch {
      // Redis down — allow through
    }

    // Get trust score from PostgreSQL
    let trustScore = 0;
    try {
      const userResult = await pgPool.query(
        'SELECT trust_score FROM users WHERE id = $1',
        [userId]
      );
      if (userResult.rows.length > 0) {
        trustScore = userResult.rows[0].trust_score;
      }
    } catch {
      // PG down — continue with 0
    }

    // Calculate expiry
    const expiresAt = data.expires_at
      ? new Date(data.expires_at)
      : new Date(Date.now() + (DEFAULT_DURATIONS[data.type] || 8 * 60 * 60 * 1000));

    // Max 7 days
    const maxExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (expiresAt > maxExpiry) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Expiry cannot exceed 7 days', field: 'expires_at' } },
        { status: 400 }
      );
    }

    await connectMongo();

    const signal = await Signal.create({
      owner_type: 'user',
      owner_id: userId,
      type: data.type,
      title: data.title,
      description: data.description,
      category: data.category,
      location: data.location,
      radius: data.radius,
      visibility: data.visibility,
      verified: trustScore >= 30,
      trust_score_snapshot: trustScore,
      status: 'active',
      expires_at: expiresAt,
      metadata: data.metadata,
    });

    // Increment rate limit
    try {
      await redis.multi().incr(rateLimitKey).expire(rateLimitKey, 3600).exec();
    } catch {
      // Redis down — skip
    }

    return NextResponse.json(
      { data: { id: signal._id, status: 'active', created_at: signal.created_at } },
      { status: 201 }
    );
  } catch (err) {
    console.error('[Signals POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create signal' } },
      { status: 500 }
    );
  }
}
