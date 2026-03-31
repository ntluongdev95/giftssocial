'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { Search, Layers, X, MapPin, Loader2, Store } from 'lucide-react';
import { useLocationStore } from '@/stores/locationStore';
import { useMapStore } from '@/stores/mapStore';
import { useDeveloperStore } from '@/stores/developerStore';
import { useMapMarkers } from '@/components/map/useMapMarkers';
import { useMap } from '@/components/map/WorldMap';
import LayerFilterPanel from '@/components/map/LayerFilterPanel';
import MarkerDetailSheet from '@/components/map/MarkerDetailSheet';
import DeveloperProfileSheet from '@/components/developers/DeveloperProfileSheet';
import ProfileSheet from '@/components/profiles/ProfileSheet';
import BusinessSheet from '@/components/map/BusinessSheet';
import EventSheet from '@/components/map/EventSheet';
import type { Signal, Agent, Profile, Business, Event, EntityType } from '@/types';

// Dynamic import — MapLibre needs browser
const WorldMap = dynamic(() => import('@/components/map/WorldMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0a0b0f]">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#111318] border-t-[#00d4ff]" />
    </div>
  ),
});

// ─── Fetcher ──────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url, {
    headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
  }).then((r) => r.json());

// ─── Time filter options ──────────────────────────────────────────────────

const TIME_FILTERS = ['live', '24h', '7d'] as const;

// ─── Inner component (needs MapContext) ───────────────────────────────────

function WorldMapInner({
  signals,
  agents,
  profiles,
  businesses,
  events,
}: {
  signals: Signal[];
  agents: Agent[];
  profiles: Profile[];
  businesses: Business[];
  events: Event[];
}) {
  const { map } = useMap();
  useMapMarkers(map, signals, agents, profiles, businesses, events);
  return null;
}

// ─── World Page ───────────────────────────────────────────────────────────

