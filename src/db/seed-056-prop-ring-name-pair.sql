-- Seed 056: prop-ring previously only took a single free-typed
-- "initials" field (e.g. "N & L"). Replace it with two separate name
-- inputs (sender's own name + partner's name) so the heart can render
-- "Nam & Linh" cleanly instead of relying on the sender to type the
-- ampersand format themselves. `initials` stays in the schema (not
-- required) so kisses already created with it still send fine — the
-- UI falls back to it when name1/name2 are empty.

UPDATE templates
SET fields_schema = json('[
  {"key":"name",     "type":"text",        "label":"Their name (optional)", "placeholder":"e.g. Linh", "maxLength":40},
  {"key":"name1",    "type":"text",        "label":"Tên của bạn", "placeholder":"Nam", "maxLength":20, "required":true},
  {"key":"name2",    "type":"text",        "label":"Tên người ấy", "placeholder":"Linh", "maxLength":20, "required":true},
  {"key":"initials", "type":"text",        "label":"Chữ viết tắt của 2 người (không bắt buộc)", "placeholder":"N & L", "maxLength":10},
  {"key":"photos",   "type":"image-array", "label":"Photos of the two of you", "hint":"Để tạo trái tim ảnh đẹp, bạn nên tải lên ít nhất 6 ảnh — mua mở rộng để thêm ảnh", "maxItems":2}
]')
WHERE id = 'prop-ring';
