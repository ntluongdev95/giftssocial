const isClient = typeof window !== 'undefined';

export const setAccessTokenToLocal = (token: string) => {
  if (isClient) {
    localStorage.setItem('access_token', token);
  }
};

export const getAccessTokenFromLocal = () => {
  if (isClient) {
    return localStorage.getItem('access_token');
  }
  return '';
};

export const deleteAccessTokenFromLocal = () => {
  if (isClient) {
    localStorage.removeItem('access_token');
  }
};

export const setRefreshTokenToLocal = (token: string) => {
  if (isClient) {
    localStorage.setItem('refresh_token', token);
  }
};

export const getRefreshTokenFromLocal = () => {
  if (isClient) {
    return localStorage.getItem('refresh_token');
  }
  return '';
};

export const deleteRefreshTokenFromLocal = () => {
  if (isClient) {
    localStorage.removeItem('refresh_token');
  }
};

export const clearLoginSessionStorage = () => {
  if (isClient) {
    sessionStorage.removeItem('show_terms_screen');
  }
};

export function getDeviceID(): string {
  if (typeof window !== 'undefined') {
    let id = localStorage.getItem('deviceID') ?? '';
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              const v = c === 'x' ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            });
      localStorage.setItem('deviceID', id);
    }
    return id;
  }
  return '';
}

export const getRandomUUID = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Passkey users storage
export interface SavedPasskeyUser {
  credentialId: string;
  rawId: string; // Base64URL encoded rawId
  userId: string; // user.id used when creating passkey
  username: string; // current username from server (can be updated)
  displayName?: string; // current display name from server (can be updated)
  passkeyUsername: string; // original username used when creating passkey (never changes)
  avatarUrl?: string;
  largeBlobSupported?: boolean;
  createdAt: string;
  lastLoginAt?: string; // last successful login time (for sorting recently used)
}

const PASSKEY_USERS_KEY = 'passkey_users';

export const getSavedPasskeyUsers = (): SavedPasskeyUser[] => {
  if (!isClient) return [];
  try {
    const data = localStorage.getItem(PASSKEY_USERS_KEY);
    const users: SavedPasskeyUser[] = data ? JSON.parse(data) : [];
    // Sort by lastLoginAt descending (most recent first), then by createdAt
    return users.sort((a, b) => {
      const aTime = a.lastLoginAt || a.createdAt;
      const bTime = b.lastLoginAt || b.createdAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  } catch {
    return [];
  }
};

export const savePasskeyUser = (user: Omit<SavedPasskeyUser, 'createdAt'>) => {
  if (!isClient) return;
  const users = getSavedPasskeyUsers();
  // Remove existing user with same credentialId or userId
  const filtered = users.filter(
    (u) => u.credentialId !== user.credentialId && u.userId !== user.userId,
  );
  filtered.push({ ...user, createdAt: new Date().toISOString() });
  localStorage.setItem(PASSKEY_USERS_KEY, JSON.stringify(filtered));
};

export const findPasskeyUserByCredentialId = (
  credentialId: string,
): SavedPasskeyUser | undefined => {
  return getSavedPasskeyUsers().find((u) => u.credentialId === credentialId);
};

export const findPasskeyUserByUserId = (userId: string): SavedPasskeyUser | undefined => {
  return getSavedPasskeyUsers().find((u) => u.userId === userId);
};

export const updatePasskeyUserLargeBlob = (credentialId: string, largeBlobSupported: boolean) => {
  if (!isClient) return;
  const users = getSavedPasskeyUsers();
  const updated = users.map((u) =>
    u.credentialId === credentialId ? { ...u, largeBlobSupported } : u,
  );
  localStorage.setItem(PASSKEY_USERS_KEY, JSON.stringify(updated));
};

// Update passkey user info (username, displayName, avatarUrl) from server after login
export const updatePasskeyUserInfo = (
  credentialId: string,
  info: { username?: string; displayName?: string; avatarUrl?: string },
) => {
  if (!isClient) return;
  const users = getSavedPasskeyUsers();
  const updated = users.map((u) =>
    u.credentialId === credentialId
      ? {
          ...u,
          username: info.username ?? u.username,
          displayName: info.displayName ?? u.displayName,
          avatarUrl: info.avatarUrl ?? u.avatarUrl,
        }
      : u,
  );
  localStorage.setItem(PASSKEY_USERS_KEY, JSON.stringify(updated));
};

// Update lastLoginAt when user logs in successfully
export const updatePasskeyUserLastLogin = (credentialId: string) => {
  if (!isClient) return;
  const users = getSavedPasskeyUsers();
  const updated = users.map((u) =>
    u.credentialId === credentialId ? { ...u, lastLoginAt: new Date().toISOString() } : u,
  );
  localStorage.setItem(PASSKEY_USERS_KEY, JSON.stringify(updated));
};

export const removePasskeyUser = (credentialId: string) => {
  if (!isClient) return;
  const users = getSavedPasskeyUsers();
  const filtered = users.filter((u) => u.credentialId !== credentialId);
  localStorage.setItem(PASSKEY_USERS_KEY, JSON.stringify(filtered));
};

export const clearAllPasskeyUsers = () => {
  if (isClient) {
    localStorage.removeItem(PASSKEY_USERS_KEY);
  }
};

// Onboarding completed storage
const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';

export const isOnboardingCompleted = (): boolean => {
  if (!isClient) return false;
  return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true';
};

export const setOnboardingCompleted = (completed: boolean = true) => {
  if (isClient) {
    if (completed) {
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } else {
      localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    }
  }
};