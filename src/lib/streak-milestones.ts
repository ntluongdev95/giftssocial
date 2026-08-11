// Streak milestones — pure data + helpers. No DB. Earned milestones are
// derived from a user's longest streak count; the next target is derived
// from their current streak. Display lives in MilestoneBadges component.

export type Milestone = {
  days: number;
  label: string;
  emoji: string;
  /** Used for the badge ring / progress colour. */
  color: string;
};

export const MILESTONES: Milestone[] = [
  { days: 3,   label: 'Spark',       emoji: '✨', color: '#94a3b8' },
  { days: 7,   label: 'Week One',    emoji: '🌱', color: '#34d399' },
  { days: 14,  label: 'Two Weeks',   emoji: '🌿', color: '#22c55e' },
  { days: 30,  label: 'One Month',   emoji: '🌳', color: '#10b981' },
  { days: 60,  label: 'Two Months',  emoji: '🔥', color: '#fbbf24' },
  { days: 100, label: 'Centurion',   emoji: '💯', color: '#f59e0b' },
  { days: 200, label: 'Bolt',        emoji: '⚡', color: '#a855f7' },
  { days: 365, label: 'Year One',    emoji: '🏆', color: '#ec4899' },
];

/** Milestones that this user has reached. Uses longest streak so a one-off
 *  miss doesn't strip an earned badge. */
export function earnedMilestones(longestStreak: number): Milestone[] {
  return MILESTONES.filter(m => longestStreak >= m.days);
}

/** The next milestone the user is working toward. Returns null if they've
 *  already hit the top. */
export function nextMilestone(currentStreak: number): Milestone | null {
  return MILESTONES.find(m => currentStreak < m.days) ?? null;
}

/** Progress 0..1 toward the next milestone (relative to the previous one,
 *  so the bar feels like a fresh climb each time rather than ratio of 365). */
export function progressToNext(currentStreak: number): {
  next: Milestone | null;
  prev: number;
  pct: number;
} {
  const next = nextMilestone(currentStreak);
  if (!next) return { next: null, prev: 0, pct: 1 };
  // Previous milestone threshold — 0 if we're below the first one.
  const idx = MILESTONES.indexOf(next);
  const prev = idx <= 0 ? 0 : MILESTONES[idx - 1].days;
  const span = next.days - prev;
  const into = Math.max(0, currentStreak - prev);
  const pct = span <= 0 ? 1 : Math.min(1, into / span);
  return { next, prev, pct };
}
