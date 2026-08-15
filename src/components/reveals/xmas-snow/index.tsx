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

  // REINDEER — flip horizontally so the head faces RIGHT reliably
  // across ALL OS emoji fonts (some render 🦌 facing left natively).
  ctx.save();
  ctx.translate(W * 0.68, H * 0.5);
  ctx.scale(-1, 1);
  ctx.fillText('🦌', 0, 0);
  ctx.restore();

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

function sampleText(text: string, palette: readonly string[] | string = CREAM): Pt[] {
  if (typeof document === 'undefined') return [];
  // Wider canvas + bigger initial font so letters render with more
  // detail (more sample points per glyph) → drones form thicker,
  // more legible letters.
  const W = 1600, H = 400;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  let fontPx = 260;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  while (fontPx > 80) {
    ctx.font = `900 ${fontPx}px "Playfair Display", "Georgia", serif`;
    if (ctx.measureText(text).width < W * 0.92) break;
    fontPx -= 10;
  }
  ctx.fillStyle = '#fff';
  ctx.fillText(text, W / 2, H / 2);
  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: Pt[] = [];
  const stride = 5;
  // Multi-tone palette support — cycle colours per opaque sample so
  // the drone letters shimmer with love-palette variation.
  const paletteArr = Array.isArray(palette) ? palette : [palette];
  let idx = 0;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        pts.push({
          x: (x - W / 2) / (W / 2),
          y: (y - H / 2) / (W / 2),
          color: paletteArr[idx % paletteArr.length],
        });
        idx++;
      }
    }
  }
  return pts;
}

// ─────────────────────────────────────────────────────────────────────
// sampleHeartCurve — reject-sample the CLASSIC heart implicit
// equation:  (x² + y² − 1)³ − x²·y³ ≤ 0
// Yields a smoother, more elegant heart than the ❤️ emoji glyph.
// Multi-tone rose colors + occasional gold "sparkle" points give the
// drone-heart a spectacular galaxy feel when rotated in 3D.
// ─────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────
// Draw a REALISTIC 3D-looking Christmas gift box on the canvas:
//   • Rectangular box body (bright RED)
//   • Slightly wider LID on top (darker RED)
//   • Vertical + horizontal GOLD ribbon strips wrapping the box
//   • Big CREAM bow on top with 2 loops + knot + tails
// The regions become distinct dot colours after sampling.
// ─────────────────────────────────────────────────────────────────────
function drawGiftBox(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const cx = W / 2;
  const cy = H / 2;
  const s = Math.min(W, H) * 0.30;   // half-body scale

  ctx.fillStyle = '#fff';

  // BOX BODY — main rectangle (lower + middle)
  ctx.fillRect(cx - s * 0.95, cy - s * 0.35, s * 1.9, s * 1.4);

  // LID — wider + shorter rectangle at top of body
  ctx.fillRect(cx - s * 1.05, cy - s * 0.6, s * 2.1, s * 0.3);

  // VERTICAL RIBBON — down the middle of the box + across the lid
  ctx.fillRect(cx - s * 0.14, cy - s * 0.6, s * 0.28, s * 1.65);

  // HORIZONTAL RIBBON — across the lid front face
  ctx.fillRect(cx - s * 1.05, cy - s * 0.5, s * 2.1, s * 0.14);

  // BOW LEFT LOOP
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.4, cy - s * 0.85, s * 0.32, s * 0.22, -0.35, 0, Math.PI * 2);
  ctx.fill();
  // BOW RIGHT LOOP
  ctx.beginPath();
  ctx.ellipse(cx + s * 0.4, cy - s * 0.85, s * 0.32, s * 0.22, 0.35, 0, Math.PI * 2);
  ctx.fill();
  // BOW KNOT centre
  ctx.fillRect(cx - s * 0.12, cy - s * 1.02, s * 0.24, s * 0.28);

  // BOW TAILS hanging down from knot onto the lid
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.10, cy - s * 0.78);
  ctx.lineTo(cx - s * 0.30, cy - s * 0.50);
  ctx.lineTo(cx - s * 0.05, cy - s * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.10, cy - s * 0.78);
  ctx.lineTo(cx + s * 0.30, cy - s * 0.50);
  ctx.lineTo(cx + s * 0.05, cy - s * 0.55);
  ctx.closePath();
  ctx.fill();
}

