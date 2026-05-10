-- ============================================================================
-- Gao Social V3 — Local Dev Seed for Gift Card templates
-- Run after seed-local.sql so the businesses these templates reference exist.
-- Idempotent (INSERT OR IGNORE on stable ids) — safe to re-run.
-- ============================================================================
--
-- Pre-canned templates against seed-local.sql businesses, one per type so
-- every code path has a clickable example end-to-end:
--   • voucher       → 20 % off
--   • stored_value  → 500 000 VND wallet
--   • service       → free banh mi
--   • loyalty       → 5-day coworking pass
--
-- claim_token values are hard-coded so QA can deep-link to /g/<token>
-- without querying the DB first.
-- ============================================================================

INSERT OR IGNORE INTO gift_card_templates (
  id, business_id, owner_user_id, name, description, type,
  face_value, percent_off, amount_off, service_name, currency,
  cover_image, gradient_from, gradient_to, claim_token,
  max_claims, current_claims, one_per_user,
  starts_at, ends_at, expires_in_days, status
) VALUES
('gct_seed_01', 'biz_seed_01', 'user_seed_01',
  '20% off any drink', 'Show this card on your next visit. One per customer.',
  'voucher',
  0, 20, 0, NULL, 'VND',
  NULL, '#00d4ff', '#a78bfa', 'tch20off2026',
  100, 0, 1,
  NULL, NULL, 30, 'active'),

('gct_seed_02', 'biz_seed_02', 'user_seed_03',
  '500k yoga wallet', 'Stored-value pass — burn it down across drop-ins.',
  'stored_value',
  500000, 0, 0, NULL, 'VND',
  NULL, '#22c55e', '#0ea5e9', 'zen500kvalue',
  50, 0, 1,
  NULL, NULL, 90, 'active'),

('gct_seed_03', 'biz_seed_03', 'user_seed_04',
  'Free banh mi special', 'One free Banh Mi Special on the house.',
  'service',
  0, 0, 0, 'Banh Mi Special', 'VND',
  NULL, '#f59e0b', '#ef4444', 'bmifreebmibay',
  200, 0, 1,
  NULL, NULL, 30, 'active'),

('gct_seed_04', 'biz_seed_04', 'user_seed_02',
  'Coworking 5-day pass', '5 day-passes; redeem one per visit until used up.',
  'loyalty',
  5, 0, 0, NULL, 'USD',
  NULL, '#a78bfa', '#ec4899', 'tech5dayloyal',
  20, 0, 1,
  NULL, NULL, 60, 'active');
