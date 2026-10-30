-- Migration 039: NEAR-backed money gifts attached to a Kiss.
--
-- A Kiss may now optionally carry a real NEAR deposit, escrowed on the
-- Kiss Chain contract (contracts/kiss-chain) via `lock_gift`, and later
-- pulled out by the actual receiver via `claim_gift` once they have a
-- NEAR account (created through NEAR Auth/passkey at claim time — see
-- src/lib/near/). near_gift_status is NULL for the vast majority of
-- kisses (plain social gifts, unchanged) — it's only ever set for the
-- new money-gift path. All new columns are plain ADD COLUMN (nullable,
-- no default data needed), so no table rebuild is required here.

ALTER TABLE kisses ADD COLUMN near_amount_yocto TEXT DEFAULT NULL;
ALTER TABLE kisses ADD COLUMN near_gift_status TEXT DEFAULT NULL
  CHECK (near_gift_status IS NULL OR near_gift_status IN ('locked', 'claimed', 'wilted'));
ALTER TABLE kisses ADD COLUMN near_token_id TEXT DEFAULT NULL;
ALTER TABLE kisses ADD COLUMN near_sender_account_id TEXT DEFAULT NULL;
ALTER TABLE kisses ADD COLUMN near_claimer_account_id TEXT DEFAULT NULL;
ALTER TABLE kisses ADD COLUMN near_lock_tx_hash TEXT DEFAULT NULL;
ALTER TABLE kisses ADD COLUMN near_claim_tx_hash TEXT DEFAULT NULL;
ALTER TABLE kisses ADD COLUMN near_locked_at TEXT DEFAULT NULL;
ALTER TABLE kisses ADD COLUMN near_claimed_at TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_kisses_near_gift_status ON kisses(near_gift_status) WHERE near_gift_status IS NOT NULL;
