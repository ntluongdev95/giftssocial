'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import BottomNav from '@/components/ui/BottomNav';
import Sidebar from '@/components/ui/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, isGuest } = useAuthStore();

  useEffect(() => {
    if (!token && !isGuest) {
      const done = localStorage.getItem('gao_onboarding_done');
      if (done !== 'true') {
        router.replace('/onboarding');
      }
    }
  }, [token, isGuest, router]);

  return (
    <div className="flex h-full">
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar />

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        <main className="relative flex-1 overflow-hidden pb-[calc(64px+env(safe-area-inset-bottom,0px))] lg:pb-0">
          {children}
        </main>

        {/* Mobile bottom nav — hidden on desktop */}
        <div className="lg:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  );
}
