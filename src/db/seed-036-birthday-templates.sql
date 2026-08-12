-- Seed 036: convert the 3 legacy Birthday templates into fully
-- data-driven templates (effects[] + fields_schema[] JSON).
--
-- Proves the DataDrivenReveal engine end-to-end:
--   • bday-party   → confetti + balloons + text flash
--   • bday-candles → dark gradient + candle emoji rain + wish fade-in
--   • bday-cake    → cake emoji burst + polaroid photo message

-- ─── Party Popper 🎉 ────────────────────────────────────────────────────
UPDATE templates
SET
  fields_schema = json('[
    {"key":"name",  "type":"text",   "label":"Their name",   "required":true, "placeholder":"e.g. Linh",     "maxLength":40},
    {"key":"age",   "type":"number", "label":"Age (optional)", "min":1, "max":120,  "placeholder":"25"}
  ]'),
  effects = json('[
    {"type":"bg-gradient",    "from":"#fef3c7", "to":"#f97316", "angle":135},
    {"type":"particle-rain",  "emoji":"🎉",     "count":180,    "speed":"fast"},
    {"type":"balloon-float",  "count":16,       "colors":["#f43f5e","#facc15","#38bdf8","#a855f7","#22c55e"]},
    {"type":"text-flash",     "text":"Happy Birthday {name}!", "color":"#fff", "size":52, "at":1800},
    {"type":"confetti-burst", "count":140, "at":2600, "duration":2200}
  ]')
WHERE id = 'bday-party';

-- ─── Elegant Candles 🕯️ ─────────────────────────────────────────────────
UPDATE templates
SET
  fields_schema = json('[
    {"key":"name",   "type":"text",     "label":"Their name",  "required":true, "maxLength":40},
    {"key":"age",    "type":"number",   "label":"How many candles?", "min":1, "max":120, "default":21, "hint":"Used to render one candle per year"},
    {"key":"wish",   "type":"textarea", "label":"The wish",    "maxLength":200, "placeholder":"May this year bring..."}
  ]'),
  effects = json('[
    {"type":"bg-gradient",   "from":"#1e1b4b", "to":"#000",     "angle":180},
    {"type":"particle-rain", "emoji":"🕯️",    "count":30,      "speed":"slow", "size":36},
    {"type":"text-flash",    "text":"For {name}", "color":"#fbbf24", "size":36, "at":1500, "duration":3500},
    {"type":"text-fade",     "text":"{wish}", "color":"#fef3c7", "size":22, "italic":true, "at":4500}
  ]')
WHERE id = 'bday-candles';

-- ─── Cake Reveal 🎂 ─────────────────────────────────────────────────────
UPDATE templates
SET
  fields_schema = json('[
    {"key":"name",   "type":"text",   "label":"Their name",  "required":true, "maxLength":40},
    {"key":"flavor", "type":"select", "label":"Cake flavor", "default":"chocolate", "options":[
      {"value":"chocolate",  "label":"Chocolate 🍫"},
      {"value":"strawberry", "label":"Strawberry 🍓"},
      {"value":"vanilla",    "label":"Vanilla 🍦"},
      {"value":"matcha",     "label":"Matcha 🍵"}
    ]},
    {"key":"accent", "type":"color",  "label":"Accent color", "default":"#db2777"}
  ]'),
  effects = json('[
    {"type":"bg-gradient",    "from":"{accent}", "to":"#1a0a10", "angle":160},
    {"type":"particle-rain",  "emoji":"🎂",      "count":50,      "speed":"slow", "size":34},
    {"type":"text-flash",     "text":"🎂 {name}", "color":"#fff", "size":56, "at":1500},
    {"type":"text-fade",      "text":"Blow out the candles",  "color":"#fef3c7", "size":18, "italic":true, "at":3500},
    {"type":"confetti-burst", "count":120, "at":4500, "duration":2000}
  ]')
WHERE id = 'bday-cake';
