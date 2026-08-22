-- Migration 038: guest receivers — send a kiss to someone with no account.
--
-- Business model change: only the SENDER needs an account now. The
-- receiver may not exist in `users` yet — in that case the kiss carries
-- a human-entered `receiver_name` + `receiver_address` (geocoded to
-- receiver_lat/receiver_lng, which already existed) instead of a real
-- `receiver_id`. `receiver_id` must therefore become nullable, which
-- SQLite can only do via a full table rebuild (no ALTER COLUMN).
--
-- All columns added by later migrations (030–037) are preserved with
-- their current defaults.

CREATE TABLE kisses_new (
  id                TEXT PRIMARY KEY,
  sender_id         TEXT NOT NULL,
  receiver_id       TEXT,                    -- nullable: guest (no-account) receivers
  receiver_name     TEXT,                    -- human-entered name when receiver_id is NULL
  receiver_address  TEXT,                    -- human-readable address string when receiver_id is NULL
  message           TEXT DEFAULT '',
  emoji             TEXT DEFAULT '💋',
  visibility        TEXT DEFAULT 'public'
                    CHECK (visibility IN ('public', 'private')),
  kiss_type         TEXT DEFAULT 'kiss'
                    CHECK (kiss_type IN ('kiss', 'declaration')),
  sender_lat        REAL,
  sender_lng        REAL,
  receiver_lat      REAL,
  receiver_lng      REAL,
  opened            INTEGER DEFAULT 0,
  opened_at         TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  photos            TEXT DEFAULT '[]',
  music_url         TEXT DEFAULT NULL,
  music_title       TEXT DEFAULT NULL,
  open_count        INTEGER DEFAULT 0,
  max_opens         INTEGER DEFAULT 20,
  template_id       TEXT DEFAULT NULL,
  template_data     TEXT,
  slug              TEXT
);

INSERT INTO kisses_new (
  id, sender_id, receiver_id, message, emoji, visibility, kiss_type,
  sender_lat, sender_lng, receiver_lat, receiver_lng,
  opened, opened_at, created_at,
  photos, music_url, music_title, open_count, max_opens,
  template_id, template_data, slug
)
SELECT
  id, sender_id, receiver_id, message, emoji, visibility, kiss_type,
  sender_lat, sender_lng, receiver_lat, receiver_lng,
  opened, opened_at, created_at,
  photos, music_url, music_title, open_count, max_opens,
  template_id, template_data, slug
FROM kisses;

DROP TABLE kisses;
ALTER TABLE kisses_new RENAME TO kisses;

CREATE INDEX IF NOT EXISTS idx_kisses_sender ON kisses(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kisses_receiver ON kisses(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kisses_visibility ON kisses(visibility, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kisses_slug ON kisses(slug) WHERE slug IS NOT NULL;
