-- Migration 003 — extended location visibility model
-- Adds 'friends' and 'circles' to users.location_sharing, a time-limited
-- expiry column, and an event_location_grants table for per-event opt-in.
--
-- Run once against existing D1 databases. Fresh installs use schema-d1.sql
-- which already reflects the new state.
--
-- ── D1 compatibility ────────────────────────────────────────────────────
-- Cloudflare D1 rejects raw `BEGIN` / `COMMIT` (each --file invocation is
-- already a single batched transaction internally; emitting BEGIN aborts
-- with: "please use the state.storage.transaction() … APIs"). We therefore
-- omit the explicit transaction frame.
--
-- The full table-rebuild that the original Postgres migration performed to
-- widen the CHECK constraint cannot run idempotently on D1 once the new
-- schema-d1.sql has already created `users` with the wider CHECK. SQLite
-- accepts the wider value set going forward and the rebuild is therefore
-- only needed on legacy DBs that were initialised before schema-d1.sql
-- was widened — there are none in this repo's tracked envs. We keep the
-- canonical CHECK in schema-d1.sql and only add the missing column here.
-- The migration runner records this file's hash in _migrations after
-- success, so it never re-runs.
-- ─────────────────────────────────────────────────────────────────────────

-- 1) users.location_shared_until — expiry for the current share (NULL = indefinite)
--    SQLite has no `ADD COLUMN IF NOT EXISTS`. The migration runner's
--    idempotent-error handler tolerates "duplicate column name" so this is
--    safe to re-apply against DBs that already have the column.
ALTER TABLE users ADD COLUMN location_shared_until TEXT;

-- 2) Event-scoped location grants
CREATE TABLE IF NOT EXISTS event_location_grants (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  event_id          TEXT NOT NULL,
  expires_at        TEXT NOT NULL,
  created_at        TEXT DEFAULT (datetime('now')),
  UNIQUE (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_loc_user    ON event_location_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_event_loc_event   ON event_location_grants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_loc_expires ON event_location_grants(expires_at);
