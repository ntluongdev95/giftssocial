-- ============================================================================
-- Migration 016 — Now Stories (ephemeral 24h location-pinned posts)
-- ============================================================================
-- A `story` is a photo/video the author posts while physically at a venue
-- (verified by GPS). It is visible for 24h, then either auto-converts to a
-- review (via cron prompt) or soft-deletes. Distinct from `time_capsules`
-- in lifecycle: capsule = future unlock, story = now → expire.
--
-- Visibility model:
--   public   — anyone (requires trust_score >= 10 to prevent spam)
--   friends  — viewer must have a `follows` row → author
--   circles  — viewer must be in any of `circle_ids` (JSON array)
--
-- `place_name` is denormalized at post time — when the business renames
-- itself later, the story still reflects the moment it captured.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-016-stories.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS stories (
  id              TEXT PRIMARY KEY,
  author_id       TEXT NOT NULL,
  -- Place anchor — at least one of these for visibility != 'private'
  business_id     TEXT,
  event_id        TEXT,
  location_lat    REAL NOT NULL,
  location_lng    REAL NOT NULL,
  place_name      TEXT,                          -- denormalized for fast render
  -- Content
  media_url       TEXT NOT NULL,
  media_type      TEXT NOT NULL DEFAULT 'photo'
                  CHECK (media_type IN ('photo', 'video')),
  thumbnail_url   TEXT,
  duration_ms     INTEGER,                       -- video only
  caption         TEXT DEFAULT '',
  -- Visibility
  visibility      TEXT NOT NULL DEFAULT 'friends'
                  CHECK (visibility IN ('public', 'friends', 'circles')),
  circle_ids      TEXT DEFAULT '[]',             -- JSON array
  -- Lifecycle
  posted_at       TEXT DEFAULT (datetime('now')),
  expires_at      TEXT NOT NULL,
  view_count      INTEGER DEFAULT 0,
  -- Conversion (after 24h → review prompt)
  converted_review_id TEXT,
  deleted_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_stories_expires_active
  ON stories(expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_business_active
  ON stories(business_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_author_active
  ON stories(author_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_visibility
  ON stories(visibility, expires_at DESC);

-- View ledger — PRIMARY KEY enforces single-view-per-pair, lets us drive
-- "X friends viewed your story" cheaply.
CREATE TABLE IF NOT EXISTS story_views (
  story_id   TEXT NOT NULL,
  viewer_id  TEXT NOT NULL,
  viewed_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_story_views_viewer
  ON story_views(viewer_id, viewed_at DESC);
