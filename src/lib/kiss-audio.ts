'use client';

/**
 * Kiss Replay Audio — cinematic sound effects using Web Audio API.
 * No external files needed — generates tones programmatically.
 * Optional: place custom files in /public/audio/ to override.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Play a single tone */
function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15, delay = 0) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, c.currentTime + delay);
  gain.gain.linearRampToValueAtTime(volume, c.currentTime + delay + 0.05);
  gain.gain.linearRampToValueAtTime(0, c.currentTime + delay + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime + delay);
  osc.stop(c.currentTime + delay + duration);
}

/** Romantic intro chime — ascending notes */
export function playIntroSound() {
  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  notes.forEach((freq, i) => playTone(freq, 0.6, 'sine', 0.1, i * 0.3));
}

/** Whoosh sound for flying */
export function playFlyingSound() {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.3);
  osc.frequency.exponentialRampToValueAtTime(100, c.currentTime + 1.5);
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(0.06, c.currentTime + 0.1);
  gain.gain.linearRampToValueAtTime(0, c.currentTime + 1.5);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 1.5);
}

/** Heartbeat sound for arrival */
export function playHeartbeat() {
  [0, 0.3].forEach(delay => {
    playTone(80, 0.15, 'sine', 0.2, delay);
    playTone(60, 0.1, 'sine', 0.15, delay + 0.08);
  });
}

/** Celebration pop + sparkle for arrival */
export function playCelebration() {
  // Pop
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, c.currentTime + 0.05);
  osc.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.3);
  gain.gain.setValueAtTime(0.2, c.currentTime);
  gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.3);

  // Sparkle cascade
  const sparkleNotes = [1318, 1568, 2093, 2637, 3136]; // E6, G6, C7, E7, G7
  sparkleNotes.forEach((freq, i) => playTone(freq, 0.3, 'sine', 0.08, 0.1 + i * 0.1));
}

/** Soft chime for message reveal */
export function playMessageChime() {
  playTone(784, 0.4, 'sine', 0.1, 0);     // G5
  playTone(988, 0.4, 'sine', 0.08, 0.15);  // B5
  playTone(1175, 0.5, 'sine', 0.06, 0.3);  // D6
}

/** Romantic melody loop for background — returns stop function */
export function playRomanticBg(): () => void {
  const c = getCtx();
  // Simple arpeggiated chords: Am - F - C - G
  const chords = [
    [440, 523, 659],   // Am
    [349, 440, 523],   // F
    [523, 659, 784],   // C
    [392, 494, 587],   // G
  ];

  let stopped = false;
  let timeouts: ReturnType<typeof setTimeout>[] = [];

  function playChord(notes: number[], time: number) {
    notes.forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, c.currentTime + time + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.04, c.currentTime + time + i * 0.15 + 0.05);
      gain.gain.linearRampToValueAtTime(0, c.currentTime + time + i * 0.15 + 1.2);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(c.currentTime + time + i * 0.15);
      osc.stop(c.currentTime + time + i * 0.15 + 1.5);
    });
  }

  function loop() {
    if (stopped) return;
    chords.forEach((chord, i) => playChord(chord, i * 2));
    timeouts.push(setTimeout(() => loop(), chords.length * 2 * 1000));
  }

  loop();

  return () => {
    stopped = true;
    timeouts.forEach(clearTimeout);
  };
}

/** Proposal ring sound — magical ascending */
export function playProposalSound() {
  const notes = [440, 554, 659, 880, 1109, 1319]; // A4→E6 major
  notes.forEach((freq, i) => playTone(freq, 0.5, 'triangle', 0.1, i * 0.2));
  // Final shimmer
  setTimeout(() => {
    [2093, 2637, 3136].forEach((freq, i) => playTone(freq, 0.8, 'sine', 0.05, i * 0.08));
  }, 1300);
}

/** "Yes!" celebration — big fanfare */
export function playYesSound() {
  // Fanfare
  const fanfare = [523, 659, 784, 1047, 784, 1047]; // C major ascending
  fanfare.forEach((freq, i) => playTone(freq, 0.3, 'triangle', 0.12, i * 0.15));
  // Confetti pops
  setTimeout(() => {
    for (let i = 0; i < 5; i++) {
      const c = getCtx();
      const noise = c.createOscillator();
      const gain = c.createGain();
      noise.type = 'square';
      noise.frequency.value = 800 + Math.random() * 1200;
      gain.gain.setValueAtTime(0.08, c.currentTime + i * 0.1);
      gain.gain.linearRampToValueAtTime(0, c.currentTime + i * 0.1 + 0.05);
      noise.connect(gain);
      gain.connect(c.destination);
      noise.start(c.currentTime + i * 0.1);
      noise.stop(c.currentTime + i * 0.1 + 0.05);
    }
  }, 800);
}
