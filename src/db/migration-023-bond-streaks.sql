-- ============================================================================
-- Migration 023 — Bond streaks (couple mode + virtual pet)
-- ============================================================================
-- Introduces a third streak_type beyond solo/group:
--   • 'couple' — exactly 2 participants (owner + 1 partner). Both raise a
--                shared virtual pet that evolves with their "synced days"
--                (days where BOTH ticked, both confirmed).
--
-- The pet itself is pure derivation — life stage + family size are
-- computed on the fly from synced_days in src/lib/bond-pet.ts. We only
-- store the SPECIES choice and a tiny ack list so the API knows when
-- both partners have agreed.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-023-bond-streaks.sql
-- ============================================================================

ALTER TABLE streaks ADD COLUMN streak_type TEXT NOT NULL DEFAULT 'solo';
-- Single emoji of the chosen species (e.g. '🦊'). NULL until adopted.
ALTER TABLE streaks ADD COLUMN bond_species TEXT;
-- JSON array of user_ids who confirmed the species (e.g. '["u1","u2"]').
-- The pet "hatches" only when both partners' ids are present.
ALTER TABLE streaks ADD COLUMN bond_species_agreed_by TEXT DEFAULT '[]';
