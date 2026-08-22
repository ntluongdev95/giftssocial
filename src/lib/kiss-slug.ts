// Custom vanity link (slug) for kisses — src/db/migration-037-kiss-slug.sql
//
// Senders can optionally set a custom slug (e.g. /kiss/anh-yeu-em) instead
// of sharing the default random-ID link. Shared here so every "copy link"
// call site builds the same URL instead of re-deriving it.

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

/** Lowercase, strip diacritics, collapse to `a-z0-9-` — same shape as the
 * `slugify()` helper already used for admin template titles. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, SLUG_MAX);
}

/** True if `slug` is a well-formed custom link (already slugified, right length). */
export function isValidSlug(slug: string): boolean {
  return slug.length >= SLUG_MIN && slug.length <= SLUG_MAX && SLUG_RE.test(slug);
}

/** The public share URL for a kiss — prefers the custom slug when set. */
export function getKissUrl(kiss: { id: string; slug?: string | null }, origin: string): string {
  return `${origin}/kiss/${kiss.slug || kiss.id}`;
}
