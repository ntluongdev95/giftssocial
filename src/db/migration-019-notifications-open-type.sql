-- ============================================================================
-- Migration 019 — Open up notifications.type
-- ============================================================================
-- The original notifications table pinned `type` to a closed CHECK list.
-- That doesn't scale — every new feature (marketplace gating, stories,
-- future surfaces) shouldn't require schema migrations just to emit a
-- notification.
--
-- SQLite can't ALTER CHECK constraints, so we rebuild the table:
--   1. Create a sibling with no type constraint (free-form TEXT).
--   2. Copy every existing row.
--   3. Swap the tables (DROP old, RENAME new).
--   4. Recreate indexes.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-019-notifications-open-type.sql
-- ============================================================================

CREATE TABLE notifications_new (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  type        TEXT NOT NULL,            -- no CHECK; new types added freely
  title       TEXT NOT NULL,
  body        TEXT DEFAULT '',
  ref_type    TEXT,
  ref_id      TEXT,
  read        INTEGER DEFAULT 0,
  seen        INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

INSERT INTO notifications_new (id, user_id, type, title, body, ref_type, ref_id, read, seen, created_at)
SELECT id, user_id, type, title, body, ref_type, ref_id, read, seen, created_at
FROM notifications;

DROP TABLE notifications;

ALTER TABLE notifications_new RENAME TO notifications;

CREATE INDEX IF NOT EXISTS idx_notif_user_unread ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user_created ON notifications(user_id, created_at DESC);
