'use client';

import { useState } from 'react';
import { X, MapPin, Calendar, Clock, Users, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { Event } from '@/types';

interface Props {
  event: Event;
  onClose: () => void;
  onViewDetail?: () => void;
}

export default function EventSheet({ event: e, onClose, onViewDetail }: Props) {
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const res = await fetch('/api/v1/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
        body: JSON.stringify({ event_id: e.id, service_name: e.title, slot_time: e.start_time }),
      });
      if (res.ok) { setJoined(true); toast.success('Joined! Check My Bookings for details.'); }
      else { const err = await res.json(); toast.error(err.error?.message || 'Failed to join'); }
    } catch { toast.error('Network error'); }
    finally { setJoining(false); }
  };
  const spotsLeft = e.capacity ? e.capacity - e.joined_count : null;
  const capacityPct = e.capacity ? Math.min((e.joined_count / e.capacity) * 100, 100) : 0;
  const isLive = e.status === 'live';

  let dateLabel = '';
  try {
    dateLabel = format(new Date(e.start_time), 'EEE, MMM d · h:mm a');
  } catch { dateLabel = ''; }

  let endLabel = '';
  try {
    endLabel = format(new Date(e.end_time), 'h:mm a');
  } catch { endLabel = ''; }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end justify-center lg:items-center"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        onClick={(ev) => ev.target === ev.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="w-full max-w-[520px] max-h-[90dvh] rounded-t-3xl lg:rounded-3xl flex flex-col overflow-hidden"
          style={{ background: 'rgba(10,11,15,0.97)', border: '1px solid rgba(239,68,68,0.1)', boxShadow: '0 -8px 60px rgba(0,0,0,0.6), 0 0 30px rgba(239,68,68,0.06)' }}
        >
          {/* Header */}
          <div className="relative px-5 pt-5 pb-4">
            <div className="absolute inset-x-0 top-0 h-24 opacity-40 rounded-t-3xl" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(251,191,36,0.1))' }} />
            <button onClick={onClose} className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[#4a5068] hover:text-white transition-colors cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <X size={16} />
            </button>

            <div className="relative flex items-start gap-4">
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #EF4444, #fbbf24)', color: 'white' }}>
                <Calendar size={28} />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h2 className="text-lg font-bold text-white">{e.title}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {isLive && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full animate-pulse" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#f87171]" /> LIVE NOW
                    </span>
                  )}
                  {e.status === 'scheduled' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                      <Clock size={10} /> Upcoming
                    </span>
                  )}
                  {e.verified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                      <CheckCircle size={10} /> Verified
                    </span>
                  )}
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(255,255,255,0.05)', color: '#a3adc3' }}>
                    {e.visibility}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
            {e.description && <p className="text-sm text-[#a3adc3] leading-relaxed">{e.description}</p>}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard icon={<Calendar size={14} />} label="Date" value={dateLabel ? format(new Date(e.start_time), 'MMM d') : '—'} color="#f87171" />
              <StatCard icon={<Clock size={14} />} label="Time" value={dateLabel ? `${format(new Date(e.start_time), 'h:mm a')}` : '—'} color="#fbbf24" />
              <StatCard icon={<Users size={14} />} label="Joined" value={`${e.joined_count}${e.capacity ? `/${e.capacity}` : ''}`} color="#00d4ff" />
            </div>

            {/* Date & Time detail */}
            <Sect title="Schedule">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-[#a3adc3]">
                  <Calendar size={13} className="text-[#4a5068] shrink-0" />
                  <span>{dateLabel}{endLabel ? ` — ${endLabel}` : ''}</span>
                </div>
              </div>
            </Sect>

            {/* Location */}
            {(e.location_name || e.city) && (
              <Sect title="Location">
                <div className="flex items-center gap-2 text-xs text-[#a3adc3]">
                  <MapPin size={13} className="text-[#4a5068] shrink-0" />
                  <span>{e.location_name}{e.city ? `, ${e.city}` : ''}</span>
                </div>
              </Sect>
            )}

            {/* Capacity bar */}
            {e.capacity && (
              <Sect title="Attendance">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#a3adc3]">{e.joined_count} joined</span>
                    <span className="text-[#4a5068]">{spotsLeft} spots left</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'rgba(17,19,24,0.8)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${capacityPct}%`, background: capacityPct > 80 ? '#f87171' : '#00d4ff' }} />
                  </div>
                </div>
              </Sect>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] lg:pb-4 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button onClick={handleJoin} disabled={joining || joined} className="flex-1 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50" style={{ background: joined ? '#34d399' : '#00d4ff', color: '#0a0b0f' }}>
              {joined ? <><CheckCircle size={15} /> Joined</> : joining ? 'Joining...' : <><Users size={15} /> Join</>}
            </button>
            <button className="rounded-xl py-3 px-5 text-sm font-semibold transition-colors cursor-pointer" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#a3adc3' }}>
              Save
            </button>
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
