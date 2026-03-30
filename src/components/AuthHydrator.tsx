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

    const accessToken = getAccessTokenFromLocal();
    if (!accessToken) return;

    const refreshToken = getRefreshTokenFromLocal();
    setTokens(accessToken, refreshToken || undefined);

    getMe().then((user) => {
      if (user) {
        hydrateFromMe(user);
      }
    });
  }, [setTokens, hydrateFromMe, isAuthed]);

  return null;
}
