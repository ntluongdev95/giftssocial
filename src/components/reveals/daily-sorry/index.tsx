'use client';

// Sorry — 2-Chapter Interactive Apology.
// ─────────────────────────────────────────────────────────────────────
//
//   Chapter 1 · KHOẢNG LẶNG (The Silence)
//     Deep night-sky background with twinkling stars. A hand-crafted
//     apology letter reveals itself word-by-word (typewriter). Once the
//     text finishes, a soft-pulsing heart button rises into view. Tap
//     it to move on — a gentle chime plays as we transition.
//
//   Chapter 2 · CHIẾC NÚT BẤT KHẢ THI (The Impossible Button game)
//     Two choices appear:
//        A  "Tha lỗi cho Anh" (big, pink, obvious)
//        B  "Vẫn còn giận lắm!" (small, grey)
//     Button B RUNS AWAY the moment the receiver hovers or taps —
//     jumping to a new random position on the viewport that never
//     collides with button A. After 3 misses, button A auto-grows to
//     fill the screen with "🙈 Chỉ còn một lựa chọn thôi nè!" and we
//     hand off to Chapter 3.
//
//   Chapter 3 · CẢM ƠN EM (Thank You)
//     The sender's message + signature + optional photo unfold on a
//     warm rose backdrop. Auto-closes after the total reveal duration.
//
// ─────────────────────────────────────────────────────────────────────

import { useMemo, useState, useEffect, useRef, useReducer, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playMessageChime, playHeartbeat, playCelebration } from '@/lib/kiss-audio';
import { getKissString, parseKissData } from '../_shared/useTemplateData';
import type { TemplateProps, TemplateConfig } from '../_types';

// Chapter 2 has no time limit — reveal stays open until player taps
// HEARTS_GOAL photo-hearts. Chapter 3 hands off after ~12s (see the
// chapter-scoped auto-close useEffect below).
const HEARTS_GOAL = 6;               // tap this many photo-hearts → forgive
const CLOUD_PENALTY = 1;              // tapped cloud subtracts from score
const SPAWN_INTERVAL_MS = 450;        // chaos rate — every 0.45s
const CLOUD_RATIO = 0.45;             // 45% clouds → real distraction
const MULTI_SPAWN_CHANCE = 0.35;      // 35% chance to launch a small burst

// ─── Palette ─────────────────────────────────────────────────────────
const ACCENT      = '#f43f5e';    // rose
const ACCENT_SOFT = '#fda4af';    // soft rose
const ACCENT_DEEP = '#9f1239';    // deep rose
const NIGHT_TOP   = '#0b0a1e';
const NIGHT_BASE  = '#000208';

