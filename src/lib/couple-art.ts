// Pollinations-powered image generation helpers for couple-oriented
// features (ID card portrait, movie poster art, etc). Free, no API key,
// no server round-trip — the URL itself is the image.

const POLLINATIONS = 'https://image.pollinations.ai/prompt';

function seedFor(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type PortraitStyle = 'anime' | 'watercolor' | 'oilpaint' | 'pixel' | 'ghibli' | 'cyberpunk';

export const PORTRAIT_STYLES: Array<{
  id: PortraitStyle;
  label: string;
  emoji: string;
  promptSuffix: string;
}> = [
  { id: 'anime',     label: 'Anime',      emoji: '🌸', promptSuffix: 'anime illustration, soft cel shading, Makoto Shinkai style, delicate lines, romantic mood' },
  { id: 'watercolor',label: 'Watercolor', emoji: '🎨', promptSuffix: 'watercolor painting, soft washes, paper texture, dreamy pastel palette, loose brushwork' },
  { id: 'oilpaint',  label: 'Oil paint',  emoji: '🖼️', promptSuffix: 'classical oil painting, Rembrandt lighting, warm golden hues, rich texture, museum quality' },
  { id: 'ghibli',    label: 'Ghibli',     emoji: '🌾', promptSuffix: 'Studio Ghibli aesthetic, gentle hand-drawn animation, warm sunlight, whimsical background' },
  { id: 'cyberpunk', label: 'Cyberpunk',  emoji: '🌆', promptSuffix: 'cyberpunk illustration, neon pink and cyan lighting, futuristic city backdrop, gritty vibrant' },
  { id: 'pixel',     label: 'Pixel art',  emoji: '👾', promptSuffix: '16-bit pixel art, retro game portrait, warm color palette, dithered shading' },
];

export function coupleArtUrl({
  name1, name2, style, size = 512,
}: { name1: string; name2: string; style: PortraitStyle; size?: number }): string {
  const styleMeta = PORTRAIT_STYLES.find(s => s.id === style) ?? PORTRAIT_STYLES[0];
  const prompt = [
    `romantic portrait of a young couple ${name1 || 'a person'} and ${name2 || 'their partner'}`,
    'standing together, warm smiles, close and affectionate',
    styleMeta.promptSuffix,
    'centered composition, soft background bokeh',
    'no text, no watermark',
  ].join(', ');

  const seed = seedFor(`${name1}|${name2}|${style}`);
  const params = new URLSearchParams({
    width: String(size),
    height: String(size),
    seed: String(seed),
    model: 'flux',
    nologo: 'true',
    enhance: 'true',
  });
  return `${POLLINATIONS}/${encodeURIComponent(prompt)}?${params.toString()}`;
}

// ── Movie poster prompt ──────────────────────────────────────────────────

export type MovieGenre = 'romance' | 'action' | 'comedy' | 'horror' | 'scifi' | 'drama' | 'musical';

export const MOVIE_GENRES: Array<{
  id: MovieGenre;
  label: string;
  emoji: string;
  posterPrompt: string;
  taglineHints: string[];
}> = [
  { id: 'romance',  label: 'Romance',  emoji: '💕',
    posterPrompt: 'romantic movie poster, cinematic composition, warm sunset lighting, close-up of couple, tender emotional atmosphere',
    taglineHints: ['They said it wouldn\'t last', 'A love written in the stars', 'Some love stories deserve a movie'] },
  { id: 'action',   label: 'Action',   emoji: '💥',
    posterPrompt: 'action movie poster, dramatic explosion background, silhouette couple back-to-back, intense contrast, blockbuster style',
    taglineHints: ['Together, they are unstoppable', 'One team. One mission', 'This time it\'s personal'] },
  { id: 'comedy',   label: 'Comedy',   emoji: '😆',
    posterPrompt: 'romantic comedy movie poster, bright playful colors, couple laughing, cheerful mood, casual attire',
    taglineHints: ['Love, awkward, love', 'What could possibly go right?', 'A very complicated love story'] },
  { id: 'horror',   label: 'Horror',   emoji: '🖤',
    posterPrompt: 'horror movie poster, moody dark aesthetic, dramatic shadows, silhouette of couple, red accent, eerie atmosphere',
    taglineHints: ['Don\'t answer the messages', 'Some love never dies', 'You should have swiped left'] },
  { id: 'scifi',    label: 'Sci-fi',   emoji: '🚀',
    posterPrompt: 'science fiction movie poster, futuristic starship background, cosmic nebula, couple in silhouette, cinematic scale',
    taglineHints: ['Across the stars, together', 'Time bends for us', 'The last two humans'] },
  { id: 'drama',    label: 'Drama',    emoji: '🎭',
    posterPrompt: 'prestige drama movie poster, moody cinematic lighting, black and white gradient, film festival aesthetic, contemplative couple',
    taglineHints: ['Everything begins here', 'A love that changed everything', 'From the pages of a life together'] },
  { id: 'musical',  label: 'Musical',  emoji: '🎵',
    posterPrompt: 'musical film poster, vibrant colors, couple dancing, La La Land aesthetic, dreamy stage lights',
    taglineHints: ['Their song', 'When the music started, so did we', 'Sing it like you mean it'] },
];

export function moviePosterUrl({
  name1, name2, genre, size = 640,
}: { name1: string; name2: string; genre: MovieGenre; size?: number }): string {
  const g = MOVIE_GENRES.find(m => m.id === genre) ?? MOVIE_GENRES[0];
  const prompt = [
    g.posterPrompt,
    `starring ${name1 || 'a person'} and ${name2 || 'their partner'}`,
    'portrait orientation, dramatic key art, high production value',
    'no text on the poster',
  ].join(', ');

  const seed = seedFor(`${name1}|${name2}|${genre}|poster`);
  const params = new URLSearchParams({
    width: String(size),
    height: String(Math.round(size * 1.5)),
    seed: String(seed),
    model: 'flux',
    nologo: 'true',
    enhance: 'true',
  });
  return `${POLLINATIONS}/${encodeURIComponent(prompt)}?${params.toString()}`;
}
