import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';

// POST /api/v1/streaks/[id]/partners — owner adds 1+ partners.
// Body: { partner_ids: string[] }
const inviteSchema = z.object({
  partner_ids: z.array(z.string()).min(1).max(10),
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
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: parsed.error.issues[0].message } },
      { status: 400 },
    );
  }

  const db = getDB();
  try {
    const streak = await db
      .prepare(
        `SELECT id, owner_id, title, icon FROM streaks
         WHERE id = ? AND status = 'active'`,
      )
      .bind(id)
      .first<{ id: string; owner_id: string; title: string; icon: string }>();
    if (!streak) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }
    if (streak.owner_id !== userId) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'Only the owner can invite' } },
        { status: 403 },
      );
    }

    const unique = Array.from(new Set(parsed.data.partner_ids.filter(pid => pid && pid !== userId)));
    let added = 0;
    for (const pid of unique) {
      // Pending until the invitee accepts — see /respond endpoint.
      const res = await db
        .prepare(
          `INSERT OR IGNORE INTO streak_partners (streak_id, partner_id, invited_by, status)
           VALUES (?, ?, ?, 'pending')`,
        )
        .bind(id, pid, userId)
        .run();
      const changes = (res.meta as { changes?: number } | undefined)?.changes ?? 0;
      if (changes > 0) added++;
    }

    if (added > 0) {
      const sender = await db
        .prepare('SELECT display_name, username FROM users WHERE id = ?')
        .bind(userId)
        .first<{ display_name?: string; username?: string }>();
      const senderLabel = sender?.display_name || sender?.username || 'A friend';
      for (const pid of unique) {
        notify(
          pid,
          'system',
          `${senderLabel} invited you to "${streak.title}" ${streak.icon}`,
          'Tap to join the streak',
          'streak',
          id,
        );
      }
    }

    return NextResponse.json({ data: { added } });
  } catch (err) {
    console.error('[Streak partners POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to invite' } },
      { status: 500 },
    );
  }
}

// DELETE /api/v1/streaks/[id]/partners — current user leaves the streak.
// Owners can't leave their own streak — they archive instead.
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
  const db = getDB();
  try {
    const streak = await db
      .prepare('SELECT owner_id FROM streaks WHERE id = ?')
      .bind(id)
      .first<{ owner_id: string }>();
    if (!streak) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }
    if (streak.owner_id === userId) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'Owners archive instead of leave' } },
        { status: 403 },
      );
    }
    await db
      .prepare(
        `UPDATE streak_partners SET status = 'left'
         WHERE streak_id = ? AND partner_id = ?`,
      )
      .bind(id, userId)
      .run();
    return NextResponse.json({ data: { left: true } });
  } catch (err) {
    console.error('[Streak partners DELETE]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to leave' } },
      { status: 500 },
    );
  }
}
