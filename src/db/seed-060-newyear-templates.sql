-- Seed 060: New Year templates — 2 for Lunar New Year ('tet', already
-- exists in the occasions table) + 1 new 'new-year' occasion (Western
-- New Year's Eve, Dec 31 / Jan 1) with its own template.
--
-- Templates all use React components in src/components/reveals/[id]/
-- (registered in _registry.ts) — no effects[] JSON needed.

-- ─── 1. New occasion: New Year's Eve (Dec 31 → Jan 1) ────────────────
INSERT OR REPLACE INTO occasions (
  id, name, name_vi, emoji, theme_color, bg_gradient,
  description, description_vi,
  date_month, date_day, is_lunar, evergreen, window_days,
  sort_order, active
) VALUES (
  'new-year',
  'New Year''s Eve',
  'Năm Mới Dương Lịch',
  '🎆',
  '#eab308',
  'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #eab308 100%)',
  'Countdown to midnight',
  'Đếm ngược đến giao thừa',
  12, 31, 0, 0, 14,
  6,
  1
);

-- ─── 2. Templates (3 rows) ────────────────────────────────────────────
INSERT OR REPLACE INTO templates (
  id, component_key, name, description, emoji, thumbnail_bg, accent_color,
  premium, coins, author,
  fields_schema, effects, active
) VALUES
  ('tet-mai-dao',        'tet-mai-dao',        'Mai & Đào Blossoms',   'Golden mai and pink đào blossoms drift down over a red-and-gold Tết backdrop.',        '🌸', 'linear-gradient(135deg, #fef2f2, #fbbf24)', '#dc2626', 0,  0, 'gao', NULL, NULL, 1),
  ('tet-firecracker',    'tet-firecracker',    'Firecrackers & Lanterns', 'Strings of firecrackers pop and red lanterns glow across a festive Tết night.',    '🧨', 'linear-gradient(135deg, #450a0a, #dc2626)', '#dc2626', 0,  0, 'gao', NULL, NULL, 1),
  ('newyear-countdown',  'newyear-countdown',  'Midnight Countdown',   'Fireworks burst over a midnight skyline as the countdown to the new year hits zero.',  '🎆', 'linear-gradient(135deg, #1e1b4b, #eab308)', '#eab308', 0,  0, 'gao', NULL, NULL, 1);

-- Default field schema — same as every other template: optional name +
-- optional photo, shown via PlaceholderReveal → parseKissData.
UPDATE templates
SET fields_schema = json('[
  {"key":"name",  "type":"text",  "label":"Their name (optional)", "placeholder":"e.g. Linh", "maxLength":40},
  {"key":"photo", "type":"image", "label":"A photo of them (optional)", "hint":"Shown as a polaroid in the reveal"}
]')
WHERE id IN ('tet-mai-dao', 'tet-firecracker', 'newyear-countdown');

-- ─── 3. Template ↔ occasion links ────────────────────────────────────
INSERT OR REPLACE INTO template_occasions (template_id, occasion_id, sort_order, featured) VALUES
  ('tet-mai-dao',       'tet',      1, 1),
  ('tet-firecracker',   'tet',      2, 0),
  ('newyear-countdown', 'new-year', 1, 1);
