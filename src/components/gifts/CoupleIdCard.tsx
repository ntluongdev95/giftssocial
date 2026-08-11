'use client';

import { forwardRef, useState } from 'react';

export type Milestone = { emoji: string; date: string; label: string };

// SVG heart path — a single closed shape centered at (50,50) inside a
// 100x100 viewBox. Reused for the photo clip mask AND the outline stroke
// so they line up perfectly.
const HEART_PATH =
  'M50,86 C46,80 12,58 12,32 C12,17 24,10 36,10 C44,10 50,18 50,20 C50,18 56,10 64,10 C76,10 88,17 88,32 C88,58 54,80 50,86 Z';

/** Tiny seeded PRNG — mulberry32. Gives us deterministic "random-looking"
 *  positions for the heart particles so every render + PNG export shows
 *  the same layout (no flicker across re-renders). */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Populate the interior of the heart shape with N random points using
 *  rejection sampling against the implicit heart equation:
 *      (x² + y² − 1)³ − x²·y³ ≤ 0
 *  where (x, y) are normalized to unit-heart coordinates (center-origin,
 *  y-axis pointing up). Rejected samples are discarded until we hit N. */
type HeartDot = {
  x: number; y: number; r: number; color: string; delay: number;
  hasGlow: boolean; duration: number;
};

function generateHeartFill(count: number, seed: number): HeartDot[] {
  const rand = mulberry32(seed);
  const points: HeartDot[] = [];
  const cx = 50;
  const cy = 44;      // vertical center; heart's top notch reaches up
  const scale = 32;   // half-width/height in SVG units
  // Premium palette: pink/rose base + gold + pearl white — the rose
  // stays warm and romantic while the gold + pearl accents give the
  // heart its "champagne foil" luxury glow.
  const colors = [
    '#c9a961', '#d4af37', '#e8c56f',   // gold trio
    '#e8dfc9', '#f5e6d3',              // pearl / cream
    '#c81e5b', '#e0004a', '#ff4060',   // rose base
  ];

  let safety = count * 30;
  while (points.length < count && safety-- > 0) {
    const px = rand() * 100;
    const py = rand() * 100;
    const xn = (px - cx) / scale;
    const yn = -(py - cy) / scale;
    // Standard heart implicit equation
    const val = Math.pow(xn * xn + yn * yn - 1, 3) - xn * xn * yn * yn * yn;
    if (val < 0) {
      const r = 0.4 + rand() * 1.1;    // smaller: 0.4-1.5px so photo shows
      points.push({
        x: px, y: py, r,
        color: colors[Math.floor(rand() * colors.length)],
        delay: rand() * 2.4,
        hasGlow: r > 1.1,
        duration: 1.6 + rand() * 1.5,
      });
    }
  }
  return points;
}

// Module-level so points are computed once and shared across all card
// instances. 100 particles is dense enough to feel like a particle
// cloud but sparse enough that the underlying photo still reads through
// the gaps between dots.
const HEART_FILL_POINTS: HeartDot[] = generateHeartFill(100, 42);

/** Hand-placed sparkle dots along the heart's silhouette — every point
 *  has its own twinkle clock so the border reads as living particles.
 *  Premium palette: gold/pearl accents + rose base (no hot pink). */
const HEART_SPARKLE_DOTS: Array<{ x: number; y: number; r: number; color: string; delay: number }> = [
  // Top-left lobe
  { x: 22, y: 16, r: 1.8, color: '#d4af37', delay: 0.0 },
  { x: 32, y: 8,  r: 1.4, color: '#f5e6d3', delay: 0.9 },
  // Top-right lobe
  { x: 68, y: 8,  r: 1.6, color: '#f5e6d3', delay: 0.4 },
  { x: 78, y: 16, r: 1.9, color: '#d4af37', delay: 1.3 },
  // Top notch
  { x: 50, y: 14, r: 1.3, color: '#ffffff', delay: 0.6 },
  // Left curve
  { x: 15, y: 34, r: 2.0, color: '#c9a961', delay: 0.2 },
  { x: 12, y: 50, r: 1.5, color: '#c81e5b', delay: 1.6 },
  // Right curve
  { x: 85, y: 34, r: 2.0, color: '#c9a961', delay: 1.0 },
  { x: 88, y: 50, r: 1.5, color: '#c81e5b', delay: 0.5 },
  // Lower body
  { x: 26, y: 66, r: 1.6, color: '#d4af37', delay: 1.1 },
  { x: 74, y: 66, r: 1.6, color: '#d4af37', delay: 0.3 },
  // Bottom tip
  { x: 50, y: 84, r: 2.1, color: '#c9a961', delay: 0.7 },
];

/** Global keyframes for the "Grand Love Card" effect stack:
 *  - heartbeat: the photo tim đập
 *  - ring1/ring2: concentric love waves radiating outward
 *  - blush: ambient pink halo pulsing behind the heart
 *  - float: small hearts drifting around
 *  - petal-fall: rose petals continuously drifting from top to bottom
 *  - shimmer: holographic gold sheen sweeping across the whole card
 *  - burst: mini firework of sparkles bursting from heart every ~3s
 *  - glow-cycle: card outer glow cycling pink → gold → violet
 *  - text-shimmer: gold gradient sweeping through the names text
 *
 *  Injected once per module via a shared <style> element that React 19
 *  hoists to <head>, so multiple cards share one CSS block. */
