-- ============================================================================
-- Migration 015 — Hashtags & topic pages
-- ============================================================================
-- RedNote-style hashtags. A `tags` row is the canonical topic; `tag_links`
-- is a polymorphic join from a tag to any taggable entity (currently:
-- reviews; extensible to checkins/events/etc).
--
-- Slug rules: lowercased ASCII, dashes-separated, derived from the original
-- text via slugify() (see src/lib/tags.ts). Vietnamese diacritics are
-- stripped — "Phở Bò" → "pho-bo". `display_name` keeps the first-seen
-- original spelling so topic pages still read naturally.
--
-- `use_count` is denormalized: bumped on every successful link insert
-- (INSERT OR IGNORE keeps re-tagging from inflating it).
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-015-hashtags.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS tags (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  description   TEXT DEFAULT '',
  use_count     INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_tags_use_count ON tags(use_count DESC);

CREATE TABLE IF NOT EXISTS tag_links (
  tag_id        TEXT NOT NULL,
  entity_type   TEXT NOT NULL
                CHECK (entity_type IN ('review', 'checkin', 'event', 'business', 'circle')),
  entity_id     TEXT NOT NULL,
  author_id     TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (tag_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_tag_links_entity ON tag_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_tag_links_tag_created ON tag_links(tag_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tag_links_author ON tag_links(author_id);
