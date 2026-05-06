import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB, genId, parseRow } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';

// ─── GET /api/v1/capsules — List capsules I created OR was sent ──────────

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ data: [] });

    const db = getDB();
    // Match recipient_ids JSON array containing `"userId"` via LIKE pattern.
    const recipientLike = `%"${userId}"%`;

    const result = await db
      .prepare(
        `SELECT c.*,
                u.display_name AS sender_name,
                u.username     AS sender_username,
                u.avatar_url   AS sender_avatar
         FROM time_capsules c
         LEFT JOIN users u ON u.id = c.creator_id
         WHERE c.creator_id = ?1 OR c.recipient_ids LIKE ?2
         ORDER BY c.unlock_at ASC LIMIT 100`
      )
      .bind(userId, recipientLike)
      .all<Record<string, unknown>>();

    const now = Date.now();
    const data = (result.results || []).map(c => {
      const parsed = parseRow(c) as Record<string, unknown>;
      const unlockTime = new Date(parsed.unlock_at as string).getTime();
      const isCreator = parsed.creator_id === userId;
      const role: 'sender' | 'recipient' = isCreator ? 'sender' : 'recipient';

      // Hide message/photos from recipients while still buried — prevent client peek.
      if (!isCreator && parsed.status === 'buried') {
        parsed.message = '';
        parsed.photos = [];
      }

      return {
        ...parsed,
        role,
        can_open_now: parsed.status === 'buried' && unlockTime <= now,
        time_until_unlock_ms: Math.max(0, unlockTime - now),
      };
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[Capsules GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}

// ─── POST /api/v1/capsules — Create new capsule ───────────────────────────

const createSchema = z.object({
  title: z.string().min(1).max(120),
  message: z.string().min(1).max(2000),
  photos: z.array(z.string().url()).max(5).default([]),
  location_lat: z.number().min(-90).max(90),
  location_lng: z.number().min(-180).max(180),
  location_name: z.string().max(200).optional(),
  unlock_at: z.string().datetime(),
  unlock_radius: z.number().min(10).max(5000).default(100),
  capsule_type: z.enum(['private', 'couple', 'public', 'family']).default('private'),
  recipient_ids: z.array(z.string()).default([]),
  is_public: z.boolean().default(false),
  theme: z.string().default('classic'),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: { code: 'invalid_request', message: parsed.error.issues[0].message } }, { status: 400 });
    }

    const d = parsed.data;
    const unlockAt = new Date(d.unlock_at);

    if (unlockAt.getTime() < Date.now() + 60 * 60 * 1000) {
      return NextResponse.json({ error: { code: 'invalid_unlock_time', message: 'Unlock date must be at least 1 hour from now' } }, { status: 400 });
    }
    if (unlockAt.getTime() > Date.now() + 50 * 365 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: { code: 'invalid_unlock_time', message: 'Unlock date cannot exceed 50 years' } }, { status: 400 });
    }

    const db = getDB();
    const id = genId('cap_');
    const buriedAt = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO time_capsules
          (id, creator_id, title, message, photos, location_lat, location_lng, location_name,
           buried_at, unlock_at, unlock_radius, capsule_type, recipient_ids, is_public, theme, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'buried')`
      )
      .bind(
        id, userId, d.title, d.message, JSON.stringify(d.photos),
        d.location_lat, d.location_lng, d.location_name || null,
        buriedAt, unlockAt.toISOString(), d.unlock_radius, d.capsule_type,
        JSON.stringify(d.recipient_ids), d.is_public ? 1 : 0, d.theme
      )
      .run();

    const created = await db
      .prepare('SELECT * FROM time_capsules WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();

    // Notify each recipient — fire and forget
    if (d.recipient_ids.length > 0) {
      const sender = await db
        .prepare('SELECT display_name, username FROM users WHERE id = ?')
        .bind(userId)
        .first<{ display_name?: string; username?: string }>();
      const senderLabel = sender?.display_name || sender?.username || 'Someone';
      const unlockLabel = unlockAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      for (const rid of d.recipient_ids) {
        if (rid === userId) continue; // skip self
        notify(
          rid,
          'capsule_received',
          `${senderLabel} buried a capsule for you`,
          `Opens on ${unlockLabel}`,
          'capsule',
          id,
        );
      }
    }

    return NextResponse.json({ data: parseRow(created) }, { status: 201 });
  } catch (err) {
    console.error('[Capsules POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to create capsule' } }, { status: 500 });
  }
}
