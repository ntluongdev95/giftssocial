'use client';

// Mai & Đào Blossoms → rebuilt as a 5-phase fireworks + drone show
// (no longer the PlaceholderReveal scaffold):
//
//   Phase 0  The sky alone fills with fireworks — red, gold, orange —
//            before anything else appears.
//   Phase 1  A drone-light formation flies in from scattered points
//            and assembles into "CHÚC MỪNG NĂM MỚI".
//   Phase 2  The SAME formation morphs — not a new entrance, an
//            in-place transformation — into the zodiac animal of the
//            coming Tết (the Goat, Tết 2027), running. Tap it any time
//            from here on to open the note.
//   Phase 3  The goat morphs one more time into a drone-fireworks
//            burst, and a couple silhouette fades in beneath it,
//            watching — the finale.
//   Phase 4  "Xin xăm" — a traditional Tết fortune-stick draw. Tap the
//            tube to shake it; a fortune tile slides out with a
//            traditional New Year blessing. After it's held a moment,
//            the whole show loops back to Phase 1's greeting rather
//            than staying frozen — it keeps playing until the viewer
//            taps to open the note or the overall auto-close timer
//            (anchored once, at mount — not restarted by the loop)
//            ends the reveal.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getKissString, parseKissData } from '../_shared/useTemplateData';
import type { TemplateProps, TemplateConfig } from '../_types';

const FIREWORKS_ONLY_MS = 2600;
const GREETING_HOLD_MS = 4500;
const GOAT_HOLD_MS = 4200;
const FINALE_HOLD_MS = 5000;
const XAM_RESULT_HOLD_MS = 4200;
const TOTAL_AUTO_CLOSE_MS = 34000;
const DRONE_DOT_COUNT = 3600;
const DRONE_MORPH_MS = 1300;

const XAM_FORTUNES = [
  'Vạn sự như ý, tỷ sự như mơ',
  'An khang thịnh vượng, phú quý cát tường',
  'Tấn tài tấn lộc, tấn bình an',
  'Xuân sang phúc lộc đầy nhà',
  'Tình duyên như ý, gia đạo an khang',
  'Công thành danh toại, sự nghiệp hanh thông',
  'Sức khỏe dồi dào, vạn sự hanh thông',
  'Cung hỷ phát tài, niên niên hữu dư',
];

type Pt = { x: number; y: number; color?: string };

// ─────────────────────────────────────────────────────────────────────
// "CHÚC MỪNG NĂM MỚI" — two centered lines sampled together into one
// point cloud, gold/amber (a drone show's warm "hero" colour), same
// alpha-sampling technique used throughout the other Christmas/New
// Year templates.
// ─────────────────────────────────────────────────────────────────────
function sampleGreetingComposite(line1: string, line2: string): Pt[] {
  if (typeof document === 'undefined') return [];
  const W = 1600, H = 700;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let size1 = Math.round(H * 0.28);
  ctx.font = `800 ${size1}px "Inter", "Segoe UI", sans-serif`;
  while (ctx.measureText(line1).width > W * 0.9 && size1 > 20) {
    size1 -= 4;
    ctx.font = `800 ${size1}px "Inter", "Segoe UI", sans-serif`;
  }
  ctx.fillText(line1, W / 2, H * 0.32);

  let size2 = size1;
  ctx.font = `800 ${size2}px "Inter", "Segoe UI", sans-serif`;
  while (ctx.measureText(line2).width > W * 0.9 && size2 > 20) {
    size2 -= 4;
    ctx.font = `800 ${size2}px "Inter", "Segoe UI", sans-serif`;
  }
  ctx.fillText(line2, W / 2, H * 0.68);

  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: Pt[] = [];
  const stride = 3;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        const nx = (x / W - 0.5) * 2;
        const ny = (y / H - 0.5) * 2;
        const m = (x + y) % 7;
        const color = m < 3 ? '#fde68a' : m < 6 ? '#fbbf24' : '#f97316';
        pts.push({ x: nx, y: ny, color });
      }
    }
  }
  return pts;
}

