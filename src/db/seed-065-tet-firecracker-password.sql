-- Seed 065: tet-firecracker — add the optional password-gate PIN
-- (existing 'password' field type, numeric up to 8 digits, already
-- supported by DynamicForm) so the recipient must enter it correctly
-- before the firecracker scene plays. Left blank → no gate.

UPDATE templates
SET fields_schema = json('[
  {"key":"name",     "type":"text",        "label":"Their name (optional)", "placeholder":"e.g. Linh", "maxLength":40},
  {"key":"photos",   "type":"image-array", "label":"Photos (optional)", "hint":"Shown as a polaroid in the reveal — mua mở rộng để thêm ảnh", "maxItems":2},
  {"key":"password", "type":"password",    "label":"Mật khẩu mở thiệp (không bắt buộc)"}
]')
WHERE id = 'tet-firecracker';
