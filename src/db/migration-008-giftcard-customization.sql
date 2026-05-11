-- ============================================================================
-- Migration 008 — Gift card visual customization
-- ============================================================================
-- Extends gift_card_templates with the "Visual makeover" pack:
--   pattern     — overlay style baked onto the gradient ('none' default)
--   icon_emoji  — single emoji shown prominently on the card
--   tagline     — short marketing line under the value
--
-- cover_image already exists from migration-007 and now finally has UI for it.
-- Idempotent: SQLite's ADD COLUMN errors if a column exists, so we guard each
-- statement by checking sqlite_master.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-008-giftcard-customization.sql
-- ============================================================================

ALTER TABLE gift_card_templates ADD COLUMN pattern    TEXT DEFAULT 'none';
ALTER TABLE gift_card_templates ADD COLUMN icon_emoji TEXT;
ALTER TABLE gift_card_templates ADD COLUMN tagline    TEXT;
