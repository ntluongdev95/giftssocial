-- Migration 040: claim-secret for NEAR money gifts.
--
-- Closes a real gap in migration-039's design: `lock_gift`-created
-- gifts have no NFT owner until claimed, so the app's own receiver_id
-- check (enforced only in POST /api/v1/kisses/[id]/claim) was the ONLY
-- thing stopping someone who merely knew the gao_kiss_id string from
-- calling claim_gift directly on chain and stealing the funds — that
-- check is never enforced by the contract itself. The contract now
-- requires a claim secret (see contracts/kiss-chain/src/lib.rs
-- claim_secret_hash); this column caches the plaintext for registered
-- receivers to fetch via a protected endpoint (GET
-- /api/v1/kisses/[id]/claim-secret, gated to receiver_id). Guest
-- receivers still get the secret the only way they can: embedded in
-- the share link/QR itself.

ALTER TABLE kisses ADD COLUMN near_claim_secret TEXT DEFAULT NULL;
