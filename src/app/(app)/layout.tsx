'use client';

import { SWRConfig } from 'swr';
import BottomNav from '@/components/ui/BottomNav';
import Sidebar from '@/components/ui/Sidebar';
import AuthHydrator from '@/components/AuthHydrator';
import { installCsrfInterceptor } from '@/lib/csrf-interceptor';

// Auto-inject CSRF token on all mutation fetch calls to /api/
installCsrfInterceptor();

export default function AppLayout({ children }: { children: React.ReactNode }) {

  return (
    // Global SWR config — the module-level cache already persists
    // across route navigations, so revisiting /world will render its
    // last-seen data INSTANTLY (no spinner) and only revalidate in the
    // background. Key knobs:
    //   • dedupingInterval 30s — collapses identical requests fired
    //     back-to-back (e.g. multiple mounts within 30s reuse the
    //     first in-flight request).
    //   • focusThrottleInterval 60s — re-focusing the tab won't spam
    //     endpoints; still refreshes but at most once per minute.
    //   • revalidateIfStale defaults to true so stale cache still
    //     triggers a background refetch on mount — user sees old
    //     data first, then it updates seamlessly.
    <SWRConfig
      value={{
        dedupingInterval: 30_000,
        focusThrottleInterval: 60_000,
        errorRetryCount: 2,
      }}
    >
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
    </SWRConfig>
  );
}
