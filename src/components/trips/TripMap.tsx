'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

type Stop = {
  id: string;
  position: number;
  place_name: string;
  place_lat: number | null;
  place_lng: number | null;
};

type Props = {
  stops: Stop[];
};

/**
 * Mini-map showing trip stops as numbered pins connected by a polyline.
 * Stops without coords are filtered out by the parent. Falls back to a
 * single-pin centered view when only one stop has coords.
 */
export default function TripMap({ stops }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const validStops = stops.filter(s => s.place_lat != null && s.place_lng != null);
    if (validStops.length === 0) return;

    // Center on first stop; fitBounds below handles multi-stop framing.
    const first = validStops[0];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [first.place_lng!, first.place_lat!],
      zoom: 12,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.on('load', () => {
      // Polyline connecting all stops in order
      if (validStops.length > 1) {
        map.addSource('trip-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: validStops.map(s => [s.place_lng!, s.place_lat!]),
            },
          },
        });
        map.addLayer({
          id: 'trip-route-line',
          type: 'line',
          source: 'trip-route',
          paint: {
            'line-color': '#00d4ff',
            'line-width': 3,
            'line-opacity': 0.85,
            'line-dasharray': [0.5, 1.5],
          },
        });
      }

      // Numbered pins
      validStops.forEach((stop, idx) => {
        const el = document.createElement('div');
        el.className = 'trip-stop-pin';
        el.style.cssText = `
          width: 28px; height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, #00d4ff, #a855f7);
          color: white;
          font-weight: 700;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #0a0b0f;
          box-shadow: 0 4px 12px rgba(0,212,255,0.4);
          cursor: pointer;
        `;
        el.textContent = String(idx + 1);

        new maplibregl.Marker({ element: el })
          .setLngLat([stop.place_lng!, stop.place_lat!])
          .setPopup(
            new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(
              `<div style="font-size:12px;font-weight:600;color:#0a0b0f;padding:2px 4px">${escapeHtml(stop.place_name)}</div>`,
            ),
          )
          .addTo(map);
      });

      // Frame to fit all stops with a little padding
      if (validStops.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        validStops.forEach(s => bounds.extend([s.place_lng!, s.place_lat!]));
        map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [stops]);

  return <div ref={containerRef} className="w-full h-64 lg:h-80 bg-[#1a1d27]" />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
