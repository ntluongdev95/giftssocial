import type { NextRequest } from 'next/server';
import { getDB } from './db';
import { resolveUserId } from './resolveUser';

// Returns the caller's user_id if they are flagged is_admin=1; otherwise null.
// Callers should treat null as "not admin → 404 to avoid leaking the route".
export async function resolveAdminUserId(req: NextRequest): Promise<string | null> {
  const userId = await resolveUserId(req).catch(() => null);
  if (!userId) return null;
  try {
    const db = getDB();
    const row = await db
      .prepare('SELECT is_admin FROM users WHERE id = ?')
      .bind(userId)
      .first<{ is_admin: number }>();
    if (!row || row.is_admin !== 1) return null;
    return userId;
  } catch {
    return null;
  }
}
