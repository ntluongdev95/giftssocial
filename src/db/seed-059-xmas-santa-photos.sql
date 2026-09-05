-- Seed 059: xmas-santa previously only took the seed-039 baseline
-- single "photo" field. Upgrade to an image-array (same pattern as
-- seed-058 for xmas-snow) so the finale's photo-heart mosaic has more
-- than one tile to work with. Free tier stays capped at 2.

UPDATE templates
SET fields_schema = json('[
  {"key":"name",   "type":"text",        "label":"Their name (optional)", "placeholder":"e.g. Linh", "maxLength":40},
  {"key":"photos", "type":"image-array", "label":"Photos for the heart (optional)", "hint":"Forms a small photo-heart in the finale — mua mở rộng để thêm ảnh", "maxItems":2}
]')
WHERE id = 'xmas-santa';
