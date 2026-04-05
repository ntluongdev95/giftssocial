'use client';

import { useEffect, useRef } from 'react';
import { getAccessTokenFromLocal, getRefreshTokenFromLocal } from '@/lib/clients/storage.helper';
import { getMe } from '@/app/api/calls/apiUser';
import { useAuthStore } from '@/stores/auth-store';

export default function AuthHydrator() {
  const hydrated = useRef(false);
  const setTokens = useAuthStore((s) => s.setTokens);
  const hydrateFromMe = useAuthStore((s) => s.hydrateFromMe);
  const isAuthed = useAuthStore((s) => s.isAuthed);

  useEffect(() => {
    if (hydrated.current || isAuthed) return;
    hydrated.current = true;

    // Primary: cookie-based session (works after refresh without localStorage)
    fetch('/api/v1/auth/session', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(data => {
        if (data.data?.id) {
          hydrateFromMe(data);

          // Also sync tokens to localStorage for external API clients that need Authorization header
          const accessToken = getAccessTokenFromLocal();
          if (accessToken) {
            const refreshToken = getRefreshTokenFromLocal();
            setTokens(accessToken, refreshToken || undefined);
          }
          return;
        }

        // Fallback: try localStorage tokens (for external passkey auth flow)
        const accessToken = getAccessTokenFromLocal();
        if (!accessToken) return;

        const refreshToken = getRefreshTokenFromLocal();
        setTokens(accessToken, refreshToken || undefined);

        getMe().then((user) => {
          if (user) {
            hydrateFromMe(user);
            // Sync to local DB
            fetch('/api/v1/users/sync', {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}` },
            }).then(() =>
              fetch('/api/v1/users/me', { headers: { Authorization: `Bearer ${accessToken}` } })
                .then(r => r.json())
                .then(local => { if (local.data?.display_name || local.data?.avatar_url) hydrateFromMe(local); })
            ).catch(() => {});
          }
        });
      })
      .catch(() => {
        // Session endpoint failed — fall back to localStorage
        const accessToken = getAccessTokenFromLocal();
        if (!accessToken) return;
        const refreshToken = getRefreshTokenFromLocal();
        setTokens(accessToken, refreshToken || undefined);
        getMe().then((user) => { if (user) hydrateFromMe(user); });
      });
  }, [setTokens, hydrateFromMe, isAuthed]);

  return null;
}
