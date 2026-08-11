-- ============================================================================
-- Migration 018 — Health Streaks (Habitify-style habit chains with friends)
-- ============================================================================
-- Three core ideas:
--   • A `streak` = the habit definition (title, icon, schedule, target).
--   • A `streak_checkin` = a single user marking the habit done on a date.
--     PRIMARY KEY (streak_id, user_id, date) makes it idempotent — re-ticking
--     the same day is a no-op.
--   • A `streak_partner` = another user who joined the streak as a buddy.
--     Owner is the implicit first partner; others are invited.
--
-- Streak length (the "chain") is computed on-the-fly from streak_checkins
-- in API code, not stored. That way schedule edits or back-dated ticks
-- don't require a denormalised counter rebuild.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-018-streaks.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS streaks (
  id              TEXT PRIMARY KEY,
  owner_id        TEXT NOT NULL,
  title           TEXT NOT NULL,
  icon            TEXT DEFAULT '🔥',                    -- single emoji
  description     TEXT DEFAULT '',
  -- Target shape — 'check' = boolean tick, 'counter' = integer value
  target_type     TEXT NOT NULL DEFAULT 'check'
                  CHECK (target_type IN ('check', 'counter')),
  target_value    INTEGER DEFAULT 1,
  target_unit     TEXT DEFAULT '',                      -- 'mins'|'glasses'|'km'|'reps'|''
  -- Weekly schedule — JSON array of weekdays 0..6 (0=Sun, 1=Mon, ..., 6=Sat).
  -- Default '[0,1,2,3,4,5,6]' = every day.
  schedule_json   TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
  visibility      TEXT NOT NULL DEFAULT 'friends'
                  CHECK (visibility IN ('private', 'friends', 'circles')),
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'paused', 'archived')),
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_streaks_owner ON streaks(owner_id, status);

-- ── Daily ticks ──────────────────────────────────────────────────────────
-- `date` is YYYY-MM-DD in the USER'S local timezone — computed client-side
-- so midnight rollover is per-user. Server stores the string verbatim.
CREATE TABLE IF NOT EXISTS streak_checkins (
  streak_id   TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  date        TEXT NOT NULL,
  value       INTEGER DEFAULT 1,
  note        TEXT DEFAULT '',
  created_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (streak_id, user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_streak_checkins_user_date
  ON streak_checkins(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_streak_checkins_streak_date
  ON streak_checkins(streak_id, date DESC);

-- ── Partners (buddies in the same streak) ────────────────────────────────
-- The owner is NOT inserted here — `streaks.owner_id` is authoritative.
-- This table lists everyone else with access (invited or self-joined later).
CREATE TABLE IF NOT EXISTS streak_partners (
  streak_id   TEXT NOT NULL,
  partner_id  TEXT NOT NULL,
  invited_by  TEXT,                                     -- who sent the invite
  joined_at   TEXT DEFAULT (datetime('now')),
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('pending', 'active', 'left')),
  PRIMARY KEY (streak_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_streak_partners_user
  ON streak_partners(partner_id, status);

-- ── Reactions on a specific checkin (🔥 cheer, 👏 hi-five, 💪 push) ──────
-- Composite PK prevents the same reactor from spamming the same emoji on
-- the same checkin.
CREATE TABLE IF NOT EXISTS streak_reactions (
  streak_id        TEXT NOT NULL,
  checkin_user_id  TEXT NOT NULL,
  checkin_date     TEXT NOT NULL,
  reactor_id       TEXT NOT NULL,
  emoji            TEXT NOT NULL,
  created_at       TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (streak_id, checkin_user_id, checkin_date, reactor_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_streak_reactions_checkin
  ON streak_reactions(streak_id, checkin_user_id, checkin_date);
