import { getDB } from '@/lib/db';

/**
 * Recalculates trust score for a user and updates the users table.
 * Replaces PostgreSQL stored procedure recalculate_trust_score(user_id).
 *
 * Formula:
 *   proofs (active)           × 5, max 40
 *   bookings (completed)      × 3, max 20
 *   reviews (active)          × 2, max 15
 *   checkins (verified)       × 1, max 10
 *   circle_members (active)   × 2, max 10
 *   base                           + 5
 *   cap at 100
 */
export async function recalculateTrustScore(userId: string): Promise<number> {
  const db = getDB();

  const [proofs, bookings, reviews, checkins, circles] = await Promise.all([
    db.prepare("SELECT COUNT(*) as n FROM proofs WHERE user_id = ? AND status = 'active'").bind(userId).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) as n FROM bookings WHERE user_id = ? AND status = 'completed'").bind(userId).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) as n FROM reviews WHERE author_id = ? AND status = 'active'").bind(userId).first<{ n: number }>(),
    db.prepare('SELECT COUNT(*) as n FROM checkins WHERE user_id = ? AND verified = 1').bind(userId).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) as n FROM circle_members WHERE user_id = ? AND status = 'active'").bind(userId).first<{ n: number }>(),
  ]);

  let score = 5;
  score += Math.min((proofs?.n ?? 0) * 5, 40);
  score += Math.min((bookings?.n ?? 0) * 3, 20);
  score += Math.min((reviews?.n ?? 0) * 2, 15);
  score += Math.min(checkins?.n ?? 0, 10);
  score += Math.min((circles?.n ?? 0) * 2, 10);
  score = Math.min(score, 100);

  const trustLevel =
    score >= 85 ? 'highly_trusted' :
    score >= 60 ? 'trusted' :
    score >= 30 ? 'verified' : 'new';

  await db.prepare(
    `UPDATE users SET
      trust_score = ?,
      trust_level = ?,
      proofs_count = ?,
      bookings_count = ?,
      reviews_count = ?,
      circles_count = ?,
      updated_at = datetime('now')
    WHERE id = ?`
  ).bind(
    score, trustLevel,
    proofs?.n ?? 0, bookings?.n ?? 0, reviews?.n ?? 0, circles?.n ?? 0,
    userId
  ).run();

  return score;
}
