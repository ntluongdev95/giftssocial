'use client';

// Midnight Countdown — a genuine two-phase build (no longer the
// PlaceholderReveal scaffold):
//
//   Phase 1  A big glowing countdown, 10 → 1, ticking over a quiet
//            midnight skyline.
//   Phase 2  The moment it hits zero: fireworks fill the whole sky
//            (looping, not a one-off) while "HAPPY NEW YEAR / 2026"
//            forms as an actual drone-light point cloud overhead
//            (blue/white, same technique Village Arrival's sky text
//            uses) + the recipient's name, then a tap-to-reveal note.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getKissString, parseKissData } from '../_shared/useTemplateData';
import type { TemplateProps, TemplateConfig } from '../_types';

// The countdown number displayed below the descending ball.
const countdownDigitStyle: CSSProperties = {
  fontFamily: "'Playfair Display', Georgia, serif",
  fontWeight: 900,
  fontSize: 'clamp(52px, 13vw, 76px)',
  lineHeight: 1,
  color: '#fde68a',
  textShadow: '0 0 20px rgba(251,191,36,0.7), 0 4px 14px rgba(0,0,0,0.5)',
};

const COUNTDOWN_START = 10;
const TICK_MS = 1150;
const HEADLINE_DOT_COUNT = 5200;

type Pt = { x: number; y: number; color?: string; group?: number };

// ─────────────────────────────────────────────────────────────────────
// "HAPPY NEW YEAR" / "2027" as a drone-light formation — sampled WORD
// BY WORD (not the whole headline at once) so each point can be
// tagged with which word it belongs to. The RAF engine below uses
// that tag to stagger each word's arrival, so the show reads as
// "HAPPY" assembling, then "NEW", then "YEAR", then "2027" — a real
// sequential drone-show build instead of everything snapping in at
// once. Same alpha-sampling technique as Fireplace's sky text,
// blue/white instead of gold to match an actual drone LED colour.
// ─────────────────────────────────────────────────────────────────────
function sampleHeadlineComposite(words1: string[], word2: string): Pt[] {
  if (typeof document === 'undefined') return [];
  const W = 1800, H = 1100;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  const stride = 3;
  const pts: Pt[] = [];

  const sampleGroup = (group: number, palette: 'blue' | 'gold') => {
    const { data } = ctx.getImageData(0, 0, W, H);
    for (let y = 0; y < H; y += stride) {
      for (let x = 0; x < W; x += stride) {
        if (data[(y * W + x) * 4 + 3] > 128) {
          const nx = (x / W - 0.5) * 2;
          const ny = (y / H - 0.5) * 2;
          const m = (x + y) % 7;
          const color = palette === 'gold'
            ? (m < 3 ? '#fde68a' : m < 6 ? '#fbbf24' : '#f59e0b')
            : (m < 3 ? '#fff' : m < 6 ? '#93c5fd' : '#3b82f6');
          pts.push({ x: nx, y: ny, color, group });
        }
      }
    }
  };

  // Line 1 — shrink the whole phrase to fit as one line, then draw +
  // sample each word separately (clearing between words so groups
  // don't bleed into each other's pixel scan).
  let size1 = Math.round(H * 0.145);
  const gap1 = () => size1 * 0.32;
  const measure1 = () => {
    ctx.font = `800 ${size1}px "Inter", "Segoe UI", sans-serif`;
    const widths = words1.map(w => ctx.measureText(w).width);
    const total = widths.reduce((a, b) => a + b, 0) + gap1() * (words1.length - 1);
    return { widths, total };
  };
  let { widths: widths1, total: total1 } = measure1();
  while (total1 > W * 0.92 && size1 > 20) {
    size1 -= 4;
    ({ widths: widths1, total: total1 } = measure1());
  }
  ctx.textAlign = 'left';
  let cursorX = W / 2 - total1 / 2;
  const y1 = H * 0.14;
  words1.forEach((word, i) => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillText(word, cursorX, y1);
    sampleGroup(i, 'blue');
    cursorX += widths1[i] + gap1();
  });

  // Line 2 — the year, one big group after all of line 1, gold like a
  // real drone show's "hero" numerals.
  let size2 = Math.round(H * 0.30);
  ctx.font = `800 ${size2}px "Inter", "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  while (ctx.measureText(word2).width > W * 0.72 && size2 > 20) {
    size2 -= 4;
    ctx.font = `800 ${size2}px "Inter", "Segoe UI", sans-serif`;
  }
  ctx.clearRect(0, 0, W, H);
  ctx.fillText(word2, W / 2, H * 0.40);
  sampleGroup(words1.length, 'gold');

  // Line 3 — a champagne bottle popping + clinking glasses, the
  // celebratory flourish that arrives last, after the year itself.
  const size3 = Math.round(H * 0.30);
  ctx.font = `${size3}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.clearRect(0, 0, W, H);
  ctx.fillText('🍾', W * 0.38, H * 0.75);
  ctx.fillText('🥂', W * 0.63, H * 0.75);
  sampleGroup(words1.length + 1, 'gold');

  return pts;
}

