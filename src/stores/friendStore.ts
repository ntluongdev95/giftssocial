import { create } from 'zustand';
import type { Friend } from '@/types';

interface FriendStore {
  friends: Friend[];
  showOnMap: boolean;
  loading: boolean;
  addFriend: (friend: Friend) => void;
  removeFriend: (id: string) => void;
  updateFriendLocation: (id: string, lng: number, lat: number) => void;
  toggleShowOnMap: () => void;
  fetchFriends: () => Promise<void>;
}

export const useFriendStore = create<FriendStore>((set, get) => ({
  friends: [],
  showOnMap: false,
  loading: false,

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
      ) })),

  toggleShowOnMap: () => {
    const next = !get().showOnMap;
    set({ showOnMap: next });
    // Always fetch fresh when toggling on
    if (next) {
      get().fetchFriends();
    }
  },

  fetchFriends: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/v1/friends');
      const data = await res.json();
      if (res.ok && data.data) {
        console.log('[FriendStore] fetched', data.data.length, 'friends');
        set({ friends: data.data });
      }
    } catch {}
    finally { set({ loading: false }); }
  } }));
