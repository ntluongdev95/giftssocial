'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe, MapPin, Users, Zap, User, Plus, ScanFace, LogOut, Bell, Radio } from 'lucide-react';
import dynamic from 'next/dynamic';
const LivePanel = dynamic(() => import('@/components/live/LivePanel'), { ssr: false });
import { DomainBadge } from '@/components/gao/DomainBadge';
import { useAuthStore } from '@/stores/auth-store';
import { useNotifications } from '@/hooks/useNotifications';
import AuthPopup from '@/components/ui/AuthPopup';
import { logoutApi } from '@/app/api/calls/apiAuth';
import { clearLoginSessionStorage, deleteAccessTokenFromLocal, deleteRefreshTokenFromLocal } from '@/lib/clients/storage.helper';

const TABS = [
  { href: '/world', label: 'World', Icon: Globe },
  { href: '/nearby', label: 'Nearby', Icon: MapPin },
  { href: '/circles', label: 'Circles', Icon: Users },
  { href: '/actions', label: 'Actions', Icon: Zap },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const logoutStorage = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const hasCookie = useSyncExternalStore(
    (cb) => { const id = setInterval(cb, 1000); return () => clearInterval(id); },
    () => document.cookie.includes('gao_logged_in=1'),
    () => false // server snapshot — always false to match SSR
  );
  const isLoggedIn = !!user || hasCookie;
  const { unreadCount } = useNotifications();
  const [showAuth, setShowAuth] = useState(false);
  const [showLive, setShowLive] = useState(false);

  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    // 1. Server-side: revoke sessions + clear httpOnly cookies
    try {
      await Promise.race([
        Promise.all([
          fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' }),
          logoutApi(),
        ]),
        new Promise(r => setTimeout(r, 3000)), // 3s timeout — don't hang forever
      ]);
    } catch { /* proceed with local cleanup regardless */ }

    // 2. Local cleanup — always runs even if server fails
    document.cookie = 'gao_logged_in=; Max-Age=0; path=/';
    document.cookie = 'gao_csrf=; Max-Age=0; path=/';
    deleteAccessTokenFromLocal();
    deleteRefreshTokenFromLocal();
    clearLoginSessionStorage();
    logoutStorage();
    setLoggingOut(false);
  };

  return (
    <>
      {/* Single aside — collapsed on lg, expanded on xl */}
      <aside
        className="hidden lg:flex shrink-0 flex-col h-full lg:w-[68px] lg:items-center lg:py-4 xl:w-[260px] xl:items-stretch xl:py-0"
        style={{
          background: 'rgba(10,11,15,0.95)',
          borderRight: '1px solid rgba(0,212,255,0.06)',
        }}
      >
        {/* Logo — collapsed */}
        <div className="lg:block xl:hidden mb-4">
          <img src="/images/gao-logo.png" alt="Gao" width={32} height={32} />
        </div>
        {/* Logo — expanded */}
        <div className="hidden xl:flex items-center gap-3 px-5 py-5">
          <img src="/images/gao-logo.png" alt="Gao" width={36} height={36} className="shrink-0" />
          <div>
            <span className="text-base font-bold text-white">Gao Social</span>
            <div className="mt-0.5">
              <DomainBadge />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 lg:flex lg:flex-col lg:items-center lg:gap-1 lg:w-full lg:px-2 xl:block xl:px-3 xl:py-2 xl:space-y-0.5">
          {TABS.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname?.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className="flex items-center transition-colors cursor-pointer lg:justify-center lg:w-11 lg:h-11 lg:rounded-xl xl:justify-start xl:w-auto xl:h-auto xl:gap-3 xl:rounded-xl xl:px-3 xl:py-2.5 xl:text-sm xl:font-medium"
                style={{
                  color: active ? '#00d4ff' : '#a3adc3',
                  background: active ? 'rgba(0,212,255,0.08)' : 'transparent',
                  borderLeft: active ? '3px solid #00d4ff' : '3px solid transparent',
                  boxShadow: active ? 'inset 0 0 20px rgba(0,212,255,0.03)' : 'none',
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.5} className="shrink-0 lg:w-5 lg:h-5 xl:w-[18px] xl:h-[18px]" />
                <span className="hidden xl:inline">{label}</span>
              </Link>
            );
          })}

          {/* Live */}
          <button
            onClick={() => setShowLive(true)}
            title="Live"
            className="flex items-center transition-colors cursor-pointer w-full lg:justify-center lg:w-11 lg:h-11 lg:rounded-xl xl:justify-start xl:w-auto xl:h-auto xl:gap-3 xl:rounded-xl xl:px-3 xl:py-2.5 xl:text-sm xl:font-medium relative"
            style={{
              color: showLive ? '#f87171' : '#a3adc3',
              background: showLive ? 'rgba(239,68,68,0.08)' : 'transparent',
              borderLeft: showLive ? '3px solid #f87171' : '3px solid transparent',
            }}
          >
            <Radio size={18} strokeWidth={1.5} className={`shrink-0 ${showLive ? 'animate-pulse' : ''}`} />
            <span className="hidden xl:inline">Live</span>
            <span className="lg:absolute lg:top-2 lg:right-2 xl:static xl:ml-auto h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          </button>

          {/* Notifications */}
          {isLoggedIn && (
            <Link
              href="/notifications"
              title="Notifications"
              className="flex items-center transition-colors cursor-pointer lg:justify-center lg:w-11 lg:h-11 lg:rounded-xl xl:justify-start xl:w-auto xl:h-auto xl:gap-3 xl:rounded-xl xl:px-3 xl:py-2.5 xl:text-sm xl:font-medium"
              style={{
                color: pathname === '/notifications' ? '#00d4ff' : '#a3adc3',
                background: pathname === '/notifications' ? 'rgba(0,212,255,0.08)' : 'transparent',
                borderLeft: pathname === '/notifications' ? '3px solid #00d4ff' : '3px solid transparent',
              }}
            >
              <div className={`relative shrink-0 ${unreadCount > 0 ? 'animate-[bellShake_0.5s_ease-in-out_infinite_2s]' : ''}`}>
                <Bell size={18} strokeWidth={pathname === '/notifications' ? 2.2 : 1.5} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 h-4 min-w-4 rounded-full flex items-center justify-center text-[8px] font-bold px-0.5" style={{ background: '#EF4444', color: 'white' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <span className="hidden xl:inline">Notifications</span>
            </Link>
          )}

          {/* Profile / Login */}
          {isLoggedIn ? (
            <>
              <Link
                href="/me"
                title="Profile"
                className="flex items-center transition-colors cursor-pointer lg:justify-center lg:w-11 lg:h-11 lg:rounded-xl xl:justify-start xl:w-auto xl:h-auto xl:gap-3 xl:rounded-xl xl:px-3 xl:py-2.5 xl:text-sm xl:font-medium"
                style={{
                  color: pathname === '/me' ? '#00d4ff' : '#a3adc3',
                  background: pathname === '/me' ? 'rgba(0,212,255,0.08)' : 'transparent',
                  borderLeft: pathname === '/me' ? '3px solid #00d4ff' : '3px solid transparent',
                }}
              >
                <User size={18} strokeWidth={pathname === '/me' ? 2.2 : 1.5} className="shrink-0" />
                <span className="hidden xl:inline">Profile</span>
              </Link>
              <button
                onClick={handleLogout}
                title="Logout"
                className="flex items-center transition-colors cursor-pointer w-full lg:justify-center lg:w-11 lg:h-11 lg:rounded-xl xl:justify-start xl:w-auto xl:h-auto xl:gap-3 xl:rounded-xl xl:px-3 xl:py-2.5 xl:text-sm xl:font-medium"
                style={{ color: '#a3adc3', borderLeft: '3px solid transparent' }}
              >
                <LogOut size={18} strokeWidth={1.5} className="shrink-0" />
                <span className="hidden xl:inline">Logout</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              title="Login"
              className="flex items-center transition-colors cursor-pointer w-full lg:justify-center lg:w-11 lg:h-11 lg:rounded-xl xl:justify-start xl:w-auto xl:h-auto xl:gap-3 xl:rounded-xl xl:px-3 xl:py-2.5 xl:text-sm xl:font-medium"
              style={{ color: '#a3adc3', borderLeft: '3px solid transparent' }}
            >
              <ScanFace size={18} strokeWidth={1.5} className="shrink-0" />
              <span className="hidden xl:inline">Login / Signup</span>
            </button>
          )}
        </nav>

        {/* New Signal */}
        <div className="lg:mt-2 lg:px-2 lg:w-full xl:px-4 xl:py-4">
          <Link
            href="/create"
            title="New Signal"
            className="btn-primary flex items-center justify-center rounded-xl cursor-pointer lg:w-full lg:h-11 xl:gap-2 xl:px-4 xl:py-2.5 xl:text-sm xl:font-semibold"
          >
            <Plus size={16} className="shrink-0" />
            <span className="hidden xl:inline">New Signal</span>
          </Link>
        </div>

        {/* Footer — expanded only */}
        <div className="hidden xl:block px-5 py-3 text-[10px] text-[#2d3548]" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          Gao Internet · L1 Workspace · Toii Labs
        </div>
      </aside>

      <AuthPopup open={showAuth} onClose={() => setShowAuth(false)} />
      {showLive && <LivePanel isOpen={showLive} onClose={() => setShowLive(false)} />}
    </>
  );
}
