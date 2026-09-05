'use client';

// Fireplace → rebuilt as "Village Arrival": a two-phase scene reveal,
// no longer the placeholder scaffold.
//
//   Phase 1  A cozy snowy village at dusk, holding for a beat.
//   Phase 2  Santa's sleigh swoops down out of the night sky and
//            settles over the village — then the SAME drone-light
//            formation reforms in place: sleigh → "MERRY XMAS 2026"
//            → the recipient's name → a gift box the recipient taps
//            to open the note.
//
// The village/sky/snowfall are built from straight CSS/motion
// composition (Santa "flying in" reads far better as one continuous
// swooping entrance than as dots reforming a shape mid-air). Once
// landed, though, the sleigh IS a genuine drone-morph show — the same
// canvas point-cloud engine Snow Fall / Santa Delivery use, just with
// only 4 stages and no per-stage entrance choreography (that's handled
// by the outer swoop-in motion once, up front).

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getKissString, parseKissData } from '../_shared/useTemplateData';
import type { TemplateProps, TemplateConfig } from '../_types';

const VILLAGE_HOLD_MS = 4200;
const FLY_DURATION_MS = 1900;
const DRONE_DOT_COUNT = 1400;
const DRONE_TEXT_DOT_COUNT = 2400; // denser than the sleigh — text needs to read crisply, not just recognizably
const DRONE_SLEIGH_HOLD_MS = 2000; // how long the sleigh formation holds before morphing into text
const DRONE_MORPH_MS = 900;
const DRONE_TEXT_HOLD_MS = 2000; // how long each text stage holds before advancing

type Pt = { x: number; y: number; color?: string };

