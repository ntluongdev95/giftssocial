-- Seed 055: prop-ring's sky-tap moment shows a rotating "photo globe"
-- built from the couple's own photos, so the sender needs to be able
-- to upload more than one — upgrade its "photo" field to "image-array".
-- Free tier stays capped at 2 (same cap as the rest of the app's free
-- photo fields); the hint text upsells more without blocking anyone
-- who only adds the free 2 — the globe just reuses/repeats what it has.

UPDATE templates
SET fields_schema = json('[
  {"key":"name",     "type":"text",        "label":"Their name (optional)", "placeholder":"e.g. Linh", "maxLength":40},
  {"key":"initials", "type":"text",        "label":"Chữ viết tắt của 2 người", "placeholder":"N & L", "maxLength":10, "required":true},
  {"key":"photos",   "type":"image-array", "label":"Photos of the two of you", "hint":"Để tạo trái tim ảnh đẹp, bạn nên tải lên ít nhất 6 ảnh — mua mở rộng để thêm ảnh", "maxItems":2}
]')
WHERE id = 'prop-ring';
