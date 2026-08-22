'use client';

// Good Night 2 — a girl sits on the windowsill watching a warm moon.
// The night sky inside the window frame holds a heart-shaped jigsaw,
// pieced together from the sender's photo. Once every piece is dragged
// home, a full-screen drone-show galaxy spins up and closes into a
// glowing heart as the grand finale, then the goodnight message rises.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playMessageChime, playCelebration, playHeartbeat } from '@/lib/kiss-audio';
import { getKissString, parseKissData } from '../_shared/useTemplateData';
import type { TemplateProps, TemplateConfig } from '../_types';

const SKY_BLACK  = '#020212';
const MOON_CORE  = '#FFF8E1';
const MOON_MID   = '#F6C46A';
const MOON_DEEP  = '#B4761D';
const HEART      = '#F43F5E';
const HEART_HOT  = '#FDA4AF';
const GIRL_SILH  = '#1c1730';
const FRAME_DARK = '#0a0812';

const FONT_HERO    = "'Playfair Display', 'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const FONT_WHISPER = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const FONT_BODY    = "'Inter', system-ui, -apple-system, sans-serif";

const DEFAULT_PUZZLE_IMG =
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=85';

const COLS = 3;
const ROWS = 4;
const COUNT = COLS * ROWS; // exactly 12 pieces — every one gets used, none wasted

const heartD = (b: number) =>
  `M${b / 2} ${b * 0.92} C ${b * 0.08} ${b * 0.62}, 0 ${b * 0.33}, ${b * 0.19} ${b * 0.17} C ${b * 0.35} ${b * 0.03}, ${b * 0.49} ${b * 0.12}, ${b / 2} ${b * 0.26} C ${b * 0.51} ${b * 0.12}, ${b * 0.65} ${b * 0.03}, ${b * 0.81} ${b * 0.17} C ${b} ${b * 0.33}, ${b * 0.92} ${b * 0.62}, ${b / 2} ${b * 0.92} Z`;

// ─────────────────────────────────────────────────────────────────────
// DroneIntro — a swarm of light-dots streams up and converges into a
// heart silhouette (drone-show style), then "I LOVE YOU" lights up
// letter by letter underneath.
// ─────────────────────────────────────────────────────────────────────
const DRONE_W = 300;
const DRONE_H = 230;
const DRONE_DOTS = 170;

/** One "wing" outline, traced from the reference photo: a smooth
 * convex outer edge (the back of the hand) sweeping up from the base
 * point, a small rounded cap at the top, then a gently scalloped
 * inner edge (three soft knuckle-like waves suggesting fingers)
 * coming back down to the same base point. Raw units, base at (0,0),
 * shape extends up (−y) and to the right (+x) — mirror x for the
 * left hand. */
const WING_CURVES: [number, number, number, number, number, number][] = [
  [15, -38, 25, -78, 30, -108],
  [45, -126, 65, -138, 85, -133],
  [92, -124, 88, -112, 74, -117],
  [60, -103, 68, -93, 55, -85],
  [42, -75, 50, -67, 37, -59],
  [25, -49, 31, -39, 19, -29],
  [10, -19, 5, -9, 0, 0],
];

function wingD(scale: number, mirror: boolean): string {
  const mx = mirror ? -1 : 1;
  let d = 'M0,0';
  for (const [c1x, c1y, c2x, c2y, ex, ey] of WING_CURVES) {
    d += ` C${c1x * scale * mx},${c1y * scale} ${c2x * scale * mx},${c2y * scale} ${ex * scale * mx},${ey * scale}`;
  }
  return `${d} Z`;
}

/** Dots sampled evenly along two mirrored wing outlines whose base
 * points meet at bottom-center — two hands closing together into a
 * heart, matching the drone-show reference photo. */
function heartDotTargets() {
  if (typeof document === 'undefined') return [];
  const scale = (DRONE_H * 0.8) / 138;
  const tipX = DRONE_W / 2;
  const tipY = DRONE_H * 0.96;
  const perSide = Math.floor(DRONE_DOTS / 2);

  const svgNS = 'http://www.w3.org/2000/svg';
  const sampleSide = (side: 'left' | 'right') => {
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', wingD(scale, side === 'left'));
    const total = path.getTotalLength();
    return Array.from({ length: perSide }, (_, i) => {
      const p = path.getPointAtLength((i / perSide) * total);
      return { x: tipX + p.x, y: tipY + p.y, side };
    });
  };

  return [...sampleSide('left'), ...sampleSide('right')];
}

