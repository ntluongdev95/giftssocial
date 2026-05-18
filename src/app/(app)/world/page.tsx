'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { Search, Layers, X, MapPin, Loader2, Store, Users, Calendar, History, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSearch } from '@/hooks/useSearch';
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
import { StoriesRail } from '@/components/stories/StoriesRail';
import { StoryComposer } from '@/components/stories/StoryComposer';
import { useAuthStore, selectUserId } from '@/stores/auth-store';
import type { Signal, Agent, Profile, Business, Event, Circle, EntityType, MapUser } from '@/types';

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
    cache: 'no-store'
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
  mapUsers,
}: {
  signals: Signal[];
  agents: Agent[];
  profiles: Profile[];
  businesses: Business[];
  events: Event[];
  circles: Circle[];
  mapUsers: MapUser[];
}) {
  const { map } = useMap();
  const setMapCenter = useMapStore((s) => s.setMapCenter);
  useMapMarkers(map, signals, agents, profiles, businesses, events, circles, mapUsers);

  // Track map center on pan/zoom (debounced) — used by 2D viewport fetch
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
        {!!item.subtitle && <p className="text-[9px] text-[#4a5068] truncate">{item.subtitle as string}</p>}
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
  const [searchUser, setSearchUser] = useState<{ id: string; preview: { title: string; subtitle?: string; image?: string }; visibility?: { reason: string; event_id?: string; circle_id?: string } } | null>(null);
  const [replayKiss, setReplayKiss] = useState<Record<string, unknown> | null>(null);
  const [nearbyList, setNearbyList] = useState<{ type: string; items: Array<{ id: string; title: string; sub: string; color: string; lng: number; lat: number }> } | null>(null);
  const [clusterUsers, setClusterUsers] = useState<{ users: Array<{ id: string; name: string; avatar: string; city: string; trust_level: string; lat: number; lng: number; visibility_reason?: string; shared_event_id?: string; shared_circle_id?: string }>; count: number; entityType?: string } | null>(null);
  const [clusterFilter, setClusterFilter] = useState('');

  // ── Search ──────────────────────────────────────────────────────────────
  const [searchFocused, setSearchFocused] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [showStoryComposer, setShowStoryComposer] = useState(false);
  const myUserId = useAuthStore(selectUserId);
  const [desktopHistory, setDesktopHistory] = useState<Array<Record<string, unknown>>>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const desktop = useSearch();

  const handleDesktopSelect = useCallback((item: Record<string, unknown>) => {
    // Save to shared search history
    try {
      const h = JSON.parse(localStorage.getItem('gao_search_history') || '[]').filter((x: Record<string, unknown>) => x.id !== item.id);
      h.unshift(item);
      localStorage.setItem('gao_search_history', JSON.stringify(h.slice(0, 10)));
    } catch { /* ignore */ }
    desktop.clear();
    setSearchFocused(false);
    const itemLat = item.lat as number;
    const itemLng = item.lng as number;
    const itemType = item.type as string;
    const isEntity = itemType !== 'place';

    if (itemType === 'business' && !activeLayers.has('business')) toggleLayer('business');
    if (itemType === 'event' && !activeLayers.has('event')) toggleLayer('event');
    if (itemType === 'people' && !activeLayers.has('people')) toggleLayer('people');
    if (itemType === 'circle' && !activeLayers.has('circle')) toggleLayer('circle');

    const hasCoords = !!itemLat && !!itemLng;
    if (hasCoords) {
      const zoom = itemType === 'place' ? 14 : 15;
      window.dispatchEvent(new CustomEvent('gao-fly-to', {
        detail: { lng: itemLng, lat: itemLat, zoom, label: item.title, entityId: isEntity ? item.id : undefined, entityType: isEntity ? itemType : undefined }
      }));
    }
    // For entities, show detail — skip the flyTo delay if there's no destination
    if (isEntity) {
      const preview = { title: item.title as string, subtitle: item.subtitle as string, image: item.image as string };
      if (hasCoords) {
        setTimeout(() => showSearchEntityDetail(item.id as string, itemType, preview), 2500);
      } else {
        showSearchEntityDetail(item.id as string, itemType, preview);
      }
    }
  }, [activeLayers, toggleLayer, desktop]);

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

  // Build query params — 2D: follow map center (100km), 3D: fetch all
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (viewMode === '3d') {
      // 3D globe: fetch everything, no geo filter — cluster handles density
      params.set('lat', '0');
      params.set('lng', '0');
      params.set('radius', '0');
    } else if (mapCenter) {
      params.set('lat', String(mapCenter.lat));
      params.set('lng', String(mapCenter.lng));
      params.set('radius', '100000');
    } else {
      params.set('lat', String(lat ?? 32.7767));
      params.set('lng', String(lng ?? -96.797));
      params.set('radius', '100000');
    }
    params.set('time', timeFilter);
    return params.toString();
  }, [viewMode, mapCenter, lat, lng, timeFilter]);

  // Fetch signals
  const { data: signalsData } = useSWR<{ data: Signal[] }>(
    `/api/v1/signals?${queryParams}&limit=${viewMode === '3d' ? 100 : 30}`,
    fetcher,
    { refreshInterval: 30000, fallbackData: { data: [] } }
  );

  // Agents endpoint isn't deployed on dev — short-circuit to an empty list
  // so the SWR fetcher never hits a 404. Re-enable by passing the URL string
  // here once the API route ships.
  const agentsData: { data: Agent[] } | undefined = { data: [] };

  // Fetch profiles
  const { data: profilesData } = useSWR<{ data: Profile[] }>(
    `/api/v1/profiles?${queryParams}&available=true&limit=${viewMode === '3d' ? 100 : 20}`,
    fetcher,
    { refreshInterval: 60000, fallbackData: { data: [] } }
  );

  // Fetch businesses — 3D needs all, 2D uses viewport
  const { data: businessesData } = useSWR<{ data: Business[] }>(
    `/api/v1/businesses?${queryParams}&limit=${viewMode === '3d' ? 200 : 50}`,
    fetcher,
    { refreshInterval: 60000, fallbackData: { data: [] } }
  );

  // Fetch events
  const { data: eventsData } = useSWR<{ data: Event[] }>(
    `/api/v1/events?${queryParams}&limit=${viewMode === '3d' ? 200 : 50}`,
    fetcher,
    { refreshInterval: 60000, fallbackData: { data: [] } }
  );

  // Fetch circles
  const { data: circlesData } = useSWR<{ data: Circle[] }>(
    `/api/v1/circles?limit=50`,
    fetcher,
    { refreshInterval: 60000, fallbackData: { data: [] } }
  );

  // Fetch users for map (people layer) — follows viewport like other entities
  const { data: mapUsersData } = useSWR<{ data: MapUser[] }>(
    `/api/v1/users/map?${queryParams}&limit=500`,
    fetcher,
    { refreshInterval: 60000, fallbackData: { data: [] } }
  );

  const signals = signalsData?.data ?? [];
  const agents = agentsData?.data ?? [];
  const profiles = profilesData?.data ?? [];
  const businesses = businessesData?.data ?? [];
  const events = eventsData?.data ?? [];
  const circles = circlesData?.data ?? [];
  const mapUsers = mapUsersData?.data ?? [];

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

  // Check if selected marker is a map user (from cluster click)
  const selectedMapUser = selectedMarkerId?.startsWith('user_')
    ? { id: selectedMarkerId.replace('user_', ''), marker: selectedMarker }
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

    // Delay to let map initialize
    const timer = setTimeout(() => {
      // Public endpoint — works for anyone, not just sender/receiver
      fetch(`/api/v1/kisses/${kissId}`)
        .then(r => r.json())
        .then(data => {
          if (data.data) {
            setReplayKiss(data.data);
            // Mark as opened if I'm the receiver. Server enforces auth — fire
            // and ignore failures (the cookie carries the credentials).
            fetch('/api/v1/kisses', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: kissId }),
            }).catch(() => {});
          }
        })
        .catch(() => {});

      window.history.replaceState(null, '', '/world');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Fetch full entity from API and show detail popup (for search results)
  const showSearchEntityDetail = useCallback(async (id: string, type: string, preview?: { title: string; subtitle?: string; image?: string }) => {
    const headers = {  };

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
    const handler = (e: globalThis.Event) => {
      const { entityId, entityType, label } = (e as CustomEvent<{ entityId: string; entityType: string; label?: string }>).detail;
      if (entityId && entityType) {
        showSearchEntityDetail(entityId, entityType, { title: label || '' });
      }
    };
    window.addEventListener('gao-pin-detail', handler);
    return () => window.removeEventListener('gao-pin-detail', handler);
  }, [showSearchEntityDetail]);

  // Listen for cluster click → show React user list
  useEffect(() => {
    const handler = (e: globalThis.Event) => {
      const { users, count, entityType } = (e as CustomEvent).detail;
      setClusterUsers({ users, count, entityType });
    };
    window.addEventListener('gao-cluster-click', handler);
    return () => window.removeEventListener('gao-cluster-click', handler);
  }, []);

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
        <WorldMapInner signals={signals} agents={agents} profiles={profiles} businesses={businesses} events={events} circles={circles} mapUsers={mapUsers} />
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
                {desktop.loading ? (
                  <Loader2 size={15} className="animate-spin shrink-0" style={{ color: '#00d4ff' }} />
                ) : (
                  <Search size={15} className="shrink-0" style={{ color: searchFocused ? '#00d4ff' : '#4a5068' }} />
                )}
                <input
                  value={desktop.query}
                  onChange={(e) => desktop.handleInput(e.target.value)}
                  onFocus={() => { setSearchFocused(true); try { setDesktopHistory(JSON.parse(localStorage.getItem('gao_search_history') || '[]')); } catch { setDesktopHistory([]); } }}
                  onBlur={(e) => {
                    // Don't close dropdown if clicking inside it
                    if (dropdownRef.current?.contains(e.relatedTarget as Node)) return;
                    setTimeout(() => setSearchFocused(false), 200);
                  }}
                  placeholder="Search people, businesses, events, places..."
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-[#4a5068] outline-none"
                />
                {desktop.query && (
                  <button onClick={desktop.clear} className="shrink-0 cursor-pointer" style={{ color: '#4a5068' }}>
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Desktop results dropdown — tabs + grouped results + history */}
              {searchFocused && (desktop.query.length >= 2 || desktopHistory.length > 0) && (
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
                  {desktop.query.length >= 2 && <div className="flex gap-1 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {['top', 'people', 'businesses', 'events', 'circles', 'places'].map(t => (
                      <button
                        key={t}
                        onMouseDown={() => desktop.handleTabChange(t, desktop.query)}
                        className="px-2.5 py-1 rounded-lg text-[9px] font-semibold capitalize cursor-pointer"
                        style={desktop.tab === t
                          ? { background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }
                          : { color: '#4a5068' }
                        }
                      >{t}</button>
                    ))}
                  </div>}

                  {/* Results */}
                  <div className="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 40px)' }}>
                    {desktop.loading && (
                      <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-[#00d4ff]" /></div>
                    )}

                    {!desktop.loading && desktop.tab === 'top' && (
                      <>
                        {(['people', 'businesses', 'events', 'circles', 'places'] as const).map(section => {
                          const items = desktop.results[section] || [];
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
                                  <button onMouseDown={() => desktop.handleTabChange(section, desktop.query)} className="text-[9px] font-semibold text-[#00d4ff] cursor-pointer">See all</button>
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

                    {!desktop.loading && desktop.tab !== 'top' && (
                      (desktop.results[desktop.tab as keyof typeof desktop.results] || []).map((r: Record<string, unknown>) => (
                        <DesktopResultRow key={r.id as string} item={r} onSelect={handleDesktopSelect} />
                      ))
                    )}

                    {!desktop.loading && Object.values(desktop.results).every(arr => arr.length === 0) && desktop.query.length >= 2 && (
                      <p className="text-center text-[11px] text-[#4a5068] py-4">No results</p>
                    )}

                    {/* History — show when no query */}
                    {!desktop.query && desktopHistory.length > 0 && (
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

          {/* ── Stories rail ─ left-aligned on desktop, full-width on mobile */}
          <div className="pointer-events-auto">
            <StoriesRail
              onOpenComposer={() => setShowStoryComposer(true)}
              myUserId={myUserId ?? null}
            />
          </div>
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

        {/* ── Cluster User List ─────────────────────── */}
        {clusterUsers && !selectedMarkerId && (() => {
          const q = clusterFilter.toLowerCase().replace(/\s+/g, '');
          const filtered = q
            ? clusterUsers.users.filter(u => u.name.toLowerCase().replace(/\s+/g, '').includes(q) || u.city.toLowerCase().includes(q))
            : clusterUsers.users;
          return (
          <div className="absolute inset-0 z-40 flex items-end justify-center pb-[calc(64px+env(safe-area-inset-bottom,0px)+12px)] lg:items-center lg:pb-0">
            <div className="absolute inset-0" onClick={() => { setClusterUsers(null); setClusterFilter(''); }} />
            <div
              className="relative mx-3 w-full max-w-sm rounded-2xl overflow-hidden"
              style={{ background: 'rgba(10,11,15,0.97)', border: '1px solid rgba(59,130,246,0.12)', backdropFilter: 'blur(20px)', boxShadow: '0 12px 40px rgba(0,0,0,0.7)' }}
            >
              {/* Header */}
              <div className="px-4 pt-3 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-sm font-semibold" style={{ color: { business: '#22C55E', event: '#EF4444', offer: '#EAB308', profile: '#818CF8' }[clusterUsers.entityType || ''] || '#3B82F6' }}>
                  {{ business: '🏪', event: '🎉', offer: '🏷', profile: '👤' }[clusterUsers.entityType || ''] || '👥'} {clusterUsers.count} {{ business: 'businesses', event: 'events', offer: 'offers', profile: 'profiles' }[clusterUsers.entityType || ''] || 'people'}
                </span>
                  <button onClick={() => { setClusterUsers(null); setClusterFilter(''); }} className="text-[#4a5068] hover:text-white transition-colors cursor-pointer">
                    <X size={16} />
                  </button>
                </div>
                {/* Search input */}
                <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Search size={14} className="shrink-0 text-[#4a5068]" />
                  <input
                    value={clusterFilter}
                    onChange={(e) => setClusterFilter(e.target.value)}
                    placeholder="Search by name or city..."
                    className="flex-1 bg-transparent text-xs text-white placeholder:text-[#4a5068] outline-none"
                    autoFocus
                  />
                  {clusterFilter && (
                    <button onClick={() => setClusterFilter('')} className="text-[#4a5068] cursor-pointer">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
              {/* List */}
              <div className="max-h-[50vh] overflow-y-auto">
                {filtered.length === 0 && (
                  <p className="text-center text-[11px] text-[#4a5068] py-6">No results for &ldquo;{clusterFilter}&rdquo;</p>
                )}
                {filtered.map((u) => {
                  const trustColors: Record<string, string> = { highly_trusted: '#eab308', trusted: '#22c55e', verified: '#3b82f6' };
                  const dotColor = trustColors[u.trust_level];
                  return (
                    <button
                      key={u.id}
                      onClick={() => {
                        setClusterUsers(null);
                        setClusterFilter('');
                        const et = clusterUsers.entityType;
                        if (et === 'business') {
                          showSearchEntityDetail(u.id, 'business', { title: u.name, subtitle: u.city });
                        } else if (et === 'event') {
                          showSearchEntityDetail(u.id, 'event', { title: u.name, subtitle: u.city });
                        } else {
                          setSearchUser({
                            id: u.id,
                            preview: { title: u.name, subtitle: u.city, image: u.avatar || undefined },
                            visibility: u.visibility_reason ? {
                              reason: u.visibility_reason,
                              event_id: u.shared_event_id || undefined,
                              circle_id: u.shared_circle_id || undefined,
                            } : undefined,
                          });
                        }
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] active:bg-white/[0.08] cursor-pointer"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      {u.avatar ? (
                        <img src={u.avatar} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" style={{ border: '2px solid rgba(59,130,246,0.3)' }} />
                      ) : (
                        <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold" style={{ background: 'rgba(59,130,246,0.12)', border: '2px solid rgba(59,130,246,0.25)', color: '#3B82F6' }}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[13px] font-semibold text-[#f0f4ff] truncate">{u.name}</p>
                          {dotColor && <span className="shrink-0 h-1.5 w-1.5 rounded-full" style={{ background: dotColor }} />}
                          <ReasonPill reason={u.visibility_reason} />
                        </div>
                        {u.city && <p className="text-[10px] text-[#4a5068] truncate mt-0.5">{u.city}</p>}
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a5068" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          );
        })()}

        {/* ── Friend Side Panel ─────────────────────── */}
        {selectedFriend && (
          <FriendSidePanel data={{ name: selectedFriend.title, ...selectedFriend.metadata }} />
        )}

        {/* ── Marker Detail Sheet ─────────────────────── */}
        {selectedMarker && !selectedFriend && !selectedDeveloper && !selectedProfile && !selectedBusiness && !selectedEvent && !selectedSignal && !selectedCircle && !selectedMapUser && (
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
          visibility={searchUser.visibility}
          onClose={() => setSearchUser(null)}
        />
      )}

      {/* User detail from map single dot click */}
      {selectedMapUser && !searchUser && (
        <UserSheet
          userId={selectedMapUser.id}
          preview={{ title: selectedMapUser.marker?.title || 'User' }}
          onClose={() => setSelectedMarker(null)}
        />
      )}

      {/* Now Story composer */}
      <StoryComposer
        open={showStoryComposer}
        onClose={() => setShowStoryComposer(false)}
      />

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
          kiss={replayKiss as unknown as Parameters<typeof KissReplayOverlay>[0]['kiss']}
          onClose={() => setReplayKiss(null)}
          onFlyStart={() => {
            // KissGlobe handles the flight animation — no map manipulation here
          }}
        />
      )}
    </div>
  );
}

function ReasonPill({ reason }: { reason?: string }) {
  if (!reason || reason === 'public' || reason === 'self') return null;
  const config: Record<string, { bg: string; color: string; label: string }> = {
    friend: { bg: 'rgba(52,211,153,0.14)', color: '#34d399', label: 'Friend' },
    circle: { bg: 'rgba(0,194,224,0.14)', color: '#00C2E0', label: 'Circle' },
    event:  { bg: 'rgba(168,85,247,0.14)', color: '#A855F7', label: 'Event' },
  };
  const cfg = config[reason];
  if (!cfg) return null;
  return (
    <span className="shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-medium" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}
