'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { Search, Layers, X, MapPin, Loader2, Store, User, Users, Calendar, History, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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
import BusinessDetailPage from '@/components/business/BusinessDetailPage';
import EventDetailPage from '@/components/events/EventDetailPage';
import SignalSheet from '@/components/map/SignalSheet';
import FriendSidePanel from '@/components/map/FriendSidePanel';
import CircleDetailSheet from '@/components/circles/CircleDetailSheet';
import UserSheet from '@/components/map/UserSheet';
import KissGlobe from '@/components/map/KissGlobe';
import KissReplayOverlay from '@/components/map/KissReplayOverlay';
import SearchOverlay from '@/components/map/SearchOverlay';
import type { Signal, Agent, Profile, Business, Event, Circle, EntityType } from '@/types';

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
  circles,
}: {
  signals: Signal[];
  agents: Agent[];
  profiles: Profile[];
  businesses: Business[];
  events: Event[];
  circles: Circle[];
}) {
  const { map } = useMap();
  const setMapCenter = useMapStore((s) => s.setMapCenter);
  useMapMarkers(map, signals, agents, profiles, businesses, events, circles);

  // Track map center on pan/zoom (debounced)
  useEffect(() => {
    if (!map) return;
    let timer: ReturnType<typeof setTimeout>;
    const onMoveEnd = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const c = map.getCenter();
        const z = map.getZoom();
        setMapCenter(c.lat, c.lng, z);
      }, 400);
    };
    map.on('moveend', onMoveEnd);
    // Set initial center
    const c = map.getCenter();
    setMapCenter(c.lat, c.lng, map.getZoom());
    return () => { clearTimeout(timer); map.off('moveend', onMoveEnd); };
  }, [map, setMapCenter]);

  return null;
}

