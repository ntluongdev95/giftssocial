'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe, MapPin, Users, Zap, User, Plus, ScanFace, LogOut } from 'lucide-react';
import { DomainBadge } from '@/components/gao/DomainBadge';
import { useAuthStore } from '@/stores/auth-store';
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
  const [showAuth, setShowAuth] = useState(false);
  
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

          {/* Profile or Login */}
          {user  ? (
            <>
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
    </>
  );
}
