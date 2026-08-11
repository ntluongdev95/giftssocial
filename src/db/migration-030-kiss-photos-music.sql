-- Migration 030: photos + music support for kisses
-- Sender attaches up to 3 photos and 1 music track when sending a gift.
-- Receiver sees photos + hears music when opening.
ALTER TABLE kisses ADD COLUMN photos      TEXT DEFAULT '[]';    -- JSON array of R2 URLs
ALTER TABLE kisses ADD COLUMN music_url   TEXT DEFAULT NULL;    -- audio URL
ALTER TABLE kisses ADD COLUMN music_title TEXT DEFAULT NULL;    -- track name for display
