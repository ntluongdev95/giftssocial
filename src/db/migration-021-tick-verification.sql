-- ============================================================================
-- Migration 021 — Tick verification (photo proof + peer approval)
-- ============================================================================
-- Adds the "social verified tick" flow:
--
--   • streaks.require_proof              — opt-in per habit. When true,
--                                          ticks must carry a photo URL and
--                                          start in 'pending' state until
--                                          peers approve.
--   • streak_checkins.photo_url          — proof image (R2/external URL).
--   • streak_checkins.confirmation_state — 'confirmed' (default for legacy
--                                          + non-proof streaks),
--                                          'pending' (awaiting peer review),
--                                          'rejected' (peers said no).
--   • streak_tick_votes                  — per-voter vote on a specific
--                                          checkin. PK enforces 1 vote per
--                                          voter per checkin. Re-voting
--                                          updates the row.
--
-- The streak length math counts only `confirmed` ticks — pending/rejected
-- ones don't grow the chain.
--
-- Threshold: a checkin becomes confirmed when
--   `approves > rejects AND approves >= ceil(otherActive / 2)`.
-- It becomes rejected on the inverse condition. Else it stays pending.
--
-- For solo streaks (no other active participants) with require_proof=true,
-- the tick endpoint auto-confirms — the photo is just a personal log.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-021-tick-verification.sql
-- ============================================================================

ALTER TABLE streaks ADD COLUMN require_proof INTEGER NOT NULL DEFAULT 0;

ALTER TABLE streak_checkins ADD COLUMN photo_url           TEXT;
ALTER TABLE streak_checkins ADD COLUMN confirmation_state  TEXT NOT NULL DEFAULT 'confirmed';

CREATE INDEX IF NOT EXISTS idx_streak_checkins_state
  ON streak_checkins(streak_id, confirmation_state);

CREATE TABLE IF NOT EXISTS streak_tick_votes (
  streak_id        TEXT NOT NULL,
  checkin_user_id  TEXT NOT NULL,
  checkin_date     TEXT NOT NULL,
  voter_id         TEXT NOT NULL,
  vote             TEXT NOT NULL CHECK (vote IN ('approve', 'reject')),
  created_at       TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (streak_id, checkin_user_id, checkin_date, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_streak_tick_votes_checkin
  ON streak_tick_votes(streak_id, checkin_user_id, checkin_date);
