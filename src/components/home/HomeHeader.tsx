'use client';

// Header for the LoveGift home page ("/") — brand mark on the left,
// Gift / Me (or Login) on the right. Reuses the same auth pattern as
// Sidebar.tsx (useAuthStore + gao_logged_in cookie fallback + AuthPopup)
// so logging in/out behaves identically everywhere in the app.

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Compass, Gift, User, ScanFace } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import AuthPopup from '@/components/ui/AuthPopup';

export default function HomeHeader() {
  const user = useAuthStore((s) => s.user);
  const hasCookie = useSyncExternalStore(
    (cb) => { const id = setInterval(cb, 1000); return () => clearInterval(id); },
    () => document.cookie.includes('gao_logged_in=1'),
    () => false // server snapshot — always false to match SSR
  );
  const isLoggedIn = !!user || hasCookie;
  const [showAuth, setShowAuth] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 flex items-center justify-between px-5 py-4" style={{ background: 'rgba(10,11,15,0.75)', backdropFilter: 'blur(10px)' }}>
        <Link href="/" className="text-base font-bold tracking-tight text-white">
          LoVi
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/world"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-white/80 cursor-pointer transition-colors hover:text-white"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <Compass size={15} />
            <span className="hidden sm:inline">Khám phá</span>
          </Link>
          <Link
            href="/gift-cards/market"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-white/80 cursor-pointer transition-colors hover:text-white"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <Gift size={15} />
            <span className="hidden sm:inline">Gift</span>
          </Link>
          {isLoggedIn ? (
            <Link
              href="/me"
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-white/80 cursor-pointer transition-colors hover:text-white"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <User size={15} />
              <span className="hidden sm:inline">Me</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setShowAuth(true)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold cursor-pointer transition-colors"
              style={{ background: 'linear-gradient(135deg, #ff6f9c, #ff3d71)', color: '#fff' }}
            >
              <ScanFace size={15} />
              <span>Login</span>
            </button>
          )}
        </nav>
      </header>
      <AuthPopup open={showAuth} onClose={() => setShowAuth(false)} />
    </>
  );
}
