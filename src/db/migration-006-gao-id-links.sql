-- Phase 4 — local link cache between social-web bootstrap users and
-- canonical Gao identities issued by gao-id-worker.
--
-- gao-id-worker remains the SOLE source of truth for `rootId`, the
-- canonical Gao Profile, wallet ownership, .gao domain ownership and
-- trust. This table only records "which local social-web bootstrap
-- account is currently associated with this canonical Gao identity"
-- — purely so the social-web UX can hydrate a normal bootstrap
-- session after a SIWE sign-in. Re-deriving the rootId from
-- gao-id-worker is always cheap (`GET /v2/auth/me`) and is the
-- authoritative answer.
--
-- This file is documentation; the bridge route at
-- `/api/v1/auth/gao-id` runs the same statements via
-- `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` on
-- every invocation, so no manual `wrangler d1 execute` is required
-- on the dev tier.

CREATE TABLE IF NOT EXISTS gao_id_links (
  -- Local key. Distinct from `gao_root_id` so we can track
  -- soft-unlinks or replace links without losing history later.
  id                 TEXT PRIMARY KEY,        -- 'glnk_' + hex(randomblob(16))

  -- The bootstrap social-web account this local session is bound to.
  -- Many bootstrap users could in principle pass through the same
  -- rootId over time (after explicit unlink + re-link); the UNIQUE
  -- index on `gao_root_id` enforces only one *active* link.
  bootstrap_user_id  TEXT NOT NULL,

  -- Canonical Gao identity (issued by gao-id-worker, format
  -- `gaoid_<ULID>`). Globally valid across every Gao app — this
  -- column is a cache reference, not an authority.
  gao_root_id        TEXT NOT NULL,

  -- Cached metadata from the verifying SIWE message. Useful for
  -- quick UI rendering without round-tripping the issuer; refresh
  -- on every successful bridge call.
  wallet_address     TEXT,
  chain_id           INTEGER,

  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (bootstrap_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- One active local bootstrap account per canonical rootId. If a
-- different bootstrap account tries to link the same rootId we want
-- a clear 409 (local_link_conflict) — this is a social-web-side
-- concern only; the rootId itself remains valid.
CREATE UNIQUE INDEX IF NOT EXISTS idx_gao_id_links_root ON gao_id_links(gao_root_id);
CREATE INDEX IF NOT EXISTS idx_gao_id_links_user ON gao_id_links(bootstrap_user_id);
