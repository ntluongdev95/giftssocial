// AI-generated cartoon pet sprites via Pollinations.ai — free, no API
// key required. Each breed/species gets a deterministic prompt URL; the
// service generates the image on first hit and serves it from CDN after.
//
// The URL itself IS the image (returned via GET as PNG), so we don't
// need to store or download anything — just use it as an <img src>.
//
// Quality is "good enough for a Tamagotchi sprite": chibi cartoon style,
// recognizable as the breed, transparent-ish background.

const POLLINATIONS = 'https://image.pollinations.ai/prompt';

// Tiny deterministic hash → seeds so the same breed always gets the same
// sprite (no flicker on re-render). Not cryptographic — just a stable
// per-input number in 0..2^32.
function seedFor(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Build a Pollinations sprite URL for a pet. The prompt is tuned for
 *  Tamagotchi-style chibi cartoons facing the camera — perfect to drop
 *  into the game stage. */
export function getCartoonSpriteUrl({
  breedLabel,
  speciesName,
  size = 512,
  variant = 'idle',
}: {
  breedLabel?: string | null;
  speciesName: string;       // 'Dog', 'Cat'
  size?: number;
  variant?: 'idle' | 'happy' | 'sleepy';
}): string {
  const subject = breedLabel
    ? `${breedLabel} ${speciesName.toLowerCase()}`
    : speciesName.toLowerCase();

  const moodWord =
    variant === 'happy' ? 'smiling joyfully' :
    variant === 'sleepy' ? 'sleepy, eyes half closed' :
    'cheerful, friendly';

  const prompt = [
    `chibi cartoon ${subject}`,
    `${moodWord}, big round eyes`,
    'kawaii Tamagotchi game character',
    'soft pastel colors, clean vector art',
    'full body, standing front-facing',
    'cute pet sim sprite, simple shapes',
    'no text, no watermark',
    'white background',
  ].join(', ');

  const seed = seedFor(`${subject}|${variant}`);
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

/** Returns a stable cache-bust-free URL for use in <img>. The browser
 *  will cache normally; the CDN caches at Pollinations side. */
export function petSpriteUrl(breedLabel: string | null | undefined, speciesName: string): string {
  return getCartoonSpriteUrl({ breedLabel, speciesName, variant: 'idle' });
}