// ─── Desktop search result row ────────────────────────────────────────────
function DesktopResultRow({ item, onSelect }: { item: Record<string, unknown>; onSelect: (r: Record<string, unknown>) => void }) {
  const typeIcons: Record<string, { Icon: React.ElementType; color: string }> = {
    people: { Icon: Users, color: '#3b82f6' },
    business: { Icon: Store, color: '#22c55e' },
    event: { Icon: Calendar, color: '#ef4444' },
    place: { Icon: MapPin, color: '#f59e0b' },
  };
  const { Icon, color } = typeIcons[(item.type as string)] || typeIcons.place;
  const dist = item.distance as number | null;

  return (
    <button
      onMouseDown={() => onSelect(item)}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.04] cursor-pointer"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
    >
      {(item.image as string) ? (
        <div className="shrink-0 h-7 w-7 rounded-lg overflow-hidden"><img src={item.image as string} alt="" className="h-full w-full object-cover" /></div>
      ) : (
        <div className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `${color}12` }}><Icon size={12} style={{ color }} /></div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-white truncate">{item.title as string}</p>
        {item.subtitle && <p className="text-[9px] text-[#4a5068] truncate">{item.subtitle as string}</p>}
      </div>
      {dist != null && dist > 0 && <span className="shrink-0 text-[9px] text-[#4a5068]">{dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist}km`}</span>}
    </button>
  );
}

// ─── World Page ───────────────────────────────────────────────────────────

export default function WorldPage() {
  const { lat, lng, granted, requestLocation } = useLocationStore();
  const { timeFilter, setTimeFilter, viewMode, setViewMode, selectedMarkerId, markers, setSelectedMarker, activeLayers, toggleLayer, mapCenter } =
    useMapStore();
  const { developers } = useDeveloperStore();
  const [showLayers, setShowLayers] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [detailBusiness, setDetailBusiness] = useState<Business | null>(null);
  const [detailEvent, setDetailEvent] = useState<Event | null>(null);
  const [searchUser, setSearchUser] = useState<{ id: string; preview: { title: string; subtitle?: string; image?: string } } | null>(null);
  const [replayKiss, setReplayKiss] = useState<Record<string, unknown> | null>(null);
  const [nearbyList, setNearbyList] = useState<{ type: string; items: Array<{ id: string; title: string; sub: string; color: string; lng: number; lat: number }> } | null>(null);

  // ── Search ──────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; place_name: string; center: [number, number]; type?: 'place' | 'business' }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  // Desktop search state
  const [desktopSearchQuery, setDesktopSearchQuery] = useState('');
  const [desktopResults, setDesktopResults] = useState<Record<string, Array<Record<string, unknown>>>>({ people: [], businesses: [], events: [], circles: [], places: [] });
  const [desktopTab, setDesktopTab] = useState('top');
  const [desktopSearchLoading, setDesktopSearchLoading] = useState(false);
  const [desktopHistory, setDesktopHistory] = useState<Array<Record<string, unknown>>>([]);
  const desktopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || '';

  const searchGeocode = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      // Nominatim (OpenStreetMap) — free, no API key needed
      const osmRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`,
        { headers: { 'User-Agent': 'GaoSocial/1.0' } }
      );
      const osmData = await osmRes.json();
      let results = osmData.map((r: any) => ({
        id: `osm_${r.place_id}`,
        place_name: r.display_name,
        center: [parseFloat(r.lon), parseFloat(r.lat)] as [number, number],
      }));

      // Also search businesses + people in parallel
      try {
        const [bizRes, profileRes] = await Promise.all([
          fetch(`/api/v1/businesses?q=${encodeURIComponent(q)}&limit=5`).then(r => r.json()).catch(() => ({ data: [] })),
          fetch(`/api/v1/profiles?q=${encodeURIComponent(q)}&limit=5`).then(r => r.json()).catch(() => ({ data: [] })),
        ]);
        const bizResults = (bizRes.data || []).map((b: any) => ({
          id: `biz_search_${b.id}`,
          place_name: `${b.name} · ${b.category} · ${b.city || b.address || ''}`,
          center: [b.location_lng, b.location_lat] as [number, number],
          type: 'business' as const,
        }));
        const peopleResults = (profileRes.data || []).map((p: any) => ({
          id: `profile_search_${p._id || p.id}`,
          place_name: `${p.headline} · ${p.industry || ''} · ${p.city || ''}`,
          center: [p.location?.coordinates?.[0] || p.lng, p.location?.coordinates?.[1] || p.lat] as [number, number],
          type: 'profile' as const,
        }));
        if (bizResults.length > 0 || peopleResults.length > 0) {
          results = [...peopleResults, ...bizResults, ...results].slice(0, 8);
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

    const name = result.place_name.toLowerCase();
    const isAddress = /\d/.test(name.split(',')[0]);
    const zoom = isAddress ? 18 : name.split(',').length >= 3 ? 15 : 12;

    window.dispatchEvent(new CustomEvent('gao-fly-to', {
      detail: { lng: result.center[0], lat: result.center[1], zoom, label: result.place_name }
    }));
  }, []);

  // ── Desktop unified search ──
  const handleDesktopSearch = useCallback((q: string, t?: string) => {
    setDesktopSearchQuery(q);
    if (desktopTimerRef.current) clearTimeout(desktopTimerRef.current);
    if (!q.trim() || q.length < 2) { setDesktopResults({ people: [], businesses: [], events: [], circles: [], places: [] }); setDesktopSearchLoading(false); return; }
    // Show loading immediately when switching tabs (no debounce delay)
    if (t) setDesktopSearchLoading(true);
    desktopTimerRef.current = setTimeout(async () => {
      setDesktopSearchLoading(true);
      try {
        const params = new URLSearchParams({ q, tab: t || desktopTab, limit: '20' });
        if (lat) params.set('lat', String(lat));
        if (lng) params.set('lng', String(lng));
        const res = await fetch(`/api/v1/search?${params}`);
        if (res.ok) { const data = await res.json(); setDesktopResults(data.data); }
      } catch { /* ignore */ }
      setDesktopSearchLoading(false);
    }, t ? 0 : 300);
  }, [desktopTab, lat, lng]);

  const handleDesktopSelect = useCallback((item: Record<string, unknown>) => {
    // Save to shared search history
    try {
      const h = JSON.parse(localStorage.getItem('gao_search_history') || '[]').filter((x: Record<string, unknown>) => x.id !== item.id);
      h.unshift(item);
      localStorage.setItem('gao_search_history', JSON.stringify(h.slice(0, 10)));
    } catch { /* ignore */ }
    setDesktopSearchQuery('');
    setDesktopResults({ people: [], businesses: [], events: [], circles: [], places: [] });
    setSearchFocused(false);
    const itemLat = item.lat as number;
    const itemLng = item.lng as number;
    const itemType = item.type as string;
    const isEntity = itemType !== 'place';

    if (itemType === 'business' && !activeLayers.has('business')) toggleLayer('business');
    if (itemType === 'event' && !activeLayers.has('event')) toggleLayer('event');
    if (itemType === 'people' && !activeLayers.has('people')) toggleLayer('people');
    if (itemType === 'circle' && !activeLayers.has('circle')) toggleLayer('circle');

    if (itemLat && itemLng) {
      const zoom = itemType === 'place' ? 14 : 15;
      window.dispatchEvent(new CustomEvent('gao-fly-to', {
        detail: { lng: itemLng, lat: itemLat, zoom, label: item.title, entityId: isEntity ? item.id : undefined, entityType: isEntity ? itemType : undefined }
      }));
    }
    // For entities, fetch full data and show detail after marker lands
    if (isEntity) {
      setTimeout(() => showSearchEntityDetail(item.id as string, itemType, { title: item.title as string, subtitle: item.subtitle as string, image: item.image as string }), 2500);
    }
  }, [activeLayers, toggleLayer]);

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

  // Build query params — in 2D, follow map center (100km); in 3D, fetch all
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (viewMode === '2d' && mapCenter) {
      params.set('lat', String(mapCenter.lat));
      params.set('lng', String(mapCenter.lng));
      params.set('radius', '100000');
    } else if (viewMode === '3d') {
      params.set('lat', '0');
      params.set('lng', '0');
      params.set('radius', '0');
    } else {
      // Fallback before map is ready
      params.set('lat', String(lat ?? 32.7767));
      params.set('lng', String(lng ?? -96.797));
      params.set('radius', '100000');
    }
    params.set('time', timeFilter);
    return params.toString();
  }, [viewMode, mapCenter, lat, lng, timeFilter]);

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

  // Fetch circles
  const { data: circlesData } = useSWR<{ data: Circle[] }>(
    `/api/v1/circles?limit=50`,
    fetcher,
    { refreshInterval: 60000, fallbackData: { data: [] } }
  );

  const signals = signalsData?.data ?? [];
  const agents = agentsData?.data ?? [];
  const profiles = profilesData?.data ?? [];
  const businesses = businessesData?.data ?? [];
  const events = eventsData?.data ?? [];
  const circles = circlesData?.data ?? [];

  // Count for summary — uses the same fetched data (already scoped to viewport)
  const counts = useMemo(() => ({
    signals: signals.length,
    events: events.length,
    offers: signals.filter(s => s.type === 'offer').length,
    businesses: businesses.length,
    profiles: profiles.length,
  }), [signals, businesses, events, profiles]);

  // Selected marker detail
  const selectedMarker = selectedMarkerId
    ? markers.get(selectedMarkerId)
    : null;

  // Check if selected marker is a friend
  const selectedFriend = selectedMarker?.entity_type === 'friend' ? selectedMarker : null;

  // Check if selected marker is a developer
  const selectedDeveloper = selectedMarkerId
    ? developers.find((d) => d.id === selectedMarkerId)
    : null;

  // Check if selected marker is a profile (match by _id or user_id)
  const selectedProfile = selectedMarkerId
    ? profiles.find((p) => p._id === selectedMarkerId || p.user_id === selectedMarkerId)
    : null;

  // Check if selected marker is a business
  const selectedBusiness = selectedMarkerId
    ? businesses.find((b) => b.id === selectedMarkerId)
    : null;

  // Check if selected marker is an event
  const selectedEvent = selectedMarkerId
    ? events.find((e) => e.id === selectedMarkerId)
    : null;

  // Check if selected marker is a signal
  const selectedSignal = selectedMarkerId
    ? signals.find((s) => s.id === selectedMarkerId)
    : null;
  if (selectedSignal) console.log('[World] selectedSignal keys:', Object.keys(selectedSignal), 'author_id:', (selectedSignal as unknown as Record<string, unknown>).author_id);

  // Check if selected marker is a circle
  const selectedCircle = selectedMarkerId
    ? circles.find((c) => c.id === selectedMarkerId)
    : null;

  const handleMapReady = useCallback(() => {
    const params = new URLSearchParams(window.location.search);

    // Check for flyTo URL param (from business save, event create, etc.)
    const flyTo = params.get('flyTo');
    if (flyTo) {
      const [fLng, fLat, fZoom] = flyTo.split(',').map(Number);
      if (fLng && fLat) {
        if (!activeLayers.has('business')) toggleLayer('business');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('gao-fly-to', { detail: { lng: fLng, lat: fLat, zoom: fZoom || 16 } }));
        }, 500);
        window.history.replaceState(null, '', '/world');
      }
    }

    // Kiss handled in separate useEffect below
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle ?kiss= URL param (from notification click) → cinematic replay
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kissId = params.get('kiss');
    if (!kissId) return;

    const token = localStorage.getItem('access_token') || '';

    // Delay to let map initialize
    const timer = setTimeout(() => {
      // Public endpoint — works for anyone, not just sender/receiver
      fetch(`/api/v1/kisses/${kissId}`)
        .then(r => r.json())
        .then(data => {
          if (data.data) {
            setReplayKiss(data.data);
            // Mark as opened if I'm the receiver
            if (token) {
              fetch('/api/v1/kisses', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ id: kissId }),
              }).catch(() => {});
            }
          }
        })
        .catch(() => {});

      window.history.replaceState(null, '', '/world');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Fetch full entity from API and show detail popup (for search results)
  const showSearchEntityDetail = useCallback(async (id: string, type: string, preview?: { title: string; subtitle?: string; image?: string }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : '';
    const headers = { Authorization: `Bearer ${token}` };

    if (type === 'people') {
      setSearchUser({ id, preview: preview || { title: 'User' } });
    } else if (type === 'business') {
      try {
        const res = await fetch(`/api/v1/businesses/${id}`, { headers });
        const data = await res.json();
        if (data.data) setDetailBusiness(data.data);
      } catch { /* try marker fallback */ setSelectedMarker(id); }
    } else if (type === 'event') {
      try {
        const res = await fetch(`/api/v1/events/${id}`, { headers });
        const data = await res.json();
        if (data.data) setDetailEvent(data.data);
      } catch { setSelectedMarker(id); }
    } else {
      // circles, other — use marker selection
      setSelectedMarker(id);
    }
  }, [setSelectedMarker]);

  // Listen for pin label card clicks → open detail popup
  useEffect(() => {
    const handler = (e: Event) => {
      const { entityId, entityType, label } = (e as CustomEvent).detail;
      if (entityId && entityType) {
        showSearchEntityDetail(entityId, entityType, { title: label || '' });
      }
    };
    window.addEventListener('gao-pin-detail', handler);
    return () => window.removeEventListener('gao-pin-detail', handler);
  }, [showSearchEntityDetail]);

  // Handle summary card click — 1 item: fly + select, 2+: show list popup
  const handleSummaryClick = useCallback((type: 'signals' | 'events' | 'offers' | 'businesses') => {
    const layerMap: Record<string, string> = { signals: 'people', events: 'event', offers: 'offer', businesses: 'business' };
    const colorMap: Record<string, string> = { signals: '#3B82F6', events: '#EF4444', offers: '#EAB308', businesses: '#22C55E' };
    const layer = layerMap[type];

    // Build rich items with title/sub for list
    let listItems: { id: string; title: string; sub: string; color: string; lng: number; lat: number }[] = [];
    if (type === 'signals' || type === 'offers') {
      const src = type === 'offers' ? signals.filter(s => s.type === 'offer') : signals;
      listItems = src.map(s => ({
        id: s.id, title: s.title, sub: s.category || s.type,
        color: colorMap[type], lng: s.location.coordinates[0], lat: s.location.coordinates[1],
      }));
    } else if (type === 'events') {
      listItems = events.filter(e => e.location_lat && e.location_lng).map(e => ({
        id: e.id, title: e.title, sub: e.location_name || e.city || '',
        color: colorMap[type], lng: e.location_lng!, lat: e.location_lat!,
      }));
    } else if (type === 'businesses') {
      listItems = businesses.filter(b => b.location_lat && b.location_lng).map(b => ({
        id: b.id, title: b.name, sub: b.category + (b.city ? ` · ${b.city}` : ''),
        color: colorMap[type], lng: b.location_lng, lat: b.location_lat,
      }));
    }

    if (listItems.length === 0) {
      toast.info(`No ${type} nearby`);
      return;
    }

    // Ensure layer is on
    if (!activeLayers.has(layer)) toggleLayer(layer);

    if (listItems.length === 1) {
      // Single item — fly to location
      const item = listItems[0];
      window.dispatchEvent(new CustomEvent('gao-fly-to', { detail: { lng: item.lng, lat: item.lat, zoom: 15 } }));
    } else {
      // Multiple items — show list popup
      setNearbyList({ type, items: listItems });
    }
  }, [signals, events, businesses, activeLayers, toggleLayer, setSelectedMarker]);

  return (
    <div className="relative h-full w-full">
      <WorldMap onMapReady={handleMapReady}>
        {/* Marker sync */}
        <WorldMapInner signals={signals} agents={agents} profiles={profiles} businesses={businesses} events={events} circles={circles} />
        <KissGlobe />

        {/* ── Top Bar ─────────────────────────────────── */}
        <div className="absolute left-0 right-0 top-0 z-30">
          {/* Search + controls */}
          <div className="flex items-center gap-2 px-4 pb-2 pt-[calc(env(safe-area-inset-top,8px)+8px)] lg:pt-4 lg:px-6 max-w-4xl lg:mx-auto">
            {/* Search — mobile: icon only, expand on tap */}
            {/* Mobile search icon — opens full SearchOverlay */}
            <button
              onClick={() => setShowSearchOverlay(true)}
              className="flex lg:hidden items-center justify-center rounded-2xl px-3 py-3 transition-colors cursor-pointer"
              style={{ background: 'rgba(10,11,15,0.7)', border: '1px solid rgba(0,212,255,0.1)' }}
            >
              <Search size={15} style={{ color: '#4a5068' }} />
            </button>

            {/* Mobile expanded search overlay */}
            {searchExpanded && (
              <div className="fixed inset-x-0 top-0 z-50 lg:hidden px-4 pt-[calc(env(safe-area-inset-top,44px)+12px)] pb-3" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(16px)' }}>
                <div className="flex items-center gap-2.5">
                  <div
                    className="relative flex-1 flex items-center gap-2.5 rounded-2xl px-4 py-3"
                    style={{ background: 'rgba(17,19,24,0.9)', border: '1px solid rgba(0,212,255,0.3)', boxShadow: '0 0 20px rgba(0,212,255,0.1)' }}
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
                          : r.type === 'profile'
                          ? <User size={13} className="shrink-0" style={{ color: '#3B82F6' }} />
                          : <MapPin size={13} className="shrink-0" style={{ color: '#00d4ff' }} />
                        }
                        <span className="text-xs text-[#a3adc3] truncate">{r.place_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Desktop search — inline with dropdown */}
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
                  value={desktopSearchQuery}
                  onChange={(e) => handleDesktopSearch(e.target.value)}
                  onFocus={() => { setSearchFocused(true); try { setDesktopHistory(JSON.parse(localStorage.getItem('gao_search_history') || '[]')); } catch { setDesktopHistory([]); } }}
                  onBlur={(e) => {
                    // Don't close dropdown if clicking inside it
                    if (dropdownRef.current?.contains(e.relatedTarget as Node)) return;
                    setTimeout(() => setSearchFocused(false), 200);
                  }}
                  placeholder="Search people, businesses, events, places..."
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-[#4a5068] outline-none"
                />
                {desktopSearchQuery && (
                  <button onClick={() => { setDesktopSearchQuery(''); setDesktopResults({ people: [], businesses: [], events: [], circles: [], places: [] }); }} className="shrink-0 cursor-pointer" style={{ color: '#4a5068' }}>
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Desktop results dropdown — tabs + grouped results + history */}
              {searchFocused && (desktopSearchQuery.length >= 2 || desktopHistory.length > 0) && (
                <div
                  ref={dropdownRef}
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute left-0 right-0 top-full mt-1.5 rounded-xl overflow-hidden z-50 outline-none"
                  style={{
                    background: 'rgba(10,11,15,0.97)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(0,212,255,0.12)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                    maxHeight: '60vh',
                  }}
                >
                  {/* Tabs — hide when showing history only */}
                  {desktopSearchQuery.length >= 2 && <div className="flex gap-1 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {['top', 'people', 'businesses', 'events', 'circles', 'places'].map(t => (
                      <button
                        key={t}
                        onMouseDown={() => { setDesktopTab(t); handleDesktopSearch(desktopSearchQuery, t); }}
                        className="px-2.5 py-1 rounded-lg text-[9px] font-semibold capitalize cursor-pointer"
                        style={desktopTab === t
                          ? { background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }
                          : { color: '#4a5068' }
                        }
                      >{t}</button>
                    ))}
                  </div>}

                  {/* Results */}
                  <div className="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 40px)' }}>
                    {desktopSearchLoading && (
                      <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-[#00d4ff]" /></div>
                    )}

                    {!desktopSearchLoading && desktopTab === 'top' && (
                      <>
                        {(['people', 'businesses', 'events', 'circles', 'places'] as const).map(section => {
                          const items = desktopResults[section] || [];
                          if (items.length === 0) return null;
                          const labels: Record<string, { label: string; color: string }> = {
                            people: { label: 'People', color: '#3b82f6' },
                            businesses: { label: 'Businesses', color: '#22c55e' },
                            events: { label: 'Events', color: '#ef4444' },
                            circles: { label: 'Circles', color: '#a855f7' },
                            places: { label: 'Places', color: '#f59e0b' },
                          };
                          const { label, color } = labels[section];
                          return (
                            <div key={section}>
                              <div className="px-3 pt-2 pb-1 flex items-center justify-between">
                                <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color }}>{label}</span>
                                {items.length >= 3 && (
                                  <button onMouseDown={() => { setDesktopTab(section); handleDesktopSearch(desktopSearchQuery, section); }} className="text-[9px] font-semibold text-[#00d4ff] cursor-pointer">See all</button>
                                )}
                              </div>
                              {items.map((r: Record<string, unknown>) => (
                                <DesktopResultRow key={r.id as string} item={r} onSelect={handleDesktopSelect} />
                              ))}
                            </div>
                          );
                        })}
                      </>
                    )}

                    {!desktopSearchLoading && desktopTab !== 'top' && (
                      (desktopResults[desktopTab as keyof typeof desktopResults] || []).map((r: Record<string, unknown>) => (
                        <DesktopResultRow key={r.id as string} item={r} onSelect={handleDesktopSelect} />
                      ))
                    )}

                    {!desktopSearchLoading && Object.values(desktopResults).every(arr => arr.length === 0) && desktopSearchQuery.length >= 2 && (
                      <p className="text-center text-[11px] text-[#4a5068] py-4">No results</p>
                    )}

                    {/* History — show when no query */}
                    {!desktopSearchQuery && desktopHistory.length > 0 && (
                      <div>
                        <div className="px-3 pt-2 pb-1 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <History size={10} className="text-[#4a5068]" />
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-[#4a5068]">Recent</span>
                          </div>
                          <button
                            onMouseDown={() => { localStorage.removeItem('gao_search_history'); setDesktopHistory([]); }}
                            className="flex items-center gap-1 text-[9px] text-[#4a5068] hover:text-[#a3adc3] cursor-pointer"
                          >
                            <Trash2 size={9} /> Clear
                          </button>
                        </div>
                        {desktopHistory.map((r: Record<string, unknown>) => (
                          <DesktopResultRow key={r.id as string} item={r} onSelect={handleDesktopSelect} />
                        ))}
                      </div>
                    )}
                  </div>
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

        {/* ── Bottom Summary ─────────────────────── */}
        {/* Mobile: collapsed button, tap to expand */}
        <div className="lg:hidden fixed bottom-[64px] left-0 right-0 z-40 pb-[env(safe-area-inset-bottom,0px)]">
          {!summaryOpen ? (
            <div>
              <button
                onClick={() => setSummaryOpen(true)}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 cursor-pointer transition-all"
                style={{ background: 'rgba(10,11,15,0.85)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center gap-2">
                  {[
                    { count: counts.signals, color: '#3B82F6' },
                    { count: counts.events, color: '#EF4444' },
                    { count: counts.offers, color: '#EAB308' },
                    { count: counts.businesses, color: '#22C55E' },
                  ].map(({ count, color }, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                      <span className="text-[11px] font-semibold text-white tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-[#4a5068]">Nearby</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4a5068" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
              </button>
            </div>
          ) : (
            <div>
              <div
                className="px-4 py-3"
                style={{ background: 'rgba(10,11,15,0.92)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-semibold text-[#4a5068] uppercase tracking-wider">Nearby</span>
                  <button onClick={() => setSummaryOpen(false)} className="text-[#4a5068] cursor-pointer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {[
                    { label: 'Live Signals', sub: `${counts.signals} nearby`, count: counts.signals, color: '#3B82F6', type: 'signals' as const },
                    { label: 'Events Nearby', sub: `${counts.events} upcoming`, count: counts.events, color: '#EF4444', type: 'events' as const },
                    { label: 'Active Deals', sub: `${counts.offers} offers`, count: counts.offers, color: '#EAB308', type: 'offers' as const },
                    { label: 'Businesses', sub: `${counts.businesses} open`, count: counts.businesses, color: '#22C55E', type: 'businesses' as const },
                  ].map(({ label, sub, count, color, type }) => (
                    <button
                      key={label}
                      onClick={() => { handleSummaryClick(type); setSummaryOpen(false); }}
                      disabled={count === 0}
                      className="flex items-center gap-2.5 rounded-lg px-1 py-1 -mx-1 transition-colors active:bg-white/5 disabled:opacity-40 disabled:cursor-default cursor-pointer"
                    >
                      <span className="text-xl font-light tabular-nums w-6 text-right" style={{ color }}>{count}</span>
                      <div className="min-w-0 text-left">
                        <p className="text-[11px] font-medium text-[#f0f4ff] truncate">{label}</p>
                        <p className="text-[9px] text-[#4a5068] truncate">{sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop: always show full grid */}
        <div className="hidden lg:block absolute bottom-4 left-4 z-30 w-[360px]">
          <div
            className="mx-3 rounded-2xl px-4 py-4"
            style={{ background: 'rgba(10,11,15,0.88)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }}
          >
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {[
                { label: 'Live Signals', sub: `${counts.signals} nearby`, count: counts.signals, color: '#3B82F6', type: 'signals' as const },
                { label: 'Events Nearby', sub: `${counts.events} upcoming`, count: counts.events, color: '#EF4444', type: 'events' as const },
                { label: 'Active Deals', sub: `${counts.offers} offers`, count: counts.offers, color: '#EAB308', type: 'offers' as const },
                { label: 'Businesses', sub: `${counts.businesses} open`, count: counts.businesses, color: '#22C55E', type: 'businesses' as const },
              ].map(({ label, sub, count, color, type }) => (
                <button
                  key={label}
                  onClick={() => handleSummaryClick(type)}
                  disabled={count === 0}
                  className="flex items-center gap-2.5 rounded-lg px-1 py-1 -mx-1 transition-colors active:bg-white/5 disabled:opacity-40 disabled:cursor-default cursor-pointer"
                >
                  <span className="text-xl font-light tabular-nums w-6 text-right" style={{ color }}>{count}</span>
                  <div className="min-w-0 text-left">
                    <p className="text-[11px] font-medium text-[#f0f4ff] truncate">{label}</p>
                    <p className="text-[9px] text-[#4a5068] truncate">{sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Nearby List Popup ─────────────────────── */}
        {nearbyList && !selectedMarkerId && (
          <div className="absolute inset-0 z-40 flex items-end justify-center pb-[calc(64px+env(safe-area-inset-bottom,0px)+12px)] lg:pb-4">
            {/* Backdrop */}
            <div className="absolute inset-0" onClick={() => setNearbyList(null)} />
            {/* Panel */}
            <div
              className="relative mx-3 w-full max-w-sm rounded-2xl overflow-hidden"
              style={{ background: 'rgba(10,11,15,0.95)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-sm font-semibold text-[#f0f4ff] capitalize">{nearbyList.type} nearby</span>
                <button onClick={() => setNearbyList(null)} className="text-[#4a5068] hover:text-white transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              </div>
              {/* List */}
              <div className="max-h-[40vh] overflow-y-auto">
                {nearbyList.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setNearbyList(null);
                      window.dispatchEvent(new CustomEvent('gao-fly-to', { detail: { lng: item.lng, lat: item.lat, zoom: 15 } }));
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 active:bg-white/10 cursor-pointer"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: item.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[#f0f4ff] truncate">{item.title}</p>
                      <p className="text-[10px] text-[#4a5068] truncate">{item.sub}</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a5068" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Friend Side Panel ─────────────────────── */}
        {selectedFriend && (
          <FriendSidePanel data={{ name: selectedFriend.title, ...selectedFriend.metadata }} />
        )}

        {/* ── Marker Detail Sheet ─────────────────────── */}
        {selectedMarker && !selectedFriend && !selectedDeveloper && !selectedProfile && !selectedBusiness && !selectedEvent && !selectedSignal && !selectedCircle && (
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
            onViewDetail={() => { setDetailBusiness(selectedBusiness); setSelectedMarker(null); }}
          />
        )}

        {/* ── Event Sheet ─────────────────────────────── */}
        {selectedEvent && (
          <EventSheet
            event={selectedEvent}
            onClose={() => setSelectedMarker(null)}
            onViewDetail={() => { setDetailEvent(selectedEvent); setSelectedMarker(null); }}
          />
        )}

        {/* ── Signal Sheet ────────────────────────────── */}
        {selectedSignal && (
          <SignalSheet
            signal={{
              id: selectedSignal.id,
              title: selectedSignal.title,
              type: selectedSignal.type,
              description: selectedSignal.description,
              category: selectedSignal.category,
              owner_id: (selectedSignal as unknown as Record<string, unknown>).author_id as string,
              author_id: (selectedSignal as unknown as Record<string, unknown>).author_id as string,
              author_name: (selectedSignal as unknown as Record<string, unknown>).author_name as string,
              author_username: (selectedSignal as unknown as Record<string, unknown>).author_username as string,
              author_avatar: (selectedSignal as unknown as Record<string, unknown>).author_avatar as string,
              author_trust_level: (selectedSignal as unknown as Record<string, unknown>).author_trust_level as string,
              created_at: selectedSignal.created_at,
              expires_at: selectedSignal.expires_at,
              metadata: selectedSignal.metadata as Record<string, unknown>,
            }}
            onClose={() => setSelectedMarker(null)}
          />
        )}

        {/* ── Circle Detail Sheet ────────────────────── */}
        {selectedCircle && !selectedSignal && (
          <CircleDetailSheet
            circle={selectedCircle}
            onClose={() => setSelectedMarker(null)}
          />
        )}
      </WorldMap>

      {/* Business detail */}
      {detailBusiness && (
        <BusinessDetailPage
          business={detailBusiness}
          onClose={() => setDetailBusiness(null)}
        />
      )}

      {/* Event detail */}
      {detailEvent && (
        <EventDetailPage
          event={detailEvent}
          onClose={() => setDetailEvent(null)}
        />
      )}

      {/* User detail from search */}
      {searchUser && (
        <UserSheet
          userId={searchUser.id}
          preview={searchUser.preview}
          onClose={() => setSearchUser(null)}
        />
      )}

      {/* Unified Search Overlay */}
      <SearchOverlay
        isOpen={showSearchOverlay}
        onClose={() => setShowSearchOverlay(false)}
        onSelect={(result, action) => {
          setShowSearchOverlay(false);
          const isEntity = result.type !== 'place';

          // Enable relevant layer
          if (result.type === 'business' && !activeLayers.has('business')) toggleLayer('business');
          if (result.type === 'event' && !activeLayers.has('event')) toggleLayer('event');
          if (result.type === 'people' && !activeLayers.has('people')) toggleLayer('people');
          if (result.type === 'circle' && !activeLayers.has('circle')) toggleLayer('circle');

          if (result.lat && result.lng) {
            const zoom = result.type === 'place' ? 14 : 15;
            window.dispatchEvent(new CustomEvent('gao-fly-to', {
              detail: { lng: result.lng, lat: result.lat, zoom, label: result.title, entityId: isEntity ? result.id : undefined, entityType: isEntity ? result.type : undefined }
            }));
          }

          if (action === 'detail' && isEntity) {
            // After flyTo + marker lands, fetch full entity and show detail popup
            setTimeout(() => showSearchEntityDetail(result.id, result.type, { title: result.title, subtitle: result.subtitle, image: result.image }), 2500);
          }
        }}
      />

      {/* Kiss Replay Cinematic */}
      {replayKiss && (
        <KissReplayOverlay
          kiss={replayKiss as Parameters<typeof KissReplayOverlay>[0]['kiss']}
          onClose={() => setReplayKiss(null)}
          onFlyStart={() => {
            const k = replayKiss;
            // Declarations always use 3D globe
            if (k?.kiss_type === 'declaration' && viewMode !== '3d') {
              setViewMode('3d');
            }
            if (k && k.sender_lat && k.receiver_lat) {
              window.dispatchEvent(new CustomEvent('gao-fly-to', {
                detail: { lng: k.sender_lng, lat: k.sender_lat, zoom: k.kiss_type === 'declaration' ? 2 : 4, skipPin: true }
              }));
            }
          }}
        />
      )}
    </div>
  );
}
