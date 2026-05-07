/**
 * Gao ID — UI state store (zustand, no persist).
 *
 * Mirrors the auth state machine from
 * docs/social-web-gao-id-auth-plan.md §9. All tokens are kept in memory
 * only; nothing here is written to localStorage / sessionStorage /
 * IndexedDB. Bootstrap (Google/Apple) auth is independent and lives in
 * `useAuthStore` — the two layers must not be conflated.
 */

import { create } from 'zustand';

import { isGaoIdEnabled } from '@/lib/gao-id/config';
import type {
  CanonicalProfile,
  CompositeMe,
  VerifyResponse,
} from '@/lib/gao-id/client';

export type GaoIdStatus =
  | 'disabled'
  | 'anonymous'
  | 'wallet_connected_not_verified'
  | 'authenticating'
  | 'authenticated'
  | 'profile_missing'
  | 'profile_active'
  | 'error';

export interface GaoIdState {
  status: GaoIdStatus;
  /** ES256 access token from the issuer. Memory only. */
  accessToken: string | null;
  /** Legacy CSRF token returned by the issuer; kept for forward-compat. Memory only. */
  csrfToken: string | null;
  /** Absolute epoch-ms at which the access token expires. */
  expiresAt: number;
  /** Canonical Gao identity id (`gaoid_…`). */
  rootId: string | null;
  walletAddress: string | null;
  chainId: number | null;
  meComposite: CompositeMe | null;
  profile: CanonicalProfile | null;
  /** Last error surfaced to the UI; cleared on any successful action. */
  error: string | null;

  // Actions
  setFromVerifyResponse: (verify: VerifyResponse) => void;
  setCompositeMe: (me: CompositeMe) => void;
  clear: () => void;
  setError: (err: string | null) => void;
}

type Resettable = Omit<GaoIdState, 'setFromVerifyResponse' | 'setCompositeMe' | 'clear' | 'setError'>;

function initialState(): Resettable {
  return {
    status: isGaoIdEnabled() ? 'anonymous' : 'disabled',
    accessToken: null,
    csrfToken: null,
    expiresAt: 0,
    rootId: null,
    walletAddress: null,
    chainId: null,
    meComposite: null,
    profile: null,
    error: null,
  };
}

function statusFromProfile(profile: CanonicalProfile | null): GaoIdStatus {
  if (!profile) return 'profile_missing';
  return profile.displayName ? 'profile_active' : 'profile_missing';
}

export const useGaoIdStore = create<GaoIdState>((set) => ({
  ...initialState(),

  setFromVerifyResponse: (v) =>
    set({
      status: statusFromProfile(v.user.profile),
      accessToken: v.accessToken,
      csrfToken: v.csrfToken,
      expiresAt: Date.now() + v.expiresIn * 1000,
      rootId: v.user.rootId,
      walletAddress: v.user.walletAddress,
      chainId: v.user.chainId,
      profile: v.user.profile,
      error: null,
    }),

  setCompositeMe: (me) =>
    set((s) => ({
      meComposite: me,
      profile: (me.profile ?? s.profile) as CanonicalProfile | null,
      status: statusFromProfile((me.profile ?? s.profile) as CanonicalProfile | null),
    })),

  clear: () => set(initialState()),

  setError: (err) =>
    set((s) => ({
      error: err,
      status: err ? 'error' : s.status === 'error' ? 'anonymous' : s.status,
    })),
}));
