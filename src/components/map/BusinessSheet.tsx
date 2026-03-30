'use client';

import { X, MapPin, Phone, Globe, Clock, Star, Bookmark, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Business } from '@/types';

interface Props {
  business: Business;
  onClose: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function BusinessSheet({ business: b, onClose }: Props) {
  const todayIdx = new Date().getDay();
  const todayKey = DAYS[todayIdx];
  const hours = (b.hours as Record<string, { open?: string; close?: string; closed?: boolean }>) || {};
  const todayHours = hours[todayKey];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="w-full max-w-[520px] max-h-[90dvh] rounded-t-3xl lg:rounded-3xl flex flex-col overflow-hidden"
          style={{ background: 'rgba(10,11,15,0.97)', border: '1px solid rgba(34,197,94,0.1)', boxShadow: '0 -8px 60px rgba(0,0,0,0.6), 0 0 30px rgba(34,197,94,0.06)' }}
        >
          {/* Header */}
          <div className="relative px-5 pt-5 pb-4">
            <div className="absolute inset-x-0 top-0 h-24 opacity-40 rounded-t-3xl" style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(0,212,255,0.1))' }} />
            <button onClick={onClose} className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[#4a5068] hover:text-white transition-colors cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <X size={16} />
            </button>

            <div className="relative flex items-start gap-4">
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #22C55E, #00d4ff)', color: 'white' }}>
                ■
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h2 className="text-lg font-bold text-white truncate">{b.name}</h2>
                <p className="text-sm text-[#34d399] font-medium capitalize">{b.category}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${b.open_now ? 'bg-[#22C55E]/15 text-[#22C55E]' : 'bg-[#4a5068]/15 text-[#4a5068]'}`}>
                    <CheckCircle size={10} /> {b.open_now ? 'Open Now' : 'Closed'}
                  </span>
                  {b.rating_avg && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                      <Star size={10} /> {b.rating_avg} ({b.rating_count})
                    </span>
                  )}
                  {b.booking_enabled && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                      <Bookmark size={10} /> Booking
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
            {b.description && <p className="text-sm text-[#a3adc3] leading-relaxed">{b.description}</p>}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard icon={<Star size={14} />} label="Rating" value={b.rating_avg ? `${b.rating_avg}` : '—'} color="#fbbf24" />
              <StatCard icon={<CheckCircle size={14} />} label="Proofs" value={`${b.proof_count || 0}`} color="#34d399" />
              <StatCard icon={<Clock size={14} />} label="Today" value={todayHours?.closed ? 'Closed' : todayHours?.open ? `${todayHours.open}` : '—'} color="#00d4ff" />
            </div>

            {/* Hours */}
            {Object.keys(hours).length > 0 && (
              <Sect title="Business Hours">
                <div className="space-y-1">
                  {DAYS.map(day => {
                    const h = hours[day];
                    const isToday = day === todayKey;
                    return (
                      <div key={day} className="flex items-center justify-between text-xs py-1" style={{ color: isToday ? '#f0f4ff' : '#4a5068' }}>
                        <span className="font-semibold w-10">{day}</span>
                        {h?.closed ? <span className="text-[#f87171]">Closed</span> : <span>{h?.open || '—'} — {h?.close || '—'}</span>}
                      </div>
                    );
                  })}
                </div>
              </Sect>
            )}

            {/* Contact */}
            <Sect title="Contact">
              <div className="space-y-2">
                {b.address_line1 && <InfoRow icon={<MapPin size={13} />} text={`${b.address_line1}${b.address_city ? `, ${b.address_city}` : ''}`} />}
                {(b as Record<string, unknown>).address && <InfoRow icon={<MapPin size={13} />} text={(b as Record<string, unknown>).address as string} />}
                {(b as Record<string, unknown>).phone && <InfoRow icon={<Phone size={13} />} text={(b as Record<string, unknown>).phone as string} />}
                {b.domain && <InfoRow icon={<Globe size={13} />} text={b.domain} link />}
                {(b as Record<string, unknown>).website && <InfoRow icon={<Globe size={13} />} text={(b as Record<string, unknown>).website as string} link />}
              </div>
            </Sect>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button className="btn-primary flex-1 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer">
              View
            </button>
            {b.booking_enabled && (
              <button className="flex-1 rounded-xl py-3 text-sm font-semibold cursor-pointer" style={{ background: '#00d4ff', color: '#0a0b0f' }}>
                Book
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Sect({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#4a5068' }}>{title}</h3>{children}</div>;
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex justify-center mb-1" style={{ color }}>{icon}</div>
      <p className="text-xs font-bold text-white">{value}</p>
      <p className="text-[10px]" style={{ color: '#4a5068' }}>{label}</p>
    </div>
  );
}

function InfoRow({ icon, text, link }: { icon: React.ReactNode; text: string; link?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs text-[#a3adc3]">
      <span className="shrink-0 text-[#4a5068]">{icon}</span>
      {link ? <a href={text.startsWith('http') ? text : `https://${text}`} target="_blank" rel="noopener noreferrer" className="truncate hover:text-[#00d4ff] transition-colors">{text}</a> : <span className="truncate">{text}</span>}
    </div>
  );
}
