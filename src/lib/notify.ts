import { pgPool } from '@/lib/db';

/**
 * Create a notification for a user.
 * Fire-and-forget — never throws.
 */
export async function notify(
  userId: string,
  type: string,
  title: string,
  body: string = '',
  refType?: string,
  refId?: string
): Promise<void> {
  try {
    await pgPool.query(
      `INSERT INTO notifications (user_id, type, title, body, ref_type, ref_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, type, title, body, refType || null, refId || null]
    );
  } catch (err) {
    console.error('[Notify]', err);
  }
}