// Sample gift box + colour regions realistically.
function sampleGiftBox(): Pt[] {
  if (typeof document === 'undefined') return [];
  const W = 700, H = 700;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  drawGiftBox(ctx, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: Pt[] = [];
  const stride = 4;
  const cx = W / 2, cy = H / 2;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        const nx = (x - cx) / cx;
        const ny = (y - cy) / cx;
        // Region colours:
        //   • Top area (ny < -0.4) → CREAM/GOLD (bow + knot)
        //   • Thin vertical strip |nx| < 0.15  → GOLD (ribbon)
        //   • Thin horizontal band near lid front  → GOLD
        //   • Lid area (ny ~ -0.2 to -0.35)  → deeper red
        //   • Rest = box body bright red
        let color: string;
        if (ny < -0.42) {
          color = ((x + y) % 5 < 2) ? '#fef3c7' : '#fbbf24';   // bow cream + gold mix
        } else if (Math.abs(nx) < 0.16) {
          color = '#fbbf24';                                    // vertical ribbon gold
        } else if (ny > -0.30 && ny < -0.18) {
          color = '#fbbf24';                                    // horizontal ribbon gold
        } else if (ny < -0.10) {
          color = '#b91c1c';                                    // lid deeper red
        } else {
          color = '#dc2626';                                    // box body bright red
        }
        pts.push({ x: nx, y: ny, color });
      }
    }
  }
  return pts;
}

