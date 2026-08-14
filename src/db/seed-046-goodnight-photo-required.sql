-- seed-046-goodnight-photo-required.sql
-- Mark the photo field REQUIRED on the daily-goodnight template.
-- The particle-heart reveal now places the recipient's photo inside a
-- heart-shaped clip at the centre of the swarm, so a photo is essential
-- to the experience.
--
-- Also refreshes the fields_schema to only the fields this template
-- uses (name, song, photo) — no other stray fields carried over from
-- the shared daily bulk seed.

UPDATE reveal_template
SET fields_schema = json('[
  {"key":"name",     "type":"text",       "label":"Recipient name",       "hint":"Written in cursive under the heart",                    "required":true},
  {"key":"song",     "type":"audio-url",  "label":"Lullaby / love song",  "hint":"Optional YouTube link, loops during the reveal"},
  {"key":"photo",    "type":"image",      "label":"A photo of them",      "hint":"Shown inside the heart at the centre of the sky",       "required":true}
]')
WHERE id = 'daily-goodnight';
