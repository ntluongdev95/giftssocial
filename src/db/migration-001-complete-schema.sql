-- ============================================================================
-- Gao Social V3 — Complete Database Schema
-- Migration 001 — 2026-03-31
-- ============================================================================
-- Design principles:
--   1. users.id = external user_id from passkey auth (NOT auto-generated)
--   2. All IDs are text with prefix (usr_, sig_, cir_, bk_, prf_, rev_, ck_, ntf_)
--   3. Location uses lat/lng doubles (no PostGIS needed)
--   4. JSONB for flexible nested data (services, metadata)
--   5. GIN indexes for array/text search, btree for geo/trust ranking
--   6. No hard foreign keys (external user_id may not exist locally yet)
--   7. Soft delete via status column, never hard delete
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. USERS — local cache/mirror of external passkey auth
--    id = external user_id (from api-dev.toii.social)
--    Synced on first login, updated periodically
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,                    -- external user_id from passkey (NOT generated)
  username          VARCHAR(100),
  display_name      VARCHAR(200),
  email             VARCHAR(255),
  phone             VARCHAR(20),
  avatar_url        TEXT,
  bio               TEXT DEFAULT '',
  gao_domain        VARCHAR(100),                       -- e.g. luong.gao

  -- Location
  location_lat      DOUBLE PRECISION,
  location_lng      DOUBLE PRECISION,
  city              VARCHAR(100) DEFAULT '',

  -- Trust (calculated locally from proofs, reviews, checkins)
  trust_score       INTEGER DEFAULT 0,                  -- 0-100
  trust_level       VARCHAR(20) DEFAULT 'new'           -- new, verified, trusted, highly_trusted
                    CHECK (trust_level IN ('new', 'verified', 'trusted', 'highly_trusted')),
  badges            TEXT[] DEFAULT '{}',

  -- Stats (denormalized for fast reads)
  proofs_count      INTEGER DEFAULT 0,
  bookings_count    INTEGER DEFAULT 0,
  reviews_count     INTEGER DEFAULT 0,
  circles_count     INTEGER DEFAULT 0,
  followers_count   INTEGER DEFAULT 0,
  following_count   INTEGER DEFAULT 0,

  -- Settings
  profile_visibility VARCHAR(20) DEFAULT 'public'
                    CHECK (profile_visibility IN ('public', 'circles', 'private')),
  location_sharing  VARCHAR(20) DEFAULT 'approximate'
                    CHECK (location_sharing IN ('exact', 'approximate', 'off')),

  -- Wallet
  gao_points        INTEGER DEFAULT 0,

  -- Meta
  role              VARCHAR(20) DEFAULT 'user'
                    CHECK (role IN ('user', 'admin', 'moderator')),
  status            VARCHAR(20) DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'deleted')),
  last_seen_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_gao_domain ON users(gao_domain) WHERE gao_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_trust ON users(trust_score DESC);
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location_lat, location_lng) WHERE location_lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ============================================================================
-- 2. SIGNALS — core content engine (I'm Here, I Need, Offer, Event, Update, Proof)
-- ============================================================================

CREATE TABLE IF NOT EXISTS signals (
  id                TEXT PRIMARY KEY DEFAULT 'sig_' || gen_random_uuid()::text,
  author_id         TEXT NOT NULL,                      -- references users.id
  type              VARCHAR(20) NOT NULL
                    CHECK (type IN ('presence', 'intent', 'offer', 'event', 'update', 'proof')),
  title             VARCHAR(200) NOT NULL,
  description       TEXT DEFAULT '',
  category          VARCHAR(50) DEFAULT 'general',

  -- Location
  location_lat      DOUBLE PRECISION NOT NULL,
  location_lng      DOUBLE PRECISION NOT NULL,
  radius            INTEGER DEFAULT 300,                -- visibility radius in meters

  -- Visibility & targeting
  visibility        VARCHAR(20) DEFAULT 'public'
                    CHECK (visibility IN ('public', 'circle', 'private', 'trusted_only')),
  target_circle_id  TEXT,                               -- optional: signal for specific circle
  target_business_id TEXT,                              -- optional: linked business

  -- Trust snapshot at creation
  trust_score_snapshot INTEGER DEFAULT 0,
  verified          BOOLEAN DEFAULT FALSE,

  -- Timing
  starts_at         TIMESTAMPTZ DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL,

  -- Engagement stats
  views_count       INTEGER DEFAULT 0,
  responses_count   INTEGER DEFAULT 0,
  saves_count       INTEGER DEFAULT 0,

  -- Flexible data per type
  metadata          JSONB DEFAULT '{}',
  -- presence: { note, mood }
  -- intent: { budget_min, budget_max, urgency }
  -- offer: { price, discount_percent, original_price, redeem_code }
  -- event: { venue, capacity, ticket_price }
  -- update: { media_urls }
  -- proof: { proof_type, evidence_url, target_entity_type, target_entity_id }

  status            VARCHAR(20) DEFAULT 'active'
                    CHECK (status IN ('active', 'expired', 'hidden', 'suppressed', 'matched')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
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
-- 3. CIRCLES — community groups
-- ============================================================================

CREATE TABLE IF NOT EXISTS circles (
  id                TEXT PRIMARY KEY DEFAULT 'cir_' || gen_random_uuid()::text,
  owner_id          TEXT NOT NULL,                      -- references users.id
  name              VARCHAR(200) NOT NULL,
  slug              VARCHAR(200) UNIQUE,
  category          VARCHAR(50) DEFAULT 'general',
  description       TEXT DEFAULT '',
  cover_image       TEXT,
  rules             TEXT DEFAULT '',

  -- Location scope
  city              VARCHAR(100) DEFAULT '',
  location_lat      DOUBLE PRECISION,
  location_lng      DOUBLE PRECISION,

  -- Settings
  visibility        VARCHAR(20) DEFAULT 'public'
                    CHECK (visibility IN ('public', 'private', 'invite_only')),
  join_mode         VARCHAR(20) DEFAULT 'open'
                    CHECK (join_mode IN ('open', 'request', 'invite_only')),
  post_permission   VARCHAR(20) DEFAULT 'members'
                    CHECK (post_permission IN ('anyone', 'members', 'admins')),

  -- Trust
  trust_score       INTEGER DEFAULT 0,
  trust_level       VARCHAR(20) DEFAULT 'new'
                    CHECK (trust_level IN ('new', 'verified', 'trusted', 'highly_trusted')),
  badges            TEXT[] DEFAULT '{}',
  min_trust_to_join INTEGER DEFAULT 0,                  -- minimum trust score to join

  -- Stats (denormalized)
  member_count      INTEGER DEFAULT 0,
  event_count       INTEGER DEFAULT 0,
  signal_count      INTEGER DEFAULT 0,
  posts_today       INTEGER DEFAULT 0,

  status            VARCHAR(20) DEFAULT 'active'
                    CHECK (status IN ('active', 'hidden', 'suspended', 'archived')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circles_owner ON circles(owner_id);
CREATE INDEX IF NOT EXISTS idx_circles_slug ON circles(slug);
CREATE INDEX IF NOT EXISTS idx_circles_category ON circles(category, status);
CREATE INDEX IF NOT EXISTS idx_circles_trust ON circles(trust_score DESC);
CREATE INDEX IF NOT EXISTS idx_circles_location ON circles(location_lat, location_lng) WHERE location_lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_circles_name ON circles USING GIN(to_tsvector('english', name));

-- ============================================================================
-- 4. CIRCLE_MEMBERS — many-to-many users ↔ circles
-- ============================================================================

CREATE TABLE IF NOT EXISTS circle_members (
  id                TEXT PRIMARY KEY DEFAULT 'cm_' || gen_random_uuid()::text,
  circle_id         TEXT NOT NULL,
  user_id           TEXT NOT NULL,
  role              VARCHAR(20) DEFAULT 'member'
                    CHECK (role IN ('member', 'moderator', 'admin', 'owner')),
  status            VARCHAR(20) DEFAULT 'active'
                    CHECK (status IN ('active', 'pending', 'banned', 'left')),
  joined_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (circle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cm_circle ON circle_members(circle_id, status);
CREATE INDEX IF NOT EXISTS idx_cm_user ON circle_members(user_id, status);

-- ============================================================================
-- 5. BOOKINGS — user books business service or event slot
-- ============================================================================

CREATE TABLE IF NOT EXISTS bookings (
  id                TEXT PRIMARY KEY DEFAULT 'bk_' || gen_random_uuid()::text,
  user_id           TEXT NOT NULL,
  -- Bookable target (one of these)
  business_id       TEXT,
  event_id          TEXT,
  -- Details
  service_name      VARCHAR(200),                       -- which service booked
  slot_time         TIMESTAMPTZ,                        -- appointment datetime
  party_size        INTEGER DEFAULT 1,
  notes             TEXT DEFAULT '',
  -- Pricing
  amount            NUMERIC(10,2) DEFAULT 0,
  currency          VARCHAR(3) DEFAULT 'USD',
  -- Status flow: pending → confirmed → completed / canceled / no_show
  status            VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'completed', 'canceled', 'no_show')),
  -- Check-in
  checkin_at        TIMESTAMPTZ,
  checkin_verified  BOOLEAN DEFAULT FALSE,
  -- Proof link
  proof_id          TEXT,                               -- auto-created proof after completion
  -- Meta
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_business ON bookings(business_id, status) WHERE business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_event ON bookings(event_id, status) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_time) WHERE status IN ('pending', 'confirmed');

-- ============================================================================
-- 6. REVIEWS — user reviews business or event (after booking/visit)
-- ============================================================================

CREATE TABLE IF NOT EXISTS reviews (
  id                TEXT PRIMARY KEY DEFAULT 'rev_' || gen_random_uuid()::text,
  author_id         TEXT NOT NULL,
  -- Target (one of these)
  business_id       TEXT,
  event_id          TEXT,
  -- Review data
  rating            SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title             VARCHAR(200) DEFAULT '',
  body              TEXT DEFAULT '',
  photos            TEXT[] DEFAULT '{}',
  -- Verification
  booking_id        TEXT,                               -- linked booking proves real visit
  verified_visit    BOOLEAN DEFAULT FALSE,              -- true if has valid booking/checkin
  -- Trust weight
  author_trust_score INTEGER DEFAULT 0,                 -- snapshot at review time
  helpful_count     INTEGER DEFAULT 0,
  -- Meta
  status            VARCHAR(20) DEFAULT 'active'
                    CHECK (status IN ('active', 'hidden', 'flagged', 'removed')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_author ON reviews(author_id);
CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews(business_id, status) WHERE business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_event ON reviews(event_id, status) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

-- ============================================================================
-- 7. PROOFS — verifiable evidence of real-world action
--    Auto-created by: checkin, booking complete, review, event attendance
-- ============================================================================

CREATE TABLE IF NOT EXISTS proofs (
  id                TEXT PRIMARY KEY DEFAULT 'prf_' || gen_random_uuid()::text,
  user_id           TEXT NOT NULL,
  proof_type        VARCHAR(30) NOT NULL
                    CHECK (proof_type IN (
                      'event_attended', 'booking_completed', 'review_submitted',
                      'checkin_verified', 'business_visited', 'circle_contributed',
                      'identity_verified', 'skill_verified'
                    )),
  -- What was the proof about
  target_type       VARCHAR(20)                         -- 'business', 'event', 'circle', 'user'
                    CHECK (target_type IN ('business', 'event', 'circle', 'user')),
  target_id         TEXT,
  -- Evidence
  evidence_type     VARCHAR(20) DEFAULT 'system'        -- system, photo, receipt, qr
                    CHECK (evidence_type IN ('system', 'photo', 'receipt', 'qr', 'manual')),
  evidence_url      TEXT,
  evidence_note     TEXT DEFAULT '',
  -- Trust impact
  trust_impact      VARCHAR(10) DEFAULT 'positive'
                    CHECK (trust_impact IN ('positive', 'neutral', 'negative')),
  trust_points      INTEGER DEFAULT 1,                  -- how many trust points earned
  -- Source reference
  booking_id        TEXT,
  review_id         TEXT,
  signal_id         TEXT,
  -- Meta
  verified          BOOLEAN DEFAULT FALSE,
  status            VARCHAR(20) DEFAULT 'active'
                    CHECK (status IN ('active', 'revoked', 'expired')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proofs_user ON proofs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_proofs_type ON proofs(proof_type);
CREATE INDEX IF NOT EXISTS idx_proofs_target ON proofs(target_type, target_id) WHERE target_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proofs_created ON proofs(created_at DESC);

-- ============================================================================
-- 8. CHECKINS — QR scan / location-based check-in
-- ============================================================================

CREATE TABLE IF NOT EXISTS checkins (
  id                TEXT PRIMARY KEY DEFAULT 'ck_' || gen_random_uuid()::text,
  user_id           TEXT NOT NULL,
  -- Where
  target_type       VARCHAR(20) NOT NULL
                    CHECK (target_type IN ('business', 'event', 'circle', 'location')),
  target_id         TEXT,
  location_lat      DOUBLE PRECISION NOT NULL,
  location_lng      DOUBLE PRECISION NOT NULL,
  -- How
  method            VARCHAR(20) DEFAULT 'location'
                    CHECK (method IN ('qr', 'nfc', 'location', 'manual')),
  -- Links
  booking_id        TEXT,
  proof_id          TEXT,                               -- auto-created proof
  -- Meta
  verified          BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkins_user ON checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_target ON checkins(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_checkins_created ON checkins(created_at DESC);

-- ============================================================================
-- 9. FOLLOWS — social graph (user follows user, business, or circle)
-- ============================================================================

CREATE TABLE IF NOT EXISTS follows (
  id                TEXT PRIMARY KEY DEFAULT 'fol_' || gen_random_uuid()::text,
  follower_id       TEXT NOT NULL,                      -- who follows
  -- What they follow (one of these)
  following_user_id TEXT,
  following_business_id TEXT,
  following_circle_id TEXT,
  -- Meta
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (follower_id, following_user_id),
  UNIQUE (follower_id, following_business_id),
  UNIQUE (follower_id, following_circle_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_user ON follows(following_user_id) WHERE following_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_follows_business ON follows(following_business_id) WHERE following_business_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_follows_circle ON follows(following_circle_id) WHERE following_circle_id IS NOT NULL;

-- ============================================================================
-- 10. SAVED_ITEMS — bookmarks (save business, event, signal, circle)
-- ============================================================================

CREATE TABLE IF NOT EXISTS saved_items (
  id                TEXT PRIMARY KEY DEFAULT 'sav_' || gen_random_uuid()::text,
  user_id           TEXT NOT NULL,
  item_type         VARCHAR(20) NOT NULL
                    CHECK (item_type IN ('business', 'event', 'signal', 'circle', 'profile')),
  item_id           TEXT NOT NULL,
  collection        VARCHAR(100) DEFAULT 'default',     -- user can organize into collections
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_items(user_id, item_type);
CREATE INDEX IF NOT EXISTS idx_saved_item ON saved_items(item_type, item_id);

-- ============================================================================
-- 11. NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id                TEXT PRIMARY KEY DEFAULT 'ntf_' || gen_random_uuid()::text,
  user_id           TEXT NOT NULL,                      -- recipient
  type              VARCHAR(30) NOT NULL
                    CHECK (type IN (
                      'booking_confirmed', 'booking_reminder', 'booking_canceled',
                      'event_reminder', 'event_starting',
                      'signal_response', 'signal_matched',
                      'circle_invite', 'circle_activity', 'circle_join_request',
                      'proof_earned', 'trust_upgraded',
                      'review_received', 'follow_new', 'new_message',
                      'system'
                    )),
  title             VARCHAR(200) NOT NULL,
  body              TEXT DEFAULT '',
  -- Reference to related entity
  ref_type          VARCHAR(20),                        -- 'booking', 'event', 'signal', 'circle', 'review', 'proof'
  ref_id            TEXT,
  -- State
  read              BOOLEAN DEFAULT FALSE,
  seen              BOOLEAN DEFAULT FALSE,
  -- Meta
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ntf_user ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ntf_type ON notifications(type);

-- ============================================================================
-- 12. WALLET_TRANSACTIONS — Gao Points earn/spend
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                TEXT PRIMARY KEY DEFAULT 'wtx_' || gen_random_uuid()::text,
  user_id           TEXT NOT NULL,
  type              VARCHAR(20) NOT NULL
                    CHECK (type IN ('earn', 'spend', 'bonus', 'refund', 'transfer')),
  amount            INTEGER NOT NULL,                   -- positive for earn, negative for spend
  balance_after     INTEGER NOT NULL,                   -- balance snapshot after this tx
  -- What triggered it
  source            VARCHAR(30) NOT NULL
                    CHECK (source IN (
                      'checkin', 'booking_complete', 'review', 'proof',
                      'referral', 'daily_login', 'event_host', 'circle_create',
                      'redemption', 'transfer', 'system', 'promotion'
                    )),
  ref_type          VARCHAR(20),
  ref_id            TEXT,
  description       VARCHAR(200) DEFAULT '',
  -- Meta
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wtx_user ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wtx_source ON wallet_transactions(source);

-- ============================================================================
-- 13. UPDATE EXISTING TABLES
-- ============================================================================

-- Businesses: allow multiple businesses per user
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_owner_unique;

-- Businesses: remove inline reviews (use reviews table instead)
-- Keep column for now but stop using it
-- ALTER TABLE businesses DROP COLUMN IF EXISTS reviews;

-- Events: add circle linkage + ticket pricing
ALTER TABLE events ADD COLUMN IF NOT EXISTS circle_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_price NUMERIC(10,2);
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_currency VARCHAR(3) DEFAULT 'USD';
ALTER TABLE events ADD COLUMN IF NOT EXISTS rsvp_mode VARCHAR(20) DEFAULT 'open'
  CHECK (rsvp_mode IN ('open', 'request', 'ticket'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS qr_checkin_enabled BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_evt_circle ON events(circle_id) WHERE circle_id IS NOT NULL;

-- Update visibility constraint to include 'circle'
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_visibility_check;
ALTER TABLE events ADD CONSTRAINT events_visibility_check CHECK (visibility IN ('public', 'circle', 'private'));

-- ── Messages (event/circle group chat) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY DEFAULT 'msg_' || gen_random_uuid()::text,
  room_type VARCHAR(20) NOT NULL DEFAULT 'event',
  room_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name VARCHAR(100),
  sender_avatar TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_type, room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to recalculate user trust score
CREATE OR REPLACE FUNCTION recalculate_trust_score(p_user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 0;
  v_proofs INTEGER;
  v_bookings INTEGER;
  v_reviews INTEGER;
  v_checkins INTEGER;
  v_circles INTEGER;
BEGIN
  -- Count proofs (5 pts each, max 40)
  SELECT count(*) INTO v_proofs FROM proofs WHERE user_id = p_user_id AND status = 'active';
  v_score := v_score + LEAST(v_proofs * 5, 40);

  -- Count completed bookings (3 pts each, max 20)
  SELECT count(*) INTO v_bookings FROM bookings WHERE user_id = p_user_id AND status = 'completed';
  v_score := v_score + LEAST(v_bookings * 3, 20);

  -- Count reviews written (2 pts each, max 15)
  SELECT count(*) INTO v_reviews FROM reviews WHERE author_id = p_user_id AND status = 'active';
  v_score := v_score + LEAST(v_reviews * 2, 15);

  -- Count verified checkins (1 pt each, max 10)
  SELECT count(*) INTO v_checkins FROM checkins WHERE user_id = p_user_id AND verified = true;
  v_score := v_score + LEAST(v_checkins, 10);

  -- Count circles joined (2 pts each, max 10)
  SELECT count(*) INTO v_circles FROM circle_members WHERE user_id = p_user_id AND status = 'active';
  v_score := v_score + LEAST(v_circles * 2, 10);

  -- Base 5 pts for existing
  v_score := v_score + 5;

  -- Cap at 100
  v_score := LEAST(v_score, 100);

  -- Determine trust level
  UPDATE users SET
    trust_score = v_score,
    trust_level = CASE
      WHEN v_score >= 85 THEN 'highly_trusted'
      WHEN v_score >= 60 THEN 'trusted'
      WHEN v_score >= 30 THEN 'verified'
      ELSE 'new'
    END,
    proofs_count = v_proofs,
    bookings_count = v_bookings,
    reviews_count = v_reviews,
    circles_count = v_circles,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- Function to update business rating from reviews
CREATE OR REPLACE FUNCTION update_business_rating(p_business_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE businesses SET
    rating_avg = (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE business_id = p_business_id AND status = 'active'),
    rating_count = (SELECT count(*) FROM reviews WHERE business_id = p_business_id AND status = 'active'),
    updated_at = NOW()
  WHERE id = p_business_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
