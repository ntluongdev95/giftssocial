'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { Search, Layers, ChevronDown, X, MapPin, Loader2 } from 'lucide-react';
import { useLocationStore } from '@/stores/locationStore';
import { useMapStore } from '@/stores/mapStore';
import { useDeveloperStore } from '@/stores/developerStore';
import { useMapMarkers } from '@/components/map/useMapMarkers';
import { useMap } from '@/components/map/WorldMap';
import LayerFilterPanel from '@/components/map/LayerFilterPanel';
import MarkerDetailSheet from '@/components/map/MarkerDetailSheet';
import DeveloperProfileSheet from '@/components/developers/DeveloperProfileSheet';
import type { Signal, Agent, EntityType } from '@/types';

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

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Time filter options ──────────────────────────────────────────────────

const TIME_FILTERS = ['live', '24h', '7d'] as const;

// ─── Inner component (needs MapContext) ───────────────────────────────────

function WorldMapInner({
  signals,
  agents,
}: {
  signals: Signal[];
  agents: Agent[];
}) {
  const { map } = useMap();
  useMapMarkers(map, signals, agents);
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
  const [searchResults, setSearchResults] = useState<Array<{ id: string; place_name: string; center: [number, number] }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
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

  // Request location on mount
  useEffect(() => {
    if (!granted) {
      requestLocation();
    }
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

  const signals = signalsData?.data ?? [];
  const agents = agentsData?.data ?? [];

  // Count signals by type for summary
  const counts = useMemo(() => {
    const c = { signals: signals.length, events: 0, offers: 0 };
    for (const s of signals) {
      if (s.type === 'event') c.events++;
      if (s.type === 'offer') c.offers++;
    }
    return c;
  }, [signals]);

  // Selected marker detail
  const selectedMarker = selectedMarkerId
    ? markers.get(selectedMarkerId)
    : null;

  // Check if selected marker is a developer
  const selectedDeveloper = selectedMarkerId
    ? developers.find((d) => d.id === selectedMarkerId)
    : null;

  const handleMapReady = useCallback(() => {
    // Map ready — could subscribe to WebSocket here
  }, []);

  return (
    <div className="relative h-full w-full">
      <WorldMap onMapReady={handleMapReady}>
        {/* Marker sync */}
        <WorldMapInner signals={signals} agents={agents} />

        {/* ── Top Bar ─────────────────────────────────── */}
        <div className="absolute left-0 right-0 top-0 z-30">
          {/* Search + controls */}
          <div className="flex items-center gap-2 px-4 pb-1 pt-[env(safe-area-inset-top,12px)] lg:pt-4 lg:px-6 max-w-4xl lg:mx-auto backdrop-blur-md">
            {/* Search */}
            <div className="relative flex-1">
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all"
                style={{
                  background: searchFocused ? 'rgba(10,11,15,0.95)' : 'rgba(10,11,15,0.7)',
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

              {/* Results dropdown */}
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
                      <MapPin size={13} className="shrink-0" style={{ color: '#00d4ff' }} />
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
                  ? 'border-[#00d4ff]/60 bg-[#00d4ff]/10 text-[#00d4ff]'
                  : 'border-[rgba(0,212,255,0.15)]/40 bg-[#0a0b0f]/70 text-[#4a5068]'
              }`}
            >
              <Layers size={14} />
            </button>

            {/* Time filter */}
            <div className="flex items-center gap-0.5 rounded-xl border border-[rgba(0,212,255,0.15)]/40 bg-[#0a0b0f]/70 px-1 py-1">
              {TIME_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setTimeFilter(f)}
                  className={`rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors ${
                    timeFilter === f
                      ? 'bg-[#00d4ff]/20 text-[#00d4ff]'
                      : 'text-[#4a5068] hover:text-[#f0f4ff]'
                  }`}
                >
                  {f === 'live' ? 'Live' : f.toUpperCase()}
                </button>
              ))}
            </div>

            {/* 2D / 3D Globe toggle */}
            <button
              onClick={() => setViewMode(viewMode === '2d' ? '3d' : '2d')}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition-all duration-300"
              style={{
                background: viewMode === '3d'
                  ? 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(99,102,241,0.2))'
                  : 'rgba(10,11,15,0.7)',
                border: viewMode === '3d'
                  ? '1px solid rgba(0,212,255,0.4)'
                  : '1px solid rgba(0,212,255,0.1)',
                color: viewMode === '3d' ? '#00d4ff' : '#4a5068',
                boxShadow: viewMode === '3d' ? '0 0 15px rgba(0,212,255,0.25)' : 'none',
              }}
            >
              {/* Globe / Map icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {viewMode === '3d' ? (
                  <>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20" />
                    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                  </>
                ) : (
                  <>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18" />
                    <path d="M3 15h18" />
                    <path d="M9 3v18" />
                  </>
                )}
              </svg>
              {viewMode === '3d' ? 'Globe' : 'Flat'}
            </button>
          </div>

          {/* Layer chips */}
          {showLayers && <LayerFilterPanel />}
        </div>

        {/* ── Bottom Summary Sheet (collapsed) ────────── */}
        <div className="absolute bottom-16 lg:bottom-4 left-0 right-0 z-30 max-w-2xl lg:mx-auto">
          <div className="glass-card mx-4 flex items-center justify-between rounded-2xl px-4 py-3">
            <p className="text-xs text-[#4a5068]">
              <span className="font-medium text-[#f0f4ff]">Nearby now</span>
              {' · '}
              {counts.signals} signals · {counts.events} events ·{' '}
              {counts.offers} offers
            </p>
            <ChevronDown size={16} className="text-[#4a5068]" />
          </div>
        </div>

        {/* ── Marker Detail Sheet ─────────────────────── */}
        {selectedMarker && !selectedDeveloper && (
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
      </WorldMap>
    </div>
  );
}