const HEART_KEYFRAMES = `
@keyframes gao-heart-beat {
  0%, 100% { transform: scale(1); }
  14%      { transform: scale(1.11); }
  28%      { transform: scale(0.97); }
  42%      { transform: scale(1.06); }
  70%      { transform: scale(1); }
}
@keyframes gao-heart-ring1 {
  0%   { transform: scale(1);    opacity: 0.55; }
  100% { transform: scale(1.35); opacity: 0; }
}
@keyframes gao-heart-ring2 {
  0%   { transform: scale(1);    opacity: 0.35; }
  100% { transform: scale(1.55); opacity: 0; }
}
@keyframes gao-heart-blush {
  0%, 100% { opacity: 0.75; transform: scale(1); }
  50%      { opacity: 1;    transform: scale(1.14); }
}
/* Individual sparkle-dot pulse for the particle-heart border. */
@keyframes gao-heart-dot-pulse {
  0%, 100% { transform: scale(1);   opacity: 1;   }
  50%      { transform: scale(0.55); opacity: 0.35; }
}
/* Whole-path pulse for the layered dashed heart outlines. */
@keyframes gao-heart-dots-glow {
  0%, 100% { opacity: 0.9; }
  50%      { opacity: 1;   }
}
/* Cosmic backdrop effects — star twinkles, nebula pulses, orbiting sparkles. */
@keyframes gao-star-twinkle {
  0%, 100% { opacity: var(--star-alpha, 0.8); transform: scale(1); }
  50%      { opacity: calc(var(--star-alpha, 0.8) * 0.25); transform: scale(0.55); }
}
@keyframes gao-nebula-pulse {
  0%, 100% { opacity: 0.55; transform: translate(0, 0) scale(1); }
  50%      { opacity: 0.85; transform: translate(2px, -1px) scale(1.12); }
}
@keyframes gao-cosmic-drift {
  0%   { transform: translate(0, 0) rotate(0deg); opacity: 0.6; }
  50%  { transform: translate(4px, -3px) rotate(180deg); opacity: 1; }
  100% { transform: translate(0, 0) rotate(360deg); opacity: 0.6; }
}
@keyframes gao-shooting-star {
  0%, 60% { opacity: 0; transform: translate(0, 0) rotate(-30deg); }
  62%     { opacity: 1; transform: translate(0, 0) rotate(-30deg); }
  75%     { opacity: 0.8; transform: translate(60px, -20px) rotate(-30deg); }
  80%, 100% { opacity: 0; transform: translate(70px, -24px) rotate(-30deg); }
}
@keyframes gao-heart-float {
  0%, 100% { transform: translateY(0)   rotate(-4deg); opacity: 0.6; }
  50%      { transform: translateY(-9px) rotate(8deg);  opacity: 1;   }
}
@keyframes gao-petal-fall {
  0%   { transform: translate(0, -20px) rotate(0deg);   opacity: 0; }
  8%   { opacity: 0.9; }
  50%  { transform: translate(14px, 100px) rotate(180deg); opacity: 0.9; }
  92%  { opacity: 0.8; }
  100% { transform: translate(-6px, 240px) rotate(360deg); opacity: 0; }
}
@keyframes gao-card-shimmer {
  0%, 40%  { transform: translateX(-140%) skewX(-20deg); }
  60%, 100% { transform: translateX(240%) skewX(-20deg); }
}
@keyframes gao-sparkle-burst {
  0%   { transform: translate(0, 0) scale(0);   opacity: 0; }
  15%  { transform: translate(calc(var(--sbx) * 0.3), calc(var(--sby) * 0.3)) scale(1.2); opacity: 1; }
  60%  { transform: translate(calc(var(--sbx) * 0.85), calc(var(--sby) * 0.85)) scale(0.9); opacity: 0.9; }
  100% { transform: translate(var(--sbx), var(--sby)) scale(0.2); opacity: 0; }
}
@keyframes gao-card-glow-cycle {
  0%, 100% {
    box-shadow:
      0 30px 70px -18px rgba(236,72,153,0.55),
      0 0 0 1px rgba(255,255,255,0.05) inset,
      0 24px 60px -20px rgba(0,0,0,0.35);
  }
  33% {
    box-shadow:
      0 30px 70px -18px rgba(251,191,36,0.5),
      0 0 0 1px rgba(255,255,255,0.06) inset,
      0 24px 60px -20px rgba(0,0,0,0.35);
  }
  66% {
    box-shadow:
      0 30px 70px -18px rgba(168,85,247,0.55),
      0 0 0 1px rgba(255,255,255,0.06) inset,
      0 24px 60px -20px rgba(0,0,0,0.35);
  }
}
@keyframes gao-name-glow {
  0%, 100% { text-shadow: 0 0 0 rgba(255,215,120,0); }
  50%      { text-shadow: 0 1px 8px rgba(255,215,120,0.65), 0 0 16px rgba(236,72,153,0.35); }
}
/* Proposal micro-scene — 8-second sequenced story that reads left-to-right
   like a mini movie. All actor animations share the same 8s duration so
   they stay in lockstep. Timing breakdown (rounded):
     0.00-2.00s  Waiting   — both stand, look at each other
     2.00-4.00s  Propose   — groom kneels + offers ring, "Marry me?" pops
     4.00-6.00s  Give ring — ring flies from groom's hand to bride's finger
     6.00-8.00s  Celebrate — bride shows ring, hearts burst, "YES!" pops   */
@keyframes gao-groom-kneel {
  0%, 22%   { transform: translateY(0)   rotate(0deg);  }
  27%       { transform: translateY(5px) rotate(-6deg); }   /* kneels */
  73%       { transform: translateY(5px) rotate(-6deg); }   /* stays kneeling through give-ring */
  78%, 100% { transform: translateY(0)   rotate(0deg);  }   /* stands up + tiny celebrate */
}
@keyframes gao-bride-react {
  0%, 22%   { transform: scale(1)    rotate(0deg); }
  30%       { transform: scale(1.06) rotate(-3deg); }        /* gasp */
  55%       { transform: scale(1.04) rotate(-2deg); }        /* watching ring approach */
  75%       { transform: scale(1.14) rotate(4deg);  }        /* joy */
  90%       { transform: scale(1.08) rotate(-2deg); }        /* wiggle */
  100%      { transform: scale(1)    rotate(0deg); }
}
@keyframes gao-ring-fly {
  0%, 22%   { transform: translate(0, 0)     rotate(0deg)   scale(1); }
  27%       { transform: translate(-14px, 4px)  rotate(-10deg) scale(1.05); }  /* into groom's hand */
  50%       { transform: translate(-14px, 4px)  rotate(-10deg) scale(1.05); }  /* wait through propose */
  55%       { transform: translate(-6px, -10px) rotate(60deg)  scale(1.15); }  /* arc up */
  60%       { transform: translate(2px, -14px)  rotate(140deg) scale(1.2);  }  /* apex */
  65%       { transform: translate(10px, -10px) rotate(220deg) scale(1.15); }
  72%       { transform: translate(15px, 4px)   rotate(340deg) scale(1.05); }  /* lands on bride's hand */
  75%, 100% { transform: translate(15px, 4px)   rotate(360deg) scale(1); }     /* sparkles on finger */
}
@keyframes gao-ring-glow-boost {
  0%, 72%  { filter: drop-shadow(0 0 4px rgba(255,215,120,0.4)); }
  75%      { filter: drop-shadow(0 0 14px rgba(255,215,120,1)) drop-shadow(0 0 20px rgba(236,72,153,0.7)); }
  100%     { filter: drop-shadow(0 0 4px rgba(255,215,120,0.4)); }
}
@keyframes gao-celebration-heart {
  0%, 68%  { opacity: 0; transform: translate(-50%, 6px) scale(0); }
  72%      { opacity: 1; transform: translate(-50%, 0)   scale(1); }
  100%     { opacity: 0; transform: translate(-50%, -30px) scale(0.4); }
}
@keyframes gao-propose-line-1 {
  0%, 24%   { opacity: 0; transform: translateY(4px); }
  28%       { opacity: 1; transform: translateY(0); }
  46%       { opacity: 1; transform: translateY(0); }
  50%, 100% { opacity: 0; transform: translateY(-2px); }
}
@keyframes gao-propose-line-2 {
  0%, 66%   { opacity: 0; transform: scale(0); }
  72%       { opacity: 1; transform: scale(1.25); }
  78%, 100% { opacity: 1; transform: scale(1); }
}

/* ─── Drone-shot layer — cinematic camera work over the actor layer ─── */
/* The "camera" pushes in during propose, orbits around during ring
   exchange, then pulls back with a slight tilt for the celebration wide
   shot. Uses perspective so the rotate3d reads as depth. */
@keyframes gao-drone-camera {
  0%   { transform: scale(0.94) rotate3d(1, 0.5, 0, 0deg); }
  22%  { transform: scale(1.02) rotate3d(0, 1, 0, 3deg); }        /* establishing */
  40%  { transform: scale(1.18) rotate3d(1, 0.5, 0, -4deg); }     /* dolly in on kneel */
  55%  { transform: scale(1.22) rotate3d(0, 1, 0, -8deg); }       /* orbit L for ring flight */
  65%  { transform: scale(1.22) rotate3d(0, 1, 0, 8deg); }        /* orbit R */
  73%  { transform: scale(1.28) rotate3d(0, 1, 0, 0deg); }        /* punch-in at landing */
  78%  { transform: scale(1.08) rotate3d(1, 0.4, 0, 3deg); }      /* pull back for wide shot */
  92%  { transform: scale(1.00) rotate3d(1, 0.4, 0, -2deg); }
  100% { transform: scale(0.94) rotate3d(1, 0.5, 0, 0deg); }
}
/* Camera flash — bright white overlay that pops at two beats:
     28% (proposal impact — she gasps) and 74% (ring lands, celebration). */
@keyframes gao-camera-flash {
  0%, 26%   { opacity: 0; }
  28%       { opacity: 0.9; }
  30%       { opacity: 0; }
  73%       { opacity: 0; }
  75%       { opacity: 0.95; }
  77%, 100% { opacity: 0; }
}
/* God-rays radiating from the ring during celebration. Two animations
   stacked: fade-in burst timing + a slow rotation for shimmer. */
@keyframes gao-ring-rays {
  0%, 68%   { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
  74%       { opacity: 0.85; transform: translate(-50%, -50%) scale(1.05); }
  85%       { opacity: 0.7;  transform: translate(-50%, -50%) scale(1.15); }
  100%      { opacity: 0;    transform: translate(-50%, -50%) scale(1.35); }
}
@keyframes gao-ring-rays-spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
/* Confetti fall — pieces drop from just above the scene during last 2s. */
@keyframes gao-confetti-fall {
  0%, 70%  { opacity: 0; transform: translateY(-14px) rotate(0deg); }
  73%      { opacity: 1; transform: translateY(0) rotate(90deg); }
  100%     { opacity: 0; transform: translateY(46px) rotate(540deg); }
}
/* Screen shake — quick jitter at ring landing (75%) to sell the impact. */
@keyframes gao-scene-shake {
  0%, 73%   { transform: translate(0, 0); }
  74%       { transform: translate(-1px, 1px); }
  75%       { transform: translate(2px, -1px); }
  76%       { transform: translate(-1px, -1px); }
  77%, 100% { transform: translate(0, 0); }
}
@media (prefers-reduced-motion: reduce) {
  [class*="gao-heart-"], [class*="gao-petal-"], [class*="gao-card-"],
  [class*="gao-sparkle-"], [class*="gao-name-"], [class*="gao-groom-"],
  [class*="gao-bride-"], [class*="gao-ring-"], [class*="gao-propose-"],
  [class*="gao-celebration-"], [class*="gao-drone-"],
  [class*="gao-camera-"], [class*="gao-confetti-"], [class*="gao-scene-"],
  [class*="gao-star-"], [class*="gao-nebula-"], [class*="gao-cosmic-"],
  [class*="gao-shooting-"] {
    animation: none !important;
  }
}
`;

