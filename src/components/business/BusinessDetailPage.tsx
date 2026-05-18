'use client';
/* eslint-disable react-hooks/static-components */

import { useState, useRef, useEffect } from 'react';
import { mutate as globalMutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, MapPin, Phone, Globe, Clock, Star, Shield, CheckCircle,
  Sparkles, ChevronRight, X, Lock, Unlock, Loader2,
} from 'lucide-react';
import type { Business } from '@/types';
import NailBookingModal from '@/components/booking/NailBookingModal';
import AuthPopup from '@/components/ui/AuthPopup';
import { StoryStack } from '@/components/stories/StoryStack';

interface Props {
  business: Business;
  onClose: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1596178060810-72660ee8e14e?w=800&h=500&fit=crop',
  'https://images.unsplash.com/photo-1562322140-8baeacacf835?w=800&h=500&fit=crop',
];

export default function BusinessDetailPage({ business: b, onClose }: Props) {
  const [showBooking, setShowBooking] = useState(false);
  const [bookingService, setBookingService] = useState<string | undefined>();
  const [imgIdx, setImgIdx] = useState(0);
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  // Fetch current unlock state for this venue
  useEffect(() => {
    if (typeof document === 'undefined' || !document.cookie.includes('gao_logged_in=1')) { setUnlocked(false); return; }
    fetch('/api/v1/me/unlocked', { })
      .then(r => r.json()).then(j => {
        const ids: string[] = (j?.data?.businesses || []).map((x: { id: string }) => x.id);
        setUnlocked(ids.includes(b.id));
      }).catch(() => setUnlocked(false));
  }, [b.id]);

  const handleCheckIn = async () => {
    if (checkingIn || unlocked) return;
    // Gate: must be logged in to check in. The check-in API needs a user
    // identity (it grants Gao Points + paints the user's map), so prompt the
    // auth popup instead of letting the request fail with 401.
    const loggedIn = typeof document !== 'undefined' && document.cookie.includes('gao_logged_in=1');
    if (!loggedIn) { setShowAuth(true); return; }
    setCheckingIn(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
        navigator.geolocation.getCurrentPosition(resolve, (e) => reject(new Error(e.message)), {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 30000,
        });
      });
      const res = await fetch('/api/v1/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: 'business', target_id: b.id,
          location_lat: pos.coords.latitude, location_lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy, method: 'location',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to check in');
      } else {
        setUnlocked(true);
        toast.success(`Unlocked! +${json?.data?.points_earned || 5} Gao Points`);
        globalMutate('/api/v1/me/unlocked');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to get your location');
    } finally {
      setCheckingIn(false);
    }
  };
  const coverImage = (b as unknown as Record<string, unknown>).cover_image as string;
  const allImages = [
    ...(coverImage ? [coverImage] : []),
    ...(b.images && b.images.length > 0 ? b.images : []),
  ];
  const images = allImages.length > 0 ? allImages : PLACEHOLDER_IMAGES;
  const rawServices = b.services;
  const services = (Array.isArray(rawServices) ? rawServices : typeof rawServices === 'string' ? (() => { try { return JSON.parse(rawServices); } catch { return []; } })() : []) as { name: string; price: number; duration: number }[];
  const todayIdx = new Date().getDay();
  const todayKey = DAYS[todayIdx];
  const hours = b.hours || {};
  const todayHours = hours[todayKey];
  const isOpen = b.open_now || (todayHours && !todayHours.closed);

  const nextImg = () => setImgIdx(i => (i + 1) % images.length);
  const prevImg = () => setImgIdx(i => (i - 1 + images.length) % images.length);

  const touchStart = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { diff > 0 ? nextImg() : prevImg(); }
  };

  // ── Image Carousel (shared) ─────────────────────────────
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
          alt={b.name}
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

  // ── Info Content (shared) ───────────────────────────────
  const InfoContent = () => (
    <div className="space-y-5">
      {/* Name + badges */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-white">{b.name}</h1>
          {b.license_verified && <CheckCircle size={18} className="text-[#00d4ff] shrink-0" fill="rgba(0,212,255,0.2)" />}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          {b.rating_avg && (
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} size={14} className={i <= Math.round(b.rating_avg!) ? 'text-[#fbbf24]' : 'text-[#2d3548]'} fill={i <= Math.round(b.rating_avg!) ? '#fbbf24' : 'none'} />
              ))}
              <span className="text-sm text-[#a3adc3] ml-1">{b.rating_avg}</span>
            </div>
          )}
          {b.price_range && <span className="text-sm text-[#4a5068]">{b.price_range}</span>}
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <Shield size={14} className="text-[#00d4ff]" />
          <span className="text-xs font-medium text-[#00d4ff] capitalize">{b.trust_level} Verified Business</span>
          {b.proof_count > 0 && <span className="text-xs text-[#4a5068]">· {b.proof_count} proofs</span>}
        </div>
      </div>

      {/* Active Now stories at this venue */}
      <StoryStack businessId={b.id} />

      {/* Open status */}
      <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2">
          <Clock size={14} style={{ color: isOpen ? '#00d4ff' : '#f87171' }} />
          <span className="text-sm font-medium text-white">{isOpen ? 'Open Now' : 'Closed'}</span>
          {todayHours && !todayHours.closed && <span className="text-xs text-[#4a5068]">{todayHours.open} — {todayHours.close}</span>}
        </div>
        <ChevronRight size={16} className="text-[#4a5068]" />
      </div>

      {/* Paint-your-map unlock */}
      <button
        onClick={handleCheckIn}
        disabled={checkingIn || !!unlocked}
        className="w-full flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer disabled:cursor-default transition-colors"
        style={{
          background: unlocked ? 'rgba(52,211,153,0.08)' : 'rgba(0,212,255,0.06)',
          border: `1px solid ${unlocked ? 'rgba(52,211,153,0.2)' : 'rgba(0,212,255,0.15)'}`,
        }}
      >
        {checkingIn ? <Loader2 size={16} className="animate-spin text-[#00d4ff]" />
          : unlocked ? <Unlock size={16} className="text-[#34d399]" />
          : <Lock size={16} className="text-[#00d4ff]" />}
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold" style={{ color: unlocked ? '#34d399' : '#00d4ff' }}>
            {unlocked ? 'Unlocked on your map' : 'Unlock this place'}
          </p>
          <p className="text-[11px] text-[#4a5068]">
            {unlocked ? 'Pin is lit up — part of your Hanoi map' : checkingIn ? 'Verifying you\'re here…' : 'Check in at the venue to light this pin on your map · +5 pts'}
          </p>
        </div>
        {!unlocked && !checkingIn && <ChevronRight size={14} className="text-[#4a5068]" />}
      </button>

      {b.description && <p className="text-sm text-[#a3adc3] leading-relaxed">{b.description}</p>}

      {/* Photos gallery */}
      {allImages.length > 1 && (
        <div>
          <Sect title="Photos">
            <div className="grid grid-cols-3 gap-1.5 rounded-xl overflow-hidden">
              {allImages.slice(0, 6).map((url, i) => (
                <div key={i} className="aspect-square overflow-hidden cursor-pointer" onClick={() => setImgIdx(i)}>
                  <img src={url} alt="" className="h-full w-full object-cover transition-transform hover:scale-105" />
                </div>
              ))}
            </div>
            {allImages.length > 6 && <p className="text-[10px] text-[#4a5068] mt-1">+{allImages.length - 6} more</p>}
          </Sect>
        </div>
      )}

      {/* Services */}
      {services.length > 0 && (
        <Sect title="Services & Pricing">
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}>
            {services.map((svc, i) => (
              <div key={i} className="flex items-center justify-between py-3 px-4" style={{ borderBottom: i < services.length - 1 ? '1px solid rgba(255,255,255,0.03)' : undefined }}>
                <div>
                  <p className="text-sm text-white">{svc.name}</p>
                  {svc.duration > 0 && <p className="text-[10px] text-[#4a5068]">{svc.duration} min</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#00d4ff]">${svc.price}</span>
                  {b.booking_enabled && (
                    <button onClick={() => { setBookingService(svc.name); setShowBooking(true); }} className="rounded-lg px-2.5 py-1 text-[9px] font-semibold cursor-pointer" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                      Book
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Sect>
      )}

      {/* Hours */}
      {Object.keys(hours).length > 0 && (
        <Sect title="Business Hours">
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}>
            {DAYS.map(day => {
              const h = hours[day];
              const isToday = day === todayKey;
              return (
                <div key={day} className="flex items-center justify-between px-4 py-2.5" style={{ background: isToday ? 'rgba(0,212,255,0.04)' : undefined, borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <span className={`text-xs font-medium w-10 ${isToday ? 'text-[#00d4ff]' : 'text-[#4a5068]'}`}>{day}</span>
                  {h?.closed ? <span className="text-xs text-[#f87171]">Closed</span> : <span className={`text-xs ${isToday ? 'text-white font-medium' : 'text-[#a3adc3]'}`}>{h?.open} — {h?.close}</span>}
                </div>
              );
            })}
          </div>
        </Sect>
      )}

      {/* Amenities */}
      {b.amenities && b.amenities.length > 0 && (
        <Sect title="Amenities">
          <div className="flex flex-wrap gap-2">
            {b.amenities.map(a => (
              <span key={a} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.05)', color: '#a3adc3' }}>
                <Sparkles size={11} className="text-[#fbbf24]" /> {a}
              </span>
            ))}
          </div>
        </Sect>
      )}

      {/* Contact */}
      <Sect title="Contact">
        <div className="space-y-2">
          {b.address && <InfoRow icon={<MapPin size={16} />} text={`${b.address}${b.city ? `, ${b.city}` : ''}`} />}
          {b.phone && <InfoRow icon={<Phone size={16} />} text={b.phone} href={`tel:${b.phone}`} />}
          {b.website && <InfoRow icon={<Globe size={16} />} text={b.website} href={b.website} />}
        </div>
      </Sect>

      {/* Languages */}
      {b.languages_spoken && b.languages_spoken.length > 0 && (
        <Sect title="Languages">
          <div className="flex gap-2">
            {b.languages_spoken.map(l => (
              <span key={l} className="text-xs px-3 py-1 rounded-lg" style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>{l}</span>
            ))}
          </div>
        </Sect>
      )}
    </div>
  );

  // ── Bottom Bar (shared) ─────────────────────────────────
  const BottomBar = () => (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: isOpen ? '#00d4ff' : '#f87171', boxShadow: isOpen ? '0 0 6px rgba(0,212,255,0.5)' : undefined }} />
          <span className="text-sm font-semibold text-white">{isOpen ? 'Open Now' : 'Closed'}</span>
        </div>
        {todayHours && !todayHours.closed && <p className="text-[10px] text-[#4a5068] mt-0.5">{todayHours.open} — {todayHours.close}</p>}
      </div>
      {b.booking_enabled && (
        <button onClick={() => setShowBooking(true)} className="rounded-xl px-6 py-3 text-sm font-bold cursor-pointer" style={{ background: '#00d4ff', color: '#0a0b0f' }}>Book</button>
      )}
      {b.phone && !b.booking_enabled && (
        <a href={`tel:${b.phone}`} className="rounded-xl px-6 py-3 text-sm font-bold cursor-pointer" style={{ background: '#00d4ff', color: '#0a0b0f' }}>Call</a>
      )}
    </div>
  );

  return (
    <>
      {/* ══ MOBILE: Full-page slide from right ══════════════ */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-[60] flex flex-col overflow-hidden lg:hidden"
        style={{ background: '#0a0b0f' }}
      >
        {/* Mobile top bar */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,12px)] pb-2">
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full cursor-pointer" style={{ background: 'rgba(10,11,15,0.6)', backdropFilter: 'blur(8px)' }}>
            <ArrowLeft size={18} className="text-white" />
          </button>
          <span className="text-xs font-bold tracking-[0.2em] text-white/80 uppercase">Gao Social</span>
          <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00d4ff, #22C55E)', boxShadow: '0 0 12px rgba(0,212,255,0.3)' }}>
            <span className="text-xs font-bold text-white">{b.name.charAt(0)}</span>
          </div>
        </div>

        {/* Mobile image */}
        <ImageCarousel height="45vh" />
        <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: '45vh', background: 'linear-gradient(to top, #0a0b0f 0%, transparent 40%)' }} />

        {/* Mobile content */}
        <div className="flex-1 overflow-y-auto -mt-6 relative z-10 px-5 pb-32">
          <InfoContent />
        </div>

        {/* Mobile bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3" style={{ background: 'linear-gradient(to top, #0a0b0f 70%, transparent)' }}>
          <BottomBar />
        </div>
      </motion.div>

      {/* ══ DESKTOP: Centered modal ═════════════════════════ */}
      <div className="fixed inset-0 z-[60] hidden lg:flex items-center justify-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
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
          style={{ background: '#0a0b0f', border: '1px solid rgba(0,212,255,0.08)', boxShadow: '0 20px 80px rgba(0,0,0,0.6)' }}
        >
          {/* Left: Image gallery */}
          <div className="w-[400px] shrink-0 relative">
            <ImageCarousel />
            {/* Close button */}
            <button onClick={onClose} className="absolute top-4 left-4 z-10 flex h-8 w-8 items-center justify-center rounded-full cursor-pointer" style={{ background: 'rgba(10,11,15,0.6)', backdropFilter: 'blur(8px)' }}>
              <X size={16} className="text-white" />
            </button>
          </div>

          {/* Right: Info */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto p-6 pb-4">
              <InfoContent />
            </div>

            {/* Desktop bottom bar */}
            <div className="px-6 py-4 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <BottomBar />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Booking Modal */}
      {showBooking && (
        <NailBookingModal
          business={b}
          initialService={bookingService}
          onClose={() => setShowBooking(false)}
          onBooked={() => setShowBooking(false)}
        />
      )}

      {/* Auth gate — opened when a guest taps "Unlock this place" */}
      <AuthPopup open={showAuth} onClose={() => setShowAuth(false)} />
    </>
  );
}

function Sect({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h3 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068] mb-3">{title}</h3>{children}</div>;
}

function InfoRow({ icon, text, href }: { icon: React.ReactNode; text: string; href?: string }) {
  const content = (
    <div className="flex items-center gap-3 text-sm text-[#a3adc3]">
      <span className="shrink-0 text-[#4a5068]">{icon}</span>
      <span className="truncate">{text}</span>
    </div>
  );
  if (href) {
    return <a href={href} target={href.startsWith('tel:') ? undefined : '_blank'} rel="noopener noreferrer" className="block hover:text-[#00d4ff] transition-colors">{content}</a>;
  }
  return content;
}
