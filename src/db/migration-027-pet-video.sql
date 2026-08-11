-- ============================================================================
-- Migration 027 — Live pet video (AI img-to-video)
-- ============================================================================
-- Stores the result of an img-to-video pass over the breed photo. The
-- generated MP4 loops in the pet stage so the real dog actually moves
-- (wags tail, looks around, blinks) — no more static image.
--
--   • bond_breed_video_url     — final MP4 URL (Replicate CDN) once ready
--   • bond_breed_video_status  — 'pending' | 'generating' | 'ready' | 'failed'
--   • bond_breed_video_at      — last status update timestamp (ISO)
--
-- Generation is per-streak so each couple can have their own clip even
-- when sharing a breed (different starting photo).
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --local \
--     --file=src/db/migration-027-pet-video.sql
-- ============================================================================

ALTER TABLE streaks ADD COLUMN bond_breed_video_url    TEXT;
ALTER TABLE streaks ADD COLUMN bond_breed_video_status TEXT;
ALTER TABLE streaks ADD COLUMN bond_breed_video_at     TEXT;
