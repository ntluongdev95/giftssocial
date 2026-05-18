-- ============================================================================
-- Migration 017 — Gift card marketplace
-- ============================================================================
-- Adds price + listing controls to gift_card_templates so businesses can
-- publish cards on a public marketplace.
--
-- Pricing is stored as a generic `price` (REAL) + `price_currency` (TEXT)
-- so the same column can hold Gao Points today and switch to VND / ETH /
-- USD later without another migration. Default currency = 'GAO'.
--
-- `is_listed_in_market` is independent of `status='active'`: a template can
-- be claimable via QR while opting OUT of the public list, or vice versa.
-- Default false so existing templates don't surface on the marketplace
-- without the merchant opting in.
--
-- Payment is NOT wired in this migration. Claim flow stays free for now;
-- the price column drives display only. Phase 2 will add deduction.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-017-gift-card-marketplace.sql
-- ============================================================================

ALTER TABLE gift_card_templates ADD COLUMN price REAL DEFAULT 0;
ALTER TABLE gift_card_templates ADD COLUMN price_currency TEXT DEFAULT 'GAO';
ALTER TABLE gift_card_templates ADD COLUMN is_listed_in_market INTEGER DEFAULT 0;

-- Index for the marketplace query — pull listed + currently-claimable cards.
CREATE INDEX IF NOT EXISTS idx_gct_market
  ON gift_card_templates(is_listed_in_market, status);