// Direction vectors for the sparkle burst (8 particles in a circle).
const SPARKLE_DIRS: Array<{ dx: number; dy: number; delay: number; emoji: string; size: number }> = [
  { dx:  70, dy:   0, delay: 0.00, emoji: '✨', size: 12 },
  { dx:  50, dy: -50, delay: 0.12, emoji: '💖', size: 11 },
  { dx:   0, dy: -75, delay: 0.24, emoji: '✨', size: 13 },
  { dx: -50, dy: -50, delay: 0.06, emoji: '💗', size: 10 },
  { dx: -75, dy:   0, delay: 0.18, emoji: '✨', size: 11 },
  { dx: -55, dy:  55, delay: 0.30, emoji: '💕', size: 10 },
  { dx:   0, dy:  70, delay: 0.09, emoji: '✨', size: 12 },
  { dx:  55, dy:  55, delay: 0.21, emoji: '💖', size: 11 },
];

/** Starfield positions for the cosmic backdrop behind the heart photo.
 *  Positions are hand-tuned to sit around the edges + corners of the
 *  130x130 canvas so the central ~70x70 heart region stays clear. */
const COSMIC_STARS: Array<{ x: number; y: number; r: number; alpha: number; delay: number }> = [
  // Top edge
  { x: 12, y: 10,  r: 1.2, alpha: 0.85, delay: 0.0 },
  { x: 30, y: 6,   r: 0.7, alpha: 0.6,  delay: 0.6 },
  { x: 50, y: 12,  r: 1.4, alpha: 0.9,  delay: 1.2 },
  { x: 72, y: 5,   r: 0.9, alpha: 0.7,  delay: 0.3 },
  { x: 92, y: 14,  r: 1.1, alpha: 0.8,  delay: 1.8 },
  { x: 116, y: 8,  r: 1.5, alpha: 0.95, delay: 0.9 },
  // Left/right sides
  { x: 4,  y: 34,  r: 0.9, alpha: 0.7,  delay: 0.4 },
  { x: 122, y: 32, r: 1.2, alpha: 0.85, delay: 1.4 },
  { x: 6,  y: 58,  r: 1.3, alpha: 0.9,  delay: 0.7 },
  { x: 125, y: 62, r: 0.8, alpha: 0.65, delay: 1.6 },
  { x: 3,  y: 84,  r: 1.0, alpha: 0.75, delay: 1.1 },
  { x: 124, y: 88, r: 1.4, alpha: 0.9,  delay: 0.2 },
  // Bottom edge
  { x: 18, y: 108, r: 1.1, alpha: 0.8,  delay: 0.5 },
  { x: 42, y: 118, r: 0.9, alpha: 0.65, delay: 1.9 },
  { x: 66, y: 114, r: 1.5, alpha: 0.95, delay: 1.0 },
  { x: 88, y: 122, r: 0.8, alpha: 0.7,  delay: 0.8 },
  { x: 108, y: 116, r: 1.2, alpha: 0.85, delay: 1.5 },
];

