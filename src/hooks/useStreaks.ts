'use client';

import useSWR from 'swr';
import { localDateKey } from '@/lib/streaks';

// ── Types ────────────────────────────────────────────────────────────────

export type StreakPartnerSummary = {
  id: string;
  name: string;
  avatar: string | null;
  current: number;
  ticked_today: boolean;
};

export type StreakListItem = {
  id: string;
  owner_id: string;
  title: string;
  icon: string;
  description: string;
  target_type: 'check' | 'counter';
  target_value: number;
  target_unit: string;
  schedule: number[];
  visibility: 'private' | 'friends' | 'circles';
  status: 'active' | 'paused' | 'archived';
  reminder_at?: string | null;
  reminder_tz?: string | null;
  require_proof?: 0 | 1;
  streak_type?: 'solo' | 'group' | 'couple';
  bond_species?: string | null;
  bond_species_agreed_by?: string;          // JSON array of user ids
  bond_breed_id?: string | null;
  bond_breed_label?: string | null;
  bond_breed_image_url?: string | null;
  created_at: string;
  my_ticks: string[];
  my_current_streak: number;
  my_longest_streak: number;
  my_completion_30d: number;
  my_ticked_today: boolean;
  owner: StreakPartnerSummary;
  partners: StreakPartnerSummary[];
};

export type StreakParticipantDetail = {
  id: string;
  name: string;
  avatar: string | null;
  is_owner: boolean;
  current_streak: number;
  longest_streak: number;
  completion_30d: number;
  ticked_today: boolean;
  checkins: Array<{
    date: string;
    value: number;
    note: string;
    created_at: string;
    photo_url: string | null;
    confirmation_state: 'pending' | 'confirmed' | 'rejected';
    votes: Array<{ voter_id: string; vote: 'approve' | 'reject' }>;
    reactions: Array<{ reactor_id: string; emoji: string }>;
  }>;
};

export type StreakDetail = {
  id: string;
  owner_id: string;
  title: string;
  icon: string;
  description: string;
  target_type: 'check' | 'counter';
  target_value: number;
  target_unit: string;
  schedule: number[];
  visibility: 'private' | 'friends' | 'circles';
  status: 'active' | 'paused' | 'archived';
  require_proof?: 0 | 1;
  insights_benefits?: string | null;
  insights_risks?: string | null;
  insights_generated_at?: string | null;
  streak_type?: 'solo' | 'group' | 'couple';
  bond_species?: string | null;
  bond_species_agreed_by?: string;
  bond_breed_id?: string | null;
  bond_breed_label?: string | null;
  bond_breed_image_url?: string | null;
  /** AI-generated diary entries from the pet's POV. JSON-stringified
   *  array — parse with parseDiary() from src/lib/pet-voice.ts. */
  pet_diary?: string | null;
  pet_greeting?: string | null;
  pet_greeting_at?: string | null;
  /** Tamagotchi care stats (0..100). Default 75/75/50 from migration 026. */
  pet_happiness?: number | null;
  pet_energy?: number | null;
  pet_bond?: number | null;
  pet_last_pet_at?: string | null;
  pet_last_fed_at?: string | null;
  pet_last_played_at?: string | null;
  pet_last_walked_at?: string | null;
  pet_action_log?: string | null;
  /** AI-generated live video of the dog (Replicate Stable Video Diffusion). */
  bond_breed_video_url?: string | null;
  bond_breed_video_status?: 'pending' | 'generating' | 'ready' | 'failed' | null;
  bond_breed_video_at?: string | null;
  /** Computed by API: dates where BOTH partners ticked, both confirmed. */
  synced_days?: number;
  /** Last date a sync happened (YYYY-MM-DD) or null if none. */
  last_sync_date?: string | null;
  owner_name?: string;
  owner_username?: string;
  owner_avatar?: string;
  participants: StreakParticipantDetail[];
};

const fetcher = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url, { credentials: 'same-origin' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<T>;
};

// ── Hooks ────────────────────────────────────────────────────────────────

/** All streaks the viewer owns or has joined as partner.
 *  Refresh on focus so friends' ticks propagate when you return to the tab. */
export function useStreakList() {
  const today = localDateKey();
  const url = `/api/v1/streaks?today=${today}`;
  const { data, error, isLoading, mutate } = useSWR<{ data: StreakListItem[] }>(
    url,
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 60_000 },
  );
  return { streaks: data?.data ?? [], error, isLoading, refresh: mutate };
}

export type StreakInvite = {
  id: string;
  owner_id: string;
  title: string;
  icon: string;
  description: string;
  schedule_json: string;
  target_type: 'check' | 'counter';
  target_value: number;
  target_unit: string;
  require_proof: 0 | 1;
  partner_count: number;
  created_at: string;
  invited_by: string | null;
  invited_at: string;
  owner_name?: string | null;
  owner_username?: string | null;
  owner_avatar?: string | null;
};

/** Pending invites — streaks the viewer was added to but hasn't accepted yet. */
export function useStreakInvites() {
  const { data, error, isLoading, mutate } = useSWR<{ data: StreakInvite[] }>(
    '/api/v1/streaks/invites',
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 60_000 },
  );
  return { invites: data?.data ?? [], error, isLoading, refresh: mutate };
}

/** Detail for a single streak. Refresh on focus to pick up partner ticks. */
export function useStreakDetail(id: string | null) {
  const today = localDateKey();
  const key = id ? `/api/v1/streaks/${id}?today=${today}` : null;
  const { data, error, isLoading, mutate } = useSWR<{ data: StreakDetail }>(
    key,
    fetcher,
    { revalidateOnFocus: true, refreshInterval: 30_000 },
  );
  return { streak: data?.data ?? null, error, isLoading, refresh: mutate };
}
