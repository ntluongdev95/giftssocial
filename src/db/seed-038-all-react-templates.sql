-- Seed 038: point EVERY seeded template at its registered React
-- component (component_key = id) and clear the effects[] JSON so the
-- dispatcher hits tier-1 (registry lookup) cleanly.
--
-- After this: every template in the DB renders via its own React file
-- under src/components/reveals/[id]/. Templates using the placeholder
-- scaffold still work — you customize them later by rewriting index.tsx.

UPDATE templates SET component_key = id, effects = NULL
WHERE id IN (
  'rose-rain',
  'val-heart-blast',
  'val-love-letter',
  'val-starry',
  'bday-party',
  'bday-candles',
  'bday-balloons',
  'bday-cake',
  'xmas-snow',
  'xmas-santa',
  'xmas-fireplace',
  'sorry-white',
  'sorry-note',
  'sorry-origami',
  'prop-ring',
  'prop-stars',
  'prop-petals'
);
