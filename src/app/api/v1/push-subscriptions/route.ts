import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// Browser sends back its PushSubscription after the user grants notification
// permission. We persist endpoint + p256dh + auth so the cron handler can
// later POST encrypted payloads to that endpoint.
const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(10).max(200),
    auth: z.string().min(10).max(80),
  }),
  user_agent: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Login required' } },
        { status: 401 },
      );
    }
    const body = await req.json().catch(() => null);
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: parsed.error.issues[0].message } },
        { status: 400 },
      );
    }
    const d = parsed.data;
    const db = getDB();

    // Upsert: re-subscribing the same endpoint (e.g. after key rotation)
    // updates the keys + bumps last_seen_at without churning the row.
    await db
      .prepare(
        `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, user_agent)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET
           user_id      = excluded.user_id,
           p256dh       = excluded.p256dh,
           auth         = excluded.auth,
           user_agent   = excluded.user_agent,
           last_seen_at = datetime('now')`,
      )
      .bind(d.endpoint, userId, d.keys.p256dh, d.keys.auth, d.user_agent ?? null)
      .run();

    return NextResponse.json({ data: { subscribed: true } });
  } catch (err) {
    console.error('[Push subscriptions POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to subscribe' } },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Login required' } },
        { status: 401 },
      );
    }
    const endpoint = req.nextUrl.searchParams.get('endpoint');
    if (!endpoint) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'endpoint required' } },
        { status: 400 },
      );
    }
    const db = getDB();
    await db
      .prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?')
      .bind(endpoint, userId)
      .run();
    return NextResponse.json({ data: { unsubscribed: true } });
  } catch (err) {
    console.error('[Push subscriptions DELETE]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to unsubscribe' } },
      { status: 500 },
    );
  }
}
