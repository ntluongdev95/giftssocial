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

export const useLocationStore = create<LocationStore>((set) => ({
  lat: null,
  lng: null,
  granted: false,
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

      set({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        granted: true,
        loading: false,
        error: null,
      });
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
