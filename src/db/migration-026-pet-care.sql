-- ============================================================================
-- Migration 026 — Pet care game (Tamagotchi-style actions + stats)
-- ============================================================================
-- Adds columns for the in-app pet care minigame:
--
--   • pet_happiness  — 0–100. Goes up on pet/play/walk, down on neglect.
--   • pet_energy     — 0–100. Goes up on feed/rest, down on play/walk.
--   • pet_bond       — 0–100. Climbs slowly from any care action. Never
--                       decays — it's the long-term loyalty stat.
--   • pet_last_*_at  — ISO timestamps for the four care actions. Used to
--                       compute decay and to throttle spam-tapping.
--   • pet_action_log — JSON array of up to 30 recent {at, action, line}
--                       entries — feeds the activity log inside the pet
--                       room overlay.
--
-- Stats default to mid-range so a freshly-hatched pet doesn't feel sad
-- before its humans have done anything.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --local \
--     --file=src/db/migration-026-pet-care.sql
-- ============================================================================

ALTER TABLE streaks ADD COLUMN pet_happiness     INTEGER DEFAULT 75;
ALTER TABLE streaks ADD COLUMN pet_energy        INTEGER DEFAULT 75;
ALTER TABLE streaks ADD COLUMN pet_bond          INTEGER DEFAULT 50;
ALTER TABLE streaks ADD COLUMN pet_last_pet_at   TEXT;
ALTER TABLE streaks ADD COLUMN pet_last_fed_at   TEXT;
ALTER TABLE streaks ADD COLUMN pet_last_played_at TEXT;
ALTER TABLE streaks ADD COLUMN pet_last_walked_at TEXT;
ALTER TABLE streaks ADD COLUMN pet_action_log    TEXT;
