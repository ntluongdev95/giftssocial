-- ============================================================================
-- Migration 020 — Streak reminders + push subscriptions
-- ============================================================================
-- Two pieces:
--
-- 1. Reminder fields on streaks
--    • reminder_at   — 'HH:MM' in the OWNER'S local clock (e.g. '07:00')
--    • reminder_tz   — IANA timezone (e.g. 'Asia/Ho_Chi_Minh')
--    Both NULL = no reminder for this streak.
--
-- 2. push_subscriptions — per-user, per-device Web Push endpoints stored
--    after the browser grants notification permission. Multiple devices
--    per user are allowed (laptop + phone). Endpoint is the natural PK
--    since each browser issues a unique URL.
--
-- Cron (every 15 min) walks the streaks table, computes "now in user's TZ",
-- and pushes A (in-app notify) + B (Web Push to all this user's
-- subscriptions) if the current minute falls inside the reminder window
-- AND today isn't already ticked.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-020-streak-reminders.sql
-- ============================================================================

ALTER TABLE streaks ADD COLUMN reminder_at TEXT;
ALTER TABLE streaks ADD COLUMN reminder_tz TEXT;
-- Tracks the YYYY-MM-DD we last sent a reminder for, scoped to the
-- streak. Prevents a 15-min cron from firing 4 reminders an hour.
ALTER TABLE streaks ADD COLUMN reminder_last_sent_for TEXT;

CREATE INDEX IF NOT EXISTS idx_streaks_reminder_active
  ON streaks(reminder_at)
  WHERE reminder_at IS NOT NULL AND status = 'active';

CREATE TABLE IF NOT EXISTS push_subscriptions (
  -- Push endpoint URL — unique per browser/device. The PK.
  endpoint     TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  -- Subscriber's public ECDH key (base64url) — used to encrypt payload.
  p256dh       TEXT NOT NULL,
  -- Subscriber's auth secret (base64url) — also used in encryption.
  auth         TEXT NOT NULL,
  user_agent   TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
