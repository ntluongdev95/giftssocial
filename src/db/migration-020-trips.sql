-- ============================================================================
-- Migration 020 — Trips (user-curated itineraries)
-- ============================================================================
-- A "trip" is a curated multi-stop itinerary a user shares: "Saturday Q1
-- brunch + coffee + bookstore, 320k total, 4h30". Each stop is free-form
-- text (no rigid FK to businesses) so users can include public spots,
-- parks, beaches, or anything Gao doesn't have in its DB yet.
--
-- Map trace works when a stop has place_lat/lng (entered via composer's
-- optional Nominatim autocomplete). Stops without coords still render in
-- the timeline — they just don't appear on the map.
--
-- Total cost/duration are denormalised at save time so the discover grid
-- doesn't have to aggregate on every render. Mixed-currency trips set
-- `total_currency = 'mixed'` and skip total_cost rather than convert.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-020-trips.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS trips (
  id              TEXT PRIMARY KEY,
  author_id       TEXT NOT NULL,
  title           TEXT NOT NULL,
  cover_image     TEXT,
  description     TEXT DEFAULT '',
  city            TEXT,
  -- Aggregates (computed when stops change)
  total_cost      REAL DEFAULT 0,
  total_currency  TEXT DEFAULT 'VND',  -- 'mixed' if stops use different currencies
  total_minutes   INTEGER DEFAULT 0,
  stop_count      INTEGER DEFAULT 0,
  -- Visibility / lifecycle
  visibility      TEXT NOT NULL DEFAULT 'public'
                  CHECK (visibility IN ('public', 'friends', 'private')),
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'archived')),
  view_count      INTEGER DEFAULT 0,
  save_count      INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trips_author   ON trips(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_public   ON trips(visibility, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_city     ON trips(city, status);
CREATE INDEX IF NOT EXISTS idx_trips_popular  ON trips(save_count DESC, view_count DESC);

CREATE TABLE IF NOT EXISTS trip_stops (
  id                TEXT PRIMARY KEY,
  trip_id           TEXT NOT NULL,
  position          INTEGER NOT NULL,        -- 0,1,2,…
  place_name        TEXT NOT NULL,           -- free-form text
  activity          TEXT DEFAULT '',         -- "brunch", "read a book"
  cost              REAL DEFAULT 0,
  cost_currency     TEXT DEFAULT 'VND',
  duration_minutes  INTEGER DEFAULT 0,
  notes             TEXT DEFAULT '',
  photos            TEXT DEFAULT '[]',       -- JSON array of URLs
  -- Optional geo for map trace
  place_lat         REAL,
  place_lng         REAL,
  created_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trip_stops_trip ON trip_stops(trip_id, position);
