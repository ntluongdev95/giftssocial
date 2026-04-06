import { create } from 'zustand';
import type { MarkerData, MarkerState } from '@/types';

interface MapStore {
  markers: Map<string, MarkerData>;
  activeLayers: Set<string>;
  timeFilter: 'live' | '24h' | '7d';
  selectedMarkerId: string | null;
  viewMode: '2d' | '3d';
  mapCenter: { lat: number; lng: number } | null;
  mapZoom: number;
  addMarker: (data: MarkerData) => void;
  removeMarker: (id: string) => void;
  setMarkerState: (id: string, state: MarkerState) => void;
  toggleLayer: (layer: string) => void;
  setSelectedMarker: (id: string | null) => void;
  setTimeFilter: (filter: 'live' | '24h' | '7d') => void;
  setViewMode: (mode: '2d' | '3d') => void;
  setMapCenter: (lat: number, lng: number, zoom: number) => void;
  clearMarkers: () => void;
}

const DEFAULT_LAYERS = new Set<string>([]);

export const useMapStore = create<MapStore>((set) => ({
  markers: new Map(),
  activeLayers: new Set(DEFAULT_LAYERS),
  timeFilter: 'live',
  selectedMarkerId: null,
  viewMode: '3d',
  mapCenter: null,
  mapZoom: 13,

  addMarker: (data) =>
    set((state) => {
      const next = new Map(state.markers);
      next.set(data.id, data);
      return { markers: next };
    }),

  removeMarker: (id) =>
    set((state) => {
      const next = new Map(state.markers);
      next.delete(id);
      return { markers: next, selectedMarkerId: state.selectedMarkerId === id ? null : state.selectedMarkerId };
    }),

  setMarkerState: (id, markerState) =>
    set((state) => {
      const marker = state.markers.get(id);
      if (!marker) return state;
      const next = new Map(state.markers);
      next.set(id, { ...marker, state: markerState });
      return { markers: next };
    }),

  toggleLayer: (layer) =>
    set((state) => {
      const next = new Set(state.activeLayers);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return { activeLayers: next };
    }),

  setSelectedMarker: (id) =>
    set({ selectedMarkerId: id }),

  setTimeFilter: (filter) =>
    set({ timeFilter: filter }),

  setViewMode: (mode) =>
    set({ viewMode: mode }),

  setMapCenter: (lat, lng, zoom) =>
    set({ mapCenter: { lat, lng }, mapZoom: zoom }),

  clearMarkers: () =>
    set({ markers: new Map(), selectedMarkerId: null }),
}));
