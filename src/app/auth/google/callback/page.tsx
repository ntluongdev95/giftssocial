'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function CallbackHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (window.opener) {
      window.opener.postMessage(
        { type: 'google-auth', code, error },
        window.location.origin
      );
    } else {
      if (code) {
        window.location.href = `/?google_code=${code}`;
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
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
