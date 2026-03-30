'use client';

import BottomNav from '@/components/ui/BottomNav';
import Sidebar from '@/components/ui/Sidebar';
import AuthHydrator from '@/components/AuthHydrator';

export default function AppLayout({ children }: { children: React.ReactNode }) {

  return (
    <div className="flex h-full">
      <AuthHydrator />
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
