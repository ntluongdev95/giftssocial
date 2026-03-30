'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe, MapPin, Users, Zap, User, Search, Plus } from 'lucide-react';
import { DomainBadge } from '@/components/gao/DomainBadge';

const TABS = [
  { href: '/world', label: 'World', Icon: Globe },
  { href: '/nearby', label: 'Nearby', Icon: MapPin },
  { href: '/circles', label: 'Circles', Icon: Users },
  { href: '/actions', label: 'Actions', Icon: Zap },
  { href: '/me', label: 'Profile', Icon: User },
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden lg:flex w-[260px] shrink-0 flex-col h-full"
      style={{
        background: 'rgba(10,11,15,0.95)',
        borderRight: '1px solid rgba(0,212,255,0.06)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{
            background: 'linear-gradient(135deg, #00d4ff, #6366f1)',
            boxShadow: '0 0 15px rgba(0,212,255,0.3)',
          }}
        >
          G
        </div>
        <div>
          <span className="text-base font-bold text-white">Gao Social</span>
          <div className="mt-0.5">
            <DomainBadge />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 mb-2">
        <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: '#4a5068' }}
        >
          <Search size={15} />
          <span>Search...</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150"
              style={{
                color: active ? '#00d4ff' : '#a3adc3',
                background: active ? 'rgba(0,212,255,0.08)' : 'transparent',
                borderLeft: active ? '3px solid #00d4ff' : '3px solid transparent',
                boxShadow: active ? 'inset 0 0 20px rgba(0,212,255,0.03)' : 'none',
              }}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.5} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Quick action */}
      <div className="px-4 py-4">
        <Link
          href="/create"
          className="btn-primary flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold w-full"
        >
          <Plus size={16} />
          New Signal
        </Link>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 text-[10px] text-[#2d3548]" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
        Gao Internet · L1 Workspace · Toii Labs
      </div>
    </aside>
  );
}
