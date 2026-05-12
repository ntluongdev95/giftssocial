-- ============================================================================
-- Migration 011 — Specific-people location sharing
-- ============================================================================
-- Adds a new audience mode for the privacy toggle: instead of "everyone /
-- friends / circles", a user can hand-pick the exact people who get to
-- see their location on the map.
--
-- New table `location_specific_shares` is a many-to-many between the
-- sharer and the chosen recipients. The visibility clause is updated
-- in `src/lib/visibility.ts` to honour rows here when the sharer's
-- `users.location_sharing = 'specific'`.
--
-- The existing `users.location_sharing` column gains a logical value
-- `'specific'` — no schema change needed because the column is a free-
-- form TEXT in SQLite. The server validator already lists the allowed
-- values explicitly.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-011-location-specific-shares.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS location_specific_shares (
  user_id           TEXT NOT NULL,   -- who is sharing their location
  recipient_user_id TEXT NOT NULL,   -- who can see it
  created_at        TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, recipient_user_id)
);

CREATE INDEX IF NOT EXISTS idx_lss_recipient
  ON location_specific_shares(recipient_user_id);
