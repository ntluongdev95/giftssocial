
import { UserInfo } from '@/types/auth-type';
import { create } from 'zustand';

export interface AuthState {
  user: UserInfo | null;
  isAuthed: boolean;
  accessToken: string | null;
  refreshToken: string | null;

  // Actions
  setUser: (user: UserInfo | null) => void;
  setTokens: (accessToken: string, refreshToken?: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hydrateFromMe: (raw: any) => void;
  logout: () => void;
}

/**
 * Auth store - in-memory only, no localStorage persistence
 * Tokens are stored separately in localStorage for API calls
 * This store is for UI state only
 */
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthed: false,
  accessToken: null,
  refreshToken: null,

  setUser: (user) => set({ user, isAuthed: !!user }),

  setTokens: (accessToken, refreshToken) =>
    set({ accessToken, refreshToken: refreshToken ?? null }),

  hydrateFromMe: (raw) => {
    const src = raw?.data ?? raw ?? {};
    const user: UserInfo = {
      id: src.id ?? '',
      username: src.username ?? '',
      email: src.email ?? null,
      phoneNumber: src.phoneNumber ?? null,
      firstName: src.first_name ?? '',
      lastName: src.last_name ?? '',
      fullName: src.full_name || src.display_name || '',
      avatarUrl: src.avatar_url ?? '',
      avatarKey: src.avatar_key ?? '',
      backgroundUrl: src.background_url ?? '',
      backgroundKey: src.background_key ?? '',
      bio: src.bio ?? '',
      address: src.address ?? '',
      privateAccount: src.private_account ?? false,
      isVerified: src.is_verified ?? false,
      walletAddress: src.wallet_address ?? '',
      role: src.role ?? 'normal',
      status: src.status ?? 'active',
      appTypes: src.app_types ?? [],
      createdAt: src.created_at ?? '',
      updatedAt: src.updated_at ?? '',
      followersCount: src.followers_count ?? 0,
      followingCount: src.following_count ?? 0,
      friendsCount: src.friends_count ?? 0,
    };
    set({ user, isAuthed: true });
  },

  logout: () => {
    // Reset balance store to stop auto-refresh interval
    set({
      user: null,
      isAuthed: false,
      accessToken: null,
      refreshToken: null,
    });
  },
}));

// Selectors
export const selectUser = (state: AuthState) => state.user;
export const selectIsAuthed = (state: AuthState) => state.isAuthed;
export const selectUserId = (state: AuthState) => state.user?.id;
export const selectUsername = (state: AuthState) => state.user?.username;