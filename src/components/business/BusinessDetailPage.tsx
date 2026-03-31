'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, MapPin, Phone, Globe, Clock, Star, Shield, CheckCircle,
  Sparkles, Users, ChevronRight, X, Bookmark,
} from 'lucide-react';
import type { Business } from '@/types';

interface Props {
  business: Business;
  onClose: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Placeholder images for businesses without photos
const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1596178060810-72660ee8e14e?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1562322140-8baeacacf835?w=800&h=500&fit=crop',
];

export default function BusinessDetailPage({ business: b, onClose }: Props) {
  const [imgIdx, setImgIdx] = useState(0);
  const images = b.images && b.images.length > 0 ? b.images : PLACEHOLDER_IMAGES;
  const services = (b.services || []) as { name: string; price: number; duration: number }[];
  const todayIdx = new Date().getDay();
  const todayKey = DAYS[todayIdx];
  const hours = b.hours || {};
  const todayHours = hours[todayKey];
  const isOpen = b.open_now || (todayHours && !todayHours.closed);

  const nextImg = () => setImgIdx(i => (i + 1) % images.length);
  const prevImg = () => setImgIdx(i => (i - 1 + images.length) % images.length);

  // Touch swipe for images
  const touchStart = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { diff > 0 ? nextImg() : prevImg(); }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-[60] flex flex-col overflow-hidden"
        style={{ background: '#0a0b0f' }}
      >
        {/* ── Top Bar ──────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,12px)] pb-2">
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full cursor-pointer" style={{ background: 'rgba(10,11,15,0.6)', backdropFilter: 'blur(8px)' }}>
            <ArrowLeft size={18} className="text-white" />
          </button>
          <span className="text-xs font-bold tracking-[0.2em] text-white/80 uppercase">Gao Social</span>
          <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00d4ff, #22C55E)', boxShadow: '0 0 12px rgba(0,212,255,0.3)' }}>
            <span className="text-xs font-bold text-white">{b.name.charAt(0)}</span>
          </div>
        </div>

        {/* ── Image Carousel ───────────────────────────── */}
        <div
          className="relative w-full shrink-0"
          style={{ height: '45vh', minHeight: 260 }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={imgIdx}
              src={images[imgIdx]}
              alt={b.name}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </AnimatePresence>

          {/* Gradient overlay */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0a0b0f 0%, transparent 40%)' }} />

          {/* Image nav arrows (desktop) */}
          {images.length > 1 && (
            <>
              <button onClick={prevImg} className="absolute left-3 top-1/2 -translate-y-1/2 hidden lg:flex h-8 w-8 items-center justify-center rounded-full cursor-pointer" style={{ background: 'rgba(10,11,15,0.5)', backdropFilter: 'blur(4px)' }}>
                <ArrowLeft size={14} className="text-white" />
              </button>
              <button onClick={nextImg} className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:flex h-8 w-8 items-center justify-center rounded-full cursor-pointer" style={{ background: 'rgba(10,11,15,0.5)', backdropFilter: 'blur(4px)' }}>
                <ArrowRight size={14} className="text-white" />
              </button>
            </>
          )}

          {/* Dots */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={() => setImgIdx(i)} className="cursor-pointer">
                  <div className="h-1.5 rounded-full transition-all" style={{ width: i === imgIdx ? 16 : 6, background: i === imgIdx ? '#00d4ff' : 'rgba(255,255,255,0.3)' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Content (scrollable) ─────────────────────── */}
        <div className="flex-1 overflow-y-auto -mt-6 relative z-10">
          <div className="px-5 pb-32 space-y-5">

            {/* Name + badges */}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{b.name}</h1>
                {b.license_verified && <CheckCircle size={18} className="text-[#00d4ff] shrink-0" fill="rgba(0,212,255,0.2)" />}
              </div>

              {/* Rating row */}
              <div className="flex items-center gap-2 mt-1.5">
                {b.rating_avg && (
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} size={14} className={i <= Math.round(b.rating_avg!) ? 'text-[#fbbf24]' : 'text-[#2d3548]'} fill={i <= Math.round(b.rating_avg!) ? '#fbbf24' : 'none'} />
                    ))}
                    <span className="text-sm text-[#a3adc3] ml-1">{b.rating_avg}</span>
                  </div>
                )}
                {(b as Record<string, unknown>).distance_km !== undefined && (
                  <span className="text-sm text-[#4a5068]">{((b as Record<string, unknown>).distance_km as number).toFixed(1)} km</span>
                )}
              </div>

              {/* Trust badge */}
              <div className="flex items-center gap-1.5 mt-2">
                <Shield size={14} className="text-[#00d4ff]" />
                <span className="text-xs font-medium text-[#00d4ff] capitalize">{b.trust_level} Verified Business</span>
                {b.proof_count > 0 && <span className="text-xs text-[#4a5068]">· Seeds {b.proof_count}</span>}
              </div>
            </div>

            {/* Open status row */}
            <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-2">
                <Clock size={14} style={{ color: isOpen ? '#00d4ff' : '#f87171' }} />
                <span className="text-sm font-medium text-white">{isOpen ? 'Open Now' : 'Closed'}</span>
                {todayHours && !todayHours.closed && (
                  <span className="text-xs text-[#4a5068]">{todayHours.open} — {todayHours.close}</span>
                )}
              </div>
              <ChevronRight size={16} className="text-[#4a5068]" />
            </div>

            {/* Description */}
            {b.description && <p className="text-sm text-[#a3adc3] leading-relaxed">{b.description}</p>}

            {/* ── Services ─────────────────────────────── */}
            {services.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068] mb-3">Services & Pricing</h3>
                <div className="space-y-0.5">
                  {services.map((svc, i) => (
                    <div key={i} className="flex items-center justify-between py-3 px-3 rounded-lg" style={{ borderBottom: i < services.length - 1 ? '1px solid rgba(255,255,255,0.03)' : undefined }}>
                      <div>
                        <p className="text-sm text-white">{svc.name}</p>
                        {svc.duration > 0 && <p className="text-[10px] text-[#4a5068]">{svc.duration} min</p>}
                      </div>
                      <span className="text-sm font-semibold text-[#00d4ff]">${svc.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Hours ────────────────────────────────── */}
            {Object.keys(hours).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068] mb-3">Business Hours</h3>
                <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}>
                  {DAYS.map(day => {
                    const h = hours[day];
                    const isToday = day === todayKey;
                    return (
                      <div key={day} className="flex items-center justify-between px-4 py-2.5" style={{ background: isToday ? 'rgba(0,212,255,0.04)' : undefined, borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <span className={`text-xs font-medium w-10 ${isToday ? 'text-[#00d4ff]' : 'text-[#4a5068]'}`}>{day}</span>
                        {h?.closed
                          ? <span className="text-xs text-[#f87171]">Closed</span>
                          : <span className={`text-xs ${isToday ? 'text-white font-medium' : 'text-[#a3adc3]'}`}>{h?.open} — {h?.close}</span>
                        }
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Amenities ────────────────────────────── */}
            {b.amenities && b.amenities.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068] mb-3">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {b.amenities.map(a => (
                    <span key={a} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.05)', color: '#a3adc3' }}>
                      <Sparkles size={11} className="text-[#fbbf24]" /> {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Contact ──────────────────────────────── */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068] mb-3">Contact</h3>
              <div className="space-y-2">
                {b.address && (
                  <div className="flex items-center gap-3 text-sm text-[#a3adc3]">
                    <MapPin size={16} className="text-[#4a5068] shrink-0" />
                    <span>{b.address}{b.city ? `, ${b.city}` : ''}</span>
                  </div>
                )}
                {b.phone && (
                  <a href={`tel:${b.phone}`} className="flex items-center gap-3 text-sm text-[#a3adc3] hover:text-[#00d4ff] transition-colors">
                    <Phone size={16} className="text-[#4a5068] shrink-0" />
                    <span>{b.phone}</span>
                  </a>
                )}
                {b.website && (
                  <a href={b.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-[#a3adc3] hover:text-[#00d4ff] transition-colors">
                    <Globe size={16} className="text-[#4a5068] shrink-0" />
                    <span className="truncate">{b.website}</span>
                  </a>
                )}
              </div>
            </div>

            {/* ── Languages ────────────────────────────── */}
            {b.languages_spoken && b.languages_spoken.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068] mb-3">Languages</h3>
                <div className="flex gap-2">
                  {b.languages_spoken.map(l => (
                    <span key={l} className="text-xs px-3 py-1 rounded-lg" style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>{l}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Sticky Bottom Bar ────────────────────────── */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3" style={{ background: 'linear-gradient(to top, #0a0b0f 70%, transparent)' }}>
          <div className="flex items-center gap-3">
            {/* Open status mini */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ background: isOpen ? '#00d4ff' : '#f87171', boxShadow: isOpen ? '0 0 6px rgba(0,212,255,0.5)' : undefined }} />
                <span className="text-sm font-semibold text-white">{isOpen ? 'Open Now' : 'Closed'}</span>
              </div>
              {todayHours && !todayHours.closed && (
                <p className="text-[10px] text-[#4a5068] mt-0.5 truncate">{todayHours.open} — {todayHours.close}</p>
              )}
            </div>

            {b.booking_enabled && (
              <button className="rounded-xl px-6 py-3 text-sm font-bold cursor-pointer" style={{ background: '#00d4ff', color: '#0a0b0f' }}>
                Book
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
