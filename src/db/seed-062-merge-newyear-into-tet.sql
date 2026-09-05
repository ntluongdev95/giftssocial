-- Seed 062: merge the 'new-year' occasion (Western New Year's Eve,
-- added in seed-060) into the pre-existing 'tet' occasion — one
-- picker section for all New Year templates instead of two.
--
-- Kept 'tet' as the surviving id (pre-existing, safer than reusing
-- the just-added 'new-year' id). Renamed it to a generic "New Year" /
-- "Năm Mới" label since it now covers both the fixed Dec 31 countdown
-- template and the lunar Tết templates, which don't share one exact
-- calendar date — widened to a ~45-day window centered on mid-January
-- so it naturally spans both Dec 31 and the lunar new year window,
-- and dropped is_lunar (no longer a single lunar-tracked date).

-- ─── 1. Widen + rename the surviving 'tet' occasion ───────────────────
UPDATE occasions
SET
  name = 'New Year',
  name_vi = 'Năm Mới',
  emoji = '🎉',
  date_month = 1,
  date_day = 15,
  is_lunar = 0,
  window_days = 45
WHERE id = 'tet';

-- ─── 2. Re-point newyear-countdown at 'tet' instead of 'new-year' ─────
UPDATE template_occasions
SET occasion_id = 'tet'
WHERE template_id = 'newyear-countdown' AND occasion_id = 'new-year';

-- ─── 3. Deactivate the now-redundant 'new-year' occasion ──────────────
-- (kept, not deleted, in case anything still references the row)
UPDATE occasions SET active = 0 WHERE id = 'new-year';
