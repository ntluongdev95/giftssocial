// Preset music library for the gift/kiss flow. Each track carries a
// mood + optional list of occasion IDs where it should surface in the
// picker. Premium tracks cost coins to attach — a small monetisation
// hook that layers on top of the base kiss cost.
//
// URLs are placeholders — swap in real audio files or streaming URLs
// (SoundCloud / self-hosted MP3 / etc.) when the assets are ready. The
// UI stores whatever URL is chosen; playback in the reveal is Phase 2.

export type MusicMood = 'romantic' | 'festive' | 'friendship' | 'family' | 'sad' | 'happy';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  url: string;           // audio URL (mp3 / webm)
  duration: number;      // seconds
  mood: MusicMood;
  coins: number;         // 0 = free, >0 = premium unlock
  occasionIds?: string[]; // filter: show first when these occasions active
}

export const MUSIC_LIBRARY: MusicTrack[] = [
  // ── ROMANTIC (Valentine, 8/3, 20/10) ──
  { id: 'r-co-em-cho',  title: 'Có Em Chờ',   artist: 'Min',        url: '/audio/co-em-cho.mp3',  duration: 30, mood: 'romantic', coins: 0,  occasionIds: ['valentine'] },
  { id: 'r-yeu',        title: 'Yêu',          artist: 'Min',        url: '/audio/yeu.mp3',        duration: 30, mood: 'romantic', coins: 0,  occasionIds: ['valentine'] },
  { id: 'r-anh-nho-em', title: 'Anh Nhớ Em', artist: 'Duy Mạnh', url: '/audio/anh-nho-em.mp3', duration: 30, mood: 'romantic', coins: 5,  occasionIds: ['valentine'] },
  { id: 'r-perfect',    title: 'Perfect',      artist: 'Ed Sheeran', url: '/audio/perfect.mp3',    duration: 30, mood: 'romantic', coins: 20, occasionIds: ['valentine'] },
  { id: 'r-thousand',   title: 'A Thousand Years', artist: 'Christina Perri', url: '/audio/thousand-years.mp3', duration: 30, mood: 'romantic', coins: 15, occasionIds: ['valentine'] },

  // ── FESTIVE (Christmas / Tết / Trung Thu) ──
  { id: 'f-jingle',     title: 'Jingle Bells', artist: 'Traditional', url: '/audio/jingle-bells.mp3', duration: 30, mood: 'festive', coins: 0, occasionIds: ['christmas'] },
  { id: 'f-last-xmas',  title: 'Last Christmas', artist: 'Wham!',      url: '/audio/last-christmas.mp3', duration: 30, mood: 'festive', coins: 10, occasionIds: ['christmas'] },
  { id: 'f-tet-que-em', title: 'Ngày Tết Quê Em', artist: 'Từ Huy', url: '/audio/tet-que-em.mp3', duration: 30, mood: 'festive', coins: 0, occasionIds: ['tet'] },
  { id: 'f-xuan-oi-xuan', title: 'Xuân Ơi Xuân', artist: 'Various', url: '/audio/xuan-oi-xuan.mp3', duration: 30, mood: 'festive', coins: 0, occasionIds: ['tet'] },
  { id: 'f-den-cu',     title: 'Chiếc Đèn Ông Sao', artist: 'Traditional', url: '/audio/den-ong-sao.mp3', duration: 30, mood: 'festive', coins: 0, occasionIds: ['mid-autumn'] },

  // ── FAMILY (Mother's day / Father's day) ──
  { id: 'm-me',         title: 'Mẹ Yêu', artist: 'Phương Thảo', url: '/audio/me-yeu.mp3', duration: 30, mood: 'family', coins: 0, occasionIds: ['womens-day', 'vietnam-womens-day'] },
  { id: 'm-cha-yeu-oi', title: 'Cha Yêu Ơi', artist: 'Various', url: '/audio/cha-yeu-oi.mp3', duration: 30, mood: 'family', coins: 5 },

  // ── FRIENDSHIP ──
  { id: 'fr-ban-toi',   title: 'Bạn Tôi', artist: 'Various',        url: '/audio/ban-toi.mp3',        duration: 30, mood: 'friendship', coins: 0 },
  { id: 'fr-count',     title: 'Count on Me', artist: 'Bruno Mars', url: '/audio/count-on-me.mp3',   duration: 30, mood: 'friendship', coins: 10 },

  // ── HAPPY / GENERIC ──
  { id: 'h-happy',      title: 'Happy',        artist: 'Pharrell Williams', url: '/audio/happy.mp3',      duration: 30, mood: 'happy', coins: 10 },
];

// Occasion-mood mapping — used to filter tracks per occasion in the picker.
const OCCASION_MOODS: Record<string, MusicMood[]> = {
  valentine:            ['romantic'],
  'womens-day':         ['family', 'romantic', 'happy'],
  'vietnam-womens-day': ['family', 'romantic', 'happy'],
  'mid-autumn':         ['festive', 'family'],
  christmas:            ['festive', 'happy'],
  tet:                  ['festive', 'family'],
};

// Tracks curated for a specific occasion — occasion-tagged first, then
// other tracks matching the occasion's mood themes as fallback.
export function tracksForOccasion(occasionId: string): MusicTrack[] {
  const tagged = MUSIC_LIBRARY.filter(t => t.occasionIds?.includes(occasionId));
  const moods = OCCASION_MOODS[occasionId] ?? [];
  const byMood = MUSIC_LIBRARY.filter(t => !t.occasionIds?.includes(occasionId) && moods.includes(t.mood));
  const seen = new Set<string>();
  return [...tagged, ...byMood].filter(t => (seen.has(t.id) ? false : (seen.add(t.id), true)));
}
