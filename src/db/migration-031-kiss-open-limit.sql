-- Migration 031: 5-open limit for kisses (QR-code shareable gifts).
--
-- Each kiss now tracks how many times it has been opened and its cap.
-- When open_count reaches max_opens, further opens are rejected and the
-- recipient/scanner sees a "gift exhausted" message. Sender gets a
-- notification each time the gift is opened, plus one when it's used up.
ALTER TABLE kisses ADD COLUMN open_count INTEGER DEFAULT 0;
ALTER TABLE kisses ADD COLUMN max_opens  INTEGER DEFAULT 5;
