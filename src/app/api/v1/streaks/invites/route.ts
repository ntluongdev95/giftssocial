import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// GET /api/v1/streaks/invites — streaks where the viewer is a PENDING
// partner. Returns minimal info (title, icon, owner) so the recipient can
// decide whether to accept without exposing the full content. Full detail
// (heatmap, checkins, partners) only unlocks after they accept.
export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ data: [] });

  const db = getDB();
  try {
    const rows = await db
      .prepare(
        // partner_count = owner (1) + active partners. Lets the UI show
        // "join 4 people" instead of forcing the user to imagine the group.
        `SELECT s.id, s.owner_id, s.title, s.icon, s.description,
                s.schedule_json, s.target_type, s.target_value, s.target_unit,
                s.require_proof, s.created_at,
                sp.invited_by, sp.joined_at AS invited_at,
                u.display_name AS owner_name, u.username AS owner_username,
                u.avatar_url AS owner_avatar,
                (1 + (SELECT COUNT(*) FROM streak_partners
                        WHERE streak_id = s.id AND status = 'active')) AS partner_count
         FROM streak_partners sp
         JOIN streaks s ON s.id = sp.streak_id
         LEFT JOIN users u ON u.id = s.owner_id
         WHERE sp.partner_id = ?1
           AND sp.status = 'pending'
           AND s.status = 'active'
         ORDER BY sp.joined_at DESC
         LIMIT 50`,
      )
      .bind(userId)
      .all<Record<string, unknown>>();

    return NextResponse.json({ data: rows.results || [] });
  } catch (err) {
    console.error('[Streak invites GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch invites' } },
      { status: 500 },
    );
  }
}
