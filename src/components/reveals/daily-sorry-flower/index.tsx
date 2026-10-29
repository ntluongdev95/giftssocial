'use client';

// Sorry — 3-Chapter Interactive Apology.
// ─────────────────────────────────────────────────────────────────────
//
//   Chapter 1 · KHOẢNG LẶNG (The Silence)
//     Deep night-sky background with twinkling stars. A hand-crafted
//     apology letter reveals itself word-by-word (typewriter). Once the
//     text finishes, a soft-pulsing heart button rises into view. Tap
//     it to move on — a gentle chime plays as we transition.
//
//   Chapter 2 · THE VIDEO
//     A character video (public/videos/video.mp4) plays once, full
//     focus, with a hacker-style falling-text greeting (MatrixRain)
//     and ambient rose motes behind it for visual continuity with
//     Chapter 1. Only advances to Chapter 3 when the receiver taps
//     "Tiếp tục →" — it does NOT auto-advance when the video ends, it
//     just holds on the last frame. The one exception: if the file
//     fails to load at all, we move on automatically so the reveal
//     never gets stuck on a broken video.
//
//   Chapter 3 · CẢM ƠN EM (Thank You)
//     The sender's message + signature + optional photo unfold on a
//     warm rose backdrop. Auto-closes after the total reveal duration.
//
// ─────────────────────────────────────────────────────────────────────

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playMessageChime } from '@/lib/kiss-audio';
import { getKissString, parseKissData } from '../_shared/useTemplateData';
import type { TemplateProps, TemplateConfig } from '../_types';

// ─── Palette ─────────────────────────────────────────────────────────
const ACCENT      = '#f43f5e';    // rose
const ACCENT_SOFT = '#fda4af';    // soft rose
const ACCENT_DEEP = '#9f1239';    // deep rose
const NIGHT_TOP   = '#0b0a1e';
const NIGHT_BASE  = '#000208';

// ─── Chapter 1 letter · edit the string to change the copy ──────────
const HERO_TEXT = 'Hello Nhi Của Em';
const LETTER = 'Chị bấm vào trái tim để tiếp tục nhé.';

