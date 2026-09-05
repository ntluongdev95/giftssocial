-- Seed 064: tet-long-distance — "Xa Mặt, Gần Lòng", for couples apart
-- at Tết. React component in src/components/reveals/tet-long-distance/
-- (registered in _registry.ts) — no effects[] JSON needed.

INSERT OR REPLACE INTO templates (
  id, component_key, name, description, emoji, thumbnail_bg, accent_color,
  premium, coins, author,
  fields_schema, effects, active
) VALUES (
  'tet-long-distance', 'tet-long-distance', 'Xa Mặt, Gần Lòng',
  'Fireworks fill the sky, then a drone-light hand holds up your own photo together.',
  '📱', 'linear-gradient(135deg, #1a1440, #a78bfa)', '#a78bfa',
  0, 0, 'gao',
  json('[
    {"key":"name",   "type":"text",        "label":"Their name (optional)", "placeholder":"e.g. Linh", "maxLength":40},
    {"key":"photos", "type":"image-array", "label":"A photo of you two (optional)", "hint":"Shown inside the drone-formed phone — mua mở rộng để thêm ảnh", "maxItems":2}
  ]'),
  NULL, 1
);

INSERT OR REPLACE INTO template_occasions (template_id, occasion_id, sort_order, featured) VALUES
  ('tet-long-distance', 'tet', 3, 1);