type DroneDot = { tx: number; ty: number; sx: number; sy: number; delay: number };

const GALAXY_SPIN_S = 3.2; // grand 3D-spinning galaxy act, before the heart forms
const HEART_FORM_S = 1.15; // dots flying from the settling galaxy into the heart
const GALAXY_ARMS = 3;
const GALAXY_STAR_COUNT = 220;
const RED = '#FF1744';
const RED_HOT = '#FF6E8F';

const SHOOTING_STARS = Array.from({ length: 10 }, (_, i) => {
  const s = (i * 2654435761) >>> 0;
  const r = (n: number) => (((s ^ (n * 0x9e3779b1)) >>> 0) % 10000) / 10000;
  return {
    fromXPct: r(1) * 120 - 10,
    fromYPct: r(2) * 70,
    angleDeg: -20 - r(3) * 30,
    lengthVmin: 9 + r(4) * 9,
    distVmin: 22 + r(5) * 20,
    delay: 0.2 + r(6) * (GALAXY_SPIN_S - 0.6),
    duration: 0.5 + r(7) * 0.35,
  };
});

/** A 3-armed spiral of tiny stars, spun in real 3D (perspective + a
 * constant rotateX tilt while rotateZ spins through several full
 * turns) — the "hoành tráng, xoay 3D" galaxy act before the heart
 * assembles. Positions are in vmin units around screen-center so the
 * whole thing fills the viewport on any device, not just a small box. */
function galaxyStars() {
  const maxRVmin = 46;
  return Array.from({ length: GALAXY_STAR_COUNT }, (_, i) => {
    const arm = i % GALAXY_ARMS;
    const t = Math.floor(i / GALAXY_ARMS) / Math.ceil(GALAXY_STAR_COUNT / GALAXY_ARMS);
    const s = (i * 2654435761) >>> 0;
    const rnd = (n: number) => (((s ^ (n * 0x9e3779b1)) >>> 0) % 10000) / 10000;
    const theta = arm * ((2 * Math.PI) / GALAXY_ARMS) + t * 5.4 + (rnd(1) - 0.5) * 0.3;
    const radiusVmin = maxRVmin * t + (rnd(2) - 0.5) * 3;
    return {
      xVmin: radiusVmin * Math.cos(theta),
      yVmin: radiusVmin * Math.sin(theta),
      size: 1 + (1 - t) * 2.6,
      op: 0.4 + (1 - t) * 0.5,
    };
  });
}

/** Full-viewport galaxy — escapes the small heart-formation box so the
 * 3D spin, shooting stars and zoom genuinely cover the whole screen. */
function GalaxyBackdrop() {
  const stars = useMemo(() => galaxyStars(), []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ perspective: '120vmin' }}>
      {/* shooting stars streaking across the whole screen */}
      {SHOOTING_STARS.map((sh, i) => {
        const rad = (sh.angleDeg * Math.PI) / 180;
        const dx = `${Math.cos(rad) * sh.distVmin}vmin`;
        const dy = `${Math.sin(rad) * sh.distVmin}vmin`;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${sh.fromXPct}%`,
              top: `${sh.fromYPct}%`,
              width: `${sh.lengthVmin}vmin`,
              height: 2,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.95))',
              transform: `rotate(${sh.angleDeg}deg)`,
              transformOrigin: 'left center',
            }}
            initial={{ opacity: 0, x: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], x: dx, y: dy }}
            transition={{ duration: sh.duration, delay: sh.delay, ease: 'easeIn' }}
          />
        );
      })}

      {/* the spinning 3D star-disc — zooms in close then settles back, like flying through space */}
      <motion.div
        className="absolute"
        style={{ left: '50%', top: '42%', transformStyle: 'preserve-3d' }}
        initial={{ opacity: 0, scale: 0.12, rotateX: 58, rotateZ: 0 }}
        animate={{ opacity: [0, 1, 1, 1, 0], scale: [0.12, 1.7, 1.25, 1.1, 0.85], rotateX: 58, rotateZ: [0, 260, 640, 1180] }}
        transition={{ duration: GALAXY_SPIN_S, times: [0, 0.3, 0.55, 0.85, 1], ease: 'easeInOut' }}
      >
        {stars.map((st, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${st.xVmin}vmin`,
              top: `${st.yVmin}vmin`,
              width: st.size,
              height: st.size,
              background: '#fff',
              opacity: st.op,
              boxShadow: '0 0 6px rgba(216,180,254,0.85)',
            }}
          />
        ))}
        {/* bright core */}
        <span
          className="absolute rounded-full"
          style={{
            left: '-10px',
            top: '-10px',
            width: 20,
            height: 20,
            background: `radial-gradient(circle, #fff, ${MOON_MID}00 70%)`,
            filter: 'blur(2px)',
          }}
        />
      </motion.div>
    </div>
  );
}

