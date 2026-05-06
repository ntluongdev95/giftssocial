import { NextRequest, NextResponse } from 'next/server';
import { getDB, parseRow } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';

// ─── GET /api/v1/capsules/:id — Get capsule (without opening) ─────────────

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDB();
    const row = await db
      .prepare('SELECT * FROM time_capsules WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();

    if (!row) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Capsule not found' } }, { status: 404 });
    }
    return NextResponse.json({ data: parseRow(row) });
  } catch (err) {
    console.error('[Capsule GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}

// ─── PATCH /api/v1/capsules/:id — Open capsule (verify time only) ─────────

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const db = getDB();
    const capsule = await db
      .prepare('SELECT * FROM time_capsules WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();

    if (!capsule) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Capsule not found' } }, { status: 404 });
    }

    // Already opened — return content
    if (capsule.status === 'unlocked') {
      return NextResponse.json({ data: parseRow(capsule), already_opened: true });
    }

    // Permission check
    let recipientIds: string[] = [];
    try {
      recipientIds = typeof capsule.recipient_ids === 'string'
        ? JSON.parse(capsule.recipient_ids as string)
        : (capsule.recipient_ids as string[] | null) || [];
    } catch { recipientIds = []; }

    const isCreator = capsule.creator_id === userId;
    const isRecipient = recipientIds.includes(userId);
    const isPublic = capsule.is_public === 1 || capsule.is_public === true;
    const canAccess = isCreator || isRecipient || isPublic;
    if (!canAccess) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'Not authorized to open' } }, { status: 403 });
    }

    // Time check
    const now = Date.now();
    const unlockTime = new Date(capsule.unlock_at as string).getTime();
    if (now < unlockTime) {
      const hoursLeft = Math.ceil((unlockTime - now) / (1000 * 60 * 60));
      return NextResponse.json({
        error: {
          code: 'too_early',
          message: hoursLeft > 24
            ? `Available in ${Math.ceil(hoursLeft / 24)} days`
            : `Available in ${hoursLeft} hours`,
          unlock_at: capsule.unlock_at,
        }
      }, { status: 425 });
    }

    // Open it
    const openedAt = new Date().toISOString();
    await db
      .prepare(
        `UPDATE time_capsules
         SET status = 'unlocked', opened_at = ?, opened_by = ?
         WHERE id = ?`
      )
      .bind(openedAt, userId, id)
      .run();

    const opened = await db
      .prepare('SELECT * FROM time_capsules WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();

    // Notify creator if a recipient opened it (skip self-open)
    if (capsule.creator_id !== userId) {
      const opener = await db
        .prepare('SELECT display_name, username FROM users WHERE id = ?')
        .bind(userId)
        .first<{ display_name?: string; username?: string }>();
      const openerLabel = opener?.display_name || opener?.username || 'Someone';
      notify(
        capsule.creator_id as string,
        'capsule_opened',
        `${openerLabel} opened your capsule`,
        `"${capsule.title}" was just unsealed`,
        'capsule',
        id,
      );
    }

    return NextResponse.json({ data: parseRow(opened), just_opened: true });
  } catch (err) {
    console.error('[Capsule PATCH]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to open' } }, { status: 500 });
  }
}

// ─── DELETE /api/v1/capsules/:id — Delete (creator only, before unlock) ───

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });

    const db = getDB();
    const result = await db
      .prepare(
        `DELETE FROM time_capsules
         WHERE id = ? AND creator_id = ? AND status = 'buried'`
      )
      .bind(id, userId)
      .run();

    const changes = (result.meta?.changes as number | undefined) ?? 0;
    if (changes === 0) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Cannot delete (not yours or already opened)' } }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Capsule DELETE]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed' } }, { status: 500 });
  }
}
