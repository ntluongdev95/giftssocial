-- ============================================================================
-- Migration 022 — Streak health insights (AI-generated, cached)
-- ============================================================================
-- For each streak we generate two short paragraphs once:
--
--   • insights_benefits — what the user gains from maintaining this habit
--   • insights_risks    — what happens when they regularly miss it
--
-- Both come from a single Anthropic call triggered lazily (first time the
-- detail page mounts and the fields are NULL). Cached forever afterwards
-- since insights for a given habit are stable. The user can hit a
-- "regenerate" affordance if the habit changes meaning.
--
-- insights_generated_at lets us show "Generated X days ago" if useful and
-- supports a future TTL-based refresh policy.
--
-- Apply on dev:
--   wrangler d1 execute gao-social-dev --remote \
--     --file=src/db/migration-022-streak-insights.sql
-- ============================================================================

ALTER TABLE streaks ADD COLUMN insights_benefits      TEXT;
ALTER TABLE streaks ADD COLUMN insights_risks         TEXT;
ALTER TABLE streaks ADD COLUMN insights_generated_at  TEXT;
