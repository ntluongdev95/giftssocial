-- Seed 040: register the "Birthday Journey" template — the Time-Sealed
-- Gao Gifts birthday drone show wrapped as a Kiss reveal. Featured at
-- the top of the Birthday occasion picker so it's the first thing a
-- sender sees.

INSERT OR REPLACE INTO templates (
  id, component_key, name, description, emoji,
  thumbnail_bg, accent_color, premium, coins, author,
  fields_schema, effects, active
) VALUES (
  'bday-journey',
  'bday-journey',
  'Birthday Journey',
  'A cinematic drone-show journey (heart → bicycle → motorbike → car → cake → HAPPY BIRTHDAY) ending in a personal message. From Gao Gifts Time-Sealed.',
  '✨',
  'linear-gradient(135deg, #fef3c7, #f97316, #dc2626)',
  '#f97316',
  0,
  0,
  'gao',
  json('[
    {"key":"name",  "type":"text",  "label":"Their name",              "placeholder":"e.g. Linh", "maxLength":40},
    {"key":"photo", "type":"image", "label":"A photo of them (optional)", "hint":"Shown in the drone-show photo stage"}
  ]'),
  NULL,
  1
);

-- Link it to Birthday as the FEATURED template, sort_order 0 so it
-- appears first in the picker.
INSERT OR REPLACE INTO template_occasions (template_id, occasion_id, sort_order, featured)
VALUES ('bday-journey', 'birthday', 0, 1);

-- Push the other 4 birthday templates down a slot so the journey wins the top.
UPDATE template_occasions SET featured = 0
WHERE occasion_id = 'birthday' AND template_id != 'bday-journey';
