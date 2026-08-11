-- ============================================================================
-- Migration 029 — Story CTA link (for Gao Gift card shares + future embeds)
-- ============================================================================
-- Adds two nullable columns to `stories` so a story can carry an external
-- CTA button ("Khám phá now →") pointing at a URL. Introduced for the
-- Gao Gift couple-card sharing flow: user publishes card, then taps
-- "Share to Story" which creates a story with:
--
--   caption   = "Cùng bấm xem tình yêu của tụi mình nè ❤️"
--   link_url  = https://gao.social/gifts/card/{shortId}
--   link_label= "Khám phá now"
--
-- Both nullable so existing stories keep working unchanged.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --local \
--     --file=src/db/migration-029-story-link-cta.sql
-- ============================================================================

ALTER TABLE stories ADD COLUMN link_url   TEXT;
ALTER TABLE stories ADD COLUMN link_label TEXT;