/** Renders the cosmic backdrop: deep-space radial gradient + starfield +
 *  soft nebula wisps + optional shooting star. All child layers are
 *  absolutely positioned inside a rounded container so the effect reads
 *  as a "portal into space" around the heart photo. */
function CosmicBackdrop({ starId }: { starId: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: -8,
        borderRadius: 22,
        overflow: 'hidden',
        background:
          'radial-gradient(ellipse at 50% 50%, #1a0a3d 0%, #0a0525 45%, #05020f 100%)',
        boxShadow: '0 0 20px rgba(120,80,220,0.35), inset 0 0 30px rgba(0,0,0,0.5)',
      }}
    >
      {/* Nebula wisp — pink (top-left) */}
      <div
        style={{
          position: 'absolute',
          top: '-10%', left: '-15%',
          width: '65%', height: '65%',
          background:
            'radial-gradient(circle, rgba(236,72,153,0.55), rgba(236,72,153,0) 65%)',
          filter: 'blur(8px)',
          animation: 'gao-nebula-pulse 4.5s ease-in-out infinite',
        }}
      />
      {/* Nebula wisp — purple (bottom-right) */}
      <div
        style={{
          position: 'absolute',
          bottom: '-15%', right: '-15%',
          width: '70%', height: '70%',
          background:
            'radial-gradient(circle, rgba(168,85,247,0.5), rgba(168,85,247,0) 70%)',
          filter: 'blur(10px)',
          animation: 'gao-nebula-pulse 5.5s ease-in-out infinite 1.5s',
        }}
      />
      {/* Nebula wisp — cyan hint (right edge) */}
      <div
        style={{
          position: 'absolute',
          top: '30%', right: '-20%',
          width: '45%', height: '45%',
          background:
            'radial-gradient(circle, rgba(0,212,255,0.35), rgba(0,212,255,0) 70%)',
          filter: 'blur(12px)',
          animation: 'gao-nebula-pulse 6s ease-in-out infinite 2.5s',
        }}
      />

      {/* Starfield — SVG dots with individual twinkle animations */}
      <svg
        viewBox="0 0 130 130"
        width="100%" height="100%"
        style={{ position: 'absolute', inset: 0 }}
      >
        {COSMIC_STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.x} cy={s.y} r={s.r}
            fill="#ffffff"
            style={{
              transformOrigin: `${s.x}px ${s.y}px`,
              animation: `gao-star-twinkle ${2.2 + (i % 3) * 0.6}s ease-in-out infinite ${s.delay}s`,
              ['--star-alpha' as string]: String(s.alpha),
            } as React.CSSProperties}
          />
        ))}
        {/* A few 4-point sparkle stars for variety */}
        <g style={{ animation: 'gao-star-twinkle 3.6s ease-in-out infinite 0.4s' }}>
          <path
            d="M25,32 L26,30 L27,32 L29,33 L27,34 L26,36 L25,34 L23,33 Z"
            fill="#ffe0f0" opacity={0.9}
          />
        </g>
        <g style={{ animation: 'gao-star-twinkle 3.2s ease-in-out infinite 1.2s' }}>
          <path
            d="M105,45 L106.5,42 L108,45 L111,46.5 L108,48 L106.5,51 L105,48 L102,46.5 Z"
            fill="#c9b3ff" opacity={0.85}
          />
        </g>
        <g style={{ animation: 'gao-star-twinkle 2.8s ease-in-out infinite 2.0s' }}>
          <path
            d="M32,98 L33,96 L34,98 L36,99 L34,100 L33,102 L32,100 L30,99 Z"
            fill="#a0e8ff" opacity={0.9}
          />
        </g>
      </svg>

      {/* Shooting star — streaks across every 8s */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '20%', left: '15%',
          width: 22, height: 1.5,
          background: 'linear-gradient(90deg, transparent, #ffffff, #ffe0f0)',
          borderRadius: 1,
          opacity: 0,
          filter: 'drop-shadow(0 0 3px #ffffff)',
          animation: 'gao-shooting-star 8s ease-in-out infinite',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '70%', left: '10%',
          width: 18, height: 1.2,
          background: 'linear-gradient(90deg, transparent, #ffd6f0, #c9b3ff)',
          borderRadius: 1,
          opacity: 0,
          filter: 'drop-shadow(0 0 3px #ffd6f0)',
          animation: 'gao-shooting-star 11s ease-in-out infinite 5s',
        }}
      />
    </div>
  );
}

