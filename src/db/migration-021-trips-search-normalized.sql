-- ============================================================================
-- Migration 021 — Diacritic-free search for trips
-- ============================================================================
-- SQLite LIKE doesn't strip Vietnamese diacritics, so 'co to' won't match
-- 'Cô Tô'. We mirror title and city into `*_normalized` columns populated
-- by the app's normalizeForSearch helper (NFD-strip + lowercase + đ→d).
-- The search route then matches against these columns and accepts both
-- the original query and a normalized form so users can type with or
-- without accent marks.
--
-- Backfill the existing demo trip at the end. New trips populate the
-- normalized columns via POST/PATCH (see src/app/api/v1/trips/route.ts).
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-021-trips-search-normalized.sql
-- ============================================================================

ALTER TABLE trips ADD COLUMN title_normalized TEXT DEFAULT '';
ALTER TABLE trips ADD COLUMN city_normalized TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_trips_title_normalized
  ON trips(title_normalized);
CREATE INDEX IF NOT EXISTS idx_trips_city_normalized
  ON trips(city_normalized);

-- One-time backfill for the demo Cô Tô seed. The app handles every new row.
UPDATE trips
   SET title_normalized = 'co to 3 ngay 2 dem - bien xanh cat trang',
       city_normalized  = 'quang ninh'
 WHERE id = 'trip_cotô_demo';
