'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import maplibregl from 'maplibre-gl';
import useSWR from 'swr';
import { escapeHtml } from '@/lib/sanitize';
import { useLocationStore } from '@/stores/locationStore';
import { useMapStore } from '@/stores/mapStore';
import { useAuthStore } from '@/stores/auth-store';
import StarfieldBackground from './StarfieldBackground';

// ─── Map Context ──────────────────────────────────────────────────────────

interface MapContextValue {
  map: maplibregl.Map | null;
}

export const MapContext = createContext<MapContextValue>({ map: null });
export const useMap = () => useContext(MapContext);

// ─── Constants ────────────────────────────────────────────────────────────

const DALLAS: [number, number] = [-96.797, 32.7767];
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || '';

// Both 2D and 3D use satellite hybrid for beautiful blue/green map
const STYLE_2D = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`;
const STYLE_GLOBE = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`;

// ─── Fade map labels (smaller + transparent) ─────────────────────────────

function fadeMapLabels(map: maplibregl.Map) {
  try {
    const style = map.getStyle();
    if (!style?.layers) return;

    for (const layer of style.layers) {
      if (layer.type !== 'symbol') continue;

      // Shrink text size
      try {
        const currentSize = map.getLayoutProperty(layer.id, 'text-size');
        if (typeof currentSize === 'number') {
          map.setLayoutProperty(layer.id, 'text-size', Math.max(currentSize * 0.7, 8));
        }
      } catch {}

      // Fade text opacity
      try {
        map.setPaintProperty(layer.id, 'text-opacity', 0.35);
      } catch {}

      // Fade text halo
      try {
        map.setPaintProperty(layer.id, 'text-halo-blur', 1);
        map.setPaintProperty(layer.id, 'text-halo-width', 0.5);
      } catch {}
    }
  } catch {}
}

// ─── Props ────────────────────────────────────────────────────────────────

