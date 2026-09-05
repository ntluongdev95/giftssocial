'use client';

// Xa Mặt Gần Lòng — for couples apart at Tết. Two phases:
//
//   Phase 0  Fireworks fill the sky.
//   Phase 1  A drone-light formation spells "HAPPY NEW YEAR", then
//            morphs in place into a hand holding up a phone — and the
//            phone's screen is the sender's OWN uploaded photo, not a
//            drawn image, faded in once the outline settles.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getKissString, parseKissData } from '../_shared/useTemplateData';
import type { TemplateProps, TemplateConfig } from '../_types';

const FIREWORKS_ONLY_MS = 2400;
const GREETING_HOLD_MS = 4200;
const DRONE_DOT_COUNT = 3200;
const DRONE_MORPH_MS = 1300;
const PHOTO_FADE_DELAY_MS = DRONE_MORPH_MS + 300;

type Pt = { x: number; y: number; color?: string };
type NormRect = { minX: number; maxX: number; minY: number; maxY: number };

// ─────────────────────────────────────────────────────────────────────
// "HAPPY NEW YEAR" — two centered lines, warm gold palette, same
// alpha-sampling technique used across the other Tết/New Year templates.
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

  let size1 = Math.round(H * 0.26);
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
// A hand holding up a phone — OUTLINE only (stroked, not filled), so
// the phone's screen stays transparent for the sender's real photo to
// show through. Built from simple canvas primitives (rounded rects,
// circles, a path for the palm/wrist) rather than one hand-authored
// bezier path, for reliability. Returns the point cloud AND the
// phone-screen rectangle in the same normalized (-1..1) space, so the
// real <img> overlay can be positioned with the exact same scale/offset
// math the drone canvas uses.
// ─────────────────────────────────────────────────────────────────────
function sampleHandPhoneOutline(): { points: Pt[]; screenRect: NormRect } {
  if (typeof document === 'undefined') {
    return { points: [], screenRect: { minX: -0.3, maxX: 0.3, minY: -0.3, maxY: 0.3 } };
  }
  const W = 700, H = 900;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { points: [], screenRect: { minX: -0.3, maxX: 0.3, minY: -0.3, maxY: 0.3 } };

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 13;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // phone body
  ctx.beginPath();
  ctx.roundRect(190, 110, 320, 460, 42);
  ctx.stroke();

  // screen (this rect, in normalized space, is where the real photo goes)
  const screen = { x: 222, y: 152, w: 256, h: 340 };
  ctx.beginPath();
  ctx.roundRect(screen.x, screen.y, screen.w, screen.h, 16);
  ctx.stroke();

  // camera notch
  ctx.beginPath();
  ctx.arc(350, 132, 7, 0, Math.PI * 2);
  ctx.stroke();

  // palm/wrist — tapered trapezoid below the phone
  ctx.beginPath();
  ctx.moveTo(210, 560);
  ctx.quadraticCurveTo(200, 600, 240, 640);
  ctx.lineTo(280, 840);
  ctx.quadraticCurveTo(290, 870, 320, 870);
  ctx.lineTo(380, 870);
  ctx.quadraticCurveTo(410, 870, 420, 840);
  ctx.lineTo(460, 640);
  ctx.quadraticCurveTo(500, 600, 490, 560);
  ctx.stroke();

  // thumb, curling over the phone's right edge
  ctx.beginPath();
  ctx.moveTo(500, 420);
  ctx.quadraticCurveTo(560, 400, 575, 450);
  ctx.quadraticCurveTo(585, 490, 550, 510);
  ctx.quadraticCurveTo(505, 520, 495, 480);
  ctx.stroke();

  // finger tips, peeking over the left edge
  for (const fy of [430, 480, 530]) {
    ctx.beginPath();
    ctx.arc(200, fy, 16, Math.PI * 0.15, Math.PI * 1.5);
    ctx.stroke();
  }

  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: Pt[] = [];
  const stride = 2;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        const nx = (x / W - 0.5) * 2;
        const ny = (y / H - 0.5) * 2;
        pts.push({ x: nx, y: ny, color: '#eef2ff' });
      }
    }
  }

  const toNorm = (x: number, y: number) => ({ nx: (x / W - 0.5) * 2, ny: (y / H - 0.5) * 2 });
  const a = toNorm(screen.x, screen.y);
  const b = toNorm(screen.x + screen.w, screen.y + screen.h);
  const screenRect: NormRect = { minX: a.nx, minY: a.ny, maxX: b.nx, maxY: b.ny };

  return { points: pts, screenRect };
}

function packToCount(pts: Pt[], n: number): Pt[] {
  if (pts.length === 0) return [];
  if (pts.length >= n) {
    const stride = pts.length / n;
    return Array.from({ length: n }).map((_, i) => pts[Math.floor(i * stride)]);
  }
  return Array.from({ length: n }).map((_, i) => pts[i % pts.length]);
}