// ─────────────────────────────────────────────────────────────────────
// Santa's sleigh, piled with presents, pulled by a reindeer team — all
// sampled together into one point cloud so it can be rendered as a
// single glowing "drone light" formation. Region colours are picked by
// position (the alpha channel is all that's sampled from each emoji),
// same technique + speckle trick Santa Delivery's own composite uses.
// ─────────────────────────────────────────────────────────────────────
function sampleSantaSleighTeamComposite(): Pt[] {
  if (typeof document === 'undefined') return [];
  const W = 1400, H = 700;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const font = (px: number) => `${Math.floor(px)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;

  const sledSize = H * 0.56;
  ctx.font = font(sledSize);
  ctx.fillText('🛷', W * 0.30, H * 0.62);

  ctx.font = font(sledSize * 0.5);
  ctx.fillText('🎅', W * 0.375, H * 0.46);

  ctx.font = font(sledSize * 0.36);
  ctx.fillText('🎁', W * 0.275, H * 0.40);
  ctx.font = font(sledSize * 0.30);
  ctx.fillText('🎁', W * 0.315, H * 0.335);
  ctx.font = font(sledSize * 0.24);
  ctx.fillText('🎁', W * 0.29, H * 0.285);

  // Reindeer team, both flipped to face right (their direction of
  // travel) — nearer one smaller, further one bigger/leading, same
  // depth trick the flat-emoji version used.
  ctx.font = font(sledSize * 0.82);
  ctx.save();
  ctx.translate(W * 0.545, H * 0.58);
  ctx.scale(-1, 1);
  ctx.fillText('🦌', 0, 0);
  ctx.restore();

  ctx.font = font(sledSize * 0.92);
  ctx.save();
  ctx.translate(W * 0.72, H * 0.50);
  ctx.scale(-1, 1);
  ctx.fillText('🦌', 0, 0);
  ctx.restore();

  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: Pt[] = [];
  const stride = 3;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        const nx = (x / W - 0.5) * 2;
        const ny = (y / H - 0.5) * 2;
        // NOTE: speckle moduli (7, 8, 11) are deliberately NOT
        // multiples of `stride` (3) — a shared factor collapses the
        // pattern to one flat colour (bug found + documented in Santa
        // Delivery's own composite).
        let color: string;
        if (x > W * 0.44) {
          color = (x + y) % 7 < 2 ? '#c99150' : '#8a5a25'; // reindeer — brown
        } else if (y < H * 0.34) {
          const m = (x + y) % 8;
          color = m < 3 ? '#22c55e' : m < 6 ? '#dc2626' : '#fbbf24'; // gifts — festive mix
        } else if (y < H * 0.52) {
          color = (x + y) % 8 < 3 ? '#fff' : '#dc2626'; // Santa — red/white
        } else {
          color = (x + y) % 11 < 2 ? '#fbbf24' : '#7f1d1d'; // sled — red/gold
        }
        pts.push({ x: nx, y: ny, color });
      }
    }
  }
  return pts;
}

// ─────────────────────────────────────────────────────────────────────
// Bold drone-formed TEXT (e.g. "MERRY XMAS 2026", the recipient's
// name) — same alpha-sampling technique as the sleigh, just off a
// canvas-rendered string instead of an emoji. Auto-shrinks to fit.
// ─────────────────────────────────────────────────────────────────────
function sampleTextComposite(text: string): Pt[] {
  if (typeof document === 'undefined' || !text) return [];
  const W = 1600, H = 520;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = Math.round(H * 0.62);
  ctx.font = `800 ${size}px "Inter", "Segoe UI", sans-serif`;
  while (ctx.measureText(text).width > W * 0.92 && size > 20) {
    size -= 4;
    ctx.font = `800 ${size}px "Inter", "Segoe UI", sans-serif`;
  }
  ctx.fillText(text, W / 2, H / 2);

  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: Pt[] = [];
  const stride = 3;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        const nx = (x / W - 0.5) * 2;
        const ny = (y / H - 0.5) * 2;
        const m = (x + y) % 7;
        const color = m < 2 ? '#fff' : m < 5 ? '#fde68a' : '#f9a8d4'; // white/gold/pink twinkle
        pts.push({ x: nx, y: ny, color });
      }
    }
  }
  return pts;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ─────────────────────────────────────────────────────────────────────
// The gift box the recipient taps to open the note — drawn as actual
// geometry (rounded box + lid + cross-ribbon + bow), not sampled from
// the 🎁 emoji glyph. The emoji version came out as a vague speckled
// blob at drone density; drawn shapes give a crisp, unmistakable box
// silhouette instead.
// ─────────────────────────────────────────────────────────────────────
function sampleGiftBoxComposite(): Pt[] {
  if (typeof document === 'undefined') return [];
  const W = 800, H = 800;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.fillStyle = '#fff';

  const boxW = W * 0.58, boxH = H * 0.44;
  const boxX = (W - boxW) / 2, boxY = H * 0.46;
  roundRectPath(ctx, boxX, boxY, boxW, boxH, 20);
  ctx.fill();

  const lidW = boxW * 1.1, lidH = boxH * 0.22;
  const lidX = (W - lidW) / 2, lidY = boxY - lidH * 0.7;
  roundRectPath(ctx, lidX, lidY, lidW, lidH, 14);
  ctx.fill();

  const ribbonW = boxW * 0.16;
  ctx.fillRect(W / 2 - ribbonW / 2, lidY, ribbonW, boxY + boxH - lidY);

  const bowCy = lidY - boxH * 0.05;
  ctx.beginPath();
  ctx.ellipse(W / 2 - boxW * 0.15, bowCy, boxW * 0.15, boxH * 0.12, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(W / 2 + boxW * 0.15, bowCy, boxW * 0.15, boxH * 0.12, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W / 2, bowCy + boxH * 0.03, boxW * 0.07, 0, Math.PI * 2);
  ctx.fill();

  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: Pt[] = [];
  const stride = 3;
  const ribbonX0 = W / 2 - ribbonW / 2, ribbonX1 = W / 2 + ribbonW / 2;
  const bowBottom = lidY + lidH * 0.5;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        const nx = (x / W - 0.5) * 2;
        const ny = (y / H - 0.5) * 2;
        const onRibbon = x >= ribbonX0 && x <= ribbonX1;
        const isBow = y < bowBottom;
        let color: string;
        if (isBow || onRibbon) {
          color = (x + y) % 7 < 3 ? '#fde68a' : '#fbbf24'; // ribbon + bow — gold
        } else {
          color = (x + y) % 8 < 3 ? '#ef4444' : '#b91c1c'; // box body — red
        }
        pts.push({ x: nx, y: ny, color });
      }
    }
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

// ─────────────────────────────────────────────────────────────────────
// ParchmentNote — the note itself, shown once `open` is true. Purely a
// display/dismiss component now — opening it is entirely driven by
// tapping the drone-formed gift box in the sky (see droneStage === 3
// below), not a button of its own.
// ─────────────────────────────────────────────────────────────────────
function ParchmentNote({ message, senderName, photoUrl, open, onClose }: {
  message: string; senderName?: string; photoUrl?: string; open: boolean; onClose: () => void;
}) {
  return (
    <>
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
                  {photoUrl ? (
                    <div
                      className="mx-auto mb-4 overflow-hidden rounded-sm"
                      style={{
                        width: 132, padding: '8px 8px 20px', background: '#fdfbf5',
                        boxShadow: '0 10px 22px rgba(0,0,0,0.4)', transform: 'rotate(-3deg)',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl} alt="" className="w-full aspect-square object-cover" draggable={false} />
                    </div>
                  ) : (
                    <div style={{ fontSize: 20, marginBottom: 14 }}>🎅 ✨</div>
                  )}
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

export default function XmasFireplaceReveal({ kiss, onClose }: TemplateProps) {
  const rawName = (getKissString(kiss, 'name') || kiss.receiver_name || '').trim();

  // Same upload/read logic every other Christmas template uses: an
  // uploaded `photos` array if the field's been upgraded to multi,
  // otherwise the legacy single `photo` field.
  const photos: string[] = (() => {
    const raw = parseKissData(kiss).photos;
    if (Array.isArray(raw)) {
      const list = raw.filter((u): u is string => typeof u === 'string' && !!u);
      if (list.length > 0) return list.slice(0, 6);
    }
    const single = getKissString(kiss, 'photo');
    return single ? [single] : [];
  })();
  const photoUrl = photos[0];

  const [stage, setStage] = useState<0 | 1>(0);
  // Sub-stages of the sky formation once Phase 2 starts: 0 = sleigh,
  // 1 = "MERRY XMAS 2026", 2 = recipient's name, 3 = gift box (stays,
  // waiting to be tapped).
  const [droneStage, setDroneStage] = useState(0);
  const [showNote, setShowNote] = useState(false);
  const [messageSeen, setMessageSeen] = useState(false);
  const openMessage = () => { setShowNote(true); setMessageSeen(true); };
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setStage(1), VILLAGE_HOLD_MS);
    return () => window.clearTimeout(t);
  }, []);

  // Advance the sky formation through its stages once landed — sleigh
  // holds a beat, then morphs through the two text stages, then
  // settles as the gift box and stops (no timer closes it out; only a
  // tap on the box does that, via openMessage below).
  useEffect(() => {
    if (stage !== 1) return;
    const t1 = FLY_DURATION_MS + DRONE_SLEIGH_HOLD_MS;
    const t2 = t1 + DRONE_MORPH_MS + DRONE_TEXT_HOLD_MS;
    const t3 = t2 + DRONE_MORPH_MS + DRONE_TEXT_HOLD_MS;
    const h1 = window.setTimeout(() => setDroneStage(1), t1);
    const h2 = window.setTimeout(() => setDroneStage(2), t2);
    const h3 = window.setTimeout(() => setDroneStage(3), t3);
    return () => { window.clearTimeout(h1); window.clearTimeout(h2); window.clearTimeout(h3); };
  }, [stage]);

  // Auto-close a while after the gift box has appeared — but only
  // once the note (if there is one) has actually been read, same
  // pattern the other Christmas templates use.
  useEffect(() => {
    if (droneStage < 3) return;
    if (kiss.message && !messageSeen) return;
    const t = window.setTimeout(() => onClose?.(), 9000);
    return () => window.clearTimeout(t);
  }, [droneStage, kiss.message, messageSeen, onClose]);

  const stars = useMemo(() => (
    Array.from({ length: 70 }).map((_, i) => {
      const s = ((i + 100) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      return {
        left: r(1) * 100, top: r(2) * 50, size: 1 + r(3) * 2.2,
        opacity: 0.4 + r(4) * 0.55, dur: 3 + r(5) * 4, delay: r(6) * 6,
      };
    })
  ), []);

  const snowflakes = useMemo(() => (
    Array.from({ length: 70 }).map((_, i) => {
      const s = ((i + 400) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      return {
        left: r(1) * 100, size: 3 + r(2) * 8, delay: r(3) * 10,
        dur: 9 + r(4) * 10, sway: (r(5) - 0.5) * 60, opacity: 0.35 + r(6) * 0.5,
      };
    })
  ), []);

  // Falling photo tiles for the gift-box moment — loops forever like
  // the snowflakes, cycling through whatever the sender uploaded.
  // Evenly-spaced bands across the width (not fully random) so tiles
  // spread out instead of clumping by chance.
  const photoLanes = useMemo(() => {
    if (photos.length === 0) return [];
    const LANES = Math.min(5, Math.max(3, photos.length * 2));
    const bandWidth = 100 / LANES;
    return Array.from({ length: LANES }).map((_, i) => {
      const s = ((i + 700) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      return {
        url: photos[i % photos.length],
        left: i * bandWidth + bandWidth * 0.2 + r(1) * bandWidth * 0.6,
        size: 54 + r(2) * 16,
        delay: r(3) * 5,
        dur: 8 + r(4) * 5,
        sway: (r(5) - 0.5) * 40,
        rotate: (r(6) - 0.5) * 24,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  // The sleigh — a compact, non-morphing point cloud (just twinkles),
  // rendered in its own small canvas at its original spot.
  const sleighPoints = useMemo(() => packToCount(sampleSantaSleighTeamComposite(), DRONE_DOT_COUNT), []);
  const sleighCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (stage < 1 || typeof window === 'undefined' || !sleighCanvasRef.current) return;
    const canvas = sleighCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || sleighPoints.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = W / 2, cy = H / 2;
    const scale = Math.min(W, H) * 1.05;
    const dots = sleighPoints.map(p => ({
      x: cx + p.x * scale, y: cy + p.y * scale, color: p.color || '#fff',
      size: 1.1 + Math.random() * 1.3, twinkle: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    const draw = (now: number) => {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const d of dots) {
        const tw = 0.7 + 0.4 * Math.sin(now / 260 + d.twinkle);
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
  }, [stage, sleighPoints]);

  // The sky text/box — a SEPARATE, full-width canvas (mobile wants
  // "MERRY XMAS 2026" filling the screen, which the sleigh's compact
  // box can't accommodate) that fades in once droneStage reaches 1.
  // Its own 3 point-sets morph between each other the same way the
  // sleigh canvas used to morph between all 4.
  const skyTextPointSets = useMemo(() => ([
    packToCount(sampleTextComposite('MERRY XMAS 2026'), DRONE_TEXT_DOT_COUNT),
    packToCount(sampleTextComposite((rawName || 'YOU').toUpperCase()), DRONE_TEXT_DOT_COUNT),
    packToCount(sampleGiftBoxComposite(), DRONE_TEXT_DOT_COUNT),
  ]), [rawName]);
  const skyTextCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const skyStageIndex = Math.max(0, droneStage - 1);
  const skyStageRef = useRef(skyStageIndex);
  useEffect(() => { skyStageRef.current = skyStageIndex; }, [skyStageIndex]);
  // Mount/run this effect once the sky canvas first appears — NOT on
  // every subsequent droneStage change, or the morph would restart
  // from scratch each time instead of tweening. `skyActive` only
  // flips false→true once; later stage changes are picked up by the
  // ref + polling interval below, same pattern the sleigh engine used.
  const skyActive = droneStage >= 1;

  useEffect(() => {
    if (!skyActive || typeof window === 'undefined' || !skyTextCanvasRef.current) return;
    const canvas = skyTextCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || skyTextPointSets[0].length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = W / 2, cy = H / 2;
    const scale = Math.min(W, H) * 1.05;

    type Dot = {
      x: number; y: number; fromX: number; fromY: number;
      color: string; size: number; twinkle: number; morphStart: number;
    };
    const initial = skyTextPointSets[skyStageRef.current];
    const dots: Dot[] = initial.map(p => {
      const x = cx + p.x * scale, y = cy + p.y * scale;
      return {
        x, y, fromX: x, fromY: y, color: p.color || '#fff',
        size: 1.5 + Math.random() * 1.5, twinkle: Math.random() * Math.PI * 2,
        morphStart: performance.now(),
      };
    });

    let currentSkyStage = skyStageRef.current;
    let lastRenderStage = -1;

    const draw = (now: number) => {
      if (currentSkyStage !== lastRenderStage) {
        const targetSet = skyTextPointSets[currentSkyStage];
        for (let i = 0; i < dots.length; i++) {
          dots[i].fromX = dots[i].x;
          dots[i].fromY = dots[i].y;
          dots[i].morphStart = now;
          const np = targetSet[i];
          if (np?.color) dots[i].color = np.color;
        }
        lastRenderStage = currentSkyStage;
      }

      // A full clear (not the sleigh's partial destination-out fade) —
      // this canvas holds a STATIC shape almost the whole time, and
      // redrawing the same dots on top of an incompletely-erased
      // previous frame accumulates brightness every frame (additive
      // 'lighter' blending never fully resets), eventually washing the
      // letterforms into an illegible glowing blob. Only the brief
      // morph transitions lose their trail blur — a fair trade for
      // text that actually stays readable.
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      const targetSet = skyTextPointSets[currentSkyStage];
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const tp = targetSet[i];
        const tx = cx + tp.x * scale, ty = cy + tp.y * scale;
        const elapsed = now - d.morphStart;
        const t = Math.min(1, elapsed / DRONE_MORPH_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        d.x = d.fromX + (tx - d.fromX) * eased;
        d.y = d.fromY + (ty - d.fromY) * eased;

        // Shallower twinkle than the sleigh's (0.85–1.1 vs 0.3–1.1) —
        // dots never dim enough to blur the letterforms.
        const tw = 0.85 + 0.25 * Math.sin(now / 260 + d.twinkle);
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
    let raf = requestAnimationFrame(draw);
    const syncInterval = window.setInterval(() => { currentSkyStage = skyStageRef.current; }, 100);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(syncInterval);
    };
  }, [skyActive, skyTextPointSets]);

  return (
    <div
      className="fixed inset-0 z-200 overflow-hidden select-none"
      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      onClick={() => {
        // Background taps don't open the note any more — only tapping
        // the drone-formed gift box does (see droneStage === 3 below).
        // A tap still closes the reveal once the note's been read (or
        // there wasn't one to begin with).
        if (droneStage < 3) return;
        if (kiss.message && !messageSeen) return;
        onClose?.();
      }}
    >
      {/* ── SKY — deep twilight indigo fading to a warm dusk band, same
             mood as the reference village photo. ── */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #0c1033 0%, #2a1c46 40%, #7a3b52 72%, #c96a4a 100%)' }} />

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
        <div
          className="absolute rounded-full"
          style={{
            top: '7%', right: '12%', width: 60, height: 60,
            background: 'radial-gradient(circle at 35% 30%, #fffdf5, #e8d9c0 70%)',
            boxShadow: '0 0 40px rgba(232,217,192,0.5), 0 0 90px rgba(232,217,192,0.2)',
          }}
        />
      </div>

      {/* ── VILLAGE — a row of snow-capped cottages either side of a
             lantern-lined path, wreaths on the doors, matching the
             reference village-street photo. ── */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ zIndex: 2, height: '58%' }}>
        <svg viewBox="0 0 1200 480" preserveAspectRatio="none" width="100%" height="100%" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="fp-horizon" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(201,106,74,0)" />
              <stop offset="70%" stopColor="rgba(201,106,74,0.16)" />
              <stop offset="100%" stopColor="rgba(251,191,36,0.08)" />
            </linearGradient>
          </defs>
          <rect x="0" y="40" width="1200" height="200" fill="url(#fp-horizon)" />

          {/* Snowy street, receding toward the middle horizon */}
          <path d="M 420 480 L 540 200 L 660 200 L 780 480 Z" fill="rgba(238,244,255,0.5)" />

          {/* Cottage silhouettes */}
          <g fill="#160f2a">
            <polygon points="0,480 0,300 90,300 90,250 190,300 190,480" />
            <rect x="190" y="330" width="150" height="150" />
            <polygon points="850,480 850,320 950,270 1050,320 1050,480" />
            <rect x="1050" y="350" width="150" height="130" />
          </g>
          {/* Left far cottage (smaller, set back near the path) */}
          <polygon points="340,480 340,340 400,310 460,340 460,480" fill="#1c1333" />
          {/* Right far cottage (smaller, set back near the path) */}
          <polygon points="760,480 760,340 820,310 880,480" fill="#1c1333" />

          {/* Snow caps on peaked roofs */}
          <path d="M 90 250 L 66 274 L 114 274 Z" fill="#eef4ff" opacity="0.9" />
          <path d="M 950 270 L 924 296 L 976 296 Z" fill="#eef4ff" opacity="0.9" />
          <path d="M 400 310 L 380 328 L 420 328 Z" fill="#eef4ff" opacity="0.9" />
          <path d="M 820 310 L 800 328 L 840 328 Z" fill="#eef4ff" opacity="0.9" />

          {/* Warm-lit windows */}
          <g>
            {[
              [30, 320], [30, 360], [30, 400], [230, 360], [230, 400], [280, 380],
              [890, 340], [890, 380], [890, 420], [1090, 380], [1090, 420], [1140, 400],
            ].map(([wx, wy], i) => (
              <rect key={`fp-win-${i}`} x={wx} y={wy} width="12" height="12" fill={i % 3 === 0 ? '#fbbf24' : '#fde68a'} opacity="0.92" />
            ))}
          </g>

          {/* Wreaths — a ring of green + a red bow-dot, on the two
              nearest cottage fronts */}
          {[[65, 380], [1000, 400]].map(([wx, wy], i) => (
            <g key={`wreath-${i}`}>
              <circle cx={wx} cy={wy} r="14" fill="none" stroke="#1a5c2a" strokeWidth="5" />
              <circle cx={wx} cy={wy + 15} r="4" fill="#dc2626" />
            </g>
          ))}

          {/* Chimney + smoke on the tallest cottage */}
          <g transform="translate(950 270)">
            <rect x="14" y="-28" width="16" height="24" fill="#2a1810" />
            <rect x="12" y="-30" width="20" height="4" fill="#1a1006" />
            <path d="M 22 -30 Q 18 -44 26 -54 Q 34 -64 28 -76" fill="none" stroke="rgba(230,230,240,0.45)" strokeWidth="2.4" strokeLinecap="round" />
          </g>

          {/* Lamp posts flanking the path — near pair brighter/bigger,
              far pair smaller to read as further away */}
          {[[470, 460, 1], [730, 460, 1], [520, 330, 0.6], [680, 330, 0.6]].map(([lx, ly, scale], i) => (
            <g key={`lamp-${i}`} transform={`translate(${lx} ${ly}) scale(${scale})`}>
              <rect x="-3" y="-60" width="6" height="60" fill="#0c0e1c" />
              <circle cx="0" cy="-66" r="9" fill="#fde68a" opacity="0.95" />
              <circle cx="0" cy="-66" r="18" fill="#fde68a" opacity="0.28" />
            </g>
          ))}

          {/* Small pines dotted near the cottages */}
          {[[145, 470, 40], [1005, 470, 46]].map(([tx, ty, th], i) => (
            <polygon key={`pine-${i}`} points={`${tx},${ty - th} ${tx - th * 0.42},${ty} ${tx + th * 0.42},${ty}`} fill="#0f3320" />
          ))}

          {/* Snowy ground */}
          <path d="M 0 480 L 0 452 Q 210 440 420 452 L 420 480 Z M 780 480 L 780 452 Q 990 440 1200 452 L 1200 480 Z" fill="rgba(240,245,255,0.92)" />
        </svg>
      </div>

      {/* ── SNOWFALL ── */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
        {snowflakes.map((f, i) => (
          <motion.div
            key={`flake-${i}`}
            className="absolute"
            style={{ left: `${f.left}%`, top: '-6%', fontSize: f.size, opacity: f.opacity, color: '#fff', textShadow: '0 0 4px rgba(255,255,255,0.5)' }}
            initial={{ y: 0, x: 0 }}
            animate={{ y: '112vh', x: [0, f.sway, -f.sway, 0] }}
            transition={{ duration: f.dur, delay: f.delay, repeat: Infinity, ease: 'linear' }}
          >
            ❄
          </motion.div>
        ))}
      </div>

      {/* ── SANTA'S SLEIGH — swoops in from the upper-left once Phase 2
             starts, trailing a sparkle comet-tail, then keeps running in
             place: reindeer gallops (fast bob + squash/stretch, out of
             phase with the sled so they don't move as one rigid unit),
             with a continuous sparkle trail kicking up under its hooves
             and speed-streaks drifting past — reads as still galloping
             forward, not just hovering. ── */}
      {stage >= 1 && (
        <>
          {/* one-time entrance comet-tail */}
          {[0, 1, 2, 3, 4].map(i => (
            <motion.div
              key={`trail-${i}`}
              className="absolute rounded-full pointer-events-none"
              style={{ left: '24%', top: '46%', width: 5, height: 5, background: '#fff', boxShadow: '0 0 6px #fff, 0 0 14px rgba(255,255,255,0.6)', zIndex: 3 }}
              initial={{ x: '-68vw', y: '-30vh', opacity: 0 }}
              animate={{ x: 0, y: 0, opacity: [0, 0.85, 0] }}
              transition={{ duration: FLY_DURATION_MS / 1000, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}

          {/* continuous running speed-lines + hoof sparkles + the one
              rooftop gift-toss only make sense while it's still
              shaped like a sleigh — they stop once it starts morphing
              into text. */}
          {droneStage === 0 && (
            <>
              <div className="absolute pointer-events-none" style={{ left: '24%', top: '46%', zIndex: 3 }}>
                {[0, 1, 2, 3, 4, 5].map(i => {
                  const s = ((i + 1) * 2654435761) >>> 0;
                  const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
                  return (
                    <motion.div
                      key={`speedline-${i}`}
                      className="absolute"
                      style={{
                        top: -20 + r(1) * 60, right: 20,
                        width: 30 + r(2) * 40, height: 2,
                        background: `linear-gradient(90deg, transparent, rgba(255,255,255,${0.35 + r(3) * 0.35}), transparent)`,
                      }}
                      initial={{ x: 0, opacity: 0 }}
                      animate={{ x: -90 - r(4) * 60, opacity: [0, 1, 0] }}
                      transition={{
                        duration: 0.5 + r(5) * 0.4,
                        delay: FLY_DURATION_MS / 1000 + r(6) * 1.2,
                        repeat: Infinity,
                        repeatDelay: 0.3 + r(7) * 0.6,
                        ease: 'easeIn',
                      }}
                    />
                  );
                })}
              </div>

              {/* sparkle trail kicked up under the hooves — a loop of
                  small glowing dots spawning under the group and
                  streaking back, same idea as the reference photo's
                  glittering light trail */}
              <div className="absolute pointer-events-none" style={{ left: '24%', top: '46%', zIndex: 3 }}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
                  const s = ((i + 50) * 2654435761) >>> 0;
                  const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
                  return (
                    <motion.div
                      key={`hoof-sparkle-${i}`}
                      className="absolute rounded-full"
                      style={{
                        left: 10 + r(1) * 60, top: 34 + r(2) * 12, width: 3.5, height: 3.5,
                        background: '#fde68a', boxShadow: '0 0 5px #fde68a, 0 0 10px rgba(253,230,138,0.7)',
                      }}
                      initial={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
                      animate={{ x: -40 - r(3) * 30, y: 10 + r(4) * 10, opacity: [0, 1, 0], scale: [0.6, 1, 0.4] }}
                      transition={{
                        duration: 0.6 + r(5) * 0.3,
                        delay: FLY_DURATION_MS / 1000 + r(6) * 0.8,
                        repeat: Infinity,
                        repeatDelay: r(7) * 0.5,
                        ease: 'easeOut',
                      }}
                    />
                  );
                })}
              </div>

              {/* Santa tosses a single present down onto a rooftop as
                  he passes overhead — arcs from the sleigh to a roof
                  peak, spins, lands with a pop. One-off (not looped):
                  the sleigh only holds this shape for a couple of
                  seconds before morphing on. */}
              <motion.div
                className="absolute pointer-events-none"
                style={{ zIndex: 4, fontSize: 'clamp(18px, 4.5vw, 28px)' }}
                initial={{ left: '32%', top: '50%', opacity: 0, scale: 0.5, rotate: 0 }}
                animate={{
                  left: ['32%', '55%', '79%', '79%'],
                  top: ['50%', '55%', '75%', '75%'],
                  opacity: [0, 1, 1, 0],
                  scale: [0.5, 0.9, 1, 0.85],
                  rotate: [0, 140, 300, 300],
                }}
                transition={{
                  duration: 1.5,
                  delay: FLY_DURATION_MS / 1000 + 0.4,
                  times: [0, 0.55, 0.85, 1],
                  ease: 'easeIn',
                }}
              >
                🎁
              </motion.div>
            </>
          )}

          <motion.div
            className="absolute pointer-events-none"
            style={{ left: '24%', top: '46%', zIndex: 4 }}
            initial={{ x: '-68vw', y: '-30vh', rotate: -22, opacity: 0, scale: 0.8 }}
            animate={{
              x: 0, y: 0, rotate: -6, scale: 1,
              // Fades out (not removed) once the sky canvas takes over
              // — Santa's original landing spot never moves, he just
              // dissolves once the sky formation is ready.
              opacity: droneStage === 0 ? [0, 1] : 0,
            }}
            transition={{
              x: { duration: FLY_DURATION_MS / 1000, ease: [0.16, 1, 0.3, 1] },
              y: { duration: FLY_DURATION_MS / 1000, ease: [0.16, 1, 0.3, 1] },
              rotate: { duration: FLY_DURATION_MS / 1000, ease: [0.16, 1, 0.3, 1] },
              scale: { duration: FLY_DURATION_MS / 1000, ease: [0.16, 1, 0.3, 1] },
              opacity: droneStage === 0
                ? { duration: FLY_DURATION_MS / 1000, ease: [0.16, 1, 0.3, 1] }
                : { duration: 0.6 },
            }}
          >
            <motion.div
              animate={{ y: [0, -6, 0, 4, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: FLY_DURATION_MS / 1000 }}
            >
              <canvas
                ref={sleighCanvasRef}
                style={{ width: 'clamp(260px, 74vw, 460px)', height: 'clamp(100px, 27vw, 165px)', display: 'block' }}
              />
            </motion.div>
          </motion.div>

          {/* ── SKY TEXT / GIFT BOX — a separate, full-width canvas (not
                 the sleigh's compact box) so "MERRY XMAS 2026" and the
                 recipient's name can actually fill a phone screen.
                 Fades in once the sleigh has finished its hold; morphs
                 between its own 3 point-sets from there. ── */}
          {droneStage >= 1 && (
            <motion.div
              className="absolute inset-x-0 flex justify-center"
              style={{ top: '22%', zIndex: 4 }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              <motion.div
                className={droneStage === 3 ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}
                animate={
                  droneStage === 3
                    ? { y: [0, -8, 0], scale: [1, 1.05, 1] }
                    : { y: [0, -5, 0, 3, 0] }
                }
                transition={
                  droneStage === 3
                    ? { duration: 1.3, repeat: Infinity, ease: 'easeInOut' }
                    : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
                }
                onClick={(e) => {
                  if (droneStage !== 3) return;
                  e.stopPropagation();
                  if (kiss.message) openMessage();
                  else onClose?.();
                }}
              >
                <canvas
                  ref={skyTextCanvasRef}
                  style={{ width: '92vw', maxWidth: 640, height: 'clamp(120px, 26vw, 200px)', display: 'block' }}
                />
              </motion.div>
            </motion.div>
          )}

          {/* ── FALLING PHOTOS — once the gift box has settled, whatever
                 the sender uploaded drifts down through the scene like
                 snow. Tapping one zooms it full-screen instead of
                 opening the note (stopPropagation keeps it from also
                 triggering the box's tap-to-open). ── */}
          {droneStage === 3 && photoLanes.map((lane, i) => (
            <motion.div
              key={`photolane-${i}`}
              className="absolute cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setZoomedPhoto(lane.url); }}
              style={{ left: `${lane.left}%`, top: '-10%', width: lane.size, height: lane.size, zIndex: 6 }}
              initial={{ y: 0, x: 0, rotate: lane.rotate, opacity: 0 }}
              animate={{ y: '120vh', x: [0, lane.sway, -lane.sway, 0], rotate: lane.rotate, opacity: 1 }}
              transition={{
                y: { duration: lane.dur, delay: lane.delay, repeat: Infinity, ease: 'linear' },
                x: { duration: lane.dur, delay: lane.delay, repeat: Infinity, ease: 'linear' },
                opacity: { duration: 0.5 },
              }}
            >
              <div
                className="size-full overflow-hidden rounded-lg"
                style={{ border: '2px solid #fff', boxShadow: '0 4px 14px rgba(0,0,0,0.55)' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lane.url} alt="" className="size-full object-cover" draggable={false} />
              </div>
            </motion.div>
          ))}

          {/* "Tap to open" hint — only once the gift box has settled */}
          {droneStage === 3 && (
            <motion.div
              className="absolute inset-x-0 flex justify-center pointer-events-none"
              style={{ top: '50%', zIndex: 9 }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: [0, 1, 0.6, 1], y: 0 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span
                className="rounded-full"
                style={{
                  padding: '6px 16px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                  fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'italic',
                  fontSize: 'clamp(13px, 2.6vw, 15px)', color: '#fff',
                }}
              >
                🎁 Tap to open
              </span>
            </motion.div>
          )}
        </>
      )}

      {/* ── SNOWMAN — stands watching in the foreground the whole time,
             then gives an excited wave once Santa's sleigh appears
             overhead, echoing the reference photo's "snowman watching
             the sleigh cross the moon" moment. ── */}
      <motion.div
        className="absolute pointer-events-none"
        style={{ left: '5%', bottom: '1%', zIndex: 3, fontSize: 'clamp(60px, 16vw, 104px)', transformOrigin: 'bottom center' }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
      >
        <motion.span
          style={{ display: 'inline-block', transformOrigin: 'bottom center' }}
          animate={stage >= 1 ? { rotate: [0, -8, 5, -6, 3, 0] } : { rotate: 0 }}
          transition={
            stage >= 1
              ? { duration: 1.8, repeat: Infinity, repeatDelay: 0.8, ease: 'easeInOut', delay: FLY_DURATION_MS / 1000 }
              : { duration: 0.3 }
          }
        >
          ⛄
        </motion.span>
      </motion.div>

      {/* ── Stage caption ── */}
      <div className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ top: '6%', zIndex: 9 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 0.9, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'italic',
              fontSize: 'clamp(15px, 2.6vw, 19px)', color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,0.7)',
            }}
          >
            {stage === 0
              ? '❄️ A quiet little village, waiting for one more visitor...'
              : '🎅 Santa has arrived!'}
          </motion.div>
        </AnimatePresence>
      </div>

      {kiss.message && stage >= 1 && (
        <ParchmentNote
          message={kiss.message}
          senderName={kiss.sender_name}
          photoUrl={photoUrl}
          open={showNote}
          onClose={() => setShowNote(false)}
        />
      )}

      {/* ── Zoomed photo — full-screen, tap anywhere to dismiss ── */}
      <AnimatePresence>
        {zoomedPhoto && (
          <motion.div
            className="fixed inset-0 z-400 flex items-center justify-center p-6 cursor-pointer"
            style={{ background: 'rgba(2,2,18,0.92)' }}
            onClick={(e) => { e.stopPropagation(); setZoomedPhoto(null); }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.div
              className="overflow-hidden rounded-lg"
              style={{ maxWidth: '92vw', maxHeight: '80vh', border: '3px solid #fff', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={zoomedPhoto} alt="" style={{ display: 'block', maxWidth: '92vw', maxHeight: '80vh', objectFit: 'contain' }} draggable={false} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const XmasFireplaceConfig: TemplateConfig = {
  id: 'xmas-fireplace',
  name: 'Village Arrival',
  occasionIds: ['christmas'],
  emoji: '🛷',
  description: 'A cozy snowy village at dusk, then Santa\'s sleigh swoops down to deliver the note.',
  thumbnailBg: 'linear-gradient(135deg, #2a1c46, #c96a4a)',
  premium: true,
  coins: 15,
  Component: XmasFireplaceReveal,
};
