import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';
import {
  computeCurrentStreak,
  computeLongestStreak,
  computeCompletionRate,
  parseSchedule,
} from '@/lib/streaks';

// ─── POST /api/v1/streaks — Create a new streak ──────────────────────────

const createSchema = z.object({
  title: z.string().min(1).max(80),
  icon: z.string().max(8).default('🔥'),
  description: z.string().max(280).default(''),
  target_type: z.enum(['check', 'counter']).default('check'),
  target_value: z.number().int().min(1).max(10_000).default(1),
  target_unit: z.string().max(20).default(''),
  // Weekday array [0..6]. Default = every day.
  schedule: z.array(z.number().int().min(0).max(6)).min(1).default([0, 1, 2, 3, 4, 5, 6]),
  visibility: z.enum(['private', 'friends', 'circles']).default('friends'),
  // Optional list of partner user IDs to invite on creation.
  partner_ids: z.array(z.string()).max(10).default([]),
  // Reminder — both fields together or neither. Cron reads these.
  reminder_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  reminder_tz: z.string().max(60).optional(),
  // Proof + peer approval — see migration-021 + lib/streak-verify.ts.
  require_proof: z.boolean().default(false),
  // Couple/bond mode — see migration-023 + lib/bond-pet.ts.
  streak_type: z.enum(['solo', 'group', 'couple']).default('solo'),
  bond_species: z.string().max(8).optional(),
  // Breed picked via /api/v1/bond-breeds — see migration-024.
  bond_breed_id: z.string().max(60).optional(),
  bond_breed_label: z.string().max(60).optional(),
  bond_breed_image_url: z.string().url().max(2048).optional(),
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

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: parsed.error.issues[0].message } },
        { status: 400 },
      );
    }
    const d = parsed.data;
    const db = getDB();

    // Couple mode constraints:
    //  - exactly 1 partner (owner + 1)
    //  - species required up front (owner picks)
    if (d.streak_type === 'couple') {
      if (d.partner_ids.length !== 1 || d.partner_ids[0] === userId) {
        return NextResponse.json(
          { error: { code: 'invalid_couple', message: 'Couple streaks need exactly one partner.' } },
          { status: 400 },
        );
      }
      if (!d.bond_species) {
        return NextResponse.json(
          { error: { code: 'species_required', message: 'Pick a pet species for your couple streak.' } },
          { status: 400 },
        );
      }
    }

    const id = genId('stk_');
    // Reminder fields go in together. If only one is provided we drop both
    // so the cron doesn't crash on a missing timezone.
    const reminderAt = d.reminder_at && d.reminder_tz ? d.reminder_at : null;
    const reminderTz = d.reminder_at && d.reminder_tz ? d.reminder_tz : null;
    // Owner immediately agrees to the species they picked. Partner agrees
    // implicitly when they accept the invite (handled in /respond).
    const agreedBy = d.streak_type === 'couple' ? JSON.stringify([userId]) : '[]';

    await db
      .prepare(
        `INSERT INTO streaks
           (id, owner_id, title, icon, description, target_type, target_value, target_unit,
            schedule_json, visibility, status, reminder_at, reminder_tz, require_proof,
            streak_type, bond_species, bond_species_agreed_by,
            bond_breed_id, bond_breed_label, bond_breed_image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id, userId, d.title, d.icon, d.description, d.target_type, d.target_value, d.target_unit,
        JSON.stringify(d.schedule), d.visibility, reminderAt, reminderTz,
        d.require_proof ? 1 : 0,
        d.streak_type, d.bond_species ?? null, agreedBy,
        d.bond_breed_id ?? null, d.bond_breed_label ?? null, d.bond_breed_image_url ?? null,
      )
      .run();

    // Invite partners (skip self, dedupe). Notify each invitee.
    if (d.partner_ids.length > 0) {
      const unique = Array.from(new Set(d.partner_ids.filter(pid => pid && pid !== userId)));
      for (const pid of unique) {
        // Invites start as 'pending' — partner must accept via
        // POST /api/v1/streaks/[id]/respond before they show up in the
        // streak's participant list.
        await db
          .prepare(
            `INSERT OR IGNORE INTO streak_partners (streak_id, partner_id, invited_by, status)
             VALUES (?, ?, ?, 'pending')`,
          )
          .bind(id, pid, userId)
          .run();
      }
      // Resolve sender label once for the push.
      const sender = await db
        .prepare('SELECT display_name, username FROM users WHERE id = ?')
        .bind(userId)
        .first<{ display_name?: string; username?: string }>();
      const senderLabel = sender?.display_name || sender?.username || 'A friend';
      for (const pid of unique) {
        notify(
          pid,
          'system',
          `${senderLabel} invited you to "${d.title}" ${d.icon}`,
          'Tap to join the streak',
          'streak',
          id,
        );
      }
    }

    const created = await db
      .prepare('SELECT * FROM streaks WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error('[Streaks POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create streak' } },
      { status: 500 },
    );
  }
}

// ─── GET /api/v1/streaks?today=YYYY-MM-DD ────────────────────────────────
//
// Returns ALL streaks the viewer owns or has joined as partner, with each
// streak's: owner info, partners (with their current streak counts),
// my ticks (for the heatmap), my current/longest streak + completion rate.
//
// `today` is the viewer's LOCAL date — passed by the client so per-user
// midnight rollover works. Defaults to UTC date as a fallback.
export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ data: [] });

  const today = req.nextUrl.searchParams.get('today') ||
    new Date().toISOString().slice(0, 10);

  const db = getDB();
  try {
    // 1. List of streak IDs the viewer is in (owner OR active partner)
    const myStreaksRes = await db
      .prepare(
        `SELECT DISTINCT s.id, s.owner_id, s.title, s.icon, s.description,
                s.target_type, s.target_value, s.target_unit, s.schedule_json,
                s.visibility, s.status, s.created_at, s.updated_at,
                u.display_name AS owner_name, u.username AS owner_username,
                u.avatar_url AS owner_avatar
         FROM streaks s
         LEFT JOIN users u ON u.id = s.owner_id
         WHERE s.status = 'active'
           AND (s.owner_id = ?1
                OR s.id IN (
                  SELECT streak_id FROM streak_partners
                  WHERE partner_id = ?1 AND status = 'active'
                ))
         ORDER BY s.created_at DESC
         LIMIT 100`,
      )
      .bind(userId)
      .all<Record<string, unknown>>();

    const streakRows = myStreaksRes.results || [];
    if (streakRows.length === 0) return NextResponse.json({ data: [] });

    // 2. Bulk-fetch checkins and partners for all streaks in one round-trip each.
    const ids = streakRows.map(r => r.id as string);
    const placeholders = ids.map(() => '?').join(',');

    const allCheckinsRes = await db
      .prepare(
        // Only 'confirmed' ticks count toward the chain on the list view —
        // pending peer-review and rejected ones are visible on the detail
        // page but don't bump the counter.
        `SELECT streak_id, user_id, date, value FROM streak_checkins
         WHERE streak_id IN (${placeholders})
           AND date >= date('now', '-120 days')
           AND confirmation_state = 'confirmed'`,
      )
      .bind(...ids)
      .all<{ streak_id: string; user_id: string; date: string; value: number }>();

    const allPartnersRes = await db
      .prepare(
        `SELECT sp.streak_id, sp.partner_id, sp.status,
                u.display_name, u.username, u.avatar_url
         FROM streak_partners sp
         LEFT JOIN users u ON u.id = sp.partner_id
         WHERE sp.streak_id IN (${placeholders}) AND sp.status = 'active'`,
      )
      .bind(...ids)
      .all<{
        streak_id: string; partner_id: string; status: string;
        display_name?: string | null; username?: string | null; avatar_url?: string | null;
      }>();

    // 3. Group checkins by (streak_id, user_id)
    const checkinsByPair = new Map<string, Set<string>>();
    for (const ck of allCheckinsRes.results || []) {
      const key = `${ck.streak_id}|${ck.user_id}`;
      const set = checkinsByPair.get(key) ?? new Set<string>();
      set.add(ck.date);
      checkinsByPair.set(key, set);
    }

    // 4. Group partners by streak_id
    const partnersByStreak = new Map<string, typeof allPartnersRes.results>();
    for (const p of allPartnersRes.results || []) {
      const arr = partnersByStreak.get(p.streak_id) ?? [];
      arr.push(p);
      partnersByStreak.set(p.streak_id, arr);
    }

    // 5. Build response with computed metrics
    const data = streakRows.map(s => {
      const streakId = s.id as string;
      const schedule = parseSchedule(s.schedule_json as string);
      const mySet = checkinsByPair.get(`${streakId}|${userId}`) ?? new Set<string>();
      const myCurrent = computeCurrentStreak(mySet, schedule, today);
      const myLongest = computeLongestStreak(mySet, schedule);
      const myCompletion = computeCompletionRate(mySet, schedule, today, 30);
      const myTickedToday = mySet.has(today);

      const partners = (partnersByStreak.get(streakId) || []).map(p => {
        const set = checkinsByPair.get(`${streakId}|${p.partner_id}`) ?? new Set<string>();
        return {
          id: p.partner_id,
          name: p.display_name || p.username || 'User',
          avatar: p.avatar_url || null,
          current: computeCurrentStreak(set, schedule, today),
          ticked_today: set.has(today),
        };
      });

      // Owner stats — owner isn't always in streak_partners, so compute separately.
      const ownerSet = checkinsByPair.get(`${streakId}|${s.owner_id}`) ?? new Set<string>();
      const ownerStats = {
        id: s.owner_id as string,
        name: (s.owner_name as string) || (s.owner_username as string) || 'User',
        avatar: (s.owner_avatar as string) || null,
        current: computeCurrentStreak(ownerSet, schedule, today),
        ticked_today: ownerSet.has(today),
      };

      return {
        ...s,
        schedule: Array.from(schedule).sort(),
        my_ticks: Array.from(mySet).sort(),
        my_current_streak: myCurrent,
        my_longest_streak: myLongest,
        my_completion_30d: myCompletion,
        my_ticked_today: myTickedToday,
        owner: ownerStats,
        partners,
      };
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[Streaks GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch streaks' } },
      { status: 500 },
    );
  }
}
