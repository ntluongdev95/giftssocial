// Streak math — pure helpers used both by API code and client display.
// No DB access: callers pass already-fetched checkin dates.

// ── Date helpers ─────────────────────────────────────────────────────────

/** Format a Date into YYYY-MM-DD in the LOCAL timezone (not UTC).
 *  We never use ISO strings because "today" should be the user's day, not
 *  London's. Callers pass `new Date()` and get back their local date. */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Add `days` (can be negative) to a YYYY-MM-DD date string. */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return localDateKey(dt);
}

/** Weekday (0=Sun..6=Sat) of a YYYY-MM-DD key. */
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

// ── Schedule ─────────────────────────────────────────────────────────────

/** Parse the JSON-stored schedule into a Set of weekdays (0..6).
 *  Bad input → defaults to every day to avoid silently disabling habits. */
export function parseSchedule(json: string | null | undefined): Set<number> {
  if (!json) return new Set([0, 1, 2, 3, 4, 5, 6]);
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return new Set([0, 1, 2, 3, 4, 5, 6]);
    const out = new Set<number>();
    for (const n of arr) {
      const v = Number(n);
      if (Number.isInteger(v) && v >= 0 && v <= 6) out.add(v);
    }
    return out.size > 0 ? out : new Set([0, 1, 2, 3, 4, 5, 6]);
  } catch {
    return new Set([0, 1, 2, 3, 4, 5, 6]);
  }
}

/** True if `dateKey` is a scheduled day for this habit. */
export function isScheduledDay(dateKey: string, schedule: Set<number>): boolean {
  return schedule.has(weekdayOf(dateKey));
}

// ── Streak length ─────────────────────────────────────────────────────────

/** Compute the current streak (consecutive scheduled days ending today,
 *  or yesterday if today is scheduled but not yet ticked — that way the
 *  streak doesn't reset to 0 the morning of a new day until midnight).
 *
 *  Days NOT in the schedule are skipped — they don't reset the streak,
 *  they're just "off days". A run like Mon✓ Wed✓ Fri✓ on a schedule of
 *  [Mon, Wed, Fri] counts as 3 consecutive.
 *
 *  Implementation: walk back day-by-day from today; for each scheduled day
 *  encountered, require a tick. First miss ends the streak. */
export function computeCurrentStreak(
  tickedDates: Set<string>,
  schedule: Set<number>,
  todayKey: string,
): number {
  let count = 0;
  let cursor = todayKey;
  // If today is scheduled but not ticked, start from yesterday so the
  // counter doesn't go to 0 every morning until the user opens the app.
  if (isScheduledDay(cursor, schedule) && !tickedDates.has(cursor)) {
    cursor = addDays(cursor, -1);
  }
  // Walk backwards. Hard cap of 365*5 to avoid infinite loops on bad data.
  for (let i = 0; i < 365 * 5; i++) {
    if (isScheduledDay(cursor, schedule)) {
      if (tickedDates.has(cursor)) {
        count++;
      } else {
        break;
      }
    }
    cursor = addDays(cursor, -1);
  }
  return count;
}

/** Longest streak ever — scan all ticks chronologically, count runs.
 *  Uses the same "skip non-scheduled days" logic as computeCurrentStreak. */
export function computeLongestStreak(
  tickedDates: Set<string>,
  schedule: Set<number>,
): number {
  if (tickedDates.size === 0) return 0;
  const sorted = Array.from(tickedDates).sort();
  let best = 0;
  let current = 0;
  let prevScheduledKey: string | null = null;

  for (const dateKey of sorted) {
    if (!isScheduledDay(dateKey, schedule)) continue;
    if (prevScheduledKey === null) {
      current = 1;
    } else {
      // Walk forward from prevScheduledKey to find the next scheduled day.
      // If it equals dateKey → consecutive. Else → break.
      let cursor = addDays(prevScheduledKey, 1);
      while (!isScheduledDay(cursor, schedule)) cursor = addDays(cursor, 1);
      current = cursor === dateKey ? current + 1 : 1;
    }
    if (current > best) best = current;
    prevScheduledKey = dateKey;
  }
  return best;
}

/** Completion rate over the last N days (scheduled days only). 0..1. */
export function computeCompletionRate(
  tickedDates: Set<string>,
  schedule: Set<number>,
  todayKey: string,
  windowDays: number = 30,
): number {
  let scheduled = 0;
  let done = 0;
  let cursor = todayKey;
  for (let i = 0; i < windowDays; i++) {
    if (isScheduledDay(cursor, schedule)) {
      scheduled++;
      if (tickedDates.has(cursor)) done++;
    }
    cursor = addDays(cursor, -1);
  }
  return scheduled === 0 ? 0 : done / scheduled;
}
