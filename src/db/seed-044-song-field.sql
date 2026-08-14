-- Seed 044: add "song" field (audio-url) to every scaffold template so
-- senders can optionally attach a music link (YouTube / Spotify /
-- SoundCloud / direct MP3). The AudioPlayer in PlaceholderReveal picks
-- this up automatically via songKey='song'.
--
-- Custom-designed templates (rose-rain, val-heart-blast, xmas-snow,
-- bday-party, bday-journey) already have their own field schemas — we
-- extend those too so music works everywhere.
--
-- Standard schema: name (text) + photo (image) + song (audio-url).

UPDATE templates
SET fields_schema = json('[
  {"key":"name",  "type":"text",       "label":"Their name (optional)", "placeholder":"e.g. Linh", "maxLength":40},
  {"key":"photo", "type":"image",      "label":"A photo of them (optional)", "hint":"Shown as a polaroid in the reveal"},
  {"key":"song",  "type":"audio-url",  "label":"A song for them (optional)", "hint":"YouTube / Spotify / SoundCloud / direct MP3 link"}
]')
WHERE id IN (
  'daily-goodnight', 'daily-goodmorning', 'daily-lunch', 'daily-coffee', 'daily-thinking',
  'rose-rain', 'val-heart-blast', 'val-love-letter', 'val-starry',
  'bday-party', 'bday-candles', 'bday-balloons', 'bday-cake', 'bday-journey',
  'xmas-snow', 'xmas-santa', 'xmas-fireplace',
  'sorry-white', 'sorry-note', 'sorry-origami',
  'prop-ring', 'prop-stars', 'prop-petals'
);
