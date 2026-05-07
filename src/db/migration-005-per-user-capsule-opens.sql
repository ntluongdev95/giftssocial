-- ─── Per-user capsule opens — each recipient has their own reveal state ───
-- Before this migration, time_capsules.status / opened_at / opened_by tracked
-- a SINGLE global open. That meant once the sender (or any one recipient)
-- opened a capsule, every other recipient saw it as "Opened by you" without
-- ever experiencing the reveal animation, and message/photos leaked through
-- the GET endpoint. This table tracks open state per (capsule, user).
--
-- The capsule's own status / opened_at / opened_by columns are kept and now
-- represent the FIRST open by anyone (used to fire the creator notification
-- only once and as an "any open" flag for the sender's Memories list).
-- D1 (SQLite) compatible.

CREATE TABLE IF NOT EXISTS capsule_opens (
  capsule_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  opened_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (capsule_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_capsule_opens_user ON capsule_opens(user_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_capsule_opens_capsule ON capsule_opens(capsule_id);

-- Backfill: any capsule already marked unlocked has its original opener seeded
-- so the new per-user logic agrees with the existing status field.
INSERT OR IGNORE INTO capsule_opens (capsule_id, user_id, opened_at)
  SELECT id, opened_by, COALESCE(opened_at, datetime('now'))
  FROM time_capsules
  WHERE status = 'unlocked' AND opened_by IS NOT NULL;
