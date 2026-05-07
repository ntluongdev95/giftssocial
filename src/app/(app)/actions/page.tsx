'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { useLocationStore } from '@/stores/locationStore';
import { useAuthStore } from '@/stores/auth-store';
import {
  Plus, Bot, MapPin, Tag, FileText, AlertTriangle,
  Store, Calendar, Users, Sparkles, Shield, ChevronRight,
  Bookmark, Map, FileEdit, QrCode, Zap, TrendingUp,
} from 'lucide-react';
import dynamic from 'next/dynamic';
const ScanCheckin = dynamic(() => import('@/components/checkin/ScanCheckin'), { ssr: false });

const apiFetcher = (url: string) => fetch(url, {
  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
}).then(r => r.json());

// ─── Data ────────────────────────────────────────────────────────────────

const QUICK_CREATE = [
  { href: '/create?type=presence', icon: <MapPin size={20} />, label: "I'm Here", color: '#3B82F6' },
  { href: '/create?type=offer', icon: <Tag size={20} />, label: 'Offer', color: '#fbbf24' },
  { href: '/create?type=event', icon: <Zap size={20} />, label: 'Buzz', color: '#f87171' },
  { href: '/create?type=update', icon: <FileText size={20} />, label: 'Update', color: '#00d4ff' },
  { href: '/create?type=proof', icon: <AlertTriangle size={20} />, label: 'Proof', color: '#f0f4ff' },
];

const HOT_ACTIONS = [
  { href: '/nearby', icon: <Store size={20} />, color: '#34d399', title: 'Nearby Businesses', sub: 'Open now near you' },
  { href: '/nearby', icon: <Calendar size={20} />, color: '#f87171', title: 'Join Events Tonight', sub: 'Happening near you' },
  { href: '/circles', icon: <Users size={20} />, color: '#00d4ff', title: 'Find Circles', sub: 'Active near you' },
  { href: '/nearby', icon: <Sparkles size={20} />, color: '#fbbf24', title: 'Book Services', sub: 'Beauty · Food · Health' },
  { href: '/me', icon: <Shield size={20} />, color: '#a78bfa', title: 'Earn Trust & Badges', sub: 'Build your reputation' },
];

const SHORTCUTS = [
  { href: '#', icon: <Bookmark size={18} />, label: 'My\nBookings', sub: '0 pending', color: '#00d4ff' },
  { href: '#', icon: <Map size={18} />, label: 'Saved\nPlaces', sub: '0 items', color: '#34d399' },
  { href: '#', icon: <FileEdit size={18} />, label: 'Drafts', sub: '0 signals', color: '#a78bfa' },
];

// ─── Page ────────────────────────────────────────────────────────────────

