-- ============================================================================
-- Migration 007 — Gift cards
-- ============================================================================
-- Adds the three tables that power the merchant gift-card flow:
--   gift_card_templates    — drops a business owner publishes
--   gift_cards             — per-customer claimed instances
--   gift_card_redemptions  — audit log per scan
--
-- Idempotent: every CREATE uses IF NOT EXISTS so re-running is safe.
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-007-gift-cards.sql
-- ============================================================================

-- ── Templates: one row per "drop" the merchant publishes ──────────────────
CREATE TABLE IF NOT EXISTS gift_card_templates (
  id                TEXT PRIMARY KEY,
  business_id       TEXT NOT NULL,
  owner_user_id     TEXT NOT NULL,            -- business owner (for permission)
  name              TEXT NOT NULL,
  description       TEXT DEFAULT '',
  type              TEXT NOT NULL DEFAULT 'voucher'
                    CHECK (type IN ('voucher', 'stored_value', 'service', 'loyalty')),
  -- Stored value: face_value is the wallet $ that loads on claim.
  -- Voucher: percent_off (0–100) OR amount_off (currency). Service: free unit.
  face_value        REAL DEFAULT 0,           -- numeric $ for stored_value
  percent_off       INTEGER DEFAULT 0,        -- 0..100 for voucher type
  amount_off        REAL DEFAULT 0,           -- flat $ off
  service_name      TEXT,                     -- for service vouchers
  currency          TEXT DEFAULT 'VND',
  cover_image       TEXT,
  gradient_from     TEXT DEFAULT '#00d4ff',   -- card design accents
  gradient_to       TEXT DEFAULT '#a78bfa',
  -- Distribution: how customers claim
  claim_token       TEXT NOT NULL UNIQUE,     -- public QR / link slug
  max_claims        INTEGER DEFAULT 0,        -- 0 = unlimited
  current_claims    INTEGER DEFAULT 0,
  one_per_user      INTEGER DEFAULT 1,        -- BOOLEAN — block re-claim
  -- Lifecycle of the *template* (not the card)
  starts_at         TEXT,                     -- when claimable opens
  ends_at           TEXT,                     -- when claimable closes
  -- Lifecycle of *each card* once claimed
  expires_in_days   INTEGER DEFAULT 30,       -- card expires N days after claim
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gct_business    ON gift_card_templates(business_id, status);
CREATE INDEX IF NOT EXISTS idx_gct_owner       ON gift_card_templates(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_gct_claim_token ON gift_card_templates(claim_token);

-- ── Per-customer claimed gift cards ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS gift_cards (
  id                TEXT PRIMARY KEY,
  template_id       TEXT NOT NULL,
  business_id       TEXT NOT NULL,
  claimed_by_user_id TEXT NOT NULL,
  claimed_at        TEXT DEFAULT (datetime('now')),
  expires_at        TEXT,                     -- claim_at + template.expires_in_days
  -- Mutable state
  value_remaining   REAL DEFAULT 0,           -- for stored_value cards; 0 once spent
  uses_remaining    INTEGER DEFAULT 1,        -- voucher/service: usually 1
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'redeemed', 'expired', 'revoked')),
  -- Recipient gifting metadata (when one user buys for another)
  gifter_user_id    TEXT,
  gift_message      TEXT
);

CREATE INDEX IF NOT EXISTS idx_gc_user     ON gift_cards(claimed_by_user_id, status);
CREATE INDEX IF NOT EXISTS idx_gc_business ON gift_cards(business_id, status);
CREATE INDEX IF NOT EXISTS idx_gc_template ON gift_cards(template_id);
CREATE INDEX IF NOT EXISTS idx_gc_expiry   ON gift_cards(expires_at);

-- ── Per-redemption audit log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gift_card_redemptions (
  id                TEXT PRIMARY KEY,
  card_id           TEXT NOT NULL,
  template_id       TEXT NOT NULL,
  business_id       TEXT NOT NULL,
  customer_user_id  TEXT NOT NULL,            -- who is claiming the discount
  merchant_user_id  TEXT NOT NULL,            -- who scanned (typically business owner / staff)
  amount_used       REAL DEFAULT 0,           -- $ deducted (stored_value) or 0 for voucher
  location_lat      REAL,
  location_lng      REAL,
  redeemed_at       TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gcr_card     ON gift_card_redemptions(card_id);
CREATE INDEX IF NOT EXISTS idx_gcr_business ON gift_card_redemptions(business_id, redeemed_at DESC);
