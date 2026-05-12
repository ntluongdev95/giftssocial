-- ============================================================================
-- Migration 012 — Widen users.location_sharing CHECK to include 'specific'
-- ============================================================================
-- Migration 011 introduced the `specific` audience mode but SQLite enforces
-- the column-level CHECK from migration-003 which only allowed
-- ('exact','approximate','friends','circles','off'). Writing 'specific'
-- raises a CHECK constraint failure and the PATCH endpoint returns 500.
--
-- SQLite can't ALTER a CHECK in place — rebuild the users table, copy
-- rows, drop the old, rename. Mirrors the technique used in migration-003.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-012-widen-location-sharing-check.sql
-- ============================================================================

-- D1 rejects raw BEGIN/COMMIT — use its automatic transaction wrapper
-- instead. PRAGMA foreign_keys cannot be toggled inside an in-progress
-- D1 statement either, so we rely on the absence of FK constraints on
-- the users table (none point AT it) to make the drop/rename safe.

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
                    CHECK (location_sharing IN ('exact', 'approximate', 'friends', 'circles', 'specific', 'off')),
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

CREATE INDEX IF NOT EXISTS idx_users_username    ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_gao_domain  ON users(gao_domain) WHERE gao_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_trust       ON users(trust_score DESC);
CREATE INDEX IF NOT EXISTS idx_users_location    ON users(location_lat, location_lng) WHERE location_lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_status      ON users(status);