// Rose petals — assorted flowers falling in the background layer.
const PETAL_EMOJIS: Array<{ emoji: string; left: string; delay: number; duration: number; size: number }> = [
  { emoji: '🌸', left: '8%',   delay: 0.0, duration: 6.5, size: 14 },
  { emoji: '🌹', left: '20%',  delay: 1.8, duration: 7.5, size: 12 },
  { emoji: '🌷', left: '38%',  delay: 3.5, duration: 6.0, size: 13 },
  { emoji: '🌸', left: '58%',  delay: 5.0, duration: 7.0, size: 11 },
  { emoji: '🌺', left: '76%',  delay: 2.4, duration: 6.8, size: 14 },
  { emoji: '🌷', left: '90%',  delay: 4.2, duration: 7.2, size: 12 },
];

/** Radiating god-rays burst from the ring at the celebration beat.
 *  12 triangular rays around a center point, mixed with `screen` blend
 *  so they read like actual light on both light and dark palettes. */
function RingRaysBurst({ id, size = 78 }: { id: string; size?: number }) {
  const gradId = `ray-grad-${id}`;
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: size, height: size,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        animation: 'gao-ring-rays 8s ease-out infinite',
        opacity: 0,
      }}
    >
      <svg
        viewBox="-20 -20 40 40"
        width={size} height={size}
        style={{ animation: 'gao-ring-rays-spin 6s linear infinite' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe28a" stopOpacity="1" />
            <stop offset="0.6" stopColor="#ffd166" stopOpacity="0.7" />
            <stop offset="1" stopColor="#ffd166" stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: 12 }).map((_, i) => (
          <path
            key={i}
            d="M0,-2 L2.4,-18 L-2.4,-18 Z"
            fill={`url(#${gradId})`}
            transform={`rotate(${i * 30})`}
          />
        ))}
      </svg>
    </div>
  );
}

/** Illustrated chibi-style groom — flat SVG with head, hair, suit, bow
 *  tie. ~40x40 viewBox. Character body-parts sit inside a single <svg>
 *  so a parent animation (bob) transforms the whole figure as one. */
