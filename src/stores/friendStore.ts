import { create } from 'zustand';
import type { Friend } from '@/types';

interface FriendStore {
  friends: Friend[];
  showOnMap: boolean;
  addFriend: (friend: Friend) => void;
  removeFriend: (id: string) => void;
  updateFriendLocation: (id: string, lng: number, lat: number) => void;
  toggleShowOnMap: () => void;
}

// ─── Seed friends (demo) ─────────────────────────────────────────────────

const SEED_FRIENDS: Friend[] = [
  {
    id: 'friend_1',
    display_name: 'Alex Nguyen',
    gao_domain: 'alex.gao',
    trust_level: 'trusted',
    trust_score: 78,
    location_sharing: 'exact',
    location: { type: 'Point', coordinates: [-96.808, 32.780] }, // Dallas downtown
    is_online: true,
    last_seen_at: new Date().toISOString(),
  },
  {
    id: 'friend_2',
    display_name: 'Sarah Kim',
    gao_domain: 'sarah.gao',
    trust_level: 'highly_trusted',
    trust_score: 92,
    location_sharing: 'exact',
    location: { type: 'Point', coordinates: [106.660, 10.762] }, // Ho Chi Minh City
    is_online: true,
  },
  {
    id: 'friend_3',
    display_name: 'James Lee',
    gao_domain: 'james.gao',
    trust_level: 'verified',
    trust_score: 55,
    location_sharing: 'exact',
    location: { type: 'Point', coordinates: [-73.985, 40.748] }, // New York
    is_online: false,
    last_seen_at: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    id: 'friend_4',
    display_name: 'Mina Tanaka',
    gao_domain: 'mina.gao',
    trust_level: 'trusted',
    trust_score: 70,
    location_sharing: 'exact',
    location: { type: 'Point', coordinates: [139.691, 35.689] }, // Tokyo
    is_online: true,
  },
  {
    id: 'friend_5',
    display_name: 'Carlos Rivera',
    trust_level: 'new',
    trust_score: 20,
    location_sharing: 'off',
    location: null,
    is_online: false,
  },
  {
    id: 'friend_6',
    display_name: 'Emma Chen',
    gao_domain: 'emma.gao',
    trust_level: 'trusted',
    trust_score: 74,
    location_sharing: 'exact',
    location: { type: 'Point', coordinates: [-0.118, 51.509] }, // London
    is_online: true,
  },
  {
    id: 'friend_7',
    display_name: 'Liam Park',
    gao_domain: 'liam.gao',
    trust_level: 'verified',
    trust_score: 60,
    location_sharing: 'exact',
    location: { type: 'Point', coordinates: [2.349, 48.864] }, // Paris
    is_online: false,
  },
];

export const useFriendStore = create<FriendStore>((set) => ({
  friends: SEED_FRIENDS,
  showOnMap: false,

  addFriend: (friend) =>
    set((s) => ({ friends: [...s.friends, friend] })),

  removeFriend: (id) =>
    set((s) => ({ friends: s.friends.filter((f) => f.id !== id) })),

  updateFriendLocation: (id, lng, lat) =>
    set((s) => ({
      friends: s.friends.map((f) =>
        f.id === id
          ? { ...f, location: { type: 'Point' as const, coordinates: [lng, lat] as [number, number] } }
          : f
      ),
    })),

  toggleShowOnMap: () =>
    set((s) => ({ showOnMap: !s.showOnMap })),
}));
