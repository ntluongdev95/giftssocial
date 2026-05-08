'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAccountStore } from '@/stores/account-store';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Handles the *full-page* Google OAuth fallback. When `window.open()` is
 * blocked (typical on mobile), the popup flow degrades to a top-level redirect
 * to Google. Google sends the user back to /api/auth/google/callback, which
 * — finding no `window.opener` — redirects to `/?google_code=…&google_state=…`.
 *
 * This component watches for those query params on mount, validates the CSRF
 * state against sessionStorage, exchanges the code for JWT tokens, hydrates
 * the user, and scrubs the params from the URL. It's mounted once at the root
 * layout so any landing path picks the auth back up.
 */
export default function GoogleRedirectHandler() {
  const setTokens = useAuthStore((s) => s.setTokens);
  const hydrateFromMe = useAuthStore((s) => s.hydrateFromMe);
  const setAccount = useAccountStore((s) => s.setAccount);
  const setAccountLoaded = useAccountStore((s) => s.setLoaded);
  // Guard against React strict-mode double-invoke + repeat mounts. The OAuth
  // code is single-use; running the exchange twice yields an error toast.
  const exchangedRef = useRef(false);

  useEffect(() => {
    if (exchangedRef.current) return;
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const code = url.searchParams.get('google_code');
    if (!code) return;

    const state = url.searchParams.get('google_state');
    const expectedState = sessionStorage.getItem('gao_google_state');

    // Scrub the params from the URL immediately — even if exchange fails we
    // don't want a refresh to retry with a now-spent code.
    const cleanUrl = `${url.pathname}${url.hash || ''}`;
    window.history.replaceState({}, '', cleanUrl);
    exchangedRef.current = true;

    if (!state || !expectedState || state !== expectedState) {
      console.warn('[Auth] Google fallback CSRF state mismatch — ignoring');
      sessionStorage.removeItem('gao_google_state');
      return;
    }
    sessionStorage.removeItem('gao_google_state');

    (async () => {
      try {
        const redirectUri = `${window.location.origin}/api/auth/google/callback`;
        const res = await fetch('/api/v1/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: redirectUri }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message || 'Google login failed');
        }
        const data = await res.json();
        if (data.is_new_user) toast.success('Welcome to Gao!');
        setTokens(data.access_token, data.refresh_token);

        // Hydrate user from cookie session (matches AuthPopup's success path).
        try {
          const sessionRes = await fetch('/api/v1/auth/session', { credentials: 'same-origin' });
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            if (sessionData?.data) {
              hydrateFromMe(sessionData);
              try {
                localStorage.setItem('gao_last_user', JSON.stringify({
                  display_name: sessionData.data.display_name || sessionData.data.fullName || sessionData.data.username || '',
                  avatar_url: sessionData.data.avatar_url || sessionData.data.avatarUrl || '',
                }));
              } catch { /* ignore */ }
            }
          }
        } catch { /* ignore — token is already set, hydration is best-effort */ }

        setAccount(null);
        setAccountLoaded(true);
        toast.success('Login successful!');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Google login failed');
      }
    })();
  }, [setTokens, hydrateFromMe, setAccount, setAccountLoaded]);

  return null;
}
