// Per-species sound-effect synthesizer using the Web Audio API.
// No asset files, no network, no licensing — pure oscillators with
// envelope shaping. Ships free in every modern browser and is good
// enough to make the pet feel alive next to its diary speech bubble.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const W = window as unknown as { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? W.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  // Browsers suspend the context until a user gesture has occurred.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Volume cap so SFX don't overpower the speech utterance. */
const MASTER_GAIN = 0.22;

type ToneSpec = {
  freq: number;        // base frequency in Hz
  type: OscillatorType;
  duration: number;    // total seconds
  attack: number;      // fade-in seconds
  release: number;     // fade-out seconds
  freqEndRatio?: number; // pitch sweep: end freq = freq * ratio
  vibratoHz?: number;  // optional vibrato
  vibratoDepth?: number; // vibrato depth in Hz
  noise?: number;      // 0–1, mix in white noise (panting, fluttering)
};

function playTone(spec: ToneSpec, when = 0): void {
  const audio = getCtx();
  if (!audio) return;
  const t0 = audio.currentTime + when;
  const t1 = t0 + spec.duration;

  const osc = audio.createOscillator();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.freq, t0);
  if (spec.freqEndRatio) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, spec.freq * spec.freqEndRatio),
      t1,
    );
  }
  if (spec.vibratoHz && spec.vibratoDepth) {
    const lfo = audio.createOscillator();
    const lfoGain = audio.createGain();
    lfo.frequency.value = spec.vibratoHz;
    lfoGain.gain.value = spec.vibratoDepth;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t1);
  }

  const gain = audio.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(MASTER_GAIN, t0 + spec.attack);
  gain.gain.linearRampToValueAtTime(0, t1 - spec.release > t0 ? t1 - spec.release + spec.release : t1);

  osc.connect(gain).connect(audio.destination);
  osc.start(t0);
  osc.stop(t1);

  if (spec.noise && spec.noise > 0) {
    // Layer a quick white-noise burst for snarl/fluttering texture.
    const buf = audio.createBuffer(1, Math.ceil(audio.sampleRate * spec.duration), audio.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * spec.noise;
    const src = audio.createBufferSource();
    src.buffer = buf;
    const noiseGain = audio.createGain();
    noiseGain.gain.setValueAtTime(0, t0);
    noiseGain.gain.linearRampToValueAtTime(MASTER_GAIN * spec.noise, t0 + spec.attack);
    noiseGain.gain.linearRampToValueAtTime(0, t1);
    src.connect(noiseGain).connect(audio.destination);
    src.start(t0);
    src.stop(t1);
  }
}

// ── Species presets ──────────────────────────────────────────────────────
// Each preset is a short sequence of tones — barks come in pairs, meows
// have a frequency sweep, dragons growl low with noise. Tuned by ear.

const SFX_MAP: Record<string, () => void> = {
  // Dog — two staccato barks
  '🐕': () => {
    playTone({ freq: 380, type: 'sawtooth', duration: 0.14, attack: 0.005, release: 0.07, freqEndRatio: 0.65, noise: 0.1 }, 0);
    playTone({ freq: 420, type: 'sawtooth', duration: 0.13, attack: 0.005, release: 0.07, freqEndRatio: 0.65, noise: 0.1 }, 0.18);
  },
  // Cat — single rising meow
  '🐈': () => {
    playTone({ freq: 520, type: 'triangle', duration: 0.42, attack: 0.04, release: 0.18, freqEndRatio: 1.4, vibratoHz: 6, vibratoDepth: 18 }, 0);
  },
  // Rabbit — soft squeak
  '🐇': () => {
    playTone({ freq: 720, type: 'sine', duration: 0.16, attack: 0.01, release: 0.08, freqEndRatio: 1.2 }, 0);
    playTone({ freq: 760, type: 'sine', duration: 0.14, attack: 0.01, release: 0.07, freqEndRatio: 1.2 }, 0.2);
  },
  // Fox — wheezy yip
  '🦊': () => {
    playTone({ freq: 480, type: 'sawtooth', duration: 0.2, attack: 0.01, release: 0.1, freqEndRatio: 0.7, noise: 0.15 }, 0);
  },
  // Sloth — slow hum
  '🦥': () => {
    playTone({ freq: 220, type: 'sine', duration: 0.55, attack: 0.1, release: 0.25, vibratoHz: 3, vibratoDepth: 6 }, 0);
  },
  // Otter — playful trill
  '🦦': () => {
    playTone({ freq: 600, type: 'triangle', duration: 0.1, attack: 0.005, release: 0.04 }, 0);
    playTone({ freq: 700, type: 'triangle', duration: 0.1, attack: 0.005, release: 0.04 }, 0.12);
    playTone({ freq: 800, type: 'triangle', duration: 0.1, attack: 0.005, release: 0.04 }, 0.24);
  },
  // Raccoon — chittery growl
  '🦝': () => {
    playTone({ freq: 320, type: 'sawtooth', duration: 0.25, attack: 0.01, release: 0.12, vibratoHz: 14, vibratoDepth: 30, noise: 0.18 }, 0);
  },
  // Unicorn — bell whinny
  '🦄': () => {
    playTone({ freq: 700, type: 'sine', duration: 0.18, attack: 0.005, release: 0.08, freqEndRatio: 1.2 }, 0);
    playTone({ freq: 900, type: 'sine', duration: 0.45, attack: 0.005, release: 0.18, freqEndRatio: 1.15, vibratoHz: 7, vibratoDepth: 20 }, 0.18);
  },
  // Penguin — high honk
  '🐧': () => {
    playTone({ freq: 880, type: 'square', duration: 0.18, attack: 0.005, release: 0.08, freqEndRatio: 0.75 }, 0);
  },
  // Turtle — slow flat hum
  '🐢': () => {
    playTone({ freq: 170, type: 'sine', duration: 0.5, attack: 0.05, release: 0.2 }, 0);
  },
  // Dragon — low growl + noise
  '🐉': () => {
    playTone({ freq: 110, type: 'sawtooth', duration: 0.55, attack: 0.02, release: 0.25, freqEndRatio: 0.7, vibratoHz: 9, vibratoDepth: 20, noise: 0.3 }, 0);
  },
  // Phoenix — bright shimmer
  '🦋': () => {
    playTone({ freq: 1200, type: 'sine', duration: 0.32, attack: 0.005, release: 0.16, freqEndRatio: 1.3, vibratoHz: 14, vibratoDepth: 40 }, 0);
  },
};

/** Play a species SFX. Falls back to a generic chirp if the species is
 *  unknown. Safe to call from server-side render — no-ops there. */
export function playPetSFX(speciesEmoji: string | null | undefined): void {
  if (!speciesEmoji) return;
  const fn = SFX_MAP[speciesEmoji];
  if (fn) fn();
  else playTone({ freq: 600, type: 'sine', duration: 0.18, attack: 0.005, release: 0.08, freqEndRatio: 1.2 });
}

/** Whether audio output is available. Used to hide play buttons on
 *  environments without Web Audio. */
export function isSFXSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const W = window as unknown as { webkitAudioContext?: typeof AudioContext };
  return !!(window.AudioContext ?? W.webkitAudioContext);
}
