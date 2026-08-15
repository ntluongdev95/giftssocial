'use client';

// Xmas · Drone Show Reveal — Guinness-style composite Christmas scene
// ─────────────────────────────────────────────────────────────────────
// After the password door opens, ~1200 luminous drones swarm across
// the pitch-black night sky and assemble the classic Christmas
// composite: reindeer leaping top-right, sleigh with Santa bottom-
// left, reins arcing between them — exactly like the 5,000-drone
// Guinness record show reference. Then morphs through:
//
//   Stage 0  🎅🦌  Composite scene (reindeer + reins + sleigh + Santa)
//   Stage 1  🎄     Christmas tree
//   Stage 2  ❤️     Heart
//   Stage 3  Text: "Merry Xmas {name}"
//
// Colours per drone follow the reference image:
//   • Reindeer region → violet-purple
//   • Reins arcs     → cyan-blue
//   • Sleigh + Santa → hot pink
//   • Text stage     → warm cream
//
// White snow drifts across the whole scene behind the drone canvas
// so the sky reads as a proper Christmas night.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getKissString, parseKissData } from '../_shared/useTemplateData';
import type { TemplateProps } from '../_types';

// ─── Palette · region-specific drone colours ─────────────────────────
const PURPLE     = '#c084fc';    // reindeer
const VIOLET     = '#a78bfa';    // antlers / highlights
const PINK       = '#f472b6';    // sleigh / Santa
const CYAN       = '#60a5fa';    // reins / rays
const CREAM      = '#fef3c7';    // text
const RED        = '#f43f5e';    // heart

const DRONE_COUNT = 1200;
const STAGE_HOLD_MS  = 5000;
const STAGE_MORPH_MS = 1800;

type Pt = { x: number; y: number; color?: string };

