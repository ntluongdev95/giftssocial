'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { MapPin } from 'lucide-react';
import { useLocationStore } from '@/stores/locationStore';
import CircleDetailSheet from '@/components/circles/CircleDetailSheet';
import BusinessCard from '@/components/cards/BusinessCard';
import EventCard from '@/components/cards/EventCard';
import OfferCard from '@/components/cards/OfferCard';
import AgentCard from '@/components/cards/AgentCard';
import CircleCard from '@/components/cards/CircleCard';
import ProfileCard from '@/components/cards/ProfileCard';
import type { NearbyResponse, Business, Event, Signal, Agent, Circle, Profile } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────

const TABS = ['Businesses', 'Events', 'Profiles', 'People', 'Offers', 'Agents'] as const;
type Tab = (typeof TABS)[number];

const SORTS = ['Closest', 'Trusted', 'Live Now', 'Relevant'] as const;
type Sort = (typeof SORTS)[number];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Skeleton Card ────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      className="animate-pulse rounded-2xl p-4"
      style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div className="flex gap-3.5">
        <div className="h-12 w-12 rounded-xl" style={{ background: 'rgba(24,28,36,0.5)' }} />
        <div className="flex-1 space-y-2.5">
          <div className="h-4 w-3/4 rounded-lg" style={{ background: 'rgba(24,28,36,0.4)' }} />
          <div className="h-3 w-1/2 rounded-lg" style={{ background: 'rgba(24,28,36,0.3)' }} />
          <div className="h-3 w-2/3 rounded-lg" style={{ background: 'rgba(24,28,36,0.2)' }} />
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────

function EmptyState({ onSelectCircle }: { onSelectCircle?: (c: Circle) => void }) {
  return (
    <div className="col-span-full flex flex-col items-center gap-5 py-12 text-center">
      {/* Empty icon */}
      <div
        className="h-14 w-14 rounded-2xl flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(99,102,241,0.08))',
          border: '1px solid rgba(0,212,255,0.12)',
        }}
      >
        <MapPin size={22} style={{ color: '#00d4ff' }} />
      </div>

      <div>
        <p className="text-sm font-medium text-white">Nothing found nearby</p>
        <p className="mt-1 text-xs" style={{ color: '#4a5068' }}>Try expanding your radius or switch categories</p>
      </div>

      <div className="flex gap-2">
        <button
          className="rounded-xl px-4 py-2 text-xs font-medium transition-all active:scale-95"
          style={{
            background: 'rgba(0,212,255,0.1)',
            border: '1px solid rgba(0,212,255,0.2)',
            color: '#00d4ff',
          }}
        >
          Expand radius
        </button>
        <button
          className="rounded-xl px-4 py-2 text-xs font-medium transition-all active:scale-95"
          style={{
            background: 'rgba(24,28,36,0.5)',
            border: '1px solid rgba(255,255,255,0.05)',
            color: '#a3adc3',
          }}
        >
          Try different category
        </button>
      </div>

      {/* Suggested circles — grid */}
      <div className="mt-6 w-full">
        <p className="text-left text-xs font-semibold mb-3" style={{ color: '#4a5068' }}>
          Suggested circles
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FALLBACK_CIRCLES.map((c) => (
            <CircleCard key={c.id} circle={c} onClick={() => onSelectCircle?.(c)} />
          ))}
        </div>
      </div>
    </div>
  );
}

