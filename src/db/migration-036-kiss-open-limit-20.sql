-- Migration 036: raise kiss open limit from 5 to 20.
--
-- SQLite/D1 can't ALTER COLUMN to change a DEFAULT, so the column default
-- stays 5 in the schema; new rows get max_opens set explicitly by the app
-- (kisses/route.ts fallback is now `?? 20`). This migration backfills
-- existing rows that were created under the old 5-open default.
UPDATE kisses SET max_opens = 20 WHERE max_opens = 5;
