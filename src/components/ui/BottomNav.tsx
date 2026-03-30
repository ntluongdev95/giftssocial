'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Globe, MapPin, Users, Zap, User, ScanFace } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import AuthPopup from '@/components/ui/AuthPopup';

const TABS = [
  { href: '/world', label: 'World', Icon: Globe },
  { href: '/nearby', label: 'Nearby', Icon: MapPin },
  { href: '/circles', label: 'Circles', Icon: Users },
  { href: '/actions', label: 'Actions', Icon: Zap },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const { token, isGuest } = useAuthStore();
  const isLoggedIn = !!token && !isGuest;
  const [showAuth, setShowAuth] = useState(false);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom,0px)]"
      style={{
        background: 'rgba(10,11,15,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(0,212,255,0.06)',
      }}
    >
      <div className="flex h-16 items-center justify-around">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + '/');
          return (
            <Link key={href} href={href} className="flex flex-1 justify-center">
              <motion.div
                whileTap={{ scale: 0.92 }}
                className="flex flex-col items-center gap-0.5 py-1"
                style={{ color: active ? '#00d4ff' : '#4a5068' }}
              >
                <span
                  className="mb-0.5 h-1 w-1 rounded-full transition-all duration-200"
                  style={{
                    background: active ? '#00d4ff' : 'transparent',
                    boxShadow: active ? '0 0 6px rgba(0,212,255,0.6)' : 'none',
                  }}
                />
                <Icon size={24} strokeWidth={active ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">{label}</span>
              </motion.div>
            </Link>
          );
        })}

        {/* Profile / Login */}
        {isLoggedIn ? (
          <Link href="/me" className="flex flex-1 justify-center">
            <motion.div
              whileTap={{ scale: 0.92 }}
              className="flex flex-col items-center gap-0.5 py-1"
              style={{ color: pathname === '/me' ? '#00d4ff' : '#4a5068' }}
            >
              <span
                className="mb-0.5 h-1 w-1 rounded-full transition-all duration-200"
                style={{
                  background: pathname === '/me' ? '#00d4ff' : 'transparent',
                  boxShadow: pathname === '/me' ? '0 0 6px rgba(0,212,255,0.6)' : 'none',
                }}
              />
              <User size={24} strokeWidth={pathname === '/me' ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">Me</span>
            </motion.div>
          </Link>
        ) : (
          <button onClick={() => setShowAuth(true)} className="flex flex-1 justify-center">
            <motion.div
              whileTap={{ scale: 0.92 }}
              className="flex flex-col items-center gap-0.5 py-1"
              style={{ color: '#4a5068' }}
            >
              <span className="mb-0.5 h-1 w-1 rounded-full" />
              <ScanFace size={24} strokeWidth={1.5} />
              <span className="text-[10px] font-medium">Login</span>
            </motion.div>
          </button>
        )}
      </div>
      <AuthPopup open={showAuth} onClose={() => setShowAuth(false)} />
    </nav>
  );
}