function DroneIntro({ subtitle }: { subtitle: string }) {
  const [dots, setDots] = useState<DroneDot[]>([]);

  useEffect(() => {
    const targets = heartDotTargets();
    const cx = DRONE_W / 2;
    const cy = DRONE_H * 0.42;
    const maxR = Math.min(DRONE_W, DRONE_H) * 0.42;

    setDots(
      targets.map((tgt, i) => {
        const s = (i * 2654435761) >>> 0;
        const r = (n2: number) => (((s ^ (n2 * 0x9e3779b1)) >>> 0) % 10000) / 10000;
        const angle = r(1) * Math.PI * 2;
        const radius = maxR * (0.2 + r(2) * 0.8);
        return {
          tx: tgt.x,
          ty: tgt.y,
          sx: cx + radius * Math.cos(angle),
          sy: cy + radius * Math.sin(angle),
          delay: GALAXY_SPIN_S - 0.35 + r(3) * 0.3,
        };
      }),
    );
  }, []);

  const letters = 'I LOVE YOU'.split('');
  const textDelay = GALAXY_SPIN_S + HEART_FORM_S + 0.1;

  return (
    // The dots box keeps its own fixed size, so centering it centers the
    // heart itself — the text stacks below via absolute position and
    // never shifts the heart off-center.
    <div className="relative" style={{ width: DRONE_W, height: DRONE_H }}>
      {dots.map((d, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{ width: 3.5, height: 3.5, background: RED_HOT, boxShadow: `0 0 8px 2px ${RED}dd` }}
          initial={{ x: d.sx, y: d.sy, opacity: 0 }}
          animate={{ x: d.tx, y: d.ty, opacity: [0, 1, 1] }}
          transition={{ duration: HEART_FORM_S, delay: d.delay, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
      {/* red flash the instant the heart completes */}
      <motion.div
        className="pointer-events-none absolute rounded-full"
        style={{
          left: DRONE_W / 2 - 70,
          top: DRONE_H * 0.42 - 70,
          width: 140,
          height: 140,
          background: `radial-gradient(circle, ${RED_HOT}, transparent 70%)`,
        }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0.9, 0], scale: [0.4, 1.8] }}
        transition={{ duration: 0.9, delay: GALAXY_SPIN_S + HEART_FORM_S - 0.1, ease: 'easeOut' }}
      />
      <div className="absolute left-1/2 flex -translate-x-1/2 gap-[3px]" style={{ top: DRONE_H + 10 }}>
        {letters.map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0.4, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.35, delay: textDelay + i * 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontFamily: FONT_HERO,
              fontWeight: 700,
              fontSize: 'clamp(20px, 4.2vw, 34px)',
              letterSpacing: '0.04em',
              color: '#fff',
              textShadow: `0 0 8px rgba(255,255,255,0.9), 0 0 22px ${RED}99`,
            }}
          >
            {ch === ' ' ? ' ' : ch}
          </motion.span>
        ))}
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.85 }}
        transition={{ duration: 0.8, delay: textDelay + letters.length * 0.16 + 0.3 }}
        className="absolute left-1/2 w-max max-w-[80vw] -translate-x-1/2 text-center"
        style={{
          top: DRONE_H + 56,
          fontFamily: FONT_WHISPER,
          fontStyle: 'italic',
          fontSize: 'clamp(13px, 2.2vw, 17px)',
          color: 'rgba(255,255,255,0.85)',
          textShadow: '0 2px 10px rgba(0,0,0,0.7)',
        }}
      >
        {subtitle}
      </motion.p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TypewriterText — reveals a line one character at a time, cursor blink
