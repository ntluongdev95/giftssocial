-- Seed 057: prop-ring's final question was hardcoded to "Will you marry
-- me?" — but this template is used for more than proposals (e.g. asking
-- someone to be a girlfriend/boyfriend). Add a select field so the
-- sender picks which question actually shows.

UPDATE templates
SET fields_schema = json('[
  {"key":"name",     "type":"text",        "label":"Their name (optional)", "placeholder":"e.g. Linh", "maxLength":40},
  {"key":"question", "type":"select",      "label":"Câu hỏi ở cuối", "default":"marry", "options":[
    {"value":"marry",      "label":"Cầu hôn — Will you marry me?"},
    {"value":"girlfriend", "label":"Ngỏ lời — Em làm bạn gái anh nhé?"},
    {"value":"boyfriend",  "label":"Ngỏ lời — Anh làm bạn trai em nhé?"}
  ]},
  {"key":"name1",    "type":"text",        "label":"Tên của bạn", "placeholder":"Nam", "maxLength":20, "required":true},
  {"key":"name2",    "type":"text",        "label":"Tên người ấy", "placeholder":"Linh", "maxLength":20, "required":true},
  {"key":"initials", "type":"text",        "label":"Chữ viết tắt của 2 người (không bắt buộc)", "placeholder":"N & L", "maxLength":10},
  {"key":"photos",   "type":"image-array", "label":"Photos of the two of you", "hint":"Để tạo trái tim ảnh đẹp, bạn nên tải lên ít nhất 6 ảnh — mua mở rộng để thêm ảnh", "maxItems":2}
]')
WHERE id = 'prop-ring';
