-- Migration 003 — extended location visibility model
-- Adds 'friends' and 'circles' to users.location_sharing, a time-limited
-- expiry column, and an event_location_grants table for per-event opt-in.
--
-- Run once against existing D1 databases. Fresh installs use schema-d1.sql
-- which already reflects the new state.

BEGIN;

PRAGMA foreign_keys = OFF;

-- 1) users.location_shared_until — expiry for the current share (NULL = indefinite)
ALTER TABLE users ADD COLUMN location_shared_until TEXT;

-- 2) Widen the CHECK constraint on location_sharing.
--    SQLite cannot ALTER CHECK in place — rebuild the table.
CREATE TABLE users_new (
  id                TEXT PRIMARY KEY,
  username          TEXT,
  display_name      TEXT,
  email             TEXT,
  phone             TEXT,
  avatar_url        TEXT,
  bio               TEXT DEFAULT '',
  gao_domain        TEXT,

  location_lat      REAL,
  location_lng      REAL,
  city              TEXT DEFAULT '',

  trust_score       INTEGER DEFAULT 0,
  trust_level       TEXT DEFAULT 'new'
                    CHECK (trust_level IN ('new', 'verified', 'trusted', 'highly_trusted')),
  badges            TEXT DEFAULT '[]',

  proofs_count      INTEGER DEFAULT 0,
  bookings_count    INTEGER DEFAULT 0,
  reviews_count     INTEGER DEFAULT 0,
  circles_count     INTEGER DEFAULT 0,
  followers_count   INTEGER DEFAULT 0,
  following_count   INTEGER DEFAULT 0,

  profile_visibility TEXT DEFAULT 'public'
                    CHECK (profile_visibility IN ('public', 'circles', 'private')),
  location_sharing  TEXT DEFAULT 'approximate'
                    CHECK (location_sharing IN ('exact', 'approximate', 'friends', 'circles', 'off')),
  location_shared_until TEXT,

  gao_points        INTEGER DEFAULT 0,

  role              TEXT DEFAULT 'user'
                    CHECK (role IN ('user', 'admin', 'moderator')),
  status            TEXT DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'deleted')),
  last_seen_at      TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

INSERT INTO users_new SELECT
  id, username, display_name, email, phone, avatar_url, bio, gao_domain,
  location_lat, location_lng, city,
  trust_score, trust_level, badges,
  proofs_count, bookings_count, reviews_count, circles_count, followers_count, following_count,
  profile_visibility, location_sharing, location_shared_until,
  gao_points, role, status, last_seen_at, created_at, updated_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_gao_domain ON users(gao_domain) WHERE gao_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_trust ON users(trust_score DESC);
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location_lat, location_lng) WHERE location_lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 3) Event-scoped location grants
CREATE TABLE IF NOT EXISTS event_location_grants (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  event_id          TEXT NOT NULL,
  expires_at        TEXT NOT NULL,
  created_at        TEXT DEFAULT (datetime('now')),
  UNIQUE (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_loc_user ON event_location_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_event_loc_event ON event_location_grants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_loc_expires ON event_location_grants(expires_at);

PRAGMA foreign_keys = ON;

COMMIT;
