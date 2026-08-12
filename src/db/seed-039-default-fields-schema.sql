-- Seed 039: give every React template a default fields_schema with:
--   • name  (text)   — the receiver's name (overrides display_name if filled)
--   • photo (image)  — an optional photo the sender uploads; the React
--                      component displays it as a polaroid hero
--
-- React components read these via kiss.template_data (see
-- src/components/reveals/_shared/useTemplateData.ts). Data-driven
-- templates read them via {placeholder} substitution.
--
-- Templates can add more fields later on their /admin/templates/[id]
-- page — this seed only sets the baseline.

UPDATE templates
SET fields_schema = json('[
  {"key":"name",  "type":"text",  "label":"Their name (optional)", "placeholder":"e.g. Linh", "maxLength":40},
  {"key":"photo", "type":"image", "label":"A photo of them (optional)", "hint":"Shown as a polaroid in the reveal"}
]')
WHERE id IN (
  'rose-rain', 'val-heart-blast', 'val-love-letter', 'val-starry',
  'bday-party', 'bday-candles', 'bday-balloons', 'bday-cake',
  'xmas-snow', 'xmas-santa', 'xmas-fireplace',
  'sorry-white', 'sorry-note', 'sorry-origami',
  'prop-ring', 'prop-stars', 'prop-petals'
);
