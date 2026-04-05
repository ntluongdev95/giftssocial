-- ─── Auth Sessions — Token Revocation & Device Management ─────────────────
-- Tracks active sessions per user. Supports:
--   - Per-device logout
--   - "Logout all devices"
--   - Token revocation (refresh token bound to session)
--   - Session activity tracking

CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY DEFAULT 'sess_' || replace(gen_random_uuid()::text, '-', ''),
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,       -- SHA-256 hash of refresh token (never store raw)
  device_info     TEXT,                    -- User-Agent or device fingerprint
  ip_address      TEXT,
  is_revoked      BOOLEAN NOT NULL DEFAULT false,
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_hash ON sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at) WHERE NOT is_revoked;

-- Auto-cleanup expired sessions (run periodically or via pg_cron)
-- DELETE FROM sessions WHERE expires_at < NOW() OR is_revoked = true;
