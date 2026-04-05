import { pgPool } from '@/lib/db';

const REFRESH_TTL_DAYS = 90;

/**
 * Hash a refresh token for storage (never store raw tokens).
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new session when user logs in.
 */
export async function createSession(
  userId: string,
  refreshToken: string,
  req?: { headers: { get(name: string): string | null } }
): Promise<string> {
  const hash = await hashToken(refreshToken);
  const deviceInfo = req?.headers.get('user-agent')?.slice(0, 255) || null;
  const ip = req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req?.headers.get('x-real-ip')
    || null;
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86400_000);

  const { rows } = await pgPool.query(
    `INSERT INTO sessions (user_id, refresh_token_hash, device_info, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, hash, deviceInfo, ip, expiresAt]
  );
  return rows[0].id;
}

/**
 * Validate a refresh token against the sessions table.
 * Returns the session if valid, null if revoked/expired/not found.
 */
export async function validateRefreshToken(
  refreshToken: string
): Promise<{ session_id: string; user_id: string } | null> {
  const hash = await hashToken(refreshToken);
  const { rows } = await pgPool.query(
    `SELECT id, user_id FROM sessions
     WHERE refresh_token_hash = $1
       AND is_revoked = false
       AND expires_at > NOW()`,
    [hash]
  );
  if (rows.length === 0) return null;

  // Update last_active
  pgPool.query('UPDATE sessions SET last_active_at = NOW() WHERE id = $1', [rows[0].id]).catch(() => {});

  return { session_id: rows[0].id, user_id: rows[0].user_id };
}

/**
 * Rotate refresh token: revoke old, create new session entry.
 * This prevents replay attacks with stolen refresh tokens.
 */
export async function rotateRefreshToken(
  oldRefreshToken: string,
  newRefreshToken: string,
  userId: string
): Promise<void> {
  const oldHash = await hashToken(oldRefreshToken);
  const newHash = await hashToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86400_000);

  // Revoke old + create new in a transaction
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    // Get old session info to copy device_info/ip
    const { rows } = await client.query(
      'UPDATE sessions SET is_revoked = true WHERE refresh_token_hash = $1 RETURNING device_info, ip_address',
      [oldHash]
    );
    const old = rows[0] || {};

    await client.query(
      `INSERT INTO sessions (user_id, refresh_token_hash, device_info, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, newHash, old.device_info, old.ip_address, expiresAt]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Revoke a specific session (single device logout).
 */
export async function revokeSession(sessionId: string, userId: string): Promise<boolean> {
  const { rowCount } = await pgPool.query(
    'UPDATE sessions SET is_revoked = true WHERE id = $1 AND user_id = $2',
    [sessionId, userId]
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Revoke all sessions for a user (logout all devices).
 */
export async function revokeAllSessions(userId: string): Promise<number> {
  const { rowCount } = await pgPool.query(
    'UPDATE sessions SET is_revoked = true WHERE user_id = $1 AND is_revoked = false',
    [userId]
  );
  return rowCount ?? 0;
}

/**
 * List active sessions for a user (for "manage devices" UI).
 */
export async function listActiveSessions(userId: string) {
  const { rows } = await pgPool.query(
    `SELECT id, device_info, ip_address, last_active_at, created_at
     FROM sessions
     WHERE user_id = $1 AND is_revoked = false AND expires_at > NOW()
     ORDER BY last_active_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * Cleanup expired/revoked sessions (call periodically).
 */
export async function cleanupSessions(): Promise<number> {
  const { rowCount } = await pgPool.query(
    'DELETE FROM sessions WHERE expires_at < NOW() OR (is_revoked = true AND last_active_at < NOW() - INTERVAL \'7 days\')'
  );
  return rowCount ?? 0;
}
