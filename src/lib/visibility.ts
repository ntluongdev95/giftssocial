/**
 * Build a SQL clause that decides whether the user referenced by `alias`
 * is visible on the map to `viewerId`.
 *
 * Usage:
 *   const { sql, params } = buildLocationVisibilityClause('u', viewerId);
 *   db.prepare(`... WHERE ... AND ${sql} AND ...`).bind(..., ...params, ...)
 *
 * `alias` must be a safe SQL identifier (no user input) — it's interpolated.
 * All viewer references are bound as parameters.
 *
 * The clause returns rows where ANY of:
 *   - viewer is the user themselves
 *   - location_sharing is 'exact' or 'approximate' (public)
 *   - location_sharing is 'friends' and viewer has a mutual follow
 *   - location_sharing is 'circles' and viewer shares an active circle
 *   - an active event_location_grant exists for an event the viewer has booked
 *
 * And the user's location_shared_until (if set) has not expired.
 */
export function buildLocationVisibilityClause(alias: string, viewerId: string | null) {
  const a = alias;
  const sql = `(
    (${a}.location_shared_until IS NULL OR ${a}.location_shared_until > datetime('now'))
    AND (
      (? IS NOT NULL AND ${a}.id = ?)
      OR ${a}.location_sharing IN ('exact', 'approximate')
      OR (${a}.location_sharing = 'friends' AND ? IS NOT NULL AND EXISTS (
           SELECT 1 FROM follows f1
           WHERE f1.follower_id = ? AND f1.following_user_id = ${a}.id
           AND EXISTS (
             SELECT 1 FROM follows f2
             WHERE f2.follower_id = ${a}.id AND f2.following_user_id = ?
           )
         ))
      OR (${a}.location_sharing = 'circles' AND ? IS NOT NULL AND EXISTS (
           SELECT 1 FROM circle_members cm1
           JOIN circle_members cm2 ON cm1.circle_id = cm2.circle_id
           WHERE cm1.user_id = ? AND cm1.status = 'active'
             AND cm2.user_id = ${a}.id AND cm2.status = 'active'
         ))
      OR (? IS NOT NULL AND EXISTS (
           SELECT 1 FROM event_location_grants elg
           JOIN bookings b ON b.event_id = elg.event_id
           WHERE elg.user_id = ${a}.id
             AND elg.expires_at > datetime('now')
             AND b.user_id = ?
             AND b.status IN ('pending', 'confirmed')
         ))
    )
  )`;
  const params: (string | null)[] = [
    viewerId, viewerId,              // self
    viewerId, viewerId, viewerId,    // friends
    viewerId, viewerId,              // circles
    viewerId, viewerId,              // event grants
  ];
  return { sql, params };
}
