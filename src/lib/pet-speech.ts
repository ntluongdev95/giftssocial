// Browser TTS helper for the AI pet voice feature. Uses the built-in
// Web Speech API (`window.speechSynthesis`) so there's no network call,
// no API key, no cost — voices ship with the OS/browser.
//
// All exported functions are no-ops on the server (typeof window check)
// and quietly bail when the platform doesn't support speech synthesis
// (older Android browsers, headless WebViews). Callers should treat the
// boolean return value as "did the request go through" but never block
// the UI on it.

const FEMALE_VOICE_SPECIES = new Set(['🐈', '🐇', '🦊', '🦋', '🦦', '🐢']);
const HIGH_PITCH_SPECIES = new Set(['🐉', '🦋', '🐧']);   // mythical / bird → higher
const LOW_PITCH_SPECIES = new Set(['🦄']);                // gravitas

let cachedVoices: SpeechSynthesisVoice[] | null = null;

/** Voices load asynchronously on most platforms. Calling getVoices() before
 *  the `voiceschanged` event returns []. We register a one-shot listener
 *  the first time the cache is empty so subsequent picks succeed. */
function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const list = window.speechSynthesis.getVoices();
  if (list.length) {
    cachedVoices = list;
    return list;
  }
  // Trigger a populate. The event fires shortly after this.
  if (!cachedVoices) {
    window.speechSynthesis.addEventListener(
      'voiceschanged',
      () => {
        cachedVoices = window.speechSynthesis.getVoices();
      },
      { once: true },
    );
  }
  return [];
}

/** Pick a voice that "fits" the pet. Falls back to any English voice, then
 *  to the first available voice, then to null (browser default). */
function pickVoice(speciesEmoji: string | null): SpeechSynthesisVoice | null {
  const voices = cachedVoices ?? loadVoices();
  if (!voices.length) return null;

  const en = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
  const pool = en.length ? en : voices;
  const wantFemale = speciesEmoji != null && FEMALE_VOICE_SPECIES.has(speciesEmoji);

  // Heuristic by voice name — covers macOS, iOS, Chrome and Edge defaults.
  const FEMALE_NAMES = /female|samantha|karen|victoria|moira|tessa|fiona|allison|ava|susan|kate|serena/i;
  const MALE_NAMES = /male|daniel|alex|tom|fred|albert|aaron|bruce|reed|rishi/i;

  if (wantFemale) {
    const f = pool.find(v => FEMALE_NAMES.test(v.name));
    if (f) return f;
  } else {
    const m = pool.find(v => MALE_NAMES.test(v.name));
    if (m) return m;
  }
  return pool[0] ?? null;
}

export type SpeakOpts = {
  /** Species emoji — drives voice and pitch selection. */
  speciesEmoji?: string | null;
  /** 0.5 – 2. Defaults to 1.05 (slightly perky). */
  rate?: number;
  /** 0 – 2. Defaults to a species-derived value (1.0–1.3). */
  pitch?: number;
};

/** Speak `text` out loud. Returns true if the request was dispatched.
 *  Any previous utterance is cancelled so rapid taps don't queue. */
export function speak(text: string, opts: SpeakOpts = {}): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  if (!text.trim()) return false;

  const synth = window.speechSynthesis;
  synth.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts.rate ?? 1.05;
  u.pitch = opts.pitch ?? (
    opts.speciesEmoji && HIGH_PITCH_SPECIES.has(opts.speciesEmoji) ? 1.3
    : opts.speciesEmoji && LOW_PITCH_SPECIES.has(opts.speciesEmoji) ? 0.85
    : 1.05
  );
  const voice = pickVoice(opts.speciesEmoji ?? null);
  if (voice) u.voice = voice;

  synth.speak(u);
  return true;
}

/** Whether the browser supports speech synthesis at all. Used to hide
 *  speaker buttons on unsupported platforms. */
export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Cancel any in-flight utterance. Call on unmount or when the user
 *  closes a modal mid-speech. */
export function cancelSpeech(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
