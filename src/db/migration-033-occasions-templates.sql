-- Migration 033: occasions + templates + template_occasions
--
-- Moves the occasion catalogue (currently hardcoded in
-- src/lib/occasions.ts) into the database so:
--   • non-developers can add/edit occasions + templates
--   • templates can be versioned, activated/deactivated, sorted
--   • analytics (usage counts) can be tracked
--   • community-contributed templates are possible
--
-- React components stay in src/components/reveals/[id]/ and are looked
-- up via templates.component_key from src/components/reveals/_registry.ts.
-- Adding a new template = one DB row + one .tsx file.

-- ─── occasions ──────────────────────────────────────────────────────────
CREATE TABLE occasions (
  id              TEXT PRIMARY KEY,       -- slug: 'valentine', 'birthday', ...
  name            TEXT NOT NULL,          -- English display name
  name_vi         TEXT,                   -- Vietnamese display name (optional)
  emoji           TEXT NOT NULL,
  theme_color     TEXT NOT NULL,          -- hex: '#ec4899'
  bg_gradient     TEXT,                   -- CSS gradient string
  description     TEXT,
  description_vi  TEXT,
  date_month      INTEGER,                -- 1-12, NULL for evergreen
  date_day        INTEGER,                -- 1-31, NULL for evergreen
  is_lunar        INTEGER DEFAULT 0,      -- 0/1 boolean
  evergreen       INTEGER DEFAULT 0,      -- 0/1 boolean
  window_days     INTEGER DEFAULT 14,     -- days before/after to consider "hot"
  sort_order      INTEGER DEFAULT 0,      -- display order in picker
  active          INTEGER DEFAULT 1,      -- soft delete
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_occasions_active ON occasions(active, sort_order);

-- ─── templates ──────────────────────────────────────────────────────────
CREATE TABLE templates (
  id              TEXT PRIMARY KEY,       -- slug: 'rose-rain', 'santa-delivery', ...
  component_key   TEXT NOT NULL,          -- registry lookup key (usually = id, but many templates can share a component)
  name            TEXT NOT NULL,
  name_vi         TEXT,
  description     TEXT,
  description_vi  TEXT,
  emoji           TEXT NOT NULL,          -- hero emoji on thumbnail
  thumbnail_bg    TEXT,                   -- CSS gradient for placeholder thumbnail
  thumbnail_url   TEXT,                   -- optional real image thumbnail
  preview_video   TEXT,                   -- mp4/webm URL for preview modal
  accent_color    TEXT,                   -- template's brand color
  config          TEXT,                   -- JSON config passed to the component (per-template overrides)
  premium         INTEGER DEFAULT 0,      -- 0/1 boolean
  coins           INTEGER DEFAULT 0,      -- unlock cost if premium
  version         INTEGER DEFAULT 1,
  author          TEXT DEFAULT 'gao',     -- 'gao' | 'community' | user_id
  uses_count      INTEGER DEFAULT 0,      -- lifetime usage counter (analytics)
  active          INTEGER DEFAULT 1,      -- soft delete
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_templates_active ON templates(active);
CREATE INDEX idx_templates_component ON templates(component_key);

-- ─── template_occasions (many-to-many) ──────────────────────────────────
-- One template can appear under multiple occasions. Order + featured
-- flag are per-occasion so the same template can be top-billed for
-- Valentine but a fallback for Anniversary.
CREATE TABLE template_occasions (
  template_id     TEXT NOT NULL,
  occasion_id     TEXT NOT NULL,
  sort_order      INTEGER DEFAULT 0,      -- template order within this occasion
  featured        INTEGER DEFAULT 0,      -- highlight in the picker
  PRIMARY KEY (template_id, occasion_id),
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  FOREIGN KEY (occasion_id) REFERENCES occasions(id) ON DELETE CASCADE
);
CREATE INDEX idx_template_occasions_by_occasion ON template_occasions(occasion_id, sort_order);
