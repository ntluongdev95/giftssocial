-- Seed 043: "Daily" everyday-gift occasion + 5 casual templates.
-- Pinned at sort_order=0 so it lands FIRST in the picker (default
-- section). Evergreen so it's always visible regardless of calendar.
--
-- Templates all use React components in src/components/reveals/daily-*/
-- (registered in _registry.ts) — no effects[] JSON needed.

-- ─── 1. Occasion ─────────────────────────────────────────────────────
INSERT OR REPLACE INTO occasions (
  id, name, name_vi, emoji, theme_color, bg_gradient,
  description, description_vi,
  date_month, date_day, is_lunar, evergreen, window_days,
  sort_order, active
) VALUES (
  'daily',
  'Daily',
  'Đời thường',
  '💌',
  '#ec4899',
  'linear-gradient(135deg, #fdf2f8 0%, #fbcfe8 100%)',
  'Little everyday gifts — good night, coffee, thinking of you',
  'Quà đời thường — chúc ngủ ngon, cafe, nhớ bạn',
  NULL, NULL, 0, 1, 0,
  0,        -- sort_order=0 → shows FIRST
  1
);

-- ─── 2. Templates (5 rows) ───────────────────────────────────────────
INSERT OR REPLACE INTO templates (
  id, component_key, name, description, emoji, thumbnail_bg, accent_color,
  premium, coins, author,
  fields_schema, effects, active
) VALUES
  ('daily-goodnight',    'daily-goodnight',    'Good Night',       'Moon + stars + zZz drifting down — perfect nightly wish.',                 '🌙', 'linear-gradient(135deg, #1e1b4b, #6366f1)', '#6366f1', 0, 0, 'gao', NULL, NULL, 1),
  ('daily-goodmorning',  'daily-goodmorning',  'Good Morning',     'Warm sunrise gradient with birds + sunshine.',                             '☀️', 'linear-gradient(135deg, #fed7aa, #f97316)', '#f59e0b', 0, 0, 'gao', NULL, NULL, 1),
  ('daily-lunch',        'daily-lunch',        'Enjoy Your Meal',  'Asian food emojis drifting over a warm cream backdrop.',                   '🍱', 'linear-gradient(135deg, #fef3c7, #22c55e)', '#22c55e', 0, 0, 'gao', NULL, NULL, 1),
  ('daily-coffee',       'daily-coffee',       'Coffee Break',     '"Let''s grab a coffee" mood — steam swirls on warm brown.',                '☕', 'linear-gradient(135deg, #78350f, #f59e0b)', '#b45309', 0, 0, 'gao', NULL, NULL, 1),
  ('daily-thinking',     'daily-thinking',     'Thinking of You',  'Soft "just because" hearts drifting on a pink dreamy backdrop.',           '💭', 'linear-gradient(135deg, #831843, #ec4899)', '#ec4899', 0, 0, 'gao', NULL, NULL, 1);

-- Default field schema — sender optionally provides recipient's name +
-- an optional photo (all daily templates support both via the shared
-- PlaceholderReveal → parseKissData helper).
UPDATE templates
SET fields_schema = json('[
  {"key":"name",  "type":"text",  "label":"Their name (optional)", "placeholder":"e.g. Linh", "maxLength":40},
  {"key":"photo", "type":"image", "label":"A photo of them (optional)", "hint":"Shown as a polaroid in the reveal"}
]')
WHERE id IN ('daily-goodnight','daily-goodmorning','daily-lunch','daily-coffee','daily-thinking');

-- ─── 3. Template ↔ occasion links ────────────────────────────────────
-- Good Night is the featured one (star ⭐ badge in the picker).
INSERT OR REPLACE INTO template_occasions (template_id, occasion_id, sort_order, featured) VALUES
  ('daily-goodnight',    'daily', 0, 1),
  ('daily-goodmorning',  'daily', 1, 0),
  ('daily-lunch',        'daily', 2, 0),
  ('daily-coffee',       'daily', 3, 0),
  ('daily-thinking',     'daily', 4, 0);
