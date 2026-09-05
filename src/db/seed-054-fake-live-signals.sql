-- ============================================================================
-- TEMPORARY dev-only seed: bulk-fake "live" signals scattered across the
-- whole world (not clustered around the seeded VN users) so the world
-- map's pulse/arc visuals have plenty of points everywhere to animate
-- while testing. author_id round-robins through existing users — only
-- the location matters for the map.
-- Not meant for production — delete/skip this file when seeding prod.
-- ============================================================================

DELETE FROM signals WHERE id LIKE 'sig_fake_%';

WITH RECURSIVE seq(i) AS (
  SELECT 1
  UNION ALL
  SELECT i + 1 FROM seq WHERE i < 400
),
authors AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn, COUNT(*) OVER () AS total
  FROM users
)
INSERT INTO signals (id, author_id, type, title, description, category, location_lat, location_lng, radius, visibility, trust_score_snapshot, verified, expires_at, status)
SELECT
  'sig_fake_' || seq.i,
  a.id,
  CASE (ABS(RANDOM()) % 6)
    WHEN 0 THEN 'presence'
    WHEN 1 THEN 'intent'
    WHEN 2 THEN 'offer'
    WHEN 3 THEN 'event'
    WHEN 4 THEN 'update'
    ELSE 'proof'
  END,
  'Đang online gần đây',
  'Fake signal cho demo bản đồ',
  'general',
  -- roughly avoid the poles: -55..70 lat
  ((ABS(RANDOM()) % 12500) / 100.0) - 55,
  -- full longitude spread: -175..175
  ((ABS(RANDOM()) % 35000) / 100.0) - 175,
  300,
  'public',
  50,
  0,
  datetime('now', '+30 days'),
  'active'
FROM seq
JOIN authors a ON a.rn = ((seq.i - 1) % a.total) + 1;