function TetLongDistanceReveal({ kiss, onClose }: TemplateProps) {
  const rawName = (getKissString(kiss, 'name') || kiss.receiver_name || '').trim();
  const photo: string = (() => {
    const raw = parseKissData(kiss).photos;
    if (Array.isArray(raw)) {
      const first = raw.find((u): u is string => typeof u === 'string' && !!u);
      if (first) return first;
    }
    return getKissString(kiss, 'photo');
  })();

  // phase 0 = fireworks alone · 1 = drone spells the greeting, then
  // morphs into the hand+phone with the real photo in its screen
  const [phase, setPhase] = useState<0 | 1>(0);
  const [droneStage, setDroneStage] = useState<0 | 1>(0);
  const isHandStage = droneStage === 1;
  const canInteract = phase === 1 && isHandStage;
  const [showNote, setShowNote] = useState(false);
  const [messageSeen, setMessageSeen] = useState(false);
  const openMessage = () => { setShowNote(true); setMessageSeen(true); };

  useEffect(() => {
    const t = window.setTimeout(() => setPhase(1), FIREWORKS_ONLY_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== 1) return;
    const t = window.setTimeout(() => setDroneStage(1), GREETING_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (!canInteract) return;
    if (kiss.message && !messageSeen) return;
    const t = window.setTimeout(() => onClose?.(), 14000);
    return () => window.clearTimeout(t);
  }, [canInteract, kiss.message, messageSeen, onClose]);

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

  // Fireworks — gold/blue/white, filling the sky from the start.
  const fireworks = useMemo(() => {
    const COLORS = ['#fbbf24', '#f97316', '#fde047', '#60a5fa', '#fff', '#a78bfa'];
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

  // The greeting → hand+phone point-cloud pair, sampled once.
  const handPhone = useMemo(() => sampleHandPhoneOutline(), []);
  const dronePointSets = useMemo(() => ([
    packToCount(sampleGreetingComposite('HAPPY', 'NEW YEAR'), DRONE_DOT_COUNT),
    packToCount(handPhone.points, DRONE_DOT_COUNT),
  ]), [handPhone.points]);

  // Shared framing (union bounding box across both point sets) — used
  // by BOTH the canvas draw loop AND the real-photo overlay, so the
  // photo lands exactly inside the drone-drawn phone screen instead of
  // two independently-guessed layouts drifting apart.
  const droneFraming = useMemo(() => {
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
    return { midX: (minX + maxX) / 2, midY: (minY + maxY) / 2, spanX, spanY };
  }, [dronePointSets]);

  const droneCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const droneStageRef = useRef(droneStage);
  useEffect(() => { droneStageRef.current = droneStage; }, [droneStage]);
  const droneActive = phase >= 1;

  const [canvasFrame, setCanvasFrame] = useState<{ w: number; h: number; scale: number } | null>(null);

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

    const cx = W / 2, cy = H / 2;
    const { midX, midY, spanX, spanY } = droneFraming;
    const scale = Math.min(W / spanX, H / spanY) * 0.94;
    setCanvasFrame({ w: W, h: H, scale });

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
      // fixed the same way across the other drone-light templates).
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      const targetSet = dronePointSets[currentStage];
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const tp = targetSet[i];
        const tx = cx + (tp.x - midX) * scale, ty = cy + (tp.y - midY) * scale;
        const elapsed = Math.max(0, now - d.morphStart - d.delay);
        const t = Math.min(1, elapsed / DRONE_MORPH_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        d.x = d.fromX + (tx - d.fromX) * eased;
        d.y = d.fromY + (ty - d.fromY) * eased;

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
    raf = requestAnimationFrame(draw);
    const syncInterval = window.setInterval(() => { currentStage = droneStageRef.current; }, 100);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(syncInterval);
    };
  }, [droneActive, dronePointSets, droneFraming]);

  // Real-photo overlay rect, in canvas-local CSS pixels — derived from
  // the SAME scale/mid values the canvas draw loop uses, so it lines
  // up with the drone-drawn phone screen exactly.
  const photoRect = useMemo(() => {
    if (!canvasFrame) return null;
    const { w: W, h: H, scale } = canvasFrame;
    const cx = W / 2, cy = H / 2;
    const { midX, midY } = droneFraming;
    const { screenRect } = handPhone;
    const left = cx + (screenRect.minX - midX) * scale;
    const top = cy + (screenRect.minY - midY) * scale;
    const right = cx + (screenRect.maxX - midX) * scale;
    const bottom = cy + (screenRect.maxY - midY) * scale;
    return { left, top, width: right - left, height: bottom - top };
  }, [canvasFrame, droneFraming, handPhone]);

  return (
    <div
      className="fixed inset-0 z-200 overflow-hidden select-none"
      style={{ background: 'linear-gradient(180deg, #050a1a 0%, #0b1230 45%, #1a1440 75%, #3a0a2a 100%)', fontFamily: "'Playfair Display', Georgia, serif" }}
      onClick={() => {
        if (!canInteract) return;
        if (kiss.message && !messageSeen) return;
        onClose?.();
      }}
    >
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
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: [0, 1, 0], scale: [0.3, 1.6, 1.6] }}
              transition={{ duration: 0.4, delay: burstDelay, repeat: Infinity, repeatDelay: fw.period - 0.4, ease: 'easeOut' }}
            />
            {Array.from({ length: fw.particles }).map((_, pi) => {
              const angle = (pi / fw.particles) * Math.PI * 2;
              const dist = (isWillow ? 60 : 42) * fw.scale;
              const fallExtra = isWillow ? 34 * fw.scale : 0;
              return (
                <motion.div
                  key={pi}
                  className="absolute rounded-full"
                  style={{ width: 4 * fw.scale, height: 4 * fw.scale, marginLeft: -2 * fw.scale, marginTop: -2 * fw.scale, background: fw.color, boxShadow: `0 0 5px ${fw.color}` }}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{
                    x: Math.cos(angle) * dist,
                    y: [0, Math.sin(angle) * dist, Math.sin(angle) * dist + fallExtra],
                    opacity: 0, scale: 0.3,
                  }}
                  transition={{ duration: burstDuration, delay: burstDelay, repeat: Infinity, repeatDelay: fw.period - burstDuration, ease: 'easeOut' }}
                />
              );
            })}
            {isCrackle && Array.from({ length: 10 }).map((_, ci) => {
              const angle = (ci / 10) * Math.PI * 2 + 0.3;
              const dist = 60 * fw.scale;
              const crackleDelay = burstDelay + 0.18;
              return (
                <motion.div
                  key={`crackle-${ci}`}
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

      {/* ── DRONE FORMATION — "HAPPY NEW YEAR", then morphs in place
             into a hand holding a phone. Once the outline settles, the
             sender's real photo fades into the phone's screen. ── */}
      {phase >= 1 && (
        <div className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ top: '18%', zIndex: 5, overflow: 'visible' }}>
          <div style={{ position: 'relative' }}>
            <canvas
              ref={droneCanvasRef}
              style={{ width: '92vw', maxWidth: 560, height: 'clamp(360px, 86vw, 620px)', display: 'block' }}
            />
            {isHandStage && photo && photoRect && (
              <motion.div
                className="absolute overflow-hidden"
                style={{
                  left: photoRect.left, top: photoRect.top, width: photoRect.width, height: photoRect.height,
                  borderRadius: 14,
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.9, delay: PHOTO_FADE_DELAY_MS / 1000, ease: 'easeOut' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="" className="size-full object-cover" draggable={false} />
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* ── Tap-to-open, fingerprint style — once the hand+phone has settled ── */}
      {canInteract && !showNote && (
        <motion.div
          className="absolute inset-x-0 flex flex-col items-center pointer-events-none"
          style={{ top: '78%', zIndex: 12 }}
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
                style={{ border: '2px solid rgba(167,139,250,0.65)' }}
                animate={{ scale: [1, 1.45, 1], opacity: [0.75, 0, 0.75] }}
                transition={{ duration: 1.7, repeat: Infinity, ease: 'easeOut' }}
              />
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(167,139,250,0.55)', backdropFilter: 'blur(4px)' }}
              >
                <span style={{ fontSize: 26 }}>🫆</span>
              </div>
            </div>
            <span
              className="mt-2 rounded-full"
              style={{
                padding: '4px 14px', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
                border: '1px solid rgba(167,139,250,0.4)', color: '#e0d4ff', fontSize: 12, fontStyle: 'italic',
              }}
            >
              Tap to open
            </span>
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {showNote && kiss.message && (
          <motion.div
            className="fixed inset-0 z-300 flex items-center justify-center px-6"
            style={{ background: 'rgba(5,3,15,0.9)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onClose?.()}
          >
            <motion.div
              className="w-full max-w-sm rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(160deg, #1a1440 0%, #3a0a2a 100%)',
                border: '1px solid rgba(167,139,250,0.4)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              }}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ height: 5, background: 'linear-gradient(90deg, #a78bfa, #fde68a, #f472b6, #a78bfa)' }} />
              <div className="p-6 text-center">
                <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#c4b5fd' }}>
                  💌 Gửi từ nơi xa
                </div>
                <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 17, color: '#fdfbf5', lineHeight: 1.6 }}>
                  &ldquo;{kiss.message}&rdquo;
                </p>
                {rawName && (
                  <div className="mt-4 text-sm" style={{ color: '#c4b5fd' }}>
                    Gửi {rawName}
                  </div>
                )}
                {kiss.sender_name && (
                  <div className="mt-1 text-xs opacity-70" style={{ color: '#fff' }}>
                    — {kiss.sender_name}
                  </div>
                )}
                <div className="mt-4 text-[11px] opacity-50" style={{ color: '#fff' }}>Tap to close</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TetLongDistanceReveal;

export const TetLongDistanceConfig: TemplateConfig = {
  id: 'tet-long-distance',
  name: 'Xa Mặt, Gần Lòng',
  occasionIds: ['tet'],
  emoji: '📱',
  description: 'Fireworks fill the sky, then a drone-light hand holds up your own photo together.',
  thumbnailBg: 'linear-gradient(135deg, #1a1440, #a78bfa)',
  Component: TetLongDistanceReveal,
};