// ─────────────────────────────────────────────────────────────────────
// Composite scene · reindeer + reins + sleigh + Santa
// Hand-drawn on canvas so the silhouettes read cleanly. Each region
// is filled/stroked separately so the SAMPLE step can region-colour
// the resulting points.
// ─────────────────────────────────────────────────────────────────────
function drawSantaSleighScene(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const cx = W / 2;
  const cy = H / 2;
  const u  = Math.min(W, H) / 11;                          // unit scale

  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';

  // ── REINDEER · top-right, leaping upward-right ──
  const rx = cx + u * 3.2;
  const ry = cy - u * 1.6;

  // Body (elongated, tilted up)
  ctx.save();
  ctx.translate(rx, ry);
  ctx.rotate(-Math.PI * 0.13);
  ctx.beginPath();
  ctx.ellipse(0, 0, u * 1.4, u * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Neck + head
  ctx.beginPath();
  ctx.ellipse(rx + u * 1.2, ry - u * 0.75, u * 0.5, u * 0.35, -0.25, 0, Math.PI * 2);
  ctx.fill();

  // Antlers — 2 main branches with sub-branches
  ctx.lineWidth = u * 0.18;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // right main
  ctx.moveTo(rx + u * 1.35, ry - u * 1.05);
  ctx.lineTo(rx + u * 1.9,  ry - u * 2.7);
  // right subs
  ctx.moveTo(rx + u * 1.9,  ry - u * 2.7);
  ctx.lineTo(rx + u * 2.5,  ry - u * 2.4);
  ctx.moveTo(rx + u * 1.7,  ry - u * 2.1);
  ctx.lineTo(rx + u * 2.3,  ry - u * 1.8);
  ctx.moveTo(rx + u * 2.0,  ry - u * 2.3);
  ctx.lineTo(rx + u * 2.6,  ry - u * 1.9);
  // left main
  ctx.moveTo(rx + u * 1.0,  ry - u * 1.05);
  ctx.lineTo(rx + u * 0.4,  ry - u * 2.7);
  // left subs
  ctx.moveTo(rx + u * 0.4,  ry - u * 2.7);
  ctx.lineTo(rx - u * 0.2,  ry - u * 2.4);
  ctx.moveTo(rx + u * 0.6,  ry - u * 2.1);
  ctx.lineTo(rx,            ry - u * 1.8);
  ctx.moveTo(rx + u * 0.3,  ry - u * 2.3);
  ctx.lineTo(rx - u * 0.3,  ry - u * 1.9);
  ctx.stroke();

  // Legs — 4 legs, leaping pose
  ctx.lineWidth = u * 0.28;
  ctx.beginPath();
  ctx.moveTo(rx + u * 0.9, ry + u * 0.3);
  ctx.lineTo(rx + u * 1.3, ry + u * 1.5);
  ctx.moveTo(rx + u * 0.55, ry + u * 0.3);
  ctx.lineTo(rx + u * 0.75, ry + u * 1.55);
  ctx.moveTo(rx - u * 0.85, ry + u * 0.2);
  ctx.lineTo(rx - u * 1.3,  ry + u * 1.0);
  ctx.moveTo(rx - u * 0.55, ry + u * 0.2);
  ctx.lineTo(rx - u * 0.85, ry + u * 1.3);
  ctx.stroke();

  // Tail
  ctx.beginPath();
  ctx.ellipse(rx - u * 1.45, ry - u * 0.2, u * 0.22, u * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── SLEIGH · bottom-left, boat shape ──
  const sx = cx - u * 2.4;
  const sy = cy + u * 1.7;

  // Sleigh body (curved boat)
  ctx.beginPath();
  ctx.moveTo(sx - u * 1.6, sy);
  ctx.quadraticCurveTo(sx - u * 2.1, sy + u * 1.1, sx - u * 0.4, sy + u * 1.3);
  ctx.lineTo(sx + u * 1.6, sy + u * 1.3);
  ctx.quadraticCurveTo(sx + u * 2.1, sy, sx + u * 2.1, sy - u * 0.55);
  ctx.quadraticCurveTo(sx + u * 1.4, sy - u * 0.75, sx + u * 0.4, sy - u * 0.55);
  ctx.quadraticCurveTo(sx - u * 0.6, sy - u * 0.45, sx - u * 1.6, sy);
  ctx.closePath();
  ctx.fill();

  // Front curl of sleigh
  ctx.lineWidth = u * 0.2;
  ctx.beginPath();
  ctx.moveTo(sx - u * 1.6, sy);
  ctx.quadraticCurveTo(sx - u * 2.5, sy - u * 0.5, sx - u * 2.2, sy - u * 1.3);
  ctx.stroke();

  // Runner (bottom curve)
  ctx.lineWidth = u * 0.16;
  ctx.beginPath();
  ctx.moveTo(sx - u * 1.8, sy + u * 1.4);
  ctx.quadraticCurveTo(sx, sy + u * 1.7, sx + u * 2.3, sy + u * 1.4);
  ctx.stroke();

  // Presents in sleigh
  ctx.fillRect(sx - u * 0.9, sy - u * 1.05, u * 0.55, u * 0.55);
  ctx.fillRect(sx - u * 0.15, sy - u * 0.85, u * 0.45, u * 0.45);

  // ── SANTA · sitting in sleigh (right side) ──
  // Head
  ctx.beginPath();
  ctx.arc(sx + u * 0.85, sy - u * 0.85, u * 0.42, 0, Math.PI * 2);
  ctx.fill();
  // Hat cone
  ctx.beginPath();
  ctx.moveTo(sx + u * 0.4, sy - u * 1.15);
  ctx.lineTo(sx + u * 1.2, sy - u * 1.15);
  ctx.lineTo(sx + u * 1.5, sy - u * 2.0);
  ctx.closePath();
  ctx.fill();
  // Hat pom
  ctx.beginPath();
  ctx.arc(sx + u * 1.5, sy - u * 2.1, u * 0.18, 0, Math.PI * 2);
  ctx.fill();
  // Body (below head — barrel)
  ctx.beginPath();
  ctx.ellipse(sx + u * 0.85, sy - u * 0.1, u * 0.55, u * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  // Right arm holding reins
  ctx.lineWidth = u * 0.22;
  ctx.beginPath();
  ctx.moveTo(sx + u * 1.1, sy - u * 0.3);
  ctx.lineTo(sx + u * 1.9, sy - u * 0.5);
  ctx.stroke();

  // ── REINS · 3 curved ribbons from Santa to reindeer ──
  ctx.lineWidth = u * 0.09;
  ctx.beginPath();
  ctx.moveTo(sx + u * 1.9, sy - u * 0.4);
  ctx.quadraticCurveTo(cx + u * 0.2, cy - u * 1.2, rx - u * 0.4, ry + u * 0.3);
  ctx.moveTo(sx + u * 1.9, sy - u * 0.5);
  ctx.quadraticCurveTo(cx + u * 0.8, cy - u * 1.8, rx - u * 0.2, ry - u * 0.1);
  ctx.moveTo(sx + u * 1.9, sy - u * 0.6);
  ctx.quadraticCurveTo(cx + u * 1.2, cy - u * 2.3, rx,            ry - u * 0.5);
  ctx.stroke();

  // ── FLOURISH RIBBONS · sweeping arcs below the reindeer (like ref) ──
  ctx.lineWidth = u * 0.11;
  ctx.beginPath();
  ctx.arc(rx - u * 0.2, ry + u * 3.0, u * 1.6, Math.PI * 0.95, 2 * Math.PI * 0.05, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(rx - u * 0.5, ry + u * 3.3, u * 1.1, Math.PI * 0.95, 2 * Math.PI * 0.05, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(rx - u * 1.0, ry + u * 3.6, u * 0.7, Math.PI * 0.95, 2 * Math.PI * 0.05, false);
  ctx.stroke();
}

// ─────────────────────────────────────────────────────────────────────
// Sample the composite scene · uses the STANDALONE 🦌 emoji (which
// the user liked) — flipped horizontally so it faces LEFT — with a
// 🛷 sleigh drawn to its RIGHT so it looks like the reindeer is
// pulling the sleigh forward. Both emojis sampled together into one
// point cloud so the drones assemble them as ONE scene.
//   • Reindeer (flipped, left side)   → violet-purple
//   • Sleigh (right side, following)  → pink
// ─────────────────────────────────────────────────────────────────────
function sampleCompositeScene(): Pt[] {
  if (typeof document === 'undefined') return [];
  const W = 1600, H = 720;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const emojiSize = Math.floor(H * 0.78);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${emojiSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;

  // SLEIGH — behind (LEFT side) of the reindeer
  ctx.fillText('🛷', W * 0.38, H * 0.58);

  // REINDEER — default orientation (faces RIGHT) → pulling forward
  // to the right, with sleigh trailing on its left.
  ctx.fillText('🦌', W * 0.68, H * 0.5);

  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: Pt[] = [];
  const stride = 4;
  const cx = W / 2, cy = H / 2;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        const nx = (x - cx) / cx;
        const ny = (y - cy) / cx;
        // Regions:
        //   right half → reindeer (violet mix)
        //   left half  → sleigh (pink)
        const color = nx > 0.05
          ? (((x + y) % 7 < 2) ? VIOLET : PURPLE)
          : PINK;
        pts.push({ x: nx, y: ny, color });
      }
    }
  }
  return pts;
}

// ─── Emoji + text samplers ────────────────────────────────────────
function sampleEmoji(emoji: string, canvasSize = 480, color?: string): Pt[] {
  if (typeof document === 'undefined') return [];
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize; canvas.height = canvasSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.font = `${Math.floor(canvasSize * 0.85)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, canvasSize / 2, canvasSize / 2);
  const { data } = ctx.getImageData(0, 0, canvasSize, canvasSize);
  const pts: Pt[] = [];
  const stride = 5;
  for (let y = 0; y < canvasSize; y += stride) {
    for (let x = 0; x < canvasSize; x += stride) {
      if (data[(y * canvasSize + x) * 4 + 3] > 128) {
        pts.push({
          x: (x - canvasSize / 2) / (canvasSize / 2),
          y: (y - canvasSize / 2) / (canvasSize / 2),
          color,
        });
      }
    }
  }
  return pts;
}

function sampleText(text: string, color = CREAM): Pt[] {
  if (typeof document === 'undefined') return [];
  const W = 1200, H = 300;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  let fontPx = 180;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  while (fontPx > 60) {
    ctx.font = `bold ${fontPx}px "Playfair Display", "Georgia", serif`;
    if (ctx.measureText(text).width < W * 0.92) break;
    fontPx -= 8;
  }
  ctx.fillStyle = '#fff';
  ctx.fillText(text, W / 2, H / 2);
  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: Pt[] = [];
  const stride = 6;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        pts.push({
          x: (x - W / 2) / (W / 2),
          y: (y - H / 2) / (W / 2),
          color,
        });
      }
    }
  }
  return pts;
}

function packToCount(pts: Pt[], n: number): Pt[] {
  if (pts.length === 0) return Array.from({ length: n }).map(() => ({ x: 0, y: 0 }));
  if (pts.length >= n) {
    const stride = pts.length / n;
    return Array.from({ length: n }).map((_, i) => pts[Math.floor(i * stride)]);
  }
  return Array.from({ length: n }).map((_, i) => pts[i % pts.length]);
}

export default function XmasSnowReveal({ kiss, onClose }: TemplateProps) {
  const rawName = (getKissString(kiss, 'name') || kiss.receiver_name || 'em').trim();
  const displayName = rawName || 'em';

  // Photos array (up to 6) from template_data.photos, fallback to single photo
  const photos: string[] = (() => {
    const raw = parseKissData(kiss).photos;
    if (Array.isArray(raw)) {
      return raw.filter((u): u is string => typeof u === 'string' && !!u).slice(0, 6);
    }
    const single = getKissString(kiss, 'photo');
    return single ? [single] : [];
  })();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const [stage, setStage] = useState(0);

  // ─── Stage sequence ─────────────────────────────────────────
  // Reverted to the ORIGINAL simple emoji-per-stage sequence — the
  // hand-drawn composite scene was making the reindeer look messy;
  // the standalone 🦌 emoji is cleaner + prettier when sampled.
  const stagesConfig = useMemo(() => (
    [
      // Stage 0 · reindeer PULLING SLEIGH (reindeer flipped facing
      // left, sleigh trailing on the right). Same standalone 🦌
      // emoji the user liked — just composed with 🛷 into one scene.
      // Stage 0 · reindeer facing RIGHT pulling sleigh trailing left
      { kind: 'composite', color: undefined, scale: 1.05, label: '🦌 Reindeer + Sleigh' },
      { kind: 'emoji', value: '❤️',  color: RED,       scale: 0.40, label: '❤️ Heart' },
      { kind: 'text',  value: `Merry Xmas ${displayName}`, color: CREAM, scale: 0.55, label: '💌 Message' },
    ] as const
  ), [displayName]);

  // Pre-sample every stage into point sets packed to DRONE_COUNT slots
  const stagePoints = useMemo(() => {
    if (typeof document === 'undefined') return [];
    return stagesConfig.map(cfg => {
      let raw: Pt[] = [];
      if (cfg.kind === 'composite')  raw = sampleCompositeScene();
      else if (cfg.kind === 'emoji') raw = sampleEmoji(cfg.value, 480, cfg.color);
      else if (cfg.kind === 'text')  raw = sampleText(cfg.value, cfg.color);
      return packToCount(raw, DRONE_COUNT);
    });
  }, [stagesConfig]);

  // Auto-advance stages
  useEffect(() => {
    const timers: number[] = [];
    stagesConfig.forEach((_, i) => {
      if (i === 0) return;
      timers.push(window.setTimeout(
        () => setStage(i),
        i * (STAGE_HOLD_MS + STAGE_MORPH_MS),
      ));
    });
    timers.push(window.setTimeout(
      () => onClose?.(),
      stagesConfig.length * (STAGE_HOLD_MS + STAGE_MORPH_MS) + 8000,
    ));
    return () => { timers.forEach(t => window.clearTimeout(t)); };
  }, [stagesConfig, onClose]);

  // Bridge React stage → RAF loop via ref
  const latestStageRef = useRef(0);
  useEffect(() => { latestStageRef.current = stage; }, [stage]);

  // Particle drones + RAF morph loop
  useEffect(() => {
    if (typeof window === 'undefined' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || stagePoints.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = W / 2;
    const cy = H * 0.48;
    const scaleBase = Math.min(W, H) * 0.9;

    type Drone = {
      x: number; y: number;
      fromX: number; fromY: number;
      color: string;
      size: number;
      twinkle: number;
      morphStart: number;
    };
    const drones: Drone[] = [];
    for (let i = 0; i < DRONE_COUNT; i++) {
      const sx = (Math.random() - 0.5) * W * 1.4;
      const sy = (Math.random() - 0.5) * H * 1.4;
      drones.push({
        x: cx + sx, y: cy + sy,
        fromX: cx + sx, fromY: cy + sy,
        color: stagePoints[0]?.[i]?.color || PURPLE,
        size: 1.4 + Math.random() * 1.8,
        twinkle: Math.random() * Math.PI * 2,
        morphStart: performance.now(),
      });
    }

    let currentStage = 0;
    let lastRenderStage = -1;

    const targetForDrone = (i: number, s: number): [number, number] => {
      const cfg = stagesConfig[s];
      const pts = stagePoints[s];
      const p = pts[i];
      return [cx + p.x * scaleBase * cfg.scale, cy + p.y * scaleBase * cfg.scale];
    };

    const draw = (now: number) => {
      if (currentStage !== lastRenderStage) {
        for (let i = 0; i < drones.length; i++) {
          drones[i].fromX = drones[i].x;
          drones[i].fromY = drones[i].y;
          drones[i].morphStart = now;
          const newColor = stagePoints[currentStage]?.[i]?.color;
          if (newColor) drones[i].color = newColor;
        }
        lastRenderStage = currentStage;
      }

      // Motion trail via destination-out fade
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < drones.length; i++) {
        const d = drones[i];
        const [tx, ty] = targetForDrone(i, currentStage);
        const elapsed = now - d.morphStart;
        const t = Math.min(1, elapsed / STAGE_MORPH_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        d.x = d.fromX + (tx - d.fromX) * eased;
        d.y = d.fromY + (ty - d.fromY) * eased;

        const tw = 0.75 + 0.4 * Math.sin(now / 260 + d.twinkle);
        ctx.fillStyle = d.color;
        ctx.globalAlpha = Math.min(1, tw);
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size * tw, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    const syncInterval = window.setInterval(() => {
      currentStage = latestStageRef.current;
    }, 100);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.clearInterval(syncInterval);
    };
  }, [stagePoints, stagesConfig]);

  const isFinalStage = stage === stagesConfig.length - 1;

  // ─── Snowfall — 100 deterministic falling flakes ────────────
  const snowflakes = useMemo(() => (
    Array.from({ length: 100 }).map((_, i) => {
      const s = ((i + 1) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      return {
        left: r(1) * 100,
        size: 3 + r(2) * 9,
        delay: r(3) * 10,
        dur: 10 + r(4) * 12,
        sway: (r(5) - 0.5) * 60,
        opacity: 0.35 + r(6) * 0.55,
      };
    })
  ), []);

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden select-none"
      style={{ background: '#020212', fontFamily: "'Playfair Display', Georgia, serif" }}
      onClick={onClose}
    >
      {/* ── SNOWFALL BEHIND canvas (semi-transparent overlays merge) ── */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
        {snowflakes.map((f, i) => (
          <motion.div
            key={`flake-${i}`}
            className="absolute"
            style={{
              left: `${f.left}%`,
              top: '-8%',
              fontSize: f.size,
              opacity: f.opacity,
              color: '#fff',
              textShadow: '0 0 4px rgba(255,255,255,0.5)',
            }}
            initial={{ y: 0, x: 0 }}
            animate={{ y: '115vh', x: [0, f.sway, -f.sway, 0] }}
            transition={{ duration: f.dur, delay: f.delay, repeat: Infinity, ease: 'linear' }}
          >
            ❄
          </motion.div>
        ))}
      </div>

      {/* ── MOTION STREAKS · only visible on Stage 0 (reindeer+sleigh)
             so the composite feels like it's flying forward. 20 thin
             horizontal streaks drift right→left across the sky at
             different speeds. */}
      {stage === 0 && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
          {Array.from({ length: 20 }).map((_, i) => {
            const s = ((i + 1) * 2654435761) >>> 0;
            const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
            return (
              <motion.div
                key={`streak-${i}`}
                className="absolute"
                style={{
                  top: `${20 + r(1) * 60}%`,
                  right: 0,
                  width: 40 + r(2) * 80,
                  height: 1.5,
                  background: `linear-gradient(90deg, transparent, rgba(255,255,255,${0.3 + r(3) * 0.4}), transparent)`,
                  filter: 'blur(0.5px)',
                }}
                initial={{ x: 0, opacity: 0 }}
                animate={{ x: `-${100 + r(4) * 30}vw`, opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 1.4 + r(5) * 1.5,
                  delay: r(6) * 2,
                  repeat: Infinity,
                  repeatDelay: r(7) * 1.5,
                  ease: 'linear',
                  times: [0, 0.1, 0.85, 1],
                }}
              />
            );
          })}
        </div>
      )}

      {/* ── DRONE CANVAS · bobs gently on Stage 0 so the composite
             feels like it's soaring through the sky. Other stages
             stay stationary. */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 2 }}
        animate={stage === 0 ? { y: [0, -6, 0, 6, 0] } : { y: 0 }}
        transition={stage === 0
          ? { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.4 }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ width: '100%', height: '100%' }}
        />
      </motion.div>

      {/* Stage label chip top-center */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`chip-${stage}`}
          className="absolute inset-x-0 pointer-events-none text-center"
          style={{ top: '4%', zIndex: 10 }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 0.9, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-block rounded-full px-4 py-1.5" style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.18)',
            backdropFilter: 'blur(8px)',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 12,
            letterSpacing: 1.5,
            color: 'rgba(255,255,255,0.85)',
            textTransform: 'uppercase',
          }}>
            {stagesConfig[stage]?.label || ''}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Distant warm-lit COTTAGE — appears bottom-left on final stage.
          A small silhouette house with glowing windows sits far away
          on a snowy hill, warm light spilling into the night. */}
      {isFinalStage && (
        <motion.div
          className="absolute pointer-events-none"
          style={{
            left: '6%',
            bottom: '8%',
            width: 140,
            height: 120,
            zIndex: 7,
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.6, delay: 1.0, ease: [0.16, 1, 0.3, 1] }}
        >
          <svg viewBox="0 0 140 120" width="100%" height="100%" style={{
            filter: 'drop-shadow(0 0 20px rgba(253,224,138,0.55)) drop-shadow(0 0 40px rgba(251,191,36,0.35))',
          }}>
            {/* Warm halo behind house */}
            <ellipse cx="70" cy="72" rx="65" ry="30" fill="rgba(253,224,138,0.18)" />
            {/* Snowy ground line */}
            <path d="M 0 100 Q 40 92 70 96 T 140 100 L 140 120 L 0 120 Z"
                  fill="rgba(240,245,255,0.85)" />
            {/* House body */}
            <rect x="35" y="60" width="60" height="45" fill="#2a1810" />
            {/* Roof triangle */}
            <path d="M 30 62 L 65 32 L 100 62 Z" fill="#3a2010" />
            {/* Snow on roof */}
            <path d="M 30 62 L 65 32 L 100 62 L 96 65 L 65 38 L 34 65 Z" fill="#f0f5ff" />
            {/* Chimney */}
            <rect x="80" y="38" width="9" height="18" fill="#2a1810" />
            <rect x="79" y="37" width="11" height="3" fill="#f0f5ff" />
            {/* Left window — warm glow */}
            <rect x="42" y="68" width="14" height="14" fill="#fde68a" />
            <rect x="42" y="68" width="14" height="14" fill="none" stroke="#2a1810" strokeWidth="1.5" />
            <line x1="49" y1="68" x2="49" y2="82" stroke="#2a1810" strokeWidth="1" />
            <line x1="42" y1="75" x2="56" y2="75" stroke="#2a1810" strokeWidth="1" />
            {/* Right window — warm glow */}
            <rect x="72" y="68" width="14" height="14" fill="#fbbf24" />
            <rect x="72" y="68" width="14" height="14" fill="none" stroke="#2a1810" strokeWidth="1.5" />
            <line x1="79" y1="68" x2="79" y2="82" stroke="#2a1810" strokeWidth="1" />
            <line x1="72" y1="75" x2="86" y2="75" stroke="#2a1810" strokeWidth="1" />
            {/* Door */}
            <rect x="59" y="85" width="12" height="20" fill="#5a2f1a" />
            <circle cx="68" cy="95" r="0.8" fill="#fde68a" />
            {/* Smoke wisp from chimney (subtle) */}
            <path d="M 84 36 Q 82 28 86 22 Q 90 16 87 10"
                  fill="none" stroke="rgba(200,200,210,0.35)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </motion.div>
      )}

      {/* Photo scatter — up to 6 polaroids drift in on final stage,
          positioned around the message area on the snowy sky. */}
      {isFinalStage && photos.length > 0 && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 8 }}>
          {photos.map((url, i) => {
            const s = ((i + 1) * 2654435761) >>> 0;
            const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
            // Position around bottom half, avoiding centre text area.
            const isLeft = i % 2 === 0;
            const xBand = isLeft ? 5 + r(1) * 22 : 73 + r(1) * 22;
            const yBand = 30 + r(2) * 45;
            const rotate = (isLeft ? -1 : 1) * (3 + r(3) * 8);
            return (
              <motion.div
                key={`p-${i}`}
                className="absolute"
                style={{
                  left: `${xBand}vw`,
                  top:  `${yBand}vh`,
                  padding: 6,
                  paddingBottom: 18,
                  background: '#fffbf6',
                  borderRadius: 3,
                  boxShadow: `0 12px 28px rgba(0,0,0,0.65), 0 0 22px ${CYAN}33`,
                  transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
                  transformOrigin: '50% 50%',
                }}
                initial={{ opacity: 0, y: 40, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 1.1,
                  delay: 2.4 + i * 0.35,
                  ease: [0.34, 1.15, 0.64, 1],
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  style={{
                    width: 90, height: 90,
                    objectFit: 'cover',
                    borderRadius: 2,
                    display: 'block',
                  }}
                />
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Sender message + signature on final stage */}
      {isFinalStage && kiss.message && (
        <motion.div
          className="absolute inset-x-0 pointer-events-none text-center px-8"
          style={{ bottom: '10%', zIndex: 10 }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, delay: 1.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="max-w-md mx-auto" style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 'clamp(16px, 2.4vw, 22px)',
            color: 'rgba(255,240,240,0.95)',
            textShadow: '0 2px 12px rgba(0,0,0,0.7)',
            lineHeight: 1.4,
          }}>
            &ldquo;{kiss.message}&rdquo;
          </div>
          {kiss.sender_name && (
            <div style={{
              marginTop: 8,
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: PINK,
            }}>
              — {kiss.sender_name}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
