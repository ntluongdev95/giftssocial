import { getDB, genId } from '@/lib/db';

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
    const db = getDB();
    await db
      .prepare(
        `INSERT INTO notifications (id, user_id, type, title, body, ref_type, ref_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(genId('ntf_'), userId, type, title, body, refType ?? null, refId ?? null)
      .run();
  } catch (err) {
    console.error('[Notify]', err);
  }
}