// ─────────────────────────────────────────────────────────────────────
// StarField — 200 twinkling white dots on the deep night background.
// Deterministic seeded positions so React 19 rerenders don't reshuffle.
// ─────────────────────────────────────────────────────────────────────
function StarField() {
  const stars = useMemo(() => (
    Array.from({ length: 200 }).map((_, i) => {
      const s = (i * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      const tier = i % 8 === 0 ? 'bright' : i % 3 === 0 ? 'mid' : 'faint';
      return {
        left:  r(1) * 100,
        top:   r(2) * 100,
        size:  tier === 'bright' ? 1.8 + r(3) * 1.2 : tier === 'mid' ? 1.0 + r(3) * 0.6 : 0.5 + r(3) * 0.5,
        delay: 2 + r(4) * 6,
        dur:   3 + r(5) * 4,
        alpha: tier === 'bright' ? 1.0 : tier === 'mid' ? 0.85 : 0.55,
      };
    })
  ), []);

  return (
    <>
      {stars.map((s, i) => (
        <motion.div
          key={`star-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${s.left}%`, top: `${s.top}%`,
            width: s.size, height: s.size,
            background: '#ffffff',
            boxShadow: s.size > 1.4
              ? `0 0 ${s.size * 3}px rgba(255,255,255,0.9)`
              : `0 0 ${s.size * 2}px rgba(255,255,255,0.5)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [s.alpha * 0.35, s.alpha, s.alpha * 0.35] }}
          transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SeaScene — night beach: dark ocean at bottom, moon glow, animated
// horizontal wave ripples rolling toward the shore, sand silhouette
// at the very bottom. Used behind Chapter 1's typewriter letter to
// create the "cô gái nhìn xa xăm ra biển đêm" mood.
// ─────────────────────────────────────────────────────────────────────
function SeaScene() {
  // Wave lines — 6 horizontal ripples across the sea, each moving
  // slowly with staggered fade so the surface feels alive.
  const waves = useMemo(() => (
    Array.from({ length: 6 }).map((_, i) => {
      const s = (i * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      return {
        id: i,
        top:   62 + i * 4.2 + r(1) * 1.5,      // 62-88% of viewport
        delay: r(2) * 4,
        dur:   4.5 + r(3) * 3,
        opacity: 0.15 + r(4) * 0.25,
      };
    })
  ), []);

  // Foam crests — small white curved dashes near the shore line
  const foams = useMemo(() => (
    Array.from({ length: 5 }).map((_, i) => {
      const s = ((i + 100) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      return {
        id: i,
        left: 5 + r(1) * 85,
        top:  84 + r(2) * 4,
        w:    24 + r(3) * 40,
        delay: r(4) * 3,
        dur:  2.8 + r(5) * 1.4,
      };
    })
  ), []);

  return (
    <>
      {/* MOON — soft glowing crescent-ish disc top-right */}
      <div
        className="absolute pointer-events-none"
        style={{
          right: '10%',
          top: '10%',
          width: 'clamp(60px, 9vw, 110px)',
          height: 'clamp(60px, 9vw, 110px)',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 40%, #fefce8 0%, #fef3c7 45%, #fbbf24 100%)',
          boxShadow: '0 0 40px rgba(254,243,199,0.6), 0 0 80px rgba(251,191,36,0.35)',
          opacity: 0.85,
        }}
      />

      {/* SEA — dark ocean gradient from horizon (~62%) to bottom */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          top: '62%',
          background: 'linear-gradient(180deg, rgba(20,25,55,0.45) 0%, rgba(8,12,32,0.85) 40%, #030612 100%)',
        }}
      />

      {/* Moon reflection — vertical shimmering line on the water */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          right: '10%',
          top: '62%',
          width: 'clamp(30px, 4vw, 55px)',
          height: '30%',
          background: 'linear-gradient(180deg, rgba(254,243,199,0.55) 0%, rgba(251,191,36,0.15) 60%, transparent 100%)',
          filter: 'blur(3px)',
        }}
        animate={{ opacity: [0.5, 0.85, 0.5], scaleY: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* WAVE RIPPLES — horizontal streaks drifting across the sea */}
      {waves.map(w => (
        <motion.div
          key={`wave-${w.id}`}
          className="absolute pointer-events-none"
          style={{
            left: 0,
            top: `${w.top}%`,
            height: 1.5,
            width: '120%',
            background: `linear-gradient(90deg, transparent, rgba(180,210,255,${w.opacity}) 30%, rgba(220,235,255,${w.opacity * 1.3}) 55%, rgba(180,210,255,${w.opacity}) 75%, transparent)`,
            filter: 'blur(0.5px)',
          }}
          animate={{ x: ['-10%', '0%', '-10%'] }}
          transition={{ duration: w.dur, delay: w.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* FOAM CRESTS — small white dashes near the shore line */}
      {foams.map(f => (
        <motion.div
          key={`foam-${f.id}`}
          className="absolute pointer-events-none"
          style={{
            left: `${f.left}%`,
            top: `${f.top}%`,
            width: f.w,
            height: 2,
            borderRadius: 2,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent)',
            filter: 'blur(0.5px)',
          }}
          initial={{ opacity: 0, scaleX: 0.4 }}
          animate={{ opacity: [0, 0.9, 0.9, 0], scaleX: [0.4, 1, 1.2, 0.6] }}
          transition={{ duration: f.dur, delay: f.delay, repeat: Infinity, ease: 'easeInOut', times: [0, 0.2, 0.7, 1] }}
        />
      ))}

      {/* SAND BEACH — dark silhouette strip at the very bottom */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: '8%',
          background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 40%, #000 100%)',
        }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// GirlSilhouette — side-profile SVG of a girl sitting on the beach,
// knees pulled up, arms hugging them, long hair falling behind. She
// faces LEFT (looking toward the horizon / open sea). Used in Chapter
// 1 as the emotional anchor of the scene.
// ─────────────────────────────────────────────────────────────────────
function GirlSilhouette() {
  return (
    <svg viewBox="0 0 140 180" preserveAspectRatio="xMidYEnd meet" style={{ width: '100%', height: '100%', display: 'block' }}>
      {/* Very soft warm rim behind her from moon direction */}
      <ellipse cx="70" cy="60" rx="55" ry="35" fill="rgba(254,243,199,0.08)" />

      <g fill="#000">
        {/* Long hair falling down her back (right side of figure) */}
        <path d="M 82 32
                 Q 92 42 96 60
                 Q 100 84 96 108
                 Q 92 118 82 118
                 L 78 118
                 L 78 30 Z" />

        {/* Head — side profile facing LEFT (nose points left).
            Rounded back-of-head; slight jawline notch bottom-left. */}
        <path d="M 70 20
                 Q 82 20 85 34
                 Q 86 46 82 52
                 Q 78 58 68 58
                 Q 60 58 58 50
                 Q 56 40 60 32
                 Q 62 22 70 20 Z" />

        {/* Small nose bump (left facing) */}
        <path d="M 58 44 Q 55 46 57 49 L 60 49 Z" />

        {/* Neck */}
        <rect x="66" y="56" width="10" height="8" />

        {/* Torso — leaning forward slightly (contemplative posture) */}
        <path d="M 54 64
                 Q 46 82 52 108
                 L 88 108
                 Q 94 82 86 64
                 Q 78 60 70 60
                 Q 62 60 54 64 Z" />

        {/* Arms hugging knees — a curved band around the front */}
        <path d="M 48 92
                 Q 40 110 50 130
                 Q 60 132 68 128
                 L 100 128
                 Q 106 118 100 104
                 Q 88 96 68 96
                 Q 56 92 48 92 Z" />

        {/* Knees pulled up (bent-leg silhouette) */}
        <path d="M 52 128
                 Q 46 148 54 168
                 L 80 168
                 Q 92 150 96 128
                 L 88 130
                 L 52 128 Z" />

        {/* Toe hint at bottom */}
        <ellipse cx="60" cy="170" rx="10" ry="4" />
      </g>

      {/* Very faint moonlight rim highlight on the top of head + shoulder */}
      <g opacity="0.35" fill="#fef3c7" style={{ filter: 'drop-shadow(0 0 4px rgba(254,243,199,0.6))' }}>
        <path d="M 62 22 Q 70 18 78 22 Q 72 20 68 20 Q 64 20 62 22 Z" />
        <path d="M 54 66 Q 70 60 86 66 Q 78 63 70 63 Q 62 63 54 66 Z" />
      </g>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Typewriter — reveals `text` char by char at `speed` ms/char after
// `startDelay` ms. Returns the currently-rendered slice + a `done` flag.
// ─────────────────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 42, startDelay = 500) {
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

// ─────────────────────────────────────────────────────────────────────
// Pulsing heart button — SVG heart that gently pulses to invite the tap.
// ─────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────
// ClickableParticleHeart — a "galaxy" heart made from ~900 glowing
// rose-red dots that dust-gather into the heart curve on mount, then
// idle-breathe with per-frame micro-jitter (swarm alive). Wrapped in
// a 3D perspective + rotateY swing so it feels volumetric hanging in
// the night sky. Whole thing is a big clickable button.
//
// Heart shape via reject-sampling of the classic implicit heart curve
//     (x² + y² − 1)³ − x² · y³ ≤ 0
// ─────────────────────────────────────────────────────────────────────
function ClickableParticleHeart({ onClick }: { onClick: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
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

    const TARGET = 900;
    const scale = Math.min(W, H) * 0.38;
    const cx = W / 2;
    const cy = H * 0.52;

    type P = {
      tx: number; ty: number;
      sx: number; sy: number;
      size: number;
      hue: number; light: number;
      alpha: number;
    };
    const particles: P[] = [];

    let attempts = 0;
    while (particles.length < TARGET && attempts < TARGET * 40) {
      attempts++;
      const rx = (Math.random() - 0.5) * 2.6;
      const ry = (Math.random() - 0.5) * 2.6;
      const a = rx * rx + ry * ry - 1;
      if (a * a * a - rx * rx * ry * ry * ry > 0) continue;

      const tx = cx + rx * scale;
      const ty = cy - ry * scale;
      const dist = Math.hypot(rx, ry);

      particles.push({
        tx, ty,
        sx: cx + (Math.random() - 0.5) * W * 1.6,
        sy: cy + (Math.random() - 0.5) * H * 1.6,
        size: 0.7 + Math.random() * 1.4,
        hue: 348 + Math.random() * 14,
        light: 44 + dist * 22 + Math.random() * 10,
        alpha: 0.6 + Math.random() * 0.35,
      });
    }

    const startTime = performance.now();
    const CONVERGE_MS = 1500;

    const draw = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, W, H);

      const t = Math.min(1, elapsed / CONVERGE_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      const settled = elapsed > CONVERGE_MS;

      const breathT = Math.max(0, elapsed - CONVERGE_MS) / 1000;
      const breath = 1 + 0.04 * Math.sin(breathT * 2.6);

      ctx.globalCompositeOperation = 'lighter';

      for (const p of particles) {
        const px = p.sx + (p.tx - p.sx) * eased;
        const py = p.sy + (p.ty - p.sy) * eased;
        const bx = cx + (px - cx) * breath;
        const by = cy + (py - cy) * breath;
        const jx = settled ? (Math.random() - 0.5) * 0.8 : 0;
        const jy = settled ? (Math.random() - 0.5) * 0.8 : 0;

        ctx.fillStyle = `hsla(${p.hue}, 88%, ${p.light}%, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(bx + jx, by + jy, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <motion.button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="relative cursor-pointer"
      style={{
        width: 'clamp(220px, 34vw, 380px)',
        height: 'clamp(220px, 34vw, 380px)',
        background: 'transparent',
        border: 'none',
        padding: 0,
        perspective: 1200,
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* 3D rotateY swing wrapper — hangs the galaxy heart in the sky */}
      <motion.div
        style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d' }}
        animate={{ rotateY: [-20, 20, -20] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            filter: `drop-shadow(0 0 20px ${ACCENT}66) drop-shadow(0 0 40px ${ACCENT_SOFT}44)`,
          }}
        />
      </motion.div>
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main reveal — state machine drives the chapters.
// ─────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────
// Firework — a launch trail rocketing up from off-screen into a
// specified sky position, then bursting into ~26 radial particles that
// fall with gravity + fade. All timings pre-baked so it loops smoothly
// via framer-motion `repeat: Infinity` without any RAF or state.
//
// Colors: pick one of the palette values (rose / amber / magenta /
// cream) for the whole firework — reads like a coordinated show.
// ─────────────────────────────────────────────────────────────────────
function Firework({
  x, y, delay, color, hueLabel,
}: {
  x: number; y: number; delay: number; color: string; hueLabel: string;
}) {
  const particles = useMemo(() => (
    Array.from({ length: 26 }).map((_, i) => {
      const s = ((i + 1) * (hueLabel.charCodeAt(0) + 1) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      const angle = (i / 26) * Math.PI * 2 + (r(1) - 0.5) * 0.5;
      const dist  = 90 + r(2) * 90;                          // 90-180px radius
      const dx    = Math.cos(angle) * dist;
      const dy    = Math.sin(angle) * dist;
      return { dx, dy, size: 3 + r(3) * 4, hue: r(4) };
    })
  ), [hueLabel]);

  // Total cycle = trail 0.6s + burst 2.0s + gap = 8-14s repeatDelay
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: `${x}vw`, top: `${y}vh`, width: 0, height: 0 }}
    >
      {/* LAUNCH TRAIL · shoots up from below to (x,y) */}
      <motion.div
        style={{
          position: 'absolute',
          left: -1.5,
          bottom: 0,
          width: 3,
          height: 50,
          borderRadius: 3,
          background: `linear-gradient(180deg, transparent, ${color}, #fff)`,
          filter: `drop-shadow(0 0 4px ${color})`,
        }}
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: [200, 0, 0], opacity: [0, 1, 0] }}
        transition={{
          duration: 0.6,
          delay,
          repeat: Infinity,
          repeatDelay: 8 + (hueLabel.charCodeAt(0) % 6),
          ease: 'easeOut',
          times: [0, 0.85, 1],
        }}
      />

      {/* BURST PARTICLES · radiate from (x,y) with gravity fall */}
      {particles.map((p, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            left: -p.size / 2,
            top:  -p.size / 2,
            width:  p.size,
            height: p.size,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 6px ${color}, 0 0 14px ${color}88`,
          }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
          animate={{
            x: [0, p.dx, p.dx * 1.15],
            y: [0, p.dy, p.dy + 80],                         // gravity fall on tail
            opacity: [0, 1, 0],
            scale:   [0.3, 1.2, 0.4],
          }}
          transition={{
            duration: 2.0,
            delay: delay + 0.55,                             // right after trail arrives
            repeat: Infinity,
            repeatDelay: (8 + (hueLabel.charCodeAt(0) % 6)) - 0.55,
            ease: 'easeOut',
            times: [0, 0.35, 1],
          }}
        />
      ))}

      {/* BURST FLASH · white core flash at the moment of explosion */}
      <motion.div
        style={{
          position: 'absolute',
          left: -20, top: -20,
          width: 40, height: 40,
          borderRadius: '50%',
          background: `radial-gradient(circle, #fff 0%, ${color} 30%, transparent 70%)`,
          filter: 'blur(2px)',
        }}
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: [0, 1, 0], scale: [0.3, 2.4, 3.5] }}
        transition={{
          duration: 0.9,
          delay: delay + 0.55,
          repeat: Infinity,
          repeatDelay: (8 + (hueLabel.charCodeAt(0) % 6)) - 0.55 + 1.1,
          ease: 'easeOut',
          times: [0, 0.25, 1],
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// HeroDroneText — big glowing headline where each character flies in
// from a random off-screen position, spinning + blurred, and locks into
// place like a drone-show letter. Deterministic random via seed hash
// so React 19's render purity isn't violated.
//
//   0-0.4s   idle
//   0.4-2.6s each char flies to its home slot with stagger 0.15s each,
//            unblurs, snaps upright
//   2.6s+    all locked; a subtle repeating shimmer sweeps across
// ─────────────────────────────────────────────────────────────────────
function HeroDroneText({ text }: { text: string }) {
  const chars = useMemo(() => (
    text.split('').map((ch, i) => {
      const s = (i * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      return {
        ch,
        // Each drone-letter enters from a random point far off-screen
        // then lands. Distances in vw/vh so it scales with viewport.
        fromX: (r(1) - 0.5) * 120,     // ±60vw
        fromY: (r(2) - 0.5) * 60 - 30, // -60 to +30 vh (bias downward-in)
        fromRot: (r(3) - 0.5) * 90,
        delay: 0.4 + i * 0.15,
      };
    })
  ), [text]);

  // Scale down for longer strings so custom text (e.g. "Hello Nhi Của
  // Em") fits mobile width instead of running off both edges — the
  // original clamp(50px, 10vw, 130px) was tuned for ~9-char text like
  // "EM YÊU...". flexWrap is the real safety net; this just keeps a
  // single line looking sized-right for as long as it can.
  const len = Math.max(text.length, 1);
  const minPx = Math.max(28, 56 - len);
  const vwSize = Math.min(10, 96 / len);

  return (
    <div
      className="flex flex-wrap justify-center pointer-events-none select-none"
      style={{
        fontFamily: '"Bebas Neue", "Impact", "Oswald", "Helvetica Neue", sans-serif',
        fontWeight: 900,
        fontSize: `clamp(${minPx}px, ${vwSize}vw, 130px)`,
        letterSpacing: '0.08em',
        lineHeight: 1.1,
        maxWidth: '92vw',
        textAlign: 'center',
      }}
    >
      {chars.map((c, i) => (
        <motion.span
          key={i}
          initial={{
            x: `${c.fromX}vw`,
            y: `${c.fromY}vh`,
            rotate: c.fromRot,
            opacity: 0,
            scale: 0.4,
            filter: 'blur(10px)',
          }}
          animate={{
            x: 0, y: 0, rotate: 0, opacity: 1, scale: 1,
            filter: 'blur(0px)',
          }}
          transition={{
            duration: 1.6,
            delay: c.delay,
            ease: [0.16, 1, 0.3, 1],
          }}
          style={{
            display: 'inline-block',
            color: '#fff',
            textShadow:
              '0 0 12px rgba(255,255,255,0.95),' +
              '0 0 24px rgba(244,63,94,0.85),' +
              '0 0 48px rgba(251,191,36,0.55),' +
              '0 0 80px rgba(236,72,153,0.4)',
            // Nudge tighter for punctuation-only chars
            marginRight: c.ch === '.' ? '0.02em' : undefined,
          }}
        >
          {c.ch === ' ' ? ' ' : c.ch}
        </motion.span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Ch3GalaxyBackdrop — full-viewport canvas background for Chapter 3.
// ~1400 rose-red dots start scattered across the whole viewport as a
// spinning galaxy, then COLLAPSE into a big heart shape at the centre
// and idle there with a slow breathing pulse. Sits behind message +
// photos so the finale reads as: cosmic swirl → heart → love reveal.
//
//   Phase 1 GALAXY   (0-3.5s)   particles orbit as galaxy spanning
//                                the full viewport (Kepler-like
//                                differential rotation)
//   Phase 2 MORPH    (3.5-5.5s) particles ease into heart shape
//                                centered on screen
//   Phase 3 IDLE     (5.5s+)    heart breathes + subtle jitter
// ─────────────────────────────────────────────────────────────────────
function Ch3GalaxyBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
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

    const TARGET = 1400;
    const heartScale = Math.min(W, H) * 0.28;
    const galaxyScale = Math.min(W, H) * 0.48;                // fills a lot
    const cx = W / 2;
    const cy = H / 2;

    type P = {
      tx: number; ty: number;
      armAngle: number; armRadius: number;
      twinkle: number;
      size: number;
      hue: number; light: number;
      alpha: number;
    };
    const particles: P[] = [];

    // Reject-sample heart target positions for the eventual morph.
    let attempts = 0;
    while (particles.length < TARGET && attempts < TARGET * 40) {
      attempts++;
      const rx = (Math.random() - 0.5) * 2.6;
      const ry = (Math.random() - 0.5) * 2.6;
      const a = rx * rx + ry * ry - 1;
      if (a * a * a - rx * rx * ry * ry * ry > 0) continue;

      const tx = cx + rx * heartScale;
      const ty = cy - ry * heartScale;
      const dist = Math.hypot(rx, ry);

      // Galaxy assignment (spiral arms)
      const idx = particles.length;
      const arm = idx % 4;
      const armT = idx / TARGET;
      const armAngle = arm * ((Math.PI * 2) / 4)
                     + armT * Math.PI * 3
                     + (Math.random() - 0.5) * 0.6;
      const armRadius = 0.08 + Math.sqrt(armT) * 0.98
                      + (Math.random() - 0.5) * 0.08;

      particles.push({
        tx, ty,
        armAngle, armRadius,
        twinkle: Math.random() * Math.PI * 2,
        size: 0.7 + Math.random() * 1.5,
        hue: 348 + Math.random() * 14,
        light: 44 + dist * 24 + Math.random() * 10,
        alpha: 0.55 + Math.random() * 0.4,
      });
    }

    const GALAXY_MS = 3500;
    const MORPH_MS  = 2000;
    const morphEnd  = GALAXY_MS + MORPH_MS;

    const startTime = performance.now();

    const galaxyXY = (p: P, elapsed: number): [number, number] => {
      // Differential Kepler-like orbit — inner faster
      const orbitalSpeed = 1.2 / Math.sqrt(p.armRadius + 0.2);
      const a = p.armAngle + (elapsed / 1000) * orbitalSpeed;
      const rBreath = 1 + 0.05 * Math.sin(elapsed / 900 + p.twinkle);
      const r = p.armRadius * galaxyScale * rBreath;
      // Slight vertical squish + tilt wobble
      const tilt = 0.55 + 0.10 * Math.sin(elapsed / 3500);
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * tilt];
    };

    const draw = (now: number) => {
      const elapsed = now - startTime;

      // Motion trails via destination-out fade → glowing orbit arcs
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      ctx.fillRect(0, 0, W, H);

      const morphT = Math.max(0, Math.min(1, (elapsed - GALAXY_MS) / MORPH_MS));
      const morphEased = 1 - Math.pow(1 - morphT, 3);
      const settled = elapsed > morphEnd;

      const breathT = Math.max(0, elapsed - morphEnd) / 1000;
      const breath = 1 + 0.04 * Math.sin(breathT * 2.4);

      ctx.globalCompositeOperation = 'lighter';

      for (const p of particles) {
        let x: number, y: number;
        let colorH: number, colorS: number, colorL: number;
        let sizeMul = 1;

        if (elapsed < GALAXY_MS) {
          // Phase 1: pure galaxy swirl across viewport
          const [gx, gy] = galaxyXY(p, elapsed);
          x = gx; y = gy;
          // Purple-blue starlight tinted with rose drift
          colorH = 232 + Math.sin(elapsed / 2600 + p.twinkle) * 20;
          colorS = 55;
          colorL = 72;
          const twSpeed = 180 + p.armRadius * 240;
          sizeMul = 0.75 + 0.55 * Math.sin(elapsed / twSpeed + p.twinkle);
        } else if (elapsed < morphEnd) {
          // Phase 2: galaxy → heart shape (colours shift blue → rose)
          const [gx, gy] = galaxyXY(p, elapsed);
          x = gx + (p.tx - gx) * morphEased;
          y = gy + (p.ty - gy) * morphEased;
          colorH = 232 + (p.hue - 232) * morphEased;
          colorS = 55 + (88 - 55) * morphEased;
          colorL = 72 + (p.light - 72) * morphEased;
        } else {
          // Phase 3: heart idle breathing + jitter
          const bx = cx + (p.tx - cx) * breath;
          const by = cy + (p.ty - cy) * breath;
          x = bx + (settled ? (Math.random() - 0.5) * 0.8 : 0);
          y = by + (settled ? (Math.random() - 0.5) * 0.8 : 0);
          colorH = p.hue; colorS = 88; colorL = p.light;
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
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// MatrixRain — hacker-style falling/streaming text, but instead of
// random glyphs it streams the actual greeting so it reads clearly as
// it passes. Vertical columns fall top→bottom (classic Matrix look via
// `writingMode: vertical-rl` on a normal horizontal string); a few
// horizontal rows drift left↔right across different heights for the
// "ngang dọc" (crisscross) feel. Runs behind the video card.
// ─────────────────────────────────────────────────────────────────────
function MatrixRain({ text }: { text: string }) {
  const stream = useMemo(() => `${text}   `.repeat(4), [text]);

  // Fewer streams (was 16/5 — too dense), confined to the LEFT and
  // RIGHT margins only (columns skip the ~28%-72% center band, rows
  // stop short of it) so nothing ever crosses in front of the video
  // card that sits in that middle band.
  const columns = useMemo(() => (
    Array.from({ length: 8 }).map((_, i) => {
      const s = ((i + 300) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      const side = i % 2 === 0 ? r(1) * 24 : 76 + r(1) * 24; // 0-24% or 76-100%
      return {
        left: side,
        dur: 3.5 + r(2) * 2.5,
        delay: r(3) * 4,
        opacity: 0.3 + r(4) * 0.35,
        fontSize: 11 + r(5) * 6,
      };
    })
  ), []);

  const rows = useMemo(() => (
    Array.from({ length: 3 }).map((_, i) => {
      const s = ((i + 700) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      return {
        top: 4 + (i / 3) * 14 + r(1) * 3, // top sliver only, well above the video
        dur: 5 + r(2) * 3,
        delay: r(3) * 4,
        reverse: i % 2 === 0,
        opacity: 0.18 + r(4) * 0.22,
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
          style={{ top: `${row.top}%`, opacity: row.opacity, fontSize: 12, ...glowStyle }}
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

type Chapter = 'ch1' | 'ch2' | 'ch3';

function DailySorryReveal({ kiss, onClose }: TemplateProps) {
  const photoUrl = getKissString(kiss, 'photo');
  // Optional gallery: template_data.photos = ["url1", "url2", ...] up
  // to 6. Falls back to a single-item array of `photo` when the sender
  // only uploaded one. Chapter 3 renders this as a scattered polaroid
  // collage. Slice game (ch2) still uses `photoUrl` for tap targets.
  const galleryPhotos: string[] = (() => {
    const raw = parseKissData(kiss).photos;
    if (Array.isArray(raw)) {
      return raw.filter((u): u is string => typeof u === 'string' && !!u).slice(0, 6);
    }
    return photoUrl ? [photoUrl] : [];
  })();
  const rawName = (getKissString(kiss, 'name') || kiss.receiver_name || 'em').trim();
  const displayName = rawName || 'em';

  const [chapter, setChapter] = useState<Chapter>('ch1');

  // Which mosaic photo is currently enlarged (tap-to-view). null =
  // idle. Auto-clears after ENLARGE_HOLD_MS so the heart re-assembles.
  const [enlargedIdx, setEnlargedIdx] = useState<number | null>(null);

  // Typewriter starts AFTER the hero drone-show finishes assembling
  // (0.4s idle + ~2.5s for chars to arrive → ~3s total). Start typing
  // the letter at 3.4s so the drone hero sits alone briefly.
  const typed = useTypewriter(LETTER, 42, 3400);

  // Detect narrow viewport — still used by Chapter 3's photo-mosaic
  // sizing below. Lazy initializer covers the first render so the
  // effect only needs to subscribe to resize, not set state itself.
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 720);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const on = () => setIsNarrow(window.innerWidth < 720);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  // Chapter 2 only advances to Chapter 3 when "Tiếp tục →" is tapped —
  // this is also the fallback if the video file fails to load, so the
  // reveal never stalls on a broken video.
  const goToChapter3 = useCallback(() => setChapter('ch3'), []);

  // Chapter 2's "decoding" progress bar + end-of-video glow — purely
  // visual feedback, doesn't drive any navigation (only the button
  // above does that).
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoEnded, setVideoEnded] = useState(false);

  // ── Chapter 3 photo-mosaic heart positions ──
  // Photos are placed at fixed slots ALONG the classic heart
  // parametric curve — assembling a mosaic HEART made of the user's
  // uploaded photos. Sampled once from `galleryPhotos` when it changes.
  //   x(t) = 16 sin³(t)
  //   y(t) = 13 cos(t) − 5 cos(2t) − 2 cos(3t) − cos(4t)
  // For 6 photos we walk `t` from -π/2 to 3π/2 in even steps so the
  // top-left lobe is index 0, sweeping clockwise around the heart.
  const heartMosaic = useMemo(() => {
    const N = galleryPhotos.length;
    if (N === 0) return [] as { url: string; x: number; y: number }[];
    return galleryPhotos.map((url, i) => {
      // Distribute along the heart curve, offset so a photo sits at
      // both lobes (t = ±π/2 area).
      const t = -Math.PI / 2 + (i / N) * Math.PI * 2;
      const sinT = Math.sin(t);
      const raw_x = 16 * sinT * sinT * sinT;
      const raw_y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      return {
        url,
        // Convert to viewport-percent, scaled to fit nicely centred
        x: 50 + raw_x * 1.9,   // vw around 50% center
        y: 50 + raw_y * 1.9,   // vh
      };
    });
  }, [galleryPhotos]);

  const goToChapter2 = useCallback(() => {
    playMessageChime();
    setChapter('ch2');
  }, []);

  // Auto-close ONLY once Chapter 3 is reached (video ended, was
  // skipped, or failed to load). Ch3 gets a relaxed 12s to read the
  // message + photo, then hands off.
  useEffect(() => {
    if (chapter !== 'ch3') return;
    // Allow enough time for a 6-photo gallery to stagger in (last one
    // lands ~5s in) + a few extra seconds to savour before handoff.
    const t = setTimeout(() => onClose(), 18_000);
    return () => clearTimeout(t);
  }, [chapter, onClose]);

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden">
      {/* ── Deep night sky backdrop (same across all chapters) ─── */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${NIGHT_TOP} 0%, ${NIGHT_BASE} 60%, ${NIGHT_BASE} 100%)`,
        }}
      />
      <StarField />

      {/* Warm rose bloom that intensifies as we approach ch3 */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 55%, ${ACCENT_DEEP}55 0%, transparent 60%)`,
        }}
        animate={{ opacity: chapter === 'ch3' ? 0.25 : chapter === 'ch2' ? 0.35 : 0.15 }}
        transition={{ duration: 1.2 }}
      />

      <AnimatePresence mode="wait">
        {/* ─── Chapter 1 — Khoảng Lặng · night beach scene ─── */}
        {chapter === 'ch1' && (
          <motion.div
            key="ch1"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Layered night beach behind everything else */}
            <SeaScene />

            {/* Girl silhouette · sitting on the sand looking out at the
                sea (positioned bottom-center-ish). Slow subtle sway
                simulates breathing. */}
            <motion.div
              className="absolute pointer-events-none"
              style={{
                left: '50%',
                bottom: '3%',
                transform: 'translateX(-50%)',
                width: 'clamp(140px, 20vw, 220px)',
                height: 'clamp(180px, 28vw, 300px)',
                filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.6))',
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: [0, -1.5, 0] }}
              transition={{
                opacity: { duration: 1.4, delay: 0.4 },
                y: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
              }}
            >
              <GirlSilhouette />
            </motion.div>

            {/* ── FIREWORKS · coordinated love-show bursting across
                   the sky throughout Chapter 1. Each firework launches
                   from below screen, bursts at its (x,y), then loops.
                   Colors coordinated to the rose/amber palette. */}
            {[
              { x: 18, y: 18, delay: 1.0, color: '#f43f5e', hueLabel: 'a' },
              { x: 78, y: 14, delay: 2.4, color: '#fbbf24', hueLabel: 'b' },
              { x: 50, y: 22, delay: 3.6, color: '#ec4899', hueLabel: 'c' },
              { x: 30, y: 12, delay: 5.2, color: '#a855f7', hueLabel: 'd' },
              { x: 82, y: 26, delay: 6.8, color: '#f43f5e', hueLabel: 'e' },
              { x: 12, y: 24, delay: 8.5, color: '#fef3c7', hueLabel: 'f' },
              { x: 60, y: 16, delay: 10.2, color: '#ec4899', hueLabel: 'g' },
              { x: 40, y: 28, delay: 12.0, color: '#fbbf24', hueLabel: 'h' },
            ].map((fw, i) => (
              <Firework key={`fw-${i}`} {...fw} />
            ))}

            {/* HERO DRONE HEADLINE · "EM YÊU..." — each character
                flies in like a drone-show letter, locking into place. */}
            <div
              className="absolute inset-x-0 flex justify-center pointer-events-none"
              style={{ top: '8%' }}
            >
              <HeroDroneText text={HERO_TEXT} />
            </div>

            {/* Typewriter letter · appears BELOW the hero, styled as
                a starlight cursive letter. Starts after drones lock. */}
            <div
              className="absolute inset-x-0 flex justify-center px-6 pointer-events-none"
              style={{ top: '26%' }}
            >
              <div className="max-w-2xl text-center">
                <div
                  style={{
                    fontFamily: '"Dancing Script", "Segoe Script", cursive',
                    fontSize: 'clamp(20px, 3.4vw, 34px)',
                    lineHeight: 1.55,
                    color: '#fff',
                    fontStyle: 'italic',
                    minHeight: '5em',
                    textShadow: '0 2px 14px rgba(0,0,0,0.85), 0 0 22px rgba(244,63,94,0.35), 0 0 40px rgba(251,191,36,0.15)',
                    letterSpacing: '0.01em',
                  }}
                >
                  {typed.text}
                  {!typed.done && (
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                      style={{ marginLeft: 2, color: ACCENT_SOFT }}
                    >
                      |
                    </motion.span>
                  )}
                </div>
              </div>
            </div>

            {/* HEART RAIN · small rose hearts falling from the sky.
                Ambient throughout Chapter 1 — reads as an atmosphere
                of tender love pouring down onto the sitting girl. */}
            {Array.from({ length: 18 }).map((_, i) => {
              const s = ((i + 300) * 2654435761) >>> 0;
              const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
              const left = r(1) * 100;
              const size = 8 + r(2) * 12;
              const dur = 7 + r(3) * 5;
              const delay = r(4) * 10;
              const sway = (r(5) - 0.5) * 30;
              return (
                <motion.div
                  key={`rain-${i}`}
                  className="absolute pointer-events-none"
                  style={{ left: `${left}%`, top: '-6%', width: size, height: size }}
                  initial={{ y: 0, x: 0, opacity: 0, rotate: 0 }}
                  animate={{
                    y: '110vh',
                    x: [0, sway, -sway, sway * 0.4],
                    opacity: [0, 0.75, 0.75, 0],
                    rotate: [0, 180, 360],
                  }}
                  transition={{
                    duration: dur,
                    delay,
                    repeat: Infinity,
                    repeatDelay: 1,
                    ease: 'linear',
                    times: [0, 0.15, 0.85, 1],
                  }}
                >
                  <svg viewBox="0 0 20 20" width="100%" height="100%" style={{ filter: `drop-shadow(0 0 4px ${ACCENT_SOFT})` }}>
                    <path
                      d="M 10 18 C 4 13, 1 9, 1 6 C 1 3, 3 1, 6 1 C 8 1, 9 2, 10 4 C 11 2, 12 1, 14 1 C 17 1, 19 3, 19 6 C 19 9, 16 13, 10 18 Z"
                      fill={ACCENT}
                    />
                  </svg>
                </motion.div>
              );
            })}

            {/* GALAXY HEART BUTTON — appears after typewriter finishes.
                Positioned mid-height between the letter and the girl. */}
            {typed.done && (
              <div
                className="absolute inset-x-0 flex justify-center pointer-events-none"
                style={{ top: '46%', transform: 'translateY(-50%)' }}
              >
                <div className="pointer-events-auto">
                  <ClickableParticleHeart onClick={goToChapter2} />
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── Chapter 2 — the character video ─── */}
        {chapter === 'ch2' && (
          <motion.div
            key="ch2"
            className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
          >
            {/* Hacker-style falling/streaming greeting, behind everything
                else in this chapter. */}
            <MatrixRain text={`TRUNG THU VUI VẺ 2026 · ${displayName} ·`} />

            {/* ── TOP empty space · glowing Trung Thu moon + fireworks ── */}
            <div className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ top: '2%' }}>
              <motion.div
                style={{
                  width: 84, height: 84, borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 35%, #fff9e6, #ffe9a8 55%, #ffd166 100%)',
                  boxShadow: '0 0 40px 10px #ffe9a888, 0 0 90px 24px #ff5fa855',
                }}
                animate={{ scale: [1, 1.05, 1], opacity: [0.9, 1, 0.9] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
            {[
              { x: 14, y: 10, delay: 0.6, color: '#ff5fa8', hueLabel: 'p1' },
              { x: 82, y: 14, delay: 2.2, color: '#ffd166', hueLabel: 'p2' },
              { x: 50, y: 6, delay: 3.8, color: '#fff', hueLabel: 'p3' },
            ].map((fw, i) => (
              <Firework key={`fw-top-${i}`} {...fw} />
            ))}

            {/* ── BOTTOM empty space · Trung Thu paper lanterns floating
                   up around the drone headline ── */}
            {Array.from({ length: 6 }).map((_, i) => {
              const s = ((i + 900) * 2654435761) >>> 0;
              const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
              const left = 8 + r(1) * 84;
              const size = 22 + r(2) * 14;
              const dur = 9 + r(3) * 6;
              const delay = r(4) * 7;
              return (
                <motion.div
                  key={`lantern-${i}`}
                  className="absolute pointer-events-none"
                  style={{ left: `${left}%`, bottom: '-6%', width: size, height: size * 1.3 }}
                  initial={{ y: 0, opacity: 0, rotate: -4 }}
                  animate={{ y: '-85vh', opacity: [0, 0.9, 0.9, 0], rotate: [-4, 4, -4] }}
                  transition={{
                    y: { duration: dur, delay, repeat: Infinity, repeatDelay: 1.5, ease: 'easeOut' },
                    opacity: { duration: dur, delay, repeat: Infinity, repeatDelay: 1.5, times: [0, 0.12, 0.85, 1] },
                    rotate: { duration: 2.4, delay, repeat: Infinity, ease: 'easeInOut' },
                  }}
                >
                  <svg viewBox="0 0 30 40" width="100%" height="100%">
                    <line x1="15" y1="0" x2="15" y2="6" stroke="#ffd166" strokeWidth="1" />
                    <ellipse cx="15" cy="20" rx="13" ry="15" fill="#ff5fa8" stroke="#ffd166" strokeWidth="1.5" />
                    <ellipse cx="15" cy="20" rx="13" ry="15" fill="none" stroke="#ffe9a8" strokeWidth="0.7" opacity="0.7" />
                    <line x1="4" y1="14" x2="26" y2="14" stroke="#ffe9a8" strokeWidth="0.6" opacity="0.6" />
                    <line x1="4" y1="26" x2="26" y2="26" stroke="#ffe9a8" strokeWidth="0.6" opacity="0.6" />
                    <rect x="12" y="34" width="6" height="4" rx="1" fill="#ffd166" />
                    <line x1="15" y1="38" x2="15" y2="40" stroke="#ffd166" strokeWidth="1" />
                  </svg>
                </motion.div>
              );
            })}

            {/* Ambient rose motes drifting up — ties this scene back to
                Chapter 1's "love in the air" atmosphere without
                competing visually with the video itself. */}
            {Array.from({ length: 8 }).map((_, i) => {
              const s = ((i + 50) * 2654435761) >>> 0;
              const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
              const left = 5 + r(1) * 90;
              const size = 8 + r(2) * 8;
              const dur = 10 + r(3) * 6;
              const delay = r(4) * 8;
              return (
                <motion.div
                  key={`amb-${i}`}
                  className="absolute pointer-events-none"
                  style={{ left: `${left}%`, bottom: '-4%', width: size, height: size, opacity: 0.4 }}
                  initial={{ y: 0, opacity: 0 }}
                  animate={{ y: '-110vh', opacity: [0, 0.4, 0.4, 0] }}
                  transition={{ duration: dur, delay, repeat: Infinity, repeatDelay: 1.5, ease: 'easeOut', times: [0, 0.15, 0.82, 1] }}
                >
                  <svg viewBox="0 0 20 20" width="100%" height="100%">
                    <path
                      d="M 10 18 C 4 13, 1 9, 1 6 C 1 3, 3 1, 6 1 C 8 1, 9 2, 10 4 C 11 2, 12 1, 14 1 C 17 1, 19 3, 19 6 C 19 9, 16 13, 10 18 Z"
                      fill={ACCENT_SOFT}
                    />
                  </svg>
                </motion.div>
              );
            })}

            {/* The character video — revealed with a hacker-style
                scan-line wipe (top→bottom) instead of a plain fade, so
                it reads as being "decoded" rather than just appearing.
                Only "Tiếp tục →" below advances to Chapter 3; `onError`
                is the one automatic exception, so the reveal never
                stalls on a broken video. Once the video actually ends,
                the frame pulses with a "signal locked" glow as a cue
                to tap the button — purely visual, doesn't navigate. */}
            <motion.div
              initial={{ opacity: 0, boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px ${ACCENT_SOFT}33` }}
              animate={{
                opacity: 1,
                boxShadow: videoEnded
                  ? ['0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px #ff5fa855', '0 20px 60px rgba(0,0,0,0.6), 0 0 26px 3px #ff5fa8cc', '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px #ff5fa855']
                  : `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px ${ACCENT_SOFT}33`,
              }}
              transition={videoEnded
                ? { opacity: { duration: 0.1 }, boxShadow: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } }
                : { duration: 0.1 }}
              style={{
                position: 'relative',
                zIndex: 1,
                width: 'min(92vw, 440px)',
                borderRadius: 20,
                overflow: 'hidden',
              }}
            >
              {/* Quick RGB-glitch flicker right as the scan starts. */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 2, background: 'linear-gradient(180deg, transparent, #ff5fa855, transparent)', mixBlendMode: 'screen' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.9, 0, 0.6, 0] }}
                transition={{ duration: 0.45, times: [0, 0.15, 0.3, 0.45, 1] }}
              />

              {/* Scan-line beam sweeping down, synced with the clip-path
                  wipe on the video below it. */}
              <motion.div
                className="absolute left-0 right-0 pointer-events-none"
                style={{ zIndex: 2, height: 3, background: '#ff5fa8', boxShadow: '0 0 12px #ff5fa8, 0 0 24px #ff5fa8aa' }}
                initial={{ top: '0%', opacity: 1 }}
                animate={{ top: '100%', opacity: [1, 1, 0] }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], times: [0, 0.85, 1] }}
              />

              {/* The video itself — clip-path wipes open top→bottom
                  behind the scan-line beam above. */}
              <motion.div
                initial={{ clipPath: 'inset(0% 0% 100% 0%)' }}
                animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              >
                <video
                  src="/videos/video.mp4"
                  autoPlay
                  muted
                  playsInline
                  onError={goToChapter3}
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    if (v.duration) setVideoProgress(v.currentTime / v.duration);
                  }}
                  onEnded={() => { setVideoProgress(1); setVideoEnded(true); }}
                  className="w-full h-full block"
                />
              </motion.div>
            </motion.div>

            {/* "Decoding" progress bar — hacker-flavored readout of the
                video's own playback progress, purely cosmetic. Label +
                bar share one flex slot so they sit close together. */}
            <div style={{ width: 'min(92vw, 440px)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div
                style={{
                  fontFamily: '"Courier New", monospace',
                  fontSize: 11,
                  letterSpacing: '0.15em',
                  color: videoEnded ? '#ff5fa8' : 'rgba(255,255,255,0.6)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{videoEnded ? 'TÍN HIỆU ĐÃ KHOÁ ✓' : 'ĐANG GIẢI MÃ...'}</span>
                <span>{Math.round(videoProgress * 100)}%</span>
              </div>
              <div
                style={{
                  height: 3,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.12)',
                  overflow: 'hidden',
                }}
              >
                <motion.div
                  style={{ height: '100%', background: '#ff5fa8', boxShadow: '0 0 8px #ff5fa8' }}
                  animate={{ width: `${videoProgress * 100}%` }}
                  transition={{ duration: 0.15, ease: 'linear' }}
                />
              </div>
            </div>

            {/* The ONLY way forward from here — video plays (and stays
                on its last frame once done) until this is tapped.
                onError above is the one exception: if the file fails
                to load, we still move on automatically so the reveal
                never gets stuck on a broken video. */}
            <motion.button
              type="button"
              onClick={goToChapter3}
              className="cursor-pointer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.85 }}
              transition={{ delay: 1, duration: 0.8 }}
              style={{
                fontFamily: '"Inter", sans-serif',
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                background: 'rgba(0,0,0,0.35)',
                border: `1px solid ${ACCENT_SOFT}44`,
                borderRadius: 999,
                padding: '6px 16px',
              }}
            >
              Tiếp tục →
            </motion.button>

            {/* Drone-show headline filling the empty space below the
                button — same character-by-character assembly as
                Chapter 1's hero text, anchored from the bottom so it
                sits in that space regardless of the stack's height. */}
            <div
              className="absolute inset-x-0 flex justify-center pointer-events-none"
              style={{ bottom: '10%' }}
            >
              <HeroDroneText text="TRUNG THU 2026" />
            </div>
          </motion.div>
        )}


        {/* ─── Chapter 3 — Cảm Ơn Em (Galaxy Reveal) ─── */}
        {chapter === 'ch3' && (
          <motion.div
            key="ch3"
            className="absolute inset-0 flex flex-col items-center justify-center px-8 gap-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
          >
            {/* Full-viewport galaxy swirl that morphs into a big heart.
                Sits behind text + photos (z-0). Wrapped in a fixed
                container so absolute positioning inside the flex
                parent doesn't get affected. */}
            <div className="absolute inset-0" style={{ zIndex: 0 }}>
              <Ch3GalaxyBackdrop />
            </div>

            {/* HEART MOSAIC · user photos assemble along the heart
                curve. Each photo fades + scales in with stagger so
                the composite heart appears to build itself from love.
                Once settled, gentle breathing keeps it alive.
                Tap any photo → it enlarges 3× and holds ~1.8s. */}
            {heartMosaic.length > 0 && (
              <div className="absolute inset-0" style={{ zIndex: 1 }}>
                {heartMosaic.map((p, i) => {
                  const size = isNarrow ? 88 : 130;
                  const isEnlarged = enlargedIdx === i;
                  const isOthers = enlargedIdx !== null && enlargedIdx !== i;
                  return (
                    <motion.div
                      key={`mosaic-${i}`}
                      className={isEnlarged ? 'absolute cursor-pointer' : 'absolute cursor-pointer'}
                      onClick={(e) => {
                        e.stopPropagation();
                        playMessageChime();
                        setEnlargedIdx(i);
                        // Auto-clear so heart re-composes itself
                        setTimeout(() => {
                          setEnlargedIdx(cur => (cur === i ? null : cur));
                        }, 1800);
                      }}
                      style={{
                        left: `${p.x}vw`,
                        top:  `${p.y}vh`,
                        width: size,
                        height: size,
                        transform: 'translate(-50%, -50%)',
                        // Elevate tapped photo above its neighbours
                        zIndex: isEnlarged ? 30 : 2,
                        touchAction: 'manipulation',
                      }}
                      initial={{ opacity: 0, scale: 0.2, rotate: -30 }}
                      // The outer motion.div drives BOTH the initial
                      // assemble AND the enlarge-on-tap effect via
                      // scale. When enlarged we also dim/blur the
                      // other photos so the tapped one pops.
                      animate={{
                        opacity: isOthers ? 0.35 : 1,
                        scale: isEnlarged ? (isNarrow ? 2.6 : 3.2) : 1,
                        rotate: 0,
                        filter: isOthers ? 'blur(1.5px)' : 'blur(0px)',
                      }}
                      transition={
                        isEnlarged
                          ? { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
                          : isOthers
                            ? { duration: 0.35, ease: 'easeOut' }
                            : {
                                // Initial assemble stagger only fires
                                // during the reveal — after that we
                                // use the fast reset transition.
                                duration: enlargedIdx === null && i === 0 ? 1.2 : 0.5,
                                delay: enlargedIdx === null ? 1.0 + i * 0.35 : 0,
                                ease: [0.16, 1, 0.3, 1],
                              }
                      }
                    >
                      {/* Once settled, gentle breathe + micro spin so
                          the heart doesn't feel frozen. Frozen while
                          any photo is enlarged so the pop reads clean. */}
                      <motion.div
                        style={{ width: '100%', height: '100%' }}
                        animate={enlargedIdx !== null
                          ? { scale: 1, rotate: 0 }
                          : { scale: [1, 1.05, 1], rotate: [0, 3, 0, -3, 0] }}
                        transition={enlargedIdx !== null
                          ? { duration: 0.3 }
                          : {
                              duration: 6 + (i % 4),
                              delay: 3.5 + i * 0.3,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }}
                      >
                        <svg
                          viewBox="0 0 100 100"
                          width="100%"
                          height="100%"
                          style={{
                            overflow: 'visible',
                            // Boost the halo when enlarged so the pop
                            // reads as luminous, not just bigger.
                            filter: isEnlarged
                              ? `drop-shadow(0 12px 24px rgba(0,0,0,0.7)) drop-shadow(0 0 32px ${ACCENT}) drop-shadow(0 0 64px ${ACCENT_SOFT})`
                              : `drop-shadow(0 6px 14px rgba(0,0,0,0.65)) drop-shadow(0 0 14px ${ACCENT}) drop-shadow(0 0 28px ${ACCENT_SOFT}88)`,
                          }}
                        >
                          <defs>
                            <clipPath id={`mosaic-clip-${i}`}>
                              <path d="M50 88 C 20 66, 4 46, 4 30 C 4 14, 18 4, 30 4 C 40 4, 46 10, 50 20 C 54 10, 60 4, 70 4 C 82 4, 96 14, 96 30 C 96 46, 80 66, 50 88 Z" />
                            </clipPath>
                          </defs>
                          <image
                            href={p.url}
                            x="0" y="0" width="100" height="100"
                            preserveAspectRatio="xMidYMid slice"
                            clipPath={`url(#mosaic-clip-${i})`}
                          />
                          <path
                            d="M50 88 C 20 66, 4 46, 4 30 C 4 14, 18 4, 30 4 C 40 4, 46 10, 50 20 C 54 10, 60 4, 70 4 C 82 4, 96 14, 96 30 C 96 46, 80 66, 50 88 Z"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M50 88 C 20 66, 4 46, 4 30 C 4 14, 18 4, 30 4 C 40 4, 46 10, 50 20 C 54 10, 60 4, 70 4 C 82 4, 96 14, 96 30 C 96 46, 80 66, 50 88 Z"
                            fill="none"
                            stroke={ACCENT}
                            strokeWidth="1"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Subtle signature bottom center — appears very late so
                the galaxy + photos read as the moment. */}
            {kiss.sender_name && (
              <motion.div
                className="absolute inset-x-0 text-center pointer-events-none"
                style={{ bottom: '6%', zIndex: 2 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.85 }}
                transition={{ duration: 1.2, delay: 5 }}
              >
                <div
                  style={{
                    fontFamily: '"Dancing Script", cursive',
                    color: ACCENT_SOFT,
                    fontStyle: 'italic',
                    fontSize: 'clamp(16px, 2.4vw, 22px)',
                    textShadow: `0 2px 10px rgba(0,0,0,0.6), 0 0 14px ${ACCENT_SOFT}55`,
                  }}
                >
                  — {kiss.sender_name} yêu {displayName} 💕
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DailySorryReveal;

export const DailySorryFlowerConfig: TemplateConfig = {
  id: 'daily-sorry-flower',
  name: 'Sorry · Chiếc Nút Bất Khả Thi',
  occasionIds: ['daily'],
  emoji: '💔',
  description: 'A 2-chapter interactive apology: a typewriter letter under the night sky reveals a heart-tap, then a mischievous game where the "still angry" button runs away from every tap — until only "forgive" remains.',
  thumbnailBg: 'linear-gradient(135deg, #0b0a1e, #831843, #f43f5e)',
  Component: DailySorryReveal,
};
