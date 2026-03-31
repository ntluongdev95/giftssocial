'use client';

import { useState } from 'react';
import { X, MapPin, Phone, Globe, Clock, Star, Bookmark, CheckCircle, Sparkles, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { Business } from '@/types';

interface Props {
  business: Business;
  onClose: () => void;
  onViewDetail?: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function BusinessSheet({ business: biz, onClose, onViewDetail }: Props) {
  const [booking, setBooking] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const handleBook = async (serviceName?: string) => {
    setBooking(true);
    try {
      const res = await fetch('/api/v1/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
        body: JSON.stringify({
          business_id: biz.id,
          service_name: serviceName || 'General booking',
          amount: services.find(s => s.name === serviceName)?.price || 0,
        }),
      });
      if (res.ok) {
        toast.success('Booked! Check My Bookings for details.');
        setSelectedService(serviceName || null);
      } else {
        const err = await res.json();
        toast.error(err.error?.message || 'Failed to book');
      }
    } catch { toast.error('Network error'); }
    finally { setBooking(false); }
  };

  const todayIdx = new Date().getDay();
  const todayKey = DAYS[todayIdx];
  const hours = (biz.hours as Record<string, { open?: string; close?: string; closed?: boolean }>) || {};
  const todayHours = hours[todayKey];
  const services = biz.services || [];

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
          {/* ── Header ────────────────────────────────────── */}
          <div className="relative px-5 pt-5 pb-4">
            <div className="absolute inset-x-0 top-0 h-28 opacity-40 rounded-t-3xl" style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(0,212,255,0.1))' }} />
            <button onClick={onClose} className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[#4a5068] hover:text-white transition-colors cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <X size={16} />
            </button>

            <div className="relative flex items-start gap-4">
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #22C55E, #00d4ff)', color: 'white' }}>
                {biz.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h2 className="text-lg font-bold text-white">{biz.name}</h2>
                <p className="text-sm text-[#34d399] font-medium capitalize">{biz.category}</p>

                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${biz.open_now ? 'bg-[#22C55E]/15 text-[#22C55E]' : 'bg-[#f87171]/15 text-[#f87171]'}`}>
                    {biz.open_now ? '● Open' : '● Closed'}
                  </span>
                  {biz.rating_avg && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                      <Star size={9} fill="#fbbf24" /> {biz.rating_avg} ({biz.rating_count})
                    </span>
                  )}
                  {biz.price_range && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: '#a3adc3' }}>
                      {biz.price_range}
                    </span>
                  )}
                  {biz.accepts_walkins && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                      Walk-ins OK
                    </span>
                  )}
                  {biz.license_verified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                      <Shield size={9} /> Licensed
                    </span>
                  )}
                </div>

                {/* Subcategories */}
                {biz.subcategories && biz.subcategories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {biz.subcategories.map(sc => (
                      <span key={sc} className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.08)', color: '#34d399' }}>{sc}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Content (scrollable) ──────────────────────── */}
          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5">
            {biz.description && <p className="text-sm text-[#a3adc3] leading-relaxed">{biz.description}</p>}

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard icon={<Star size={14} />} label="Rating" value={biz.rating_avg ? `${biz.rating_avg}` : '—'} color="#fbbf24" />
              <StatCard icon={<CheckCircle size={14} />} label="Reviews" value={`${biz.rating_count || 0}`} color="#34d399" />
              <StatCard icon={<Clock size={14} />} label="Today" value={todayHours?.closed ? 'Closed' : todayHours?.open ? `${todayHours.open}` : '—'} color="#00d4ff" />
            </div>

            {/* ── Services & Pricing ──────────────────────── */}
            {services.length > 0 && (
              <Sect title="Services & Pricing">
                <div className="space-y-1">
                  {services.map((svc, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.02] transition-colors" style={{ borderBottom: i < services.length - 1 ? '1px solid rgba(255,255,255,0.03)' : undefined }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white">{svc.name}</p>
                        {svc.duration > 0 && <p className="text-[10px] text-[#4a5068]">{svc.duration} min</p>}
                      </div>
                      <span className="text-sm font-semibold text-[#00d4ff] ml-3">${svc.price}</span>
                      {biz.booking_enabled && (
                        <button
                          onClick={() => handleBook(svc.name)}
                          disabled={booking || selectedService === svc.name}
                          className="ml-2 rounded-lg px-2.5 py-1 text-[9px] font-semibold cursor-pointer disabled:opacity-50"
                          style={{ background: selectedService === svc.name ? 'rgba(52,211,153,0.15)' : 'rgba(0,212,255,0.1)', color: selectedService === svc.name ? '#34d399' : '#00d4ff' }}
                        >
                          {selectedService === svc.name ? '✓ Booked' : 'Book'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </Sect>
            )}

            {/* ── Hours ───────────────────────────────────── */}
            {Object.keys(hours).length > 0 && (
              <Sect title="Business Hours">
                <div className="space-y-0.5">
                  {DAYS.map(day => {
                    const h = hours[day];
                    const isToday = day === todayKey;
                    return (
                      <div key={day} className={`flex items-center justify-between text-xs py-1.5 px-3 rounded-lg ${isToday ? 'bg-white/[0.03]' : ''}`}>
                        <span className={`w-10 font-semibold ${isToday ? 'text-[#00d4ff]' : 'text-[#4a5068]'}`}>{day}</span>
                        {h?.closed
                          ? <span className="text-[#f87171]">Closed</span>
                          : <span className={isToday ? 'text-white font-medium' : 'text-[#a3adc3]'}>{h?.open} — {h?.close}</span>
                        }
                      </div>
                    );
                  })}
                </div>
              </Sect>
            )}

            {/* ── Amenities ───────────────────────────────── */}
            {biz.amenities && biz.amenities.length > 0 && (
              <Sect title="Amenities">
                <div className="flex flex-wrap gap-1.5">
                  {biz.amenities.map(a => (
                    <span key={a} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: '#a3adc3' }}>
                      <Sparkles size={10} className="text-[#fbbf24]" /> {a}
                    </span>
                  ))}
                </div>
              </Sect>
            )}

            {/* ── Languages ───────────────────────────────── */}
            {biz.languages_spoken && biz.languages_spoken.length > 0 && (
              <Sect title="Languages">
                <div className="flex gap-1.5">
                  {biz.languages_spoken.map(l => (
                    <span key={l} className="text-[10px] font-medium px-2 py-0.5 rounded-lg" style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>{l}</span>
                  ))}
                </div>
              </Sect>
            )}

            {/* ── Contact ─────────────────────────────────── */}
            <Sect title="Contact">
              <div className="space-y-2">
                {(biz.address || biz.address_line1) && (
                  <InfoRow icon={<MapPin size={13} />} text={biz.address || `${biz.address_line1 || ''}${biz.address_city ? `, ${biz.address_city}` : ''}`} />
                )}
                {biz.phone && <InfoRow icon={<Phone size={13} />} text={biz.phone} />}
                {(biz.website || biz.domain) && <InfoRow icon={<Globe size={13} />} text={biz.website || biz.domain || ''} link />}
              </div>
            </Sect>
          </div>

          {/* ── Footer CTA ────────────────────────────────── */}
          <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {biz.phone && (
              <a href={`tel:${biz.phone}`} className="flex-1 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors hover:bg-white/5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#a3adc3' }}>
                <Phone size={15} /> Call
              </a>
            )}
            {biz.booking_enabled && (
              <button onClick={() => handleBook()} disabled={booking} className="flex-1 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50" style={{ background: '#00d4ff', color: '#0a0b0f' }}>
                <Bookmark size={15} /> {booking ? 'Booking...' : 'Book Now'}
              </button>
            )}
            {!biz.booking_enabled && !biz.phone && (
              <button className="flex-1 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer btn-primary">
                View Details
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
