-- ============================================================================
-- Migration 013 — Wallet handoff tokens
-- ============================================================================
-- Short-lived single-use tokens that let the Gao Wallet Android app fetch
-- a specific gift card from Gao Social without sharing the user's main
-- session cookie.
--
-- Flow:
--   1. User clicks "Add to Gao Wallet" in /me/wallet
--   2. Server creates a row here (token, card_id, user_id, expires_at)
--   3. Server returns a deep link: gaowallet://add-card?token=<token>
--   4. Android OS opens Gao Wallet app with that URL
--   5. Wallet app calls GET /api/v1/gift-cards/handoff/<token>
--   6. Server validates token, marks as used, returns full card data
--
-- TTL: 15 minutes from creation. Single use — once consumed, the row's
-- used_at column is set and the endpoint refuses to reuse it.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-013-wallet-handoff-tokens.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallet_handoff_tokens (
  token      TEXT PRIMARY KEY,         -- random 32-char URL-safe string
  card_id    TEXT NOT NULL,             -- gift_cards.id this token unlocks
  user_id    TEXT NOT NULL,             -- creator (the card owner)
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,             -- created_at + 15 minutes
  used_at    TEXT                       -- NULL until consumed
);

CREATE INDEX IF NOT EXISTS idx_wht_expires ON wallet_handoff_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_wht_card    ON wallet_handoff_tokens(card_id);
