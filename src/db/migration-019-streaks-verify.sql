-- ============================================================================
-- Migration 019 — Verified Streaks (Layer 3 / Phase 2)
-- ============================================================================
-- Adds two verification modes beyond self-reported ticks:
--   • verify_method = 'checkin'  → a successful GPS/QR/NFC check-in at
--                                  `business_id` auto-creates today's tick.
--                                  Manual ticks are rejected — the only path
--                                  to a check-mark is real presence.
--   • verify_method = 'photo'    → tick requires `photo_url` in the request.
--                                  Friends see the photo inline in the feed.
--   • verify_method = 'self'     → existing behaviour (default).
--
-- `proof_source` on streak_checkins records HOW that tick was earned, used
-- to render a small badge in the feed ("auto", "📷", or blank for self).
--
-- SQLite ALTER TABLE doesn't support CHECK constraints — validation lives
-- in the API zod schemas instead.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-019-streaks-verify.sql
-- ============================================================================

ALTER TABLE streaks ADD COLUMN verify_method TEXT NOT NULL DEFAULT 'self';
ALTER TABLE streaks ADD COLUMN business_id   TEXT;

ALTER TABLE streak_checkins ADD COLUMN photo_url    TEXT;
ALTER TABLE streak_checkins ADD COLUMN proof_source TEXT NOT NULL DEFAULT 'manual';

-- Lookup index for the auto-tick hook in /api/v1/checkins:
-- "find all active streaks at this business that need to auto-tick"
CREATE INDEX IF NOT EXISTS idx_streaks_verify_biz
  ON streaks(business_id, verify_method)
  WHERE business_id IS NOT NULL;