interface WorldMapProps {
  className?: string;
  onMapReady?: (map: maplibregl.Map) => void;
  children?: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function WorldMap({
  className = '',
  onMapReady,
  children,
}: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const currentViewRef = useRef<'2d' | '3d'>('2d');
  const spinRef = useRef<number | null>(null);

  const { lat, lng } = useLocationStore();
  const viewMode = useMapStore((s) => s.viewMode);
  const isAuthed = useAuthStore((s) => s.isAuthed);
  const { data: meData } = useSWR<{ data: { location_sharing?: string } }>(
    isAuthed ? '/api/v1/users/me' : null,
    (url: string) => fetch(url, {
      
    }).then(r => r.json()),
  );
  const selfLocationHidden = meData?.data?.location_sharing === 'off';

  const center: [number, number] =
    lat !== null && lng !== null ? [lng, lat] : DALLAS;

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const is3D = viewMode === '3d';
    currentViewRef.current = viewMode;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: is3D ? STYLE_GLOBE : STYLE_2D,
      center: is3D ? [0, 20] : center,
      zoom: is3D ? (window.innerWidth < 768 ? 1.2 : 1.8) : 13,
      maxZoom: 18,
      minZoom: 0.5,
      attributionControl: false,
    } as maplibregl.MapOptions);

    // Navigation control removed — clean map UI

    map.on('load', () => {
      // Set globe projection after style is fully loaded
      if (is3D) {
        try { if (map.getStyle()) map.setProjection({ type: 'globe' }); } catch (e) { console.warn('Globe projection not supported:', e); }
        // Make background transparent so starfield shows through
        try {
          const style = map.getStyle();
          if (style) {
            style.layers = style.layers?.filter(l => l.id !== 'background') || [];
            map.setStyle(style);
          }
        } catch {}
        // Set canvas background transparent
        const canvas = map.getCanvas();
        if (canvas) canvas.style.background = 'transparent';
      }

      // Make map labels smaller + faded
      fadeMapLabels(map);

      setLoading(false);
      setMapInstance(map);
      mapRef.current = map;
      onMapReady?.(map);
    });

    return () => {
      if (spinRef.current) cancelAnimationFrame(spinRef.current);
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Globe spin ───────────────────────────────────────────────────────────
  const startSpin = useCallback((map: maplibregl.Map) => {
    // Stop any existing spin
    if (spinRef.current) cancelAnimationFrame(spinRef.current);

    const degreesPerSecond = 2;
    let lastTime = performance.now();

    function spin() {
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      const currentCenter = map.getCenter();
      map.setCenter([currentCenter.lng + degreesPerSecond * delta, currentCenter.lat]);

      spinRef.current = requestAnimationFrame(spin);
    }

    spinRef.current = requestAnimationFrame(spin);
  }, []);

  const stopSpin = useCallback(() => {
    if (spinRef.current) {
      cancelAnimationFrame(spinRef.current);
      spinRef.current = null;
    }
  }, []);

  // Pause spin on user drag/zoom, resume after 3s idle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || viewMode !== '3d') return;

    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    const pause = () => {
      stopSpin();
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        if (mapRef.current && currentViewRef.current === '3d') {
          startSpin(mapRef.current);
        }
      }, 3000);
    };

    map.on('mousedown', pause);
    map.on('touchstart', pause);
    map.on('wheel', pause);

    return () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      map.off('mousedown', pause);
      map.off('touchstart', pause);
      map.off('wheel', pause);
    };
  }, [viewMode, loading, startSpin, stopSpin]);

  // ── 2D ↔ 3D (Globe ↔ Mercator) transition ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || loading) return;
    if (currentViewRef.current === viewMode) return;
    currentViewRef.current = viewMode;

    const is3D = viewMode === '3d';

    // Stop spinning when switching to 2D
    if (!is3D) stopSpin();

    // Switch map style
    map.setStyle(is3D ? STYLE_GLOBE : STYLE_2D);

    // Wait for style to fully load before changing projection
    map.once('style.load', () => {
      fadeMapLabels(map);

      if (is3D) {
        try { if (map.getStyle()) map.setProjection({ type: 'globe' }); } catch (e) { console.warn('Globe:', e); }
        // Remove background layer for starfield (mutate in place, don't setStyle again)
        try {
          const bgLayer = map.getLayer('background');
          if (bgLayer) map.removeLayer('background');
        } catch {}
        const canvas = map.getCanvas();
        if (canvas) canvas.style.background = 'transparent';
        const globeCenter: [number, number] =
          lat !== null && lng !== null ? [lng, lat] : [0, 20];
        map.easeTo({
          center: globeCenter,
          zoom: window.innerWidth < 768 ? 1.0 : 1.5,
          pitch: 0,
          bearing: 0,
          duration: 1500,
          easing: (t: number) => 1 - Math.pow(1 - t, 3),
        });
        // Start spinning after zoom animation
        setTimeout(() => {
          if (mapRef.current && currentViewRef.current === '3d') {
            startSpin(mapRef.current);
          }
        }, 1600);
      } else {
        try { map.setProjection({ type: 'mercator' }); } catch (e) { console.warn('Mercator:', e); }
        const userCenter: [number, number] =
          lat !== null && lng !== null ? [lng, lat] : DALLAS;
        map.easeTo({
          center: userCenter,
          zoom: 13,
          pitch: 0,
          bearing: 0,
          duration: 1500,
          easing: (t: number) => 1 - Math.pow(1 - t, 3),
        });
      }

      // Notify markers to re-add AFTER all style modifications are done
      window.dispatchEvent(new CustomEvent('gao-style-changed'));
    });
  }, [viewMode, loading, lat, lng, startSpin, stopSpin]);

  // Fly to user location — only once on first location grant
  const hasFlownToUser = useRef(false);
  useEffect(() => {
    if (!mapRef.current || lat === null || lng === null) return;
    if (hasFlownToUser.current) return;
    hasFlownToUser.current = true;
    if (viewMode === '2d') {
      mapRef.current.flyTo({ center: [lng, lat], zoom: 13, duration: 1500 });
    }
  }, [lat, lng, viewMode]);

  // User location dot (GeoJSON layer — no pointer event blocking)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const removeUserDot = () => {
      try {
        if (map.getLayer('gao-user-dot')) map.removeLayer('gao-user-dot');
        if (map.getLayer('gao-user-pulse')) map.removeLayer('gao-user-pulse');
        if (map.getSource('gao-user-loc')) map.removeSource('gao-user-loc');
      } catch {}
    };

    if (lat === null || lng === null || selfLocationHidden) {
      removeUserDot();
      return;
    }

    const geo: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {} }],
    };

    const addUserDot = () => {
      try {
        if (map.getSource('gao-user-loc')) {
          (map.getSource('gao-user-loc') as maplibregl.GeoJSONSource).setData(geo);
        } else {
          map.addSource('gao-user-loc', { type: 'geojson', data: geo });
          // Outer ring (thin stroke, transparent fill)
          map.addLayer({
            id: 'gao-user-pulse', type: 'circle', source: 'gao-user-loc',
            paint: { 'circle-radius': 8, 'circle-color': 'transparent', 'circle-opacity': 1, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#3B82F6', 'circle-stroke-opacity': 0.5 },
            metadata: { interactive: false },
          });
          // Inner dot
          map.addLayer({
            id: 'gao-user-dot', type: 'circle', source: 'gao-user-loc',
            paint: { 'circle-radius': 3.5, 'circle-color': '#3B82F6', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff' },
            metadata: { interactive: false },
          });
        }
      } catch {}
    };

    if (map.isStyleLoaded()) addUserDot();
    else map.once('style.load', addUserDot);
  }, [lat, lng, selfLocationHidden]);

  // Search pin marker
  const searchPinRef = useRef<maplibregl.Marker | null>(null);

  // Listen for fly-to events from search
  useEffect(() => {
    function handleFlyTo(e: Event) {
      const { lng, lat, zoom, label, skipPin, entityId, entityType } = (e as CustomEvent).detail;
      if (!mapRef.current) return;

      // Remove old search pin
      if (searchPinRef.current) {
        searchPinRef.current.remove();
        searchPinRef.current = null;
      }

      const wasGlobe = currentViewRef.current === '3d';

      // If in globe mode, switch to 2D for street-level
      if (wasGlobe) {
        useMapStore.getState().setViewMode('2d');
      }

      const delay = wasGlobe ? 1800 : 0;

      setTimeout(() => {
        const map = mapRef.current;
        if (!map) return;

        const isAddress = zoom >= 17;

        if (isAddress) {
          // ── Street-level approach: fly close + tilt camera ──
          // Step 1: Fly to area from above
          map.flyTo({ center: [lng, lat], zoom: 16, duration: 1500, pitch: 0 });

          // Step 2: Tilt down to near-street-level
          setTimeout(() => {
            if (!mapRef.current) return;
            mapRef.current.easeTo({
              center: [lng, lat],
              zoom: 19,
              pitch: 72,
              bearing: 30,
              duration: 2000,
              easing: (t: number) => t * (2 - t), // ease-out quad
            });

            // Enable 3D buildings at close range
            try {
              const style = mapRef.current.getStyle();
              if (style?.layers) {
                for (const layer of style.layers) {
                  if (layer.type === 'symbol') {
                    try {
                      mapRef.current!.addLayer({
                        id: 'search-3d-buildings',
                        source: 'openmaptiles',
                        'source-layer': 'building',
                        type: 'fill-extrusion',
                        minzoom: 15,
                        paint: {
                          'fill-extrusion-color': '#1a2030',
                          'fill-extrusion-height': ['get', 'render_height'],
                          'fill-extrusion-base': ['get', 'render_min_height'],
                          'fill-extrusion-opacity': 0.75,
                        },
                      }, layer.id);
                    } catch {}
                    break;
                  }
                }
              }
            } catch {}
          }, 1600);
        } else {
          map.flyTo({ center: [lng, lat], zoom: zoom || 14, duration: 2000, pitch: 0 });
        }

        // Drop pin marker + address card after animation (skip for entity selections)
        if (skipPin) return;
        const pinDelay = isAddress ? 4000 : 2200;
        setTimeout(() => {
          if (!mapRef.current) return;

          const googleStreetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

          const el = document.createElement('div');
          el.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;filter:drop-shadow(0 4px 16px rgba(0,0,0,0.6));">
              <div style="
                background:linear-gradient(135deg,#00d4ff,#6366f1);
                width:36px;height:36px;border-radius:50% 50% 50% 4px;
                display:flex;align-items:center;justify-content:center;
                box-shadow:0 0 20px rgba(0,212,255,0.6);
                transform:rotate(-45deg);
                animation:gao-pulse 2s ease-out infinite;
              ">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="transform:rotate(45deg)">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              ${label ? `<div style="
                position:relative;
                background:rgba(10,11,15,0.92);backdrop-filter:blur(12px);
                border:1px solid rgba(0,212,255,0.2);border-radius:12px;
                padding:8px 14px;padding-right:28px;max-width:260px;
                font-family:Inter,system-ui,sans-serif;
                box-shadow:0 4px 20px rgba(0,0,0,0.5);
                display:flex;flex-direction:column;gap:6px;
              ">
                <button class="gao-pin-close" style="
                  position:absolute;top:6px;right:6px;
                  width:18px;height:18px;border-radius:50%;
                  background:rgba(255,255,255,0.08);border:none;
                  color:#4a5068;cursor:pointer;
                  display:flex;align-items:center;justify-content:center;
                  font-size:12px;line-height:1;
                ">✕</button>
                <div style="font-size:12px;font-weight:700;color:#f0f4ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${escapeHtml(label.split(',')[0])}
                </div>
                <div style="font-size:10px;color:#4a5068;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${escapeHtml(label.split(',').slice(1).join(',').trim())}
                </div>
                ${isAddress ? `<a href="${googleStreetViewUrl}" target="_blank" rel="noopener" style="
                  display:flex;align-items:center;gap:4px;
                  margin-top:2px;padding:4px 8px;border-radius:6px;
                  background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.2);
                  font-size:10px;font-weight:600;color:#00d4ff;
                  text-decoration:none;cursor:pointer;
                ">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                  Open Street View
                </a>` : ''}
              </div>` : ''}
            </div>
          `;

          // Close button
          const closeBtn = el.querySelector('.gao-pin-close');
          if (closeBtn) {
            closeBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              if (searchPinRef.current) {
                searchPinRef.current.remove();
                searchPinRef.current = null;
              }
              // Remove 3D buildings layer
              try { mapRef.current?.removeLayer('search-3d-buildings'); } catch {}
              // Reset camera
              mapRef.current?.easeTo({ pitch: 0, bearing: 0, zoom: 15, duration: 800 });
            });
          }

          // Click label card → open detail popup
          if (entityId && entityType) {
            const labelCard = el.querySelector('.gao-pin-close')?.parentElement;
            if (labelCard) {
              labelCard.style.cursor = 'pointer';
              labelCard.addEventListener('click', (ev) => {
                if ((ev.target as HTMLElement).closest('.gao-pin-close')) return;
                window.dispatchEvent(new CustomEvent('gao-pin-detail', {
                  detail: { entityId, entityType, label }
                }));
              });
            }
          }

          const pin = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([lng, lat])
            .addTo(mapRef.current!);

          searchPinRef.current = pin;
        }, pinDelay);
      }, delay);
    }

    window.addEventListener('gao-fly-to', handleFlyTo);
    return () => window.removeEventListener('gao-fly-to', handleFlyTo);
  }, []);

  // Handle resize
  const handleResize = useCallback(() => {
    mapRef.current?.resize();
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  return (
    <MapContext.Provider value={{ map: mapInstance }}>
      <div className={`relative h-full w-full ${className}`}>
        {/* Starfield behind globe in 3D mode */}
        {viewMode === '3d' && <StarfieldBackground />}
        <div ref={containerRef} className="map-container absolute inset-0" />

        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a0b0f]">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#111318] border-t-[#00d4ff]" />
          </div>
        )}

        {children}
      </div>
    </MapContext.Provider>
  );
}
