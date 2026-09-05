'use client';

// Santa Delivery — Drone Show Reveal, deliberately a DIFFERENT story
// from "Snow Fall" (xmas-snow): that one is reindeer-in-the-sky →
// gift box → heart. This one follows Santa himself across the
// rooftops:
//
//   Stage 0  🦌🛷 Santa's sleigh, pulled by a reindeer, leaping onward
//   Stage 1  🎄   The tree, with presents already waiting underneath
//   Stage 2  😊   Santa's big jolly face, then the snowball game
//
// Background is a city/village ROOFTOP skyline (not mountains + pine
// forest), with one chimney puffing smoke — reinforcing "Santa was
// just here." The final message doesn't use a flip-card like Snow
// Fall; it's a wax-sealed scroll the recipient breaks open.
//
// Reuses the same proven drone-morph ENGINE (RAF loop, canvas setup,
// point-packing, twinkling stars, snowfall) as xmas-snow — only the
// silhouettes being drawn and the finale mechanic are new.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { getKissString, parseKissData } from '../_shared/useTemplateData';
import type { TemplateProps, TemplateConfig } from '../_types';

const DRONE_COUNT = 1200;
const STAGE_HOLD_MS  = 5000;
const STAGE_MORPH_MS = 1800;

type Pt = { x: number; y: number; color?: string };

