-- Seed 058: xmas-snow previously only took a single free "photo" field
-- (from the seed-039 baseline). Upgrade it to an image-array so the
-- sender can add a small stack of keepsake photos, shown propped by
-- the lantern in the winter scene. Free tier stays capped at 1 — the
-- hint text is the upsell surface for paying to add more, same
-- pattern already used by prop-ring's photo field.

UPDATE templates
SET fields_schema = json('[
  {"key":"name",   "type":"text",        "label":"Their name (optional)", "placeholder":"e.g. Linh", "maxLength":40},
  {"key":"photos", "type":"image-array", "label":"Ảnh kỷ niệm (không bắt buộc)", "hint":"Đặt cạnh đèn lồng trong khung cảnh — mua mở rộng để thêm ảnh", "maxItems":1}
]')
WHERE id = 'xmas-snow';
