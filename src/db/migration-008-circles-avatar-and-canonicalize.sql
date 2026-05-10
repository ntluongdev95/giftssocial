-- ============================================================================
-- Migration 008 — Circles avatar, capsule + gao-id-links canonicalize,
--                 _migrations ledger
-- ============================================================================
-- Purpose: bring older D1 databases (initialised before this commit) into
-- line with the canonical schema-d1.sql. New envs that init from
-- schema-d1.sql land here as a no-op.
--
-- Idempotency:
--   • Every CREATE uses IF NOT EXISTS.
--   • The single ALTER (`circles.avatar_url`) cannot use IF NOT EXISTS in
--     SQLite. The migration runner (`scripts/migrate.mjs`) catches the
--     "duplicate column name" error and treats it as success on re-apply.
--   • The runner records this file's name + sha256 in _migrations after
--     successful execution so re-running is a no-op.
-- ============================================================================

-- 1) circles.avatar_url ----------------------------------------------------
-- Referenced by /api/v1/search, /api/v1/circles/[id] PATCH, src/types/d1.d.ts
-- but missing from the original CREATE TABLE for circles.
ALTER TABLE circles ADD COLUMN avatar_url TEXT;

-- 2) Time capsules ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS time_capsules (
  id              TEXT PRIMARY KEY,
  creator_id      TEXT NOT NULL,
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  photos          TEXT DEFAULT '[]',
  location_lat    REAL NOT NULL,
  location_lng    REAL NOT NULL,
  location_name   TEXT,
  unlock_radius   INTEGER DEFAULT 100,
  buried_at       TEXT NOT NULL DEFAULT (datetime('now')),
  unlock_at       TEXT NOT NULL,
  capsule_type    TEXT DEFAULT 'private',
  recipient_ids   TEXT DEFAULT '[]',
  is_public       INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'buried',
  opened_at       TEXT,
  opened_by       TEXT,
  reply_message   TEXT,
  reply_at        TEXT,
  theme           TEXT DEFAULT 'classic'
);

CREATE INDEX IF NOT EXISTS idx_capsules_creator  ON time_capsules(creator_id);
CREATE INDEX IF NOT EXISTS idx_capsules_unlock   ON time_capsules(unlock_at);
CREATE INDEX IF NOT EXISTS idx_capsules_location ON time_capsules(location_lat, location_lng);
CREATE INDEX IF NOT EXISTS idx_capsules_public   ON time_capsules(is_public);

CREATE TABLE IF NOT EXISTS capsule_opens (
  capsule_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  opened_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (capsule_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_capsule_opens_user    ON capsule_opens(user_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_capsule_opens_capsule ON capsule_opens(capsule_id);

-- 3) Gao ID local link cache ----------------------------------------------
CREATE TABLE IF NOT EXISTS gao_id_links (
  id                 TEXT PRIMARY KEY,
  bootstrap_user_id  TEXT NOT NULL,
  gao_root_id        TEXT NOT NULL,
  wallet_address     TEXT,
  chain_id           INTEGER,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (bootstrap_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gao_id_links_root ON gao_id_links(gao_root_id);
CREATE INDEX IF NOT EXISTS idx_gao_id_links_user        ON gao_id_links(bootstrap_user_id);

-- 4) Migrations ledger ----------------------------------------------------
CREATE TABLE IF NOT EXISTS _migrations (
  name        TEXT PRIMARY KEY,
  hash        TEXT NOT NULL,
  applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
