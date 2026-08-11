-- ============================================================================
-- Migration 028 — Public Gao Gift cards (viral sharing)
-- ============================================================================
-- Stores the payload of Couple ID cards (and other gift-card templates)
-- that the creator has explicitly chosen to publish under a short URL.
-- Every row is one shareable card. `photo_url` points to R2 (via
-- src/lib/storage.ts uploadFile) so the row itself stays tiny.
--
--   • id             — 10-char base62 short id used in the public URL:
--                       /gifts/card/{id}
--   • kind           — 'couple_card' (future: 'movie_trailer', etc.)
--   • data_json      — the compact template payload as JSON
--                       (names, cardId, issue/expiry dates, variant,
--                        togetherSince, milestones — everything needed
--                        to re-render the card without a login)
--   • photo_url      — R2 URL of the couple photo (nullable — cards can
--                       be published without a photo)
--   • creator_id     — optional Gao user id who created the card. Nullable
--                       so guest users can still publish.
--   • view_count     — bumped on each public view (for viral analytics)
--   • created_at     — ISO timestamp
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --local \
--     --file=src/db/migration-028-public-gift-cards.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS public_gift_cards (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  data_json   TEXT NOT NULL,
  photo_url   TEXT,
  creator_id  TEXT,
  view_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_public_gift_cards_created_at
  ON public_gift_cards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_gift_cards_creator
  ON public_gift_cards(creator_id, created_at DESC);
