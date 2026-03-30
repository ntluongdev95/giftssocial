'use client';

import { useState } from 'react';
import { X, Calendar, Tag, Users, MapPin, Star, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Circle, Event, Signal } from '@/types';
import EventCard from '@/components/cards/EventCard';
import OfferCard from '@/components/cards/OfferCard';

// ─── Seed events & offers per circle category ─────────────────────────────

const CIRCLE_EVENTS: Record<string, Event[]> = {
  Food: [
    {
      id: 'ev_food_1', title: 'Taco & Tequila Night', description: 'Best tacos in Deep Ellum',
      host_type: 'circle', host_id: 'circle_1', visibility: 'public', verified: true,
      start_time: new Date(Date.now() + 86400_000).toISOString(),
      end_time: new Date(Date.now() + 86400_000 + 10800_000).toISOString(),
      location_lat: 32.785, location_lng: -96.783, status: 'scheduled',
      capacity: 50, joined_count: 32, checkin_count: 0, created_at: '', updated_at: '',
    },
    {
      id: 'ev_food_2', title: 'Farmers Market Tour', description: 'Explore Dallas Farmers Market',
      host_type: 'user', host_id: 'user_1', visibility: 'public', verified: true,
      start_time: new Date(Date.now() + 172800_000).toISOString(),
      end_time: new Date(Date.now() + 172800_000 + 7200_000).toISOString(),
      location_lat: 32.781, location_lng: -96.795, status: 'scheduled',
      capacity: 20, joined_count: 14, checkin_count: 0, created_at: '', updated_at: '',
    },
  ],
  Tech: [
    {
      id: 'ev_tech_1', title: 'AI & Web3 Meetup', description: 'Monthly builder meetup',
      host_type: 'circle', host_id: 'circle_2', visibility: 'public', verified: true,
      start_time: new Date(Date.now() + 259200_000).toISOString(),
      end_time: new Date(Date.now() + 259200_000 + 10800_000).toISOString(),
      location_lat: 32.789, location_lng: -96.801, status: 'scheduled',
      capacity: 80, joined_count: 56, checkin_count: 0, created_at: '', updated_at: '',
    },
  ],
  Beauty: [
    {
      id: 'ev_beauty_1', title: 'Glow Up Workshop', description: 'Skincare & wellness tips from local experts',
      host_type: 'business', host_id: 'biz_beauty_1', visibility: 'public', verified: true,
      start_time: new Date(Date.now() + 86400_000).toISOString(),
      end_time: new Date(Date.now() + 86400_000 + 7200_000).toISOString(),
      location_lat: 32.795, location_lng: -96.802, status: 'scheduled',
      capacity: 30, joined_count: 22, checkin_count: 0, created_at: '', updated_at: '',
    },
    {
      id: 'ev_beauty_2', title: 'Nail Art Masterclass', description: 'Learn the latest nail trends',
      host_type: 'business', host_id: 'biz_beauty_2', visibility: 'public', verified: true,
      start_time: new Date(Date.now() + 345600_000).toISOString(),
      end_time: new Date(Date.now() + 345600_000 + 5400_000).toISOString(),
      location_lat: 32.790, location_lng: -96.810, status: 'scheduled',
      capacity: 15, joined_count: 9, checkin_count: 0, created_at: '', updated_at: '',
    },
  ],
  Fitness: [
    {
      id: 'ev_fit_1', title: 'Sunrise Yoga in the Park', description: 'Free outdoor yoga session',
      host_type: 'circle', host_id: 'circle_4', visibility: 'public', verified: true,
      start_time: new Date(Date.now() + 43200_000).toISOString(),
      end_time: new Date(Date.now() + 43200_000 + 3600_000).toISOString(),
      location_lat: 32.777, location_lng: -96.787, status: 'scheduled',
      capacity: 40, joined_count: 28, checkin_count: 0, created_at: '', updated_at: '',
    },
  ],
  Crypto: [
    {
      id: 'ev_crypto_1', title: 'DeFi Dallas Hackathon', description: '48h build sprint',
      host_type: 'circle', host_id: 'circle_5', visibility: 'public', verified: true,
      start_time: new Date(Date.now() + 604800_000).toISOString(),
      end_time: new Date(Date.now() + 604800_000 + 172800_000).toISOString(),
      location_lat: 32.782, location_lng: -96.798, status: 'scheduled',
      capacity: 100, joined_count: 67, checkin_count: 0, created_at: '', updated_at: '',
    },
  ],
};

