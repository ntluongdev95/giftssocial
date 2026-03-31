import { create } from 'zustand';

export interface Landmark {
  id: string;
  name: string;
  icon: string;      // emoji hoặc symbol
  country: string;
  city: string;
  type: 'tower' | 'building' | 'monument' | 'bridge' | 'temple' | 'palace' | 'statue' | 'wonder';
  height?: number;   // meters
  lng: number;
  lat: number;
}

const WORLD_LANDMARKS: Landmark[] = [
  // ── Towers ────────────────────────────────────────
  { id: 'lm_eiffel',      name: 'Eiffel Tower',           icon: '🗼', country: 'France',       city: 'Paris',         type: 'tower',    height: 330,  lng: 2.2945,    lat: 48.8584 },
  { id: 'lm_tokyo_tower', name: 'Tokyo Tower',            icon: '🗼', country: 'Japan',        city: 'Tokyo',         type: 'tower',    height: 333,  lng: 139.7454,  lat: 35.6586 },
  { id: 'lm_cn_tower',    name: 'CN Tower',               icon: '🗼', country: 'Canada',       city: 'Toronto',       type: 'tower',    height: 553,  lng: -79.3871,  lat: 43.6426 },
  { id: 'lm_berlin_tv',   name: 'Berlin TV Tower',        icon: '🗼', country: 'Germany',      city: 'Berlin',        type: 'tower',    height: 368,  lng: 13.4094,   lat: 52.5208 },
  { id: 'lm_skytree',     name: 'Tokyo Skytree',          icon: '🗼', country: 'Japan',        city: 'Tokyo',         type: 'tower',    height: 634,  lng: 139.8107,  lat: 35.7101 },

  // ── Tallest Buildings ─────────────────────────────
  { id: 'lm_burj',        name: 'Burj Khalifa',           icon: '🏙️', country: 'UAE',          city: 'Dubai',         type: 'building', height: 828,  lng: 55.2744,   lat: 25.1972 },
  { id: 'lm_shanghai',    name: 'Shanghai Tower',         icon: '🏙️', country: 'China',        city: 'Shanghai',      type: 'building', height: 632,  lng: 121.5055,  lat: 31.2357 },
  { id: 'lm_empire',      name: 'Empire State Building',  icon: '🏙️', country: 'USA',          city: 'New York',      type: 'building', height: 443,  lng: -73.9857,  lat: 40.7484 },
  { id: 'lm_101',         name: 'Taipei 101',             icon: '🏙️', country: 'Taiwan',       city: 'Taipei',        type: 'building', height: 508,  lng: 121.5654,  lat: 25.0340 },
  { id: 'lm_petronas',    name: 'Petronas Towers',        icon: '🏙️', country: 'Malaysia',     city: 'Kuala Lumpur',  type: 'building', height: 452,  lng: 101.7118,  lat: 3.1578 },
  { id: 'lm_one_wtc',     name: 'One World Trade Center', icon: '🏙️', country: 'USA',          city: 'New York',      type: 'building', height: 541,  lng: -74.0134,  lat: 40.7127 },
  { id: 'lm_shard',       name: 'The Shard',              icon: '🏙️', country: 'UK',           city: 'London',        type: 'building', height: 310,  lng: -0.0865,   lat: 51.5045 },
  { id: 'lm_lotte',       name: 'Lotte World Tower',      icon: '🏙️', country: 'South Korea',  city: 'Seoul',         type: 'building', height: 555,  lng: 127.1028,  lat: 37.5126 },
  { id: 'lm_landmark81',  name: 'Landmark 81',            icon: '🏙️', country: 'Vietnam',      city: 'Ho Chi Minh',   type: 'building', height: 461,  lng: 106.7219,  lat: 10.7953 },

  // ── Monuments & Wonders ───────────────────────────
  { id: 'lm_liberty',     name: 'Statue of Liberty',      icon: '🗽', country: 'USA',          city: 'New York',      type: 'statue',   height: 93,   lng: -74.0445,  lat: 40.6892 },
  { id: 'lm_christ',      name: 'Christ the Redeemer',    icon: '⛪', country: 'Brazil',       city: 'Rio de Janeiro',type: 'statue',   height: 38,   lng: -43.2105,  lat: -22.9519 },
  { id: 'lm_colosseum',   name: 'Colosseum',              icon: '🏟️', country: 'Italy',        city: 'Rome',          type: 'monument', height: 48,   lng: 12.4924,   lat: 41.8902 },
  { id: 'lm_taj',         name: 'Taj Mahal',              icon: '🕌', country: 'India',        city: 'Agra',          type: 'palace',   height: 73,   lng: 78.0421,   lat: 27.1751 },
  { id: 'lm_bigben',      name: 'Big Ben',                icon: '🕰️', country: 'UK',           city: 'London',        type: 'tower',    height: 96,   lng: -0.1246,   lat: 51.5007 },
  { id: 'lm_opera',       name: 'Sydney Opera House',     icon: '🎭', country: 'Australia',    city: 'Sydney',        type: 'monument',              lng: 151.2153,  lat: -33.8568 },
  { id: 'lm_pyramid',     name: 'Great Pyramid of Giza',  icon: '🔺', country: 'Egypt',        city: 'Giza',          type: 'wonder',   height: 146,  lng: 31.1342,   lat: 29.9792 },
  { id: 'lm_machu',       name: 'Machu Picchu',           icon: '🏔️', country: 'Peru',         city: 'Cusco',         type: 'wonder',                lng: -72.5450,  lat: -13.1631 },
  { id: 'lm_wall',        name: 'Great Wall of China',    icon: '🧱', country: 'China',        city: 'Beijing',       type: 'wonder',                lng: 116.5704,  lat: 40.4319 },
  { id: 'lm_kremlin',     name: 'Kremlin',                icon: '🏰', country: 'Russia',       city: 'Moscow',        type: 'palace',                lng: 37.6173,   lat: 55.7520 },

  // ── Bridges ───────────────────────────────────────
  { id: 'lm_golden_gate', name: 'Golden Gate Bridge',     icon: '🌉', country: 'USA',          city: 'San Francisco', type: 'bridge',                lng: -122.4786, lat: 37.8199 },
  { id: 'lm_tower_bridge',name: 'Tower Bridge',           icon: '🌉', country: 'UK',           city: 'London',        type: 'bridge',                lng: -0.0754,   lat: 51.5055 },

  // ── Temples ───────────────────────────────────────
  { id: 'lm_angkor',      name: 'Angkor Wat',             icon: '🛕', country: 'Cambodia',     city: 'Siem Reap',     type: 'temple',                lng: 103.8670,  lat: 13.4125 },
  { id: 'lm_sagrada',     name: 'Sagrada Familia',        icon: '⛪', country: 'Spain',        city: 'Barcelona',     type: 'temple',   height: 172,  lng: 2.1744,    lat: 41.4036 },
];

interface LandmarkStore {
  landmarks: Landmark[];
  showOnMap: boolean;
  toggleShowOnMap: () => void;
}

export const useLandmarkStore = create<LandmarkStore>((set) => ({
  landmarks: WORLD_LANDMARKS,
  showOnMap: false, // disabled for now
  toggleShowOnMap: () => set((s) => ({ showOnMap: !s.showOnMap })),
}));
