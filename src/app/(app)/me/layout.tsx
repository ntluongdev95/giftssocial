'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

export default function MeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthed = useAuthStore((s) => s.isAuthed);

  useEffect(() => {
    if (!isAuthed) {
      router.replace('/world');
    }
  }, [isAuthed, router]);

  if (!isAuthed) return null;

  return <>{children}</>;
}
