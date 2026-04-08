'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth-store';

export default function AuthHydrator() {
  const hydrated = useRef(false);
  const setTokens = useAuthStore((s) => s.setTokens);
  const hydrateFromMe = useAuthStore((s) => s.hydrateFromMe);
  const isAuthed = useAuthStore((s) => s.isAuthed);

  useEffect(() => {
    if (hydrated.current || isAuthed) return;
    hydrated.current = true;

    fetch('/api/v1/auth/session', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(data => {
        if (!data.data?.id) return;
        hydrateFromMe(data);
        if (data.access_token) {
          setTokens(data.access_token, data.refresh_token ?? undefined);
        }
      })
      .catch(() => {});
  }, [setTokens, hydrateFromMe, isAuthed]);

  return null;
}
