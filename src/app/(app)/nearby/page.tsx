'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { MapPin, Navigation } from 'lucide-react';
import { toast } from 'sonner';
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

const RADIUS_OPTIONS = [
  { label: '10 km', value: 10000 },
  { label: '50 km', value: 50000 },
  { label: '100 km', value: 100000 },
  { label: '200 km', value: 200000 },
  { label: '500 km', value: 500000 },
];

function formatDistance(km?: number) {
  if (km == null || km <= 0) return null;
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 100) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

const TYPE_LABELS: Record<string, string> = { business: 'Business', circle: 'Circle', event: 'Event' };

function SuggestionCard({ item, onClick }: { item: { id: string; type: string; name: string; subtitle: string; distance_km?: number; color: string; icon: string }; onClick: () => void }) {
  return (
    <div onClick={onClick} className="group rounded-2xl p-4 transition-all hover:-translate-y-0.5 cursor-pointer" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)' }}>
      <div className="flex items-start gap-3.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: `${item.color}12`, border: `1px solid ${item.color}20` }}>
          {item.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-white group-hover:text-[#00d4ff] transition-colors">{item.name}</h3>
            <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: `${item.color}12`, color: item.color }}>
              {TYPE_LABELS[item.type] || item.type}
            </span>
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: '#6b7a94' }}>{item.subtitle}</p>
          <div className="flex items-center gap-3 mt-2">
            {item.distance_km != null && item.distance_km > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: '#00d4ff' }}>
                <MapPin size={10} /> {formatDistance(item.distance_km)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ lat, lng, onSelectBusiness, onSelectCircle, onSelectEvent, onExpandRadius, onSwitchCategory, radius }: {
  lat?: number; lng?: number;
  onSelectBusiness?: (b: Business) => void;
  onSelectCircle?: (c: Circle) => void;
  onSelectEvent?: (e: Event) => void;
  onExpandRadius?: () => void;
  onSwitchCategory?: () => void;
  radius?: number;
}) {
  const { data: suggestData } = useSWR<{ data: NearbyResponse }>(
    lat != null ? `/api/v1/nearby?lat=${lat}&lng=${lng}&radius=500000&limit=10` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const suggestions = useMemo(() => {
    if (!suggestData?.data) return [];
    const items: { id: string; type: string; name: string; subtitle: string; distance_km?: number; color: string; icon: string; raw: unknown }[] = [];

    for (const b of (suggestData.data.businesses || [])) {
      items.push({ id: b.id, type: 'business', name: b.name, subtitle: `${b.category}${b.city ? ` · ${b.city}` : ''}`, distance_km: (b as unknown as Record<string, unknown>).distance_km as number, color: '#22c55e', icon: '🏪', raw: b });
    }
    for (const c of (suggestData.data.circles || [])) {
      items.push({ id: c.id, type: 'circle', name: c.name, subtitle: `${c.category} · ${c.member_count} members`, distance_km: (c as unknown as Record<string, unknown>).distance_km as number, color: '#3b82f6', icon: '👥', raw: c });
    }
    for (const e of (suggestData.data.events || [])) {
      items.push({ id: e.id, type: 'event', name: e.title, subtitle: `${e.location_name || e.city || 'Event'}`, distance_km: (e as unknown as Record<string, unknown>).distance_km as number, color: '#ef4444', icon: '📅', raw: e });
    }

    return items.sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999)).slice(0, 8);
  }, [suggestData]);

  const handleClick = (item: typeof suggestions[0]) => {
    if (item.type === 'business') onSelectBusiness?.(item.raw as Business);
    else if (item.type === 'circle') onSelectCircle?.(item.raw as Circle);
    else if (item.type === 'event') onSelectEvent?.(item.raw as Event);
  };

  return (
    <div className="col-span-full">
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(99,102,241,0.08))', border: '1px solid rgba(0,212,255,0.12)' }}>
          <MapPin size={22} style={{ color: '#00d4ff' }} />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Nothing found nearby</p>
          <p className="mt-1 text-xs" style={{ color: '#4a5068' }}>Current radius: {radius && radius >= 1000 ? `${(radius / 1000).toFixed(0)}km` : '50km'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onExpandRadius} className="rounded-xl px-4 py-2 text-xs font-medium transition-all active:scale-95 cursor-pointer" style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}>
            Change radius
          </button>
          <button onClick={onSwitchCategory} className="rounded-xl px-4 py-2 text-xs font-medium transition-all active:scale-95 cursor-pointer" style={{ background: 'rgba(24,28,36,0.5)', border: '1px solid rgba(255,255,255,0.05)', color: '#a3adc3' }}>
            Try different category
          </button>
        </div>
      </div>

      {/* Suggestions from API — mixed types with distance */}
      {suggestions.length > 0 && (
        <div className="mt-6 w-full text-left">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">Discover nearby</h3>
            <span className="text-[10px] font-medium" style={{ color: '#4a5068' }}>within 500km</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {suggestions.map((item) => (
              <SuggestionCard key={item.id} item={item} onClick={() => handleClick(item)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function NearbyPage() {
  const { lat, lng, granted, requestLocation } = useLocationStore();
  const [activeTab, setActiveTab] = useState<Tab>('Businesses');
  const [radius, setRadius] = useState(50000);
  const [showRadiusPicker, setShowRadiusPicker] = useState(false);
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
    p.set('radius', String(radius));
    return p.toString();
  }, [lat, lng, radius]);

  const handleExpandRadius = () => {
    setShowRadiusPicker(true);
  };

  const handleSwitchCategory = () => {
    const currentIdx = TABS.indexOf(activeTab);
    const nextIdx = (currentIdx + 1) % TABS.length;
    setActiveTab(TABS[nextIdx]);
    toast.info(`Switched to ${TABS[nextIdx]}`);
  };

  // Matched people nearby — only fetch when location granted
  const { data: matchedPeople } = useSWR(
    granted ? `/api/v1/match?type=people_nearby&${queryParams}` : null,
    (url: string) => fetch(url, { }).then(r => r.json()),
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

  const raw = data?.data;
  const nearby = {
    people: Array.isArray(raw?.people) ? raw.people : [],
    businesses: Array.isArray(raw?.businesses) ? raw.businesses : [],
    events: Array.isArray(raw?.events) ? raw.events : [],
    offers: Array.isArray(raw?.offers) ? raw.offers : [],
    agents: Array.isArray(raw?.agents) ? raw.agents : [],
    profiles: Array.isArray(raw?.profiles) ? raw.profiles : [],
    circles: Array.isArray(raw?.circles) ? raw.circles : [],
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
          <EmptyState lat={lat ?? undefined} lng={lng ?? undefined} onSelectBusiness={setSelectedBusiness} onSelectCircle={setSelectedCircle} onSelectEvent={setSelectedEvent} onExpandRadius={handleExpandRadius} onSwitchCategory={handleSwitchCategory} radius={radius} />
        ) : (
          sorted.map((b) => <BusinessCard key={b.id} business={b} onClick={() => setSelectedBusiness(b)} />)
        );
      }

      case 'Events': {
        const evts = nearby.events || [];
        return evts.length === 0 ? (
          <EmptyState lat={lat ?? undefined} lng={lng ?? undefined} onSelectBusiness={setSelectedBusiness} onSelectCircle={setSelectedCircle} onSelectEvent={setSelectedEvent} onExpandRadius={handleExpandRadius} onSwitchCategory={handleSwitchCategory} radius={radius} />
        ) : (
          evts.map((e) => <EventCard key={e.id} event={e} onClick={() => setSelectedEvent(e)} />)
        );
      }

      case 'Circles': {
        const cirs = nearby.circles || [];
        return cirs.length === 0 ? (
          <EmptyState lat={lat ?? undefined} lng={lng ?? undefined} onSelectBusiness={setSelectedBusiness} onSelectCircle={setSelectedCircle} onSelectEvent={setSelectedEvent} onExpandRadius={handleExpandRadius} onSwitchCategory={handleSwitchCategory} radius={radius} />
        ) : (
          cirs.map((c) => <CircleCard key={c.id} circle={c} isMember={joinedCircleIds.has(c.id)} isPending={pendingCircleIds.has(c.id)} onClick={() => setSelectedCircle(c)} />)
        );
      }

      case 'Signals': {
        const rawSignals = (data?.data as Record<string, unknown> | undefined)?.signals;
        const sigs = (Array.isArray(rawSignals) ? rawSignals : []) as Record<string, unknown>[];
        return sigs.length === 0 ? (
          <EmptyState lat={lat ?? undefined} lng={lng ?? undefined} onSelectBusiness={setSelectedBusiness} onSelectCircle={setSelectedCircle} onSelectEvent={setSelectedEvent} onExpandRadius={handleExpandRadius} onSwitchCategory={handleSwitchCategory} radius={radius} />
        ) : (
          sigs.map((s) => <SignalCard key={s.id as string} signal={s} onClick={() => setSelectedSignal(s)} />)
        );
      }

      case 'Offers': {
        const offers = nearby.offers;
        return offers.length === 0 ? (
          <EmptyState lat={lat ?? undefined} lng={lng ?? undefined} onSelectBusiness={setSelectedBusiness} onSelectCircle={setSelectedCircle} onSelectEvent={setSelectedEvent} onExpandRadius={handleExpandRadius} onSwitchCategory={handleSwitchCategory} radius={radius} />
        ) : (
          offers.map((s) => <OfferCard key={s.id} signal={s} />)
        );
      }

      case 'Profiles': {
        const matched = (matchedPeople?.data || []) as Profile[];
        const profs = matched.length > 0 ? matched : (nearby.profiles || []);
        return profs.length === 0 ? (
          <EmptyState lat={lat ?? undefined} lng={lng ?? undefined} onSelectBusiness={setSelectedBusiness} onSelectCircle={setSelectedCircle} onSelectEvent={setSelectedEvent} onExpandRadius={handleExpandRadius} onSwitchCategory={handleSwitchCategory} radius={radius} />
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

      {/* Radius picker popup */}
      {showRadiusPicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowRadiusPicker(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-xs rounded-2xl overflow-hidden" style={{ background: 'rgba(10,11,15,0.98)', border: '1px solid rgba(0,212,255,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-2">
              <h3 className="text-sm font-bold text-white">Search Radius</h3>
              <p className="text-[10px] text-[#4a5068] mt-0.5">Select how far to search</p>
            </div>
            <div className="px-5 pb-5 space-y-2">
              {RADIUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setRadius(opt.value);
                    setShowRadiusPicker(false);
                    toast.success(`Searching within ${opt.label}...`);
                  }}
                  className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium cursor-pointer transition-all"
                  style={radius === opt.value
                    ? { background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }
                    : { background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)', color: '#a3adc3' }
                  }
                >
                  <span>{opt.label}</span>
                  {radius === opt.value && <span className="text-[10px] font-semibold text-[#00d4ff]">Current</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
