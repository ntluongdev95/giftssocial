// Shared helpers for the Now Stories feature. Server-only types/utilities;
// keep client code path-free of D1Database refs.

export const STORY_TTL_HOURS = 24;

// Reject location stories outside this radius from the claimed business. Same
// envelope as check-ins so the user experience is consistent.
export const STORY_MAX_VENUE_DISTANCE_METERS = 120;
export const STORY_MAX_GPS_ACCURACY_METERS = 80;

// Trust score required to post `visibility='public'` stories. Below this you
// can still post — but visibility caps at `friends` (or `circles`).
export const STORY_PUBLIC_TRUST_THRESHOLD = 10;

// Rate cap per author. Soft cap — anything stricter belongs in rate-limit.ts.
export const STORY_RATE_PER_USER_PER_HOURS = { count: 5, hours: 6 };

// Haversine distance in metres. Inlined here rather than importing from
// checkins/route.ts so this module stays self-contained.
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function computeExpiry(postedAtIso?: string): string {
  const base = postedAtIso ? new Date(postedAtIso) : new Date();
  return new Date(base.getTime() + STORY_TTL_HOURS * 3600 * 1000).toISOString();
}

// Author-side filter: caller's user_id, target story row. Stories that pass:
//   - public always
//   - friends if `viewer` follows `author`
//   - circles if `viewer` is member of any listed circle (caller checks
//     separately, since we need a DB query)
//   - the author themselves always sees their own stories
export type StoryRow = {
  author_id: string;
  visibility: 'public' | 'friends' | 'circles';
  circle_ids: string[] | string;
};

export function isOwnStory(viewerId: string | null, story: StoryRow): boolean {
  return !!viewerId && viewerId === story.author_id;
}

export function parseCircleIds(raw: string[] | string | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
