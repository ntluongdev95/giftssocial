-- ============================================================================
-- Migration 018 — Marketplace merchant gating
-- ============================================================================
-- Anti-spam: businesses must apply and be manually approved before they can
-- list any gift card on the public /gift-cards/market.
--
-- Three changes:
--   1. `users.is_admin` — role flag for /admin/* pages.
--      Bootstrap admin manually with SQL after migrating:
--      UPDATE users SET is_admin = 1 WHERE id = '<your_user_id>';
--   2. `businesses.marketplace_enabled` — the gate. Defaults to 0; only flips
--      to 1 when the admin approves the corresponding application.
--   3. `marketplace_applications` — submission + review trail.
--
-- The demo gift cards seeded in /tmp/seed-marketplace.sql have already been
-- inserted with is_listed_in_market=1 on businesses with marketplace_enabled=0.
-- The backfill UPDATEs at the bottom flip those flags so the demo stays
-- visible. Remove or modify if you don't want the demo merchants pre-approved.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-018-marketplace-gating.sql
-- ============================================================================

ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;
ALTER TABLE businesses ADD COLUMN marketplace_enabled INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS marketplace_applications (
  id              TEXT PRIMARY KEY,
  business_id     TEXT NOT NULL,
  owner_user_id   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  -- Snapshot at submit time (preserved even if the business row changes later)
  business_name   TEXT NOT NULL,
  legal_name      TEXT NOT NULL,
  tax_id          TEXT NOT NULL,
  gao_domain      TEXT NOT NULL,
  contact_phone   TEXT NOT NULL,
  contact_email   TEXT NOT NULL,
  description     TEXT DEFAULT '',
  -- Review trail
  reviewer_id     TEXT,
  reviewer_notes  TEXT,
  submitted_at    TEXT DEFAULT (datetime('now')),
  reviewed_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_mkapp_business ON marketplace_applications(business_id);
CREATE INDEX IF NOT EXISTS idx_mkapp_owner ON marketplace_applications(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_mkapp_status ON marketplace_applications(status, submitted_at DESC);

-- ── Demo backfill ──────────────────────────────────────────────────────────
-- Pre-approve the businesses that already have demo cards listed on the
-- marketplace (seeded via /tmp/seed-marketplace.sql). Without this the demo
-- inventory would vanish from /gift-cards/market once the gate is wired.

UPDATE businesses
   SET marketplace_enabled = 1
 WHERE id IN (
   'biz_vn_01',     -- Highlands Coffee
   'biz_vn_02',     -- Golden Lotus Spa
   'biz_vn_03',     -- Saigon Boutique Fashion
   'biz_vn_04',     -- Pho 24 Ben Thanh
   'biz_seed_05',   -- Saigon Ink Tattoo
   'biz_seed_02',   -- Zen Yoga Studio
   'biz_seed_04',   -- Tech Hub Coworking
   'biz_seed_03'    -- Banh Mi Bay
 );