// ─────────────────────────────────────────────────────────────────────
// Santa's sleigh, pulled by a reindeer — the classic grouping (per the
// reference photo the sender asked for), built from 3 layered emoji
// glyphs sampled together into ONE point cloud, same technique Snow
// Fall's stage 0 uses for its own reindeer+sleigh (proven at this
// drone count — hand-drawn full figures kept coming out crude no
// matter how much they were tuned, emoji silhouettes read cleanly).
// Region colours picked by position, not the emoji's own colours (the
// alpha channel is all that's sampled) — reindeer brown, Santa
// red/white, sleigh red/gold, distinct from Snow Fall's purple/pink so
// the two templates still don't look identical.
// ─────────────────────────────────────────────────────────────────────
function sampleSantaSleighComposite(): Pt[] {
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

  // Sleigh, trailing behind (left)
  ctx.fillText('🛷', W * 0.38, H * 0.58);

  // Reindeer, flipped to face right so it reads as pulling forward
  ctx.save();
  ctx.translate(W * 0.68, H * 0.5);
  ctx.scale(-1, 1);
  ctx.fillText('🦌', 0, 0);
  ctx.restore();

  // Santa, smaller, sitting up in the sleigh
  ctx.font = `${Math.floor(emojiSize * 0.55)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.fillText('🎅', W * 0.40, H * 0.30);

  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: Pt[] = [];
  const stride = 4;
  const cx = W / 2, cy = H / 2;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        const nx = (x - cx) / cx;
        const ny = (y - cy) / cx;
        // NOTE: speckle moduli below (7, 9, 11) are deliberately NOT
        // multiples of `stride` (4) — a modulus sharing a factor with
        // the stride makes (x+y) land on the same residue every time
        // (verified via a throwaway render: %4 came out solid white,
        // no speckle at all), so the mix collapses to one flat colour.
        let color: string;
        if (nx > 0.05)      color = (x + y) % 7 < 2  ? '#b5793a' : '#92600b';  // reindeer — brown
        else if (ny < -0.12) color = (x + y) % 9 < 3  ? '#fff'    : '#dc2626'; // Santa — red/white
        else                 color = (x + y) % 11 < 2 ? '#fbbf24' : '#7f1d1d'; // sleigh — red/gold
        pts.push({ x: nx, y: ny, color });
      }
    }
  }
  return pts;
}

// ─────────────────────────────────────────────────────────────────────
// The tree — 4-tier pine with a star topper, plus two small presents
// already waiting at its base (this template skips the "tap a gift
// box open" beat entirely, since Snow Fall already owns that moment).
// ─────────────────────────────────────────────────────────────────────
function drawTreeWithGifts(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const cx = W / 2;
  const cy = H / 2;
  const s = Math.min(W, H) * 0.32;

  ctx.fillStyle = '#fff';

  const tiers = [
    { apexY: cy - s * 1.05, baseY: cy - s * 0.62, halfW: s * 0.34 },
    { apexY: cy - s * 0.75, baseY: cy - s * 0.28, halfW: s * 0.54 },
    { apexY: cy - s * 0.40, baseY: cy + s * 0.06, halfW: s * 0.75 },
    { apexY: cy - s * 0.06, baseY: cy + s * 0.40, halfW: s * 0.95 },
  ];
  for (const t of tiers) {
    ctx.beginPath();
    ctx.moveTo(cx, t.apexY);
    ctx.lineTo(cx + t.halfW, t.baseY);
    ctx.lineTo(cx - t.halfW, t.baseY);
    ctx.closePath();
    ctx.fill();
  }

  // Trunk
  ctx.fillRect(cx - s * 0.11, cy + s * 0.40, s * 0.22, s * 0.26);

  // Star topper
  const topY = cy - s * 1.05;
  ctx.beginPath();
  ctx.moveTo(cx, topY - s * 0.16);
  ctx.lineTo(cx + s * 0.07, topY - s * 0.02);
  ctx.lineTo(cx + s * 0.16, topY);
  ctx.lineTo(cx + s * 0.07, topY + s * 0.02);
  ctx.lineTo(cx, topY + s * 0.16);
  ctx.lineTo(cx - s * 0.07, topY + s * 0.02);
  ctx.lineTo(cx - s * 0.16, topY);
  ctx.lineTo(cx - s * 0.07, topY - s * 0.02);
  ctx.closePath();
  ctx.fill();

  // Two presents at the base, flanking the trunk
  ctx.fillRect(cx - s * 0.62, cy + s * 0.32, s * 0.34, s * 0.30);
  ctx.fillRect(cx - s * 0.53, cy + s * 0.26, s * 0.16, s * 0.06); // ribbon
  ctx.fillRect(cx + s * 0.30, cy + s * 0.24, s * 0.30, s * 0.38);
  ctx.fillRect(cx + s * 0.43, cy + s * 0.16, s * 0.06, s * 0.18); // ribbon
}

function sampleTreeWithGifts(): Pt[] {
  if (typeof document === 'undefined') return [];
  const W = 700, H = 700;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  drawTreeWithGifts(ctx, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: Pt[] = [];
  const stride = 4;
  const cx = W / 2, cy = H / 2;
  let idx = 0;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        const nx = (x - cx) / cx;
        const ny = (y - cy) / cx;
        let color: string;
        if (ny < -0.95)            color = '#fbbf24';                                    // star
        else if (ny > 0.38 && Math.abs(nx) < 0.13) color = '#7c4a24';                     // trunk
        else if (nx < -0.28 && ny > 0.24) color = idx % 5 === 0 ? '#fff' : '#dc2626';     // gift 1 (red)
        else if (nx > 0.28 && ny > 0.14)  color = idx % 5 === 0 ? '#fff' : '#15803d';     // gift 2 (green)
        else if (idx % 17 === 0)   color = '#fbbf24';                                     // ornament — gold
        else if (idx % 23 === 0)   color = '#f43f5e';                                     // ornament — red
        else if (ny < -0.60)       color = '#4ade80';
        else if (ny < -0.25)       color = '#22c55e';
        else if (ny < 0.05)        color = '#16a34a';
        else                       color = '#15803d';
        idx++;
        pts.push({ x: nx, y: ny, color });
      }
    }
  }
  return pts;
}

// ─────────────────────────────────────────────────────────────────────
// Santa's face — the finale. Big round face, fur-trimmed hat, huge
// fluffy beard. Fine detail (eyes, individual curls) wouldn't survive
// ~1200-drone sampling anyway, so this stays bold: hat / face / beard
// as three clean regions.
// ─────────────────────────────────────────────────────────────────────
function drawSantaFace(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const cx = W / 2;
  const cy = H / 2;
  const s = Math.min(W, H) * 0.36;

  ctx.fillStyle = '#fff';

  // Big fluffy beard — wide, low
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.28, s * 0.78, s * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();

  // Face
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.05, s * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Moustache — two soft curls under the nose
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.22, cy + s * 0.14, s * 0.22, s * 0.11, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + s * 0.22, cy + s * 0.14, s * 0.22, s * 0.11, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Hat brim across the forehead
  ctx.beginPath();
  ctx.ellipse(cx, cy - s * 0.42, s * 0.56, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hat cone + pompom
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy - s * 0.5);
  ctx.quadraticCurveTo(cx - s * 0.1, cy - s * 1.15, cx + s * 0.45, cy - s * 0.85);
  ctx.quadraticCurveTo(cx + s * 0.15, cy - s * 0.6, cx + s * 0.5, cy - s * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.48, cy - s * 0.88, s * 0.14, 0, Math.PI * 2);
  ctx.fill();
}

function sampleSantaFace(): Pt[] {
  if (typeof document === 'undefined') return [];
  const W = 700, H = 700;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  drawSantaFace(ctx, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: Pt[] = [];
  const stride = 3;
  const cx = W / 2, cy = H / 2;
  let idx = 0;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        const nx = (x - cx) / cx;
        const ny = (y - cy) / cx;
        let color: string;
        if (ny < -0.55)             color = idx % 4 === 0 ? '#fff' : '#dc2626';           // hat + pompom
        else if (ny < -0.32)        color = '#fff';                                       // brim
        else if (ny < 0.18 && Math.abs(nx) < 0.4)
          color = idx % 5 === 0 ? '#f9a8a8' : '#ffe8d6';                                  // face + rosy cheeks
        else                        color = idx % 25 === 0 ? '#ffe8d6' : '#fff';          // beard + moustache
        idx++;
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
// WaxSealScroll — the finale's message mechanic. A sealed parchment
// scroll instead of Snow Fall's flip-postcard: tapping "Break the
// seal" cracks the wax emblem away, then the scroll unfurls to show
// the sender's note.
// ─────────────────────────────────────────────────────────────────────
function WaxSealScroll({ message, senderName, open, locked, onOpen, onClose }: {
  message: string; senderName?: string; open: boolean; locked: boolean;
  onOpen: () => void; onClose: () => void;
}) {
  return (
    <>
      {!open && !locked && (
        <motion.div
          className="absolute inset-x-0 flex justify-center"
          style={{ bottom: '2%', zIndex: 12 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 2.2 }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            className="cursor-pointer"
          >
            <span
              className="pointer-events-none inline-flex items-center gap-1.5 rounded-full"
              style={{
                padding: '8px 18px',
                background: 'rgba(0,0,0,0.55)',
                border: '1px solid #dc262655',
                backdropFilter: 'blur(4px)',
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 14,
                color: 'rgba(255,255,255,0.9)',
                boxShadow: '0 0 16px #dc262633',
              }}
            >
              🕯️ Break the seal
            </span>
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-300 flex items-center justify-center px-6 cursor-pointer"
            style={{ background: 'rgba(2,2,18,0.88)' }}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="relative w-full max-w-sm flex flex-col items-center">
              {/* Wax seal — cracks away once the scroll starts unfurling */}
              <motion.div
                className="absolute z-10 flex items-center justify-center rounded-full"
                style={{
                  top: -18, width: 56, height: 56,
                  background: 'radial-gradient(circle at 35% 30%, #ef4444, #991b1b 70%)',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.6)',
                  fontSize: 22, color: '#fecaca',
                }}
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: [0, 1.15, 1], rotate: [10, -6, 0], opacity: [1, 1, 0] }}
                transition={{ duration: 1.1, times: [0, 0.5, 1], delay: 0.15 }}
              >
                ✦
              </motion.div>

              <motion.div
                className="w-full overflow-hidden rounded-lg px-7 py-9 text-center"
                style={{
                  background: 'linear-gradient(160deg, #ede0c0 0%, #d9c69a 100%)',
                  boxShadow: '0 30px 70px rgba(0,0,0,0.6)',
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  transformOrigin: 'top center',
                }}
                initial={{ scaleY: 0.12, opacity: 0.5 }}
                animate={{ scaleY: 1, opacity: 1 }}
                exit={{ scaleY: 0.12, opacity: 0 }}
                transition={{ duration: 0.7, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 1.1 }}
                >
                  <div style={{ fontSize: 20, marginBottom: 14 }}>🎅 ✨</div>
                  <p className="italic" style={{ fontSize: 'clamp(17px, 3vw, 21px)', color: '#3a2a1a', lineHeight: 1.55 }}>
                    &ldquo;{message}&rdquo;
                  </p>
                  {senderName && (
                    <>
                      <div style={{ margin: '16px auto 0', width: 60, height: 1, background: '#8a4a1a99' }} />
                      <div style={{
                        marginTop: 12, fontFamily: "'Inter', sans-serif", fontSize: 12,
                        fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#8a3e1a',
                      }}>
                        — {senderName}
                      </div>
                    </>
                  )}
                  <div className="mt-6 text-xs" style={{ color: '#7a6640', fontFamily: "'Inter', sans-serif" }}>
                    Tap to roll the scroll back up
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function XmasSantaReveal({ kiss, onClose }: TemplateProps) {
  const rawName = (getKissString(kiss, 'name') || kiss.receiver_name || '').trim();

  // Photos array (same fallback pattern as Snow Fall: an uploaded
  // `photos` array, or a single legacy `photo` field).
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
  const [showScroll, setShowScroll] = useState(false);
  const [messageSeen, setMessageSeen] = useState(false);
  const openMessage = () => { setShowScroll(true); setMessageSeen(true); };

  // ── Surprise cannon (final stage only) — gifts/snow fall purely as
  // ambient background (same loop-animation pattern used throughout);
  // pressing the FIRE button is the entire game. Every press launches
  // one of three projectile kinds — a photo, a bomb, or a festive word
  // — at a random point on screen and always counts toward unlocking
  // the letter, so there's nothing to aim at and nothing to miss.
  const SNOWBALL_TARGET = 6;
  const FIRE_TEXTS = ['XMAS', 'I love you'];
  const [snowballScore, setSnowballScore] = useState(0);
  const [snowballBursts, setSnowballBursts] = useState<{
    id: number; x: number; y: number; originX: number; originY: number;
    kind: 'photo' | 'bomb' | 'text'; counts: boolean;
    photoUrl?: string; text?: string;
  }[]>([]);
  const burstIdRef = useRef(0);
  const gameWon = snowballScore >= SNOWBALL_TARGET;
  // Whole final-stage layer flinches on a launch — one-off imperative
  // animation (not state-driven) so it doesn't fight the layer's own
  // static positioning the rest of the time. Bombs kick harder.
  const shakeControls = useAnimationControls();

  // A short onboarding hint at the start of the final stage, and a
  // brief celebration banner the moment the player wins — makes the
  // game's goal and outcome unmistakable instead of just quietly
  // appearing/unlocking.
  const [showHint, setShowHint] = useState(true);
  const [showWinBanner, setShowWinBanner] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShowHint(false), 4500);
    return () => window.clearTimeout(t);
  }, []);

  // Firework burst positions for the win celebration — fixed layout
  // (not re-rolled per win) so it's just as pretty every time.
  const fireworkBursts = useMemo(() => {
    const COLORS = ['#f87171', '#fbbf24', '#86efac', '#60a5fa', '#f9a8d4', '#fde047'];
    const COUNT = 5;
    return Array.from({ length: COUNT }).map((_, i) => {
      const s = ((i + 900) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      return {
        x: 12 + r(1) * 76,
        y: 10 + r(2) * 38,
        delay: r(3) * 0.5,
        color: COLORS[i % COLORS.length],
        particles: 14,
      };
    });
  }, []);

  const fireButtonPress = () => {
    if (gameWon || typeof window === 'undefined') return;

    const id = ++burstIdRef.current;
    // Fixed launch point — bottom-centre, like a slingshot/cannon.
    const originX = window.innerWidth / 2;
    const originY = window.innerHeight * 0.94;
    // Target: a random point across the upper half of the screen —
    // there's no specific thing being aimed at any more.
    const x = window.innerWidth * (0.15 + Math.random() * 0.7);
    const y = window.innerHeight * (0.15 + Math.random() * 0.35);

    // Pick a kind — photo only available if the sender uploaded one.
    const roll = Math.random();
    let kind: 'photo' | 'bomb' | 'text';
    let photoUrl: string | undefined;
    let text: string | undefined;
    if (photos.length > 0 && roll < 0.4) {
      kind = 'photo';
      photoUrl = photos[Math.floor(Math.random() * photos.length)];
    } else if (roll < (photos.length > 0 ? 0.7 : 0.5)) {
      kind = 'bomb';
    } else {
      kind = 'text';
      text = FIRE_TEXTS[Math.floor(Math.random() * FIRE_TEXTS.length)];
    }

    // Only a PHOTO landing counts toward the target — bombs and flying
    // words are just for fun, they don't advance the score. (If the
    // sender never uploaded a photo, nothing can ever be a "photo"
    // launch, so fall back to counting every launch — otherwise the
    // game could never be won.)
    const countsTowardScore = photos.length > 0 ? kind === 'photo' : true;
    if (countsTowardScore) {
      const next = Math.min(SNOWBALL_TARGET, snowballScore + 1);
      setSnowballScore(next);
      if (next >= SNOWBALL_TARGET) {
        setShowWinBanner(true);
        window.setTimeout(() => setShowWinBanner(false), 2200);
        // Auto-open the letter once the celebration has had its moment —
        // no need to make the player go find and tap "Break the seal".
        if (kiss.message) window.setTimeout(() => openMessage(), 2300);
      }
    }

    setSnowballBursts(b => [...b, { id, x, y, originX, originY, kind, counts: countsTowardScore, photoUrl, text }]);
    shakeControls.start(
      kind === 'bomb'
        ? { x: [0, -12, 11, -8, 6, -3, 0], y: [0, 8, -7, 5, -4, 2, 0] }
        : { x: [0, -5, 5, -3, 3, 0], y: [0, 3, -3, 2, -2, 0] },
      { duration: kind === 'bomb' ? 0.42 : 0.3, ease: 'easeOut' },
    );
    // Long enough to outlast the slowest reveal (photo/text hold for a
    // beat before fading) — cleaning up any earlier would yank it away
    // mid-animation instead of letting it finish.
    window.setTimeout(() => setSnowballBursts(b => b.filter(b2 => b2.id !== id)), 2000);
  };

  const stagesConfig = useMemo(() => (
    [
      { kind: 'santa', color: undefined, scale: 1.05, label: '🦌🛷 Santa’s sleigh, on its way' },
      { kind: 'tree',  color: undefined, scale: 0.55, label: '🎄 Presents already waiting' },
      { kind: 'face',  color: undefined, scale: 0.62, label: '😊 Ho Ho Ho' },
    ] as const
  ), []);

  const stagePoints = useMemo(() => {
    if (typeof document === 'undefined') return [];
    return stagesConfig.map(cfg => {
      let raw: Pt[] = [];
      if (cfg.kind === 'santa') raw = sampleSantaSleighComposite();
      else if (cfg.kind === 'tree')  raw = sampleTreeWithGifts();
      else if (cfg.kind === 'face')  raw = sampleSantaFace();
      return packToCount(raw, DRONE_COUNT);
    });
  }, [stagesConfig]);

  useEffect(() => {
    const cfg = stagesConfig[stage];
    if (!cfg) return;
    if (stage === stagesConfig.length - 1) {
      if (kiss.message && !messageSeen) return;
      const t = window.setTimeout(() => onClose?.(), STAGE_HOLD_MS * 2.5);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setStage(s => s + 1), STAGE_HOLD_MS + STAGE_MORPH_MS);
    return () => window.clearTimeout(t);
  }, [stage, stagesConfig, onClose, kiss.message, messageSeen]);

  const latestStageRef = useRef(0);
  useEffect(() => { latestStageRef.current = stage; }, [stage]);

  useEffect(() => {
    if (typeof window === 'undefined' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || stagePoints.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = W / 2;
    const cy = H * 0.46;
    const scaleBase = Math.min(W, H) * 0.9;
    // The reindeer+sleigh composite is WIDE — on a narrow phone
    // viewport it clips off both edges unless shrunk (same fix Snow
    // Fall's own composite scene needed).
    const isNarrowVw = W < 720;

    type Drone = { x: number; y: number; fromX: number; fromY: number; color: string; size: number; twinkle: number; morphStart: number };
    const drones: Drone[] = [];
    for (let i = 0; i < DRONE_COUNT; i++) {
      const sx = (Math.random() - 0.5) * W * 1.4;
      const sy = (Math.random() - 0.5) * H * 1.4;
      drones.push({
        x: cx + sx, y: cy + sy, fromX: cx + sx, fromY: cy + sy,
        color: stagePoints[0]?.[i]?.color || '#dc2626',
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
      const shrink = isNarrowVw && cfg.kind === 'santa' ? 0.72 : 1;
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

    const syncInterval = window.setInterval(() => { currentStage = latestStageRef.current; }, 100);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.clearInterval(syncInterval);
    };
  }, [stagePoints, stagesConfig]);

  const isFinalStage = stage === stagesConfig.length - 1;

  // Mostly snowflakes, with a handful of tiny gift boxes falling
  // amongst them — same motion, just a different glyph every so often.
  const snowflakes = useMemo(() => (
    Array.from({ length: 90 }).map((_, i) => {
      const s = ((i + 1) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      const isGift = r(7) > 0.88;
      return {
        left: r(1) * 100,
        size: isGift ? 14 + r(2) * 8 : 3 + r(2) * 9,
        delay: r(3) * 10,
        dur: 10 + r(4) * 12,
        sway: (r(5) - 0.5) * 60,
        opacity: 0.35 + r(6) * 0.55,
        rotate: (r(8) - 0.5) * 90,
        isGift,
      };
    })
  ), []);

  return (
    <div
      className="fixed inset-0 z-200 overflow-hidden select-none"
      style={{ background: '#020212', fontFamily: "'Playfair Display', Georgia, serif" }}
      onClick={() => {
        // While the game is still on, a background tap does nothing —
        // the FIRE button is the only way to launch a projectile now,
        // so a stray tap can't be mistaken for progress.
        if (isFinalStage && !gameWon) return;
        if (isFinalStage && kiss.message && !messageSeen) {
          openMessage();
        } else if (isFinalStage) {
          onClose?.();
        }
      }}
    >
      {/* ── STARS ── */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
        {Array.from({ length: 80 }).map((_, i) => {
          const s = ((i + 100) * 2654435761) >>> 0;
          const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
          const size = 1 + r(1) * 2.2;
          const opacity = 0.4 + r(2) * 0.55;
          return (
            <motion.div
              key={`star-${i}`}
              className="absolute rounded-full"
              style={{
                left: `${r(3) * 100}%`, top: `${r(4) * 55}%`, width: size, height: size,
                background: '#fff',
                boxShadow: size > 1.8 ? `0 0 ${size * 3}px rgba(255,255,255,0.8)` : `0 0 ${size * 2}px rgba(255,255,255,0.4)`,
              }}
              animate={{ opacity: [opacity * 0.35, opacity, opacity * 0.35] }}
              transition={{ duration: 3 + r(5) * 4, delay: r(6) * 6, repeat: Infinity, ease: 'easeInOut' }}
            />
          );
        })}
        {/* Moon, top-right */}
        <div
          className="absolute rounded-full"
          style={{
            top: '5%', right: '8%', width: 70, height: 70,
            background: 'radial-gradient(circle at 35% 30%, #fffdf5, #f6c46a 70%)',
            boxShadow: '0 0 40px rgba(246,196,106,0.55), 0 0 90px rgba(246,196,106,0.25)',
          }}
        />
      </div>

      {/* ── ROOFTOP SKYLINE — distinct from Snow Fall's mountain forest.
             Flat + peaked rooftops, ONE prominent chimney with smoke,
             snow-capped edges. ── */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ zIndex: 1, height: '34%' }}>
        <svg viewBox="0 0 1200 340" preserveAspectRatio="none" width="100%" height="100%" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="santa-horizon" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(220,38,38,0)" />
              <stop offset="60%" stopColor="rgba(220,38,38,0.14)" />
              <stop offset="100%" stopColor="rgba(251,191,36,0.10)" />
            </linearGradient>
          </defs>
          <rect x="0" y="60" width="1200" height="140" fill="url(#santa-horizon)" />

          {/* Rooftop silhouettes — alternating peaked + flat buildings */}
          <g fill="#0c0e1c">
            <polygon points="0,340 0,220 80,220 80,180 160,220 160,340" />
            <rect x="160" y="200" width="140" height="140" />
            <polygon points="300,340 300,190 380,150 460,190 460,340" />
            <rect x="460" y="230" width="120" height="110" />
            <polygon points="580,340 580,170 660,120 740,170 740,340" />
            <rect x="740" y="210" width="150" height="130" />
            <polygon points="890,340 890,180 960,140 1030,180 1030,340" />
            <rect x="1030" y="220" width="170" height="120" />
          </g>

          {/* Snow caps on the peaked roofs */}
          <path d="M 80 180 L 60 200 L 100 200 Z" fill="#e0e7ff" opacity="0.85" />
          <path d="M 380 150 L 358 172 L 402 172 Z" fill="#e0e7ff" opacity="0.85" />
          <path d="M 660 120 L 636 144 L 684 144 Z" fill="#e0e7ff" opacity="0.85" />
          <path d="M 960 140 L 936 164 L 984 164 Z" fill="#e0e7ff" opacity="0.85" />

          {/* Warm-lit windows scattered across the flat buildings */}
          <g>
            {[
              [190, 230], [190, 260], [230, 245], [500, 260], [500, 290],
              [780, 240], [780, 270], [820, 255], [1070, 250], [1110, 265],
            ].map(([wx, wy], i) => (
              <rect key={`win-${i}`} x={wx} y={wy} width="10" height="10" fill={i % 2 === 0 ? '#fbbf24' : '#fde68a'} opacity="0.9" />
            ))}
          </g>

          {/* THE chimney — on the tallest peaked roof, with a smoke wisp */}
          <g transform="translate(660 120)">
            <rect x="14" y="-30" width="16" height="26" fill="#2a1810" />
            <rect x="12" y="-32" width="20" height="4" fill="#1a1006" />
            <path d="M 22 -32 Q 18 -46 26 -56 Q 34 -66 28 -78" fill="none" stroke="rgba(210,210,220,0.4)" strokeWidth="2.4" strokeLinecap="round" />
          </g>

          {/* Snowy ground strip */}
          <path
            d="M 0 340 L 0 300 Q 200 288 400 298 T 800 298 T 1200 292 L 1200 340 Z"
            fill="rgba(240,245,255,0.92)"
          />
        </svg>
      </div>

      {/* ── SNOWFALL — flakes + occasional gift boxes, on every stage
             including the final one, as ambient background behind the
             interactive falling-photo game (not tappable themselves —
             pointer-events none). ── */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
        {snowflakes.map((f, i) => (
          <motion.div
            key={`flake-${i}`}
            className="absolute"
            style={{
              left: `${f.left}%`, top: '-8%', fontSize: f.size, opacity: f.opacity,
              color: '#fff', textShadow: f.isGift ? undefined : '0 0 4px rgba(255,255,255,0.5)',
            }}
            initial={{ y: 0, x: 0, rotate: f.isGift ? f.rotate : 0 }}
            animate={{
              y: '115vh',
              x: [0, f.sway, -f.sway, 0],
              rotate: f.isGift ? [f.rotate, f.rotate + 40, f.rotate - 40, f.rotate] : 0,
            }}
            transition={{ duration: f.dur, delay: f.delay, repeat: Infinity, ease: 'linear' }}
          >
            {f.isGift ? '🎁' : '❄'}
          </motion.div>
        ))}
      </div>

      {/* ── SURPRISE CANNON — final stage only. Gifts/snow above are
             purely decorative now; the FIRE button is the entire game —
             each press launches a photo, a bomb, or a festive word at a
             random spot up top. ── */}
      {isFinalStage && (
        <motion.div className="absolute inset-0" style={{ zIndex: 3 }} animate={shakeControls}>
          {/* Launches — from a FIXED point at the bottom-centre (like a
              slingshot/cannon), arcing to a random target, spinning,
              with a fading trail behind it. */}
          <AnimatePresence>
            {snowballBursts.map(b => {
              const midX = (b.originX + b.x) / 2;
              const arcLift = 90 + Math.abs(b.originY - b.y) * 0.15;
              const midY = Math.min(b.originY, b.y) - arcLift;
              const trailColor = b.kind === 'bomb' ? '#7f1d1d' : b.kind === 'text' ? '#f9a8d4' : '#eef3ff';
              const ringColor = b.kind === 'bomb' ? '#fb923c' : b.kind === 'text' ? '#f9a8d4' : '#fbbf24';
              return (
                <motion.div key={b.id} className="fixed" style={{ left: 0, top: 0, zIndex: 7, pointerEvents: 'none' }}>
                  {/* trail — 3 fainter, smaller copies a beat behind the
                      main projectile, following the same arc */}
                  {[0.12, 0.07, 0.035].map((lag, li) => (
                    <motion.div
                      key={li}
                      className="absolute rounded-full"
                      style={{
                        width: 14 - li * 3, height: 14 - li * 3,
                        background: trailColor,
                        opacity: (b.kind === 'bomb' ? 0.45 : 0.35) - li * 0.1,
                      }}
                      initial={{ x: b.originX, y: b.originY }}
                      animate={{ x: [b.originX, midX, b.x], y: [b.originY, midY, b.y] }}
                      transition={{ duration: 0.46, delay: lag, ease: [0.33, 0, 0.67, 1] }}
                    />
                  ))}
                  {/* the projectile itself — arcs, spins, squashes on
                      launch. A photo, a bomb, or a flying word. */}
                  {b.kind === 'bomb' && (
                    <motion.div
                      className="absolute flex items-center justify-center"
                      style={{ width: 30, height: 30, marginLeft: -15, marginTop: -15, fontSize: 26 }}
                      initial={{ x: b.originX, y: b.originY, scale: 0.4, rotate: 0, opacity: 1 }}
                      animate={{
                        x: [b.originX, midX, b.x], y: [b.originY, midY, b.y],
                        scale: [0.4, 1.1, 0.7], rotate: 420, opacity: [1, 1, 0],
                      }}
                      transition={{ duration: 0.46, ease: [0.33, 0, 0.67, 1] }}
                    >
                      💣
                    </motion.div>
                  )}
                  {b.kind === 'photo' && b.photoUrl && (
                    <motion.div
                      className="absolute overflow-hidden rounded-lg"
                      style={{
                        width: 38, height: 38, marginLeft: -19, marginTop: -19,
                        border: '2px solid #fff', boxShadow: '0 0 10px rgba(255,255,255,0.5)',
                      }}
                      initial={{ x: b.originX, y: b.originY, scale: 0.4, rotate: 0, opacity: 1 }}
                      animate={{
                        x: [b.originX, midX, b.x], y: [b.originY, midY, b.y],
                        scale: [0.4, 1.1, 0.85], rotate: 380, opacity: [1, 1, 0],
                      }}
                      transition={{ duration: 0.46, ease: [0.33, 0, 0.67, 1] }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.photoUrl} alt="" className="size-full object-cover" draggable={false} />
                    </motion.div>
                  )}
                  {b.kind === 'text' && (
                    <motion.div
                      className="absolute whitespace-nowrap font-bold"
                      style={{
                        marginLeft: -20, marginTop: -12, fontSize: 15, color: '#fff',
                        textShadow: '0 0 8px rgba(249,168,212,0.9), 0 2px 4px rgba(0,0,0,0.6)',
                        letterSpacing: 0.5,
                      }}
                      initial={{ x: b.originX, y: b.originY, scale: 0.4, rotate: 0, opacity: 1 }}
                      animate={{
                        x: [b.originX, midX, b.x], y: [b.originY, midY, b.y],
                        scale: [0.4, 1.05, 0.85], rotate: 12, opacity: [1, 1, 0],
                      }}
                      transition={{ duration: 0.46, ease: [0.33, 0, 0.67, 1] }}
                    >
                      {b.text}
                    </motion.div>
                  )}
                  {/* launch poof, right where it left from */}
                  <motion.div
                    className="absolute rounded-full"
                    style={{ left: b.originX, top: b.originY, width: 26, height: 26, marginLeft: -13, marginTop: -13, background: 'rgba(255,255,255,0.5)' }}
                    initial={{ opacity: 0.7, scale: 0.3 }}
                    animate={{ opacity: 0, scale: 1.6 }}
                    transition={{ duration: 0.3 }}
                  />

                  {/* impact shockwave ring(s) — the "juice" that sells
                      the arrival. Bombs get a second, bigger, slightly-
                      delayed ring for a real "boom". */}
                  <motion.div
                    className="absolute rounded-full"
                    style={{ left: b.x, top: b.y, width: 10, height: 10, marginLeft: -5, marginTop: -5, border: `3px solid ${ringColor}` }}
                    initial={{ opacity: 0.9, scale: 0.3 }}
                    animate={{ opacity: 0, scale: b.kind === 'bomb' ? 9 : 6 }}
                    transition={{ duration: 0.5, delay: 0.46, ease: 'easeOut' }}
                  />
                  {b.kind === 'bomb' && (
                    <motion.div
                      className="absolute rounded-full"
                      style={{ left: b.x, top: b.y, width: 10, height: 10, marginLeft: -5, marginTop: -5, border: '3px solid #fff' }}
                      initial={{ opacity: 0.8, scale: 0.3 }}
                      animate={{ opacity: 0, scale: 5.5 }}
                      transition={{ duration: 0.45, delay: 0.52, ease: 'easeOut' }}
                    />
                  )}

                  {/* the reveal — what actually arrived. Pops in, holds
                      a beat, then keeps falling (not just fading in
                      place) so it reads as landing, not floating. */}
                  {b.kind === 'photo' && b.photoUrl ? (
                    <motion.div
                      className="absolute overflow-hidden rounded-xl"
                      style={{
                        left: b.x, top: b.y, width: 92, height: 92, marginLeft: -46, marginTop: -46,
                        border: '3px solid #fff', boxShadow: '0 8px 24px rgba(0,0,0,0.55), 0 0 24px rgba(255,255,255,0.4)',
                      }}
                      initial={{ opacity: 0, scale: 0.3, rotate: -8, y: 0 }}
                      animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.08, 1, 0.9], rotate: 0, y: [0, 0, 100, 260] }}
                      transition={{ duration: 1.3, delay: 0.46, times: [0, 0.25, 0.6, 1], ease: 'easeIn' }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.photoUrl} alt="" className="size-full object-cover" draggable={false} />
                    </motion.div>
                  ) : b.kind === 'text' ? (
                    <div className="absolute" style={{ left: b.x, top: b.y, transform: 'translate(-50%, -50%)' }}>
                      <motion.div
                        className="whitespace-nowrap rounded-full font-bold"
                        style={{
                          padding: '8px 20px',
                          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
                          border: '2px solid #f9a8d4', color: '#fff', fontSize: 22,
                          textShadow: '0 0 10px rgba(249,168,212,0.8)',
                          boxShadow: '0 0 24px rgba(249,168,212,0.35)',
                        }}
                        initial={{ opacity: 0, scale: 0.3, y: 0 }}
                        animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.15, 1, 0.9], y: [0, 0, 100, 260] }}
                        transition={{ duration: 1.3, delay: 0.46, times: [0, 0.25, 0.6, 1], ease: 'easeIn' }}
                      >
                        {b.text}
                      </motion.div>
                    </div>
                  ) : (
                    <motion.div
                      className="absolute"
                      style={{ left: b.x, top: b.y, marginLeft: -26, marginTop: -26, fontSize: 50 }}
                      initial={{ opacity: 0, scale: 0.3, rotate: 0 }}
                      animate={{ opacity: [0, 1, 0], scale: [0.3, 1.5, 1.1], rotate: 25 }}
                      transition={{ duration: 0.55, delay: 0.46 }}
                    >
                      💥
                    </motion.div>
                  )}
                  {/* floating "+1" — only when this launch actually
                      counted toward the target (photos only, bombs and
                      words are just for fun) */}
                  {b.counts && (
                    <motion.div
                      className="absolute font-bold"
                      style={{ left: b.x, top: b.y, marginLeft: -10, marginTop: -10, fontSize: 20, color: '#86efac', textShadow: '0 0 8px rgba(0,0,0,0.7)' }}
                      initial={{ opacity: 0, y: b.y }}
                      animate={{ opacity: [0, 1, 0], y: b.y - 36 }}
                      transition={{ duration: 0.7, delay: 0.46, ease: 'easeOut' }}
                    >
                      +1
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Score HUD — a filling progress bar reads faster than a
              plain "x/6" count. */}
          <div
            className="absolute pointer-events-none"
            style={{ left: '5%', right: '5%', top: '11%' }}
          >
            <div className="flex items-center justify-between mb-1" style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, color: '#fff' }}>
              <span>📸 Land enough photos</span>
              <span>{Math.min(snowballScore, SNOWBALL_TARGET)}/{SNOWBALL_TARGET}</span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.2)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #60a5fa, #86efac)' }}
                animate={{ width: `${(Math.min(snowballScore, SNOWBALL_TARGET) / SNOWBALL_TARGET) * 100}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* FIRE button — a big, obvious "press this" target. Every
              press launches a photo, a bomb, or a festive word at a
              random spot up top. */}
          {!gameWon && (
            <motion.button
              type="button"
              onClick={(e) => { e.stopPropagation(); fireButtonPress(); }}
              className="absolute cursor-pointer rounded-full flex items-center justify-center"
              style={{
                left: '50%', bottom: '14%', width: 68, height: 68, marginLeft: -34,
                background: 'radial-gradient(circle at 35% 30%, #fff, #cfe0ff 70%)',
                border: '3px solid #fff',
                boxShadow: '0 6px 18px rgba(0,0,0,0.5), 0 0 22px rgba(255,255,255,0.5)',
                fontSize: 28,
                zIndex: 8,
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, scale: [1, 1.06, 1] }}
              transition={{
                opacity: { duration: 0.8, delay: 1 },
                y: { duration: 0.8, delay: 1 },
                scale: { duration: 1.3, repeat: Infinity, ease: 'easeInOut' },
              }}
              whileTap={{ scale: 0.85 }}
              aria-label="Fire a surprise"
            >
              🎉
            </motion.button>
          )}

          {/* Onboarding hint — fades in, holds a moment, fades out */}
          <AnimatePresence>
            {showHint && !gameWon && (
              <motion.div
                className="absolute inset-x-0 flex justify-center pointer-events-none"
                style={{ top: '20%' }}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
              >
                <span
                  className="rounded-full"
                  style={{
                    padding: '7px 16px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                    fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'italic', fontSize: 15, color: '#fff',
                  }}
                >
                  🎉 Press the button — photos count, bombs & words are just for fun!
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Win celebration — plays once, right when the 6th surprise
              lands: a screen flash + multiple firework bursts, then the
              banner. Sells "you passed" much harder than text alone. */}
          {showWinBanner && (
            <>
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{ background: '#fff', zIndex: 9 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.85, 0] }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
              {fireworkBursts.map((fw, i) => (
                <div
                  key={i}
                  className="absolute pointer-events-none"
                  style={{ left: `${fw.x}%`, top: `${fw.y}%`, zIndex: 9 }}
                >
                  <motion.div
                    className="absolute rounded-full"
                    style={{ width: 6, height: 6, marginLeft: -3, marginTop: -3, background: fw.color, boxShadow: `0 0 24px 12px ${fw.color}` }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 1, 0], scale: [0, 3, 0] }}
                    transition={{ duration: 0.5, delay: fw.delay }}
                  />
                  {Array.from({ length: fw.particles }).map((_, j) => {
                    const angle = (j / fw.particles) * Math.PI * 2;
                    const dist = 55 + (j % 3) * 22;
                    return (
                      <motion.div
                        key={j}
                        className="absolute rounded-full"
                        style={{ width: 4, height: 4, marginLeft: -2, marginTop: -2, background: fw.color, boxShadow: `0 0 4px ${fw.color}` }}
                        initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                        animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist + 26, opacity: 0, scale: 0.4 }}
                        transition={{ duration: 0.95, delay: fw.delay, ease: 'easeOut' }}
                      />
                    );
                  })}
                </div>
              ))}
              <motion.div
                className="absolute inset-x-0 flex justify-center pointer-events-none"
                style={{ top: '20%', zIndex: 10 }}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              >
                <span
                  className="rounded-full"
                  style={{
                    padding: '9px 20px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: 18, color: '#86efac',
                    boxShadow: '0 0 20px rgba(134,239,172,0.4)',
                  }}
                >
                  🎆 Merry Christmas!
                </span>
              </motion.div>
            </>
          )}
        </motion.div>
      )}

      {/* ── MOTION STREAKS — only on Stage 0 (the sleigh), so it reads
             as actually racing forward instead of just hovering there.
             Same technique Snow Fall's own reindeer stage uses: thin
             streaks drifting right→left at varying speeds. ── */}
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

      {/* ── GIFT TAG — Stage 1 (the tree) only: a little hanging tag
             under a heart, reading "To / From", so the presents
             visibly belong to this specific recipient/sender pair
             instead of being generic. ── */}
      {stage === 1 && (rawName || kiss.sender_name) && (
        <motion.div
          className="absolute inset-x-0 flex flex-col items-center pointer-events-none"
          style={{ top: '16%', zIndex: 4 }}
          initial={{ opacity: 0, y: -10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <motion.div
            style={{ fontSize: 22, marginBottom: -4 }}
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
          >
            ❤️
          </motion.div>
          <div
            className="rounded-lg text-center"
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(160deg, #ede0c0 0%, #d9c69a 100%)',
              boxShadow: '0 10px 24px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.4)',
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              transform: 'rotate(-3deg)',
            }}
          >
            {rawName && (
              <div style={{ fontSize: 15, fontStyle: 'italic', color: '#3f2d18' }}>
                To: <span style={{ fontWeight: 700 }}>{rawName}</span>
              </div>
            )}
            {kiss.sender_name && (
              <div style={{ fontSize: 13, fontStyle: 'italic', color: '#6b4f2a', marginTop: 2 }}>
                From: <span style={{ fontWeight: 700 }}>{kiss.sender_name}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── DRONE CANVAS — a galloping bob + horizontal micro-shift on
             Stage 0 (paired with the motion streaks above) so the
             sleigh actually reads as racing forward; stationary on the
             other stages, since the tree doesn't need to move. Hidden
             on the final stage — the falling-photo snowball game is
             that stage's whole visual now, and the "face" shape read
             as an indistinct blob at this drone count rather than a
             face. */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 2, opacity: isFinalStage ? 0 : 1 }}
        animate={
          stage === 0
            ? { y: [0, -9, 0, 9, 0], x: [0, 9, -5, 7, 0] }
            : { y: 0, x: 0 }
        }
        transition={
          stage === 0
            ? {
                y: { duration: 1, repeat: Infinity, ease: 'easeInOut' },
                x: { duration: 0.75, repeat: Infinity, ease: 'easeInOut' },
              }
            : { duration: 0.4 }
        }
      >
        <canvas ref={canvasRef} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
      </motion.div>

      {/* ── Stage caption — small, bottom, so the recipient always
             knows what they're looking at without any text cluttering
             the drone art itself. ── */}
      <div className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ top: '6%', zIndex: 9 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 0.85, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 'clamp(15px, 2.6vw, 19px)',
              color: '#fff',
              textShadow: '0 2px 10px rgba(0,0,0,0.7)',
            }}
          >
            {/* Final stage greets the recipient by name when they gave
                one — every other stage keeps its generic label. */}
            {isFinalStage && rawName ? `Ho Ho Ho, ${rawName}!` : stagesConfig[stage]?.label}
          </motion.div>
        </AnimatePresence>
      </div>

      {kiss.message && (
        <WaxSealScroll
          message={kiss.message}
          senderName={kiss.sender_name}
          open={showScroll}
          locked={!gameWon}
          onOpen={openMessage}
          onClose={() => setShowScroll(false)}
        />
      )}
    </div>
  );
}

export const XmasSantaConfig: TemplateConfig = {
  id: 'xmas-santa',
  name: 'Santa Delivery',
  occasionIds: ['christmas'],
  emoji: '🎅',
  description: 'Santa waves from the rooftop, then Ho-Ho-Ho\'s in for the finale.',
  thumbnailBg: 'linear-gradient(135deg, #dcfce7, #dc2626)',
  Component: XmasSantaReveal,
};
