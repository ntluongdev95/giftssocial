-- ============================================================================
-- Gao Social V3 — D1 (SQLite) Schema
-- Converted from PostgreSQL migration-001 + migration-002
-- Target: Cloudflare D1 database "gao-social-dev"
-- ============================================================================
-- Migration notes vs PostgreSQL original:
--   • TIMESTAMPTZ        → TEXT (ISO8601, sortable)
--   • DOUBLE PRECISION   → REAL
--   • NUMERIC(10,2)      → REAL
--   • SMALLINT           → INTEGER
--   • BOOLEAN            → INTEGER (0/1)
--   • TEXT[] / TEXT[]    → TEXT  (JSON-serialized arrays)
--   • JSONB              → TEXT  (JSON string)
--   • gen_random_uuid()  → lower(hex(randomblob(16)))
--   • NOW()              → datetime('now')
--   • GIN indexes        → removed (no full-text index in D1)
--   • Stored procedures  → removed (moved to application logic)
--   • REFERENCES + CASCADE kept (requires PRAGMA foreign_keys = ON per connection)
-- ============================================================================

-- NOTE: PRAGMA foreign_keys = ON must be set per-connection in app code (src/lib/db.ts)
-- D1 manages WAL internally — no journal_mode pragma needed.

-- ============================================================================
-- 1. BUSINESSES (pre-existing table, created fresh for D1)
-- ============================================================================

