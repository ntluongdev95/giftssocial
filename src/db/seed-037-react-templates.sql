-- Seed 037: point the 3 newly-coded React templates at their component
-- so the reveal dispatcher tier-1 (registry lookup) picks them up
-- instead of the data-driven engine.
--
-- Also clear their effects[] JSON so the templates don't accidentally
-- fall through to tier-2 if the registry lookup misses.

UPDATE templates
SET component_key = 'val-heart-blast',
    effects       = NULL
WHERE id = 'val-heart-blast';

UPDATE templates
SET component_key = 'xmas-snow',
    effects       = NULL
WHERE id = 'xmas-snow';

UPDATE templates
SET component_key = 'bday-party',
    effects       = NULL
WHERE id = 'bday-party';
