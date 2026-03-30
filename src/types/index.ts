// ─── Gao Social V3 — Core Types ───────────────────────────────────────────

// ─── Geo ──────────────────────────────────────────────────────────────────

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat] — GeoJSON order
}

// ─── Trust ────────────────────────────────────────────────────────────────

export type TrustLevel = 'new' | 'verified' | 'trusted' | 'highly_trusted';

export type Badge =
  | 'verified_identity'
  | 'verified_business'
  | 'official_brand'
  | 'top_rated'
  | 'trusted_seller'
  | 'active_host'
  | 'trusted_member'
  | 'active_community'
  | 'verified_agent'
  | 'highly_trusted_agent';

// ─── Signal ───────────────────────────────────────────────────────────────

export type SignalType =
  | 'presence'
  | 'intent'
  | 'offer'
  | 'event'
  | 'update'
  | 'proof';

export type SignalStatus = 'active' | 'expired' | 'hidden' | 'suppressed';
export type SignalVisibility = 'public' | 'circle' | 'private';
export type OwnerType = 'user' | 'business' | 'agent';

export interface Signal {
  id: string;
  type: SignalType;
  owner_type: OwnerType;
  owner_id: string;
  title: string;
  description?: string;
  category: string;
  location: GeoPoint;
  radius: number;
  visibility: SignalVisibility;
  verified: boolean;
  trust_score_snapshot: number;
  status: SignalStatus;
  starts_at: string;
  expires_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── User ─────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  gao_domain?: string;
  display_name: string;
  email: string;
  avatar_url?: string;
  bio?: string;
  interests: string[];
  verification_level: 0 | 1 | 2 | 3;
  trust_score: number;
  trust_level: TrustLevel;
  badges: Badge[];
  location_lat?: number;
  location_lng?: number;
  location_sharing: 'exact' | 'approximate' | 'off';
  profile_visibility: 'public' | 'circles' | 'private';
  status: 'active' | 'suspended' | 'deleted';
  created_at: string;
  updated_at: string;
}

// ─── Business ─────────────────────────────────────────────────────────────

export interface Business {
  id: string;
  owner_user_id: string;
  name: string;
  category: string;
  subcategories: string[];
  description?: string;
  domain?: string;
  location_lat: number;
  location_lng: number;
  address_line1?: string;
  address_city?: string;
  address_state?: string;
  address_postal_code?: string;
  address_country: string;
  hours: Record<string, string[]>;
  verification_level: 0 | 1 | 2 | 3;
  trust_score: number;
  trust_level: TrustLevel;
  badges: Badge[];
  proof_count: number;
  rating_avg?: number;
  rating_count: number;
  open_now: boolean;
  booking_enabled: boolean;
  payment_enabled: boolean;
  status: 'active' | 'suspended' | 'deleted';
  created_at: string;
  updated_at: string;
}

// ─── Circle ───────────────────────────────────────────────────────────────

export interface Circle {
  id: string;
  name: string;
  slug: string;
  category: string;
  city?: string;
  location_lat?: number;
  location_lng?: number;
  description?: string;
  owner_id: string;
  visibility: 'public' | 'private';
  verification_level: number;
  trust_score: number;
  trust_level: TrustLevel;
  badges: Badge[];
  member_count: number;
  event_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// ─── Event ────────────────────────────────────────────────────────────────

export type EventStatus = 'scheduled' | 'live' | 'ended' | 'canceled';

export interface Event {
  id: string;
  title: string;
  description?: string;
  host_type: 'user' | 'business' | 'circle';
  host_id: string;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  start_time: string;
  end_time: string;
  capacity?: number;
  joined_count: number;
  checkin_count: number;
  visibility: 'public' | 'private';
  verified: boolean;
  status: EventStatus;
  created_at: string;
  updated_at: string;
}

// ─── Agent ────────────────────────────────────────────────────────────────

export type AgentType = 'system' | 'merchant' | 'personal' | 'circle';
export type AgentStatus = 'active' | 'idle' | 'executing' | 'paused';

export type AgentCapability =
  | 'answer_questions'
  | 'find_nearby'
  | 'trust_lookup'
  | 'check_availability'
  | 'create_booking'
  | 'send_reminders'
  | 'recommend_options'
  | 'summarize_activity'
  | 'prepare_payment';

export interface AgentPermissions {
  can_suggest: boolean;
  can_prepare_action: boolean;
  execute_with_approval: AgentCapability[];
  auto_execute: AgentCapability[];
  requires_user_approval: boolean;
  can_access_payment: boolean;
}

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  owner_type: 'business' | 'user' | 'gao' | 'community';
  owner_id: string;
  verified: boolean;
  trust_score: number;
  trust_level: TrustLevel;
  capabilities: AgentCapability[];
  permission_scope: AgentPermissions;
  location?: GeoPoint;
  map_visible: boolean;
  status: AgentStatus;
  created_at: string;
  updated_at: string;
}

