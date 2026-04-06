import { getDB } from '@/lib/db';

/**
 * Recalculates rating_avg and rating_count for a business and updates the businesses table.
 * Replaces PostgreSQL stored procedure update_business_rating(business_id).
 */
export async function updateBusinessRating(businessId: string): Promise<void> {
  const db = getDB();

  const row = await db
    .prepare("SELECT AVG(CAST(rating AS REAL)) as avg, COUNT(*) as cnt FROM reviews WHERE business_id = ? AND status = 'active'")
    .bind(businessId)
    .first<{ avg: number | null; cnt: number }>();

  const avg = row?.avg != null ? Math.round(row.avg * 10) / 10 : 0;
  const cnt = row?.cnt ?? 0;

  await db
    .prepare("UPDATE businesses SET rating_avg = ?, rating_count = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(avg, cnt, businessId)
    .run();
}