// ─────────────────────────────────────────────────────────────────────
// The zodiac animal of the coming Tết (Goat — Tết 2027), sampled from
// the 🐐 emoji itself, same warm gold palette as the greeting so the
// morph between the two reads as one continuous formation.
// ─────────────────────────────────────────────────────────────────────
function sampleZodiacComposite(): Pt[] {
  if (typeof document === 'undefined') return [];
  const W = 900, H = 900;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.floor(H * 0.75)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.fillText('🐐', W / 2, H / 2);

  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: Pt[] = [];
  const stride = 3;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        const nx = (x / W - 0.5) * 2;
        const ny = (y / H - 0.5) * 2;
        const m = (x + y) % 7;
        const color = m < 3 ? '#fde68a' : m < 6 ? '#fbbf24' : '#f97316';
        pts.push({ x: nx, y: ny, color });
      }
    }
  }
  return pts;
}

// ─────────────────────────────────────────────────────────────────────
// The finale — the SAME formation morphs one more time, off the goat
// and into a drone-fireworks burst, right before the couple silhouette
// appears beneath it. Generated procedurally (radiating spokes from a
// bright core) rather than sampled from an emoji glyph — an emoji-font
// approach was tried first and found unreliable: 🎆 rendered as a
// missing-glyph box in some environments instead of an actual firework
// shape (verified via screenshot), so this can't depend on font
// coverage the way the text/goat glyphs safely could.
// ─────────────────────────────────────────────────────────────────────
function sampleFireworkDroneComposite(): Pt[] {
  const pts: Pt[] = [];
  const seed = 777;
  const r = (n: number) => (((seed ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;

  const SPOKES = 20;
  const PTS_PER_SPOKE = 34;
  for (let s = 0; s < SPOKES; s++) {
    const jitterA = (r(s * 3 + 1) - 0.5) * 0.12;
    const angle = (s / SPOKES) * Math.PI * 2 + jitterA;
    const spokeLen = 0.55 + r(s * 3 + 2) * 0.4;
    const spokeColor = s % 3 === 0 ? '#fff8e1' : s % 3 === 1 ? '#fde68a' : '#f97316';
    for (let p = 0; p < PTS_PER_SPOKE; p++) {
      const t = p / (PTS_PER_SPOKE - 1);
      const dist = t * spokeLen;
      const wobble = (r(s * 97 + p * 7 + 3) - 0.5) * (0.02 + t * 0.05);
      const px = Math.cos(angle) * dist + Math.cos(angle + Math.PI / 2) * wobble;
      const py = Math.sin(angle) * dist + Math.sin(angle + Math.PI / 2) * wobble;
      // outer third of each spoke reads as the brighter trailing tip
      const color = t > 0.7 ? '#fff8e1' : spokeColor;
      pts.push({ x: px, y: py, color });
    }
  }

  // bright dense core at the burst's center
  const CORE = 90;
  for (let i = 0; i < CORE; i++) {
    const a = r(i * 11 + 500) * Math.PI * 2;
    const d = r(i * 13 + 600) * 0.12;
    pts.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, color: '#fff8e1' });
  }

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

function TetMaiDaoReveal({ kiss, onClose }: TemplateProps) {
  const rawName = (getKissString(kiss, 'name') || kiss.receiver_name || '').trim();
  // The sender's own written blessing for the xin-xăm fortune tile —
  // falls back to the built-in random list when left blank.
  const customXamText = getKissString(kiss, 'xamText').trim();
  const photos: string[] = (() => {
    const raw = parseKissData(kiss).photos;
    if (Array.isArray(raw)) {
      const list = raw.filter((u): u is string => typeof u === 'string' && !!u);
      if (list.length > 0) return list.slice(0, 2);
    }
    const single = getKissString(kiss, 'photo');
    return single ? [single] : [];
  })();

  // phase 0 = fireworks alone · 1 = drone forms the greeting ·
  // 2 = drone has morphed into the running zodiac goat ·
  // 3 = goat morphs into a drone-fireworks burst + couple silhouette ·
  // 4 = "xin xăm" fortune-stick draw
  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0);
  const isGoatStage = phase === 2;
  const isFinaleStage = phase === 3;
  const isXamStage = phase === 4;
  const [showNote, setShowNote] = useState(false);
  const [messageSeen, setMessageSeen] = useState(false);
  const openMessage = () => { setShowNote(true); setMessageSeen(true); };
  const [xamShaking, setXamShaking] = useState(false);
  const [xamResult, setXamResult] = useState<string | null>(null);
  // Tap-to-open only shows up once the fortune has been drawn — not the
  // instant the xin-xăm scene appears, so shaking the tube comes first.
  const canInteract = isXamStage && xamResult !== null;
  const drawXam = () => {
    if (xamShaking || xamResult) return;
    setXamShaking(true);
    window.setTimeout(() => {
      setXamShaking(false);
      setXamResult(customXamText || XAM_FORTUNES[Math.floor(Math.random() * XAM_FORTUNES.length)]);
    }, 1100);
  };

  useEffect(() => {
    const t = window.setTimeout(() => setPhase(1), FIREWORKS_ONLY_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== 1) return;
    const t = window.setTimeout(() => setPhase(2), GREETING_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 2) return;
    const t = window.setTimeout(() => setPhase(3), GOAT_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 3) return;
    const t = window.setTimeout(() => setPhase(4), FINALE_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Once a fortune has been drawn and held a moment, loop the whole
  // show back to the greeting instead of freezing on xin xăm forever.
  useEffect(() => {
    if (!xamResult) return;
    const t = window.setTimeout(() => {
      setXamResult(null);
      setXamShaking(false);
      setPhase(1);
    }, XAM_RESULT_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [xamResult]);

  // Auto-close is anchored ONCE at mount, not restarted by the loop —
  // otherwise a viewer who keeps looping would never see it close.
  const mountTimeRef = useRef<number | null>(null);
  useEffect(() => { mountTimeRef.current = performance.now(); }, []);
  useEffect(() => {
    if (kiss.message && !messageSeen) return;
    const elapsed = mountTimeRef.current != null ? performance.now() - mountTimeRef.current : 0;
    const remaining = Math.max(4000, TOTAL_AUTO_CLOSE_MS - elapsed);
    const t = window.setTimeout(() => onClose?.(), remaining);
    return () => window.clearTimeout(t);
  }, [kiss.message, messageSeen, onClose]);

  const stars = useMemo(() => (
    Array.from({ length: 50 }).map((_, i) => {
      const s = ((i + 100) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      return {
        left: r(1) * 100, top: r(2) * 55, size: 1 + r(3) * 2,
        opacity: 0.3 + r(4) * 0.5, dur: 3 + r(5) * 4, delay: r(6) * 6,
      };
    })
  ), []);

  // Fireworks — red/gold/orange, filling the sky the instant the
  // reveal opens (not gated behind a countdown this time).
  const fireworks = useMemo(() => {
    const COLORS = ['#ef4444', '#fbbf24', '#f97316', '#fde047', '#dc2626', '#fff', '#fb923c'];
    const TYPES = ['peony', 'peony', 'crackle', 'peony', 'willow', 'crackle'] as const;
    return Array.from({ length: 11 }).map((_, i) => {
      const s = ((i + 900) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      const period = 2.6 + r(1) * 2.2;
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

  // The greeting → zodiac → fireworks-burst point-cloud trio, sampled
  // once. Same formation, three in-place morphs.
  const dronePointSets = useMemo(() => ([
    packToCount(sampleGreetingComposite('CHÚC MỪNG', 'NĂM MỚI 2027'), DRONE_DOT_COUNT),
    packToCount(sampleZodiacComposite(), DRONE_DOT_COUNT),
    packToCount(sampleFireworkDroneComposite(), DRONE_DOT_COUNT),
  ]), []);
  const droneCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const reflectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const droneStage = (isFinaleStage || isXamStage) ? 2 : isGoatStage ? 1 : 0;
  const droneStageRef = useRef(droneStage);
  useEffect(() => { droneStageRef.current = droneStage; }, [droneStage]);
  // Mount/run this effect once the drone canvas first appears — not on
  // every later phase change, or the morph would reset to a fresh
  // scattered entrance instead of tweening smoothly from the greeting
  // into the zodiac shape.
  const droneActive = phase >= 1;

  useEffect(() => {
    if (!droneActive || typeof window === 'undefined' || !droneCanvasRef.current) return;
    const canvas = droneCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || dronePointSets[0].length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // "Night river" reflection — a second canvas, same size, mirrored
    // vertically and dimmed, sitting just below the formation like
    // water reflecting the lights above it.
    const reflCanvas = reflectionCanvasRef.current;
    const reflCtx = reflCanvas?.getContext('2d') ?? null;
    if (reflCanvas && reflCtx) {
      reflCanvas.width = W * dpr;
      reflCanvas.height = H * dpr;
      reflCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const cx = W / 2, cy = H / 2;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const set of dronePointSets) {
      for (const p of set) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    }
    const spanX = Math.max(0.01, maxX - minX);
    const spanY = Math.max(0.01, maxY - minY);
    const scale = Math.min(W / spanX, H / spanY) * 0.94;
    const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;

    type Dot = {
      x: number; y: number; fromX: number; fromY: number;
      color: string; size: number; twinkle: number; morphStart: number; delay: number;
    };
    const initial = dronePointSets[0];
    const dots: Dot[] = initial.map(p => {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.min(W, H) * (0.9 + Math.random() * 1.1);
      const scatterX = cx + Math.cos(angle) * dist;
      const scatterY = cy + Math.sin(angle) * dist * 0.7 - H * 0.25;
      return {
        x: scatterX, y: scatterY, fromX: scatterX, fromY: scatterY,
        color: p.color || '#fde68a', size: 1.3 + Math.random() * 1.3,
        twinkle: Math.random() * Math.PI * 2, delay: Math.random() * 350,
        morphStart: performance.now(),
      };
    });

    let currentStage = 0;
    let lastRenderStage = -1;
    let raf = 0;
    // The firework-burst stage (2) doesn't just hold its shape once
    // formed — it keeps exploding outward from its own center on a
    // repeating cycle, fading as it flies out, like a real firework
    // that bursts, fades, and bursts again.
    const BURST_PULSE_MS = 1900;
    const BURST_EXPAND = 1.55;
    const burstOriginX = cx + (0 - midX) * scale;
    const burstOriginY = cy + (0 - midY) * scale;
    const t0 = performance.now();
    const draw = (now: number) => {
      if (currentStage !== lastRenderStage) {
        for (let i = 0; i < dots.length; i++) {
          dots[i].fromX = dots[i].x;
          dots[i].fromY = dots[i].y;
          dots[i].morphStart = now;
          const np = dronePointSets[currentStage][i];
          if (np?.color) dots[i].color = np.color;
        }
        lastRenderStage = currentStage;
      }

      // Full clear every frame — a partial fade accumulates brightness
      // on a held shape until it washes out illegible (bug found +
      // fixed the same way in Village Arrival / Midnight Countdown's
      // own drone text).
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      const targetSet = dronePointSets[currentStage];
      const isBurstStage = currentStage === 2;
      const pulseT = isBurstStage ? ((now - t0) % BURST_PULSE_MS) / BURST_PULSE_MS : 0;
      const expandScale = 1 + pulseT * BURST_EXPAND;
      const pulseFade = isBurstStage ? Math.max(0, 1 - pulseT * 1.1) : 1;
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const tp = targetSet[i];
        let tx = cx + (tp.x - midX) * scale, ty = cy + (tp.y - midY) * scale;
        const elapsed = Math.max(0, now - d.morphStart - d.delay);
        const t = Math.min(1, elapsed / DRONE_MORPH_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        // Once the burst has fully morphed in, layer the continuous
        // outward explosion on top of its resting position.
        if (isBurstStage && t >= 1) {
          tx = burstOriginX + (tx - burstOriginX) * expandScale;
          ty = burstOriginY + (ty - burstOriginY) * expandScale;
        }
        d.x = d.fromX + (tx - d.fromX) * eased;
        d.y = d.fromY + (ty - d.fromY) * eased;

        const tw = 0.85 + 0.25 * Math.sin(now / 260 + d.twinkle);
        ctx.fillStyle = d.color;
        ctx.globalAlpha = Math.min(1, tw) * (t >= 1 ? pulseFade : 1);
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size * tw, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // The reflection — same dots, Y flipped about the top edge (so
      // it reads as continuing straight down into "water"), dimmer.
      // Softening is done via a CSS `filter: blur()` on the <canvas>
      // element itself (one GPU compositing pass per frame), NOT
      // ctx.filter here — a per-context canvas filter applied across
      // ~3600 individual arc()+fill() calls collapsed this to ~4fps
      // (measured), vs a clean 60fps with the CSS-element blur.
      if (reflCtx) {
        reflCtx.clearRect(0, 0, W, H);
        reflCtx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < dots.length; i++) {
          const d = dots[i];
          const ry = H - d.y; // mirror about the shared edge between the two canvases
          const tw = 0.85 + 0.25 * Math.sin(now / 260 + d.twinkle);
          reflCtx.fillStyle = d.color;
          reflCtx.globalAlpha = Math.min(1, tw) * 0.3;
          reflCtx.beginPath();
          reflCtx.arc(d.x, ry, d.size * tw, 0, Math.PI * 2);
          reflCtx.fill();
        }
        reflCtx.globalAlpha = 1;
        reflCtx.globalCompositeOperation = 'source-over';
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const syncInterval = window.setInterval(() => { currentStage = droneStageRef.current; }, 100);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(syncInterval);
    };
  }, [droneActive, dronePointSets]);

  return (
    <div
      className="fixed inset-0 z-200 overflow-hidden select-none"
      style={{ background: 'linear-gradient(180deg, #050103 0%, #0d0305 45%, #200608 75%, #3a0a0a 100%)', fontFamily: "'Playfair Display', Georgia, serif" }}
      onClick={() => {
        if (!canInteract) return;
        if (kiss.message && !messageSeen) return;
        onClose?.();
      }}
    >
      {/* ── STARS ── */}
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

      {/* ── FIREWORKS — fill the sky from the very start ── */}
      {fireworks.map((fw, i) => {
        const groundVh = 98 - fw.y;
        const burstDelay = fw.delay + ROCKET_MS;
        const flashSize = 6 * fw.scale;
        const isWillow = fw.type === 'willow';
        const isCrackle = fw.type === 'crackle';
        const burstDuration = isWillow ? 1.7 : 1;
        return (
          <div key={i} className="absolute pointer-events-none" style={{ left: `${fw.x}%`, top: `${fw.y}%`, zIndex: 2 }}>
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

      {/* ── TOP MARQUEE — two ticker lines running opposite directions
             across the otherwise-empty top strip, visible from the very
             start: a fixed New Year greeting on top, the recipient's
             name scrolling the other way just below it. ── */}
      <div
        className="absolute inset-x-0 overflow-hidden pointer-events-none"
        style={{ top: '4%', height: 26, zIndex: 3 }}
      >
        <motion.div
          className="flex items-center whitespace-nowrap"
          style={{ width: 'max-content' }}
          animate={{ x: ['0%', '-25%'] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              style={{
                fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700,
                fontSize: 17, color: '#fde68a', textShadow: '0 0 10px rgba(251,191,36,0.6)', marginRight: 22,
              }}
            >
              🧧 May mắn · An khang · Thịnh vượng&nbsp;&nbsp;•
            </span>
          ))}
        </motion.div>
      </div>
      <div
        className="absolute inset-x-0 overflow-hidden pointer-events-none"
        style={{ top: 'calc(4% + 28px)', height: 24, zIndex: 3 }}
      >
        <motion.div
          className="flex items-center whitespace-nowrap"
          style={{ width: 'max-content' }}
          animate={{ x: ['-25%', '0%'] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'linear' }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              style={{
                fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontStyle: 'italic',
                fontSize: 15, color: 'rgba(255,255,255,0.85)', textShadow: '0 0 8px rgba(255,255,255,0.4)', marginRight: 18,
              }}
            >
              {rawName || 'Người nhận đặc biệt'} ❤️&nbsp;&nbsp;•
            </span>
          ))}
        </motion.div>
      </div>

      {/* ── DRONE FORMATION — greeting, then morphs into the zodiac.
             Once it's the goat, the whole formation gets a galloping
             bob + speed-lines + a sparkle trail kicking up beneath it
             — it can't animate individual "legs" (it's one fused
             point cloud, not separable emoji layers), but the bob +
             motion streaks read as "running" all the same. ── */}
      {phase >= 1 && (
        <motion.div
          className="absolute inset-x-0 flex justify-center pointer-events-none"
          style={{ top: '26%', zIndex: 5, overflow: 'visible' }}
          animate={{ opacity: isXamStage ? 0 : 1 }}
          transition={{ duration: 1.2 }}
        >
          <motion.div
            animate={isGoatStage ? { y: [0, -10, 0, -4, 0], x: [0, 6, -3, 4, 0] } : { y: 0, x: 0 }}
            transition={isGoatStage ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.4 }}
            style={{ position: 'relative' }}
          >
            <canvas
              ref={droneCanvasRef}
              style={{ width: '92vw', maxWidth: 640, height: 'clamp(260px, 62vw, 440px)', display: 'block' }}
            />

            {/* "night river" — the formation's own reflection, dimmed
                and fading into black, like still water beneath it */}
            <div
              style={{
                position: 'relative', width: '92vw', maxWidth: 640, height: 'clamp(90px, 22vw, 150px)',
                overflow: 'hidden',
                maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), transparent)',
                WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), transparent)',
              }}
            >
              <canvas
                ref={reflectionCanvasRef}
                style={{ width: '92vw', maxWidth: 640, height: 'clamp(260px, 62vw, 440px)', display: 'block', filter: 'blur(1.5px)' }}
              />
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(180deg, rgba(26,5,5,0.35) 0%, rgba(26,5,5,0.85) 100%)' }}
              />
            </div>

            {/* running speed-lines, drifting past behind it */}
            {isGoatStage && Array.from({ length: 6 }).map((_, i) => {
              const s = ((i + 1) * 2654435761) >>> 0;
              const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
              return (
                <motion.div
                  key={`speedline-${i}`}
                  className="absolute"
                  style={{
                    top: `${30 + r(1) * 45}%`, right: '10%',
                    width: 26 + r(2) * 46, height: 2,
                    background: `linear-gradient(90deg, transparent, rgba(255,255,255,${0.3 + r(3) * 0.35}), transparent)`,
                  }}
                  initial={{ x: 0, opacity: 0 }}
                  animate={{ x: -80 - r(4) * 60, opacity: [0, 1, 0] }}
                  transition={{
                    duration: 0.5 + r(5) * 0.4, delay: r(6) * 1.2,
                    repeat: Infinity, repeatDelay: 0.25 + r(7) * 0.5, ease: 'linear',
                  }}
                />
              );
            })}

            {/* sparkle kicked up under its hooves */}
            {isGoatStage && Array.from({ length: 7 }).map((_, i) => {
              const s = ((i + 50) * 2654435761) >>> 0;
              const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
              return (
                <motion.div
                  key={`hoof-${i}`}
                  className="absolute rounded-full"
                  style={{
                    left: `${18 + r(1) * 55}%`, bottom: '16%', width: 3.5, height: 3.5,
                    background: '#fde68a', boxShadow: '0 0 5px #fde68a, 0 0 10px rgba(253,230,138,0.7)',
                  }}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
                  animate={{ x: -30 - r(2) * 24, y: 8 + r(3) * 10, opacity: [0, 1, 0], scale: [0.6, 1, 0.4] }}
                  transition={{
                    duration: 0.5 + r(4) * 0.3, delay: r(5) * 0.9,
                    repeat: Infinity, repeatDelay: r(6) * 0.4, ease: 'easeOut',
                  }}
                />
              );
            })}
            {/* comet-tail star dust — streams off its back into the sky,
                echoing the trailing dust plume behind the drone horse's
                tail in the reference photo */}
            {isGoatStage && Array.from({ length: 18 }).map((_, i) => {
              const COUNT = 18;
              const s = ((i + 120) * 2654435761) >>> 0;
              const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
              // Tight origin band near the back/tail so the particles read
              // as one continuous plume, not scattered noise.
              const startTop = 20 + r(1) * 10;
              const startRight = 9 + r(2) * 6;
              const travel = 90 + r(3) * 90;
              const rise = 55 + r(4) * 65;
              const size = 2 + r(5) * 2.2;
              const duration = 2.2 + r(6) * 0.6;
              // Evenly-spaced delays (instead of fully random) so several
              // particles are always in flight along the path at once —
              // a persistent trailing stream, like the reference photo,
              // rather than intermittent blips.
              const delay = (i / COUNT) * duration + r(7) * 0.15;
              return (
                <motion.div
                  key={`stardust-${i}`}
                  className="absolute rounded-full"
                  style={{
                    top: `${startTop}%`, right: `${startRight}%`,
                    width: size, height: size,
                    background: '#fff8e1',
                    boxShadow: '0 0 6px #fff8e1, 0 0 14px rgba(253,230,138,0.9)',
                  }}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
                  animate={{
                    x: [0, travel * 0.45, travel],
                    y: [0, -rise * 0.5, -rise],
                    opacity: [0, 1, 1, 0],
                    scale: [0.5, 1, 0.9, 0.3],
                  }}
                  transition={{
                    duration, delay,
                    repeat: Infinity, repeatDelay: 0, ease: 'easeOut',
                  }}
                />
              );
            })}
          </motion.div>
        </motion.div>
      )}

      {/* ── FINALE — couple silhouette, backs to camera, watching the
             drone-fireworks burst overhead. Stylised (not the sender's
             own photos) — matches the "watching fireworks together"
             mood of the reference photo. ── */}
      {(isFinaleStage || isXamStage) && (
        <motion.div
          className="absolute inset-x-0 flex justify-center pointer-events-none"
          style={{ bottom: 0, height: '40%', zIndex: 6 }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
        >
          {/* warm backlight glow behind the couple, like light from the
              fireworks above catching their silhouette */}
          <div
            className="absolute"
            style={{
              bottom: '4%', width: 260, height: 200,
              background: 'radial-gradient(ellipse at center, rgba(253,230,138,0.32) 0%, rgba(251,146,60,0.14) 45%, transparent 75%)',
            }}
          />
          <svg
            viewBox="0 0 300 200"
            width="80vw"
            style={{ maxWidth: 440, display: 'block' }}
            preserveAspectRatio="xMidYMax meet"
          >
            {/* arm across the shoulders, drawn first so both bodies sit on top */}
            <path
              d="M118,78 C126,68 138,68 148,78 C152,82 150,90 145,88 C136,80 126,80 120,87 C115,91 112,83 118,78 Z"
              fill="#04010a"
            />
            {/* person A — left, slightly taller */}
            <path
              d="M62,52 C44,52 34,68 35,90 C36,118 42,150 52,200 L104,200 C112,150 116,118 114,90 C113,68 100,52 82,52 C76,47 68,47 62,52 Z"
              fill="#04010a"
            />
            <circle cx="70" cy="30" r="19" fill="#04010a" />
            {/* person B — right, slightly shorter, leaning in close */}
            <path
              d="M133,62 C117,62 108,76 109,96 C110,120 115,150 123,200 L171,200 C178,150 182,120 181,96 C180,76 168,62 152,62 C147,58 139,58 133,62 Z"
              fill="#04010a"
            />
            <circle cx="141" cy="42" r="17" fill="#04010a" />
          </svg>
        </motion.div>
      )}

      {/* ── XIN XĂM — traditional Tết fortune-stick draw. Tap the tube
             to shake it; a fortune tile slides out with a blessing. ── */}
      {isXamStage && (
        <motion.div
          className="absolute inset-x-0 flex flex-col items-center"
          style={{ top: '38%', zIndex: 9 }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        >
          <AnimatePresence mode="wait">
            {!xamResult ? (
              <motion.button
                key="tube"
                type="button"
                onClick={(e) => { e.stopPropagation(); drawXam(); }}
                className="flex flex-col items-center cursor-pointer"
                style={{ background: 'none', border: 'none' }}
                aria-label="Lắc xin lộc"
                animate={xamShaking ? { rotate: [0, -9, 8, -7, 6, -4, 3, 0] } : { rotate: 0 }}
                transition={xamShaking ? { duration: 1.1, ease: 'easeInOut' } : { duration: 0.3 }}
              >
                <svg width="150" height="196" viewBox="0 0 160 210">
                  <defs>
                    <linearGradient id="xamTubeBody" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#8f1414" />
                      <stop offset="18%" stopColor="#dc2626" />
                      <stop offset="42%" stopColor="#b91c1c" />
                      <stop offset="100%" stopColor="#6f1010" />
                    </linearGradient>
                    <linearGradient id="xamStickGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fff8e1" />
                      <stop offset="100%" stopColor="#e0b872" />
                    </linearGradient>
                    <radialGradient id="xamShadow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
                      <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                    </radialGradient>
                  </defs>

                  {/* ground shadow */}
                  <ellipse cx="80" cy="203" rx="46" ry="9" fill="url(#xamShadow)" />

                  {/* fortune sticks poking out the top, uneven heights like real xăm sticks */}
                  {[-32, -21, -10, 0, 10, 21, 32].map((dx, i) => {
                    const heightVariation = [58, 68, 62, 72, 64, 67, 59][i];
                    const tipY = (xamShaking ? 6 : 14) - heightVariation + 60;
                    return (
                      <g key={i} transform={`rotate(${dx * 0.9} ${80 + dx} 72)`}>
                        <rect
                          x={80 + dx - 2.5} y={tipY} width="5" height={heightVariation}
                          rx="2.5" fill="url(#xamStickGrad)" stroke="#a9803f" strokeWidth="0.5"
                        />
                        <circle cx={80 + dx} cy={tipY + 6} r="3.2" fill="#dc2626" />
                      </g>
                    );
                  })}

                  {/* tube body — cylindrical, slightly wider at the base */}
                  <path
                    d="M34,70 L26,196 C26,202 34,207 46,207 L114,207 C126,207 134,202 134,196 L126,70 Z"
                    fill="url(#xamTubeBody)" stroke="#fde68a" strokeWidth="2.5"
                  />
                  {/* mouth of the tube */}
                  <ellipse cx="80" cy="70" rx="46" ry="11" fill="#a51c1c" stroke="#fde68a" strokeWidth="2.5" />
                  <ellipse cx="80" cy="68" rx="40" ry="8" fill="#7f1414" opacity="0.6" />

                  {/* decorative gold bands, like a bound bamboo tube */}
                  <rect x="27" y="118" width="106" height="9" rx="2" fill="#fde68a" opacity="0.9" />
                  <rect x="26" y="176" width="108" height="9" rx="2" fill="#fde68a" opacity="0.9" />

                  {/* fortune emblem */}
                  <circle cx="80" cy="148" r="19" fill="#7f1414" stroke="#fde68a" strokeWidth="2" />
                  <text x="80" y="156" textAnchor="middle" fontSize="22" fill="#fde68a" fontWeight="700">福</text>
                </svg>
                <span
                  className="mt-3 rounded-full text-sm font-semibold px-4 py-1.5"
                  style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(251,191,36,0.55)', color: '#fde68a' }}
                >
                  {xamShaking ? 'Đang lắc…' : '🥢 Lắc xin lộc đầu năm'}
                </span>
              </motion.button>
            ) : (
              <motion.div
                key="tile"
                className="flex flex-col items-center pointer-events-none"
                initial={{ opacity: 0, y: -20, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              >
                <div
                  style={{
                    background: 'linear-gradient(160deg, #7f1d1d 0%, #b91c1c 100%)',
                    border: '1px solid rgba(253,230,138,0.6)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5), 0 0 20px rgba(251,191,36,0.25)',
                    borderRadius: 10, padding: '16px 20px', maxWidth: 240,
                  }}
                >
                  <div className="text-center text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: '#fde68a' }}>
                    🧧 Lộc đầu năm
                  </div>
                  <div
                    className="text-center"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: 16, color: '#fff8e1', lineHeight: 1.5 }}
                  >
                    {xamResult}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Tap-to-open, fingerprint style — the very last thing to
             appear, after xin xăm ── */}
      {canInteract && !showNote && (
        <motion.div
          className="absolute inset-x-0 flex flex-col items-center pointer-events-none"
          style={{ top: '70%', zIndex: 12 }}
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

      {/* ── Note ── */}
      <AnimatePresence>
        {showNote && kiss.message && (
          <motion.div
            className="fixed inset-0 z-300 flex items-center justify-center px-6 cursor-pointer"
            style={{ background: 'rgba(20,2,2,0.9)' }}
            onClick={(e) => { e.stopPropagation(); setShowNote(false); }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="relative w-full max-w-sm overflow-hidden rounded-2xl px-7 pb-9 pt-7 text-center"
              style={{
                background: 'linear-gradient(160deg, #4a1010 0%, #7f1d1d 100%)',
                border: '1px solid rgba(251,191,36,0.35)',
                boxShadow: '0 30px 70px rgba(0,0,0,0.6), 0 0 50px rgba(251,191,36,0.18)',
              }}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className="absolute inset-x-0 top-0"
                style={{ height: 5, background: 'linear-gradient(90deg, #f59e0b, #fde68a, #ef4444, #f59e0b)' }}
              />
              <div
                className="mb-4 text-center"
                style={{
                  fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.25em', textTransform: 'uppercase', color: '#fde68a',
                }}
              >
                🧧 Chúc Mừng Năm Mới
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
              {rawName && (
                <div className="mt-3 italic" style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>
                  Gửi {rawName}
                </div>
              )}
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

export default TetMaiDaoReveal;

export const TetMaiDaoConfig: TemplateConfig = {
  id: 'tet-mai-dao',
  name: 'Mai & Đào Blossoms',
  occasionIds: ['tet'],
  emoji: '🐐',
  description: 'Fireworks fill the sky, then a drone-light formation forms a Tết greeting and morphs into the zodiac goat.',
  thumbnailBg: 'linear-gradient(135deg, #7f1d1d, #fbbf24)',
  Component: TetMaiDaoReveal,
};
