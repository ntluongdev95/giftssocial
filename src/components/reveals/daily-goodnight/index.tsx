'use client';


import { useMemo, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getKissString, parseKissData } from '../_shared/useTemplateData';
import type { TemplateProps, TemplateConfig } from '../_types';
import DailyGoodnight2Reveal from '../daily-goodnight-2';
import PasswordLock from '@/components/map/PasswordLock';

// ─── Palette ─────────────────────────────────────────────────────────
const ACCENT      = '#f59e0b';   // warm amber   // deep terracotta
const ACCENT_HOT  = '#fef3c7';   // hot cream (candle core)
const AURORA_A    = '#7c3aed';   // violet
const AURORA_B    = '#22d3ee';   // cyan
const AURORA_C    = '#f472b6';   // pink
const FIREFLY     = '#fef08a';   // pale yellow

// ─────────────────────────────────────────────────────────────────────
// Particle heart + persistent galaxy — 4-phase canvas reveal.
//
// TWO particle roles share one canvas:
//   HEART  (~1200 dots) — reject-sampled inside the heart curve
//     (x² + y² − 1)³ − x² · y³ ≤ 0. Follow the wow arc:
//        gather → spinning upper-galaxy → collapse into heart shape.
//   GALAXY (~600 dots)  — always live in a SECOND smaller galaxy
//     positioned BELOW the heart. Spin forever in bluish-purple
//     starlight so the heart appears suspended above a cosmic disk.
//
//   Phase 1  GATHER  (0-1.2s)  — heart dust flies to upper galaxy,
//                                galaxy dust flies to lower galaxy.
//   Phase 2  GALAXY  (1.2-3.2s)— both galaxies spin together.
//   Phase 3  MORPH   (3.2-5.0s)— upper galaxy COLLAPSES into heart;
//                                lower galaxy keeps spinning. WOW.
//   Phase 4  IDLE    (5s+)     — heart breathes above, galaxy spins
//                                beneath forever.
// ─────────────────────────────────────────────────────────────────────
function ParticleHeart({ delay = 0 }: { delay?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delay * 1000);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Two visual centers on the tall canvas — heart above, galaxy below.
    // On mobile the viewport is narrow (W small) so Math.min(W, H*0.9)
    // used to be W, giving a tiny heart. Now we use a base that leans
    // on the viewport's minor axis with a floor so mobile stays big.
    const heartCx = W / 2;
    const heartCy = H * 0.22;                           // ~21vh from top
    const isNarrow = W < 720;                           // typical mobile portrait
    const heartScale = isNarrow
      ? W * 0.34                                        // ~68vw wide heart on mobile
      : Math.min(W, H * 0.9) * 0.19;

    const galaxyCx = W / 2;
    const galaxyCy = H * 0.52;                          // ~50vh — middle of screen
    const galaxyScale = isNarrow
      ? W * 0.42                                        // ~84vw wide galaxy on mobile
      : Math.min(W, H * 0.9) * 0.22;

    type Role = 'heart' | 'galaxy';
    type P = {
      role: Role;
      // Heart target (only used when role === 'heart')
      tx: number; ty: number;
      // Galaxy assignment (polar) — heart particles use upper galaxy,
      // galaxy particles use lower galaxy.
      armAngle: number;
      armRadius: number;
      // Scatter start
      sx: number; sy: number;
      size: number;
      hue: number; light: number;              // heart particle target hue
      alpha: number;
      twinkle: number;
    };
    const particles: P[] = [];

    const HEART_TARGET = 1200;
    const GALAXY_TARGET = 600;

    // ── Heart particles (reject-sample inside the heart curve) ──
    let attempts = 0;
    while (particles.length < HEART_TARGET && attempts < HEART_TARGET * 40) {
      attempts++;
      const rx = (Math.random() - 0.5) * 2.6;
      const ry = (Math.random() - 0.5) * 2.6;
      const a = rx * rx + ry * ry - 1;
      if (a * a * a - rx * rx * ry * ry * ry > 0) continue;

      const tx = heartCx + rx * heartScale;
      const ty = heartCy - ry * heartScale;

      const idx = particles.length;
      const arm = idx % 3;
      const armT = idx / HEART_TARGET;
      const armAngle = arm * ((Math.PI * 2) / 3)
                     + armT * Math.PI * 2.3
                     + (Math.random() - 0.5) * 0.4;
      const armRadius = 0.12 + Math.sqrt(armT) * 0.9
                      + (Math.random() - 0.5) * 0.06;

      const dist = Math.hypot(rx, ry);
      particles.push({
        role: 'heart',
        tx, ty, armAngle, armRadius,
        sx: heartCx + (Math.random() - 0.5) * W * 1.8,
        sy: heartCy + (Math.random() - 0.5) * H * 1.6,
        size: 0.7 + Math.random() * 1.5,
        hue: 356 + Math.random() * 8,
        light: 38 + dist * 22 + Math.random() * 8,
        alpha: 0.7 + Math.random() * 0.3,
        twinkle: Math.random() * Math.PI * 2,
      });
    }

    // ── Lower galaxy particles (spiral arms, differential rotation) ──
    // Inner particles smaller-radius get bigger sizes + higher alpha →
    // bright dense core. Outer are dimmer wispy dust. Each particle
    // gets its own orbital speed via Kepler-like 1/√r so the swirl
    // feels physically real (inner sweeps fast, outer drags).
    for (let i = 0; i < GALAXY_TARGET; i++) {
      const arm = i % 4;
      const armT = i / GALAXY_TARGET;
      const armAngle = arm * ((Math.PI * 2) / 4)
                     + armT * Math.PI * 3.2
                     + (Math.random() - 0.5) * 0.6;
      const armRadius = 0.08 + Math.sqrt(armT) * 0.98
                      + (Math.random() - 0.5) * 0.08;
      // Radial "drift" — each particle wobbles in/out slightly around
      // its arm radius, creating a breathing swirl
      const twinkle = Math.random() * Math.PI * 2;
      // Core weighting — brighter, larger, denser toward center
      const coreWeight = Math.max(0, 1 - armRadius);
      const sizeBase = 0.55 + Math.random() * 1.1 + coreWeight * 1.4;
      const alphaBase = 0.45 + Math.random() * 0.35 + coreWeight * 0.25;

      particles.push({
        role: 'galaxy',
        tx: 0, ty: 0,
        armAngle, armRadius,
        sx: galaxyCx + (Math.random() - 0.5) * W * 1.5,
        sy: galaxyCy + (Math.random() - 0.5) * H * 1.2,
        size: sizeBase,
        hue: 0, light: 0,
        alpha: Math.min(1, alphaBase),
        twinkle,
      });
    }

    // Phase timing (ms)
    const GATHER_MS = 1200;
    const GALAXY_MS = 2000;
    const MORPH_MS  = 1800;
    const gatherEnd = GATHER_MS;
    const galaxyEnd = GATHER_MS + GALAXY_MS;
    const morphEnd  = galaxyEnd + MORPH_MS;

    const startTime = performance.now();

    const upperGalaxyXY = (p: P, spinRot: number): [number, number] => {
      const a = p.armAngle + spinRot;
      const r = p.armRadius * heartScale * 1.1;
      return [heartCx + Math.cos(a) * r, heartCy + Math.sin(a) * r * 0.65];
    };
    // Lower galaxy uses per-particle DIFFERENTIAL rotation. Inner
    // particles orbit faster (Kepler v ∝ 1/√r) so the swirl reads as
    // a gravitational vortex, not a rigid wheel. Each particle also
    // wobbles its radius slightly (radial breathing) for magic.
    const lowerGalaxyXY = (p: P, elapsed: number, tiltPhase: number): [number, number] => {
      const orbitalSpeed = 1.55 / Math.sqrt(p.armRadius + 0.25);       // faster inner, faster outer overall
      const a = p.armAngle - (elapsed / 1000) * orbitalSpeed;
      const rBreath = 1 + 0.055 * Math.sin(elapsed / 900 + p.twinkle); // radial pulse
      const r = p.armRadius * galaxyScale * rBreath;
      // Disk tilt wobble — the whole disk gently tips (as if drifting
      // in cosmic wind) which is what gives the "công trọng" gravity
      // magic feel.
      const tilt = 0.42 + 0.12 * Math.sin(tiltPhase);
      return [galaxyCx + Math.cos(a) * r, galaxyCy + Math.sin(a) * r * tilt];
    };

    const draw = (now: number) => {
      const elapsed = now - startTime;

      // ── Motion trails via destination-out (magic swirl arcs) ──
      // Each frame we FADE existing canvas content by ~12% instead of
      // clearing it entirely. Older particle positions bleed to
      // transparent, leaving faint arc trails behind fast orbits.
      // Because we use destination-out (not fillRect), there's no
      // rectangular boundary — the canvas alpha remains transparent
      // over unused areas.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      ctx.fillRect(0, 0, W, H);

      const spinBase = elapsed / 1000 * 1.1;                       // faster overall spin
      const morphT = Math.max(0, Math.min(1, (elapsed - galaxyEnd) / MORPH_MS));
      const upperSpin = spinBase * (1 - morphT * 0.7);
      const tiltPhase = elapsed / 3800;                             // slow disk tilt wobble

      ctx.globalCompositeOperation = 'lighter';

      for (const p of particles) {
        let x: number, y: number;
        let colorH: number, colorL: number, colorS: number;
        let sizeMul = 1;

        if (p.role === 'galaxy') {
          // Lower galaxy — gather with a curved trajectory, then swirl
          // forever with differential rotation + radial breathing.
          const t = Math.min(1, elapsed / gatherEnd);
          const eased = 1 - Math.pow(1 - t, 3);
          const [gx, gy] = lowerGalaxyXY(p, elapsed, tiltPhase);
          x = p.sx + (gx - p.sx) * eased;
          y = p.sy + (gy - p.sy) * eased;

          // Core weighting again for colour → hot violet-white at
          // core, cool blue-purple at edges, subtle drift over time.
          const coreWeight = Math.max(0, 1 - p.armRadius);
          const hueBase = 232 + Math.sin(elapsed / 2600 + p.twinkle) * 20;
          colorH = hueBase - coreWeight * 8;                          // core skews warmer
          colorS = 55 + coreWeight * 15;
          colorL = 68 + coreWeight * 20;                              // brighter core

          // Twinkle — inner particles twinkle faster / harder
          const twSpeed = 180 + p.armRadius * 240;
          sizeMul = 0.75 + 0.55 * Math.sin(elapsed / twSpeed + p.twinkle);
        } else if (elapsed < gatherEnd) {
          // Heart phase 1: scatter → upper galaxy
          const t = elapsed / gatherEnd;
          const eased = 1 - Math.pow(1 - t, 3);
          const [gx, gy] = upperGalaxyXY(p, upperSpin);
          x = p.sx + (gx - p.sx) * eased;
          y = p.sy + (gy - p.sy) * eased;
          colorH = 210; colorL = 82; colorS = 30;
        } else if (elapsed < galaxyEnd) {
          // Heart phase 2: upper galaxy spinning
          const [gx, gy] = upperGalaxyXY(p, upperSpin);
          x = gx; y = gy;
          colorH = 210; colorL = 82; colorS = 30;
          sizeMul = 0.8 + 0.4 * Math.sin(elapsed / 250 + p.twinkle);
        } else if (elapsed < morphEnd) {
          // Heart phase 3: galaxy → heart (the wow)
          const t = morphT;
          const eased = 1 - Math.pow(1 - t, 3);
          const [gx, gy] = upperGalaxyXY(p, upperSpin);
          x = gx + (p.tx - gx) * eased;
          y = gy + (p.ty - gy) * eased;
          colorH = 210 + (p.hue - 210) * eased;
          colorL = 82 + (p.light - 82) * eased;
          colorS = 30 + (100 - 30) * eased;
        } else {
          // Heart phase 4: idle breathe
          const heartT = (elapsed - morphEnd) / 1000;
          const breath = 1 + 0.035 * Math.sin(heartT * 2.4);
          const bx = heartCx + (p.tx - heartCx) * breath;
          const by = heartCy + (p.ty - heartCy) * breath;
          x = bx + (Math.random() - 0.5) * 0.8;
          y = by + (Math.random() - 0.5) * 0.8;
          colorH = p.hue; colorL = p.light; colorS = 100;
        }

        ctx.fillStyle = `hsla(${colorH}, ${colorS}%, ${colorL}%, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size * sizeMul, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(rafRef.current);
  }, [mounted]);

  // Canvas covers most of the viewport so the lower galaxy has room
  // to live beneath the heart without falling off-screen.
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: 0,
        top: 0,
        width: '100vw',
        height: '95vh',
        perspective: 1600,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay }}
    >
      <motion.div
        style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d' }}
        animate={{ rotateY: [-14, 14, -14] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DroneShow — small glowing "drones" fly in from off-screen and land
// along the border of whatever they're revealing (here: the character
// video card), like a real drone light show assembling a shape. Same
// fly-in-and-land technique as HeroDroneText, generalized from
// individual glyphs to points around a rectangle. Renders inside a
// `position: relative` wrapper matching the target's own box so the
// percentage landing points line up with its edges.
// ─────────────────────────────────────────────────────────────────────
function DroneShow() {
  const drones = useMemo(() => (
    Array.from({ length: 46 }).map((_, i) => {
      const s = (i * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      const edge = i % 4;              // 0 top, 1 right, 2 bottom, 3 left
      const t = r(1);
      let tx: number, ty: number;
      if (edge === 0) { tx = t * 100; ty = 0; }
      else if (edge === 1) { tx = 100; ty = t * 100; }
      else if (edge === 2) { tx = t * 100; ty = 100; }
      else { tx = 0; ty = t * 100; }
      return {
        tx, ty,
        fromX: (r(2) - 0.5) * 140,     // vw
        fromY: (r(3) - 0.5) * 100 - 20, // vh, biased upward
        delay: 0.2 + r(4) * 1.3,
      };
    })
  ), []);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
      {drones.map((d, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${d.tx}%`, top: `${d.ty}%`, width: 5, height: 5,
            marginLeft: -2.5, marginTop: -2.5,
            background: '#fff',
            boxShadow: '0 0 6px #fff, 0 0 14px #93c5fd, 0 0 22px #93c5fd88',
          }}
          initial={{ x: `${d.fromX}vw`, y: `${d.fromY}vh`, opacity: 0, scale: 0.4 }}
          animate={{ x: 0, y: 0, opacity: [0, 1, 1, 0.6], scale: [0.4, 1.3, 1, 0.8] }}
          transition={{ duration: 1.4, delay: d.delay, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MatrixRain — hacker-style falling/streaming text. Columns confined
// to the left/right margins (skips the centre band) so nothing crosses
// in front of the video card that sits there; a couple of rows drift
// across the very top. Same technique already proven in
// daily-sorry-flower, recoloured to this template's warm amber palette.
// ─────────────────────────────────────────────────────────────────────
function MatrixRain({ text }: { text: string }) {
  const stream = useMemo(() => `${text}   `.repeat(4), [text]);

  // Spread across the FULL width, including behind the video card —
  // the card sits at a higher z-index and is opaque, so it naturally
  // covers just its own rectangle while the empty space around/below
  // it (where the card doesn't reach) still shows the stream passing
  // through instead of a dead gap.
  const columns = useMemo(() => (
    Array.from({ length: 24 }).map((_, i) => {
      const s = ((i + 300) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      return {
        left: r(1) * 100,
        dur: 3.5 + r(2) * 2.5,
        delay: r(3) * 4,
        opacity: 0.4 + r(4) * 0.4,
        fontSize: 16 + r(5) * 8,
      };
    })
  ), []);

  const rows = useMemo(() => (
    Array.from({ length: 5 }).map((_, i) => {
      const s = ((i + 700) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      return {
        top: 4 + (i / 5) * 14 + r(1) * 3,
        dur: 5 + r(2) * 3,
        delay: r(3) * 4,
        reverse: i % 2 === 0,
        opacity: 0.25 + r(4) * 0.3,
      };
    })
  ), []);

  const glowStyle = {
    fontFamily: '"Courier New", monospace',
    fontWeight: 700,
    color: '#ff5fa8',
    textShadow: '0 0 6px #ff5fa8, 0 0 14px #ff5fa888',
    letterSpacing: '0.3em',
    whiteSpace: 'nowrap' as const,
  };

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {columns.map((c, i) => (
        <motion.div
          key={`col-${i}`}
          className="absolute"
          style={{ left: `${c.left}%`, top: '-25%', writingMode: 'vertical-rl', opacity: c.opacity, fontSize: c.fontSize, ...glowStyle }}
          animate={{ top: ['-25%', '125%'] }}
          transition={{ duration: c.dur, delay: c.delay, repeat: Infinity, ease: 'linear' }}
        >
          {stream}
        </motion.div>
      ))}
      {rows.map((row, i) => (
        <motion.div
          key={`row-${i}`}
          className="absolute"
          style={{ top: `${row.top}%`, opacity: row.opacity, fontSize: 18, ...glowStyle }}
          initial={{ left: row.reverse ? '115%' : '-70%' }}
          animate={{ left: row.reverse ? '-70%' : '115%' }}
          transition={{ duration: row.dur, delay: row.delay, repeat: Infinity, ease: 'linear' }}
        >
          {stream}
        </motion.div>
      ))}
    </div>
  );
}



// ─────────────────────────────────────────────────────────────────────
// useTypewriter — reveals `text` one character at a time.
// ─────────────────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 38, startDelay = 300) {
  const [rendered, setRendered] = useState('');
  useEffect(() => {
    let i = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const startTimer = setTimeout(() => {
      interval = setInterval(() => {
        i++;
        setRendered(text.slice(0, i));
        if (i >= text.length && interval) clearInterval(interval);
      }, speed);
    }, startDelay);
    return () => {
      clearTimeout(startTimer);
      if (interval) clearInterval(interval);
    };
  }, [text, speed, startDelay]);
  return { text: rendered, done: rendered.length >= text.length };
}

type Phase = 'confess' | 'heart' | 'close';

function DailyGoodnightReveal({ kiss, onClose }: TemplateProps) {
  // Sender picks up to 6 photos (template_data.photos, an array) —
  // shown falling in Phase 3, tap to enlarge. Falls back to the legacy
  // singular `photo` field for kisses sent before this template
  // switched to the multi-photo picker.
  const galleryPhotos: string[] = (() => {
    const raw = parseKissData(kiss).photos;
    if (Array.isArray(raw)) {
      const urls = raw.filter((u): u is string => typeof u === 'string' && !!u).slice(0, 6);
      if (urls.length > 0) return urls;
    }
    const legacy = getKissString(kiss, 'photo');
    return legacy ? [legacy] : [];
  })();
  const rawName =
    (getKissString(kiss, 'name') || kiss.receiver_name || 'you').trim();
  const displayName = rawName || 'you';

  // ── 3 gated phases — tap "Tiếp tục" advances, nothing auto-advances
  // except Phase 3's own closing timer. ──
  //   Phase 1 · CONFESS — drone show assembles to reveal the character
  //     video, confession line types out below.
  //   Phase 2 · HEART — the existing particle-galaxy → heart → photo
  //     centrepiece, now its own dedicated beat.
  //   Phase 3 · CLOSE — closing line + signature, auto-closes.
  const [phase, setPhase] = useState<Phase>('confess');
  // Phase 1 opens locked behind a birthday-passcode door before the
  // video — this gates which of the two shows.
  const [unlocked, setUnlocked] = useState(false);
  const goToHeart = () => setPhase('heart');
  const goToClose = () => setPhase('close');

  // Phase 3's falling-photos gallery — tap one to enlarge; auto-clears
  // so it falls back into the stream instead of staying stuck open.
  const [enlargedIdx, setEnlargedIdx] = useState<number | null>(null);

  // Phase 3's message types out over ~3s total (speed scales with its
  // length) — gated on `phase` the same way the drone caption used to
  // be, so it doesn't finish typing off-screen before Phase 3 is even
  // reached. Only once it's done typing does the close timer start.
  const messageSpeed = kiss.message ? Math.max(18, 2800 / kiss.message.length) : 40;
  const messageTyped = useTypewriter(phase === 'close' ? (kiss.message || '') : '', messageSpeed, 300);

  useEffect(() => {
    if (phase !== 'close') return;
    if (kiss.message && !messageTyped.done) return;
    const t = setTimeout(() => onClose(), 2200);
    return () => clearTimeout(t);
  }, [phase, kiss.message, messageTyped.done, onClose]);

  // Ephemeral hearts spawned on tap — expire themselves after floating up.
  // Interactive delight: recipient taps anywhere → a small heart rises.
  const [tapHearts, setTapHearts] = useState<{ id: number; x: number; y: number; emoji: string; hue: number }[]>([]);
  const spawnHeart = (e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore taps on interactive descendants (close button, buttons).
    const target = e.target as HTMLElement;
    if (target.closest('button, a')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const emojis = ['❤️', '💕', '💖', '💗', '💘', '♥'];
    setTapHearts(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        hue: Math.random() * 40 - 20,
      },
    ].slice(-30));  // cap at 30 so DOM stays lean
  };

  // Stars — 220 across the upper 60% of sky, 3 brightness tiers so
  // the field feels natural against pitch-black backdrop. Persistent
  // across all 3 phases.
  const stars = useMemo(() => (
    Array.from({ length: 220 }).map((_, i) => {
      const s = (i * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      const tier = i % 8 === 0 ? 'bright' : i % 3 === 0 ? 'mid' : 'faint';
      return {
        left: r(1) * 100,
        // Full height, not just the upper 60% — only Phase 2 has
        // mountains/lake covering the lower portion (stars there just
        // sit hidden behind it); Phase 1 and 3 have nothing down
        // there, so capping stars at 60% left them looking empty.
        top:  r(2) * 100,
        size: tier === 'bright' ? 1.8 + r(3) * 1.2
            : tier === 'mid'    ? 1.0 + r(3) * 0.6
            :                     0.5 + r(3) * 0.5,
        delay: 2 + r(4) * 6,
        duration: 3 + r(5) * 4,
        baseOpacity: tier === 'bright' ? 1.0
                   : tier === 'mid'    ? 0.85
                   :                     0.55,
      };
    })
  ), []);

  // Shooting stars — SUBTLE accents, persistent across all 3 phases.
  const shootingStars = useMemo(() => {
    const COUNT = 4;
    const GAP = 10;
    const CYCLE = COUNT * GAP;
    return Array.from({ length: COUNT }).map((_, i) => {
      const s = (i * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;

      const angleDeg = 30 + r(1) * 20;
      const angleRad = (angleDeg * Math.PI) / 180;

      const distance = 55 + r(2) * 25;
      const dxSign = i % 2 === 0 ? 1 : -1;
      const dx = Math.cos(angleRad) * distance * dxSign;
      const dy = Math.sin(angleRad) * distance;

      const startX = dxSign > 0 ? 5 + r(4) * 30 : 65 + r(4) * 30;
      const startY = -8 + r(5) * 8;

      const trailAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const duration = 0.45 + r(6) * 0.35;

      return {
        id: i,
        startX, startY, dx, dy, trailAngle,
        duration,
        delay:       i * GAP + r(7) * 1.5 + 4,
        repeatDelay: CYCLE - duration,
        length:      80 + r(9) * 40,
      };
    });
  }, []);

  // 18 fireflies floating in the foreground — used in Phase 3's calmer
  // closing scene.
  const fireflies = useMemo(() => (
    Array.from({ length: 18 }).map((_, i) => {
      const s = (i * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      return {
        id: i,
        left: 10 + r(1) * 80,
        bottom: 20 + r(2) * 20,
        driftX: (r(3) - 0.5) * 80,
        driftY: (r(4) - 0.5) * 40,
        duration: 6 + r(5) * 4,
        delay: 1 + r(6) * 4,
        size: 3 + r(7) * 3,
      };
    })
  ), []);

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden cursor-pointer" onClick={spawnHeart}>
      {/* ─── SKY BACKDROP · deep BLACK night sky — persistent across
             all 3 phases. ─────────────────────────────────────────── */}
      <div className="absolute inset-0" style={{
        background:
          'radial-gradient(ellipse at 50% 15%, rgba(20,15,45,0.35) 0%, transparent 55%),' +
          'linear-gradient(180deg, #000105 0%, #010208 45%, #000104 100%)',
      }} />

      {/* ─── STARS · persistent across all 3 phases ──────────────── */}
      {stars.map((s, i) => (
        <motion.div
          key={`star-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${s.left}%`, top: `${s.top}%`,
            width: s.size, height: s.size,
            background: '#ffffff',
            boxShadow: s.size > 1.4
              ? `0 0 ${s.size * 3}px rgba(255,255,255,0.9), 0 0 ${s.size * 6}px rgba(255,255,255,0.35)`
              : `0 0 ${s.size * 2}px rgba(255,255,255,0.55)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [s.baseOpacity * 0.35, s.baseOpacity, s.baseOpacity * 0.35] }}
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* ─── SHOOTING STARS · persistent across all 3 phases ─────── */}
      {shootingStars.map(ss => (
        <motion.div
          key={`ss-${ss.id}`}
          className="absolute pointer-events-none"
          style={{ left: 0, top: 0 }}
          initial={{ x: `${ss.startX}vw`, y: `${ss.startY}vh`, opacity: 0 }}
          animate={{
            x: `${ss.startX + ss.dx}vw`,
            y: `${ss.startY + ss.dy}vh`,
            opacity: [0, 0.7, 0.7, 0],
          }}
          transition={{
            duration: ss.duration, delay: ss.delay, repeat: Infinity,
            repeatDelay: ss.repeatDelay, ease: 'linear', times: [0, 0.15, 0.75, 1],
          }}
        >
          <div style={{
            position: 'absolute', right: 0, top: -0.75,
            width: ss.length, height: 1.5, transformOrigin: '100% 50%',
            transform: `rotate(${ss.trailAngle}deg)`, borderRadius: 1.5,
            background: 'linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.15) 60%, rgba(255,255,255,0.7) 95%, rgba(255,255,255,0.9) 100%)',
            boxShadow: '0 0 3px rgba(255,255,255,0.4)',
          }} />
        </motion.div>
      ))}

      <AnimatePresence mode="wait">
        {/* ─── Phase 1 · CONFESS — drone show reveals the character
               video, confession line types out below. ─────────────── */}
        {phase === 'confess' && (
          <motion.div
            key="confess"
            className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
          >
            {/* Matrix-style falling text behind everything else in this
                phase — only once the door is unlocked. */}
            {unlocked && <MatrixRain text={`${displayName} · I · YOU ·`} />}

            <AnimatePresence mode="wait">
              {!unlocked ? (
                <PasswordLock
                  key="password-lock"
                  correct="1103"
                  hint="Gợi ý: Ngày sinh nhật của bạn"
                  minimal
                  senderName={kiss.sender_name}
                  accent={ACCENT}
                  onSuccess={() => setUnlocked(true)}
                />
              ) : (
                <motion.div
                  key="video-confess"
                  className="flex flex-col items-center gap-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6 }}
                >
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      width: 'min(98vw, 560px)',
                    }}
                  >
                    <DroneShow />
                    <video
                      src="/videos/video.mp4"
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full block"
                    />
                  </div>

                  <motion.button
                    type="button"
                    onClick={goToHeart}
                    className="cursor-pointer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.9 }}
                    transition={{ delay: 1, duration: 0.6 }}
                    style={{
                      fontFamily: '"Inter", sans-serif',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#fff',
                      background: 'rgba(0,0,0,0.35)',
                      border: `1px solid ${ACCENT}55`,
                      borderRadius: 999,
                      padding: '8px 20px',
                    }}
                  >
                    Tiếp tục →
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ─── Phase 2 · HEART — particle-galaxy → heart → photo, the
               centrepiece "khoảnh khắc thổ lộ" moment. Reuses the
               original ParticleHeart canvas untouched; the surrounding
               greeting/figure/hearts now run on shorter delays since
               they no longer share one 32s timeline with Phase 1. ─── */}
        {phase === 'heart' && (
          <motion.div
            key="heart"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* ─── MOUNTAINS ──────────────────────────────────────── */}
            <svg
              viewBox="0 0 1000 220" preserveAspectRatio="none"
              className="absolute inset-x-0 w-full pointer-events-none"
              style={{ bottom: '30%', height: '20%' }}
            >
              <path d="M 0 220 L 0 140 Q 80 100 160 120 T 320 105 T 500 90 T 680 100 T 850 80 T 1000 105 L 1000 220 Z" fill="#050a14" opacity="0.9" />
              <path d="M 0 220 L 0 170 Q 120 150 240 160 T 460 150 T 700 165 T 1000 155 L 1000 220 Z" fill="#000104" />
            </svg>

            {/* ─── MIST ───────────────────────────────────────────── */}
            <div className="absolute inset-x-0 pointer-events-none" style={{
              bottom: '28%', height: '10%',
              background: 'linear-gradient(180deg, transparent, rgba(60,80,120,0.14) 40%, rgba(40,60,100,0.18))',
              filter: 'blur(4px)',
            }} />

            {/* ─── SHORE + TWO SILHOUETTES ────────────────────────── */}
            <div className="absolute inset-x-0 pointer-events-none" style={{ bottom: '30%' }}>
              <ShoreSilhouettes accent={ACCENT} />
            </div>

            {/* ─── SINGLE FIGURE ──────────────────────────────────── */}
            <motion.div
              className="absolute pointer-events-none"
              style={{
                left: '50%', top: '42vh', transform: 'translateX(-50%)',
                width: 'clamp(70px, 10vw, 110px)', height: 'clamp(120px, 17vw, 190px)',
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.6, delay: 5, ease: [0.16, 1, 0.3, 1] }}
            >
              <SingleFigure accent={ACCENT_HOT} />
            </motion.div>

            {/* ─── FLYING HEARTS ──────────────────────────────────── */}
            {[0, 1, 2, 3, 4, 5].map(i => {
              const s = (i * 2654435761) >>> 0;
              const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
              const sway = (r(1) - 0.5) * 12;
              const size = 14 + r(2) * 10;
              const dur = 4.5 + r(3) * 1.5;
              return (
                <motion.div
                  key={`fh-${i}`}
                  className="absolute pointer-events-none"
                  style={{
                    left: '50%', top: '48vh', transform: 'translateX(-50%)',
                    width: size, height: size,
                  }}
                  initial={{ y: 0, x: 0, opacity: 0, scale: 0.3 }}
                  animate={{
                    y: [0, `-32vh`],
                    x: [0, `${sway}vw`, `${-sway}vw`, `${sway * 0.4}vw`],
                    opacity: [0, 0.95, 0.95, 0],
                    scale: [0.3, 1, 1, 0.7],
                  }}
                  transition={{
                    duration: dur, delay: 6 + i * 0.8, repeat: Infinity,
                    repeatDelay: 2 + (i % 3), ease: 'easeOut', times: [0, 0.2, 0.75, 1],
                  }}
                >
                  <svg viewBox="0 0 20 20" width="100%" height="100%" style={{ filter: 'drop-shadow(0 0 4px #ef4444) drop-shadow(0 0 10px rgba(244,63,94,0.6))' }}>
                    <path d="M 10 18 C 4 13, 1 9, 1 6 C 1 3, 3 1, 6 1 C 8 1, 9 2, 10 4 C 11 2, 12 1, 14 1 C 17 1, 19 3, 19 6 C 19 9, 16 13, 10 18 Z" fill="#ef4444" />
                    <path d="M 10 18 C 4 13, 1 9, 1 6 C 1 3, 3 1, 6 1 C 8 1, 9 2, 10 4 C 11 2, 12 1, 14 1 C 17 1, 19 3, 19 6 C 19 9, 16 13, 10 18 Z" fill="url(#fh-sheen)" opacity="0.7" />
                    <defs>
                      <radialGradient id="fh-sheen" cx="30%" cy="25%" r="50%">
                        <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
                        <stop offset="60%" stopColor="#fff" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                  </svg>
                </motion.div>
              );
            })}

            {/* ─── FLYING WORDS · pink love-words rising from the
                   spinning galaxy below, same rise-and-sway motion as
                   the hearts above. ──────────────────────────────── */}
            {Array.from({ length: 14 }).map((_, i) => {
              const words = ['Yêu thương', 'May mắn', 'Hạnh phúc', 'Mỉm cười', displayName];
              const word = words[i % words.length];
              const s = ((i + 40) * 2654435761) >>> 0;
              const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
              const sway = (r(1) - 0.5) * 16;
              const dur = 5 + r(2) * 2;
              const startX = (r(3) - 0.5) * 60;
              return (
                <motion.div
                  key={`fw-${i}`}
                  className="absolute pointer-events-none whitespace-nowrap"
                  style={{
                    left: '50%', top: '52vh', transform: 'translateX(-50%)',
                    fontFamily: '"Dancing Script", "Segoe Script", cursive',
                    fontSize: 'clamp(16px, 2.6vw, 22px)',
                    fontWeight: 600,
                    color: '#ff5fa8',
                    textShadow: '0 0 8px #ff5fa8, 0 0 16px #ff5fa888',
                  }}
                  initial={{ y: 0, x: `${startX}vw`, opacity: 0, scale: 0.5 }}
                  animate={{
                    y: [0, '-34vh'],
                    x: [`${startX}vw`, `${startX + sway}vw`, `${startX - sway}vw`, `${startX + sway * 0.4}vw`],
                    opacity: [0, 0.95, 0.95, 0],
                    scale: [0.5, 1, 1, 0.8],
                  }}
                  transition={{
                    duration: dur, delay: 3 + i * 0.5, repeat: Infinity,
                    repeatDelay: 1 + (i % 3) * 0.5, ease: 'easeOut', times: [0, 0.2, 0.75, 1],
                  }}
                >
                  {word}
                </motion.div>
              );
            })}

            {/* ─── FLYING PHOTOS · uploaded photos rising from the
                   galaxy too, same motion as the words above. ────── */}
            {galleryPhotos.map((url, i) => {
              const s = ((i + 500) * 2654435761) >>> 0;
              const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
              const sway = (r(1) - 0.5) * 18;
              const dur = 6 + r(2) * 2.5;
              const startX = (r(3) - 0.5) * 55;
              const size = 74 + r(4) * 22;
              const rot = (r(5) - 0.5) * 16;
              return (
                <motion.div
                  key={`fp-${i}`}
                  className="absolute cursor-pointer"
                  style={{
                    left: '50%', top: '52vh', transform: 'translateX(-50%)',
                    width: size, height: size, padding: 4, background: '#fff', borderRadius: 5,
                    boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
                    zIndex: 5,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEnlargedIdx(i);
                    setTimeout(() => setEnlargedIdx(cur => (cur === i ? null : cur)), 2500);
                  }}
                  initial={{ y: 0, x: `${startX}vw`, opacity: 0, scale: 0.4, rotate: rot }}
                  animate={{
                    y: [0, '-36vh'],
                    x: [`${startX}vw`, `${startX + sway}vw`, `${startX - sway}vw`, `${startX + sway * 0.4}vw`],
                    opacity: [0, 0.95, 0.95, 0],
                    scale: [0.4, 1, 1, 0.75],
                    rotate: [rot, -rot, rot],
                  }}
                  transition={{
                    duration: dur, delay: 4 + i * 1.4, repeat: Infinity,
                    repeatDelay: 2 + (i % 3) * 0.6, ease: 'easeOut', times: [0, 0.2, 0.75, 1],
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" style={{ borderRadius: 3 }} />
                </motion.div>
              );
            })}

            {/* Enlarged overlay — tap any flying photo above to zoom. */}
            <AnimatePresence>
              {enlargedIdx !== null && galleryPhotos[enlargedIdx] && (
                <motion.div
                  className="fixed inset-0 flex items-center justify-center pointer-events-none"
                  style={{ zIndex: 60 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
                  <motion.div
                    className="relative"
                    style={{ padding: 8, background: '#fff', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}
                    initial={{ scale: 0.6, rotate: -4 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={galleryPhotos[enlargedIdx]}
                      alt=""
                      style={{ maxWidth: 'min(80vw, 340px)', maxHeight: '60vh', width: 'auto', height: 'auto', borderRadius: 4, display: 'block' }}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ─── LAKE WATER ─────────────────────────────────────── */}
            <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{
              height: '30%',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(20,10,25,0.85) 40%, #050208 100%)',
            }}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                <motion.div
                  key={`wave-${i}`}
                  className="absolute inset-x-0"
                  style={{
                    top: `${8 + i * 11}%`, height: 1,
                    background: `linear-gradient(90deg, transparent 10%, rgba(200,220,255,0.12) 50%, transparent 90%)`,
                    filter: 'blur(0.5px)',
                  }}
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 3 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
                />
              ))}
            </div>

            {/* ─── 3D PARTICLE HEART ──────────────────────────────── */}
            <ParticleHeart delay={0.4} />

            <motion.button
              type="button"
              onClick={goToClose}
              className="absolute cursor-pointer"
              style={{
                left: '50%', bottom: '4%', transform: 'translateX(-50%)',
                fontFamily: '"Inter", sans-serif', fontSize: 13, fontWeight: 600, color: '#fff',
                background: 'rgba(0,0,0,0.35)', border: `1px solid ${ACCENT}55`, borderRadius: 999, padding: '8px 20px',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.9 }}
              transition={{ delay: 7, duration: 0.8 }}
            >
              Tiếp tục →
            </motion.button>
          </motion.div>
        )}

        {/* ─── Phase 3 · CLOSE — closing line + signature, calm shore
               scene, auto-closes after 10s. ──────────────────────── */}
        {phase === 'close' && (
          <motion.div
            key="close"
            className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
          >
            {/* Fireflies for a calmer, intimate closing atmosphere */}
            {fireflies.map(f => (
              <motion.div
                key={`ff-${f.id}`}
                className="absolute pointer-events-none rounded-full"
                style={{
                  left: `${f.left}%`, bottom: `${f.bottom}%`, width: f.size, height: f.size,
                  background: FIREFLY,
                  boxShadow: `0 0 8px ${FIREFLY}, 0 0 16px ${FIREFLY}88, 0 0 32px ${FIREFLY}55`,
                }}
                initial={{ opacity: 0, x: 0, y: 0 }}
                animate={{
                  x: [0, f.driftX, -f.driftX * 0.5, 0],
                  y: [0, f.driftY, -f.driftY, 0],
                  opacity: [0, 1, 0.4, 1, 0.3, 1, 0],
                }}
                transition={{ duration: f.duration, delay: f.delay, repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}

            {/* ─── FALLING PHOTOS · up to 6, drifting down from the top
                   like snow, endlessly looping. Tap one to enlarge —
                   handled by a separate centered overlay below rather
                   than animating the falling tile itself, so the two
                   motions never fight each other. ─────────────────── */}
            {galleryPhotos.map((url, i) => {
              const s = ((i + 900) * 2654435761) >>> 0;
              const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
              const left = 10 + (i / Math.max(galleryPhotos.length, 1)) * 80 + (r(1) - 0.5) * 8;
              const size = 64 + r(2) * 20;
              const dur = 13 + r(3) * 6;
              const delay = r(4) * 8;
              const rotFrom = (r(5) - 0.5) * 30;
              return (
                <motion.div
                  key={`photo-${i}`}
                  className="absolute cursor-pointer"
                  style={{
                    left: `${left}%`, top: '-14%', width: size, height: size,
                    zIndex: 5,
                    padding: 5, background: '#fff', borderRadius: 6,
                    boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEnlargedIdx(i);
                    setTimeout(() => setEnlargedIdx(cur => (cur === i ? null : cur)), 2500);
                  }}
                  initial={{ y: 0, rotate: rotFrom, opacity: 0 }}
                  animate={{ y: '128vh', rotate: [rotFrom, -rotFrom, rotFrom], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: dur, delay, repeat: Infinity, repeatDelay: 1, ease: 'linear', opacity: { times: [0, 0.06, 0.92, 1] } }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" style={{ borderRadius: 3 }} />
                </motion.div>
              );
            })}

            {/* Enlarged overlay — independent of the falling tiles. */}
            <AnimatePresence>
              {enlargedIdx !== null && galleryPhotos[enlargedIdx] && (
                <motion.div
                  className="fixed inset-0 flex items-center justify-center pointer-events-none"
                  style={{ zIndex: 60 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />
                  <motion.div
                    className="relative"
                    style={{ padding: 8, background: '#fff', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}
                    initial={{ scale: 0.6, rotate: -4 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={galleryPhotos[enlargedIdx]}
                      alt=""
                      style={{ width: 'min(78vw, 320px)', height: 'min(78vw, 320px)', objectFit: 'cover', borderRadius: 4, display: 'block' }}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* First uploaded photo, shown as a small polaroid above the
                closing message so it's the last thing the receiver sees
                while it types out. */}
            {galleryPhotos[0] && (
              <motion.div
                initial={{ opacity: 0, y: -12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8 }}
                style={{
                  padding: 6, background: '#fff', borderRadius: 8,
                  boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
                  transform: 'rotate(-2deg)', zIndex: 6,
                }}
              >
                {/* No fixed square + object-fit:cover here — that cropped
                    portrait/landscape photos. maxWidth/maxHeight + auto
                    width/height keeps the whole photo, uncropped. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={galleryPhotos[0]}
                  alt=""
                  style={{ maxWidth: 'min(78vw, 320px)', maxHeight: '42vh', width: 'auto', height: 'auto', borderRadius: 4, display: 'block' }}
                />
              </motion.div>
            )}

            {kiss.message && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                className="max-w-lg"
                style={{
                  fontFamily: '"Dancing Script", "Segoe Script", cursive',
                  fontSize: 'clamp(17px, 2.4vw, 22px)', fontStyle: 'italic',
                  color: 'rgba(255,240,220,0.8)', lineHeight: 1.5,
                  minHeight: '2.6em',
                  textShadow: '0 2px 12px rgba(0,0,0,0.8)',
                }}
              >
                &ldquo;{messageTyped.text}
                {!messageTyped.done && (
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                    style={{ marginLeft: 1, color: ACCENT_HOT }}
                  >
                    |
                  </motion.span>
                )}
                {messageTyped.done && <>&rdquo;</>}
              </motion.div>
            )}

            {kiss.sender_name && messageTyped.done && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
                style={{
                  fontFamily: '"Dancing Script", cursive', color: ACCENT, fontSize: 20,
                  textShadow: `0 0 12px ${ACCENT}66`,
                }}
              >
                — {kiss.sender_name}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── TAP HEARTS · spawn on every tap, float up + fade ────── */}
      {tapHearts.map(h => (
        <motion.div
          key={h.id}
          className="absolute pointer-events-none select-none"
          style={{
            left: h.x - 16, top: h.y - 16, fontSize: 32,
            filter: `drop-shadow(0 0 10px ${ACCENT}88) hue-rotate(${h.hue}deg)`,
          }}
          initial={{ y: 0, scale: 0.4, opacity: 0 }}
          animate={{ y: -180, scale: [0.4, 1.4, 1.1, 0.9], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2.4, ease: 'easeOut' }}
          onAnimationComplete={() => setTapHearts(prev => prev.filter(x => x.id !== h.id))}
        >
          {h.emoji}
        </motion.div>
      ))}

      {/* No manual close button — tapping it would exit the reveal for
          good with no way back in (this is a one-time gift moment, not
          a page you can revisit). The receiver moves through the 3
          phases via "Tiếp tục →"; Phase 3 closes itself automatically. */}

      {/* AudioPlayer moved to KissReplayOverlay so music plays across
          the ENTIRE journey (intro → flying → template) instead of
          only during the template reveal. */}
    </div>
  );
}

// ── AURORA RIBBON · shimmering colored waves across upper sky ────────
function AuroraRibbon() {
  return (
    <svg
      viewBox="0 0 1000 400"
      preserveAspectRatio="none"
      className="absolute inset-x-0 top-0 w-full pointer-events-none"
      style={{ height: '55%', opacity: 0.5, mixBlendMode: 'screen' }}
    >
      <defs>
        <linearGradient id="aurora-a" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={AURORA_A} stopOpacity="0" />
          <stop offset="50%"  stopColor={AURORA_A} stopOpacity="0.7" />
          <stop offset="100%" stopColor={AURORA_A} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="aurora-b" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={AURORA_B} stopOpacity="0" />
          <stop offset="50%"  stopColor={AURORA_B} stopOpacity="0.7" />
          <stop offset="100%" stopColor={AURORA_B} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="aurora-c" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={AURORA_C} stopOpacity="0" />
          <stop offset="50%"  stopColor={AURORA_C} stopOpacity="0.6" />
          <stop offset="100%" stopColor={AURORA_C} stopOpacity="0" />
        </linearGradient>
        <filter id="aurora-blur">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>
      <g filter="url(#aurora-blur)">
        <motion.path
          d="M -100 180 Q 250 60 500 140 T 1100 100 L 1100 260 Q 750 320 500 240 T -100 260 Z"
          fill="url(#aurora-a)"
          animate={{ d: [
            'M -100 180 Q 250 60 500 140 T 1100 100 L 1100 260 Q 750 320 500 240 T -100 260 Z',
            'M -100 160 Q 250 100 500 120 T 1100 140 L 1100 240 Q 750 280 500 220 T -100 240 Z',
            'M -100 180 Q 250 60 500 140 T 1100 100 L 1100 260 Q 750 320 500 240 T -100 260 Z',
          ] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.path
          d="M -100 220 Q 300 140 500 180 T 1100 160 L 1100 320 Q 700 380 500 300 T -100 320 Z"
          fill="url(#aurora-b)"
          animate={{ d: [
            'M -100 220 Q 300 140 500 180 T 1100 160 L 1100 320 Q 700 380 500 300 T -100 320 Z',
            'M -100 240 Q 300 200 500 200 T 1100 180 L 1100 300 Q 700 340 500 280 T -100 300 Z',
            'M -100 220 Q 300 140 500 180 T 1100 160 L 1100 320 Q 700 380 500 300 T -100 320 Z',
          ] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        <motion.path
          d="M -100 140 Q 200 40 500 100 T 1100 80 L 1100 220 Q 800 260 500 200 T -100 220 Z"
          fill="url(#aurora-c)"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
      </g>
    </svg>
  );
}

// ── SHORE SILHOUETTES · two adults sitting on the ground, looking up ─
function ShoreSilhouettes({ accent }: { accent: string }) {
  return (
    <svg
      viewBox="0 0 400 140"
      preserveAspectRatio="xMidYEnd meet"
      className="w-full block"
      style={{ maxHeight: 160 }}
    >
      {/* Ground line */}
      <line x1="0" y1="130" x2="400" y2="130" stroke="#000" strokeWidth="1.5" opacity="0.7" />

      {/* Small warm glow between them where the hero lantern originates */}
      <motion.ellipse
        cx="200" cy="110" rx="20" ry="6"
        fill={accent}
        opacity="0.4"
        style={{ filter: `drop-shadow(0 0 12px ${accent})` }}
        animate={{ opacity: [0.2, 0.7, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* LEFT figure — sitting cross-legged, head tilted back looking up */}
      <g fill="#000">
        {/* Head */}
        <ellipse cx="175" cy="60" rx="9" ry="10" transform="rotate(-10 175 60)" />
        {/* Short hair top */}
        <path
          d="M 165 55 Q 165 45 175 45 Q 185 45 185 55 Q 179 51 175 51 Q 171 51 165 55 Z"
          transform="rotate(-10 175 60)"
        />
        {/* Neck */}
        <rect x="172" y="70" width="6" height="6" />
        {/* Torso — leaning back slightly */}
        <path d="M 162 76 Q 158 90 162 108 L 190 108 Q 194 90 190 76 Q 184 74 175 74 Q 168 74 162 76 Z" />
        {/* Arm reaching toward the other */}
        <path d="M 190 84 Q 200 88 208 92 Q 208 96 205 96 Q 196 92 188 90 Z" />
        {/* Crossed legs — abstract triangle shape */}
        <path d="M 158 108 L 152 130 L 200 130 L 200 108 Z" />
      </g>

      {/* RIGHT figure — sitting close, long hair, head tilted */}
      <g fill="#000">
        <ellipse cx="225" cy="60" rx="9" ry="10" transform="rotate(10 225 60)" />
        {/* Long hair cascade */}
        <path
          d="M 215 55 Q 210 62 210 76 Q 210 90 216 96 L 232 96 Q 240 90 240 76 Q 240 62 235 55 Q 230 51 225 51 Q 220 51 215 55 Z"
          transform="rotate(10 225 60)"
        />
        <rect x="222" y="72" width="6" height="6" />
        <path d="M 210 78 Q 206 92 210 108 L 240 108 Q 244 92 240 78 Q 234 76 225 76 Q 216 76 210 78 Z" />
        {/* Left arm reaching toward the other */}
        <path d="M 210 84 Q 200 88 192 92 Q 192 96 195 96 Q 204 92 212 90 Z" />
        {/* Crossed legs */}
        <path d="M 200 108 L 200 130 L 248 130 L 242 108 Z" />
      </g>
    </svg>
  );
}

// ── SINGLE FIGURE ─────────────────────────────────────────────────────
// One silhouette viewed from BEHIND, standing on top of the galaxy disk,
// gazing UP at the heart. Feet at the bottom of the viewBox — the
// container places those feet on the galaxy centreline. Warm rim halo
// on head/shoulders picks up the heart's light. Arms slightly out to
// the sides suggest reaching / offering.
function SingleFigure({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 120 200" preserveAspectRatio="xMidYEnd meet" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <radialGradient id="figure-halo" cx="50%" cy="20%" r="55%">
          <stop offset="0%"   stopColor={accent} stopOpacity="0.5" />
          <stop offset="55%"  stopColor="#f472b6" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Warm halo above head */}
      <ellipse cx="60" cy="30" rx="60" ry="40" fill="url(#figure-halo)" />

      <g fill="#000">
        {/* Head from behind */}
        <ellipse cx="60" cy="36" rx="18" ry="20" />
        {/* Short hair silhouette */}
        <path d="M 42 38 Q 42 16 60 16 Q 78 16 78 38 Q 72 28 60 28 Q 48 28 42 38 Z" />
        {/* Neck */}
        <rect x="52" y="54" width="16" height="10" />
        {/* Torso — broad shoulders, taper at waist */}
        <path d="M 32 64
                 Q 26 90 30 138
                 L 90 138
                 Q 94 90 88 64
                 Q 76 58 60 58
                 Q 44 58 32 64 Z" />
        {/* Left arm — hanging slightly out to the side */}
        <path d="M 32 68
                 Q 22 92 26 128
                 Q 22 130 20 128
                 Q 14 92 26 66 Z" />
        {/* Right arm — hanging slightly out to the side */}
        <path d="M 88 68
                 Q 98 92 94 128
                 Q 98 130 100 128
                 Q 106 92 94 66 Z" />
        {/* Legs — standing wide-stance */}
        <path d="M 34 138 L 30 200 L 54 200 L 58 138 Z" />
        <path d="M 62 138 L 66 200 L 90 200 L 86 138 Z" />
      </g>

      {/* Rim light on head + shoulders — catches light from the heart above */}
      <g opacity="0.5" fill={accent} style={{ filter: `drop-shadow(0 0 6px ${accent})` }}>
        <path d="M 44 26 Q 60 14 76 26 Q 68 18 60 18 Q 52 18 44 26 Z" />
        <path d="M 32 66 Q 60 58 88 66 Q 78 62 60 62 Q 42 62 32 66 Z" />
      </g>
    </svg>
  );
}

// ── LANTERN COMPONENTS ────────────────────────────────────────────────

// Ambient lantern — used dozens of times for the fleet + reflections


// Hero lantern — bigger + carries the recipient's photo


export default DailyGoodnightReveal;

export const DailyGoodnightConfig: TemplateConfig = {
  id: 'daily-goodnight',
  name: 'Good Night',
  occasionIds: ['daily'],
  emoji: '🏮',
  description: 'Lakeside golden lantern festival — two silhouettes release a photo-lit lantern from the shore, an aurora shimmers above, dozens more lanterns rise and reflect in the still water, ending with a handwritten "chúc ngủ ngon".',
  thumbnailBg: 'linear-gradient(135deg, #050208, #7c3aed, #f59e0b)',
   Component: DailyGoodnightReveal,
  
};