function GroomFigure({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden style={{ overflow: 'visible' }}>
      {/* Body (suit) */}
      <path d="M8,26 Q8,40 20,40 Q32,40 32,26 L27,23 L20,30 L13,23 Z" fill="#1a1a2e" />
      {/* Shirt V-neck */}
      <path d="M18,26 L20,32 L22,26 Z" fill="#ffffff" />
      {/* Bow tie */}
      <path d="M16,25 L20,27 L24,25 L23,28 L20,28 L17,28 Z" fill="#c41e3a" />
      <circle cx="20" cy="27" r="0.9" fill="#8b0f22" />
      {/* Head (skin) */}
      <circle cx="20" cy="14" r="9.5" fill="#f5c99a" />
      {/* Hair — combed swoop */}
      <path
        d="M10.5,10 Q20,3 29.5,10 Q31,13 29,14 Q22,10 14,14 Q9,13 10.5,10 Z"
        fill="#2a1810"
      />
      {/* Ears */}
      <ellipse cx="10.5" cy="15" rx="1.1" ry="1.6" fill="#e5b585" />
      <ellipse cx="29.5" cy="15" rx="1.1" ry="1.6" fill="#e5b585" />
      {/* Eyes */}
      <ellipse cx="16" cy="15" rx="1.2" ry="1.7" fill="#111" />
      <ellipse cx="24" cy="15" rx="1.2" ry="1.7" fill="#111" />
      {/* Eye highlights */}
      <circle cx="16.3" cy="14.6" r="0.35" fill="#fff" />
      <circle cx="24.3" cy="14.6" r="0.35" fill="#fff" />
      {/* Blush */}
      <circle cx="14" cy="18" r="1.6" fill="#ff9ab8" opacity="0.55" />
      <circle cx="26" cy="18" r="1.6" fill="#ff9ab8" opacity="0.55" />
      {/* Smile */}
      <path d="M17,19.5 Q20,21.5 23,19.5" stroke="#111" fill="none" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

/** Illustrated chibi-style bride — white gown, veil, hair, bouquet-ish
 *  neckline. Same 40x40 viewBox as GroomFigure so they align visually. */
function BrideFigure({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden style={{ overflow: 'visible' }}>
      {/* Veil (behind everything) — sheer white with soft blush edge */}
      <path
        d="M6,11 Q20,3 34,11 L34,34 Q20,28 6,34 Z"
        fill="rgba(255,255,255,0.7)"
        stroke="#f0c0e0"
        strokeWidth="0.5"
      />
      {/* Dress body */}
      <path d="M9,26 Q9,40 20,40 Q31,40 31,26 L27,24 L20,30 L13,24 Z" fill="#ffffff" />
      {/* Neckline pink hint */}
      <path d="M17,26 L20,30 L23,26" stroke="#e08cb0" strokeWidth="0.6" fill="rgba(255,220,240,0.5)" strokeLinejoin="round" />
      {/* Head (skin) */}
      <circle cx="20" cy="14" r="9.5" fill="#f5c99a" />
      {/* Hair — top waves */}
      <path
        d="M10.5,10 Q20,3 29.5,10 Q31,13 29,14 Q22,9 14,14 Q9,13 10.5,10 Z"
        fill="#4a2810"
      />
      {/* Hair — side curls */}
      <path d="M11,12 Q9,20 12,26" stroke="#4a2810" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M29,12 Q31,20 28,26" stroke="#4a2810" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* Veil crown decoration */}
      <circle cx="20" cy="5.5" r="1" fill="#f0c0e0" />
      <circle cx="17" cy="6.4" r="0.7" fill="#f0c0e0" />
      <circle cx="23" cy="6.4" r="0.7" fill="#f0c0e0" />
      {/* Ears */}
      <ellipse cx="10.5" cy="15" rx="1.1" ry="1.6" fill="#e5b585" />
      <ellipse cx="29.5" cy="15" rx="1.1" ry="1.6" fill="#e5b585" />
      {/* Eyes */}
      <ellipse cx="16" cy="15" rx="1.2" ry="1.7" fill="#111" />
      <ellipse cx="24" cy="15" rx="1.2" ry="1.7" fill="#111" />
      {/* Eyelashes */}
      <path d="M14.6,13.8 L15.4,13.4 M25.4,13.4 L24.6,13.8" stroke="#111" strokeWidth="0.5" strokeLinecap="round" />
      {/* Eye highlights */}
      <circle cx="16.3" cy="14.6" r="0.35" fill="#fff" />
      <circle cx="24.3" cy="14.6" r="0.35" fill="#fff" />
      {/* Blush stronger — she's the bride */}
      <circle cx="14" cy="18" r="1.9" fill="#ff9ab8" opacity="0.7" />
      <circle cx="26" cy="18" r="1.9" fill="#ff9ab8" opacity="0.7" />
      {/* Small heart-mouth smile */}
      <path d="M17,19.5 Q20,22 23,19.5" stroke="#c41e3a" fill="none" strokeWidth="0.9" strokeLinecap="round" />
      {/* Lipstick fill */}
      <path d="M17.4,19.7 Q20,21.4 22.6,19.7" fill="#ff6f8a" opacity="0.6" />
    </svg>
  );
}

type Props = {
  name1: string;
  name2: string;
  photoUrl: string | null;
  cardId: string;
  issueDate: string;   // YYYY-MM-DD
  expiryDate: string;  // YYYY-MM-DD
  /** Card style — 'classic' is the blue membership card from the mock;
   *  'noir' and 'rose' are alternate palettes. */
  variant?: 'classic' | 'noir' | 'rose';
  /** Optional "Our story" section — when `togetherSince` is set the card
   *  shows a live days counter under the ID; milestones render below. */
  togetherSince?: string | null;
  milestones?: Milestone[];
  /** Live days counter — parent computes and passes so the counter can
   *  update in real time without the card re-computing every second. */
  daysCount?: number | null;
};

const PALETTES: Record<NonNullable<Props['variant']>, {
  bg: string;
  headerColor: string;
  bodyColor: string;
  labelColor: string;
  border: string;
  photoBorder: string;
}> = {
  classic: {
    bg: 'linear-gradient(135deg, #f5f7fb 0%, #ffffff 50%, #e6ecf5 100%)',
    headerColor: '#1e3a8a',
    bodyColor: '#0f172a',
    labelColor: '#64748b',
    border: 'rgba(30,58,138,0.15)',
    photoBorder: 'rgba(30,58,138,0.2)',
  },
  noir: {
    bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f1e 100%)',
    headerColor: '#fbbf24',
    bodyColor: '#f8fafc',
    labelColor: '#94a3b8',
    border: 'rgba(251,191,36,0.25)',
    photoBorder: 'rgba(251,191,36,0.3)',
  },
  rose: {
    bg: 'linear-gradient(135deg, #fef2f4 0%, #ffffff 50%, #fce7ec 100%)',
    headerColor: '#be185d',
    bodyColor: '#4a1d3f',
    labelColor: '#9ca3af',
    border: 'rgba(190,24,93,0.15)',
    photoBorder: 'rgba(190,24,93,0.2)',
  },
};

function formatDate(iso: string): string {
  if (!iso) return '--/--/----';
  const [y, m, d] = iso.split('-');
  return `${m ?? '--'}/${d ?? '--'}/${y ?? '----'}`;
}

/** Auto-title-case a name — first letter of every word uppercased, rest
 *  left as typed. So "nt luong" → "Nt Luong", "MARY jane" → "MARY Jane".
 *  Handles Vietnamese diacritics via `\p{L}` character class. */
function titleCase(raw: string): string {
  return raw.replace(/(^|\s)(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Renders the couple membership card. Uses forwardRef so the parent
 *  can hand it to html2canvas for PNG export. Purposely built with plain
 *  HTML/CSS (not SVG) so avatars/photos rasterize without CORS trouble. */
export const CoupleIdCard = forwardRef<HTMLDivElement, Props>(function CoupleIdCard(
  {
    name1, name2, photoUrl, cardId, issueDate, expiryDate, variant = 'classic',
    togetherSince, milestones, daysCount,
  },
  ref,
) {
  const p = PALETTES[variant];
  const hasStory = !!togetherSince || (milestones && milestones.length > 0);
  const cardAspect = hasStory ? undefined : '1.586 / 1';
  const cardMinHeight = hasStory ? 340 : undefined;

  // Stable per-instance id — feeds RingRaysBurst so multiple cards on
  // one page don't collide on SVG gradient / clipPath references.
  const [uid] = useState(() => Math.random().toString(36).slice(2, 9));
  const clipId = `heart-clip-${uid}`;

  return (
    <div
      ref={ref}
      className="relative rounded-2xl select-none overflow-hidden"
      style={{
        width: 420,
        aspectRatio: cardAspect,
        minHeight: cardMinHeight,
        background: p.bg,
        border: `1px solid ${p.border}`,
        // Static premium drop-shadow — deep matte lift with a whisper of
        // gold rim. No more rainbow cycling (too playful for a premium
        // membership card).
        boxShadow:
          '0 30px 60px -20px rgba(0,0,0,0.55), ' +
          '0 12px 24px -12px rgba(0,0,0,0.35), ' +
          '0 0 0 1px rgba(212,175,55,0.18) inset, ' +
          '0 0 40px rgba(212,175,55,0.06)',
        padding: '18px 20px 16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: p.bodyColor,
      }}
    >
      {/* Global keyframes for the "Grand Love Card" effect stack. */}
      <style>{HEART_KEYFRAMES}</style>

      {/* Colorful rose petals removed for a premium restrained look —
          only the subtle gold foil sweep remains as ambient motion. */}

      {/* ── Subtle gold-foil sweep across the card ──────────────────────
          Metallic single-tone gold (no rainbow) so it reads as light
          catching foil, not as decoration. */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'none', overflow: 'hidden',
          mixBlendMode: 'soft-light',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-30%', bottom: '-30%',
            width: '22%',
            background:
              'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.35) 48%, rgba(255,240,180,0.5) 50%, rgba(212,175,55,0.35) 52%, transparent 100%)',
            animation: 'gao-card-shimmer 7s ease-in-out infinite',
          }}
        />
      </div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div
          className="text-[10px] font-semibold tracking-[0.14em]"
          style={{ color: p.headerColor }}
        >
          COUPLE MEMBERSHIP CARD
        </div>
        <span className="text-sm" style={{ color: p.headerColor }}>💕</span>
      </div>
      <div
        aria-hidden
        className="h-px w-full my-2.5"
        style={{ background: p.border }}
      />

      {/* Body — heart-shaped photo + names */}
      <div className="flex items-start gap-4">
        <div
          className="shrink-0 relative"
          style={{ width: 130, height: 122 }}
        >
          {/* Cosmic backdrop — deep-space gradient, starfield with
              twinkling dots + 4-point sparkle stars, three nebula wisps
              (pink / purple / cyan), and two shooting stars streaking
              across on staggered timers. Replaces the earlier flat pink
              blush glow so the heart photo now floats in a night sky. */}
          <CosmicBackdrop starId={uid} />

          {/* Beat-wave rings — 2 outer dashed heart outlines that expand
              + fade outward on each beat. Matched to the particle-heart
              style (dashed dots, not solid stroke) so the "love pulse"
              looks like scattering particles radiating outward. */}
          <svg
            viewBox="0 0 130 130"
            width={130}
            height={130}
            style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
          >
            <g style={{ transformOrigin: '65px 65px', animation: 'gao-heart-ring1 1.8s ease-out infinite' }}>
              <path
                d="M65,110 C58,102 12,68 12,38 C12,20 28,10 44,10 C55,10 65,22 65,25 C65,22 75,10 86,10 C102,10 118,20 118,38 C118,68 72,102 65,110 Z"
                fill="none" stroke="#d4af37" strokeWidth="1.4"
                strokeDasharray="0.6 3.5" strokeLinecap="round"
                opacity="0.6"
              />
            </g>
            <g style={{ transformOrigin: '65px 65px', animation: 'gao-heart-ring2 1.8s ease-out infinite 0.35s' }}>
              <path
                d="M65,110 C58,102 12,68 12,38 C12,20 28,10 44,10 C55,10 65,22 65,25 C65,22 75,10 86,10 C102,10 118,20 118,38 C118,68 72,102 65,110 Z"
                fill="none" stroke="#c9a961" strokeWidth="1.1"
                strokeDasharray="0.5 6" strokeLinecap="round"
                opacity="0.4"
              />
            </g>
          </svg>

          {/* The heart-clipped photo itself — beats via CSS transform */}
          <svg
            viewBox="0 0 100 100"
            width={110}
            height={110}
            style={{
              position: 'absolute',
              top: 6,
              left: 10,
              animation: 'gao-heart-beat 1.8s cubic-bezier(0.25, 0.8, 0.35, 1) infinite',
              transformOrigin: 'center 55%',
              filter: 'drop-shadow(0 4px 12px rgba(236,72,153,0.45))',
            }}
          >
            {/* Heart-shaped photo clip — same shape as the particle
                cluster so photo shows through the gaps between dots. */}
            <defs>
              <clipPath id={clipId}>
                <path d={HEART_PATH} />
              </clipPath>
            </defs>

            {/* Backing fill — very dark red so gaps between photo and
                particles don't show white. Photo overlays this. */}
            <path d={HEART_PATH} fill="#2a0510" />

            {/* The couple photo, clipped to the heart shape. */}
            {photoUrl ? (
              <image
                href={photoUrl}
                xlinkHref={photoUrl}
                x="0" y="0" width="100" height="100"
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#${clipId})`}
              />
            ) : (
              <text
                x="50" y="54"
                textAnchor="middle" dominantBaseline="middle"
                fontSize="30"
                clipPath={`url(#${clipId})`}
              >
                💑
              </text>
            )}

            {/* Subtle gold-rose tint over the photo — unifies the
                particle layer with the photo underneath. Warmer than
                pure red for a champagne-luxury feel. */}
            <path d={HEART_PATH} fill="rgba(180, 60, 90, 0.14)" />

            {/* Particle-cluster overlay — 100 red dots randomly seeded
                across the heart's interior (deterministic via mulberry32
                so every render matches). Sparse enough that photo shows
                through gaps, dense enough to read as a particle cloud.
                Each dot twinkles on its own clock; larger dots glow. */}
            {HEART_FILL_POINTS.map((p, i) => (
              <circle
                key={`fill-${i}`}
                cx={p.x} cy={p.y} r={p.r}
                fill={p.color}
                clipPath={`url(#${clipId})`}
                style={{
                  transformOrigin: `${p.x}px ${p.y}px`,
                  animation: `gao-heart-dot-pulse ${p.duration}s ease-in-out infinite ${p.delay}s`,
                  filter: p.hasGlow ? `drop-shadow(0 0 1.5px ${p.color})` : undefined,
                }}
              />
            ))}

            {/* ── Particle-cloud heart border — 3 layered dashed strokes
                on top of the interior fill give the outline crisp
                definition. Premium palette: gold + rose + pearl. */}
            {/* Layer 1: dense gold micro-dots along the perimeter */}
            <path
              d={HEART_PATH}
              fill="none"
              stroke="#d4af37"
              strokeWidth="2.0"
              strokeDasharray="0.5 2.4"
              strokeLinecap="round"
              style={{ animation: 'gao-heart-dots-glow 2.4s ease-in-out infinite' }}
            />
            {/* Layer 2: sparser rose accent dots */}
            <path
              d={HEART_PATH}
              fill="none"
              stroke="#c81e5b"
              strokeWidth="3.0"
              strokeDasharray="0.5 7"
              strokeDashoffset="1.5"
              strokeLinecap="round"
              opacity="0.75"
              style={{ animation: 'gao-heart-dots-glow 2.4s ease-in-out infinite 0.4s' }}
            />
            {/* Layer 3: soft pearl-white glow dots (blurred) */}
            <path
              d={HEART_PATH}
              fill="none"
              stroke="#f5e6d3"
              strokeWidth="4.5"
              strokeDasharray="0.5 12"
              strokeDashoffset="4"
              strokeLinecap="round"
              opacity="0.45"
              style={{
                animation: 'gao-heart-dots-glow 2.4s ease-in-out infinite 0.8s',
                filter: 'blur(0.7px)',
              }}
            />
            {/* Individual sparkle dots — each twinkles on its own rhythm
                for organic particle-cloud life. */}
            {HEART_SPARKLE_DOTS.map((d, i) => (
              <circle
                key={i}
                cx={d.x} cy={d.y} r={d.r}
                fill={d.color}
                style={{
                  transformOrigin: `${d.x}px ${d.y}px`,
                  animation: `gao-heart-dot-pulse ${1.6 + (i % 4) * 0.3}s ease-in-out infinite ${d.delay}s`,
                  filter: `drop-shadow(0 0 2px ${d.color})`,
                }}
              />
            ))}
          </svg>

          {/* Floating small hearts — different sizes, staggered animations */}
          <span
            aria-hidden
            style={{
              position: 'absolute', top: -2, right: -2, fontSize: 12,
              animation: 'gao-heart-float 2.4s ease-in-out infinite',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
            }}
          >❤️</span>
          <span
            aria-hidden
            style={{
              position: 'absolute', bottom: 6, left: -4, fontSize: 10,
              animation: 'gao-heart-float 2.4s ease-in-out infinite 0.7s',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
            }}
          >💗</span>
          <span
            aria-hidden
            style={{
              position: 'absolute', top: 22, left: -6, fontSize: 8,
              animation: 'gao-heart-float 2.4s ease-in-out infinite 1.4s',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
            }}
          >💕</span>

          {/* ── Sparkle burst — 8 particles launching outward from the
              heart center in a radial pattern. Each has its own direction
              vector (via CSS variables) but shares one keyframe. Repeats
              every 2.6s so it lines up with two heartbeats. */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: '52%', left: '50%',
              width: 0, height: 0,
              pointerEvents: 'none',
            }}
          >
            {SPARKLE_DIRS.map((s, i) => (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  top: 0, left: 0,
                  fontSize: s.size,
                  transform: 'translate(-50%, -50%)',
                  animation: `gao-sparkle-burst 2.6s ease-out infinite ${s.delay}s`,
                  // Custom properties consumed by the burst keyframe
                  ['--sbx' as string]: `${s.dx}px`,
                  ['--sby' as string]: `${s.dy}px`,
                } as React.CSSProperties}
              >
                {s.emoji}
              </span>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0" style={{ position: 'relative' }}>
          <div
            className="text-[9px] font-semibold tracking-[0.14em] mb-2"
            style={{ color: p.labelColor }}
          >
            NAME / PARTNER
          </div>
          {/* Both names on one line — auto title-cased with an accent-
              coloured ampersand between them. Truncates with ellipsis if
              the combined length exceeds the card width (which happens
              for very long name pairs — expected for ID-card format). */}
          <div
            className="text-[18px] font-bold leading-tight truncate"
            style={{
              color: p.bodyColor,
              animation: 'gao-name-glow 2.6s ease-in-out infinite',
            }}
          >
            {name1 ? titleCase(name1) : 'Your name'}
            <span
              style={{
                color: p.headerColor,
                fontWeight: 500,
                margin: '0 6px',
                opacity: 0.75,
              }}
            >
              &
            </span>
            {name2 ? titleCase(name2) : 'Partner name'}
          </div>

          {/* "WE ARE COUPLE" tagline — premium serif treatment with
              hairline gold divider dots on each side, replacing the
              earlier pink hearts. Solid gold, tight tracking, no
              distracting flanking icons. */}
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingLeft: 2,
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 20, height: 1,
                background: 'linear-gradient(90deg, transparent, #d4af37)',
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.42em',
                color: '#d4af37',
                fontFamily: 'Georgia, "Playfair Display", serif',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                textShadow: '0 0 12px rgba(212,175,55,0.35)',
              }}
            >
              we are couple
            </span>
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 20, height: 1,
                background: 'linear-gradient(90deg, #d4af37, transparent)',
              }}
            />
          </div>
        </div>{/* end names column */}
      </div>{/* end body flex row (photo + names) */}

      {/* Our story — optional strip when togetherSince or milestones set.
          Sits between the header/photo block and the footer. */}
      {hasStory && (
        <div
          className="mt-3 pt-3"
          style={{ borderTop: `1px solid ${p.border}` }}
        >
          {togetherSince && daysCount != null && (
            <div className="flex items-baseline gap-2 mb-2">
              <span
                className="text-[9px] font-semibold tracking-[0.14em]"
                style={{ color: p.labelColor }}
              >
                TOGETHER FOR
              </span>
              <span className="text-[15px] font-bold tabular-nums" style={{ color: p.headerColor }}>
                {daysCount.toLocaleString()} days
              </span>
              <span className="text-[9px]" style={{ color: p.labelColor }}>
                since {formatDate(togetherSince)}
              </span>
            </div>
          )}

          {milestones && milestones.length > 0 && (
            <div className="grid gap-1.5">
              {milestones.slice(0, 4).map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span className="text-[13px] leading-none">{m.emoji || '✨'}</span>
                  <span
                    className="tabular-nums font-semibold"
                    style={{ color: p.headerColor, minWidth: 68 }}
                  >
                    {formatDate(m.date)}
                  </span>
                  <span className="truncate" style={{ color: p.bodyColor }}>
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer — ID + dates. When story strip is present the footer is
          inline (not absolute) so the card can grow. */}
      <div
        className={`${hasStory ? 'mt-3 pt-3' : 'absolute left-5 right-5 bottom-3'} flex items-end justify-between`}
        style={hasStory ? { borderTop: `1px solid ${p.border}` } : undefined}
      >
        <div>
          <div
            className="text-[7px] font-semibold tracking-[0.14em]"
            style={{ color: p.labelColor }}
          >
            ID:
          </div>
          <div className="text-[13px] font-bold tabular-nums tracking-[0.05em]">
            {cardId}
          </div>
        </div>
        <div className="text-right">
          <div className="flex gap-4 text-[7px] font-semibold tracking-[0.14em] justify-end" style={{ color: p.labelColor }}>
            <span>ISSUE:</span>
            <span>EXPIRY:</span>
          </div>
          <div className="flex gap-4 text-[10px] font-bold tabular-nums justify-end mt-0.5">
            <span>{formatDate(issueDate)}</span>
            <span>{formatDate(expiryDate)}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