function packToCount(pts: Pt[], n: number): Pt[] {
  if (pts.length === 0) return [];
  if (pts.length >= n) {
    const stride = pts.length / n;
    return Array.from({ length: n }).map((_, i) => pts[Math.floor(i * stride)]);
  }
  return Array.from({ length: n }).map((_, i) => pts[i % pts.length]);
}

function NewyearCountdownReveal({ kiss, onClose }: TemplateProps) {
  const rawName = (getKissString(kiss, 'name') || kiss.receiver_name || '').trim();
  const photos: string[] = (() => {
    const raw = parseKissData(kiss).photos;
    if (Array.isArray(raw)) {
      const list = raw.filter((u): u is string => typeof u === 'string' && !!u);
      if (list.length > 0) return list.slice(0, 2);
    }
    const single = getKissString(kiss, 'photo');
    return single ? [single] : [];
  })();

  const [count, setCount] = useState(COUNTDOWN_START);
  const isFinalStage = count === 0;
  const [showNote, setShowNote] = useState(false);
  const [messageSeen, setMessageSeen] = useState(false);
  const openMessage = () => { setShowNote(true); setMessageSeen(true); };

  useEffect(() => {
    if (count <= 0) return;
    const t = window.setTimeout(() => setCount(c => c - 1), TICK_MS);
    return () => window.clearTimeout(t);
  }, [count]);

  // Auto-close a while after the fireworks start — but only once the
  // note (if there is one) has actually been read.
  useEffect(() => {
    if (!isFinalStage) return;
    if (kiss.message && !messageSeen) return;
    const t = window.setTimeout(() => onClose?.(), 11000);
    return () => window.clearTimeout(t);
  }, [isFinalStage, kiss.message, messageSeen, onClose]);

  const stars = useMemo(() => (
    Array.from({ length: 70 }).map((_, i) => {
      const s = ((i + 100) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      return {
        left: r(1) * 100, top: r(2) * 55, size: 1 + r(3) * 2.2,
        opacity: 0.4 + r(4) * 0.55, dur: 3 + r(5) * 4, delay: r(6) * 6,
      };
    })
  ), []);

  // Soft out-of-focus bokeh — distant city-light glow drifting slowly,
  // so the countdown screen has some depth/atmosphere instead of
  // being an empty gradient behind the number.
  const bokehOrbs = useMemo(() => (
    Array.from({ length: 7 }).map((_, i) => {
      const s = ((i + 600) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      const colors = ['#fbbf24', '#60a5fa', '#f9a8d4', '#fde68a'];
      return {
        left: r(1) * 100, top: r(2) * 70, size: 40 + r(3) * 90,
        color: colors[i % colors.length], opacity: 0.08 + r(4) * 0.1,
        dur: 8 + r(5) * 6, delay: r(6) * 4, dx: (r(7) - 0.5) * 40,
      };
    })
  ), []);

  // Fine glittery sparkle drifting down throughout the countdown —
  // gives the scene some movement/life beyond the static ring+number.
  const countdownSparkle = useMemo(() => (
    Array.from({ length: 34 }).map((_, i) => {
      const s = ((i + 700) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      return {
        left: r(1) * 100, size: 2 + r(2) * 3, delay: r(3) * 8,
        dur: 7 + r(4) * 6, sway: (r(5) - 0.5) * 50, opacity: 0.4 + r(6) * 0.5,
      };
    })
  ), []);

  // Fireworks that fill the whole sky once the countdown hits zero —
  // each on its own randomized loop period so the show reads as
  // continuous and organic, not one synced burst repeating in unison.
  const fireworks = useMemo(() => {
    const COLORS = ['#f87171', '#fbbf24', '#a78bfa', '#60a5fa', '#f9a8d4', '#4ade80', '#fde047'];
    const TYPES = ['peony', 'peony', 'crackle', 'peony', 'crackle', 'willow'] as const;
    return Array.from({ length: 11 }).map((_, i) => {
      const s = ((i + 900) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      const period = 2.8 + r(1) * 2.4;
      const scale = 0.7 + r(7) * 0.7;
      return {
        x: 6 + r(2) * 88,
        y: 6 + r(3) * 46,
        delay: r(4) * period,
        period,
        color: COLORS[i % COLORS.length],
        particles: Math.round((12 + Math.floor(r(5) * 8)) * scale),
        scale,
        type: TYPES[i % TYPES.length],
      };
    });
  }, []);
  const ROCKET_MS = 0.6;

  // A denser, Shanghai-style skyline — a couple of tall spire-topped
  // "hero" towers standing out above a busy row of ordinary
  // buildings, viewBox 0 0 100 36 (taller than before to fit them).
  const SKYLINE_VIEW_H = 36;
  const skylineTowers = useMemo(() => (
    [2, 9, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 95].map((left, i) => {
      const s = ((i + 300) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      const isHero = i === 4 || i === 9;
      const height = isHero ? 25 + r(1) * 9 : 12 + r(1) * 15;
      const width = 4.5 + r(2) * 3.2;
      const rows = Math.max(3, Math.round(height / 3.2));
      const cols = width > 6.5 ? 3 : 2;
      return { left, height, width, isHero, rows, cols };
    })
  ), []);

  // Every individual window, flattened — each carries its own light-up
  // delay, scattered RANDOMLY across the whole reveal window rather
  // than sweeping building-by-building left to right. Reads as the
  // city waking up window by window, unpredictably, like popcorn —
  // not a mechanical left-to-right sequence.
  const CITY_LIGHT_UP_S = 5;
  const skylineWindows = useMemo(() => (
    skylineTowers.flatMap((t, ti) => {
      const s = ((ti + 500) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      const winSize = t.width * 0.16;
      const baseY = SKYLINE_VIEW_H - t.height;
      const out: { x: number; y: number; size: number; color: string; delay: number }[] = [];
      for (let row = 0; row < t.rows; row++) {
        const fy = (row + 0.5) / t.rows;
        for (let col = 0; col < t.cols; col++) {
          const fx = (col + 0.5) / t.cols;
          const ri = row * t.cols + col;
          out.push({
            x: t.left + t.width * fx - winSize / 2,
            y: baseY + t.height * fy - winSize / 2,
            size: winSize,
            color: r(ri + 1) > 0.7 ? '#fbbf24' : '#fde68a',
            delay: r(ri + 2) * CITY_LIGHT_UP_S,
          });
        }
      }
      return out;
    })
  ), [skylineTowers]);

  // The "HAPPY NEW YEAR / 2026" drone-light headline — sampled once,
  // rendered by its own canvas once the fireworks stage starts.
  const headlinePoints = useMemo(() => packToCount(sampleHeadlineComposite(['HAPPY', 'NEW', 'YEAR'], '2027'), HEADLINE_DOT_COUNT), []);
  const headlineCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isFinalStage || typeof window === 'undefined' || !headlineCanvasRef.current) return;
    const canvas = headlineCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || headlinePoints.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = W / 2, cy = H / 2;
    // Fit the ACTUAL sampled bounding box to the canvas, not
    // Math.min(W,H) — that formula assumes roughly-square content
    // (fine for the sleigh/gift box) but a wide two-line headline has
    // an nx range far bigger than its ny range, so it was overflowing
    // past the canvas edges on a short/wide display box and getting
    // clipped left+right.
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of headlinePoints) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const spanX = Math.max(0.01, maxX - minX);
    const spanY = Math.max(0.01, maxY - minY);
    const scale = Math.min(W / spanX, H / spanY) * 0.97;
    const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
    const MORPH_MS = 1100;
    const GROUP_STAGGER_MS = 550;
    const startTime = performance.now();
    // Each "drone" starts scattered out around the formation (not at
    // its letter position) and flies in to assemble the text — reads
    // as an actual drone show arriving, not text just fading in. Words
    // arrive in sequence (HAPPY → NEW → YEAR → 2027), each one's
    // drones staggered by `group` so the whole headline visibly BUILDS
    // rather than snapping in all at once; a little extra per-dot
    // randomness (0–250ms) keeps each word's own arrival organic
    // instead of one rigid block.
    const dots = headlinePoints.map(p => {
      const targetX = cx + (p.x - midX) * scale, targetY = cy + (p.y - midY) * scale;
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.min(W, H) * (0.9 + Math.random() * 1.1);
      return {
        targetX, targetY,
        fromX: cx + Math.cos(angle) * dist,
        fromY: cy + Math.sin(angle) * dist * 0.7 - H * 0.25,
        x: 0, y: 0,
        color: p.color || '#fff',
        size: 1.4 + Math.random() * 1.4,
        twinkle: Math.random() * Math.PI * 2,
        delay: (p.group ?? 0) * GROUP_STAGGER_MS + Math.random() * 250,
      };
    });

    let raf = 0;
    const draw = (now: number) => {
      // Full clear every frame — a partial destination-out fade
      // accumulates brightness on a held (non-moving) shape until it
      // washes out into an illegible glowing blob (found + fixed the
      // same bug in Village Arrival's sky text).
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const d of dots) {
        const elapsed = Math.max(0, now - startTime - d.delay);
        const t = Math.min(1, elapsed / MORPH_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        d.x = d.fromX + (d.targetX - d.fromX) * eased;
        d.y = d.fromY + (d.targetY - d.fromY) * eased;

        // Trail while still flying in — a couple of fainter echoes
        // behind the current position, same as a fast-moving light.
        if (t < 1) {
          ctx.fillStyle = d.color;
          ctx.globalAlpha = 0.18;
          ctx.beginPath();
          ctx.arc(d.fromX + (d.targetX - d.fromX) * Math.max(0, eased - 0.08), d.fromY + (d.targetY - d.fromY) * Math.max(0, eased - 0.08), d.size, 0, Math.PI * 2);
          ctx.fill();
        }

        const tw = t < 1 ? 1 : 0.85 + 0.25 * Math.sin(now / 260 + d.twinkle);
        ctx.fillStyle = d.color;
        ctx.globalAlpha = Math.min(1, tw);
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size * tw, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [isFinalStage, headlinePoints]);

  return (
    <div
      className="fixed inset-0 z-200 overflow-hidden select-none"
      style={{ background: 'linear-gradient(180deg, #000000 0%, #060512 55%, #120a24 100%)', fontFamily: "'Playfair Display', Georgia, serif" }}
      onClick={() => {
        if (!isFinalStage) return;
        if (kiss.message && !messageSeen) return;
        onClose?.();
      }}
    >
      {/* ── STARS + MOON ── */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
        {stars.map((s, i) => (
          <motion.div
            key={`star-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size,
              background: '#fff', boxShadow: `0 0 ${s.size * 2}px rgba(255,255,255,0.5)`,
            }}
            animate={{ opacity: [s.opacity * 0.3, s.opacity, s.opacity * 0.3] }}
            transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* ── Ambient bokeh + drifting sparkle — atmosphere behind the
             countdown so it doesn't read as an empty gradient with a
             number floating on it. ── */}
      {!isFinalStage && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
          {bokehOrbs.map((b, i) => (
            <motion.div
              key={`bokeh-${i}`}
              className="absolute rounded-full"
              style={{
                left: `${b.left}%`, top: `${b.top}%`, width: b.size, height: b.size,
                background: b.color, opacity: b.opacity, filter: 'blur(18px)',
              }}
              animate={{ x: [0, b.dx, 0], y: [0, -b.dx * 0.6, 0] }}
              transition={{ duration: b.dur, delay: b.delay, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}
          {countdownSparkle.map((f, i) => (
            <motion.div
              key={`sparkle-${i}`}
              className="absolute rounded-full"
              style={{ left: `${f.left}%`, top: '-4%', width: f.size, height: f.size, background: '#fde68a', boxShadow: '0 0 6px rgba(253,230,138,0.8)', opacity: f.opacity }}
              initial={{ y: 0, x: 0 }}
              animate={{ y: '108vh', x: [0, f.sway, -f.sway, 0] }}
              transition={{ duration: f.dur, delay: f.delay, repeat: Infinity, ease: 'linear' }}
            />
          ))}
        </div>
      )}

      {/* ── SKYLINE — a dense, Shanghai-style city of dark towers,
             completely unlit while the countdown is still running.
             The instant it hits zero, windows pop on in RANDOM
             scattered order across the whole city over ~5s (not a
             mechanical left-to-right building sweep) — the city
             waking up unpredictably at midnight, right as the
             fireworks + drone show start. ── */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ zIndex: 2, height: '32%' }}>
        <svg viewBox={`0 0 100 ${SKYLINE_VIEW_H}`} preserveAspectRatio="none" width="100%" height="100%" style={{ display: 'block' }}>
          {skylineTowers.map((t, i) => (
            <g key={i} fill="#0b0a18">
              <rect x={t.left} y={SKYLINE_VIEW_H - t.height} width={t.width} height={t.height} />
              {t.isHero && (
                <polygon
                  points={`${t.left + t.width * 0.5},${SKYLINE_VIEW_H - t.height - t.width * 1.6} ${t.left + t.width * 0.32},${SKYLINE_VIEW_H - t.height} ${t.left + t.width * 0.68},${SKYLINE_VIEW_H - t.height}`}
                />
              )}
            </g>
          ))}
          {skylineWindows.map((w, i) => (
            <motion.rect
              key={i}
              x={w.x} y={w.y} width={w.size} height={w.size}
              fill={w.color}
              initial={{ opacity: 0 }}
              animate={isFinalStage ? { opacity: [0, 1, 0.85] } : { opacity: 0 }}
              transition={{
                duration: isFinalStage ? 0.6 : 0.3,
                delay: isFinalStage ? w.delay : 0,
                times: isFinalStage ? [0, 0.35, 1] : undefined,
                ease: 'easeOut',
              }}
            />
          ))}
        </svg>
      </div>

      {/* ── COUNTDOWN — Phase 1 — a Times Square-style crystal ball,
             descending down a lit tower as the count runs out, landing
             at the base right as it hits zero. ── */}
      {!isFinalStage && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 5 }}>
          <div style={{ position: 'relative', width: 'clamp(140px, 34vw, 200px)', height: 'clamp(380px, 62vh, 520px)' }}>
            {/* the tower/track */}
            <div
              className="absolute"
              style={{ left: '50%', top: '4%', bottom: '20%', width: 5, background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.24))', transform: 'translateX(-50%)', borderRadius: 3 }}
            />
            {/* rung lights — light up as the ball passes each one */}
            {Array.from({ length: COUNTDOWN_START }).map((_, k) => {
              const frac = k / (COUNTDOWN_START - 1);
              const lit = count <= COUNTDOWN_START - k;
              return (
                <motion.div
                  key={k}
                  className="absolute rounded-full"
                  style={{ left: '50%', top: `${4 + frac * 76}%`, width: 9, height: 9, marginLeft: -4.5, marginTop: -4.5 }}
                  animate={{
                    background: lit ? '#fde68a' : 'rgba(255,255,255,0.15)',
                    boxShadow: lit ? '0 0 10px rgba(251,191,36,0.85)' : '0 0 0px rgba(251,191,36,0)',
                  }}
                  transition={{ duration: 0.3 }}
                />
              );
            })}

            {/* base plinth */}
            <div
              className="absolute rounded"
              style={{ left: '50%', top: '80%', width: 34, height: 8, marginLeft: -17, background: 'linear-gradient(180deg, #3a3a44, #111)' }}
            />

            {/* the descending crystal ball */}
            <motion.div
              className="absolute"
              style={{ left: '50%', marginLeft: -32 }}
              animate={{ top: `${4 + (1 - count / COUNTDOWN_START) * 76}%` }}
              transition={{ duration: TICK_MS / 1000, ease: 'linear' }}
            >
              <div style={{ position: 'relative', width: 64, height: 64, transform: 'translateY(-50%)' }}>
                {/* upward trail, since it's sliding down */}
                <div
                  className="absolute rounded-full"
                  style={{ left: '50%', bottom: 30, width: 14, height: 120, marginLeft: -7, background: 'linear-gradient(180deg, transparent, rgba(251,191,36,0.35))', filter: 'blur(3px)' }}
                />
                {/* flash on every tick */}
                <motion.div
                  key={`ball-flash-${count}`}
                  className="absolute inset-0 rounded-full"
                  style={{ background: '#fff' }}
                  initial={{ opacity: 0.6, scale: 1.3 }}
                  animate={{ opacity: 0, scale: 1.7 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
                {/* the ball itself — faceted crystal look */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'radial-gradient(circle at 32% 28%, #fff 0%, #fde68a 30%, #f59e0b 65%, #b45309 100%)',
                    boxShadow: '0 0 30px 10px rgba(251,191,36,0.55), 0 10px 24px rgba(0,0,0,0.5)',
                  }}
                >
                  <motion.div
                    className="absolute rounded-full"
                    style={{ left: 14, top: 12, width: 10, height: 10, background: 'rgba(255,255,255,0.9)', filter: 'blur(1px)' }}
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.div
                    className="absolute rounded-full"
                    style={{ left: 40, top: 34, width: 5, height: 5, background: 'rgba(255,255,255,0.7)' }}
                    animate={{ opacity: [0.3, 0.9, 0.3] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                  />
                  <motion.div
                    className="absolute rounded-full"
                    style={{ left: 22, top: 42, width: 4, height: 4, background: 'rgba(255,255,255,0.6)' }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                  />
                </div>
              </div>
            </motion.div>

            {/* the number, fixed below the tower */}
            <div className="absolute inset-x-0" style={{ top: '84%', textAlign: 'center' }}>
              <AnimatePresence mode="wait">
                <motion.span
                  key={count}
                  className="inline-block"
                  initial={{ scale: 0.5, opacity: 0, y: -6 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 1.2, opacity: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  style={countdownDigitStyle}
                >
                  {count}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {/* ── PHOTO MARQUEE — uploaded photos scroll continuously across
             the top of the screen, like a ticker banner, so they stay
             visible the whole finale instead of hiding inside the note
             until tapped. The strip is the photo list repeated 4x,
             sliding left by exactly one copy's width on a seamless
             loop. ── */}
      {isFinalStage && photos.length > 0 && (
        <div
          className="absolute inset-x-0 overflow-hidden pointer-events-none"
          style={{ top: '9%', height: 56, zIndex: 7 }}
        >
          <motion.div
            className="flex items-center"
            style={{ width: 'max-content' }}
            animate={{ x: ['0%', '-25%'] }}
            transition={{ duration: photos.length * 6, repeat: Infinity, ease: 'linear' }}
          >
            {[...photos, ...photos, ...photos, ...photos].map((url, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-lg"
                style={{ width: 44, height: 44, marginRight: 14, border: '2px solid rgba(251,191,36,0.6)', boxShadow: '0 0 12px rgba(251,191,36,0.35)', flexShrink: 0 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="size-full object-cover" draggable={false} />
              </div>
            ))}
          </motion.div>
        </div>
      )}

      {/* ── TEXT MARQUEE — a second ticker line just below the photos,
             running the OPPOSITE direction (right-to-left vs the
             photos' left-to-right... i.e. reversed from each other) so
             the two lines don't read as one flat strip. ── */}
      {isFinalStage && (
        <div
          className="absolute inset-x-0 overflow-hidden pointer-events-none"
          style={{ top: 'calc(9% + 64px)', height: 30, zIndex: 7 }}
        >
          <motion.div
            className="flex items-center whitespace-nowrap"
            style={{ width: 'max-content' }}
            animate={{ x: ['-25%', '0%'] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <span
                key={i}
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontStyle: 'italic',
                  fontSize: 20, color: '#fde68a', textShadow: '0 0 10px rgba(251,191,36,0.6)', marginRight: 18,
                }}
              >
                {rawName || 'New Year'} ❤️ I Love You&nbsp;&nbsp;•
              </span>
            ))}
          </motion.div>
        </div>
      )}

      {/* ── FIREWORKS + HAPPY NEW YEAR — Phase 2 ── */}
      {isFinalStage && (
        <>
          {fireworks.map((fw, i) => {
            const groundVh = 98 - fw.y;
            const burstDelay = fw.delay + ROCKET_MS;
            const flashSize = 6 * fw.scale;
            const isWillow = fw.type === 'willow';
            const isCrackle = fw.type === 'crackle';
            const burstDuration = isWillow ? 1.7 : 1;
            return (
              <div key={i} className="absolute pointer-events-none" style={{ left: `${fw.x}%`, top: `${fw.y}%`, zIndex: 4 }}>
                {/* rocket launching up from near the ground, with a
                    short fading trail behind it, before it bursts */}
                <motion.div
                  className="absolute rounded-full"
                  style={{ width: 3, height: 3, marginLeft: -1.5, marginTop: -1.5, background: '#fff', boxShadow: `0 0 6px ${fw.color}` }}
                  initial={{ y: `${groundVh}vh`, opacity: 0 }}
                  animate={{ y: [`${groundVh}vh`, '0vh'], opacity: [0, 1, 1] }}
                  transition={{ duration: ROCKET_MS, delay: fw.delay, repeat: Infinity, repeatDelay: fw.period - ROCKET_MS, ease: 'easeOut' }}
                />
                {[0.05, 0.1, 0.16].map((lag, li) => (
                  <motion.div
                    key={`trail-${li}`}
                    className="absolute rounded-full"
                    style={{ width: 2, height: 2, marginLeft: -1, marginTop: -1, background: fw.color, opacity: 0.4 - li * 0.1 }}
                    initial={{ y: `${groundVh}vh`, opacity: 0 }}
                    animate={{ y: [`${groundVh}vh`, '0vh'], opacity: [0, 0.4 - li * 0.1, 0] }}
                    transition={{ duration: ROCKET_MS, delay: fw.delay + lag, repeat: Infinity, repeatDelay: fw.period - ROCKET_MS, ease: 'easeOut' }}
                  />
                ))}

                {/* main burst flash */}
                <motion.div
                  className="absolute rounded-full"
                  style={{ width: flashSize, height: flashSize, marginLeft: -flashSize / 2, marginTop: -flashSize / 2, background: fw.color, boxShadow: `0 0 ${26 * fw.scale}px ${12 * fw.scale}px ${fw.color}` }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0, 3, 0] }}
                  transition={{ duration: 0.55, delay: burstDelay, repeat: Infinity, repeatDelay: fw.period - 0.55, ease: 'easeOut' }}
                />
                {Array.from({ length: fw.particles }).map((_, j) => {
                  const angle = (j / fw.particles) * Math.PI * 2;
                  const dist = (isWillow ? 46 + (j % 3) * 20 : 60 + (j % 3) * 24) * fw.scale;
                  const fallOffset = isWillow ? 90 : 30;
                  return (
                    <motion.div
                      key={j}
                      className="absolute rounded-full"
                      style={{ width: 4 * fw.scale, height: 4 * fw.scale, marginLeft: -2 * fw.scale, marginTop: -2 * fw.scale, background: fw.color, boxShadow: `0 0 5px ${fw.color}` }}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                      animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist + fallOffset, opacity: 0, scale: 0.4 }}
                      transition={{ duration: burstDuration, delay: burstDelay, repeat: Infinity, repeatDelay: fw.period - burstDuration, ease: isWillow ? 'easeIn' : 'easeOut' }}
                    />
                  );
                })}

                {/* crackle — a second, smaller ring popping a beat after
                    the first, like real double-report shells */}
                {isCrackle && Array.from({ length: Math.round(fw.particles * 0.6) }).map((_, j) => {
                  const n = Math.round(fw.particles * 0.6);
                  const angle = (j / n) * Math.PI * 2 + 0.3;
                  const dist = 30 * fw.scale;
                  const crackleDelay = burstDelay + 0.16;
                  return (
                    <motion.div
                      key={`crackle-${j}`}
                      className="absolute rounded-full"
                      style={{ width: 3, height: 3, marginLeft: -1.5, marginTop: -1.5, background: '#fff', boxShadow: `0 0 4px ${fw.color}` }}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                      animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist + 16, opacity: 0, scale: 0.3 }}
                      transition={{ duration: 0.5, delay: crackleDelay, repeat: Infinity, repeatDelay: fw.period - 0.5, ease: 'easeOut' }}
                    />
                  );
                })}
              </div>
            );
          })}

          <motion.div
            className="absolute inset-x-0 flex flex-col items-center pointer-events-none"
            style={{ top: '20%', zIndex: 6 }}
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <canvas
              ref={headlineCanvasRef}
              style={{ width: '98vw', maxWidth: 760, height: 'clamp(270px, 66vw, 470px)', display: 'block' }}
            />
          </motion.div>

          {!showNote && (
            <motion.div
              className="absolute inset-x-0 flex flex-col items-center pointer-events-none"
              style={{ top: '61%', zIndex: 12 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 1 }}
            >
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); openMessage(); }}
                className="pointer-events-auto cursor-pointer flex flex-col items-center"
                aria-label="Tap to open"
              >
                {/* fingerprint-scanner style tap indicator — a pulsing
                    scan ring behind a fingerprint glyph, instead of a
                    plain text pill */}
                <div style={{ position: 'relative', width: 58, height: 58 }}>
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ border: '2px solid rgba(251,191,36,0.65)' }}
                    animate={{ scale: [1, 1.45, 1], opacity: [0.75, 0, 0.75] }}
                    transition={{ duration: 1.7, repeat: Infinity, ease: 'easeOut' }}
                  />
                  <div
                    className="absolute inset-0 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(251,191,36,0.55)', backdropFilter: 'blur(4px)' }}
                  >
                    <span style={{ fontSize: 26 }}>🫆</span>
                  </div>
                </div>
                <span
                  className="mt-2 rounded-full"
                  style={{
                    padding: '4px 14px', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
                    fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'italic', fontSize: 13,
                    color: 'rgba(255,255,255,0.85)',
                  }}
                >
                  Tap to open
                </span>
              </button>
            </motion.div>
          )}
        </>
      )}

      {/* ── Note ── */}
      <AnimatePresence>
        {showNote && kiss.message && (
          <motion.div
            className="fixed inset-0 z-300 flex items-center justify-center px-6 cursor-pointer"
            style={{ background: 'rgba(4,2,20,0.9)' }}
            onClick={(e) => { e.stopPropagation(); setShowNote(false); }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="relative w-full max-w-sm overflow-hidden rounded-2xl px-7 pb-9 pt-7 text-center"
              style={{
                background: 'linear-gradient(160deg, #241a4a 0%, #3b1f6b 100%)',
                border: '1px solid rgba(251,191,36,0.35)',
                boxShadow: '0 30px 70px rgba(0,0,0,0.6), 0 0 50px rgba(251,191,36,0.18)',
              }}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* gold top ribbon */}
              <div
                className="absolute inset-x-0 top-0"
                style={{ height: 5, background: 'linear-gradient(90deg, #f59e0b, #fde68a, #93c5fd, #f59e0b)' }}
              />
              {/* corner sparkles */}
              <motion.span
                className="absolute"
                style={{ top: 14, left: 16, fontSize: 16 }}
                animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.15, 0.9] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                ✨
              </motion.span>
              <motion.span
                className="absolute"
                style={{ top: 14, right: 16, fontSize: 16 }}
                animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.15, 0.9] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
              >
                🎉
              </motion.span>

              <div
                className="mb-4 text-center"
                style={{
                  fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.25em', textTransform: 'uppercase', color: '#fde68a',
                }}
              >
                🎆 Happy New Year
              </div>

              {photos.length > 0 && (
                <div className="mb-4 flex justify-center" style={{ gap: photos.length > 1 ? 4 : 0 }}>
                  {photos.map((url, i) => (
                    <div
                      key={i}
                      className="overflow-hidden rounded-sm"
                      style={{
                        width: photos.length > 1 ? 104 : 132,
                        padding: photos.length > 1 ? '6px 6px 16px' : '8px 8px 20px',
                        background: '#fdfbf5',
                        boxShadow: '0 10px 22px rgba(0,0,0,0.4)',
                        transform: `rotate(${i === 0 ? -4 : 4}deg)`,
                        zIndex: photos.length > 1 && i === 0 ? 1 : 0,
                        marginRight: photos.length > 1 && i === 0 ? -14 : 0,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full aspect-square object-cover" draggable={false} />
                    </div>
                  ))}
                </div>
              )}
              <p className="italic" style={{ fontSize: 'clamp(16px, 3vw, 20px)', color: '#fde68a', lineHeight: 1.6 }}>
                &ldquo;{kiss.message}&rdquo;
              </p>
              {kiss.sender_name && (
                <>
                  <div style={{ margin: '16px auto 0', width: 60, height: 1, background: 'rgba(251,191,36,0.4)' }} />
                  <div style={{ marginTop: 12, fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fbbf24' }}>
                    — {kiss.sender_name}
                  </div>
                </>
              )}
              <div className="mt-6 text-xs" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: "'Inter', sans-serif" }}>
                Tap to close
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NewyearCountdownReveal;

export const NewyearCountdownConfig: TemplateConfig = {
  id: 'newyear-countdown',
  name: 'Midnight Countdown',
  occasionIds: ['tet'],
  emoji: '🎆',
  description: 'A glowing countdown from 10, then fireworks fill the whole sky at midnight.',
  thumbnailBg: 'linear-gradient(135deg, #1e1b4b, #eab308)',
  Component: NewyearCountdownReveal,
};
