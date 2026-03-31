'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useLocationStore } from '@/stores/locationStore';
import {
  Plus, Bot, MapPin, Tag, CalendarDays, FileText, AlertTriangle,
  Store, Calendar, Users, Sparkles, Shield, ChevronRight,
  Bookmark, Map, FileEdit, QrCode,
} from 'lucide-react';

export default function ActionsPage() {
  const { city } = useLocationStore();

  return (
    <div className="h-full overflow-y-auto px-4 lg:px-8 pt-[calc(env(safe-area-inset-top,12px)+12px)] lg:pt-6 pb-24 max-w-lg lg:max-w-2xl lg:mx-auto">

      {/* Location */}
      <div className="flex items-center gap-1.5 mb-5">
        <div className="h-2 w-2 rounded-full bg-[#00d4ff]" />
        <span className="text-xs font-medium text-[#a3adc3]">{city || 'Your Location'}</span>
        <ChevronRight size={12} className="text-[#4a5068]" />
      </div>

      {/* ── Top 2 Cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link href="/create">
          <motion.div
            whileTap={{ scale: 0.97 }}
            className="relative flex flex-col items-center gap-2 rounded-2xl p-5 overflow-hidden cursor-pointer"
            style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(0,212,255,0.1)' }}
          >
            <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(0,212,255,0.15), transparent 70%)' }} />
            <div className="relative h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,212,255,0.15)' }}>
              <Plus size={24} className="text-[#00d4ff]" />
            </div>
            <span className="relative text-sm font-semibold text-white">Create Signal</span>
          </motion.div>
        </Link>

        <Link href="/actions/ask-gao">
          <motion.div
            whileTap={{ scale: 0.97 }}
            className="relative flex flex-col items-center gap-2 rounded-2xl p-5 overflow-hidden cursor-pointer"
            style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(167,139,250,0.1)' }}
          >
            <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(167,139,250,0.15), transparent 70%)' }} />
            <div className="relative h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.15)' }}>
              <Bot size={24} className="text-[#a78bfa]" />
            </div>
            <span className="relative text-sm font-semibold text-white">Ask Gao AI</span>
          </motion.div>
        </Link>
      </div>

      {/* ── Quick Create ──────────────────────────────── */}
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068] mb-3">Quick Create</h2>
      <div className="flex gap-3 mb-6 overflow-x-auto pb-1">
        {[
          { href: '/create?type=presence', icon: <MapPin size={20} />, label: "I'm Here", color: '#3B82F6' },
          { href: '/create?type=offer', icon: <Tag size={20} />, label: 'Offer', color: '#fbbf24' },
          { href: '/create?type=event', icon: <CalendarDays size={20} />, label: 'Event', color: '#f87171' },
          { href: '/create?type=update', icon: <FileText size={20} />, label: 'Update', color: '#00d4ff' },
          { href: '/create?type=proof', icon: <AlertTriangle size={20} />, label: 'Proof', color: '#f0f4ff' },
        ].map(({ href, icon, label, color }) => (
          <Link key={href} href={href} className="shrink-0">
            <motion.div whileTap={{ scale: 0.95 }} className="flex flex-col items-center gap-1.5 w-16 cursor-pointer">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: `${color}15`, color }}>
                {icon}
              </div>
              <span className="text-[10px] font-medium text-[#a3adc3] text-center">{label}</span>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* ── Hot Actions ───────────────────────────────── */}
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068] mb-3">Hot Actions</h2>
      <div className="space-y-2 mb-6">
        {[
          {
            href: '/nearby',
            icon: <Store size={20} />,
            color: '#34d399',
            title: 'Nearby Businesses',
            sub: 'Open now near you',
          },
          {
            href: '/nearby',
            icon: <Calendar size={20} />,
            color: '#f87171',
            title: 'Join Events Tonight',
            sub: 'Happening near you',
          },
          {
            href: '/circles',
            icon: <Users size={20} />,
            color: '#00d4ff',
            title: 'Find Circles',
            sub: 'Active near you',
          },
          {
            href: '/nearby',
            icon: <Sparkles size={20} />,
            color: '#fbbf24',
            title: 'Book Services',
            sub: 'Beauty · Food · Health',
          },
          {
            href: '/me',
            icon: <Shield size={20} />,
            color: '#a78bfa',
            title: 'Earn Trust & Badges',
            sub: 'Build your reputation',
          },
        ].map(({ href, icon, color, title, sub }) => (
          <Link key={title} href={href}>
            <motion.div
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-4 rounded-2xl px-4 py-3.5 cursor-pointer"
              style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
            >
              <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden relative">
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
        ))}
      </div>

      {/* ── Your Shortcuts ────────────────────────────── */}
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068] mb-3">Your Shortcuts</h2>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { href: '#', icon: <Bookmark size={18} />, label: 'My\nBookings', sub: '0 pending', color: '#00d4ff' },
          { href: '#', icon: <Map size={18} />, label: 'Saved\nPlaces', sub: '0 items', color: '#34d399' },
          { href: '#', icon: <FileEdit size={18} />, label: 'Drafts', sub: '0 signals', color: '#a78bfa' },
        ].map(({ href, icon, label, sub, color }) => (
          <Link key={label} href={href}>
            <motion.div
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1.5 rounded-2xl py-4 px-2 cursor-pointer"
              style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
            >
              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, color }}>
                {icon}
              </div>
              <span className="text-[10px] font-medium text-white text-center whitespace-pre-line leading-tight">{label}</span>
              <span className="text-[9px] text-[#4a5068]">{sub}</span>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* ── Scan Check-In ─────────────────────────────── */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold cursor-pointer"
        style={{
          background: 'linear-gradient(135deg, #00d4ff, #22C55E)',
          color: '#0a0b0f',
          boxShadow: '0 4px 20px rgba(0,212,255,0.3)',
        }}
      >
        <QrCode size={18} />
        Scan Check-In
      </motion.button>
    </div>
  );
}
