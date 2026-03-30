import { create } from 'zustand';

export interface AccountInfo {
  id: string;
  name: string;
  email: string;
  isVerified: boolean;
  kybStatus?: 'pending' | 'rejected' | 'complete';
  status?: 'pending' | 'rejected' | 'complete';
}

interface AccountState {
  account: AccountInfo | null;
  isLoading: boolean;
  isLoaded: boolean;
  hasAccount: boolean;

  setAccount: (account: AccountInfo | null) => void;
  setLoading: (loading: boolean) => void;
  setLoaded: (loaded: boolean) => void;
  clear: () => void;
}

export const useAccountStore = create<AccountState>()((set) => ({
  account: null,
  isLoading: false,
  isLoaded: false,
  hasAccount: false,

  setAccount: (account) =>
    set({
      account,
      hasAccount: !!account,
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setLoaded: (isLoaded) => set({ isLoaded }),

  clear: () =>
    set({
      account: null,
      isLoading: false,
      isLoaded: false,
      hasAccount: false,
    }),
}));

// Selectors
export const selectAccount = (state: AccountState) => state.account;
export const selectHasAccount = (state: AccountState) => state.hasAccount;