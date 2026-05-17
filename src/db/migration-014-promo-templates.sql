-- ============================================================================
-- Migration 014 — Promo story templates
-- ============================================================================
-- Stores merchant-built promotional "stories" — a 9:16 mood-board canvas
-- with freely-positioned elements (text/image/sticker/gift card/button).
-- When sent to followers, each follower gets a notification linking to
-- a full-screen story view at /p/<id>.
--
-- `elements_json` is the source of truth for the visual layout. Shape:
--   [
--     { id, type, x, y, w, h, rotation, z, …type-specific props… },
--     ...
--   ]
-- All coords are % of the canvas (0–100) so the same data renders at any
-- output size (story preview, notification thumbnail, full-screen).
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-014-promo-templates.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS promo_templates (
  id                    TEXT PRIMARY KEY,
  business_id           TEXT NOT NULL,
  owner_user_id         TEXT NOT NULL,
  name                  TEXT NOT NULL,
  description           TEXT DEFAULT '',
  -- Canvas background
  background_color      TEXT DEFAULT '#fde3e0',
  background_image      TEXT,
  background_gradient_to TEXT,
  -- Freeform elements (see header doc for shape)
  elements_json         TEXT NOT NULL DEFAULT '[]',
  -- Optional attached gift card — if set, the story can deep-link to
  -- /g/<token> for one-tap claim.
  gift_card_template_id TEXT,
  -- Lifecycle
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'archived')),
  created_at            TEXT DEFAULT (datetime('now')),
  updated_at            TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_promo_business ON promo_templates(business_id, status);
CREATE INDEX IF NOT EXISTS idx_promo_owner    ON promo_templates(owner_user_id);

-- ── Send log: 1 row per recipient-blast (the actual notifications live
--    in the notifications table; this is the audit trail at the campaign
--    level + analytics counters)
CREATE TABLE IF NOT EXISTS promo_sends (
  id                TEXT PRIMARY KEY,
  template_id       TEXT NOT NULL,
  business_id       TEXT NOT NULL,
  audience          TEXT NOT NULL,        -- 'all_followers' | 'recent_customers' | 'vip'
  recipient_count   INTEGER DEFAULT 0,
  delivered_count   INTEGER DEFAULT 0,    -- notifications successfully inserted
  opened_count      INTEGER DEFAULT 0,    -- bumped when recipient views /p/<id>
  sent_at           TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_promo_sends_template ON promo_sends(template_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_promo_sends_business ON promo_sends(business_id, sent_at DESC);
