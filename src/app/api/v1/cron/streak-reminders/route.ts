import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { notify } from '@/lib/notify';
import { parseSchedule } from '@/lib/streaks';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { sendWebPush, getVapidKeysFromEnv } from '@/lib/web-push';

// GET /api/v1/cron/streak-reminders
//
// Called by Cloudflare Cron Trigger every 15 minutes. Walks every active
// streak with a `reminder_at`, converts current UTC to the streak owner's
// local time, and fires reminders for streaks whose minute window matches.
// Sends BOTH:
//   A) In-app notification (notify() → notifications table)
//   B) Web Push (to every push_subscriptions row for that user)
//
// Idempotent within a single day: each streak stores `reminder_last_sent_for`
// = YYYY-MM-DD, set after firing. Subsequent cron runs for the same day
// skip the streak even if their time window matches.
//
// Security: requires `CRON_SECRET` env var to be set and supplied via
// either the `?secret=` query param or `Authorization: Bearer <secret>`.

const WINDOW_MINUTES = 15;

export async function GET(req: NextRequest) {
  // ── Auth gate ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { env } = (getCloudflareContext as any)() as { env: Record<string, string | undefined> };
  const expected = env.CRON_SECRET;
  const provided =
    req.nextUrl.searchParams.get('secret') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });
  }

  const db = getDB();
  const vapid = getVapidKeysFromEnv(env);

  try {
    // 1. Pull every active streak with a reminder configured.
    const rows = await db
      .prepare(
        `SELECT id, owner_id, title, icon, schedule_json, reminder_at, reminder_tz,
                reminder_last_sent_for
         FROM streaks
         WHERE status = 'active'
           AND reminder_at IS NOT NULL
           AND reminder_tz IS NOT NULL
         LIMIT 5000`,
      )
      .all<{
        id: string; owner_id: string; title: string; icon: string;
        schedule_json: string; reminder_at: string; reminder_tz: string;
        reminder_last_sent_for: string | null;
      }>();

    const now = new Date();
    let fired = 0;
    let skipped = 0;
    let pushSent = 0;
    let pushFailed = 0;

    for (const s of rows.results || []) {
      // Compute "now" in the owner's timezone
      let local: { hour: number; minute: number; weekday: number; dateKey: string };
      try {
        local = localTimeIn(now, s.reminder_tz);
      } catch {
        skipped++;
        continue;
      }

      // Skip if today isn't scheduled
      const schedule = parseSchedule(s.schedule_json);
      if (!schedule.has(local.weekday)) {
        skipped++;
        continue;
      }

      // Already fired for today?
      if (s.reminder_last_sent_for === local.dateKey) {
        skipped++;
        continue;
      }

      // Time window — fire if local time is within [reminder_at, reminder_at + WINDOW)
      const [hh, mm] = s.reminder_at.split(':').map(Number);
      const reminderMinutes = hh * 60 + mm;
      const nowMinutes = local.hour * 60 + local.minute;
      const diff = nowMinutes - reminderMinutes;
      if (diff < 0 || diff >= WINDOW_MINUTES) {
        skipped++;
        continue;
      }

      // Skip if user already ticked today (no point reminding)
      const existing = await db
        .prepare(
          `SELECT 1 AS ok FROM streak_checkins
           WHERE streak_id = ? AND user_id = ? AND date = ? LIMIT 1`,
        )
        .bind(s.id, s.owner_id, local.dateKey)
        .first<{ ok: number }>();
      if (existing) {
        skipped++;
        // Mark sent anyway so we don't spam later in the window when they
        // un-tick and re-tick.
        await db
          .prepare('UPDATE streaks SET reminder_last_sent_for = ? WHERE id = ?')
          .bind(local.dateKey, s.id)
          .run();
        continue;
      }

      // ── A) In-app notification ──
      const title = `${s.icon} Time to tick "${s.title}"`;
      const bodyText = "Don't break your streak — tap to log today.";
      notify(s.owner_id, 'system', title, bodyText, 'streak', s.id);

      // ── B) Web Push to every subscription for this user ──
      if (vapid) {
        const subsRes = await db
          .prepare(
            `SELECT endpoint, p256dh, auth FROM push_subscriptions
             WHERE user_id = ?`,
          )
          .bind(s.owner_id)
          .all<{ endpoint: string; p256dh: string; auth: string }>();
        for (const sub of subsRes.results || []) {
          const r = await sendWebPush(
            sub,
            {
              title,
              body: bodyText,
              tag: `streak-${s.id}`,
              data: { url: `/streaks/${s.id}` },
            },
            vapid,
          );
          if (r.ok) {
            pushSent++;
          } else {
            pushFailed++;
            // Push service says this subscription is dead — clean up.
            if (r.expired) {
              await db
                .prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
                .bind(sub.endpoint)
                .run()
                .catch(() => {});
            }
          }
        }
      }

      await db
        .prepare('UPDATE streaks SET reminder_last_sent_for = ? WHERE id = ?')
        .bind(local.dateKey, s.id)
        .run();
      fired++;
    }

    return NextResponse.json({
      data: { fired, skipped, pushSent, pushFailed, vapidConfigured: !!vapid },
    });
  } catch (err) {
    console.error('[Cron streak-reminders]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Cron failed' } },
      { status: 500 },
    );
  }
}

// Compute hour/minute/weekday + YYYY-MM-DD in the given IANA timezone.
// Uses Intl.DateTimeFormat which is available in Workers runtime.
function localTimeIn(date: Date, tz: string): { hour: number; minute: number; weekday: number; dateKey: string } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit', minute: '2-digit', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  });
  const parts = fmt.formatToParts(date);
  const get = (t: Intl.DateTimeFormatPartTypes): string => parts.find(p => p.type === t)?.value ?? '';
  const hour = parseInt(get('hour'), 10);
  const minute = parseInt(get('minute'), 10);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = weekdayMap[get('weekday') as keyof typeof weekdayMap] ?? 0;
  return { hour, minute, weekday, dateKey: `${year}-${month}-${day}` };
}
