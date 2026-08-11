-- ============================================================================
-- Migration 024 — Bond breeds (real photos for each species variant)
-- ============================================================================
-- Layer on top of bond_species. When a couple picks 🐕 they go a level
-- deeper to choose a BREED (Corgi, Husky, Shiba…). Each breed has:
--
--   • bond_breed_id        — stable id for re-renders ("corgi", "siamese")
--   • bond_breed_label     — display name ("Corgi", "Siamese")
--   • bond_breed_image_url — the chosen photo URL (one picked at creation,
--                            then persisted forever so the family card is
--                            stable across reloads)
--
-- For 🐕 and 🐈 the photos come live from Dog CEO + The Cat API via a
-- server proxy. Other species fall back to a curated catalog in
-- src/lib/bond-breeds-catalog.ts.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-024-bond-breeds.sql
-- ============================================================================

ALTER TABLE streaks ADD COLUMN bond_breed_id        TEXT;
ALTER TABLE streaks ADD COLUMN bond_breed_label     TEXT;
ALTER TABLE streaks ADD COLUMN bond_breed_image_url TEXT;
