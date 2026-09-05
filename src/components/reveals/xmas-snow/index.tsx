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
import { HeartHandshake } from 'lucide-react';
import { getKissString, parseKissData } from '../_shared/useTemplateData';
import type { TemplateProps } from '../_types';

// ─── Palette · region-specific drone colours ─────────────────────────
const PURPLE     = '#c084fc';    // reindeer
const VIOLET     = '#a78bfa';    // antlers / highlights
const PINK       = '#f472b6';    // sleigh / Santa
const CREAM      = '#fef3c7';    // text

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

function packToCount(pts: Pt[], n: number): Pt[] {
  if (pts.length === 0) return Array.from({ length: n }).map(() => ({ x: 0, y: 0 }));
  if (pts.length >= n) {
    const stride = pts.length / n;
    return Array.from({ length: n }).map((_, i) => pts[Math.floor(i * stride)]);
  }
  return Array.from({ length: n }).map((_, i) => pts[i % pts.length]);
}

// ─────────────────────────────────────────────────────────────────────
// GiftTouchHint · "touch me" typed out one letter at a time with a
// blinking cursor. Only renders while the gift stage is on screen —
// unmounts when the user taps → advances to the heart stage.
// ─────────────────────────────────────────────────────────────────────
function GiftTouchHint() {
  const [typed, setTyped] = useState('');
  const full = 'touch me';
  useEffect(() => {
    let i = 0;
    // small pause before typing starts so it doesn't sync-fire with
    // the drone morph
    const startTimer = setTimeout(() => {
      const int = setInterval(() => {
        i += 1;
        setTyped(full.slice(0, i));
        if (i >= full.length) clearInterval(int);
      }, 130);
    }, 800);
    return () => clearTimeout(startTimer);
  }, []);
  const done = typed.length >= full.length;
  return (
    <motion.div
      className="absolute inset-x-0 pointer-events-none text-center"
      style={{ bottom: '30%', zIndex: 11 }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
    >
      <div
        className="inline-block rounded-full"
        style={{
          padding: '10px 24px',
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(244,63,94,0.45)',
          backdropFilter: 'blur(8px)',
          fontFamily: "'Courier New', 'JetBrains Mono', monospace",
          fontSize: 'clamp(20px, 3.4vw, 30px)',
          fontWeight: 500,
          letterSpacing: '0.15em',
          textTransform: 'lowercase',
          color: '#fff',
          textShadow: '0 0 10px rgba(244,63,94,0.9), 0 0 22px rgba(249,168,212,0.55)',
        }}
      >
        <span>{typed}</span>
        {/* Blinking cursor — always visible, blinks slower once typed */}
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: done ? 1.0 : 0.6, repeat: Infinity, ease: 'linear' }}
          style={{ marginLeft: 3, color: '#f43f5e' }}
        >
          _
        </motion.span>
      </div>
    </motion.div>
  );
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
  // The sender's message now lives on a flippable "back of the card"
  // instead of sitting over the heart — keeps the heart moment focused
  // on the photo, and gives the message its own postcard-style beat.
  const [showBack, setShowBack] = useState(false);
  // Whether the message has EVER been opened — unlike `showBack` (which
  // toggles off once the user flips back), this stays true so the
  // reveal only refuses to close before the FIRST viewing, not every
  // time the card is face-down.
  const [messageSeen, setMessageSeen] = useState(false);
  const openMessage = () => { setShowBack(true); setMessageSeen(true); };

  // Which uploaded photo is currently showing inside the heart —
  // cycles through all of them (not just the first) so a sender who
  // uploaded several photos actually gets to show them all off.
  const [heartPhotoIdx, setHeartPhotoIdx] = useState(0);

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
      // Final stage — savour then close. But if there's a message the
      // sender hasn't seen yet, don't auto-close out from under them —
      // wait indefinitely until they've opened it at least once.
      if (kiss.message && !messageSeen) return;
      const t = window.setTimeout(() => onClose?.(), STAGE_HOLD_MS * 2.5);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(
      () => setStage(s => s + 1),
      STAGE_HOLD_MS + STAGE_MORPH_MS,
    );
    return () => window.clearTimeout(t);
  }, [stage, stagesConfig, onClose, kiss.message, messageSeen]);

  // Cycle the photo shown inside the heart — only while the heart
  // stage (2) is on screen and there's more than one to show.
  useEffect(() => {
    if (stage !== 2 || photos.length <= 1) return;
    const t = window.setInterval(() => {
      setHeartPhotoIdx(i => (i + 1) % photos.length);
    }, 2500);
    return () => window.clearInterval(t);
  }, [stage, photos.length]);

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
        // On the gift stage, tap OPENS the gift (advances to the heart).
        // On the final (heart) stage, if there's a message the sender
        // hasn't seen yet, the first tap opens it instead of closing —
        // the reveal can't be dismissed before the message is read at
        // least once. Once seen, tap closes normally like any other
        // stage.
        const cfg = stagesConfig[stage];
        if (cfg?.kind === 'gift') {
          setStage(s => s + 1);
        } else if (isFinalStage && kiss.message && !messageSeen) {
          openMessage();
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

          {/* SNOWMAN · standing on the snow bank. Scaled up + given a
              stronger halo so it reads clearly as its own character
              instead of a small background prop; the surrounding front-
              row pines are gapped (see x 80–220 skip above) so nothing
              clips it now that it's bigger. Blue scarf instead of red —
              keeps red reserved for the big heart centrepiece. */}
          <g transform="translate(150 320) scale(1.8)">
            {/* halo so it doesn't vanish into the dark background */}
            <ellipse cx="0" cy="-20" rx="26" ry="30" fill="rgba(224,231,255,0.3)" style={{ filter: 'blur(7px)' }} />
            {/* body — 3 stacked snowballs */}
            <circle cx="0" cy="-13" r="13" fill="#eef3ff" />
            <circle cx="0" cy="-31" r="9.5" fill="#f3f7ff" />
            <circle cx="0" cy="-45" r="7" fill="#f7faff" />
            {/* arms — thin twig sticks */}
            <path d="M -8 -31 L -20 -38" stroke="#6b4a2a" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            <path d="M 8 -31 L 19 -25" stroke="#6b4a2a" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            {/* scarf — blue, not red */}
            <rect x="-7" y="-39" width="14" height="4" fill="#2563eb" />
            <path d="M 4 -35 L 8 -27 L 3 -28 Z" fill="#1d4ed8" />
            {/* top hat */}
            <rect x="-8" y="-53" width="16" height="2.5" fill="#1a1a1a" />
            <rect x="-5" y="-62" width="10" height="10" fill="#1a1a1a" />
            {/* coal eyes + button mouth hint */}
            <circle cx="-2.5" cy="-46" r="1" fill="#1a1a1a" />
            <circle cx="2.5" cy="-46" r="1" fill="#1a1a1a" />
            {/* carrot nose */}
            <path d="M 0 -44 L 7 -43 L 0 -42 Z" fill="#fb923c" />
            {/* coal buttons */}
            <circle cx="0" cy="-30" r="1" fill="#1a1a1a" />
            <circle cx="0" cy="-15" r="1" fill="#1a1a1a" />
            <circle cx="0" cy="-9" r="1" fill="#1a1a1a" />
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
              // Leave a gap around the (now bigger) snowman so it doesn't clip trees
              if (x > 80 && x < 220) return null;
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

      {/* ── COUPLE · MODERN ICON approach. Instead of hand-drawn SVG
             (which came out crude no matter how much we polished it),
             use Lucide's professionally-designed HeartHandshake icon
             — 2 stylised hands meeting to form a heart — rendered
             HUGE with a warm neon glow. Clean, iconic, modern. */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none flex justify-center items-end"
        style={{ zIndex: 4, height: '38%', paddingBottom: '2vh' }}
      >
        <div style={{
          position: 'relative',
          width: 'clamp(200px, 28vw, 340px)',
          aspectRatio: '1 / 1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Warm ambient halo behind — like a lantern-lit stage */}
          <div style={{
            position: 'absolute',
            inset: '-20%',
            background: 'radial-gradient(circle at 50% 55%, rgba(244,63,94,0.35) 0%, rgba(253,224,138,0.22) 30%, transparent 68%)',
            filter: 'blur(18px)',
          }} />

          {/* HeartHandshake icon at hero size — rose stroke + amber
              glow, giving a warm hand-in-hand kiss vibe without any
              anatomy drawing. */}
          <motion.div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              color: '#f43f5e',
              filter: `
                drop-shadow(0 0 12px rgba(244,63,94,0.9))
                drop-shadow(0 0 28px rgba(249,168,212,0.6))
                drop-shadow(0 0 60px rgba(251,191,36,0.35))
              `,
            }}
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <HeartHandshake
              strokeWidth={1.4}
              size="100%"
              style={{ width: '100%', height: '100%' }}
            />
          </motion.div>

          {/* Small pulsing heart floating above the icon */}
          <div style={{
            position: 'absolute',
            top: '-6%',
            left: '50%',
            transform: 'translateX(-50%)',
          }}>
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <svg viewBox="0 0 24 24" width="34" height="34" style={{
                filter: 'drop-shadow(0 0 8px rgba(244,63,94,1)) drop-shadow(0 0 18px rgba(249,168,212,0.8))',
              }}>
                <path
                  d="M 12 21 C 4 15, 1 10, 1 6 C 1 3, 3 1, 6 1 C 9 1, 11 3, 12 5 C 13 3, 15 1, 18 1 C 21 1, 23 3, 23 6 C 23 10, 20 15, 12 21 Z"
                  fill="#f43f5e"
                />
              </svg>
            </motion.div>
          </div>
        </div>
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
             Stage 2 · 3D rotateY spin around Y-axis → galaxy heart
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

      {/* RECIPIENT NAME HERO TEXT · huge cursive title above the drone
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

      {/* GIFT stage · "touch me" typewriter hint · types out one
          letter at a time with a blinking cursor. Only visible while
          the gift box is on screen. */}
      {stagesConfig[stage]?.kind === 'gift' && (
        <GiftTouchHint />
      )}

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

      {/* PHOTO IN THE HEART · the sender's own photo, centred right
          inside the drone-formed heart (same centre the canvas uses:
          cx=W/2, cy=H*0.48) — the heart moment now doubles as a photo
          frame instead of just abstract sparkle dots. When more than
          one photo was uploaded, they cross-fade through one another
          (see the cycling effect above) instead of only ever showing
          the first. */}
      {stage === 2 && photos.length > 0 && (
        <motion.div
          className="absolute pointer-events-none"
          style={{
            left: '50%', top: '48%', width: 132, height: 132,
            marginLeft: -66, marginTop: -66, zIndex: 6,
          }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className="relative size-full overflow-hidden rounded-full"
            style={{
              border: '3px solid #fff',
              boxShadow: '0 0 0 1px rgba(244,63,94,0.5), 0 14px 40px rgba(0,0,0,0.6), 0 0 30px rgba(244,63,94,0.5)',
            }}
          >
            <AnimatePresence>
              <motion.img
                key={heartPhotoIdx}
                src={photos[heartPhotoIdx % photos.length]}
                alt=""
                className="absolute inset-0 size-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
              />
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* PHOTO KEEPSAKE · a small fanned stack of polaroids propped in
          the snow next to the lantern (not strung across the sky —
          that competed with the heart/message for attention). Warm
          gold-edge glow gives it a "worth what you paid for it" look.
          Capped at 3 shown even if more were uploaded, so the stack
          stays a tidy little pile instead of sprawling. */}
      {isFinalStage && photos.length > 0 && (
        <div
          className="absolute pointer-events-none"
          style={{ left: '50%', bottom: '9%', transform: 'translateX(28%)', zIndex: 6 }}
        >
          {photos.slice(0, 3).map((url, i) => {
            const n = Math.min(photos.length, 3);
            // Fan out from centre: middle photo (or the only one) sits
            // straight, others tilt/step to either side like a hand of
            // cards propped against the lantern.
            const mid = (n - 1) / 2;
            const off = i - mid;
            const tiltAngle = off * 11;
            const xOffset = off * 14;
            return (
              <motion.div
                key={`p-${i}`}
                className="absolute"
                style={{
                  left: xOffset,
                  bottom: 0,
                  padding: 4,
                  paddingBottom: 10,
                  background: '#fffbf6',
                  borderRadius: 3,
                  border: '1px solid #fbbf2488',
                  boxShadow: '0 10px 22px rgba(0,0,0,0.6), 0 0 18px #fbbf2455',
                  transform: `translateX(-50%) rotate(${tiltAngle}deg)`,
                  transformOrigin: '50% 100%',
                  zIndex: 10 - Math.abs(off),
                }}
                initial={{ y: 40, opacity: 0, rotate: tiltAngle }}
                animate={{ y: 0, opacity: 1, rotate: tiltAngle }}
                transition={{ duration: 0.9, delay: 2.0 + i * 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 2, display: 'block' }}
                />
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Sender message + signature — positioned below the photo
          garland arc + above the drone text, so the eye reads:
          garland → note → title → cottage. */}
      {/* "Flip the card" button — the message no longer sits over the
          heart; tapping this opens it on its own postcard-back screen.
          stopPropagation so it doesn't trigger the container's
          tap-to-close. */}
      {isFinalStage && kiss.message && !showBack && (
        <motion.button
          type="button"
          onClick={(e) => { e.stopPropagation(); openMessage(); }}
          className="absolute inset-x-0 flex justify-center cursor-pointer"
          style={{ bottom: '2%', zIndex: 12 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 2.2 }}
        >
          <span
            className="pointer-events-none inline-flex items-center gap-1.5 rounded-full"
            style={{
              padding: '8px 18px',
              background: 'rgba(0,0,0,0.55)',
              border: `1px solid ${PINK}55`,
              backdropFilter: 'blur(4px)',
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 14,
              color: 'rgba(255,255,255,0.9)',
              boxShadow: `0 0 16px ${PINK}33`,
            }}
          >
            💌 Tap to open the card
          </span>
        </motion.button>
      )}

      {/* ── POSTCARD BACK ── the message, presented like the back of a
          real greeting card (kraft paper, sender's signature) instead
          of floating text over the heart scene. Tap anywhere to flip
          back — its own onClick stops propagation from the container's
          tap-to-close. */}
      <AnimatePresence>
        {showBack && (
          <motion.div
            className="fixed inset-0 z-300 flex items-center justify-center px-6 cursor-pointer"
            style={{ background: 'rgba(2,2,18,0.88)' }}
            onClick={(e) => { e.stopPropagation(); setShowBack(false); }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="relative w-full max-w-sm overflow-hidden rounded-2xl"
              style={{
                background: 'linear-gradient(160deg, #fdf6e8 0%, #f3e6c8 100%)',
                boxShadow: '0 30px 70px rgba(0,0,0,0.6)',
                fontFamily: "'Cormorant Garamond', Georgia, serif",
              }}
              initial={{ opacity: 0, scale: 0.9, rotateY: -14 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Candy-cane stripe banner across the top */}
              <div style={{
                height: 8,
                background: 'repeating-linear-gradient(-45deg, #c1272d 0px, #c1272d 10px, #fdf6e8 10px, #fdf6e8 20px, #1a5c3a 20px, #1a5c3a 30px, #fdf6e8 30px, #fdf6e8 40px)',
              }} />

              {/* Faint scattered-snowflake texture behind the text —
                  cheap CSS radial-gradient repeat, very low opacity so
                  it reads as paper texture, not clutter. */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: 'radial-gradient(circle, #c1272d22 1.5px, transparent 1.5px), radial-gradient(circle, #1a5c3a1f 1.5px, transparent 1.5px)',
                  backgroundSize: '38px 38px, 26px 26px',
                  backgroundPosition: '0 0, 13px 13px',
                }}
              />

              {/* Gold double-line frame, inset from the card edge */}
              <div
                className="pointer-events-none absolute rounded-xl"
                style={{ inset: 10, border: '1px solid #c9973bcc' }}
              />
              <div
                className="pointer-events-none absolute rounded-lg"
                style={{ inset: 14, border: '1px solid #c9973b55' }}
              />

              {/* Holly sprig corner ornaments */}
              <svg width="46" height="46" viewBox="0 0 46 46" className="pointer-events-none absolute left-2 top-3" style={{ opacity: 0.9 }}>
                <g fill="#1a5c3a">
                  <path d="M6 20 C2 14 6 6 14 8 C12 2 20 0 22 6 C28 2 34 8 30 14 C36 14 36 22 30 22 C34 28 26 32 22 26 C20 32 12 30 12 24 C6 26 2 20 6 20 Z" />
                </g>
                <circle cx="16" cy="14" r="3" fill="#c1272d" />
                <circle cx="24" cy="10" r="3" fill="#c1272d" />
                <circle cx="12" cy="21" r="3" fill="#c1272d" />
              </svg>
              <svg width="46" height="46" viewBox="0 0 46 46" className="pointer-events-none absolute right-2 top-3" style={{ opacity: 0.9, transform: 'scaleX(-1)' }}>
                <g fill="#1a5c3a">
                  <path d="M6 20 C2 14 6 6 14 8 C12 2 20 0 22 6 C28 2 34 8 30 14 C36 14 36 22 30 22 C34 28 26 32 22 26 C20 32 12 30 12 24 C6 26 2 20 6 20 Z" />
                </g>
                <circle cx="16" cy="14" r="3" fill="#c1272d" />
                <circle cx="24" cy="10" r="3" fill="#c1272d" />
                <circle cx="12" cy="21" r="3" fill="#c1272d" />
              </svg>

              <div className="relative px-8 pb-8 pt-11 text-center">
                <div style={{ fontSize: 20, marginBottom: 14, letterSpacing: 4 }}>✨ 🎄 ✨</div>
                <p
                  className="italic"
                  style={{ fontSize: 'clamp(17px, 3vw, 21px)', color: '#3a2a1a', lineHeight: 1.55 }}
                >
                  &ldquo;{kiss.message}&rdquo;
                </p>
                {kiss.sender_name && (
                  <>
                    <div style={{ margin: '16px auto 0', width: 60, height: 1, background: '#c9973b99' }} />
                    <div style={{
                      marginTop: 12,
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: '#a8471f',
                    }}>
                      — {kiss.sender_name}
                    </div>
                  </>
                )}
                <div
                  className="mt-6 text-xs"
                  style={{ color: '#8a7250', fontFamily: "'Inter', sans-serif" }}
                >
                  Tap to flip the card back
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
