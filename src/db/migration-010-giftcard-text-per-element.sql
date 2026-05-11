-- ============================================================================
-- Migration 010 — Per-element gift card text colors
-- ============================================================================
-- Extends migration-009 (text_color) with three overrides so the merchant
-- can paint each headline element separately:
--   text_color_business — business name across the top
--   text_color_value    — the big discount/value line (e.g. "20% off")
--   text_color_name     — the card name shown to customers
--
-- Each is nullable; render falls back to text_color, then to white.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-010-giftcard-text-per-element.sql
-- ============================================================================

ALTER TABLE gift_card_templates ADD COLUMN text_color_business TEXT;
ALTER TABLE gift_card_templates ADD COLUMN text_color_value    TEXT;
ALTER TABLE gift_card_templates ADD COLUMN text_color_name     TEXT;
