'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

/** Auth gate for `/me/*` routes. Redirects unauthenticated users to
 *  `/world`, but only AFTER the first session check has completed. Without
 *  the `hasHydrated` guard, a hard refresh on `/me/gifts` reads the
 *  initial in-memory `isAuthed=false`, bounces the user to `/world`, and
 *  AuthHydrator's response arrives too late. */
export default function MeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthed = useAuthStore((s) => s.isAuthed);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  useEffect(() => {
    if (hasHydrated && !isAuthed) {
      router.replace('/world');
    }
  }, [hasHydrated, isAuthed, router]);

  // Still checking → render nothing (splash on parent covers the gap).
  if (!hasHydrated) return null;
  if (!isAuthed) return null;

  return <>{children}</>;
}
