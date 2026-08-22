-- Migration 037: custom vanity link (slug) for kisses.
--
-- Senders can optionally set a custom slug (e.g. /kiss/anh-yeu-em) instead
-- of the default random ID link. NULL for kisses without a custom slug —
-- those keep sharing the plain /kiss/<id> link as before.
ALTER TABLE kisses ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_kisses_slug ON kisses(slug) WHERE slug IS NOT NULL;
