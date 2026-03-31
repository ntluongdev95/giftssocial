'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, MapPin, Clock, Calendar, Users, Shield, CheckCircle,
  ChevronRight, X, Heart, MessageCircle, Bookmark,
} from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';
import { toast } from 'sonner';
import type { Event } from '@/types';

interface Props {
  event: Event;
  onClose: () => void;
}

const EVENT_PLACEHOLDERS = [
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=800&h=500&fit=crop',
];

export default function EventDetailPage({ event: e, onClose }: Props) {
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

  const [imgIdx, setImgIdx] = useState(0);
  const images = e.images && e.images.length > 0 ? e.images : EVENT_PLACEHOLDERS;
  const startDate = new Date(e.start_time);
  const endDate = new Date(e.end_time);
  const isLive = e.status === 'live';
  const spotsLeft = e.capacity ? e.capacity - e.joined_count : null;
  const capacityPct = e.capacity ? Math.min((e.joined_count / e.capacity) * 100, 100) : 0;

  let dateLabel = '';
  try {
    if (isToday(startDate)) dateLabel = 'Today';
    else if (isTomorrow(startDate)) dateLabel = 'Tomorrow';
    else dateLabel = format(startDate, 'EEE, MMM d');
  } catch { dateLabel = ''; }

  let timeLabel = '';
  try { timeLabel = `${format(startDate, 'h:mm a')} — ${format(endDate, 'h:mm a')}`; } catch {}

  const nextImg = () => setImgIdx(i => (i + 1) % images.length);
  const prevImg = () => setImgIdx(i => (i - 1 + images.length) % images.length);

  const touchStart = useRef(0);
  const handleTouchStart = (ev: React.TouchEvent) => { touchStart.current = ev.touches[0].clientX; };
  const handleTouchEnd = (ev: React.TouchEvent) => {
    const diff = touchStart.current - ev.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { diff > 0 ? nextImg() : prevImg(); }
  };

  // ── Shared: Image Carousel ──────────────────────────────
  const ImageCarousel = ({ className, height }: { className?: string; height?: string }) => (
    <div
      className={`relative w-full shrink-0 overflow-hidden ${className || ''}`}
      style={{ height: height || '100%' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <AnimatePresence mode="wait">
        <motion.img
          key={imgIdx}
          src={images[imgIdx]}
          alt={e.title}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </AnimatePresence>
      {images.length > 1 && (
        <>
          <button onClick={prevImg} className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full cursor-pointer opacity-0 hover:opacity-100 transition-opacity" style={{ background: 'rgba(10,11,15,0.5)' }}>
            <ArrowLeft size={14} className="text-white" />
          </button>
          <button onClick={nextImg} className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full cursor-pointer opacity-0 hover:opacity-100 transition-opacity" style={{ background: 'rgba(10,11,15,0.5)' }}>
            <ArrowRight size={14} className="text-white" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button key={i} onClick={() => setImgIdx(i)} className="cursor-pointer">
                <div className="h-1.5 rounded-full transition-all" style={{ width: i === imgIdx ? 16 : 6, background: i === imgIdx ? '#00d4ff' : 'rgba(255,255,255,0.3)' }} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // ── Shared: Info Content ────────────────────────────────
  const InfoContent = () => (
    <div className="space-y-5">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        {isLive && (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full animate-pulse" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#f87171]" /> Live Now
          </span>
        )}
        {!isLive && (
          <span className="text-xs font-medium text-[#00d4ff]">
            {isToday(startDate) ? '● Happening today' : isTomorrow(startDate) ? '● Tomorrow' : `● ${dateLabel}`}
          </span>
        )}
      </div>

      {/* Title */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-white">{e.title}</h1>
          {e.verified && <CheckCircle size={18} className="text-[#00d4ff] shrink-0" fill="rgba(0,212,255,0.2)" />}
        </div>
        {e.category && <p className="text-sm text-[#00d4ff] font-medium capitalize mt-1">{e.category}</p>}
      </div>

      {/* Attendance bar */}
      <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white">{e.joined_count} attending</span>
          {spotsLeft !== null && <span className="text-xs text-[#00d4ff]">{spotsLeft} spots left</span>}
        </div>
        {e.capacity && (
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${capacityPct}%`, background: capacityPct > 80 ? '#f87171' : '#00d4ff' }} />
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <ActionBtn icon={<MessageCircle size={15} />} label="Chat" />
        <ActionBtn icon={joined ? <CheckCircle size={15} /> : <Bookmark size={15} />} label={joined ? 'Joined' : joining ? 'Joining...' : 'Join Event'} primary onClick={handleJoin} disabled={joining || joined} />
        <ActionBtn icon={<Heart size={15} />} label="Save" />
      </div>

      {/* Schedule */}
      <Sect title="Schedule">
        <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}>
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <Calendar size={16} className="text-[#00d4ff] shrink-0" />
            <div>
              <p className="text-sm text-white font-medium">{dateLabel}</p>
              <p className="text-[10px] text-[#4a5068]">{timeLabel}</p>
            </div>
          </div>
          {(e.location_name || e.city) && (
            <div className="flex items-center gap-3 px-4 py-3">
              <MapPin size={16} className="text-[#00d4ff] shrink-0" />
              <div>
                <p className="text-sm text-white font-medium">{e.location_name || ''}</p>
                {e.city && <p className="text-[10px] text-[#4a5068]">{e.city}</p>}
              </div>
            </div>
          )}
        </div>
      </Sect>

      {/* Trust */}
      {e.verified && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}>
          <Shield size={16} className="text-[#00d4ff] shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Trusted</p>
            <p className="text-[10px] text-[#4a5068]">Verified by Gao Social</p>
          </div>
          <Heart size={16} className="text-[#f87171]" />
        </div>
      )}

      {/* Description */}
      {e.description && (
        <Sect title="About">
          <p className="text-sm text-[#a3adc3] leading-relaxed">{e.description}</p>
        </Sect>
      )}

      {/* Open status row */}
      <div className="flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-[#00d4ff]" />
          <span className="text-sm font-medium text-white">
            {isLive ? 'Happening now' : `Starts at ${format(startDate, 'h:mm a')}`}
          </span>
          {!isLive && <span className="text-xs text-[#4a5068]">{dateLabel}</span>}
        </div>
        <ChevronRight size={16} className="text-[#4a5068]" />
      </div>
    </div>
  );

  // ── Shared: Bottom Bar ──────────────────────────────────
  const BottomBar = () => (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: isLive ? '#f87171' : '#00d4ff', boxShadow: isLive ? '0 0 6px rgba(239,68,68,0.5)' : '0 0 6px rgba(0,212,255,0.5)' }} />
          <span className="text-sm font-semibold text-white">{isLive ? 'Live Now' : dateLabel}</span>
        </div>
        <p className="text-[10px] text-[#4a5068] mt-0.5">{timeLabel}</p>
      </div>
      <button onClick={handleJoin} disabled={joining || joined} className="rounded-xl px-6 py-3 text-sm font-bold cursor-pointer disabled:opacity-50" style={{ background: joined ? '#34d399' : '#00d4ff', color: '#0a0b0f' }}>
        {joined ? '✓ Joined' : joining ? '...' : 'Join'}
      </button>
    </div>
  );

  return (
    <>
      {/* ══ MOBILE: Full-page slide ═══════════════════════ */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-[60] flex flex-col overflow-hidden lg:hidden"
        style={{ background: '#0a0b0f' }}
      >
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,12px)] pb-2">
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full cursor-pointer" style={{ background: 'rgba(10,11,15,0.6)', backdropFilter: 'blur(8px)' }}>
            <ArrowLeft size={18} className="text-white" />
          </button>
          <span className="text-xs font-bold tracking-[0.2em] text-white/80 uppercase">Gao Social</span>
          <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f87171, #fbbf24)', boxShadow: '0 0 12px rgba(239,68,68,0.3)' }}>
            <Calendar size={16} className="text-white" />
          </div>
        </div>

        <ImageCarousel height="40vh" />
        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: '40vh', background: 'linear-gradient(to top, #0a0b0f 0%, transparent 40%)' }} />

        <div className="flex-1 overflow-y-auto -mt-6 relative z-10 px-5 pb-32">
          <InfoContent />
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-20 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3" style={{ background: 'linear-gradient(to top, #0a0b0f 70%, transparent)' }}>
          <BottomBar />
        </div>
      </motion.div>

      {/* ══ DESKTOP: Centered modal ═══════════════════════ */}
      <div className="fixed inset-0 z-[60] hidden lg:flex items-center justify-center" onClick={(ev) => ev.target === ev.currentTarget && onClose()}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="relative w-full max-w-4xl max-h-[85vh] rounded-3xl overflow-hidden flex"
          style={{ background: '#0a0b0f', border: '1px solid rgba(239,68,68,0.08)', boxShadow: '0 20px 80px rgba(0,0,0,0.6)' }}
        >
          {/* Left: Images */}
          <div className="w-[400px] shrink-0 relative">
            <ImageCarousel />
            <button onClick={onClose} className="absolute top-4 left-4 z-10 flex h-8 w-8 items-center justify-center rounded-full cursor-pointer" style={{ background: 'rgba(10,11,15,0.6)', backdropFilter: 'blur(8px)' }}>
              <X size={16} className="text-white" />
            </button>
          </div>

          {/* Right: Info */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto p-6 pb-4">
              <InfoContent />
            </div>
            <div className="px-6 py-4 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <BottomBar />
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}

function Sect({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h3 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068] mb-3">{title}</h3>{children}</div>;
}

function ActionBtn({ icon, label, primary, onClick, disabled }: { icon: React.ReactNode; label: string; primary?: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
      style={primary
        ? { background: '#00d4ff', color: '#0a0b0f' }
        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#a3adc3' }
      }
    >
      {icon} {label}
    </button>
  );
}
