-- Seed 061: standardize every template's photo field to a 2-photo
-- free cap, matching the pattern already established by xmas-santa /
-- xmas-snow / prop-ring (seed-058/059) — upgrade single "photo" to
-- "photos" (image-array, maxItems:2), with an upsell hint for more.
--
-- Audited via `SELECT id, fields_schema FROM templates` against the
-- local D1 before writing this — every template below currently has
-- either the seed-039 baseline single "photo" field, or an existing
-- "photos" array capped below 2. xmas-santa, prop-ring and
-- daily-goodnight-2 are already at maxItems:2 and are left untouched.
--
-- IMPORTANT: this only changes the field SCHEMA (what the sender sees
-- in the upload form) and the label text. There is no coin/paywall
-- enforcement wired up anywhere — nothing currently stops a sender
-- from uploading more than 2 photos via a raw API call, and no
-- purchase flow exists yet to unlock more. The "mua mở rộng để thêm
-- ảnh" hint is copy only, same caveat as every prior seed that used it.

-- ─── Group A: name + photo + song → name + photos(2) + song ──────────
-- (bday-*, daily-* minus goodnight-2/sorry, prop-petals/stars,
--  rose-rain, sorry-*, val-*, xmas-fireplace)
UPDATE templates
SET fields_schema = json('[
  {"key":"name",   "type":"text",        "label":"Their name (optional)", "placeholder":"e.g. Linh", "maxLength":40},
  {"key":"photos", "type":"image-array", "label":"Photos (optional)", "hint":"Shown as a polaroid in the reveal — mua mở rộng để thêm ảnh", "maxItems":2},
  {"key":"song",   "type":"audio-url",   "label":"A song for them (optional)", "hint":"YouTube / Spotify / SoundCloud / direct MP3 link"}
]')
WHERE id IN (
  'bday-balloons', 'bday-cake', 'bday-candles', 'bday-journey', 'bday-party',
  'daily-coffee', 'daily-goodmorning', 'daily-goodnight', 'daily-lunch', 'daily-thinking',
  'prop-petals', 'prop-stars',
  'rose-rain',
  'sorry-note', 'sorry-origami', 'sorry-white',
  'val-heart-blast', 'val-love-letter', 'val-starry',
  'xmas-fireplace'
);

-- ─── Group B: name + photo only → name + photos(2) ────────────────────
-- (the 3 new New Year templates from seed-060)
UPDATE templates
SET fields_schema = json('[
  {"key":"name",   "type":"text",        "label":"Their name (optional)", "placeholder":"e.g. Linh", "maxLength":40},
  {"key":"photos", "type":"image-array", "label":"Photos (optional)", "hint":"Shown as a polaroid in the reveal — mua mở rộng để thêm ảnh", "maxItems":2}
]')
WHERE id IN ('newyear-countdown', 'tet-firecracker', 'tet-mai-dao');

-- ─── daily-sorry: name(required) + song + photo → …+ photos(2) ────────
-- Field order/other fields preserved, only the photo field changes.
UPDATE templates
SET fields_schema = json('[
  {"key":"name",   "type":"text",        "label":"Their name", "hint":"Written under the hug", "required":true, "maxLength":40},
  {"key":"song",   "type":"audio-url",   "label":"Song (optional)", "hint":"YouTube / Spotify / TikTok link"},
  {"key":"photos", "type":"image-array", "label":"Photos (optional)", "hint":"Small polaroid to the side — mua mở rộng để thêm ảnh", "maxItems":2}
]')
WHERE id = 'daily-sorry';

-- ─── xmas-snow: already "photos" but capped at 1 → bump to 2 ──────────
UPDATE templates
SET fields_schema = json('[
  {"key":"name",   "type":"text",        "label":"Their name (optional)", "placeholder":"e.g. Linh", "maxLength":40},
  {"key":"photos", "type":"image-array", "label":"Ảnh kỷ niệm (không bắt buộc)", "hint":"Đặt cạnh đèn lồng trong khung cảnh — mua mở rộng để thêm ảnh", "maxItems":2}
]')
WHERE id = 'xmas-snow';