CREATE TABLE IF NOT EXISTS businesses (
  id                TEXT PRIMARY KEY,
  owner_user_id     TEXT NOT NULL,
  -- NOTE: migration-001 dropped UNIQUE on owner_user_id to allow multiple
  -- businesses per user. Phase 2: update POST route ON CONFLICT logic.
  name              TEXT NOT NULL,
  category          TEXT DEFAULT 'general',
  description       TEXT DEFAULT '',
  location_lat      REAL,
  location_lng      REAL,
  address           TEXT DEFAULT '',
  city              TEXT DEFAULT '',
  phone             TEXT,
  website           TEXT,
  hours             TEXT DEFAULT '{}',       -- JSON object keyed by day
  booking_enabled   INTEGER DEFAULT 0,       -- BOOLEAN
  payment_enabled   INTEGER DEFAULT 0,       -- BOOLEAN
  cover_image       TEXT,
  images            TEXT DEFAULT '[]',       -- JSON array of URLs
  services          TEXT DEFAULT '[]',       -- JSON array of {name, price, duration}
  social_links      TEXT DEFAULT '[]',       -- JSON array of {platform, url}
  subcategories     TEXT DEFAULT '[]',       -- JSON array of strings
  trust_score       INTEGER DEFAULT 0,
  trust_level       TEXT DEFAULT 'new'
                    CHECK (trust_level IN ('new', 'verified', 'trusted', 'highly_trusted')),
  badges            TEXT DEFAULT '[]',       -- JSON array
  proof_count       INTEGER DEFAULT 0,
  rating_avg        REAL DEFAULT 0,
  rating_count      INTEGER DEFAULT 0,
  status            TEXT DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'suspended', 'deleted')),
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_biz_owner ON businesses(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_biz_category ON businesses(category, status);
CREATE INDEX IF NOT EXISTS idx_biz_trust ON businesses(trust_score DESC);
CREATE INDEX IF NOT EXISTS idx_biz_location ON businesses(location_lat, location_lng);
CREATE INDEX IF NOT EXISTS idx_biz_status ON businesses(status);

-- ============================================================================
-- 2. EVENTS (pre-existing table, created fresh for D1)
--    Includes columns added by migration-001
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  id                TEXT PRIMARY KEY,
  host_user_id      TEXT,
  host_type         TEXT DEFAULT 'user'
                    CHECK (host_type IN ('user', 'business', 'circle')),
  host_id           TEXT,
  title             TEXT NOT NULL,
  description       TEXT DEFAULT '',
  category          TEXT DEFAULT 'general',
  location_lat      REAL,
  location_lng      REAL,
  location_name     TEXT DEFAULT '',
  city              TEXT DEFAULT '',
  start_time        TEXT NOT NULL,
  end_time          TEXT,
  capacity          INTEGER,
  joined_count      INTEGER DEFAULT 0,
  checkin_count     INTEGER DEFAULT 0,
  -- Visibility updated by migration-001 to include 'circle'
  visibility        TEXT DEFAULT 'public'
                    CHECK (visibility IN ('public', 'circle', 'private')),
  verified          INTEGER DEFAULT 0,       -- BOOLEAN
  status            TEXT DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled', 'live', 'ended', 'canceled')),
  -- Added by migration-001
  circle_id         TEXT,
  ticket_price      REAL,
  ticket_currency   TEXT DEFAULT 'USD',
  rsvp_mode         TEXT DEFAULT 'open'
                    CHECK (rsvp_mode IN ('open', 'request', 'ticket')),
  qr_checkin_enabled INTEGER DEFAULT 0,      -- BOOLEAN
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_evt_status ON events(status, start_time);
CREATE INDEX IF NOT EXISTS idx_evt_location ON events(location_lat, location_lng);
CREATE INDEX IF NOT EXISTS idx_evt_host ON events(host_user_id);
CREATE INDEX IF NOT EXISTS idx_evt_circle ON events(circle_id) WHERE circle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evt_category ON events(category, status);

-- ============================================================================
-- 3. USERS — local cache of external passkey auth identity
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,          -- external user_id from passkey (NOT generated)
  username          TEXT,
  display_name      TEXT,
  email             TEXT,
  phone             TEXT,
  avatar_url        TEXT,
  bio               TEXT DEFAULT '',
  gao_domain        TEXT,                      -- e.g. luong.gao

  -- Location
  location_lat      REAL,
  location_lng      REAL,
  city              TEXT DEFAULT '',

  -- Trust
  trust_score       INTEGER DEFAULT 0,
  trust_level       TEXT DEFAULT 'new'
                    CHECK (trust_level IN ('new', 'verified', 'trusted', 'highly_trusted')),
  badges            TEXT DEFAULT '[]',         -- JSON array

  -- Denormalized stats
  proofs_count      INTEGER DEFAULT 0,
  bookings_count    INTEGER DEFAULT 0,
  reviews_count     INTEGER DEFAULT 0,
  circles_count     INTEGER DEFAULT 0,
  followers_count   INTEGER DEFAULT 0,
  following_count   INTEGER DEFAULT 0,

  -- Settings
  profile_visibility TEXT DEFAULT 'public'
                    CHECK (profile_visibility IN ('public', 'circles', 'private')),
  location_sharing  TEXT DEFAULT 'approximate'
                    CHECK (location_sharing IN ('exact', 'approximate', 'friends', 'circles', 'off')),
  location_shared_until TEXT,  -- ISO datetime; NULL = indefinite

  -- Wallet
  gao_points        INTEGER DEFAULT 0,

  -- Meta
  role              TEXT DEFAULT 'user'
                    CHECK (role IN ('user', 'admin', 'moderator')),
  status            TEXT DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'deleted')),
  last_seen_at      TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_gao_domain ON users(gao_domain) WHERE gao_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_trust ON users(trust_score DESC);
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location_lat, location_lng) WHERE location_lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ============================================================================
-- 4. SESSIONS — auth token revocation & device management
-- ============================================================================

CREATE TABLE IF NOT EXISTS sessions (
  id                TEXT PRIMARY KEY,
  -- Format: 'sess_' + hex(randomblob(16)) — generate in app code
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,            -- SHA-256 hash only (never raw token)
  device_info       TEXT,
  ip_address        TEXT,
  is_revoked        INTEGER NOT NULL DEFAULT 0, -- BOOLEAN
  last_active_at    TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at        TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_hash ON sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at) WHERE NOT is_revoked;

-- ============================================================================
-- 5. SIGNALS — core content (presence/intent/offer/event/update/proof)
-- ============================================================================

