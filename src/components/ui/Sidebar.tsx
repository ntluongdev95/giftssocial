'use client';

import { useState } from 'react';
import Image from 'next/image';
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
  const { unreadCount } = useNotifications();
  const [showAuth, setShowAuth] = useState(false);
  const [showLive, setShowLive] = useState(false);
  
  const handleLogout = async () => {
    try {
      await logoutApi();
    } finally {
      deleteAccessTokenFromLocal();
      deleteRefreshTokenFromLocal();
      clearLoginSessionStorage();
      logoutStorage();
      
    }
  };
  return (
    <>
      <aside
        className="hidden lg:flex shrink-0 flex-col h-full"
        style={{
          width: 260,
          background: 'rgba(10,11,15,0.95)',
          borderRight: '1px solid rgba(0,212,255,0.06)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5">
          <Image src="/images/gao-logo.png" alt="Gao" width={36} height={36} className="shrink-0" />
          <div>
            <span className="text-base font-bold text-white">Gao Social</span>
            <div className="mt-0.5">
              <DomainBadge />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {TABS.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname?.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150"
                style={{
                  color: active ? '#00d4ff' : '#a3adc3',
                  background: active ? 'rgba(0,212,255,0.08)' : 'transparent',
                  borderLeft: active ? '3px solid #00d4ff' : '3px solid transparent',
                  boxShadow: active ? 'inset 0 0 20px rgba(0,212,255,0.03)' : 'none',
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.5} className="shrink-0" />
                {label}
              </Link>
            );
          })}

          {/* Live */}
          <button
            onClick={() => setShowLive(true)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 w-full cursor-pointer"
            style={{ color: showLive ? '#f87171' : '#a3adc3', background: showLive ? 'rgba(239,68,68,0.08)' : 'transparent', borderLeft: showLive ? '3px solid #f87171' : '3px solid transparent' }}
          >
            <Radio size={18} strokeWidth={1.5} className={`shrink-0 ${showLive ? 'animate-pulse' : ''}`} />
            Live
            <span className="ml-auto h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          </button>

          {/* Profile or Login */}
          {user ? (
            <>
            <Link
              href="/notifications"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150"
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
              Notifications
            </Link>
            <Link
              href="/me"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150"
              style={{
                color: pathname === '/me' ? '#00d4ff' : '#a3adc3',
                background: pathname === '/me' ? 'rgba(0,212,255,0.08)' : 'transparent',
                borderLeft: pathname === '/me' ? '3px solid #00d4ff' : '3px solid transparent',
                boxShadow: pathname === '/me' ? 'inset 0 0 20px rgba(0,212,255,0.03)' : 'none',
              }}
            >
              <User size={18} strokeWidth={pathname === '/me' ? 2.2 : 1.5} className="shrink-0" />
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 w-full cursor-pointer"
              style={{ color: '#a3adc3', borderLeft: '3px solid transparent' }}
            >
              <LogOut size={18} strokeWidth={1.5} className="shrink-0" />
              Logout
            </button>
            </>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 w-full"
              style={{ color: '#a3adc3', borderLeft: '3px solid transparent' }}
            >
              <ScanFace size={18} strokeWidth={1.5} className="shrink-0" />
              Login / Signup
            </button>
          )}
        </nav>

        {/* Quick action */}
        <div className="px-4 py-4">
          <Link
            href="/create"
            className="btn-primary flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold w-full"
          >
            <Plus size={16} className="shrink-0" />
            New Signal
          </Link>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 text-[10px] text-[#2d3548]" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          Gao Internet · L1 Workspace · Toii Labs
        </div>
      </aside>

      <AuthPopup open={showAuth} onClose={() => setShowAuth(false)} />
      {showLive && <LivePanel isOpen={showLive} onClose={() => setShowLive(false)} />}
    </>
  );
}
