'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Globe, MapPin, Users, Zap, User, ScanFace, Bell, Radio } from 'lucide-react';
import dynamic from 'next/dynamic';
const LivePanel = dynamic(() => import('@/components/live/LivePanel'), { ssr: false });
import { useAuthStore } from '@/stores/auth-store';
import { useNotifications } from '@/hooks/useNotifications';
import AuthPopup from '@/components/ui/AuthPopup';

const TABS = [
  { href: '/world', label: 'World', Icon: Globe },
  { href: '/nearby', label: 'Nearby', Icon: MapPin },
  { href: '/circles', label: 'Circles', Icon: Users },
  { href: '/actions', label: 'Actions', Icon: Zap },
  { href: '/notifications', label: 'Noti', Icon: Bell },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const isLoggedIn = useAuthStore((s) => s.isAuthed);
  const { unreadCount } = useNotifications();
  const [showAuth, setShowAuth] = useState(false);
  const [showLive, setShowLive] = useState(false);

  return (
    <>
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
                <div className={`relative ${href === '/notifications' && unreadCount > 0 ? 'animate-[bellShake_0.5s_ease-in-out_infinite_2s]' : ''}`}>
                  <Icon size={24} strokeWidth={active ? 2.5 : 1.5} />
                  {href === '/notifications' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-2.5 h-4 min-w-4 rounded-full flex items-center justify-center text-[8px] font-bold px-0.5" style={{ background: '#EF4444', color: 'white' }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{label}</span>
              </motion.div>
            </Link>
          );
        })}

        {/* Live */}
        <button onClick={() => setShowLive(true)} className="flex flex-1 justify-center cursor-pointer">
          <motion.div
            whileTap={{ scale: 0.92 }}
            className="flex flex-col items-center gap-0.5 py-1 relative"
            style={{ color: showLive ? '#f87171' : '#4a5068' }}
          >
            <span
              className="mb-0.5 h-1 w-1 rounded-full transition-all duration-200"
              style={{
                background: showLive ? '#f87171' : 'transparent',
                boxShadow: showLive ? '0 0 6px rgba(239,68,68,0.6)' : 'none',
              }}
            />
            <div className="relative">
              <Radio size={24} strokeWidth={showLive ? 2.5 : 1.5} />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            </div>
            <span className="text-[10px] font-medium">Live</span>
          </motion.div>
        </button>

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


    </nav>
    <AuthPopup open={showAuth} onClose={() => setShowAuth(false)} />
    {showLive && <LivePanel isOpen={showLive} onClose={() => setShowLive(false)} />}
  </>
  );
}
