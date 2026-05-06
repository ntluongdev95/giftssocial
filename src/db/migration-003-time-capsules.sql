-- ─── Time Capsules — bury memories at locations, unlock by time + GPS ───
-- D1 (SQLite) compatible

CREATE TABLE IF NOT EXISTS time_capsules (
  id              TEXT PRIMARY KEY,
  creator_id      TEXT NOT NULL,

  -- Content
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  photos          TEXT DEFAULT '[]',

  -- Location
  location_lat    REAL NOT NULL,
  location_lng    REAL NOT NULL,
  location_name   TEXT,
  unlock_radius   INTEGER DEFAULT 100,

  -- Timing (ISO strings)
  buried_at       TEXT NOT NULL DEFAULT (datetime('now')),
  unlock_at       TEXT NOT NULL,

  -- Visibility
  capsule_type    TEXT DEFAULT 'private',
  recipient_ids   TEXT DEFAULT '[]',
  is_public       INTEGER DEFAULT 0,

  -- State
  status          TEXT DEFAULT 'buried',
  opened_at       TEXT,
  opened_by       TEXT,
  reply_message   TEXT,
  reply_at        TEXT,

  -- Metadata
  theme           TEXT DEFAULT 'classic'
);

CREATE INDEX IF NOT EXISTS idx_capsules_creator ON time_capsules(creator_id);
CREATE INDEX IF NOT EXISTS idx_capsules_unlock ON time_capsules(unlock_at);
CREATE INDEX IF NOT EXISTS idx_capsules_location ON time_capsules(location_lat, location_lng);
CREATE INDEX IF NOT EXISTS idx_capsules_public ON time_capsules(is_public);