// ─── Chapter 1 letter · edit the string to change the copy ──────────
const HERO_TEXT = 'EM YÊU...';
const LETTER = 'Anh biết mình đã làm em buồn... Nhưng nếu em sẵn sàng cho anh một cơ hội để sửa sai, hãy bấm vào trái tim này nhé.';

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

  return (
    <div
      className="flex justify-center pointer-events-none select-none"
      style={{
        fontFamily: '"Bebas Neue", "Impact", "Oswald", "Helvetica Neue", sans-serif',
        fontWeight: 900,
        fontSize: 'clamp(50px, 10vw, 130px)',
        letterSpacing: '0.08em',
        lineHeight: 1,
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

  // ── NINJA-SLICE game state ──
  // Hearts + angry-cloud objects launch from below the screen with
  // parabolic physics. Player swipes/taps to slice them. Slicing a
  // HEART = +1 to score; slicing a CLOUD = -1 (with penalty burst).
  // Reach HEARTS_GOAL → forgive fills the sky. Physics live in refs +
  // a 60fps RAF; React re-renders per frame via forceRender().
  type FlyObj = {
    id: number;
    type: 'heart' | 'cloud';
    x: number; y: number;         // vw, vh (viewport-relative)
    vx: number; vy: number;       // vw/s, vh/s
    rot: number; vRot: number;
    size: number;                 // px
    sliced: boolean;
    slicedAt: number;
  };
  const objsRef = useRef<FlyObj[]>([]);
  const pointerRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const pointerTrailRef = useRef<{ x: number; y: number; time: number }[]>([]);
  const lastSpawnRef = useRef(0);
  const objIdRef = useRef(0);
  const lastSliceAtRef = useRef(0);

  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number; type: 'heart' | 'cloud' }[]>([]);
  const [popTexts, setPopTexts] = useState<{ id: number; x: number; y: number; text: string; color: string }[]>([]);
  const [shakeKey, setShakeKey] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const [forgiveGiant, setForgiveGiant] = useState(false);
  const popIdRef = useRef(0);
  const burstIdRef = useRef(0);
  const [, forceRender] = useReducer(x => x + 1, 0);

  // Detect narrow viewport for responsive object sizing / spawn width
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsNarrow(window.innerWidth < 720);
    const on = () => setIsNarrow(window.innerWidth < 720);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  // ── Slice detection · called when the pointer segment intersects a
  // fly object. Spawns burst, pop text, updates score/combo, and
  // triggers the endgame if HEARTS_GOAL is reached.
  const doSlice = useCallback((obj: FlyObj, now: number) => {
    obj.sliced = true;
    obj.slicedAt = now;

    // Burst — hearts (rose) or clouds (grey debris)
    burstIdRef.current += 1;
    const bid = burstIdRef.current;
    setBursts(prev => [...prev.slice(-4), { id: bid, x: obj.x, y: obj.y, type: obj.type }]);
    setTimeout(() => setBursts(prev => prev.filter(b => b.id !== bid)), 900);

    // Pop text
    popIdRef.current += 1;
    const pid = popIdRef.current;
    if (obj.type === 'heart') {
      setScore(prev => {
        const next = prev + 1;
        if (next >= HEARTS_GOAL) {
          setTimeout(() => setForgiveGiant(true), 350);
          setTimeout(() => playCelebration(), 800);
          // Let the galaxy heart + poetic text finale play out fully
          // (4 text layers + underline + signature = ~5.5s) before
          // handing off to chapter 3.
          setTimeout(() => setChapter('ch3'), 7500);
        }
        return next;
      });
      // Combo: chained slices within 700ms
      const isCombo = now - lastSliceAtRef.current < 700;
      const nextCombo = isCombo ? combo + 1 : 1;
      setCombo(nextCombo);
      lastSliceAtRef.current = now;
      const text = nextCombo >= 3 ? `💕 COMBO x${nextCombo}!` : '💋 +1';
      const color = nextCombo >= 3 ? '#fbbf24' : ACCENT;
      setPopTexts(prev => [...prev.slice(-3), { id: pid, x: obj.x, y: obj.y, text, color }]);
      playMessageChime();
      setFlashKey(k => k + 1);
    } else {
      setCombo(0);
      setScore(prev => Math.max(0, prev - CLOUD_PENALTY));
      setPopTexts(prev => [...prev.slice(-3), { id: pid, x: obj.x, y: obj.y, text: '−1 ☁️', color: '#94a3b8' }]);
      playHeartbeat();
      setShakeKey(k => k + 1);
    }
    setTimeout(() => setPopTexts(prev => prev.filter(p => p.id !== pid)), 900);
  }, [combo]);

  // ── Game RAF: spawn, physics, slice checks. Runs only in ch2. ──
  useEffect(() => {
    if (chapter !== 'ch2' || forgiveGiant) return;
    let raf = 0;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      // ── SPAWN · every SPAWN_INTERVAL_MS launch new object(s).
      // 35% chance we spawn a MINI BURST of 2-3 at once for chaos.
      // Type ratio: ~55% hearts / 45% clouds (real distraction).
      if (now - lastSpawnRef.current > SPAWN_INTERVAL_MS) {
        lastSpawnRef.current = now;
        const burstSize = Math.random() < MULTI_SPAWN_CHANCE
          ? 2 + Math.floor(Math.random() * 2)                    // 2-3 at once
          : 1;
        for (let k = 0; k < burstSize; k++) {
          const isHeart = Math.random() > CLOUD_RATIO;
          objIdRef.current += 1;
          const spawnX = 8 + Math.random() * 84;                 // 8-92 vw (wider)
          objsRef.current.push({
            id: objIdRef.current,
            type: isHeart ? 'heart' : 'cloud',
            x: spawnX,
            y: 108,
            vx: (Math.random() - 0.5) * 22,                       // ±11 vw/s drift (wilder)
            vy: -(60 + Math.random() * 25),                       // -60 to -85 vh/s
            rot: (Math.random() - 0.5) * 60,
            vRot: (Math.random() - 0.5) * 220,                    // deg/s spin
            size: isNarrow ? 42 + Math.random() * 14 : 58 + Math.random() * 22,
            sliced: false,
            slicedAt: 0,
          });
        }
      }

      // ── PHYSICS · apply gravity + drift, cleanup off-screen ──
      const GRAVITY = 60;                                        // vh/s²
      const surviving: FlyObj[] = [];
      for (const o of objsRef.current) {
        // Skip physics for sliced objects (keep them for fade-out)
        if (!o.sliced) {
          o.vy += GRAVITY * dt;
          o.x  += o.vx * dt;
          o.y  += o.vy * dt;
          o.rot += o.vRot * dt;
        }
        // Cleanup: below screen and no fade-in-progress
        if (o.y > 120) continue;
        if (o.sliced && now - o.slicedAt > 500) continue;
        surviving.push(o);
      }
      objsRef.current = surviving;

      // Slice detection moved to per-object onClick — no more swipe.
      // Trim ambient finger trail (kept for visual delight only, not
      // for hit-testing).
      pointerTrailRef.current = pointerTrailRef.current.filter(p => now - p.time < 500);

      forceRender();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [chapter, forgiveGiant, isNarrow, doSlice]);

  // (Pointer tracking removed — game is tap-to-collect via per-object
  // onClick handlers; no need for global mouse/touch move tracking.)

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

  const acceptForgive = useCallback(() => {
    playCelebration();
    setForgiveGiant(true);
    setTimeout(() => setChapter('ch3'), 900);
  }, []);

  const goToChapter2 = useCallback(() => {
    playMessageChime();
    setChapter('ch2');
  }, []);

  // Auto-close ONLY once the player has actually completed the game
  // and reached Chapter 3. Chapter 2 has no time limit — the reveal
  // sits open until they've tapped HEARTS_GOAL hearts. Ch3 gets a
  // relaxed 12s to read the message + photo, then hands off.
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

        {/* ─── Chapter 2 — Chiếc Nút Bất Khả Thi ─── */}
        {chapter === 'ch2' && (
          <motion.div
            key="ch2"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, x: shakeKey === 0 ? 0 : [0, -8, 8, -6, 6, 0] }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 0.6 }, x: { duration: 0.4 } }}
          >
            {/* ── Sea backdrop · same night beach scene as Chapter 1
                   so the story stays visually continuous. Girl is
                   dimmed slightly so the game reads as the hero. */}
            <SeaScene />
            <div
              className="absolute pointer-events-none"
              style={{
                left: '50%',
                bottom: '1%',
                transform: 'translateX(-50%)',
                width: 'clamp(90px, 13vw, 160px)',
                height: 'clamp(120px, 18vw, 200px)',
                opacity: 0.45,
                filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.55))',
              }}
            >
              <GirlSilhouette />
            </div>

            {/* ── AMBIENT HEARTS · slow rose motes drifting up all
                   over the scene — reads as her "love energy" in the
                   air, ties the game visually to the emotion. */}
            {Array.from({ length: 12 }).map((_, i) => {
              const s = ((i + 50) * 2654435761) >>> 0;
              const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
              const left = 5 + r(1) * 90;
              const size = 10 + r(2) * 10;
              const dur = 10 + r(3) * 6;
              const delay = r(4) * 8;
              return (
                <motion.div
                  key={`amb-${i}`}
                  className="absolute pointer-events-none"
                  style={{ left: `${left}%`, bottom: '-4%', width: size, height: size, opacity: 0.5 }}
                  initial={{ y: 0, opacity: 0 }}
                  animate={{ y: '-110vh', opacity: [0, 0.5, 0.5, 0] }}
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

            {/* ── HUD · score X/6 hearts + combo indicator on top ── */}
            <div className="absolute inset-x-0 pointer-events-none flex flex-col items-center gap-2" style={{ top: '4%' }}>
              <div
                className="flex items-center gap-3 rounded-full px-4 py-2"
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: `1px solid ${ACCENT_SOFT}55`,
                  backdropFilter: 'blur(8px)',
                }}
              >
                <span style={{ fontSize: 20 }}>❤️</span>
                <span
                  style={{
                    fontFamily: '"Bebas Neue", Impact, sans-serif',
                    fontSize: 26,
                    fontWeight: 900,
                    color: '#fff',
                    letterSpacing: 2,
                    textShadow: `0 0 10px ${ACCENT}`,
                  }}
                >
                  {score} / {HEARTS_GOAL}
                </span>
                {combo >= 2 && (
                  <motion.span
                    key={combo}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: [0.5, 1.3, 1], opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    style={{
                      fontFamily: '"Bebas Neue", Impact, sans-serif',
                      fontSize: 16,
                      color: '#fbbf24',
                      letterSpacing: 1,
                      textShadow: '0 0 8px #fbbf24',
                    }}
                  >
                    x{combo} 🔥
                  </motion.span>
                )}
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.85 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                style={{
                  fontFamily: '"Dancing Script", cursive',
                  fontSize: 'clamp(15px, 2.4vw, 22px)',
                  color: '#fff',
                  textShadow: `0 2px 8px rgba(0,0,0,0.7), 0 0 12px ${ACCENT_SOFT}88`,
                }}
              >
                Chạm vào em {HEARTS_GOAL} lần, né mây giận 💕
              </motion.div>
            </div>

            {/* ── FLY OBJECTS · photo circles + angry clouds ────────
                   Each object is INDIVIDUALLY tappable — pointer-
                   events-auto + onClick fires doSlice(). Sliced state
                   scale-fades out so it reads as "collected". */}
            {objsRef.current.map(o => {
              const rotation = o.rot;
              const sliceProg = o.sliced ? (performance.now() - o.slicedAt) / 500 : 0;
              const opacity = o.sliced ? Math.max(0, 1 - sliceProg) : 1;
              // On tap: photos gently GROW+fade (love-collected feel);
              // clouds SHRINK+fade (dispelled).
              const scale = o.sliced
                ? (o.type === 'heart' ? 1 + sliceProg * 0.8 : 1 - sliceProg * 0.6)
                : 1;
              return (
                <div
                  key={o.id}
                  className={o.sliced ? 'absolute pointer-events-none' : 'absolute pointer-events-auto cursor-pointer'}
                  onClick={o.sliced ? undefined : (e) => {
                    e.stopPropagation();
                    doSlice(o, performance.now());
                  }}
                  style={{
                    left: `${o.x}vw`,
                    top:  `${o.y}vh`,
                    width: o.size,
                    height: o.size,
                    transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
                    opacity,
                    willChange: 'transform',
                    touchAction: 'manipulation',
                  }}
                >
                  {o.type === 'heart' ? (
                    // ── PERSONALIZED PHOTO CIRCLE ──
                    // Recipient's photo inside a rose-ringed circular
                    // frame. Feels like the player is "collecting
                    // memories" of themselves as sender apologises.
                    // Falls back to a rose-gradient heart if the
                    // photoUrl failed to load / wasn't supplied.
                    photoUrl ? (
                      // ── HEART-SHAPED PHOTO ──
                      // Recipient's photo clipped to the classic heart
                      // curve via SVG clipPath, with a glowing rose
                      // stroke outlining it. Drop-shadow reaches out
                      // into the sky for a warm pulse.
                      <svg
                        viewBox="0 0 100 100"
                        width="100%"
                        height="100%"
                        style={{
                          overflow: 'visible',
                          filter: `drop-shadow(0 4px 10px rgba(0,0,0,0.6)) drop-shadow(0 0 10px ${ACCENT}) drop-shadow(0 0 22px ${ACCENT_SOFT}88)`,
                        }}
                      >
                        <defs>
                          <clipPath id={`fh-clip-${o.id}`}>
                            <path d="M50 88 C 20 66, 4 46, 4 30 C 4 14, 18 4, 30 4 C 40 4, 46 10, 50 20 C 54 10, 60 4, 70 4 C 82 4, 96 14, 96 30 C 96 46, 80 66, 50 88 Z" />
                          </clipPath>
                        </defs>
                        <image
                          href={photoUrl}
                          x="0" y="0" width="100" height="100"
                          preserveAspectRatio="xMidYMid slice"
                          clipPath={`url(#fh-clip-${o.id})`}
                        />
                        {/* Glowing rose rim outline over the heart */}
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
                    ) : (
                      <svg viewBox="0 0 20 20" width="100%" height="100%" style={{ filter: `drop-shadow(0 4px 10px rgba(0,0,0,0.5)) drop-shadow(0 0 8px ${ACCENT}88)` }}>
                        <defs>
                          <radialGradient id={`fh-fill-${o.id}`} cx="35%" cy="30%" r="80%">
                            <stop offset="0%"   stopColor="#fff2f4" />
                            <stop offset="25%"  stopColor="#ffb4be" />
                            <stop offset="60%"  stopColor={ACCENT} />
                            <stop offset="100%" stopColor={ACCENT_DEEP} />
                          </radialGradient>
                        </defs>
                        <path
                          d="M 10 18 C 4 13, 1 9, 1 6 C 1 3, 3 1, 6 1 C 8 1, 9 2, 10 4 C 11 2, 12 1, 14 1 C 17 1, 19 3, 19 6 C 19 9, 16 13, 10 18 Z"
                          fill={`url(#fh-fill-${o.id})`}
                          stroke="rgba(255,255,255,0.4)"
                          strokeWidth="0.5"
                        />
                      </svg>
                    )
                  ) : (
                    // Angry storm cloud with lightning bolt inside
                    <svg viewBox="0 0 40 30" width="100%" height="100%" style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.6))' }}>
                      <ellipse cx="10" cy="18" rx="9" ry="8"  fill="#3f3f52" />
                      <ellipse cx="20" cy="12" rx="12" ry="10" fill="#4a4a5e" />
                      <ellipse cx="30" cy="16" rx="9" ry="9"  fill="#3f3f52" />
                      <ellipse cx="20" cy="20" rx="15" ry="8" fill="#2d2d40" />
                      <path d="M 18 14 L 15 20 L 19 20 L 16 27 L 24 18 L 20 18 L 22 12 Z" fill="#fef08a" opacity="0.95" />
                      {/* 2 angry eyes */}
                      <circle cx="14" cy="19" r="1.2" fill="#ef4444" />
                      <circle cx="26" cy="19" r="1.2" fill="#ef4444" />
                    </svg>
                  )}
                </div>
              );
            })}

            {/* (Removed: swipe trail. Now the game is tap-to-collect,
                not swipe-to-slice. Each fly object is individually
                clickable via its own onClick handler.) */}

            {/* (Removed: giant particle heart. The forgive phase is
                now TEXT-ONLY on the night sky — the swirling galaxy
                + photo reveal happens in Chapter 3 instead.) */}

            {/* GIANT REVEAL TEXT · poetic realization over the galaxy
                heart. 4 layers stagger in like the sender is speaking:
                   ~0.6s  "Em thấy không?"
                   ~1.4s  "Chạm vào em cũng khó vậy..."
                   ~2.3s  "sao anh có thể đánh mất em"
                   ~3.4s  Hero title "Tha lỗi cho Anh"
                   ~4.2s  Underline draws
                   ~4.8s  Sender signature */}
            {forgiveGiant && (
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6 pointer-events-none"
                style={{ zIndex: 20 }}
                initial={{ opacity: 0 }}
                // Fade out at 6.5s (after all layers reveal + hold ~1s)
                // so text disappears cleanly before Chapter 3's galaxy
                // starts. Chapter 3 fires at 7s (see doSlice timeouts).
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 7.2,
                  delay: 0.3,
                  times: [0, 0.08, 0.85, 1],
                }}
              >
                {/* Line 1 — the whisper */}
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 0.9, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.6 }}
                  style={{
                    fontFamily: '"Dancing Script", cursive',
                    fontSize: 'clamp(18px, 3vw, 32px)',
                    fontStyle: 'italic',
                    color: '#fff',
                    textShadow: '0 2px 10px rgba(0,0,0,0.7), 0 0 16px rgba(255,255,255,0.4)',
                  }}
                >
                  Em thấy không?
                </motion.div>

                {/* Line 2 — the realization */}
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: 1.4 }}
                  style={{
                    fontFamily: '"Dancing Script", cursive',
                    fontSize: 'clamp(20px, 3.6vw, 38px)',
                    fontStyle: 'italic',
                    color: '#fff',
                    lineHeight: 1.25,
                    textShadow: `0 3px 14px rgba(0,0,0,0.75), 0 0 22px ${ACCENT_SOFT}88, 0 0 42px ${ACCENT}55`,
                    maxWidth: '92vw',
                  }}
                >
                  Chạm vào em cũng khó vậy…
                </motion.div>

                {/* Line 3 — the confession */}
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.0, delay: 2.3 }}
                  style={{
                    fontFamily: '"Dancing Script", cursive',
                    fontSize: 'clamp(20px, 3.8vw, 40px)',
                    fontStyle: 'italic',
                    fontWeight: 500,
                    color: '#fff',
                    lineHeight: 1.25,
                    textShadow: `0 3px 14px rgba(0,0,0,0.75), 0 0 24px ${ACCENT}88, 0 0 48px ${ACCENT_SOFT}66`,
                    maxWidth: '92vw',
                  }}
                >
                  sao anh có thể đánh mất em?
                </motion.div>

                {/* HERO title — Tha lỗi cho Anh */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, y: 24 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 1.2, delay: 3.4, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    marginTop: 8,
                    fontFamily: '"Dancing Script", "Segoe Script", cursive',
                    fontSize: 'clamp(44px, 10vw, 96px)',
                    fontWeight: 700,
                    color: '#fff',
                    lineHeight: 1.05,
                    textShadow: `
                      0 4px 24px rgba(0,0,0,0.75),
                      0 0 30px ${ACCENT},
                      0 0 60px ${ACCENT_SOFT},
                      0 0 100px rgba(255,255,255,0.45)
                    `,
                    letterSpacing: '0.01em',
                  }}
                >
                  Tha lỗi cho Anh 💕
                </motion.div>

                {/* Underline draws itself */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: 'clamp(180px, 40%, 460px)' }}
                  transition={{ duration: 1.4, delay: 4.2, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    height: 3,
                    borderRadius: 3,
                    background: `linear-gradient(90deg, transparent, ${ACCENT}, #fff, ${ACCENT}, transparent)`,
                    filter: `drop-shadow(0 0 10px ${ACCENT})`,
                  }}
                />

                {/* Sender attribution */}
                {kiss.sender_name && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.85 }}
                    transition={{ duration: 0.8, delay: 4.8 }}
                    style={{
                      marginTop: 6,
                      fontFamily: '"Dancing Script", cursive',
                      fontSize: 'clamp(18px, 2.6vw, 26px)',
                      fontStyle: 'italic',
                      color: ACCENT_SOFT,
                      textShadow: `0 2px 10px rgba(0,0,0,0.55), 0 0 16px ${ACCENT_SOFT}`,
                    }}
                  >
                    — {kiss.sender_name} yêu {displayName} 💕
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* (Removed: heart-orbit trail and angry orbiting button.
                Ninja slice game replaces the orbit mechanic — fly
                objects + swipe trail are rendered above.) */}

            {/* MISS BURSTS · little firework of hearts erupts at the
                spot where the player almost caught the button. Auto
                cleaned up in attemptCatchAngry after 900ms. */}
            {bursts.map(b => (
              <div
                key={`burst-${b.id}`}
                className="absolute pointer-events-none"
                style={{
                  left: `${b.x}vw`,
                  top:  `${b.y}vh`,
                  transform: 'translate(-50%, -50%)',
                  width: 0, height: 0,
                }}
              >
                {Array.from({ length: 10 }).map((_, i) => {
                  const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
                  const dist  = 60 + Math.random() * 40;
                  const dx    = Math.cos(angle) * dist;
                  const dy    = Math.sin(angle) * dist;
                  const isCloud = b.type === 'cloud';
                  return (
                    <motion.div
                      key={i}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
                      animate={{ x: dx, y: dy, opacity: 0, scale: 1.1, rotate: (Math.random() - 0.5) * 90 }}
                      transition={{ duration: 0.85, ease: 'easeOut' }}
                      style={{
                        position: 'absolute',
                        width: 14, height: 14,
                        left: -7, top: -7,
                      }}
                    >
                      <svg viewBox="0 0 20 20" width="100%" height="100%" style={{ filter: isCloud ? 'drop-shadow(0 0 4px #94a3b8)' : `drop-shadow(0 0 4px ${ACCENT})` }}>
                        {isCloud ? (
                          <circle cx="10" cy="10" r="4" fill="#64748b" />
                        ) : (
                          <path
                            d="M 10 18 C 4 13, 1 9, 1 6 C 1 3, 3 1, 6 1 C 8 1, 9 2, 10 4 C 11 2, 12 1, 14 1 C 17 1, 19 3, 19 6 C 19 9, 16 13, 10 18 Z"
                            fill={ACCENT}
                          />
                        )}
                      </svg>
                    </motion.div>
                  );
                })}
              </div>
            ))}

            {/* MISS "POP" TEXT · playful "SUÝT!" / "TRƯỢT!" tag pops
                where the player almost caught the button, then floats
                up and fades. Adds arcade-game punch. */}
            {popTexts.map(p => (
              <motion.div
                key={`pop-${p.id}`}
                className="absolute pointer-events-none"
                style={{
                  left: `${p.x}vw`,
                  top:  `${p.y}vh`,
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ opacity: 0, y: 0, scale: 0.4, rotate: -8 }}
                animate={{ opacity: [0, 1, 1, 0], y: -60, scale: [0.4, 1.3, 1.15, 1], rotate: [-8, 6, -3, 0] }}
                transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1], times: [0, 0.15, 0.7, 1] }}
              >
                <div
                  style={{
                    fontFamily: '"Bebas Neue", "Impact", sans-serif',
                    fontSize: 'clamp(22px, 5vw, 42px)',
                    fontWeight: 900,
                    color: '#fff',
                    letterSpacing: 2,
                    textShadow: `0 0 12px ${p.color}, 0 0 24px ${p.color}, 0 3px 8px rgba(0,0,0,0.6)`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.text}
                </div>
              </motion.div>
            ))}

            {/* PINK SCREEN FLASH · full-viewport rose wash triggered on
                every catch attempt. Very short (~250ms) so it reads as
                punch, not obtrusive. Keyed on flashKey so remounts. */}
            {flashKey > 0 && (
              <motion.div
                key={`flash-${flashKey}`}
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse at 50% 50%, ${ACCENT}88 0%, ${ACCENT_SOFT}55 30%, transparent 70%)`,
                  mixBlendMode: 'screen',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.85, 0] }}
                transition={{ duration: 0.35, times: [0, 0.15, 1], ease: 'easeOut' }}
              />
            )}

            {/* FINAL FIREWORKS · when the giant forgive fills the sky,
                erupt 40 hearts + sparkles radially from centre. Big
                pay-off moment right before Chapter 3. */}
            {forgiveGiant && Array.from({ length: 40 }).map((_, i) => {
              const s = ((i + 800) * 2654435761) >>> 0;
              const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
              const angle = (i / 40) * Math.PI * 2 + r(1) * 0.3;
              const dist = 200 + r(2) * 300;
              const dx = Math.cos(angle) * dist;
              const dy = Math.sin(angle) * dist;
              const size = 14 + r(3) * 16;
              const isStar = i % 3 === 0;
              return (
                <motion.div
                  key={`fw-${i}`}
                  className="absolute pointer-events-none"
                  style={{
                    left: '50%',
                    top: '50%',
                    width: size,
                    height: size,
                  }}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.3, rotate: 0 }}
                  animate={{ x: dx, y: dy, opacity: [0, 1, 1, 0], scale: [0.3, 1.3, 1, 0.8], rotate: (r(4) - 0.5) * 720 }}
                  transition={{ duration: 2.2, delay: 0.3 + r(5) * 0.6, ease: 'easeOut', times: [0, 0.1, 0.75, 1] }}
                >
                  {isStar ? (
                    <svg viewBox="0 0 20 20" width="100%" height="100%" style={{ filter: 'drop-shadow(0 0 6px #fff) drop-shadow(0 0 14px #fef3c7)' }}>
                      <path d="M 10 0 L 12 8 L 20 10 L 12 12 L 10 20 L 8 12 L 0 10 L 8 8 Z" fill="#fef3c7" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" width="100%" height="100%" style={{ filter: `drop-shadow(0 0 6px ${ACCENT}) drop-shadow(0 0 14px ${ACCENT_SOFT})` }}>
                      <path
                        d="M 10 18 C 4 13, 1 9, 1 6 C 1 3, 3 1, 6 1 C 8 1, 9 2, 10 4 C 11 2, 12 1, 14 1 C 17 1, 19 3, 19 6 C 19 9, 16 13, 10 18 Z"
                        fill={ACCENT}
                      />
                    </svg>
                  )}
                </motion.div>
              );
            })}
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

export const DailySorryConfig: TemplateConfig = {
  id: 'daily-sorry',
  name: 'Sorry · Chiếc Nút Bất Khả Thi',
  occasionIds: ['daily'],
  emoji: '💔',
  description: 'A 2-chapter interactive apology: a typewriter letter under the night sky reveals a heart-tap, then a mischievous game where the "still angry" button runs away from every tap — until only "forgive" remains.',
  thumbnailBg: 'linear-gradient(135deg, #0b0a1e, #831843, #f43f5e)',
  Component: DailySorryReveal,
};
