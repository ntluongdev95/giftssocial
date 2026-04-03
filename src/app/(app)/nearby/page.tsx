'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { MapPin, Navigation } from 'lucide-react';
import { useLocationStore } from '@/stores/locationStore';
import CircleDetailSheet from '@/components/circles/CircleDetailSheet';
import BusinessCard from '@/components/cards/BusinessCard';
import EventCard from '@/components/cards/EventCard';
import OfferCard from '@/components/cards/OfferCard';
import CircleCard from '@/components/cards/CircleCard';
import { useJoinedCircles } from '@/hooks/useJoinedCircles';
import ProfileCard from '@/components/cards/ProfileCard';
import SignalCard from '@/components/cards/SignalCard';
import BusinessDetailPage from '@/components/business/BusinessDetailPage';
import EventDetailPage from '@/components/events/EventDetailPage';
import SignalSheet from '@/components/map/SignalSheet';
import type { NearbyResponse, Business, Event, Circle, Profile } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────

const TABS = ['Businesses', 'Events', 'Circles', 'Signals', 'Profiles', 'Offers'] as const;
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
  const { lat, lng, granted, requestLocation } = useLocationStore();
  const [activeTab, setActiveTab] = useState<Tab>('Businesses');
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Always refresh location on mount — localStorage is just fallback while GPS loads
  useEffect(() => {
    if (granted) requestLocation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [sort, setSort] = useState<Sort>('Closest');
  const { joinedCircleIds, pendingCircleIds } = useJoinedCircles();
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<Record<string, unknown> | null>(null);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set('lat', String(lat ?? 32.7767));
    p.set('lng', String(lng ?? -96.797));
    p.set('radius', '50000');
    return p.toString();
  }, [lat, lng]);

  // Matched people nearby — only fetch when location granted
  const { data: matchedPeople } = useSWR(
    granted ? `/api/v1/match?type=people_nearby&${queryParams}` : null,
    (url: string) => fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` } }).then(r => r.json()),
    { revalidateOnFocus: false }
  );

  const { data, isLoading } = useSWR<{ data: NearbyResponse }>(
    granted ? `/api/v1/nearby?${queryParams}` : null,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      fallbackData: {
        data: { people: [], businesses: [], events: [], offers: [], agents: [], profiles: [], circles: [] },
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
    circles: [],
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
      case 'Businesses': {
        const sorted = sortItems(nearby.businesses) as Business[];
        return sorted.length === 0 ? (
          <EmptyState onSelectCircle={setSelectedCircle} />
        ) : (
          sorted.map((b) => <BusinessCard key={b.id} business={b} onClick={() => setSelectedBusiness(b)} />)
        );
      }

      case 'Events': {
        const evts = nearby.events || [];
        return evts.length === 0 ? (
          <EmptyState onSelectCircle={setSelectedCircle} />
        ) : (
          evts.map((e) => <EventCard key={e.id} event={e} onClick={() => setSelectedEvent(e)} />)
        );
      }

      case 'Circles': {
        const cirs = nearby.circles || [];
        return cirs.length === 0 ? (
          <EmptyState onSelectCircle={setSelectedCircle} />
        ) : (
          cirs.map((c) => <CircleCard key={c.id} circle={c} isMember={joinedCircleIds.has(c.id)} isPending={pendingCircleIds.has(c.id)} onClick={() => setSelectedCircle(c)} />)
        );
      }

      case 'Signals': {
        const sigs = ((nearby as unknown as Record<string, unknown>).signals as Record<string, unknown>[]) || [];
        return sigs.length === 0 ? (
          <EmptyState onSelectCircle={setSelectedCircle} />
        ) : (
          sigs.map((s) => <SignalCard key={s.id as string} signal={s} onClick={() => setSelectedSignal(s)} />)
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
        const matched = (matchedPeople?.data || []) as Profile[];
        const profs = matched.length > 0 ? matched : (nearby.profiles || []);
        return profs.length === 0 ? (
          <EmptyState onSelectCircle={setSelectedCircle} />
        ) : (
          profs.map((p) => <ProfileCard key={p._id} profile={p} />)
        );
      }
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Aurora */}
      <div className="aurora-gradient absolute inset-x-0 top-0 h-48 pointer-events-none" />

      {/* Tab bar */}
      <div className="relative flex gap-1 overflow-x-auto px-4 lg:px-8 pt-[calc(env(safe-area-inset-top,12px)+24px)] lg:pt-8 pb-2 scrollbar-hide">
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

      {/* Sort — inline chips */}
      <div className="relative flex items-center gap-1.5 px-4 lg:px-8 pb-3 overflow-x-auto scrollbar-hide">
        {SORTS.map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors cursor-pointer ${
              sort === s
                ? 'bg-[#00d4ff]/10 text-[#00d4ff]'
                : 'text-[#4a5068] hover:text-[#a3adc3]'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Card list — grid on desktop */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-8 pb-20">
        {!mounted ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : !granted ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: 'rgba(0,212,255,0.1)' }}
            >
              <Navigation size={28} style={{ color: '#00d4ff' }} />
            </div>
            <h2 className="text-lg font-bold text-[#f0f4ff]">Enable Location</h2>
            <p className="max-w-xs text-sm text-[#4a5068]">
              Allow location access to discover businesses, events, and circles near you.
            </p>
            <button
              onClick={() => requestLocation()}
              className="rounded-xl bg-[#00d4ff] px-8 py-3 text-sm font-semibold text-[#0a0b0f] cursor-pointer"
            >
              Allow Location
            </button>
          </div>
        ) : (
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
        )}
      </div>

      {/* Circle detail sheet */}
      {selectedCircle && (
        <CircleDetailSheet
          circle={selectedCircle}
          onClose={() => setSelectedCircle(null)}
        />
      )}

      {/* Business detail — full page slide from right */}
      {selectedBusiness && (
        <BusinessDetailPage
          business={selectedBusiness}
          onClose={() => setSelectedBusiness(null)}
        />
      )}

      {/* Event detail — full page slide from right */}
      {selectedEvent && (
        <EventDetailPage
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* Signal detail popup */}
      {selectedSignal && (
        <SignalSheet
          signal={{
            id: selectedSignal.id as string,
            title: selectedSignal.title as string,
            type: selectedSignal.type as string,
            description: selectedSignal.description as string,
            category: selectedSignal.category as string,
            owner_id: selectedSignal.author_id as string,
            author_id: selectedSignal.author_id as string,
            author_name: selectedSignal.author_name as string,
            author_username: selectedSignal.author_username as string,
            author_avatar: selectedSignal.author_avatar as string,
            author_trust_level: selectedSignal.author_trust_level as string,
            created_at: selectedSignal.created_at as string,
            expires_at: selectedSignal.expires_at as string,
          }}
          onClose={() => setSelectedSignal(null)}
        />
      )}
    </div>
  );
}
