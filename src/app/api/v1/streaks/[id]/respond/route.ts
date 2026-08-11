import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';

// POST /api/v1/streaks/[id]/respond — invitee accepts or declines.
// Body: { action: 'accept' | 'decline' }
//
// Accept   → status='active' (partner becomes a real participant)
// Decline  → status='left'   (same as leaving — they don't show up anywhere)
//
// The owner gets a notification either way so they know what happened.
const respondSchema = z.object({
  action: z.enum(['accept', 'decline']),
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
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: parsed.error.issues[0].message } },
      { status: 400 },
    );
  }
  const { action } = parsed.data;

  const db = getDB();
  try {
    // Verify the invite exists and is still pending for this user.
    const invite = await db
      .prepare(
        `SELECT sp.status, s.owner_id, s.title, s.icon
         FROM streak_partners sp
         JOIN streaks s ON s.id = sp.streak_id
         WHERE sp.streak_id = ? AND sp.partner_id = ?
         LIMIT 1`,
      )
      .bind(id, userId)
      .first<{ status: string; owner_id: string; title: string; icon: string }>();

    if (!invite) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }
    if (invite.status !== 'pending') {
      return NextResponse.json(
        {
          error: {
            code: 'invalid_state',
            message: `Invite already ${invite.status === 'active' ? 'accepted' : 'declined'}`,
          },
        },
        { status: 409 },
      );
    }

    const newStatus = action === 'accept' ? 'active' : 'left';
    await db
      .prepare(
        `UPDATE streak_partners SET status = ?
         WHERE streak_id = ? AND partner_id = ?`,
      )
      .bind(newStatus, id, userId)
      .run();

    // If this is a couple streak and the partner accepted, append their
    // user_id to bond_species_agreed_by so the pet hatches.
    if (action === 'accept') {
      const meta = await db
        .prepare('SELECT streak_type, bond_species_agreed_by FROM streaks WHERE id = ?')
        .bind(id)
        .first<{ streak_type: string; bond_species_agreed_by: string }>();
      if (meta?.streak_type === 'couple') {
        const { parseAgreedBy } = await import('@/lib/bond-pet');
        const agreed = parseAgreedBy(meta.bond_species_agreed_by);
        if (!agreed.includes(userId)) {
          agreed.push(userId);
          await db
            .prepare('UPDATE streaks SET bond_species_agreed_by = ? WHERE id = ?')
            .bind(JSON.stringify(agreed), id)
            .run();
        }
      }
    }

    // Tell the owner. Use 'system' type so it surfaces in /notifications.
    const me = await db
      .prepare('SELECT display_name, username FROM users WHERE id = ?')
      .bind(userId)
      .first<{ display_name?: string; username?: string }>();
    const myLabel = me?.display_name || me?.username || 'A friend';
    if (action === 'accept') {
      notify(
        invite.owner_id,
        'system',
        `${myLabel} joined "${invite.title}" ${invite.icon}`,
        'The chain just got stronger 🔥',
        'streak',
        id,
      );
    } else {
      notify(
        invite.owner_id,
        'system',
        `${myLabel} declined "${invite.title}"`,
        '',
        'streak',
        id,
      );
    }

    return NextResponse.json({ data: { status: newStatus } });
  } catch (err) {
    console.error('[Streak respond POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to respond' } },
      { status: 500 },
    );
  }
}
