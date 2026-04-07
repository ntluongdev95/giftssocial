import { NextRequest, NextResponse } from 'next/server';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';

// QR format: gao://checkin/business/{id} or gao://checkin/event/{id}
// Or manual code: 6-char alphanumeric

// ─── POST /api/v1/checkin — Check in at a business or event ─────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const { qr_data, code } = await req.json() as { qr_data?: string; code?: string };

    let targetType: 'business' | 'event' | null = null;
    let targetId: string | null = null;
    let targetName: string | null = null;

    const db = getDB();

    if (qr_data) {
      // Parse QR: gao://checkin/business/{id} or gao://checkin/event/{id}
      const match = qr_data.match(/^gao:\/\/checkin\/(business|event)\/(.+)$/);
      if (match) {
        targetType = match[1] as 'business' | 'event';
        targetId = match[2];
      }
    }

    if (!targetId && code) {
      // Try to find by manual code — check businesses first, then events
      const bizResult = await db.prepare(
        "SELECT id, name FROM businesses WHERE checkin_code = ? AND status = 'active'"
      ).bind(code.toUpperCase()).first<{ id: string; name: string }>();
      if (bizResult) {
        targetType = 'business';
        targetId = bizResult.id;
        targetName = bizResult.name;
      } else {
        const evtResult = await db.prepare(
          "SELECT id, title FROM events WHERE checkin_code = ? AND status IN ('scheduled', 'live')"
        ).bind(code.toUpperCase()).first<{ id: string; title: string }>();
        if (evtResult) {
          targetType = 'event';
          targetId = evtResult.id;
          targetName = evtResult.title;
        }
      }
    }

    if (!targetType || !targetId) {
      return NextResponse.json({ error: { code: 'invalid_code', message: 'Invalid QR code or check-in code' } }, { status: 400 });
    }

    // Get target name if not already set
    if (!targetName) {
      if (targetType === 'business') {
        const r = await db.prepare('SELECT name FROM businesses WHERE id = ?').bind(targetId).first<{ name: string }>();
        targetName = r?.name || 'Business';
      } else {
        const r = await db.prepare('SELECT title FROM events WHERE id = ?').bind(targetId).first<{ title: string }>();
        targetName = r?.title || 'Event';
      }
    }

    // Check for duplicate check-in (same user, same target, within 24h)
    const existing = await db.prepare(
      "SELECT id FROM proofs WHERE user_id = ? AND target_type = ? AND target_id = ? AND proof_type = 'checked_in' AND created_at > datetime('now', '-1 day')"
    ).bind(userId, targetType, targetId).first<{ id: string }>();
    if (existing) {
      return NextResponse.json({ error: { code: 'already_checked_in', message: `Already checked in at ${targetName} today` } }, { status: 400 });
    }

    // Create proof
    const trustPoints = targetType === 'event' ? 3 : 2;
    const proofId = genId('prf_');
    await db.prepare(
      `INSERT INTO proofs (id, user_id, proof_type, target_type, target_id, evidence_type, trust_points, verified)
       VALUES (?, ?, 'checked_in', ?, ?, 'qr_scan', ?, 1)`
    ).bind(proofId, userId, targetType, targetId, trustPoints).run();

    // If event check-in, increment checkin_count
    if (targetType === 'event') {
      await db.prepare('UPDATE events SET checkin_count = checkin_count + 1 WHERE id = ?').bind(targetId).run();
    }

    // Notify business owner
    if (targetType === 'business') {
      const owner = await db.prepare('SELECT owner_user_id FROM businesses WHERE id = ?').bind(targetId).first<{ owner_user_id: string }>();
      const userName = await db.prepare('SELECT display_name FROM users WHERE id = ?').bind(userId).first<{ display_name: string }>();
      if (owner?.owner_user_id) {
        notify(owner.owner_user_id, 'system', `${userName?.display_name || 'Someone'} checked in!`, `At ${targetName}`, targetType, targetId);
      }
    }

    return NextResponse.json({
      data: {
        target_type: targetType,
        target_id: targetId,
        target_name: targetName,
        trust_points: trustPoints,
        message: `Checked in at ${targetName}! +${trustPoints} trust 🛡`,
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[CheckIn POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to check in' } }, { status: 500 });
  }
}

// ─── GET /api/v1/checkin?target_type=business&target_id=xxx — Get QR data ──

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const targetType = searchParams.get('target_type');
    const targetId = searchParams.get('target_id');

    if (!targetType || !targetId) {
      return NextResponse.json({ error: { code: 'invalid_request', message: 'target_type and target_id required' } }, { status: 400 });
    }

    const db = getDB();
    let code = '';
    if (targetType === 'business') {
      const r = await db.prepare('SELECT checkin_code FROM businesses WHERE id = ?').bind(targetId).first<{ checkin_code: string }>();
      code = r?.checkin_code || '';
    } else if (targetType === 'event') {
      const r = await db.prepare('SELECT checkin_code FROM events WHERE id = ?').bind(targetId).first<{ checkin_code: string }>();
      code = r?.checkin_code || '';
    }

    return NextResponse.json({
      data: {
        qr_data: `gao://checkin/${targetType}/${targetId}`,
        code,
        target_type: targetType,
        target_id: targetId,
      },
    });
  } catch (err) {
    console.error('[CheckIn GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed' } }, { status: 500 });
  }
}