// at the end while typing.
// ─────────────────────────────────────────────────────────────────────
function TypewriterText({ text, speedMs = 55 }: { text: string; speedMs?: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    const t = window.setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          window.clearInterval(t);
          return n;
        }
        return n + 1;
      });
    }, speedMs);
    return () => window.clearInterval(t);
  }, [text, speedMs]);

  const done = shown >= text.length;

  return (
    <span>
      {text.slice(0, shown)}
      {!done && <span className="animate-pulse">▍</span>}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// HeartPuzzle — drag-and-drop jigsaw. Pieces scatter across the window
// opening; dragging a piece near its slot snaps it home, clipped to a
// heart silhouette built from the sender's photo.
// ─────────────────────────────────────────────────────────────────────
type Piece = { id: number; x: number; y: number; placed: boolean; rotate: number };

// Deterministic shuffle (same seed every render) — the draw order pieces
// come off the stack in, independent of the photo-crop id order.
function shuffledOrder(count: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const s = (i * 2654435761) >>> 0;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function HeartPuzzle({ photoUrl, onSolved }: { photoUrl: string; onSolved: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState(280);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [drag, setDrag] = useState<{ id: number; dx: number; dy: number; target: { x: number; y: number } } | null>(
    null,
  );
  const [hintId, setHintId] = useState<number | null>(null);
  const [hintTarget, setHintTarget] = useState<{ x: number; y: number } | null>(null);
  const cellIds = useMemo(() => Array.from({ length: COUNT }, (_, id) => id), []);
  // The order pieces are drawn from the stack — one at a time, top card first.
  const drawOrder = useMemo(() => shuffledOrder(COUNT), []);

  const cw = board / COLS;
  const ch = board / ROWS;

  useEffect(() => {
    const fit = () => {
      const w = wrapRef.current?.clientWidth ?? 400;
      const h = wrapRef.current?.clientHeight ?? 500;
      setBoard(Math.max(220, Math.min(440, Math.min(w * 0.9, h * 0.62))));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    if (hintId === null) return;
    const t = window.setTimeout(() => {
      setHintId(null);
      setHintTarget(null);
    }, 2600);
    return () => window.clearTimeout(t);
  }, [hintId]);

  // All pieces start stacked into a single deck below the heart — a
  // clean, professional "draw one card at a time" pile instead of a
  // messy scatter of photos across the screen.
  useEffect(() => {
    const w = wrapRef.current?.clientWidth ?? 400;
    const h = wrapRef.current?.clientHeight ?? 500;
    const oy = (h - board) / 2;
    const marginBelow = h - (oy + board);
    const anchorX = w / 2 - cw / 2;
    const anchorY = oy + board + Math.max(10, Math.min(marginBelow - ch - 8, marginBelow * 0.4));
    setPieces((prev) =>
      prev.length === cellIds.length
        ? prev
        : cellIds.map((id) => ({
            id,
            x: anchorX,
            y: anchorY,
            placed: false,
            rotate: -6 + ((id * 2654435761) >>> 0) % 1200 / 100,
          })),
    );
  }, [cellIds, cw, ch, board]);

  const slotPos = useCallback(
    (id: number) => {
      const w = wrapRef.current?.clientWidth ?? 400;
      const h = wrapRef.current?.clientHeight ?? 500;
      const ox = (w - board) / 2;
      const oy = (h - board) / 2;
      return { x: ox + (id % COLS) * cw, y: oy + Math.floor(id / COLS) * ch };
    },
    [board, cw, ch],
  );

  const onPointerDown = (e: React.PointerEvent, p: Piece) => {
    if (p.placed) return;
    const rect = wrapRef.current!.getBoundingClientRect();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: p.id, dx: e.clientX - rect.left - p.x, dy: e.clientY - rect.top - p.y, target: slotPos(p.id) });
    setPieces((prev) => [...prev.filter((q) => q.id !== p.id), p]);
    setHintId(null);
    setHintTarget(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const rect = wrapRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left - drag.dx;
    const y = e.clientY - rect.top - drag.dy;
    setPieces((prev) => prev.map((p) => (p.id === drag.id ? { ...p, x, y } : p)));
  };

  const onPointerUp = () => {
    if (!drag) return;
    const target = drag.target;
    setPieces((prev) =>
      prev.map((p) => {
        if (p.id !== drag.id) return p;
        const near = Math.hypot(p.x - target.x, p.y - target.y) < Math.min(cw, ch) * 0.7;
        if (near) playMessageChime();
        return near ? { ...p, x: target.x, y: target.y, placed: true } : p;
      }),
    );
    setDrag(null);
  };

  // Draw order among what's left in the deck — index 0 is the top card,
  // the only one that's actually draggable right now. Guarded against the
  // first render, where `pieces` hasn't been populated by the init effect yet.
  const stackOrder = drawOrder.filter((id) => {
    const p = pieces.find((q) => q.id === id);
    return p && !p.placed;
  });
  const topId = stackOrder[0] ?? null;

  // Hints only appear when the player taps "Gợi ý" — always points at the
  // card currently on top of the deck, since that's the only one in play.
  const requestHint = () => {
    if (topId === null) {
      setHintId(null);
      setHintTarget(null);
      return;
    }
    setHintId(topId);
    setHintTarget(slotPos(topId));
  };

  const solved = cellIds.length > 0 && pieces.length === cellIds.length && pieces.every((p) => p.placed);
  useEffect(() => {
    if (solved) onSolved();
  }, [solved, onSolved]);

  const dragging = drag ? (pieces.find((p) => p.id === drag.id) ?? null) : null;
  const dragNear =
    dragging && drag
      ? Math.hypot(dragging.x - drag.target.x, dragging.y - drag.target.y) < Math.min(cw, ch) * 0.7
      : false;

  const hintPiece = hintId !== null ? (pieces.find((p) => p.id === hintId) ?? null) : null;
  const placedCount = pieces.filter((p) => p.placed).length;
  const heartClip = `path('${heartD(board)}')`;

  return (
    <div
      ref={wrapRef}
      className="relative size-full touch-none select-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* heart outline guide + faint target image, so the player can see
          what they're building toward before it's finished */}
      <div
        className="pointer-events-none absolute opacity-25"
        style={{
          left: `calc(50% - ${board / 2}px)`,
          top: `calc(50% - ${board / 2}px)`,
          width: board,
          height: board,
          clipPath: heartClip,
          backgroundImage: `url(${photoUrl})`,
          backgroundSize: `${board}px ${board}px`,
          filter: 'grayscale(1) brightness(0.7)',
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          left: `calc(50% - ${board / 2}px)`,
          top: `calc(50% - ${board / 2}px)`,
          width: board,
          height: board,
          clipPath: heartClip,
          boxShadow: `0 0 40px ${MOON_MID}33`,
        }}
      />

      {/* target slot grid so the player sees where each piece belongs —
          the faint dashed outline is always visible; the specific cell +
          piece lighting up only happens when "Gợi ý" is tapped. */}
      <div
        className="pointer-events-none absolute"
        style={{ left: `calc(50% - ${board / 2}px)`, top: `calc(50% - ${board / 2}px)`, width: board, height: board }}
      >
        {cellIds.map((id) => {
          const isPlaced = pieces.some((p) => p.id === id && p.placed);
          const isDragTarget = dragging?.id === id;
          const isHintTarget = hintId === id;
          if (isPlaced) return null;
          return (
            <div
              key={id}
              className={`absolute border border-dotted transition-colors duration-150 ${
                isDragTarget && dragNear
                  ? 'border-amber-200 bg-amber-100/20'
                  : isDragTarget
                    ? 'border-amber-200/80'
                    : isHintTarget
                      ? 'animate-pulse border-rose-300 bg-rose-300/20'
                      : 'border-white/40'
              }`}
              style={{
                left: (id % COLS) * cw,
                top: Math.floor(id / COLS) * ch,
                width: cw,
                height: ch,
              }}
            />
          );
        })}
      </div>

      {/* pieces already placed, clipped to the heart curve */}
      <div
        className="pointer-events-none absolute"
        style={{ left: `calc(50% - ${board / 2}px)`, top: `calc(50% - ${board / 2}px)`, width: board, height: board, clipPath: heartClip }}
      >
        {pieces
          .filter((p) => p.placed)
          .map((p) => (
            <div
              key={p.id}
              className="animate-rise absolute"
              style={{
                left: (p.id % COLS) * cw,
                top: Math.floor(p.id / COLS) * ch,
                width: cw,
                height: ch,
                backgroundImage: `url(${photoUrl})`,
                backgroundSize: `${board}px ${board}px`,
                backgroundPosition: `-${(p.id % COLS) * cw}px -${Math.floor(p.id / COLS) * ch}px`,
              }}
            />
          ))}
      </div>

      {/* the deck — pieces stacked into one pile. Only the top card is
          revealed and draggable; the rest peek out behind it, and the
          next one comes to the front the moment the top card is placed. */}
      {stackOrder.map((id, stackIdx) => {
          const p = pieces.find((q) => q.id === id);
          if (!p) return null;
          const isDragging = drag?.id === p.id;
          const isTop = stackIdx === 0;
          // Cards behind the top one fan out slightly, smallest offset
          // closest to the top so the pile reads as a tidy deck.
          const peek = isDragging ? 0 : Math.min(stackIdx, 5);
          return (
            <div
              key={p.id}
              onPointerDown={isTop ? (e) => onPointerDown(e, p) : undefined}
              className={`absolute rounded-md border-[3px] bg-white p-0.75 transition-[box-shadow,filter] duration-200 ${
                isTop ? 'cursor-grab touch-none active:cursor-grabbing' : 'pointer-events-none'
              } ${
                isDragging && dragNear
                  ? 'border-amber-200 shadow-[0_0_28px_rgba(255,248,225,0.75)]'
                  : hintId === p.id
                    ? 'animate-pulse border-rose-300 shadow-[0_0_28px_rgba(244,63,94,0.8)]'
                    : isTop
                      ? 'border-white/90 shadow-[0_6px_18px_rgba(0,0,0,0.5)]'
                      : 'border-white/70 shadow-[0_3px_10px_rgba(0,0,0,0.4)]'
              }`}
              style={{
                left: p.x + peek * 3,
                top: p.y - peek * 3,
                width: cw,
                height: ch,
                transform: `rotate(${isDragging ? 0 : p.rotate + peek * 1.2}deg)`,
                filter: isTop ? undefined : `brightness(${1 - peek * 0.05})`,
                zIndex: isDragging ? 30 : stackOrder.length - stackIdx,
              }}
            >
              <div
                className="size-full rounded-xs"
                style={{
                  backgroundImage: `url(${photoUrl})`,
                  backgroundSize: `${board}px ${board}px`,
                  backgroundPosition: `-${(p.id % COLS) * cw}px -${Math.floor(p.id / COLS) * ch}px`,
                }}
              />
            </div>
          );
        })}

      {/* hint arrow — only drawn while a hint is active */}
      {hintPiece && !hintPiece.placed && hintTarget && (
        <svg className="pointer-events-none absolute inset-0 size-full overflow-visible">
          <line
            x1={hintPiece.x + cw / 2}
            y1={hintPiece.y + ch / 2}
            x2={hintTarget.x + cw / 2}
            y2={hintTarget.y + ch / 2}
            stroke="#FDA4AF"
            strokeWidth="1.5"
            strokeDasharray="5 5"
            opacity="0.75"
          />
        </svg>
      )}

      {/* progress + hint — sits lower, in the space below the puzzle board,
          where the old "kéo các mảnh ghép..." instruction text used to be */}
      <div className="pointer-events-none absolute -bottom-24 inset-x-0 flex flex-col items-center gap-2 sm:-bottom-28">
        <p
          className="text-xs tracking-[0.25em]"
          style={{ fontFamily: FONT_HERO, color: MOON_MID, textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
        >
          {placedCount}/{cellIds.length} mảnh
        </p>
        <div className="h-[3px] w-32 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${cellIds.length ? (placedCount / cellIds.length) * 100 : 0}%`, background: MOON_MID }}
          />
        </div>
        <button
          type="button"
          onClick={requestHint}
          className="pointer-events-auto rounded-full border border-rose-300/50 bg-rose-300/10 px-4 py-1 text-[11px] tracking-[0.2em] text-rose-200 uppercase backdrop-blur-sm transition-colors hover:bg-rose-300/20"
        >
          Gợi ý
        </button>
      </div>
    </div>
  );
}

// A few streaks that cross the ambient sky occasionally (long, randomized
// repeatDelay between each pass) — not the dense drone-show meteor shower,
// just an occasional shooting star while the sky sits quiet.
function Moon({ size }: { size: number }) {
  return (
    <>
      {/* Moonbeam — a soft shaft of light pouring down from the moon,
          fading out gradually the further it falls. */}
      <div
        className="pointer-events-none absolute right-[10%] top-[5%] z-10"
        style={{
          width: size * 2.6,
          height: '85%',
          clipPath: 'polygon(38% 0%, 62% 0%, 100% 100%, 0% 100%)',
          background: `linear-gradient(to bottom, ${MOON_MID}38 0%, ${MOON_MID}18 35%, transparent 80%)`,
        }}
      />
      <div
        className="absolute right-[8%] top-[5%] z-10 rounded-full"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 35% 30%, ${MOON_CORE}, ${MOON_MID} 55%, ${MOON_DEEP} 100%)`,
          boxShadow: `0 0 40px ${MOON_MID}88, 0 0 120px ${MOON_MID}55`,
        }}
        aria-hidden
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// WindowGirlScene — deep-black room framing a lit window; the moon
// hangs outside; a girl sits on the sill looking out at it.
// ─────────────────────────────────────────────────────────────────────
function WindowGirlScene() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <svg
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
        aria-hidden
      >
        {/* Window frame — a thin cross of near-black bars, just enough to
            read as a window without blocking the sky behind it. The
            opening spans almost the full screen, not a boxed-in mockup. */}
        <path
          d="M0 0h16v800H0zM1184 0h16v800h-16zM16 0h1168v16H16zM16 764h1168v36H16z"
          fill={FRAME_DARK}
        />
      </svg>

      {/* Girl silhouette sitting on the sill — plain silhouette, no glow */}
      <svg
        viewBox="0 0 220 300"
        className="absolute bottom-[6%] left-[16%] h-[42%] w-auto md:left-[22%]"
        aria-label="Cô gái ngồi ngắm ánh trăng"
        role="img"
      >
        <g fill={GIRL_SILH}>
          <path d="M96 34c-20 0-32 14-32 33 0 14 3 24 3 36 0 12-8 18-8 30h58c4-14 8-24 8-40 0-8 3-14 3-24 0-20-12-35-32-35z" />
          <circle cx="98" cy="60" r="21" />
          <path d="M78 82c-16 6-24 22-26 40l-8 66c-1 10 4 16 14 16h72c10 0 15-7 13-17l-14-70c-4-20-14-32-30-36z" />
          <path d="M52 196c-14 4-22 16-22 30v16h132c8 0 12-6 10-14-3-14-14-24-30-27z" />
          <path d="M30 236h150c6 0 10 4 10 10v14H24c-6 0-10-5-8-12z" />
          <path d="M120 120c14 8 24 24 26 44 1 10-4 16-12 16s-13-6-14-14c-2-16-8-26-16-32z" />
        </g>
      </svg>

      {/* soft moonlight spill on the floor */}
      <div className="absolute bottom-0 left-1/2 h-40 w-[70%] -translate-x-1/2 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,248,225,0.18),transparent_70%)]" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main reveal — the heart puzzle plays first inside the window's night
// sky; once it's solved, a full-screen drone-show galaxy spins up and
// closes into a heart as the grand finale, then the goodnight message.
// ─────────────────────────────────────────────────────────────────────
const DRONE_FINALE_MS = 8600; // matches DroneIntro's own internal timeline

function DailyGoodnight2Reveal({ kiss, onClose }: TemplateProps) {
  const rawName = (getKissString(kiss, 'name') || kiss.receiver_name || 'em').trim();
  const displayName = rawName || 'em';

  const photoUrl = useMemo(() => {
    const raw = parseKissData(kiss).photos;
    if (Array.isArray(raw)) {
      const first = raw.find((u): u is string => typeof u === 'string' && !!u);
      if (first) return first;
    }
    return getKissString(kiss, 'photo') || kiss.sender_avatar || DEFAULT_PUZZLE_IMG;
  }, [kiss]);

  const [phase, setPhase] = useState<'puzzle' | 'drone' | 'final'>('puzzle');

  const handleSolved = useCallback(() => {
    setPhase((p) => (p === 'puzzle' ? 'drone' : p));
    playHeartbeat();
    setTimeout(() => playCelebration(), 300);
    const t1 = setTimeout(() => setPhase('final'), DRONE_FINALE_MS);
    const t2 = setTimeout(() => onClose(), DRONE_FINALE_MS + 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onClose]);

  const stars = useMemo(
    () =>
      Array.from({ length: 170 }).map((_, i) => {
        const s = (i * 2654435761) >>> 0;
        const r = (n: number) => (((s ^ (n * 0x9e3779b1)) >>> 0) % 10000) / 10000;
        const isBright = r(6) > 0.85; // ~15% of stars occasionally flare up brighter
        return {
          left: r(1) * 100,
          top: r(2) * 68,
          size: isBright ? 1.6 + r(3) * 1.6 : 0.5 + r(3) * 1.2,
          delay: r(4) * 8,
          dur: isBright ? 2 + r(5) * 3 : 3 + r(5) * 4,
          isBright,
        };
      }),
    [],
  );

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden select-none sm:p-6 sm:bg-black"
      style={{
        fontFamily: FONT_BODY,
        // 100dvh (not just inset-0) so mobile Safari/Chrome's collapsing
        // address bar never exposes the page's own dark background at the
        // top/bottom edges — the purple gradient always fills the real
        // visible viewport, not just the layout viewport.
        height: '100dvh',
        background: `linear-gradient(to bottom, #170e33 0%, #241245 45%, ${SKY_BLACK} 100%)`,
      }}
    >
      <div
        className="relative size-full overflow-hidden sm:rounded-[28px] sm:border sm:border-white/10 sm:shadow-[0_0_90px_rgba(0,0,0,0.65)]"
        style={{
          background: `
            radial-gradient(120% 80% at 72% 8%, rgba(120,95,190,0.5), transparent 60%),
            radial-gradient(100% 70% at 15% 92%, rgba(150,80,150,0.32), transparent 65%),
            linear-gradient(to bottom, #170e33 0%, #241245 45%, ${SKY_BLACK} 100%)
          `,
        }}
      >
        {/* Stars */}
        {stars.map((st, i) => (
          <motion.div
            key={`star-${i}`}
            className="pointer-events-none absolute rounded-full"
            style={{
              left: `${st.left}%`,
              top: `${st.top}%`,
              width: st.size,
              height: st.size,
              background: '#fff',
              boxShadow: `0 0 ${st.size * (st.isBright ? 4 : 2)}px rgba(255,255,255,${st.isBright ? 0.9 : 0.6})`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: st.isBright ? [0.15, 1, 0.15] : [0.2, 0.75, 0.2] }}
            transition={{ duration: st.dur, delay: st.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}

        <Moon size={130} />
        <WindowGirlScene />

      {/* ── Heart puzzle plays first, floating in the window's night sky ── */}
      <AnimatePresence>
        {phase === 'puzzle' && (
          <motion.div
            key="puzzle"
            className="absolute left-[3%] right-[3%] top-[9%] z-20 h-[62%]"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <p
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-center px-4 whitespace-nowrap"
              style={{
                top: -34,
                fontFamily: FONT_WHISPER,
                fontStyle: 'italic',
                fontSize: 'clamp(14px, 2.6vw, 19px)',
                color: 'rgba(255,255,255,0.92)',
                textShadow: '0 2px 10px rgba(0,0,0,0.7)',
              }}
            >
              <TypewriterText text="Từng mảnh nhỏ, gộp thành một tình yêu" />
            </p>
            <HeartPuzzle photoUrl={photoUrl} onSolved={handleSolved} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Drone-show finale: full-screen 3D galaxy spin closes into the
          heart, then "I LOVE YOU" — plays AFTER the puzzle is solved ── */}
      <AnimatePresence>
        {phase === 'drone' && (
          <motion.div key="drone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 1 }}>
            <div className="pointer-events-none absolute inset-0 z-30">
              <GalaxyBackdrop />
            </div>
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-8 text-center">
              <DroneIntro subtitle={`Chúc ${displayName} ngủ ngon 💫`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Finale message ── */}
      <AnimatePresence>
        {phase === 'final' && (
          <motion.div
            key="final"
            className="pointer-events-none absolute inset-x-0 z-30 px-8 text-center"
            style={{ top: '8%' }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
          >
            <div
              style={{
                fontFamily: FONT_HERO,
                fontWeight: 700,
                fontSize: 'clamp(22px, 4.5vw, 40px)',
                color: '#fff',
                textShadow: `0 4px 18px rgba(0,0,0,0.75), 0 0 24px ${HEART}66`,
              }}
            >
              Ngủ ngon nhé, {displayName} ✦
            </div>
            {kiss.message && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9 }}
                transition={{ duration: 1, delay: 0.9 }}
                className="mx-auto max-w-md"
                style={{
                  marginTop: 14,
                  fontFamily: FONT_WHISPER,
                  fontStyle: 'italic',
                  fontSize: 'clamp(15px, 2.2vw, 20px)',
                  color: 'rgba(255,240,240,0.95)',
                  textShadow: '0 2px 10px rgba(0,0,0,0.7)',
                }}
              >
                &ldquo;{kiss.message}&rdquo;
              </motion.div>
            )}
            {kiss.sender_name && (
              <div
                style={{
                  marginTop: 10,
                  fontFamily: FONT_BODY,
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: HEART_HOT,
                }}
              >
                — {kiss.sender_name}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      </div>
    </div>
  );
}

export default DailyGoodnight2Reveal;

export const DailyGoodnight2Config: TemplateConfig = {
  id: 'daily-goodnight-2',
  name: 'Good Night · Xếp Hình Trái Tim',
  occasionIds: ['daily'],
  emoji: '🌙',
  description: 'Một cô gái ngồi bên cửa sổ ngắm trăng — bầu trời đêm giữ một mảnh ghép trái tim ghép từ ảnh của hai người, kéo từng mảnh về đúng chỗ để nhận lời chúc ngủ ngon.',
  thumbnailBg: 'linear-gradient(135deg, #020212, #F6C46A, #FFF8E1)',
  Component: DailyGoodnight2Reveal,
};