function sampleHeartCurve(count = 1600): Pt[] {
  // Seeded LCG for deterministic reject sampling (React-19 pure)
  let seed = 987654321;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pts: Pt[] = [];
  let attempts = 0;
  let idx = 0;
  while (pts.length < count && attempts < count * 40) {
    attempts++;
    const rx = (rand() - 0.5) * 2.6;
    const ry = (rand() - 0.5) * 2.6;
    const a = rx * rx + ry * ry - 1;
    if (a * a * a - rx * rx * ry * ry * ry > 0) continue;
    const dist = Math.hypot(rx, ry);
    // BRIGHT RED palette — 3 red tones + occasional cream sparkle
    // makes the heart glow like burning ember, not muted rose.
    let color: string;
    if (idx % 13 === 0)      color = '#fef3c7';           // sparkle cream
    else if (dist < 0.35)    color = '#dc2626';           // deep blood red centre
    else if (dist < 0.75)    color = '#ef4444';           // bright hot red mid
    else                     color = '#f87171';           // bright coral rim
    idx++;
    pts.push({ x: rx, y: -ry, color });                    // flip Y for canvas
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
      { kind: 'composite', color: undefined,  scale: 1.05, label: '🦌 Reindeer + Sleigh' },
      { kind: 'gift',      color: undefined,  scale: 0.48, label: '🎁 Gift' },
      { kind: 'heart',     color: undefined,  scale: 0.55, label: '❤️ Galaxy Heart' },
    ] as const
  ), [displayName]);

  // Pre-sample every stage into point sets packed to DRONE_COUNT slots
  const stagePoints = useMemo(() => {
    if (typeof document === 'undefined') return [];
    return stagesConfig.map(cfg => {
      let raw: Pt[] = [];
      if (cfg.kind === 'composite')  raw = sampleCompositeScene();
      else if (cfg.kind === 'heart') raw = sampleHeartCurve(1600);
      else if (cfg.kind === 'gift')  raw = sampleGiftBox();
      return packToCount(raw, DRONE_COUNT);
    });
  }, [stagesConfig]);

  // Stage progression driven by CURRENT stage kind:
  //   • gift stage → WAITS for user tap (no auto-advance)
  //   • final stage → auto-closes after a display hold
  //   • otherwise → auto-advance to next after HOLD + MORPH
  useEffect(() => {
    const cfg = stagesConfig[stage];
    if (!cfg) return;
    if (cfg.kind === 'gift') return;                         // wait for tap
    if (stage === stagesConfig.length - 1) {
      // Final stage — savour then close
      const t = window.setTimeout(() => onClose?.(), STAGE_HOLD_MS * 2.5);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(
      () => setStage(s => s + 1),
      STAGE_HOLD_MS + STAGE_MORPH_MS,
    );
    return () => window.clearTimeout(t);
  }, [stage, stagesConfig, onClose]);

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
    // On narrow (mobile) viewports the WIDE composite scene
    // (reindeer+sleigh) tends to clip off-screen. Detect once at
    // canvas init and pass a shrink factor to composite frames so
    // the whole caravan is always visible.
    const isNarrowVw = W < 720;

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
      // Mobile shrink factors — composite (wide horizontal scene)
      // needs to shrink so the full caravan fits inside a portrait
      // viewport without clipping.
      const shrink = isNarrowVw
        ? (cfg.kind === 'composite' ? 0.72 : 1)
        : 1;
      const sc = scaleBase * cfg.scale * shrink;
      return [cx + p.x * sc, cy + p.y * sc];
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
      onClick={() => {
        // On the gift stage, tap OPENS the gift (advances to heart).
        // On any other stage, tap closes the reveal.
        const cfg = stagesConfig[stage];
        if (cfg?.kind === 'gift') {
          setStage(s => s + 1);
        } else {
          onClose?.();
        }
      }}
    >
      {/* ── STARS twinkling in the sky (behind everything) ─── */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
        {Array.from({ length: 90 }).map((_, i) => {
          const s = ((i + 100) * 2654435761) >>> 0;
          const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
          const size = 1 + r(1) * 2.2;
          const opacity = 0.4 + r(2) * 0.55;
          return (
            <motion.div
              key={`bg-star-${i}`}
              className="absolute rounded-full"
              style={{
                left: `${r(3) * 100}%`,
                top: `${r(4) * 60}%`,
                width: size,
                height: size,
                background: '#fff',
                boxShadow: size > 1.8 ? `0 0 ${size * 3}px rgba(255,255,255,0.8)` : `0 0 ${size * 2}px rgba(255,255,255,0.4)`,
              }}
              animate={{ opacity: [opacity * 0.35, opacity, opacity * 0.35] }}
              transition={{ duration: 3 + r(5) * 4, delay: r(6) * 6, repeat: Infinity, ease: 'easeInOut' }}
            />
          );
        })}
      </div>

      {/* ── DISTANT MOUNTAIN RIDGE + PINE FOREST + SNOWY GROUND ─── */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ zIndex: 1, height: '38%' }}>
        <svg viewBox="0 0 1200 380" preserveAspectRatio="none" width="100%" height="100%" style={{ display: 'block' }}>
          {/* Warm horizon glow — soft amber haze behind the mountains,
              like a distant fireplace warmth spilling into the night */}
          <defs>
            <linearGradient id="horizon-warm" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%"  stopColor="rgba(251,191,36,0)" />
              <stop offset="55%" stopColor="rgba(251,191,36,0.18)" />
              <stop offset="100%" stopColor="rgba(244,63,94,0.10)" />
            </linearGradient>
          </defs>
          <rect x="0" y="90" width="1200" height="140" fill="url(#horizon-warm)" />

          {/* Far mountains */}
          <path
            d="M 0 380 L 0 200 L 120 120 L 240 180 L 360 110 L 480 170 L 600 100 L 720 160 L 840 120 L 960 180 L 1080 130 L 1200 190 L 1200 380 Z"
            fill="#141828"
          />
          {/* Snow caps on tallest peaks */}
          <path d="M 120 120 L 100 135 L 140 135 Z" fill="#e0e7ff" opacity="0.85" />
          <path d="M 360 110 L 340 128 L 380 128 Z" fill="#e0e7ff" opacity="0.85" />
          <path d="M 600 100 L 580 120 L 620 120 Z" fill="#e0e7ff" opacity="0.85" />
          <path d="M 840 120 L 820 135 L 860 135 Z" fill="#e0e7ff" opacity="0.85" />

          {/* DISTANT COTTAGE · tiny warm-lit house on a hillside far
              away, always visible — feels like "home is close by" */}
          <g transform="translate(940 216)">
            {/* halo behind house */}
            <ellipse cx="0" cy="8" rx="42" ry="12" fill="rgba(253,224,138,0.35)" />
            {/* house body */}
            <rect x="-14" y="-6" width="28" height="18" fill="#2a1810" />
            {/* roof */}
            <path d="M -18 -4 L 0 -18 L 18 -4 Z" fill="#3a2010" />
            <path d="M -18 -4 L 0 -18 L 18 -4 L 15 -2 L 0 -14 L -15 -2 Z" fill="#f0f5ff" />
            {/* 2 warm windows */}
            <rect x="-9" y="0" width="7" height="7" fill="#fbbf24" />
            <rect x="2"  y="0" width="7" height="7" fill="#fde68a" />
            {/* chimney + smoke wisp */}
            <rect x="8" y="-14" width="4" height="8" fill="#2a1810" />
            <path d="M 10 -14 Q 8 -22 12 -28" fill="none" stroke="rgba(200,200,210,0.4)" strokeWidth="1.5" strokeLinecap="round" />
          </g>

          {/* Pine forest — back row */}
          <g fill="#05070f">
            {Array.from({ length: 24 }).map((_, i) => {
              const x = 20 + i * 50;
              const h = 32 + ((i * 37) % 22);
              return (
                <polygon key={`back-${i}`} points={`${x - 12},280 ${x},${280 - h} ${x + 12},280`} />
              );
            })}
          </g>

          {/* CHRISTMAS LIGHTS on back-row pines — warm amber dots
              scattered like festive fairy lights strung across trees */}
          <g>
            {Array.from({ length: 36 }).map((_, i) => {
              const s = ((i + 42) * 2654435761) >>> 0;
              const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
              const x = 30 + r(1) * 1140;
              const y = 240 + r(2) * 40;
              const size = 2 + r(3) * 1.5;
              const colors = ['#fbbf24', '#f43f5e', '#22c55e', '#60a5fa', '#fef08a'];
              const c = colors[i % colors.length];
              return (
                <circle
                  key={`xlight-${i}`}
                  cx={x} cy={y} r={size}
                  fill={c}
                  opacity={0.85}
                  style={{ filter: `drop-shadow(0 0 4px ${c}) drop-shadow(0 0 8px ${c})` }}
                />
              );
            })}
          </g>

          {/* Pine forest — front row (bigger, darker) */}
          <g fill="#03050c">
            {Array.from({ length: 15 }).map((_, i) => {
              const x = 30 + i * 85;
              // Leave a gap in the middle for the couple silhouette
              if (x > 500 && x < 700) return null;
              const h = 60 + ((i * 41) % 32);
              return (
                <polygon key={`front-${i}`} points={`${x - 20},380 ${x - 4},${380 - h} ${x + 20},380`} />
              );
            })}
          </g>

          {/* Snowy ground — soft rolling drift */}
          <path
            d="M 0 380 L 0 320 Q 200 300 400 315 T 800 315 T 1200 310 L 1200 380 Z"
            fill="rgba(240,245,255,0.92)"
          />
        </svg>
      </div>

      {/* ── LANTERN on the snow near the couple — a small warm
             lantern light burning next to them so the amber halo has
             a physical source. Positioned by CSS relative to viewport. */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: '50%',
          bottom: '3%',
          transform: 'translateX(72%)',
          width: 26, height: 40,
          zIndex: 5,
        }}
      >
        <svg viewBox="0 0 26 40" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {/* halo */}
          <circle cx="13" cy="20" r="18" fill="rgba(253,224,138,0.4)" style={{ filter: 'blur(6px)' }} />
          {/* handle */}
          <path d="M 8 3 Q 13 -1 18 3" fill="none" stroke="#8b6f5a" strokeWidth="1.2" />
          {/* top cap */}
          <rect x="8" y="4" width="10" height="3" fill="#5a3f2a" />
          {/* body — glowing warm interior */}
          <rect x="7" y="8" width="12" height="18" fill="#fbbf24" style={{ filter: 'drop-shadow(0 0 6px #fbbf24) drop-shadow(0 0 14px rgba(251,191,36,0.8))' }} />
          {/* frame lines */}
          <line x1="7" y1="8" x2="19" y2="8" stroke="#5a3f2a" strokeWidth="1" />
          <line x1="7" y1="26" x2="19" y2="26" stroke="#5a3f2a" strokeWidth="1" />
          <line x1="13" y1="8" x2="13" y2="26" stroke="#5a3f2a" strokeWidth="0.6" opacity="0.55" />
          {/* base */}
          <rect x="6" y="27" width="14" height="3" fill="#5a3f2a" />
          {/* small candle flame */}
          <ellipse cx="13" cy="17" rx="2" ry="3.5" fill="#fef3c7" />
        </svg>
      </div>

      {/* ── KISSING COUPLE SILHOUETTE · classic profile view — 2
             heads facing each other, lips touching in the middle.
             Iconic silhouette art. Man on left (short hair), woman
             on right (long flowing hair). Just the shadowy busts —
             no full bodies, no arms — the pure emotional moment. */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none flex justify-center" style={{ zIndex: 4, height: '42%' }}>
        <svg viewBox="0 0 260 260" preserveAspectRatio="xMidYEnd meet" style={{ width: 'clamp(220px, 28vw, 340px)', height: '100%', display: 'block', overflow: 'visible' }}>
          <defs>
            <radialGradient id="couple-glow" cx="50%" cy="80%" r="55%">
              <stop offset="0%"   stopColor="rgba(253,224,138,0.55)" />
              <stop offset="45%"  stopColor="rgba(251,191,36,0.24)" />
              <stop offset="100%" stopColor="rgba(251,191,36,0)" />
            </radialGradient>
          </defs>

          {/* Warm halo on the snow behind them */}
          <ellipse cx="130" cy="248" rx="130" ry="26" fill="url(#couple-glow)" />

          {/* ══════════════════════════════════════════════════════════
              MAN silhouette · PROFILE facing RIGHT — smooth graceful
              curves through: back-of-head, top skull, brow, nose
              (subtle rounded bump), philtrum indent, cupid's-bow
              upper lip, meeting-point lip, lower lip, chin curve,
              jaw, neck, sloping shoulders.
              ═══════════════════════════════════════════════════════ */}
          <path fill="#000" d="
            M 30 250
            L 30 128
            C 30 90 40 62 72 52
            C 92 46 112 52 122 66
            C 128 76 129 86 128 96
            C 128 100 129 102 130 105
            C 132 108 134 111 132 114
            C 130 116 128 117 127 119
            C 127 121 128 123 129 125
            C 129 128 130 131 130 133
            C 130 134 130 135 130 136
            C 130 138 130 140 129 141
            C 128 143 126 145 125 148
            C 123 152 122 155 122 158
            C 122 161 121 164 118 166
            C 114 168 110 170 106 173
            C 100 178 94 185 88 195
            C 78 210 65 228 50 245
            L 30 250 Z
          " />

          {/* ══════════════════════════════════════════════════════════
              WOMAN silhouette · PROFILE facing LEFT — mirror of man
              with softer feminine curves + long flowing hair.
              ═══════════════════════════════════════════════════════ */}
          <path fill="#000" d="
            M 230 250
            L 230 128
            C 230 90 220 62 188 52
            C 168 46 148 52 138 66
            C 132 76 131 86 132 96
            C 132 100 131 102 130 105
            C 128 108 126 111 128 114
            C 130 116 132 117 133 119
            C 133 121 132 123 131 125
            C 131 128 130 131 130 133
            C 130 134 130 135 130 136
            C 130 138 130 140 131 141
            C 132 143 134 145 135 148
            C 137 152 138 155 138 158
            C 138 161 139 164 142 166
            C 146 168 150 170 154 173
            C 160 178 166 185 172 195
            C 182 210 195 228 210 245
            L 230 250 Z
          " />

          {/* WOMAN'S long flowing hair — soft wavy silhouette down her back */}
          <path fill="#000" d="
            M 200 82
            C 220 100 226 130 224 165
            C 222 195 216 220 210 240
            L 240 240
            C 244 210 246 175 244 145
            C 242 115 232 90 218 74
            Z
          " />

          {/* MAN's small hair tuft at nape of neck */}
          <path fill="#000" opacity="0.85" d="
            M 45 90
            C 38 82 38 68 44 62
            C 50 58 56 60 58 66
            L 58 100 Z
          " />

          {/* Warm RIM LIGHT on the edges facing the sky — creates
              gentle silhouette outline glow like moonlight touching
              their faces */}
          <g opacity="0.55" fill="#fef3c7" style={{ filter: 'drop-shadow(0 0 4px rgba(254,243,199,0.9))' }}>
            {/* Man top of head rim */}
            <path d="M 78 55 Q 100 48 118 55 Q 100 51 78 55 Z" />
            {/* Man nose highlight */}
            <path d="M 128 92 Q 132 100 130 112 Q 129 102 128 92 Z" />
            {/* Woman top of head rim */}
            <path d="M 182 55 Q 160 48 142 55 Q 160 51 182 55 Z" />
            {/* Woman nose highlight */}
            <path d="M 132 92 Q 128 100 130 112 Q 131 102 132 92 Z" />
          </g>

          {/* Subtle warm blush glow where their lips meet — the kiss */}
          <ellipse cx="130" cy="125" rx="16" ry="7" fill="#f9a8d4" opacity="0.28" style={{ filter: 'blur(4px)' }} />
          <circle cx="130" cy="125" r="3" fill="#f43f5e" opacity="0.6" style={{ filter: 'drop-shadow(0 0 4px #f43f5e)' }} />

          {/* Floating GLOWING HEART just above their kiss */}
          <g transform="translate(130 32)">
            <circle cx="0" cy="0" r="20" fill="rgba(244,63,94,0.32)" style={{ filter: 'blur(9px)' }} />
            <path
              d="M 0 12 C -7 6, -11 2, -11 -3 C -11 -6, -8 -8, -5 -8 C -2 -8, -1 -7, 0 -5 C 1 -7, 2 -8, 5 -8 C 8 -8, 11 -6, 11 -3 C 11 2, 7 6, 0 12 Z"
              fill="#f43f5e"
              style={{ filter: 'drop-shadow(0 0 8px rgba(244,63,94,1)) drop-shadow(0 0 18px rgba(249,168,212,0.75))' }}
            />
          </g>
        </svg>
      </div>

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

      {/* ── DRONE CANVAS ────────────────────────────────────────
             Stage 0 · gallop: horizontal jitter + bob → running feel
             Stage 1 · 3D rotateY spin around Y-axis → galaxy heart
             Other stages · stationary. */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 2, perspective: 1400 }}
        animate={
          stage === 0
            ? { y: [0, -6, 0, 6, 0], x: [0, 6, -3, 5, 0] }        // gallop bob + horizontal micro-shift
            : { y: 0, x: 0 }
        }
        transition={
          stage === 0
            ? {
                y: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
                x: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' },
              }
            : { duration: 0.4 }
        }
      >
        <motion.div
          className="absolute inset-0"
          style={{ transformStyle: 'preserve-3d' }}
          animate={stage === 2 ? { rotateY: [-18, 18, -18] } : { rotateY: 0 }}
          transition={stage === 2
            ? { duration: 6.5, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.4 }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0"
            style={{ width: '100%', height: '100%' }}
          />
        </motion.div>
      </motion.div>

      {/* ── SPARKLES around Phase 1 galaxy heart ─── */}
      {stage === 2 && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
          {Array.from({ length: 30 }).map((_, i) => {
            const s = ((i + 200) * 2654435761) >>> 0;
            const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
            const angle = (i / 30) * Math.PI * 2;
            const dist = 28 + r(1) * 12;    // vw radius around centre
            const x = 50 + Math.cos(angle) * dist;
            const y = 48 + Math.sin(angle) * dist * 0.7;
            const size = 6 + r(2) * 10;
            return (
              <motion.div
                key={`sp-${i}`}
                className="absolute"
                style={{
                  left: `${x}vw`, top: `${y}vh`,
                  width: size, height: size,
                  transform: 'translate(-50%, -50%)',
                }}
                initial={{ opacity: 0, scale: 0.3, rotate: 0 }}
                animate={{
                  opacity: [0, 1, 0.4, 1, 0],
                  scale: [0.3, 1.4, 1, 1.4, 0.6],
                  rotate: 360,
                }}
                transition={{
                  duration: 2 + r(3) * 2,
                  delay: r(4) * 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <svg viewBox="0 0 20 20" width="100%" height="100%" style={{
                  filter: 'drop-shadow(0 0 6px #fff) drop-shadow(0 0 14px #fef3c7)',
                }}>
                  <path d="M 10 0 L 12 8 L 20 10 L 12 12 L 10 20 L 8 12 L 0 10 L 8 8 Z" fill="#fef3c7" />
                </svg>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* (Removed: persistent message. Only shown on final stage
          via the existing block below.) */}

      {/* "Em Yêu" HERO TEXT · huge cursive title above the drone
          show on Phase 0. Handwritten warm rose glow — sets the
          emotional tone of the whole reveal. */}
      {stage === 0 && (
        <motion.div
          className="absolute inset-x-0 pointer-events-none text-center"
          style={{ top: '12%', zIndex: 8 }}
          initial={{ opacity: 0, y: -12, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.6, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{
            fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: 'clamp(20px, 3.4vw, 34px)',
            color: 'rgba(255,255,255,0.85)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            textShadow: '0 2px 12px rgba(0,0,0,0.7)',
            marginBottom: 6,
          }}>
            Em Yêu
          </div>
          {/* Personalized recipient name — the true hero line */}
          <div style={{
            fontFamily: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
            fontWeight: 700,
            fontSize: 'clamp(56px, 11vw, 120px)',
            color: '#fff',
            lineHeight: 1.02,
            letterSpacing: '-0.01em',
            textShadow: `
              0 4px 22px rgba(0,0,0,0.75),
              0 0 24px rgba(244,63,94,0.9),
              0 0 52px rgba(249,168,212,0.7),
              0 0 100px rgba(251,191,36,0.35)
            `,
          }}>
            {displayName}
          </div>

          {/* "Merry Xmas" letter-by-letter animation below the name */}
          <div style={{
            marginTop: 14,
            fontFamily: "'Playfair Display', Georgia, serif",
            fontStyle: 'italic',
            fontWeight: 600,
            fontSize: 'clamp(28px, 5.5vw, 56px)',
            lineHeight: 1.1,
            letterSpacing: '0.04em',
          }}>
            {'Merry Xmas'.split('').map((ch, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 14, scale: 0.4, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                transition={{
                  duration: 0.7,
                  delay: 2.4 + i * 0.18,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{
                  display: 'inline-block',
                  // Cycle through love palette per letter
                  color: ['#f43f5e', '#f472b6', '#fda4af', '#fbbf24', '#fef3c7', '#f43f5e', '#f472b6', '#fda4af', '#fbbf24', '#fef3c7'][i % 10],
                  textShadow: '0 2px 16px rgba(0,0,0,0.7), 0 0 22px rgba(244,63,94,0.85), 0 0 44px rgba(251,191,36,0.35)',
                }}
              >
                {ch === ' ' ? ' ' : ch}
              </motion.span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Stage label chip — pushed below the persistent message */}
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

      {/* (Removed: Vietnamese tap-hint text. The pulsing scale of
          the gift itself + the reveal timing signal "tap me" clearly
          enough without an on-screen text prompt.) */}

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

      {/* PHOTO GARLAND · hanging polaroid ornaments strung across the
          top of the sky in a gentle downward ARC (like a party
          banner). Each ornament drops from the top with a soft
          bounce, alternating tilt for warmth, gently swaying idle.
          Positions computed on a parametric arc so the layout reads
          as a coherent decoration, not random scatter. */}
      {isFinalStage && photos.length > 0 && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 8 }}>
          {photos.map((url, i) => {
            const n = photos.length;
            // Even fraction 0..1 across the strand
            const t = n === 1 ? 0.5 : i / (n - 1);
            // Horizontal: spread 10-90 vw
            const x = 10 + t * 80;
            // Arc: dips down in the middle like a hanging garland
            // (max sag ~4vh at t=0.5)
            const sag = 4 * Math.sin(t * Math.PI);
            const y = 22 + sag;
            // Photo tilts slightly to sit naturally on the string
            const tiltAngle = (t - 0.5) * 20;     // -10° left → +10° right
            // String length above each photo (varies slightly for depth)
            const stringLen = 8 + (i % 3) * 3;    // 8/11/14 vh
            const stringTop = y - 8;              // where string ends (top of photo)
            const stringStart = stringTop - stringLen;

            return (
              <motion.div
                key={`p-${i}`}
                className="absolute"
                style={{ left: `${x}vw`, top: 0, width: 0, height: 0 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 2.0 + i * 0.28 }}
              >
                {/* STRING · thin line from sky-top to top of ornament */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: `${stringStart}vh`,
                    height: `${stringLen}vh`,
                    width: 1,
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0.7))',
                    transform: 'translateX(-50%)',
                    filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.5))',
                  }}
                />
                {/* Tiny "pinch" knot where string meets the ornament */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: `${stringTop - 0.4}vh`,
                    width: 4, height: 4,
                    borderRadius: '50%',
                    background: '#fff',
                    transform: 'translateX(-50%)',
                    boxShadow: '0 0 4px rgba(255,255,255,0.6)',
                  }}
                />
                {/* POLAROID ornament — drops in from top, sways gently */}
                <motion.div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: `${y}vh`,
                    padding: 5,
                    paddingBottom: 14,
                    background: '#fffbf6',
                    borderRadius: 3,
                    boxShadow: `0 12px 24px rgba(0,0,0,0.6), 0 0 22px ${CYAN}33`,
                    transform: `translate(-50%, 0) rotate(${tiltAngle}deg)`,
                    transformOrigin: '50% -10%',      // pivot near the pinch knot
                  }}
                  initial={{ y: -220, rotate: tiltAngle - 25, opacity: 0 }}
                  animate={{
                    y: 0,
                    rotate: [tiltAngle, tiltAngle + 3, tiltAngle - 3, tiltAngle],
                    opacity: 1,
                  }}
                  transition={{
                    y:       { duration: 1.1, delay: 2.2 + i * 0.28, ease: [0.34, 1.25, 0.64, 1] },
                    opacity: { duration: 0.6, delay: 2.2 + i * 0.28 },
                    rotate: {
                      duration: 3 + (i % 3),
                      delay: 3.6 + i * 0.28,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    },
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    style={{
                      width: 96, height: 96,
                      objectFit: 'cover',
                      borderRadius: 2,
                      display: 'block',
                    }}
                  />
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Sender message + signature — positioned below the photo
          garland arc + above the drone text, so the eye reads:
          garland → note → title → cottage. */}
      {isFinalStage && kiss.message && (
        <motion.div
          className="absolute inset-x-0 pointer-events-none text-center px-8"
          style={{ top: '38%', zIndex: 10 }}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, delay: 1.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="max-w-lg mx-auto" style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 'clamp(18px, 2.8vw, 26px)',
            color: 'rgba(255,240,240,0.95)',
            textShadow: `
              0 2px 14px rgba(0,0,0,0.85),
              0 0 22px rgba(244,63,94,0.4),
              0 0 44px rgba(251,191,36,0.25)
            `,
            lineHeight: 1.45,
            letterSpacing: '0.01em',
          }}>
            &ldquo;{kiss.message}&rdquo;
          </div>
          {kiss.sender_name && (
            <div style={{
              marginTop: 10,
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: PINK,
              textShadow: '0 2px 8px rgba(0,0,0,0.7)',
            }}>
              — {kiss.sender_name}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
