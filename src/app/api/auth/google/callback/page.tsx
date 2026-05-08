'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

function GoogleCallbackInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    if (window.opener) {
      window.opener.postMessage(
        { type: 'google-auth', code, error, state },
        window.location.origin
      );
    } else {
      // Full-page fallback (popup blocked, eg. mobile). Preserve state through
      // the redirect so the GoogleRedirectHandler at the app root can validate
      // CSRF before exchanging the code.
      if (code) {
        const params = new URLSearchParams({ google_code: code });
        if (state) params.set('google_state', state);
        window.location.href = `/?${params.toString()}`;
      } else {
        window.location.href = '/';
      }
    }
  }, [searchParams]);

  return null;
}

export default function GoogleCallbackPage() {
  return (
    <div className="h-screen flex items-center justify-center" style={{ background: '#0a0b0f' }}>
      <div className="text-center">
        <div className="h-8 w-8 mx-auto mb-3 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#4a5068]">Completing sign in...</p>
      </div>
      <Suspense fallback={null}>
        <GoogleCallbackInner />
      </Suspense>
    </div>
  );
}