const FALLBACK_CIRCLES: Circle[] = [
  {
    id: 'circle_seed_1',
    name: 'Dallas Foodies',
    slug: 'dallas-foodies',
    category: 'Food',
    city: 'Dallas',
    owner_id: 'user_system',
    visibility: 'public',
    verification_level: 1,
    trust_score: 72,
    trust_level: 'trusted',
    badges: ['active_community'],
    member_count: 184,
    event_count: 12,
    status: 'active',
    created_at: '',
    updated_at: '',
  },
  {
    id: 'circle_seed_2',
    name: 'DFW Tech Builders',
    slug: 'dfw-tech-builders',
    category: 'Tech',
    city: 'Dallas',
    owner_id: 'user_system',
    visibility: 'public',
    verification_level: 1,
    trust_score: 65,
    trust_level: 'trusted',
    badges: [],
    member_count: 97,
    event_count: 5,
    status: 'active',
    created_at: '',
    updated_at: '',
  },
  {
    id: 'circle_seed_3',
    name: 'Beauty & Wellness DFW',
    slug: 'beauty-wellness-dfw',
    category: 'Beauty',
    city: 'Dallas',
    owner_id: 'user_system',
    visibility: 'public',
    verification_level: 0,
    trust_score: 48,
    trust_level: 'verified',
    badges: [],
    member_count: 63,
    event_count: 3,
    status: 'active',
    created_at: '',
    updated_at: '',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────

export default function NearbyPage() {
  const { lat, lng } = useLocationStore();
  const [activeTab, setActiveTab] = useState<Tab>('Businesses');
  const [sort, setSort] = useState<Sort>('Closest');
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set('lat', String(lat ?? 32.7767));
    p.set('lng', String(lng ?? -96.797));
    p.set('radius', '5000');
    return p.toString();
  }, [lat, lng]);

  const { data, isLoading } = useSWR<{ data: NearbyResponse }>(
    `/api/v1/nearby?${queryParams}`,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      fallbackData: {
        data: { people: [], businesses: [], events: [], offers: [], agents: [], profiles: [] },
      },
    }
  );

  const nearby = data?.data ?? {
    people: [],
    businesses: [],
    events: [],
    offers: [],
    agents: [],
    profiles: [],
  };

  // Sort helper
  function sortItems<T extends { trust_score?: number }>(items: T[]): T[] {
    switch (sort) {
      case 'Trusted':
        return [...items].sort(
          (a, b) => (b.trust_score ?? 0) - (a.trust_score ?? 0)
        );
      default:
        return items;
    }
  }

  // Render cards for active tab
  const renderCards = () => {
    switch (activeTab) {
      case 'People':
        return nearby.people.length === 0 ? (
          <EmptyState onSelectCircle={setSelectedCircle} />
        ) : (
          nearby.people.map((u) => (
            <div
              key={u.id}
              className="rounded-xl border border-[#181c24]/30 bg-[#111318]/60 p-4"
            >
              <p className="text-sm font-medium text-[#f0f4ff]">
                {u.display_name}
              </p>
              <p className="text-xs text-[#4a5068]">
                Trust: {u.trust_score}
              </p>
            </div>
          ))
        );

      case 'Businesses': {
        const sorted = sortItems(nearby.businesses) as Business[];
        return sorted.length === 0 ? (
          <EmptyState onSelectCircle={setSelectedCircle} />
        ) : (
          sorted.map((b) => <BusinessCard key={b.id} business={b} />)
        );
      }

      case 'Events': {
        const sorted = sortItems(
          nearby.events.map((e) => ({ ...e, trust_score: 0 }))
        ) as (Event & { trust_score: number })[];
        return sorted.length === 0 ? (
          <EmptyState onSelectCircle={setSelectedCircle} />
        ) : (
          sorted.map((e) => <EventCard key={e.id} event={e} />)
        );
      }

      case 'Offers': {
        const offers = nearby.offers;
        return offers.length === 0 ? (
          <EmptyState onSelectCircle={setSelectedCircle} />
        ) : (
          offers.map((s) => <OfferCard key={s.id} signal={s} />)
        );
      }

      case 'Profiles': {
        const profs = nearby.profiles || [];
        return profs.length === 0 ? (
          <EmptyState onSelectCircle={setSelectedCircle} />
        ) : (
          profs.map((p) => <ProfileCard key={p._id} profile={p} />)
        );
      }

      case 'Agents': {
        const sorted = sortItems(nearby.agents) as Agent[];
        return sorted.length === 0 ? (
          <EmptyState onSelectCircle={setSelectedCircle} />
        ) : (
          sorted.map((a) => <AgentCard key={a.id} agent={a} />)
        );
      }
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Aurora */}
      <div className="aurora-gradient absolute inset-x-0 top-0 h-48 pointer-events-none" />

      {/* Header */}
      <div className="relative px-4 lg:px-8 pb-2 pt-[env(safe-area-inset-top,12px)] lg:pt-6">
        <h1 className="text-2xl font-bold text-[#f0f4ff]">Nearby</h1>
      </div>

      {/* Tab bar */}
      <div className="relative flex gap-1 overflow-x-auto px-4 lg:px-8 pb-2 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-[#00d4ff] bg-[#00d4ff]/10 text-[#00d4ff]'
                : 'text-[#4a5068] hover:text-[#f0f4ff]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="relative flex items-center gap-2 px-4 lg:px-8 pb-3">
        <span className="text-[10px] text-[#4a5068]">Sort:</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-lg border border-[#181c24]/40 bg-[#0a0b0f] px-2 py-1 text-[10px] text-[#f0f4ff] outline-none"
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Card list — grid on desktop */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {isLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            renderCards()
          )}
        </div>
      </div>

      {/* Circle detail sheet */}
      {selectedCircle && (
        <CircleDetailSheet
          circle={selectedCircle}
          onClose={() => setSelectedCircle(null)}
        />
      )}
    </div>
  );
}