const CIRCLE_OFFERS: Record<string, Signal[]> = {
  Beauty: [
    {
      id: 'offer_beauty_1', type: 'offer', owner_type: 'business', owner_id: 'biz_beauty_1', category: 'Beauty',
      title: '30% Off First Visit — Luxe Nails DFW', description: 'New client special',
      location: { type: 'Point', coordinates: [-96.802, 32.795] },
      radius: 1000, visibility: 'public', verified: true, trust_score_snapshot: 72,
      status: 'active', starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 604800_000).toISOString(),
      metadata: { discount_percent: 30 }, created_at: new Date().toISOString(),
    },
    {
      id: 'offer_beauty_2', type: 'offer', owner_type: 'business', owner_id: 'biz_beauty_2', category: 'Beauty',
      title: 'Free Facial with Any Spa Package', description: 'This week only',
      location: { type: 'Point', coordinates: [-96.810, 32.790] },
      radius: 1000, visibility: 'public', verified: true, trust_score_snapshot: 65,
      status: 'active', starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 259200_000).toISOString(),
      metadata: { discount: 'Free facial' }, created_at: new Date().toISOString(),
    },
    {
      id: 'offer_beauty_3', type: 'offer', owner_type: 'business', owner_id: 'biz_beauty_3', category: 'Beauty',
      title: '$20 Off Hair Color — Studio 214', description: 'Mention Gao Social',
      location: { type: 'Point', coordinates: [-96.790, 32.800] },
      radius: 2000, visibility: 'public', verified: false, trust_score_snapshot: 48,
      status: 'active', starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 432000_000).toISOString(),
      metadata: { discount: '$20 off' }, created_at: new Date().toISOString(),
    },
  ],
  Food: [
    {
      id: 'offer_food_1', type: 'offer', owner_type: 'business', owner_id: 'biz_food_1', category: 'Food',
      title: 'Buy 1 Get 1 Free Boba — Tea Haus', description: 'Weekday special',
      location: { type: 'Point', coordinates: [-96.785, 32.783] },
      radius: 1500, visibility: 'public', verified: true, trust_score_snapshot: 80,
      status: 'active', starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 172800_000).toISOString(),
      metadata: { discount: 'BOGO' }, created_at: new Date().toISOString(),
    },
  ],
  Crypto: [
    {
      id: 'offer_crypto_1', type: 'offer', owner_type: 'business', owner_id: 'biz_crypto_1', category: 'Crypto',
      title: 'Free Coffee if You Pay with GAO', description: 'Crypto-friendly café',
      location: { type: 'Point', coordinates: [-96.798, 32.782] },
      radius: 500, visibility: 'public', verified: true, trust_score_snapshot: 70,
      status: 'active', starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 604800_000).toISOString(),
      metadata: { discount: 'Free coffee' }, created_at: new Date().toISOString(),
    },
  ],
};

// ─── Component ───────────────────────────────────────────────────────────

interface Props {
  circle: Circle;
  onClose: () => void;
}

type DetailTab = 'events' | 'offers';

export default function CircleDetailSheet({ circle, onClose }: Props) {
  const [tab, setTab] = useState<DetailTab>('events');
  const events = CIRCLE_EVENTS[circle.category] ?? [];
  const offers = CIRCLE_OFFERS[circle.category] ?? [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="w-full max-w-[560px] max-h-[85dvh] rounded-t-3xl lg:rounded-3xl flex flex-col overflow-hidden"
          style={{
            background: 'rgba(17,19,24,0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0,212,255,0.08)',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.5), 0 0 20px rgba(0,212,255,0.05)',
          }}
        >
          {/* Header */}
          <div className="flex items-start gap-3.5 p-5 pb-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl"
              style={{ background: 'rgba(0,212,255,0.1)' }}
            >
              {circle.category === 'Food' ? '🍜' : circle.category === 'Tech' ? '⚡' : circle.category === 'Beauty' ? '✨' : circle.category === 'Fitness' ? '💪' : '🔗'}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{circle.name}</h2>
              <p className="text-xs mt-0.5" style={{ color: '#4a5068' }}>
                {circle.category} · {circle.city} · {circle.member_count} members
              </p>
            </div>
            <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-[#4a5068] hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-5 mb-3">
            <button
              onClick={() => setTab('events')}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={tab === 'events' ? {
                background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(99,102,241,0.1))',
                border: '1px solid rgba(0,212,255,0.25)',
                color: '#00d4ff',
              } : {
                background: 'rgba(24,28,36,0.5)',
                border: '1px solid rgba(255,255,255,0.04)',
                color: '#4a5068',
              }}
            >
              <Calendar size={12} />
              Events ({events.length})
            </button>
            <button
              onClick={() => setTab('offers')}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={tab === 'offers' ? {
                background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(234,179,8,0.1))',
                border: '1px solid rgba(251,191,36,0.25)',
                color: '#fbbf24',
              } : {
                background: 'rgba(24,28,36,0.5)',
                border: '1px solid rgba(255,255,255,0.04)',
                color: '#4a5068',
              }}
            >
              <Tag size={12} />
              Offers ({offers.length})
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3">
            {tab === 'events' && (
              events.length > 0 ? (
                events.map((ev) => <EventCard key={ev.id} event={ev} />)
              ) : (
                <EmptyTab icon={<Calendar size={20} />} label="No upcoming events" />
              )
            )}
            {tab === 'offers' && (
              offers.length > 0 ? (
                offers.map((o) => <OfferCard key={o.id} signal={o} />)
              ) : (
                <EmptyTab icon={<Tag size={20} />} label="No active offers" />
              )
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function EmptyTab({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,212,255,0.08)', color: '#00d4ff' }}>
        {icon}
      </div>
      <p className="text-xs" style={{ color: '#4a5068' }}>{label}</p>
    </div>
  );
}
