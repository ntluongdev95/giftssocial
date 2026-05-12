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
 *   - location_sharing is 'specific' and viewer is in location_specific_shares
 *   - an active event_location_grant exists for an event the viewer has booked
 *
 * And the user's location_shared_until (if set) has not expired.
 */
/**
 * Build SQL SELECT expressions that surface WHY a row is visible to the viewer.
 * Use alongside `buildLocationVisibilityClause` — the bool expressions are
 * independent and only evaluate once per row each.
 *
 * Returns columns:
 *   - via_public (1/0)
 *   - via_friend (1/0) — mutual follow, only counts when sharing=friends
 *   - shared_circle_id (circle id or NULL) — present when sharing=circles and
 *     viewer shares an active circle with the user
 *   - shared_event_id (event id or NULL) — present when an active event
 *     grant exists and the viewer has a booking for that event
 */
export function buildLocationVisibilityReasonSelects(alias: string, viewerId: string | null) {
  const a = alias;
  const sql = `
    CASE WHEN ${a}.location_sharing IN ('exact', 'approximate') THEN 1 ELSE 0 END AS via_public,
    CASE WHEN ${a}.location_sharing = 'friends' AND ? IS NOT NULL AND EXISTS (
      SELECT 1 FROM follows f1
      WHERE f1.follower_id = ? AND f1.following_user_id = ${a}.id
      AND EXISTS (
        SELECT 1 FROM follows f2
        WHERE f2.follower_id = ${a}.id AND f2.following_user_id = ?
      )
    ) THEN 1 ELSE 0 END AS via_friend,
    (CASE WHEN ${a}.location_sharing = 'circles' AND ? IS NOT NULL THEN (
      SELECT cm2.circle_id FROM circle_members cm1
      JOIN circle_members cm2 ON cm1.circle_id = cm2.circle_id
      WHERE cm1.user_id = ? AND cm1.status = 'active'
        AND cm2.user_id = ${a}.id AND cm2.status = 'active'
      LIMIT 1
    ) ELSE NULL END) AS shared_circle_id,
    CASE WHEN ${a}.location_sharing = 'specific' AND ? IS NOT NULL AND EXISTS (
      SELECT 1 FROM location_specific_shares lss
      WHERE lss.user_id = ${a}.id AND lss.recipient_user_id = ?
    ) THEN 1 ELSE 0 END AS via_specific,
    (CASE WHEN ? IS NOT NULL THEN (
      SELECT elg.event_id FROM event_location_grants elg
      JOIN bookings b ON b.event_id = elg.event_id
      WHERE elg.user_id = ${a}.id
        AND elg.expires_at > datetime('now')
        AND b.user_id = ?
        AND b.status IN ('pending', 'confirmed')
      LIMIT 1
    ) ELSE NULL END) AS shared_event_id
  `;
  const params: (string | null)[] = [
    viewerId, viewerId, viewerId, // via_friend
    viewerId, viewerId,           // shared_circle_id
    viewerId, viewerId,           // via_specific
    viewerId, viewerId,           // shared_event_id
  ];
  return { sql, params };
}

/**
 * Given the reason columns returned by buildLocationVisibilityReasonSelects,
 * collapse them into a single primary reason string plus optional context IDs.
 * Priority: self > event > circle > specific > friend > public.
 */
export function resolveVisibilityReason(
  row: Record<string, unknown>,
  userId: string,
  viewerId: string | null,
): { reason: 'self' | 'public' | 'friend' | 'circle' | 'specific' | 'event'; event_id?: string; circle_id?: string } {
  if (viewerId && userId === viewerId) return { reason: 'self' };
  const sharedEventId = row.shared_event_id as string | null;
  if (sharedEventId) return { reason: 'event', event_id: sharedEventId };
  const sharedCircleId = row.shared_circle_id as string | null;
  if (sharedCircleId) return { reason: 'circle', circle_id: sharedCircleId };
  if (row.via_specific) return { reason: 'specific' };
  if (row.via_friend) return { reason: 'friend' };
  return { reason: 'public' };
}

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
      OR (${a}.location_sharing = 'specific' AND ? IS NOT NULL AND EXISTS (
           SELECT 1 FROM location_specific_shares lss
           WHERE lss.user_id = ${a}.id
             AND lss.recipient_user_id = ?
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
    viewerId, viewerId,              // specific
    viewerId, viewerId,              // event grants
  ];
  return { sql, params };
}
