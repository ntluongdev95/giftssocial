/**
 * D1 row interfaces for all API routes.
 * Used as generics on .first<T>() and .all<T>() calls to satisfy TS2347.
 */

// ─── Core Entity Rows ────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  username: string | null;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  background_url: string | null;
  bio: string | null;
  photos: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_sharing: string;
  city: string | null;
  trust_level: string;
  trust_score: number;
  badges: string | null;
  gao_points: number;
  gao_domain: string | null;
  proofs_count: number;
  bookings_count: number;
  reviews_count: number;
  circles_count: number;
  followers_count: number;
  following_count: number;
  status: string;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessRow {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  location_lat: number | null;
  location_lng: number | null;
  avatar_url: string | null;
  cover_image: string | null;
  checkin_code: string | null;
  trust_score: number;
  trust_level: string;
  badges: string | null;
  proof_count: number;
  rating_avg: number;
  rating_count: number;
  booking_enabled: number;
  payment_enabled: number;
  status: string;
  owner_user_id: string | null;
  hours: string | null;
  photos: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: string;
  title: string;
  description: string | null;
  location_name: string | null;
  city: string | null;
  location_lat: number | null;
  location_lng: number | null;
  host_type: string | null;
  host_id: string | null;
  host_user_id: string | null;
  circle_id: string | null;
  start_time: string;
  end_time: string | null;
  capacity: number | null;
  joined_count: number;
  checkin_count: number;
  checkin_code: string | null;
  status: string;
  visibility: string;
  created_at: string;
  updated_at: string;
}

export interface CircleRow {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  category: string | null;
  city: string | null;
  location_lat: number | null;
  location_lng: number | null;
  avatar_url: string | null;
  cover_image: string | null;
  owner_id: string | null;
  visibility: string;
  join_mode: string;
  member_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SignalRow {
  id: string;
  author_id: string;
  type: string;
  title: string | null;
  description: string | null;
  category: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_name: string | null;
  radius_km: number | null;
  visibility: string;
  target_circle_id: string | null;
  metadata: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface KissRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  emoji: string;
  visibility: string;
  kiss_type: string;
  sender_lat: number | null;
  sender_lng: number | null;
  receiver_lat: number | null;
  receiver_lng: number | null;
  opened: number;
  opened_at: string | null;
  created_at: string;
  // Occasion enrichments (migration 030)
  photos: string | null;
  music_url: string | null;
  music_title: string | null;
  // 5-open limit (migration 031)
  open_count: number;
  max_opens: number;
}

export interface BookingRow {
  id: string;
  user_id: string;
  business_id: string | null;
  event_id: string | null;
  service_name: string | null;
  slot_time: string | null;
  party_size: number;
  notes: string;
  amount: number;
  currency: string;
  status: string;
  checkin_verified: number;
  created_at: string;
  updated_at: string;
}

export interface ProfileRow {
  id: string;
  user_id: string;
  headline: string | null;
  bio: string | null;
  industry: string | null;
  skills: string | null;
  experience: string | null;
  education: string | null;
  languages: string | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  available: number;
  work_type: string | null;
  trust_score_snapshot: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ProofRow {
  id: string;
  user_id: string;
  proof_type: string;
  target_type: string;
  target_id: string | null;
  evidence_type: string;
  review_id: string | null;
  trust_points: number;
  verified: number;
  created_at: string;
}

export interface MessageRow {
  id: string;
  room_type: string;
  room_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_avatar: string | null;
  body: string;
  created_at: string;
}

export interface ReviewRow {
  id: string;
  author_id: string;
  business_id: string | null;
  event_id: string | null;
  booking_id: string | null;
  rating: number;
  title: string;
  body: string;
  verified_visit: number;
  author_trust_score: number;
  status: string;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  ref_type: string | null;
  ref_id: string | null;
  read: number;
  created_at: string;
}

export interface CheckinRow {
  id: string;
  user_id: string;
  target_type: string;
  target_id: string | null;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
}

export interface FollowRow {
  id: string;
  follower_id: string;
  following_user_id: string | null;
  following_business_id: string | null;
  following_circle_id: string | null;
  created_at: string;
}

export interface WalletTransactionRow {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  balance_after: number;
  source: string;
  ref_type: string | null;
  ref_id: string | null;
  description: string;
  created_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  device_info: string | null;
  ip_address: string | null;
  is_revoked: number;
  expires_at: string;
  last_active_at: string | null;
  created_at: string;
}

// ─── Projection Types ────────────────────────────────────────────────────
// (UserSyncRow removed — the passkey sync route is gone.)

/** Subset returned by auth/login query */
export interface UserLoginRow {
  id: string;
  display_name: string | null;
  email: string | null;
  trust_score: number;
  trust_level: string;
  status: string;
}

// ─── Join Result Types ───────────────────────────────────────────────────

/** signals JOIN users — author fields appended */
export interface SignalWithAuthor extends SignalRow {
  author_username: string | null;
  author_name: string | null;
  author_avatar: string | null;
}

/** kisses JOIN users (sender + receiver) */
export interface KissWithUsers extends KissRow {
  sender_name: string | null;
  sender_avatar: string | null;
  receiver_name: string | null;
  receiver_avatar: string | null;
}

/** bookings JOIN businesses JOIN events — used by bookings/me */
export interface BookingWithDetails extends BookingRow {
  business_name: string | null;
  business_category: string | null;
  business_city: string | null;
  event_title: string | null;
  event_start_time: string | null;
  event_location: string | null;
}

/** circle_members JOIN users — used by circles/[id]/members */
export interface CircleMemberWithUser {
  circle_id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  trust_level: string;
  trust_score: number;
}

/** reviews JOIN users — author fields appended */
export interface ReviewWithAuthor extends ReviewRow {
  author_username: string | null;
  author_name: string | null;
  author_avatar: string | null;
}

/** follows JOIN users (mutual follows) — used by friends/route */
export interface FriendRow {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  trust_level: string;
  trust_score: number;
  location_lat: number | null;
  location_lng: number | null;
  location_sharing: string;
  last_seen_at: string | null;
}

/** messages aggregation — used by messages/conversations */
export interface ConversationRow {
  room_id: string;
  sender_name: string | null;
  last_message: string;
  last_message_at: string;
  message_count: number;
}

/** checkins JOIN businesses/events — target name coalesced */
export interface CheckinWithTarget {
  id: string;
  target_type: string;
  target_id: string | null;
  created_at: string;
  target_name: string | null;
}

/** saved_items JOIN events JOIN businesses */
export interface SavedItemWithDetails {
  id: string;
  user_id: string;
  item_type: string;
  item_id: string;
  collection: string;
  created_at: string;
  event_title: string | null;
  event_start_time: string | null;
  event_city: string | null;
  business_name: string | null;
  business_category: string | null;
  business_city: string | null;
}

/** profiles JOIN users — used by match/route */
export interface ProfileWithUser extends ProfileRow {
  user_username: string | null;
  user_name: string | null;
  user_avatar: string | null;
  user_trust_score: number;
  user_trust_level: string;
  distance_km: number;
  match_score: number;
}

/** circles JOIN circle_members — used by circles/me */
export interface CircleWithMembership extends CircleRow {
  role: string;
}
