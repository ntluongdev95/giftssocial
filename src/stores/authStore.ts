import { create } from 'zustand';
import type { User } from '@/types';

interface AuthStore {
  user: User | null;
  token: string | null;
  isGuest: boolean;
  setUser: (user: User, token: string) => void;
  setGuest: (token: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: null,
  isGuest: false,

  setUser: (user, token) =>
    set({ user, token, isGuest: false }),

  setGuest: (token) =>
    set({ user: null, token, isGuest: true }),

  logout: () =>
    set({ user: null, token: null, isGuest: false }),

  isAuthenticated: () => {
    const { user, token } = get();
    return user !== null && token !== null;
  },
}));