CREATE TABLE IF NOT EXISTS signals (
  id                TEXT PRIMARY KEY,
  -- Format: 'sig_' + lower(hex(randomblob(16))) — generate in app code
  author_id         TEXT NOT NULL,
  type              TEXT NOT NULL
                    CHECK (type IN ('presence', 'intent', 'offer', 'event', 'update', 'proof')),
  title             TEXT NOT NULL,
  description       TEXT DEFAULT '',
  category          TEXT DEFAULT 'general',

  -- Location
  location_lat      REAL NOT NULL,
  location_lng      REAL NOT NULL,
  radius            INTEGER DEFAULT 300,

  -- Visibility
  visibility        TEXT DEFAULT 'public'
                    CHECK (visibility IN ('public', 'circle', 'private', 'trusted_only')),
  target_circle_id  TEXT,
  target_business_id TEXT,

  -- Trust snapshot
  trust_score_snapshot INTEGER DEFAULT 0,
  verified          INTEGER DEFAULT 0,         -- BOOLEAN

  -- Timing
  starts_at         TEXT DEFAULT (datetime('now')),
  expires_at        TEXT NOT NULL,

  -- Engagement stats
  views_count       INTEGER DEFAULT 0,
  responses_count   INTEGER DEFAULT 0,
  saves_count       INTEGER DEFAULT 0,

  -- Flexible metadata per type (JSON string)
  -- presence: { note, mood }
  -- intent: { budget_min, budget_max, urgency }
  -- offer: { price, discount_percent, original_price, redeem_code }
  -- event: { venue, capacity, ticket_price }
  -- update: { media_urls }
  -- proof: { proof_type, evidence_url, target_entity_type, target_entity_id }
  metadata          TEXT DEFAULT '{}',

  status            TEXT DEFAULT 'active'
                    CHECK (status IN ('active', 'expired', 'hidden', 'suppressed', 'matched')),
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_signals_author ON signals(author_id);
CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(type, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_signals_location ON signals(location_lat, location_lng);
CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_signals_circle ON signals(target_circle_id) WHERE target_circle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_signals_business ON signals(target_business_id) WHERE target_business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_signals_category ON signals(category, status);
CREATE INDEX IF NOT EXISTS idx_signals_created ON signals(created_at DESC);

-- ============================================================================
-- 6. CIRCLES — community groups
-- ============================================================================

CREATE TABLE IF NOT EXISTS circles (
  id                TEXT PRIMARY KEY,
  -- Format: 'cir_' + lower(hex(randomblob(16))) — generate in app code
  owner_id          TEXT NOT NULL,
  name              TEXT NOT NULL,
  slug              TEXT UNIQUE,
  category          TEXT DEFAULT 'general',
  description       TEXT DEFAULT '',
  cover_image       TEXT,
  rules             TEXT DEFAULT '',

  -- Location scope
  city              TEXT DEFAULT '',
  location_lat      REAL,
  location_lng      REAL,

  -- Settings
  visibility        TEXT DEFAULT 'public'
                    CHECK (visibility IN ('public', 'private', 'invite_only')),
  join_mode         TEXT DEFAULT 'open'
                    CHECK (join_mode IN ('open', 'request', 'invite_only')),
  post_permission   TEXT DEFAULT 'members'
                    CHECK (post_permission IN ('anyone', 'members', 'admins')),

  -- Trust
  trust_score       INTEGER DEFAULT 0,
  trust_level       TEXT DEFAULT 'new'
                    CHECK (trust_level IN ('new', 'verified', 'trusted', 'highly_trusted')),
  badges            TEXT DEFAULT '[]',         -- JSON array
  verification_level INTEGER DEFAULT 0,
  min_trust_to_join INTEGER DEFAULT 0,

  -- Denormalized stats
  member_count      INTEGER DEFAULT 0,
  event_count       INTEGER DEFAULT 0,
  signal_count      INTEGER DEFAULT 0,
  posts_today       INTEGER DEFAULT 0,

  status            TEXT DEFAULT 'active'
                    CHECK (status IN ('active', 'hidden', 'suspended', 'archived')),
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_circles_owner ON circles(owner_id);
CREATE INDEX IF NOT EXISTS idx_circles_slug ON circles(slug);
CREATE INDEX IF NOT EXISTS idx_circles_category ON circles(category, status);
CREATE INDEX IF NOT EXISTS idx_circles_trust ON circles(trust_score DESC);
CREATE INDEX IF NOT EXISTS idx_circles_location ON circles(location_lat, location_lng) WHERE location_lat IS NOT NULL;
-- NOTE: GIN text-search index idx_circles_name removed (no GIN in SQLite).
-- Phase 2: use LIKE '%query%' or FTS5 virtual table for circle name search.

-- ============================================================================
-- 7. CIRCLE_MEMBERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS circle_members (
  id                TEXT PRIMARY KEY,
  -- Format: 'cm_' + lower(hex(randomblob(16))) — generate in app code
  circle_id         TEXT NOT NULL,
  user_id           TEXT NOT NULL,
  role              TEXT DEFAULT 'member'
                    CHECK (role IN ('member', 'moderator', 'admin', 'owner')),
  status            TEXT DEFAULT 'active'
                    CHECK (status IN ('active', 'pending', 'banned', 'left')),
  joined_at         TEXT DEFAULT (datetime('now')),
  UNIQUE (circle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cm_circle ON circle_members(circle_id, status);
CREATE INDEX IF NOT EXISTS idx_cm_user ON circle_members(user_id, status);

-- ============================================================================
-- 8. BOOKINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS bookings (
  id                TEXT PRIMARY KEY,
  -- Format: 'bk_' + lower(hex(randomblob(16))) — generate in app code
  user_id           TEXT NOT NULL,
  business_id       TEXT,
  event_id          TEXT,
  service_name      TEXT,
  slot_time         TEXT,
  party_size        INTEGER DEFAULT 1,
  notes             TEXT DEFAULT '',
  amount            REAL DEFAULT 0,
  currency          TEXT DEFAULT 'USD',
  status            TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'completed', 'canceled', 'no_show')),
  checkin_at        TEXT,
  checkin_verified  INTEGER DEFAULT 0,         -- BOOLEAN
  proof_id          TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_business ON bookings(business_id, status) WHERE business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_event ON bookings(event_id, status) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_time) WHERE status IN ('pending', 'confirmed');

-- Event-scoped location visibility grants.
-- User opts in to share their location with co-attendees of a specific event.
-- Grant expires at event end_time; expired rows can be swept lazily.
CREATE TABLE IF NOT EXISTS event_location_grants (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  event_id          TEXT NOT NULL,
  expires_at        TEXT NOT NULL,
  created_at        TEXT DEFAULT (datetime('now')),
  UNIQUE (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_loc_user ON event_location_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_event_loc_event ON event_location_grants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_loc_expires ON event_location_grants(expires_at);

-- ============================================================================
-- 9. REVIEWS
-- ============================================================================

CREATE TABLE IF NOT EXISTS reviews (
  id                TEXT PRIMARY KEY,
  -- Format: 'rev_' + lower(hex(randomblob(16))) — generate in app code
  author_id         TEXT NOT NULL,
  business_id       TEXT,
  event_id          TEXT,
  rating            INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title             TEXT DEFAULT '',
  body              TEXT DEFAULT '',
  photos            TEXT DEFAULT '[]',         -- JSON array of URLs
  booking_id        TEXT,
  verified_visit    INTEGER DEFAULT 0,         -- BOOLEAN
  author_trust_score INTEGER DEFAULT 0,
  helpful_count     INTEGER DEFAULT 0,
  status            TEXT DEFAULT 'active'
                    CHECK (status IN ('active', 'hidden', 'flagged', 'removed')),
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_author ON reviews(author_id);
CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews(business_id, status) WHERE business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_event ON reviews(event_id, status) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

-- ============================================================================
-- 10. PROOFS — verifiable evidence of real-world action
-- ============================================================================

CREATE TABLE IF NOT EXISTS proofs (
  id                TEXT PRIMARY KEY,
  -- Format: 'prf_' + lower(hex(randomblob(16))) — generate in app code
  user_id           TEXT NOT NULL,
  proof_type        TEXT NOT NULL
                    CHECK (proof_type IN (
                      'event_attended', 'booking_completed', 'review_submitted',
                      'checkin_verified', 'business_visited', 'circle_contributed',
                      'identity_verified', 'skill_verified'
                    )),
  target_type       TEXT
                    CHECK (target_type IN ('business', 'event', 'circle', 'user')),
  target_id         TEXT,
  evidence_type     TEXT DEFAULT 'system'
                    CHECK (evidence_type IN ('system', 'photo', 'receipt', 'qr', 'manual')),
  evidence_url      TEXT,
  evidence_note     TEXT DEFAULT '',
  trust_impact      TEXT DEFAULT 'positive'
                    CHECK (trust_impact IN ('positive', 'neutral', 'negative')),
  trust_points      INTEGER DEFAULT 1,
  booking_id        TEXT,
  review_id         TEXT,
  signal_id         TEXT,
  verified          INTEGER DEFAULT 0,         -- BOOLEAN
  status            TEXT DEFAULT 'active'
                    CHECK (status IN ('active', 'revoked', 'expired')),
  created_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_proofs_user ON proofs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_proofs_type ON proofs(proof_type);
CREATE INDEX IF NOT EXISTS idx_proofs_target ON proofs(target_type, target_id) WHERE target_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proofs_created ON proofs(created_at DESC);

-- ============================================================================
-- 11. CHECKINS
-- ============================================================================

CREATE TABLE IF NOT EXISTS checkins (
  id                TEXT PRIMARY KEY,
  -- Format: 'ck_' + lower(hex(randomblob(16))) — generate in app code
  user_id           TEXT NOT NULL,
  target_type       TEXT NOT NULL
                    CHECK (target_type IN ('business', 'event', 'circle', 'location')),
  target_id         TEXT,
  location_lat      REAL NOT NULL,
  location_lng      REAL NOT NULL,
  method            TEXT DEFAULT 'location'
                    CHECK (method IN ('qr', 'nfc', 'location', 'manual')),
  booking_id        TEXT,
  proof_id          TEXT,
  verified          INTEGER DEFAULT 0,         -- BOOLEAN
  created_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_checkins_user ON checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_target ON checkins(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_checkins_created ON checkins(created_at DESC);

-- ============================================================================
-- 12. FOLLOWS — social graph
-- ============================================================================

CREATE TABLE IF NOT EXISTS follows (
  id                TEXT PRIMARY KEY,
  -- Format: 'fol_' + lower(hex(randomblob(16))) — generate in app code
  follower_id       TEXT NOT NULL,
  following_user_id     TEXT,
  following_business_id TEXT,
  following_circle_id   TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  -- NOTE: SQLite treats NULL as distinct in UNIQUE constraints,
  -- matching PostgreSQL behavior for optional columns.
  UNIQUE (follower_id, following_user_id),
  UNIQUE (follower_id, following_business_id),
  UNIQUE (follower_id, following_circle_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_user ON follows(following_user_id) WHERE following_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_follows_business ON follows(following_business_id) WHERE following_business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_follows_circle ON follows(following_circle_id) WHERE following_circle_id IS NOT NULL;

-- ============================================================================
-- 13. SAVED_ITEMS — bookmarks
-- ============================================================================

CREATE TABLE IF NOT EXISTS saved_items (
  id                TEXT PRIMARY KEY,
  -- Format: 'sav_' + lower(hex(randomblob(16))) — generate in app code
  user_id           TEXT NOT NULL,
  item_type         TEXT NOT NULL
                    CHECK (item_type IN ('business', 'event', 'signal', 'circle', 'profile')),
  item_id           TEXT NOT NULL,
  collection        TEXT DEFAULT 'default',
  created_at        TEXT DEFAULT (datetime('now')),
  UNIQUE (user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_items(user_id, item_type);
CREATE INDEX IF NOT EXISTS idx_saved_item ON saved_items(item_type, item_id);

-- ============================================================================
-- 14. NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id                TEXT PRIMARY KEY,
  -- Format: 'ntf_' + lower(hex(randomblob(16))) — generate in app code
  user_id           TEXT NOT NULL,
  type              TEXT NOT NULL
                    CHECK (type IN (
                      'booking_confirmed', 'booking_reminder', 'booking_canceled',
                      'event_reminder', 'event_starting',
                      'signal_response', 'signal_matched',
                      'circle_invite', 'circle_activity', 'circle_join_request',
                      'proof_earned', 'trust_upgraded',
                      'review_received', 'follow_new', 'new_message',
                      'system'
                    )),
  title             TEXT NOT NULL,
  body              TEXT DEFAULT '',
  ref_type          TEXT,
  ref_id            TEXT,
  read              INTEGER DEFAULT 0,         -- BOOLEAN
  seen              INTEGER DEFAULT 0,         -- BOOLEAN
  created_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ntf_user ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ntf_type ON notifications(type);

-- ============================================================================
-- 15. WALLET_TRANSACTIONS — Gao Points
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                TEXT PRIMARY KEY,
  -- Format: 'wtx_' + lower(hex(randomblob(16))) — generate in app code
  user_id           TEXT NOT NULL,
  type              TEXT NOT NULL
                    CHECK (type IN ('earn', 'spend', 'bonus', 'refund', 'transfer')),
  amount            INTEGER NOT NULL,
  balance_after     INTEGER NOT NULL,
  source            TEXT NOT NULL
                    CHECK (source IN (
                      'checkin', 'booking_complete', 'review', 'proof',
                      'referral', 'daily_login', 'event_host', 'circle_create',
                      'redemption', 'transfer', 'system', 'promotion'
                    )),
  ref_type          TEXT,
  ref_id            TEXT,
  description       TEXT DEFAULT '',
  created_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wtx_user ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wtx_source ON wallet_transactions(source);

-- ============================================================================
-- 16. MESSAGES — group chat for events and circles
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id                TEXT PRIMARY KEY,
  -- Format: 'msg_' + lower(hex(randomblob(16))) — generate in app code
  room_type         TEXT NOT NULL DEFAULT 'event',
  room_id           TEXT NOT NULL,
  sender_id         TEXT NOT NULL,
  sender_name       TEXT,
  sender_avatar     TEXT,
  body              TEXT NOT NULL,
  created_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_type, room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- ============================================================================
-- 17. KISSES — ephemeral gifts/declarations (inferred from API code)
-- ============================================================================

CREATE TABLE IF NOT EXISTS kisses (
  id                TEXT PRIMARY KEY,
  -- Format: 'kiss_' + lower(hex(randomblob(16))) — generate in app code
  sender_id         TEXT NOT NULL,
  receiver_id       TEXT NOT NULL,
  message           TEXT DEFAULT '',
  emoji             TEXT DEFAULT '💋',
  visibility        TEXT DEFAULT 'public'
                    CHECK (visibility IN ('public', 'private')),
  kiss_type         TEXT DEFAULT 'kiss'
                    CHECK (kiss_type IN ('kiss', 'declaration')),
  sender_lat        REAL,
  sender_lng        REAL,
  receiver_lat      REAL,
  receiver_lng      REAL,
  opened            INTEGER DEFAULT 0,         -- BOOLEAN
  opened_at         TEXT,
  created_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kisses_sender ON kisses(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kisses_receiver ON kisses(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kisses_visibility ON kisses(visibility, created_at DESC);

-- ============================================================================
-- 18. PROFILES — LinkedIn-style professional profiles (inferred from API code)
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id           TEXT NOT NULL UNIQUE,
  headline          TEXT NOT NULL,
  bio               TEXT DEFAULT '',
  industry          TEXT,
  skills            TEXT DEFAULT '[]',         -- JSON array of strings
  experience        TEXT DEFAULT '[]',         -- JSON array of {title,company,start_year,end_year,description}
  education         TEXT DEFAULT '[]',         -- JSON array of {degree,school,year}
  languages         TEXT DEFAULT '[]',         -- JSON array of strings
  lat               REAL,
  lng               REAL,
  city              TEXT DEFAULT '',
  available         INTEGER DEFAULT 1,         -- BOOLEAN
  work_type         TEXT DEFAULT 'onsite'
                    CHECK (work_type IN ('remote', 'onsite', 'hybrid')),
  salary_min        REAL,
  salary_max        REAL,
  salary_currency   TEXT DEFAULT 'USD',
  portfolio_url     TEXT,
  contact_visible   INTEGER DEFAULT 0,         -- BOOLEAN
  trust_score_snapshot INTEGER DEFAULT 0,
  status            TEXT DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'hidden')),
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_industry ON profiles(industry, status);
CREATE INDEX IF NOT EXISTS idx_profiles_available ON profiles(available, status);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles(lat, lng) WHERE lat IS NOT NULL;

-- ============================================================================
-- NOTE: Stored procedures removed — replaced with app logic in Phase 2
-- ============================================================================
-- recalculate_trust_score(user_id) → src/lib/trust.ts
--   Formula: proofs×5(max40) + bookings×3(max20) + reviews×2(max15)
--           + checkins(max10) + circles×2(max10) + base5 → cap 100
--   Levels: ≥85=highly_trusted, ≥60=trusted, ≥30=verified, else=new
--
-- update_business_rating(business_id) → src/lib/businessRating.ts
--   Formula: AVG(rating) WHERE status='active', COUNT(*)
-- ============================================================================
