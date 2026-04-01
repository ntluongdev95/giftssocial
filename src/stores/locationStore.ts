import { create } from 'zustand';

interface LocationStore {
  lat: number | null;
  lng: number | null;
  granted: boolean;
  city: string | null;
  loading: boolean;
  error: string | null;
  requestLocation: () => Promise<void>;
  setCity: (city: string) => void;
}

function loadSaved() {
  if (typeof window === 'undefined') return { lat: null, lng: null, granted: false };
  try {
    const raw = localStorage.getItem('gao_location');
    if (!raw) return { lat: null, lng: null, granted: false };
    const p = JSON.parse(raw);
    return { lat: p.lat ?? null, lng: p.lng ?? null, granted: !!p.granted };
  } catch { return { lat: null, lng: null, granted: false }; }
}

const saved = loadSaved();

export const useLocationStore = create<LocationStore>((set) => ({
  lat: saved.lat,
  lng: saved.lng,
  granted: saved.granted,
  city: null,
  loading: false,
  error: null,

  requestLocation: async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      set({ error: 'Geolocation not supported', granted: false });
      return;
    }

    set({ loading: true, error: null });

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
          });
        }
      );

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      try { localStorage.setItem('gao_location', JSON.stringify({ lat, lng, granted: true })); } catch {}
      set({ lat, lng, granted: true, loading: false, error: null });
    } catch (err) {
      const message =
        err instanceof GeolocationPositionError
          ? err.message
          : 'Failed to get location';
      set({ granted: false, loading: false, error: message });
    }
  },

  setCity: (city) => set({ city }),
}));
