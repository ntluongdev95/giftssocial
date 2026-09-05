-- Seed 063: tet-mai-dao — add an optional sender-written fortune text
-- for the "xin xăm" (fortune-stick draw) finale, so the tile the
-- recipient draws can carry the sender's own blessing instead of only
-- a random pick from the built-in list. Component falls back to the
-- built-in list when this field is left blank.

UPDATE templates
SET fields_schema = json('[
  {"key":"name",    "type":"text",     "label":"Their name (optional)", "placeholder":"e.g. Linh", "maxLength":40},
  {"key":"photos",  "type":"image-array", "label":"Photos (optional)", "hint":"Shown as a polaroid in the reveal — mua mở rộng để thêm ảnh", "maxItems":2},
  {"key":"xamText", "type":"textarea", "label":"Lời chúc lộc đầu năm (không bắt buộc)", "hint":"Hiện trên thẻ xăm khi họ lắc — để trống sẽ dùng lời chúc ngẫu nhiên có sẵn", "placeholder":"VD: Năm nay mọi điều ước của em đều thành hiện thực", "maxLength":120}
]')
WHERE id = 'tet-mai-dao';