export default function ActionsPage() {
  const { city } = useLocationStore();
  const isLoggedIn = useAuthStore(s => s.isAuthed);
  const [showScanner, setShowScanner] = useState(false);

  // Activity counts — only fetch when logged in
  const { data: signalsData } = useSWR(isLoggedIn ? '/api/v1/signals/me' : null, apiFetcher);
  const { data: proofsData } = useSWR(isLoggedIn ? '/api/v1/proofs/me' : null, apiFetcher);
  const signalCount = (signalsData?.data || []).length;
  const proofCount = (proofsData?.data || []).length;

  return (
    <div className="h-full overflow-y-auto px-4 lg:px-8 pt-[calc(env(safe-area-inset-top,20px)+24px)] lg:pt-6 pb-24">

      {/* ══ MOBILE ════════════════════════════════════════ */}
      <div className="lg:hidden max-w-lg mx-auto">
        {/* Location */}
        <div className="flex items-center gap-1.5 mb-5">
          <div className="h-2 w-2 rounded-full bg-[#00d4ff]" />
          <span className="text-xs font-medium text-[#a3adc3]">{city || 'Your Location'}</span>
          <ChevronRight size={12} className="text-[#4a5068]" />
        </div>

        {/* Top 2 Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <TopCard href="/create" icon={<Plus size={24} />} label="Create Signal" color="#00d4ff" />
          <TopCard href="/actions/ask-gao" icon={<Bot size={24} />} label="Ask Gao AI" color="#a78bfa" />
        </div>

        <SectionTitle>Quick Create</SectionTitle>
        <div className="flex gap-3 mb-6 overflow-x-auto pb-1">
          {QUICK_CREATE.map(q => (
            <Link key={q.href} href={q.href} className="shrink-0">
              <motion.div whileTap={{ scale: 0.95 }} className="flex flex-col items-center gap-1.5 w-16 cursor-pointer">
                <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: `${q.color}15`, color: q.color }}>{q.icon}</div>
                <span className="text-[10px] font-medium text-[#a3adc3] text-center">{q.label}</span>
              </motion.div>
            </Link>
          ))}
        </div>

        <SectionTitle>Hot Actions</SectionTitle>
        <div className="space-y-2 mb-6">
          {HOT_ACTIONS.map(a => <ActionRow key={a.title} {...a} />)}
        </div>

        <SectionTitle>Your Shortcuts</SectionTitle>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {SHORTCUTS.map(s => <ShortcutCard key={s.label} {...s} />)}
        </div>

        {isLoggedIn && <ScanButton onClick={() => setShowScanner(true)} />}
      </div>

      {/* ══ DESKTOP ═══════════════════════════════════════ */}
      <div className="hidden lg:block max-w-5xl mx-auto">
        {/* Location */}
        <div className="flex items-center gap-1.5 mb-6">
          <div className="h-2 w-2 rounded-full bg-[#00d4ff]" />
          <span className="text-sm font-medium text-[#a3adc3]">{city || 'Your Location'}</span>
          <ChevronRight size={14} className="text-[#4a5068]" />
        </div>

        {/* Top row: 2 hero cards + Quick Create */}
        <div className="flex gap-6 mb-8">
          {/* Hero cards */}
          <div className="flex gap-4 w-1/2">
            <TopCardDesktop href="/create" icon={<Plus size={28} />} label="Create Signal" sub="Publish on the map" color="#00d4ff" />
            <TopCardDesktop href="/actions/ask-gao" icon={<Bot size={28} />} label="Ask Gao AI" sub="Find anything nearby" color="#a78bfa" />
          </div>

          {/* Quick Create */}
          <div className="flex-1">
            <SectionTitle>Quick Create</SectionTitle>
            <div className="flex gap-4 mt-3">
              {QUICK_CREATE.map(q => (
                <Link key={q.href} href={q.href}>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex flex-col items-center gap-2 cursor-pointer">
                    <div className="h-14 w-14 rounded-2xl flex items-center justify-center transition-shadow hover:shadow-lg" style={{ background: `${q.color}12`, color: q.color, border: `1px solid ${q.color}20` }}>
                      {q.icon}
                    </div>
                    <span className="text-[11px] font-medium text-[#a3adc3]">{q.label}</span>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Middle: Hot Actions (2-col) + Shortcuts */}
        <div className="flex gap-6 mb-8">
          {/* Hot Actions — 2 columns */}
          <div className="flex-1">
            <SectionTitle>Hot Actions</SectionTitle>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {HOT_ACTIONS.map(a => (
                <Link key={a.title} href={a.href}>
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-4 rounded-2xl px-4 py-4 cursor-pointer transition-colors hover:bg-white/[0.02]"
                    style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden">
                      <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle, ${a.color}, transparent)` }} />
                      <span style={{ color: a.color }}>{a.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{a.title}</p>
                      <p className="text-[11px] text-[#4a5068]">{a.sub}</p>
                    </div>
                    <ChevronRight size={16} className="text-[#4a5068] shrink-0" />
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>

          {/* Right sidebar: Shortcuts + Scan */}
          <div className="w-[280px] shrink-0">
            <SectionTitle>Your Shortcuts</SectionTitle>
            <div className="space-y-2 mt-3 mb-4">
              {SHORTCUTS.map(s => (
                <Link key={s.label} href={s.href}>
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer"
                    style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: `${s.color}15`, color: s.color }}>
                      {s.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white">{s.label.replace('\n', ' ')}</p>
                      <p className="text-[10px] text-[#4a5068]">{s.sub}</p>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>

            {isLoggedIn && <ScanButton onClick={() => setShowScanner(true)} />}

            {/* Stats mini — only when logged in */}
            {isLoggedIn && (
            <div className="mt-4 rounded-2xl p-4" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-[#00d4ff]" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068]">Your Activity</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-lg font-light text-[#00d4ff]">{signalCount}</p>
                  <p className="text-[9px] text-[#4a5068]">Signals</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-light text-[#34d399]">{proofCount}</p>
                  <p className="text-[9px] text-[#4a5068]">Proofs</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-light text-[#a78bfa]">0</p>
                  <p className="text-[9px] text-[#4a5068]">Badges</p>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {showScanner && <ScanCheckin isOpen={showScanner} onClose={() => setShowScanner(false)} />}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068] mb-3">{children}</h2>;
}

function TopCard({ href, icon, label, color }: { href: string; icon: React.ReactNode; label: string; color: string }) {
  return (
    <Link href={href}>
      <motion.div
        whileTap={{ scale: 0.97 }}
        className="relative flex flex-col items-center gap-2 rounded-2xl p-5 overflow-hidden cursor-pointer"
        style={{ background: 'rgba(17,19,24,0.6)', border: `1px solid ${color}18` }}
      >
        <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at 50% 0%, ${color}20, transparent 70%)` }} />
        <div className="relative h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: `${color}15`, color }}>{icon}</div>
        <span className="relative text-sm font-semibold text-white">{label}</span>
      </motion.div>
    </Link>
  );
}

function TopCardDesktop({ href, icon, label, sub, color }: { href: string; icon: React.ReactNode; label: string; sub: string; color: string }) {
  return (
    <Link href={href} className="flex-1">
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="relative flex flex-col items-center gap-3 rounded-2xl p-6 overflow-hidden cursor-pointer h-full"
        style={{ background: 'rgba(17,19,24,0.6)', border: `1px solid ${color}15` }}
      >
        <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 50% 20%, ${color}25, transparent 70%)` }} />
        <div className="relative h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: `${color}15`, color, boxShadow: `0 0 20px ${color}20` }}>{icon}</div>
        <div className="relative text-center">
          <p className="text-sm font-bold text-white">{label}</p>
          <p className="text-[11px] text-[#4a5068] mt-0.5">{sub}</p>
        </div>
      </motion.div>
    </Link>
  );
}

function ActionRow({ href, icon, color, title, sub }: { href: string; icon: React.ReactNode; color: string; title: string; sub: string }) {
  return (
    <Link href={href}>
      <motion.div
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-4 rounded-2xl px-4 py-3.5 cursor-pointer"
        style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle, ${color}, transparent)` }} />
          <span style={{ color }}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-[10px] text-[#4a5068]">{sub}</p>
        </div>
        <ChevronRight size={16} className="text-[#4a5068] shrink-0" />
      </motion.div>
    </Link>
  );
}

function ShortcutCard({ href, icon, label, sub, color }: { href: string; icon: React.ReactNode; label: string; sub: string; color: string }) {
  return (
    <Link href={href}>
      <motion.div
        whileTap={{ scale: 0.95 }}
        className="flex flex-col items-center gap-1.5 rounded-2xl py-4 px-2 cursor-pointer"
        style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, color }}>{icon}</div>
        <span className="text-[10px] font-medium text-white text-center whitespace-pre-line leading-tight">{label}</span>
        <span className="text-[9px] text-[#4a5068]">{sub}</span>
      </motion.div>
    </Link>
  );
}

function ScanButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold cursor-pointer"
      style={{ background: 'linear-gradient(135deg, #00d4ff, #22C55E)', color: '#0a0b0f', boxShadow: '0 4px 20px rgba(0,212,255,0.3)' }}
    >
      <QrCode size={18} /> Scan Check-In
    </motion.button>
  );
}
