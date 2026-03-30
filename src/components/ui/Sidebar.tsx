'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe, MapPin, Users, Zap, User, Plus, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { DomainBadge } from '@/components/gao/DomainBadge';

const TABS = [
  { href: '/world', label: 'World', Icon: Globe },
  { href: '/nearby', label: 'Nearby', Icon: MapPin },
  { href: '/circles', label: 'Circles', Icon: Users },
  { href: '/actions', label: 'Actions', Icon: Zap },
  { href: '/me', label: 'Profile', Icon: User },
] as const;

const STORAGE_KEY = 'gao-sidebar-collapsed';

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'true') setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem(STORAGE_KEY, String(!prev));
      return !prev;
    });
  };

  return (
    <aside
      className="hidden lg:flex shrink-0 flex-col h-full transition-all duration-200"
      style={{
        width: collapsed ? 68 : 260,
        background: 'rgba(10,11,15,0.95)',
        borderRight: '1px solid rgba(0,212,255,0.06)',
      }}
    >
      {/* Logo */}
      <div className={`flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-5'} py-5`}>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{
            background: 'linear-gradient(135deg, #00d4ff, #6366f1)',
            boxShadow: '0 0 15px rgba(0,212,255,0.3)',
          }}
        >
          G
        </div>
        {!collapsed && (
          <div>
            <span className="text-base font-bold text-white">Gao Social</span>
            <div className="mt-0.5">
              <DomainBadge />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${collapsed ? 'px-2' : 'px-3'} py-2 space-y-0.5`}>
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150`}
              style={{
                color: active ? '#00d4ff' : '#a3adc3',
                background: active ? 'rgba(0,212,255,0.08)' : 'transparent',
                borderLeft: active ? '3px solid #00d4ff' : '3px solid transparent',
                boxShadow: active ? 'inset 0 0 20px rgba(0,212,255,0.03)' : 'none',
              }}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.5} className="shrink-0" />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* Quick action */}
      <div className={collapsed ? 'px-2 py-4' : 'px-4 py-4'}>
        <Link
          href="/create"
          title={collapsed ? 'New Signal' : undefined}
          className={`btn-primary flex items-center justify-center ${collapsed ? '' : 'gap-2'} rounded-xl px-4 py-2.5 text-sm font-semibold w-full`}
        >
          <Plus size={16} className="shrink-0" />
          {!collapsed && 'New Signal'}
        </Link>
      </div>

      {/* Collapse toggle */}
      <div className={`${collapsed ? 'px-2' : 'px-4'} pb-2`}>
        <button
          onClick={toggle}
          className="flex items-center justify-center w-full rounded-xl py-2 transition-colors hover:bg-white/5"
          style={{ color: '#4a5068' }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="px-5 py-3 text-[10px] text-[#2d3548]" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          Gao Internet · L1 Workspace · Toii Labs
        </div>
      )}
    </aside>
  );
}
