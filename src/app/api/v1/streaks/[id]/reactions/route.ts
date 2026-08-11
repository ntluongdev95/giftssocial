import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// POST /api/v1/streaks/[id]/reactions — add an emoji reaction to someone's
// tick. Body: { user_id, date, emoji }. Idempotent — repeating the same
// triple is a no-op (handled by PRIMARY KEY).
const reactSchema = z.object({
  user_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  emoji: z.enum(['🔥', '👏', '💪', '❤️', '🎉']),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Login required' } },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = reactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: parsed.error.issues[0].message } },
      { status: 400 },
    );
  }
  const { user_id, date, emoji } = parsed.data;

  if (user_id === userId) {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: "Can't react to your own tick" } },
      { status: 400 },
    );
  }

  const db = getDB();
  try {
    // Permission — viewer must be a participant of this streak.
    const streak = await db
      .prepare('SELECT owner_id FROM streaks WHERE id = ?')
      .bind(id)
      .first<{ owner_id: string }>();
    if (!streak) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }
    const isOwner = streak.owner_id === userId;
    if (!isOwner) {
      const partner = await db
        .prepare(
          `SELECT 1 AS ok FROM streak_partners
           WHERE streak_id = ? AND partner_id = ? AND status = 'active' LIMIT 1`,
        )
        .bind(id, userId)
        .first<{ ok: number }>();
      if (!partner) {
        return NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 });
      }
    }

    // The checkin we're reacting to must actually exist.
    const ck = await db
      .prepare(
        `SELECT 1 AS ok FROM streak_checkins
         WHERE streak_id = ? AND user_id = ? AND date = ? LIMIT 1`,
      )
      .bind(id, user_id, date)
      .first<{ ok: number }>();
    if (!ck) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'No tick on that day' } },
        { status: 404 },
      );
    }

    const res = await db
      .prepare(
        `INSERT OR IGNORE INTO streak_reactions
           (streak_id, checkin_user_id, checkin_date, reactor_id, emoji)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, user_id, date, userId, emoji)
      .run();
    const changes = (res.meta as { changes?: number } | undefined)?.changes ?? 0;

    return NextResponse.json({ data: { added: changes > 0, emoji, date } });
  } catch (err) {
    console.error('[Streak reactions POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to react' } },
      { status: 500 },
    );
  }
}

// DELETE /api/v1/streaks/[id]/reactions?user_id=&date=&emoji= — remove
// one of MY own reactions.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Login required' } },
      { status: 401 },
    );
  }
  const user_id = req.nextUrl.searchParams.get('user_id');
  const date = req.nextUrl.searchParams.get('date');
  const emoji = req.nextUrl.searchParams.get('emoji');
  if (!user_id || !date || !emoji) {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: 'user_id, date, emoji required' } },
      { status: 400 },
    );
  }
  const db = getDB();
  try {
    await db
      .prepare(
        `DELETE FROM streak_reactions
         WHERE streak_id = ? AND checkin_user_id = ? AND checkin_date = ?
           AND reactor_id = ? AND emoji = ?`,
      )
      .bind(id, user_id, date, userId, emoji)
      .run();
    return NextResponse.json({ data: { removed: true } });
  } catch (err) {
    console.error('[Streak reactions DELETE]', err);
    return NextResponse.json(
      { error: { code: 'internal_error' } },
      { status: 500 },
    );
  }
}
