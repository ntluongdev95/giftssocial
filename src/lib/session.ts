import { getDB, genId } from '@/lib/db';

const REFRESH_TTL_DAYS = 90;

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(
  userId: string,
  refreshToken: string,
  req?: { headers: { get(name: string): string | null } }
): Promise<string> {
  const db = getDB();
  const hash = await hashToken(refreshToken);
  const deviceInfo = req?.headers.get('user-agent')?.slice(0, 255) || null;
  const ip = req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req?.headers.get('x-real-ip')
    || null;
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86400_000).toISOString();
  const id = genId('sess_');

  await db.prepare(
    `INSERT INTO sessions (id, user_id, refresh_token_hash, device_info, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, userId, hash, deviceInfo, ip, expiresAt).run();

  return id;
}

/**
 * Returns true if the session row exists, isn't revoked, and hasn't expired.
 * Middleware calls this on every request that carries an access token whose
 * payload includes a `sid` claim — gives us per-device revocation in O(1).
 */
export async function validateSession(sessionId: string): Promise<boolean> {
  const db = getDB();
  const row = await db
    .prepare(
      `SELECT id FROM sessions
       WHERE id = ?
         AND is_revoked = 0
         AND expires_at > datetime('now')
       LIMIT 1`
    )
    .bind(sessionId)
    .first<{ id: string }>();
  return !!row;
}

export async function validateRefreshToken(
  refreshToken: string
): Promise<{ session_id: string; user_id: string } | null> {
  const db = getDB();
  const hash = await hashToken(refreshToken);

  const row = await db
    .prepare(
      `SELECT id, user_id FROM sessions
       WHERE refresh_token_hash = ?
         AND is_revoked = 0
         AND expires_at > datetime('now')`
    )
    .bind(hash)
    .first<{ id: string; user_id: string }>();

  if (!row) return null;

  // Fire-and-forget: update last_active
  db.prepare(`UPDATE sessions SET last_active_at = datetime('now') WHERE id = ?`)
    .bind(row.id).run().catch(() => {});

  return { session_id: row.id, user_id: row.user_id };
}

export async function rotateRefreshToken(
  oldRefreshToken: string,
  newRefreshToken: string,
  userId: string
): Promise<void> {
  const db = getDB();
  const oldHash = await hashToken(oldRefreshToken);
  const newHash = await hashToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86400_000).toISOString();
  const newId = genId('sess_');

  // Get device info from old session before revoking
  const old = await db
    .prepare('SELECT device_info, ip_address FROM sessions WHERE refresh_token_hash = ? AND is_revoked = 0')
    .bind(oldHash)
    .first<{ device_info: string | null; ip_address: string | null }>();

  // Revoke old + create new atomically via batch
  await db.batch([
    db.prepare('UPDATE sessions SET is_revoked = 1 WHERE refresh_token_hash = ?').bind(oldHash),
    db.prepare(
      `INSERT INTO sessions (id, user_id, refresh_token_hash, device_info, ip_address, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(newId, userId, newHash, old?.device_info ?? null, old?.ip_address ?? null, expiresAt),
  ]);
}

export async function revokeSession(sessionId: string, userId: string): Promise<boolean> {
  const db = getDB();
  const result = await db
    .prepare('UPDATE sessions SET is_revoked = 1 WHERE id = ? AND user_id = ?')
    .bind(sessionId, userId)
    .run();
  return ((result.meta?.changes as number | undefined) ?? 0) > 0;
}

export async function revokeAllSessions(userId: string): Promise<number> {
  const db = getDB();
  const result = await db
    .prepare('UPDATE sessions SET is_revoked = 1 WHERE user_id = ? AND is_revoked = 0')
    .bind(userId)
    .run();
  return (result.meta?.changes as number | undefined) ?? 0;
}

export async function listActiveSessions(userId: string) {
  const db = getDB();
  const result = await db
    .prepare(
      `SELECT id, device_info, ip_address, last_active_at, created_at
       FROM sessions
       WHERE user_id = ? AND is_revoked = 0 AND expires_at > datetime('now')
       ORDER BY last_active_at DESC`
    )
    .bind(userId)
    .all<Record<string, unknown>>();
  return result.results;
}

export async function cleanupSessions(): Promise<number> {
  const db = getDB();
  const result = await db
    .prepare(
      `DELETE FROM sessions
       WHERE expires_at < datetime('now')
          OR (is_revoked = 1 AND last_active_at < datetime('now', '-7 days'))`
    )
    .run();
  return (result.meta?.changes as number | undefined) ?? 0;
}
