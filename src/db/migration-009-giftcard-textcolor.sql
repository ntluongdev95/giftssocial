-- ============================================================================
-- Migration 009 — Gift card text color
-- ============================================================================
-- Adds an optional override for the card's text color so merchants with
-- light-themed cards (Bridal, Pastel, Spa Zen, Rose Gold) can pick dark
-- text for readability. NULL = keep the legacy white default.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-009-giftcard-textcolor.sql
-- ============================================================================

ALTER TABLE gift_card_templates ADD COLUMN text_color TEXT;
