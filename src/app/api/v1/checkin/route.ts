import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
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
      const bizResult = await pgPool.query('SELECT id, name FROM businesses WHERE checkin_code = $1 AND status = \'active\'', [code.toUpperCase()]);
      if (bizResult.rows.length > 0) {
        targetType = 'business';
        targetId = bizResult.rows[0].id;
        targetName = bizResult.rows[0].name;
      } else {
        const evtResult = await pgPool.query('SELECT id, title FROM events WHERE checkin_code = $1 AND status IN (\'scheduled\', \'live\')', [code.toUpperCase()]);
        if (evtResult.rows.length > 0) {
          targetType = 'event';
          targetId = evtResult.rows[0].id;
          targetName = evtResult.rows[0].title;
        }
      }
    }

    if (!targetType || !targetId) {
      return NextResponse.json({ error: { code: 'invalid_code', message: 'Invalid QR code or check-in code' } }, { status: 400 });
    }

    // Get target name if not already set
    if (!targetName) {
      if (targetType === 'business') {
        const r = await pgPool.query('SELECT name FROM businesses WHERE id = $1', [targetId]);
        targetName = r.rows[0]?.name || 'Business';
      } else {
        const r = await pgPool.query('SELECT title FROM events WHERE id = $1', [targetId]);
        targetName = r.rows[0]?.title || 'Event';
      }
    }

    // Check for duplicate check-in (same user, same target, within 24h)
    const existing = await pgPool.query(
      "SELECT id FROM proofs WHERE user_id = $1 AND target_type = $2 AND target_id = $3 AND proof_type = 'checked_in' AND created_at > NOW() - INTERVAL '24 hours'",
      [userId, targetType, targetId]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: { code: 'already_checked_in', message: `Already checked in at ${targetName} today` } }, { status: 400 });
    }

    // Create proof
    const trustPoints = targetType === 'event' ? 3 : 2;
    await pgPool.query(
      `INSERT INTO proofs (user_id, proof_type, target_type, target_id, evidence_type, trust_points, verified)
       VALUES ($1, 'checked_in', $2, $3, 'qr_scan', $4, true)`,
      [userId, targetType, targetId, trustPoints]
    );

    // Update trust score
    await pgPool.query('SELECT recalculate_trust_score($1)', [userId]).catch(() => {});

    // If event check-in, increment checkin_count
    if (targetType === 'event') {
      await pgPool.query('UPDATE events SET checkin_count = checkin_count + 1 WHERE id = $1', [targetId]);
    }

    // Notify business owner
    if (targetType === 'business') {
      const owner = await pgPool.query('SELECT owner_user_id FROM businesses WHERE id = $1', [targetId]);
      const userName = await pgPool.query('SELECT display_name FROM users WHERE id = $1', [userId]);
      if (owner.rows[0]?.owner_user_id) {
        notify(owner.rows[0].owner_user_id, 'system', `${userName.rows[0]?.display_name || 'Someone'} checked in!`, `At ${targetName}`, targetType, targetId);
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

    let code = '';
    if (targetType === 'business') {
      const r = await pgPool.query('SELECT checkin_code FROM businesses WHERE id = $1', [targetId]);
      code = r.rows[0]?.checkin_code || '';
    } else if (targetType === 'event') {
      const r = await pgPool.query('SELECT checkin_code FROM events WHERE id = $1', [targetId]);
      code = r.rows[0]?.checkin_code || '';
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