// ─── Booking ──────────────────────────────────────────────────────────────

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'canceled' | 'no_show';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'refunded';

export interface Booking {
  id: string;
  user_id: string;
  business_id: string;
  signal_id?: string;
  status: BookingStatus;
  timeslot: string;
  party_size: number;
  notes?: string;
  payment_status: PaymentStatus;
  receipt_id?: string;
  created_at: string;
  updated_at: string;
}

// ─── Payment ──────────────────────────────────────────────────────────────

export interface Payment {
  id: string;
  reference_type: 'booking' | 'event_ticket' | 'subscription';
  reference_id: string;
  payer_user_id: string;
  recipient_type: 'business' | 'circle' | 'platform';
  recipient_id: string;
  amount: number;
  currency: string;
  fee_amount: number;
  net_amount: number;
  provider: string;
  provider_reference?: string;
  status: PaymentStatus;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

// ─── Proof ────────────────────────────────────────────────────────────────

export type ProofType = 'service_completed' | 'event_attended' | 'booking_fulfilled' | 'payment_completed';

export interface Proof {
  id: string;
  user_id: string;
  target_type: 'business' | 'event' | 'circle' | 'agent';
  target_id: string;
  proof_type: ProofType;
  reference_type: 'booking' | 'event' | 'payment';
  reference_id: string;
  rating?: number;
  review?: string;
  verified: boolean;
  trust_impact: 'positive' | 'neutral' | 'negative';
  created_at: string;
  updated_at: string;
}

// ─── Agent Receipt ────────────────────────────────────────────────────────

export interface AgentReceipt {
  receipt_id: string;
  agent_id: string;
  agent_name: string;
  action_type: string;
  target_type: string;
  target_id: string;
  approved_by_user: boolean;
  execution_status: 'success' | 'failure' | 'cancelled';
  timestamp: string;
}

// ─── Notification ─────────────────────────────────────────────────────────

export type NotificationType =
  | 'booking_confirmed'
  | 'booking_canceled'
  | 'event_reminder'
  | 'proof_created'
  | 'trust_upgraded'
  | 'signal_expired'
  | 'new_message'
  | 'circle_joined';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  reference_type?: string;
  reference_id?: string;
  read: boolean;
  created_at: string;
}

// ─── Map Marker ───────────────────────────────────────────────────────────

export type MarkerState = 'default' | 'selected' | 'live' | 'verified' | 'executing' | 'suppressed';
export type EntityType = 'people' | 'business' | 'event' | 'offer' | 'proof' | 'alert' | 'agent' | 'circle' | 'friend' | 'developer';

// ─── Developer ───────────────────────────────────────────────────────────

export interface Developer {
  id: string;
  display_name: string;
  avatar_url?: string;
  gao_domain?: string;
  title: string;           // e.g. "Senior Full-Stack Engineer"
  bio: string;
  skills: string[];
  experience_years: number;
  location_city: string;
  location: GeoPoint;
  is_available: boolean;   // open to work
  rate_per_hour?: number;  // USD
  currency?: string;
  portfolio_url?: string;
  github_url?: string;
  trust_score: number;
  trust_level: TrustLevel;
  badges: Badge[];
  work_history: { company: string; role: string; period: string }[];
  education?: { school: string; degree: string; year: string }[];
  languages: string[];
}

// ─── Friend ──────────────────────────────────────────────────────────────

export interface Friend {
  id: string;
  display_name: string;
  avatar_url?: string;
  gao_domain?: string;
  trust_level: TrustLevel;
  trust_score: number;
  location_sharing: 'exact' | 'approximate' | 'off';
  location?: GeoPoint | null;
  is_online: boolean;
  last_seen_at?: string;
}

export interface MarkerData {
  id: string;
  entity_type: EntityType;
  lat: number;
  lng: number;
  title: string;
  state: MarkerState;
  trust_level?: TrustLevel;
  metadata?: Record<string, unknown>;
}

// ─── API Response Types ───────────────────────────────────────────────────

export interface PaginationCursor {
  cursor?: string;
  limit: number;
  has_more: boolean;
}

export interface ApiResponse<T> {
  data: T;
  pagination?: PaginationCursor;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    field?: string;
  };
}

export interface NearbyResponse {
  people: User[];
  businesses: Business[];
  events: Event[];
  offers: Signal[];
  agents: Agent[];
}

export interface AskGaoResponse {
  answer: string;
  results: (Business | Event | Signal | Agent)[];
  suggested_actions: string[];
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface SearchResponse {
  results: (User | Business | Event | Signal | Circle | Agent)[];
  pagination: PaginationCursor;
}
