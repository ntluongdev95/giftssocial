-- Seed 067: Silk & Blossoms — Vietnamese Women's Day (20/10) template.
--
-- The 'vietnam-womens-day' occasion already exists (seeded earlier,
-- theme_color #e11d48 / bg_gradient ffe4e6→fecdd3) but had no template
-- linked to it yet. This adds one React component (src/components/
-- reveals/silk-blossom/), registered in _registry.ts.

INSERT OR REPLACE INTO templates (
  id, component_key, name, name_vi, description, description_vi,
  emoji, thumbnail_bg, accent_color,
  premium, coins, author,
  fields_schema, effects, active
) VALUES (
  'silk-blossom',
  'silk-blossom',
  'Silk & Blossoms',
  'Lụa Thắm Sắc Hoa',
  'Hibiscus, cherry blossom, and tulip petals drift down past soft flowing silk-ribbon light streaks — a warm tribute for Vietnamese Women''s Day.',
  'Dải lụa mềm mại bay trong sắc hoa dâm bụt và hoa đào rơi — lời tri ân ấm áp dành cho ngày Phụ nữ Việt Nam.',
  '🌺',
  'linear-gradient(135deg, #ffe4e6, #e11d48)',
  '#e11d48',
  0, 0, 'gao',
  json('[
    {"key":"name",   "type":"text",        "label":"Their name (optional)", "placeholder":"e.g. Mẹ, Chị Lan", "maxLength":40},
    {"key":"photos", "type":"image-array", "label":"Photos (optional)", "hint":"Up to 3, shown as keepsake polaroids", "maxItems":3},
    {"key":"song",   "type":"audio-url",   "label":"A song for them (optional)", "hint":"YouTube / Spotify / SoundCloud / direct MP3 link"}
  ]'),
  NULL,
  1
);

INSERT OR REPLACE INTO template_occasions (template_id, occasion_id, sort_order, featured)
VALUES ('silk-blossom', 'vietnam-womens-day', 1, 1);
