'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import TrustLevelPill from '@/components/trust/TrustLevelPill';
import {
  MapPin,
  CalendarCheck,
  Bot,
  Bookmark,
  Shield,
  Settings,
  LogOut,
  UserCheck,
} from 'lucide-react';

const MENU_ITEMS = [
  { icon: UserCheck, label: 'Professional Profile', href: '/me/profile' },
  { icon: MapPin, label: 'My Signals', href: '#' },
  { icon: CalendarCheck, label: 'My Bookings', href: '#' },
  { icon: Bot, label: 'My Agents', href: '#' },
  { icon: Bookmark, label: 'Saved', href: '#' },
  { icon: Shield, label: 'Privacy', href: '#' },
  { icon: Settings, label: 'Settings', href: '#' },
];

export default function MePage() {
  const router = useRouter();
  const { user, isGuest, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/world');
  };

  return (
    <div className="h-full overflow-y-auto px-4 lg:px-8 pt-[env(safe-area-inset-top,12px)] lg:pt-6 max-w-2xl lg:mx-auto">
      {/* Aurora */}
      <div className="aurora-gradient absolute inset-x-0 top-0 h-48 pointer-events-none" />

      {/* Profile header */}
      <div className="relative flex flex-col items-center gap-3 py-6 text-center">
        {/* Avatar */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#111318] text-3xl text-[#4a5068]">
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            '👤'
          )}
        </div>

        <h1 className="text-xl font-bold text-[#f0f4ff]">
          {user?.display_name || (isGuest ? 'Guest' : 'Welcome')}
        </h1>

        {user?.gao_domain ? (
          <p className="text-sm text-[#00d4ff]">{user.gao_domain}</p>
        ) : (
          <button className="text-sm text-[#00d4ff]">
            Claim your Gao Domain →
          </button>
        )}

        <TrustLevelPill
          level={user?.trust_level || 'new'}
          score={user?.trust_score || 0}
        />

        {/* Stats */}
        <div className="flex gap-6 pt-2 text-center">
          <div>
            <p className="text-lg font-bold text-[#f0f4ff]">0</p>
            <p className="text-[10px] text-[#4a5068]">Proofs</p>
          </div>
          <div>
            <p className="text-lg font-bold text-[#f0f4ff]">0</p>
            <p className="text-[10px] text-[#4a5068]">Circles</p>
          </div>
          <div>
            <p className="text-lg font-bold text-[#f0f4ff]">0</p>
            <p className="text-[10px] text-[#4a5068]">Events</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div
        className="relative space-y-0.5 rounded-2xl overflow-hidden"
        style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
      >
        {MENU_ITEMS.map(({ icon: Icon, label, href }) => (
          <button
            key={label}
            onClick={() => href !== '#' && router.push(href)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-sm text-[#f0f4ff] transition-colors hover:bg-[rgba(0,212,255,0.04)] cursor-pointer"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
          >
            <Icon size={18} className="text-[#4a5068]" />
            {label}
          </button>
        ))}

        {/* Sign in / out */}
        {user || isGuest ? (
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#EF4444] transition-colors hover:bg-[#EF4444]/10"
          >
            <LogOut size={18} />
            {isGuest ? 'Exit Guest Mode' : 'Sign Out'}
          </button>
        ) : (
          <button
            onClick={() => router.push('/auth')}
            className="mt-4 w-full rounded-xl bg-[#00d4ff] py-3 text-sm font-semibold text-[#0a0b0f]"
          >
            Sign In
          </button>
        )}
      </div>
    </div>
  );
}