export default function WorldPage() {
  const { lat, lng, granted, requestLocation } = useLocationStore();
  const { timeFilter, setTimeFilter, viewMode, setViewMode, selectedMarkerId, markers, setSelectedMarker } =
    useMapStore();
  const { developers } = useDeveloperStore();
  const [showLayers, setShowLayers] = useState(true);

  // ── Search ──────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; place_name: string; center: [number, number]; type?: 'place' | 'business' }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || '';

  const searchGeocode = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      // Try MapTiler first
      const res = await fetch(
        `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${MAPTILER_KEY}&limit=5`
      );
      const data = await res.json();
      let results = (data.features || []).map((f: any) => ({
        id: f.id,
        place_name: f.place_name,
        center: f.center as [number, number],
      }));

      // If no good address match (query has numbers but results don't), use Nominatim (OpenStreetMap) as fallback
      const hasNumber = /\d/.test(q);
      const hasExactMatch = results.some((r: any) => /\d/.test(r.place_name.split(',')[0]));

      if (hasNumber && !hasExactMatch) {
        try {
          const osmRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`,
            { headers: { 'User-Agent': 'GaoSocial/1.0' } }
          );
          const osmData = await osmRes.json();
          const osmResults = osmData.map((r: any) => ({
            id: `osm_${r.place_id}`,
            place_name: r.display_name,
            center: [parseFloat(r.lon), parseFloat(r.lat)] as [number, number],
          }));
          // Prepend OSM results (more precise for addresses)
          if (osmResults.length > 0) {
            results = [...osmResults, ...results].slice(0, 6);
          }
        } catch {
          // OSM fallback failed — keep MapTiler results
        }
      }

      // Also search businesses in parallel
      try {
        const bizRes = await fetch(`/api/v1/businesses?q=${encodeURIComponent(q)}&limit=5`);
        const bizData = await bizRes.json();
        const bizResults = (bizData.data || []).map((b: any) => ({
          id: `biz_search_${b.id}`,
          place_name: `${b.name} · ${b.category} · ${b.city || b.address || ''}`,
          center: [b.location_lng, b.location_lat] as [number, number],
          type: 'business' as const,
        }));
        if (bizResults.length > 0) {
          results = [...bizResults, ...results].slice(0, 8);
        }
      } catch { /* ignore */ }

      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [MAPTILER_KEY]);

  const handleSearchInput = useCallback((val: string) => {
    setSearchQuery(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => searchGeocode(val), 300);
  }, [searchGeocode]);

  const handleSelectPlace = useCallback((result: typeof searchResults[0]) => {
    setSearchQuery(result.place_name);
    setSearchResults([]);
    setSearchFocused(false);

    // Detect zoom level — address/house = zoom 18, city = 12, country = 5
    const name = result.place_name.toLowerCase();
    const isAddress = /\d/.test(name.split(',')[0]); // has number in first part = street address
    const zoom = isAddress ? 18 : name.split(',').length >= 3 ? 15 : 12;

    window.dispatchEvent(new CustomEvent('gao-fly-to', {
      detail: { lng: result.center[0], lat: result.center[1], zoom, label: result.place_name }
    }));
  }, []);

  // Auto-request location on mount (browser handles the permission prompt)
  useEffect(() => {
    if (granted) return;
    navigator.permissions?.query({ name: 'geolocation' }).then((result) => {
      if (result.state === 'granted' || result.state === 'prompt') {
        requestLocation();
      }
      // 'denied' → do nothing
    }).catch(() => {
      // Permissions API not supported — try requesting directly
      requestLocation();
    });
  }, [granted, requestLocation]);

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (lat !== null && lng !== null) {
      params.set('lat', String(lat));
      params.set('lng', String(lng));
    } else {
      params.set('lat', '32.7767');
      params.set('lng', '-96.7970');
    }
    params.set('radius', '5000');
    params.set('time', timeFilter);
    return params.toString();
  }, [lat, lng, timeFilter]);

  // Fetch signals
  const { data: signalsData } = useSWR<{ data: Signal[] }>(
    `/api/v1/signals?${queryParams}`,
    fetcher,
    { refreshInterval: 30000, fallbackData: { data: [] } }
  );

  // Fetch agents
  const { data: agentsData } = useSWR<{ data: Agent[] }>(
    `/api/v1/agents?${queryParams}`,
    fetcher,
    { refreshInterval: 30000, fallbackData: { data: [] } }
  );

  // Fetch profiles
  const { data: profilesData } = useSWR<{ data: Profile[] }>(
    `/api/v1/profiles?${queryParams}&available=true`,
    fetcher,
    { refreshInterval: 60000, fallbackData: { data: [] } }
  );

  // Fetch businesses
  const { data: businessesData } = useSWR<{ data: Business[] }>(
    `/api/v1/businesses?${queryParams}`,
    fetcher,
    { refreshInterval: 60000, fallbackData: { data: [] } }
  );

  // Fetch events
  const { data: eventsData } = useSWR<{ data: Event[] }>(
    `/api/v1/events?${queryParams}`,
    fetcher,
    { refreshInterval: 60000, fallbackData: { data: [] } }
  );

  const signals = signalsData?.data ?? [];
  const agents = agentsData?.data ?? [];
  const profiles = profilesData?.data ?? [];
  const businesses = businessesData?.data ?? [];
  const events = eventsData?.data ?? [];

  // Count for summary
  const counts = useMemo(() => ({
    signals: signals.length,
    events: events.length,
    offers: signals.filter(s => s.type === 'offer').length,
    businesses: businesses.length,
    profiles: profiles.length,
  }), [signals, events, businesses, profiles]);

  // Selected marker detail
  const selectedMarker = selectedMarkerId
    ? markers.get(selectedMarkerId)
    : null;

  // Check if selected marker is a developer
  const selectedDeveloper = selectedMarkerId
    ? developers.find((d) => d.id === selectedMarkerId)
    : null;

  // Check if selected marker is a profile
  const selectedProfile = selectedMarkerId
    ? profiles.find((p) => p._id === selectedMarkerId)
    : null;

  // Check if selected marker is a business
  const selectedBusiness = selectedMarkerId
    ? businesses.find((b) => b.id === selectedMarkerId)
    : null;

  // Check if selected marker is an event
  const selectedEvent = selectedMarkerId
    ? events.find((e) => e.id === selectedMarkerId)
    : null;

  const handleMapReady = useCallback(() => {
    // Map ready — could subscribe to WebSocket here
  }, []);

  return (
    <div className="relative h-full w-full">
      <WorldMap onMapReady={handleMapReady}>
        {/* Marker sync */}
        <WorldMapInner signals={signals} agents={agents} profiles={profiles} businesses={businesses} events={events} />

        {/* ── Top Bar ─────────────────────────────────── */}
        <div className="absolute left-0 right-0 top-0 z-30">
          {/* Search + controls */}
          <div className="flex items-center gap-2 px-4 pb-1 pt-[env(safe-area-inset-top,12px)] lg:pt-4 lg:px-6 max-w-4xl lg:mx-auto">
            {/* Search — mobile: icon only, expand on tap */}
            {/* Mobile search icon */}
            <button
              onClick={() => { setSearchExpanded(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
              className="flex lg:hidden items-center justify-center rounded-xl px-3 py-2.5 transition-colors"
              style={{ background: 'rgba(10,11,15,0.7)', border: '1px solid rgba(0,212,255,0.1)' }}
            >
              <Search size={15} style={{ color: '#4a5068' }} />
            </button>

            {/* Mobile expanded search overlay */}
            {searchExpanded && (
              <div className="fixed inset-x-0 top-0 z-50 lg:hidden px-4 pt-[env(safe-area-inset-top,12px)]" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(16px)' }}>
                <div className="flex items-center gap-2">
                  <div
                    className="relative flex-1 flex items-center gap-2 rounded-xl px-3 py-2"
                    style={{ background: 'rgba(10,11,15,0.95)', border: '1px solid rgba(0,212,255,0.4)', boxShadow: '0 0 20px rgba(0,212,255,0.15)' }}
                  >
                    {searchLoading ? (
                      <Loader2 size={15} className="animate-spin shrink-0" style={{ color: '#00d4ff' }} />
                    ) : (
                      <Search size={15} className="shrink-0" style={{ color: '#00d4ff' }} />
                    )}
                    <input
                      ref={searchInputRef}
                      value={searchQuery}
                      onChange={(e) => handleSearchInput(e.target.value)}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                      placeholder="Search places, cities, countries…"
                      className="flex-1 bg-transparent text-sm text-white placeholder:text-[#4a5068] outline-none"
                    />
                    {searchQuery && (
                      <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="shrink-0" style={{ color: '#4a5068' }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => { setSearchExpanded(false); setSearchFocused(false); setSearchQuery(''); setSearchResults([]); }}
                    className="text-xs font-medium py-2 px-2"
                    style={{ color: '#a3adc3' }}
                  >
                    Cancel
                  </button>
                </div>
                {/* Mobile search results */}
                {searchResults.length > 0 && (
                  <div
                    className="mt-1.5 rounded-xl overflow-hidden"
                    style={{ background: 'rgba(10,11,15,0.95)', border: '1px solid rgba(0,212,255,0.12)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}
                  >
                    {searchResults.map((r) => (
                      <button
                        key={r.id}
                        onMouseDown={() => { handleSelectPlace(r); setSearchExpanded(false); }}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[rgba(0,212,255,0.06)]"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                      >
                        {r.type === 'business'
                          ? <Store size={13} className="shrink-0" style={{ color: '#34d399' }} />
                          : <MapPin size={13} className="shrink-0" style={{ color: '#00d4ff' }} />
                        }
                        <span className="text-xs text-[#a3adc3] truncate">{r.place_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Desktop search — always visible */}
            <div className="relative flex-1 hidden lg:block">
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all"
                style={{
                  background: 'rgba(10,11,15,0.95)',
                  border: searchFocused ? '1px solid rgba(0,212,255,0.4)' : '1px solid rgba(0,212,255,0.1)',
                  boxShadow: searchFocused ? '0 0 20px rgba(0,212,255,0.15)' : 'none',
                  backdropFilter: 'blur(16px)',
                }}
              >
                {searchLoading ? (
                  <Loader2 size={15} className="animate-spin shrink-0" style={{ color: '#00d4ff' }} />
                ) : (
                  <Search size={15} className="shrink-0" style={{ color: searchFocused ? '#00d4ff' : '#4a5068' }} />
                )}
                <input
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  placeholder="Search places, cities, countries…"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-[#4a5068] outline-none"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="shrink-0" style={{ color: '#4a5068' }}>
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Desktop results dropdown */}
              {searchFocused && searchResults.length > 0 && (
                <div
                  className="absolute left-0 right-0 top-full mt-1.5 rounded-xl overflow-hidden z-50"
                  style={{
                    background: 'rgba(10,11,15,0.95)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(0,212,255,0.12)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  }}
                >
                  {searchResults.map((r) => (
                    <button
                      key={r.id}
                      onMouseDown={() => handleSelectPlace(r)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[rgba(0,212,255,0.06)]"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                    >
                      {r.type === 'business'
                        ? <Store size={13} className="shrink-0" style={{ color: '#34d399' }} />
                        : <MapPin size={13} className="shrink-0" style={{ color: '#00d4ff' }} />
                      }
                      <span className="text-xs text-[#a3adc3] truncate">{r.place_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Layers toggle */}
            <button
              onClick={() => setShowLayers((v) => !v)}
              className={`flex items-center gap-1 rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors ${
                showLayers
                  ? 'border-[#00d4ff]/60 bg-[#0a0b0f]/95 text-[#00d4ff]'
                  : 'border-[rgba(0,212,255,0.15)]/40 bg-[#0a0b0f]/95 text-[#4a5068]'
              }`}
            >
              <Layers size={14} />
            </button>

            {/* 2D / 3D segment toggle */}
            <div className="flex items-center gap-0.5 rounded-xl border border-[rgba(0,212,255,0.15)] bg-[#0a0b0f]/95 px-1 py-1">
              <button
                onClick={() => setViewMode('2d')}
                className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors ${
                  viewMode === '2d'
                    ? 'bg-[#00d4ff]/20 text-[#00d4ff]'
                    : 'text-[#4a5068] hover:text-[#f0f4ff]'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" />
                </svg>
                Flat
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors ${
                  viewMode === '3d'
                    ? 'bg-[#00d4ff]/20 text-[#00d4ff]'
                    : 'text-[#4a5068] hover:text-[#f0f4ff]'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                Globe
              </button>
            </div>
          </div>

          {/* Layer chips */}
          {showLayers && <LayerFilterPanel />}
        </div>

        {/* ── Bottom Summary Grid ─────────────────────── */}
        <div className="absolute bottom-16 lg:bottom-4 left-0 right-0 z-30 max-w-md lg:mx-auto">
          <div
            className="mx-4 rounded-2xl px-4 py-4"
            style={{
              background: 'rgba(10,11,15,0.92)',
              border: '1px solid rgba(0,212,255,0.08)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Live Signals', sub: `${counts.signals} nearby`, count: counts.signals, color: '#3B82F6' },
                { label: 'Events Tonight', sub: `${counts.events} upcoming`, count: counts.events, color: '#EF4444' },
                { label: 'Active Deals', sub: `${counts.offers} offers`, count: counts.offers, color: '#EAB308' },
                { label: 'Businesses', sub: `${counts.businesses} open`, count: counts.businesses, color: '#22C55E' },
              ].map(({ label, sub, count, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-2xl font-black" style={{ color }}>{count}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#f0f4ff] truncate">{label}</p>
                    <p className="text-[10px] text-[#4a5068] truncate">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Marker Detail Sheet ─────────────────────── */}
        {selectedMarker && !selectedDeveloper && !selectedProfile && !selectedBusiness && !selectedEvent && (
          <MarkerDetailSheet
            entityType={selectedMarker.entity_type as EntityType}
            data={selectedMarker.metadata ?? { name: selectedMarker.title }}
          />
        )}

        {/* ── Developer CV Sheet ───────────────────────── */}
        {selectedDeveloper && (
          <DeveloperProfileSheet
            developer={selectedDeveloper}
            onClose={() => setSelectedMarker(null)}
          />
        )}

        {/* ── Profile Sheet ───────────────────────────── */}
        {selectedProfile && (
          <ProfileSheet
            profile={selectedProfile}
            onClose={() => setSelectedMarker(null)}
          />
        )}

        {/* ── Business Sheet ──────────────────────────── */}
        {selectedBusiness && (
          <BusinessSheet
            business={selectedBusiness}
            onClose={() => setSelectedMarker(null)}
          />
        )}

        {/* ── Event Sheet ─────────────────────────────── */}
        {selectedEvent && (
          <EventSheet
            event={selectedEvent}
            onClose={() => setSelectedMarker(null)}
          />
        )}
      </WorldMap>
    </div>
  );
}
