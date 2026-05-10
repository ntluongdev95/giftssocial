'use client';

// Full-screen drone celebration shown after a successful gift-card claim.
// Drones launch from the bottom and form the user's first name; the gift
// card slides in from above; sparkle/star backdrop sells the "show" feel.

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { TYPE_LABEL } from './GiftCardPreview';
import type { TemplateLite } from './GiftCardPreview';

// ─── 5×7 bitmap font ──────────────────────────────────────────────────────
// A subset large enough to render any user's first name once normalized.

const LETTERS: Record<string, number[][]> = {
  A: [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  B: [[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0]],
  C: [[0,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[0,1,1,1,1]],
  D: [[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0]],
  E: [[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  F: [[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0]],
  G: [[0,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,1,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,1]],
  H: [[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  I: [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,1]],
  J: [[0,0,1,1,1],[0,0,0,1,0],[0,0,0,1,0],[0,0,0,1,0],[1,0,0,1,0],[1,0,0,1,0],[0,1,1,0,0]],
  K: [[1,0,0,0,1],[1,0,0,1,0],[1,0,1,0,0],[1,1,0,0,0],[1,0,1,0,0],[1,0,0,1,0],[1,0,0,0,1]],
  L: [[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  M: [[1,0,0,0,1],[1,1,0,1,1],[1,0,1,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  N: [[1,0,0,0,1],[1,1,0,0,1],[1,0,1,0,1],[1,0,1,0,1],[1,0,0,1,1],[1,0,0,0,1],[1,0,0,0,1]],
  O: [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  P: [[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0]],
  Q: [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,1,0,1],[1,0,0,1,1],[0,1,1,1,1]],
  R: [[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0],[1,1,0,0,0],[1,0,1,0,0],[1,0,0,1,1]],
  S: [[0,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[0,1,1,1,0],[0,0,0,0,1],[0,0,0,0,1],[1,1,1,1,0]],
  T: [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
  U: [[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  V: [[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0]],
  W: [[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,1,0,1],[1,0,1,0,1],[1,1,0,1,1],[1,0,0,0,1]],
  X: [[1,0,0,0,1],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1],[1,0,0,0,1]],
  Y: [[1,0,0,0,1],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
  Z: [[1,1,1,1,1],[0,0,0,0,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
};

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics (Vietnamese tone marks)
    .toUpperCase()
    .replace(/[^A-Z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 10);                      // cap so wide names still fit on screen
}

// ─── Drone formation builder ──────────────────────────────────────────────

interface DronePoint {
  // Final formation position (px, centered around 0,0 in our SVG coord space)
  x: number;
  y: number;
  // Launch pad (clustered low along the bottom)
  launchX: number;
  launchY: number;
  // Mid-arc point (high sweep before settling)
  midX: number;
  midY: number;
  // Phase 2 target — assigned after buildFormation() runs. Drones morph from
  // text formation into a credit-card outline shape.
  cardX: number;
  cardY: number;
  idx: number;
  pulseDur: number;
  pulseDelay: number;
  sparkle: boolean;     // bigger + brighter, ~15%
  letterIdx: number;    // letter index in the line — drives "typed" stagger
}

function buildDrone(
  tx: number,
  ty: number,
  idx: number,
  letterIdx: number,
  launchYBase: number = 230,
): DronePoint {
  // Three launch pads — left/center/right — picked by the target's side.
  let padX: number;
  if (tx < -40) padX = -180 + (Math.random() - 0.5) * 60;
  else if (tx > 40) padX = 180 + (Math.random() - 0.5) * 60;
  else padX = (Math.random() - 0.5) * 80;
  const launchY = launchYBase + Math.random() * 30;

  const midX = (padX + tx) / 2 + (Math.random() - 0.5) * 90;
  const midY = ty * 0.55 - 30 + (Math.random() - 0.5) * 40;

  return {
    x: tx,
    y: ty,
    launchX: padX,
    launchY,
    midX,
    midY,
    cardX: 0,            // filled in after buildFormation by assignCardTargets()
    cardY: 0,
    idx,
    pulseDur: 1.8 + Math.random() * 1.6,
    pulseDelay: Math.random() * 1.4,
    sparkle: Math.random() < 0.18,
    letterIdx,
  };
}

// ─── Card outline target points ──────────────────────────────────────────
// A rounded rectangle perimeter + a small chip detail. Drones from the text
// formation morph into these positions one drone per outline slot, with extra
// drones doubling up so the outline burns brighter where they overlap.

interface PointXY { x: number; y: number }

function buildCardOutline(cy: number = 22, w: number = 260, h: number = 160): PointXY[] {
  const pts: PointXY[] = [];
  const r = 24;
  const cx = 0;
  const halfW = w / 2;
  const halfH = h / 2;
  const spacing = 7;       // viewBox units between drones along edges

  // Top edge
  for (let x = -halfW + r; x <= halfW - r; x += spacing) pts.push({ x: cx + x, y: cy - halfH });
  // Right edge
  for (let y = -halfH + r; y <= halfH - r; y += spacing) pts.push({ x: cx + halfW, y: cy + y });
  // Bottom edge (right to left)
  for (let x = halfW - r; x >= -halfW + r; x -= spacing) pts.push({ x: cx + x, y: cy + halfH });
  // Left edge (bottom to top)
  for (let y = halfH - r; y >= -halfH + r; y -= spacing) pts.push({ x: cx - halfW, y: cy + y });

  // Four rounded corners
  const cornerSteps = Math.max(6, Math.ceil(((Math.PI / 2) * r) / spacing));
  const corners = [
    { cx0: halfW - r,  cy0: -halfH + r, a0: -Math.PI / 2 },                // top-right
    { cx0: halfW - r,  cy0:  halfH - r, a0:  0 },                          // bottom-right
    { cx0: -halfW + r, cy0:  halfH - r, a0:  Math.PI / 2 },                // bottom-left
    { cx0: -halfW + r, cy0: -halfH + r, a0:  Math.PI },                    // top-left
  ];
  for (const c of corners) {
    for (let i = 1; i <= cornerSteps; i++) {
      const a = c.a0 + (Math.PI / 2) * (i / cornerSteps);
      pts.push({ x: cx + c.cx0 + r * Math.cos(a), y: cy + c.cy0 + r * Math.sin(a) });
    }
  }

  // Tiny chip in the upper-left inside area — gives the card outline a recognisable detail.
  const chipX = -halfW + 36;
  const chipY = -halfH + 32;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    pts.push({ x: cx + chipX + Math.cos(a) * 8, y: cy + chipY + Math.sin(a) * 5 });
  }

  return pts;
}

// Distribute the drones across the outline points round-robin. Drones not
// covered by the outline length wrap so the brightest segments are deterministic.
function assignCardTargets(points: DronePoint[], outline: PointXY[]) {
  if (outline.length === 0) return;
  // Shuffle drone indices so the morph reads as a "fall in" rather than a
  // sequential reshape — this is what real drone shows look like.
  const order = points.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  order.forEach((droneIdx, i) => {
    const target = outline[i % outline.length];
    points[droneIdx].cardX = target.x;
    points[droneIdx].cardY = target.y;
  });
}

interface FormationLine {
  text: string;
  cellSize: number;        // px per bitmap cell
  emphasis?: boolean;      // bigger glow + slightly larger drones
}

interface FormationGeo {
  points: DronePoint[];
  width: number;           // widest line (px)
  height: number;          // total stacked height (px)
  topY: number;            // y-offset of the very first drone (relative to centered group)
  lastLetterIdx: number;   // total letterIdx slots — used for show duration
}

const LETTER_ROWS = 7;
const LETTER_COLS = 5;

// Measure one line's width given its cell size + spacing.
function measureLine(text: string, cellSize: number, letterGap: number, wordGap: number): number {
  const chars = text.split('');
  let total = 0;
  chars.forEach((c, i) => {
    if (c === ' ') {
      total += wordGap;
    } else {
      total += LETTER_COLS * cellSize;
      if (i < chars.length - 1 && chars[i + 1] !== ' ' && c !== ' ') total += letterGap;
    }
  });
  return total;
}

// Lay drones for one bitmap-font line at vertical offset `lineY`.
// Spacing follows the capsule-reveal proportions: letterGap = cellSize,
// wordGap = 3× cellSize. Wide spacing reads cleaner at scale.
function layoutLine(
  line: FormationLine,
  lineY: number,
  startLetterIdx: number,
  out: DronePoint[],
  launchYBase: number = 230,
): { width: number; nextLetterIdx: number } {
  const { text, cellSize, emphasis } = line;
  const letterGap = cellSize;
  const wordGap = cellSize * 3;
  const width = measureLine(text, cellSize, letterGap, wordGap);

  let cursor = -width / 2;
  let li = startLetterIdx;

  text.split('').forEach((char, i, arr) => {
    if (char === ' ') {
      cursor += wordGap;
      li += 1;
      return;
    }
    const bm = LETTERS[char];
    if (!bm) {
      li += 1;
      return;
    }
    bm.forEach((row, ry) => {
      row.forEach((cell, cx) => {
        if (cell === 1) {
          const d = buildDrone(cursor + cx * cellSize, lineY + ry * cellSize, out.length, li, launchYBase);
          if (emphasis) d.sparkle = d.sparkle || Math.random() < 0.35; // more glow on the hero line
          out.push(d);
        }
      });
    });
    cursor += LETTER_COLS * cellSize;
    if (i < arr.length - 1 && arr[i + 1] !== ' ') cursor += letterGap;
    li += 1;
  });

  return { width, nextLetterIdx: li };
}

function buildFormation(lines: FormationLine[], centerY: number = 0, launchYBase: number = 230): FormationGeo {
  // Spacing between lines scales with the largest cell so big drones don't
  // look cramped on top of each other.
  const maxCell = Math.max(...lines.map((l) => l.cellSize));
  const lineGap = Math.round(maxCell * 1.8);
  const points: DronePoint[] = [];

  // First pass — compute total height so we can vertically center around centerY.
  const lineHeights = lines.map((l) => LETTER_ROWS * l.cellSize);
  const totalHeight = lineHeights.reduce((s, h, i) => s + h + (i < lines.length - 1 ? lineGap : 0), 0);

  const topY = centerY - totalHeight / 2;
  let cursorY = topY;
  let li = 0;
  let maxWidth = 0;

  lines.forEach((line) => {
    const r = layoutLine(line, cursorY, li, points, launchYBase);
    maxWidth = Math.max(maxWidth, r.width);
    li = r.nextLetterIdx + 1; // pause one slot between lines for a beat
    cursorY += LETTER_ROWS * line.cellSize + lineGap;
  });

  return {
    points,
    width: maxWidth,
    height: totalHeight,
    topY,
    lastLetterIdx: li,
  };
}

// ─── Component ────────────────────────────────────────────────────────────

interface ClaimCelebrationProps {
  userName: string;          // user's first name (or fallback)
  template: TemplateLite & {
    expires_in_days?: number;
  };
  valueLabel: string;
  onClose: () => void;
  onOpenWallet: () => void;
}

export default function ClaimCelebration({
  userName,
  template,
  valueLabel,
  onClose,
  onOpenWallet,
}: ClaimCelebrationProps) {
  const nameLine = normalizeName(userName) || 'YOU';

  // Mobile gets a portrait viewBox so the formation + drone-card fill the
  // screen instead of leaving huge empty bands above and below.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Layout config — mobile gives the drone card most of the screen by
  // shrinking the CONGRATS+name above and scaling the card outline up.
  const layout = isMobile
    ? {
        vb: '-220 -240 440 600',
        formationCenterY: -150,    // CONGRATS+name up top, with breathing room above
        cardCy: 95,                 // bigger card sits low-centre
        cardScale: 1.55,            // ~1.55× bigger card outline + content
        launchYBase: 320,
        congratsCell: 6,            // small CONGRATS on mobile
        nameCell: 8,                // smaller hero name too
        svgClass: 'w-full h-auto max-w-md mx-auto',
      }
    : {
        vb: '-320 -180 640 380',
        formationCenterY: 0,
        cardCy: 22,
        cardScale: 1.0,
        launchYBase: 230,
        congratsCell: 9,
        nameCell: 12,
        svgClass: 'w-[min(96vw,1100px)] h-auto',
      };

  const formation = useMemo(() => {
    const f = buildFormation(
      [
        { text: 'CONGRATS', cellSize: layout.congratsCell },
        { text: nameLine, cellSize: layout.nameCell, emphasis: true },
      ],
      layout.formationCenterY,
      layout.launchYBase,
    );
    // Card outline scales with cardScale so the drone-card is bigger on
    // mobile.
    assignCardTargets(
      f.points,
      buildCardOutline(layout.cardCy, 260 * layout.cardScale, 160 * layout.cardScale),
    );
    return f;
  }, [
    nameLine,
    layout.formationCenterY,
    layout.launchYBase,
    layout.cardCy,
    layout.cardScale,
    layout.congratsCell,
    layout.nameCell,
  ]);

  // ── Subtitle formation: "A GIFT FROM {business}" rendered as small drones
  // below the drone card. Launches in its own beat once the card content
  // has settled in. Cell size is sized to fit the available viewBox width.
  const subtitleFormation = useMemo(() => {
    const bizName = normalizeName(template.business_name || '');
    // Show the full business name. Generous truncation so most names fit.
    const text = `A GIFT FROM ${bizName}`.slice(0, isMobile ? 30 : 36);
    // approxPerChar derived from layout: average letter+gap (~6 cells) and
    // 3-cell word gaps balance out around 5.4 cells per char.
    const maxWidth = isMobile ? 380 : 560;
    const approxPerChar = 5.4;
    const cell = Math.max(1.6, Math.min(2.5, maxWidth / (text.length * approxPerChar)));

    return buildFormation(
      [{ text, cellSize: cell }],
      // Sit a fixed distance below the card's actual bottom edge
      // (= cardCy + scaled half-height + breathing room).
      layout.cardCy + 80 * layout.cardScale + 32,
      layout.launchYBase + 80,                  // launch from below the screen
    );
  }, [template.business_name, isMobile, layout.cardCy, layout.cardScale, layout.launchYBase]);

  // Show pacing — slower, more deliberate to feel like a real drone show.
  const ARC_DURATION = 2.8;     // launch → midpoint → formation
  const LETTER_STAGGER = 0.18;  // typed-in pacing per letter
  const TEXT_HOLD = 1.8;        // hold the CONGRATS / NAME formation
  const MORPH_DURATION = 2.0;   // text → card outline morph (drones drift)
  const CARD_HOLD = 1.0;        // hold card outline before content fades in

  const formedAt = formation.lastLetterIdx * LETTER_STAGGER + ARC_DURATION;
  const cardAt = formedAt + TEXT_HOLD;
  const cardInAt = cardAt + MORPH_DURATION + CARD_HOLD;
  const doneAt = cardInAt + 0.6;

  // Phases:
  //   launching → drones arc up + form CONGRATS / NAME (typed-in)
  //   text      → formation held statically
  //   card      → drones morph from text to a credit-card outline shape
  //   cardIn    → real card preview slides up; drones fade to dim halo
  //   done      → action buttons appear
  const [phase, setPhase] = useState<'launching' | 'text' | 'card' | 'cardIn' | 'done'>('launching');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('text'), formedAt * 1000);
    const t2 = setTimeout(() => setPhase('card'), cardAt * 1000);
    const t3 = setTimeout(() => setPhase('cardIn'), cardInAt * 1000);
    const t4 = setTimeout(() => setPhase('done'), doneAt * 1000);
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
    };
  }, [formedAt, cardAt, cardInAt, doneAt]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-1000 overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at top, #0b1024 0%, #050610 70%)' }}
    >
      {/* ── Backdrop layers ──────────────────────────────────────────── */}
      <Starfield />
      <ShootingStars />

      {/* ── Drone formation (SVG with viewBox so it scales) ─────────── */}
      {/* Anchored close to the top so the formation reads as the hero and the
          gift card preview below it sits comfortably. */}
      <div className="absolute inset-x-0 top-2 flex justify-center px-4 sm:top-4">
        <svg
          viewBox={layout.vb}
          preserveAspectRatio="xMidYMid meet"
          className={layout.svgClass}
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Card body gradient — appears inside the drone outline */}
            <linearGradient id="claimCardGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={template.gradient_from || '#00d4ff'} />
              <stop offset="1" stopColor={template.gradient_to || '#a78bfa'} />
            </linearGradient>

            {/* Drone glow gradients — radial fade so adjacent drones blend
                seamlessly instead of showing a hard halo edge. */}
            <radialGradient id="droneStd" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="22%" stopColor="#fffbe0" stopOpacity="0.85" />
              <stop offset="55%" stopColor="#fde79a" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#fde79a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="droneSparkle" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="20%" stopColor="#fff7d6" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#ffd76a" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#ffd76a" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Subtle preamble above the formation */}
          <text
            x="0"
            y={formation.topY - (isMobile ? 12 : 22)}
            textAnchor="middle"
            className="fill-white"
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: '0.4em',
              textTransform: 'uppercase',
              opacity: 0.55,
            }}
          >
            🎁  Card claimed
          </text>

          {/* Drones — already centered around (0,0) by buildFormation */}
          {formation.points.map((p) => (
            <Drone
              key={p.idx}
              point={p}
              stagger={LETTER_STAGGER}
              arc={ARC_DURATION}
              phase={phase}
              morphDuration={MORPH_DURATION}
            />
          ))}

          {/* Footer subtitle — fades in after the formation is done.
              Two lines: the message line + a Gao Social signoff. */}
          <motion.text
            initial={{ opacity: 0, y: 8 }}
            animate={phase === 'text' ? { opacity: 1, y: 0 } : { opacity: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            x="0"
            y={formation.topY + formation.height + 26}
            textAnchor="middle"
            className="fill-white/85"
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
            }}
          >
            You&apos;ve claimed your voucher
          </motion.text>
          <motion.text
            initial={{ opacity: 0, y: 8 }}
            animate={phase === 'text' ? { opacity: 1, y: 0 } : { opacity: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            x="0"
            y={formation.topY + formation.height + 42}
            textAnchor="middle"
            className="fill-white/45"
            style={{
              fontFamily: 'var(--font-inter), system-ui, sans-serif',
              fontSize: 5.5,
              fontWeight: 600,
              letterSpacing: '0.4em',
              textTransform: 'uppercase',
            }}
          >
            ◆  Gao Social  ◆
          </motion.text>

          {/* ── Card content rendered INSIDE the drone outline ─────────── */}
          {/* Outline is centered at (0, cardCy) with size 260×160. We
              translate the whole content group so layout coordinates below
              can be expressed relative to the card's own center. */}
          <motion.g
            initial={{ opacity: 0 }}
            animate={phase === 'cardIn' || phase === 'done' ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.7 }}
            transform={`translate(0, ${layout.cardCy}) scale(${layout.cardScale})`}
          >
            {/* Tinted body fill — coordinates now relative to (0, 0) =
                card center. */}
            <rect
              x={-130}
              y={-80}
              width={260}
              height={160}
              rx={24}
              fill="url(#claimCardGrad)"
              opacity={0.22}
            />

            {/* Top-left: business name + subtitle */}
            <text
              x={-116}
              y={-62}
              textAnchor="start"
              className="fill-white"
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: 6,
                fontWeight: 800,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
              }}
            >
              {(template.business_name || 'Your business').slice(0, 24)}
            </text>
            <text
              x={-116}
              y={-54}
              textAnchor="start"
              className="fill-white/55"
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: 4.5,
                fontWeight: 600,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
              }}
            >
              Gao · Giftcard
            </text>

            {/* Top-right: type pill */}
            <g transform="translate(116, -64)">
              <rect
                x={-40}
                y={-3}
                width={40}
                height={9}
                rx={4.5}
                fill="rgba(255,255,255,0.16)"
                stroke="rgba(255,255,255,0.28)"
                strokeWidth={0.5}
              />
              <text
                x={-20}
                y={3.5}
                textAnchor="middle"
                className="fill-white"
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: 4.5,
                  fontWeight: 800,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                {TYPE_LABEL[template.type]}
              </text>
            </g>

            {/* Hero value — left aligned, large */}
            <text
              x={-116}
              y={4}
              textAnchor="start"
              className="fill-white"
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: '-0.02em',
              }}
            >
              {valueLabel}
            </text>

            {/* Card name */}
            <text
              x={-116}
              y={20}
              textAnchor="start"
              className="fill-white/95"
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: 8,
                fontWeight: 700,
              }}
            >
              {(template.name || '').slice(0, 30)}
            </text>

            {/* Description (single line clamp) */}
            {template.description && (
              <text
                x={-116}
                y={32}
                textAnchor="start"
                className="fill-white/65"
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: 5,
                  fontWeight: 500,
                }}
              >
                {template.description.length > 60
                  ? template.description.slice(0, 60).trim() + '…'
                  : template.description}
              </text>
            )}

            {/* Footer divider */}
            <line
              x1={-116}
              y1={56}
              x2={116}
              y2={56}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={0.5}
            />

            {/* Footer left: dashes + validity */}
            <g transform="translate(-116, 66)">
              {[0, 1, 2, 3].map((i) => (
                <rect
                  key={i}
                  x={i * 7}
                  y={-2}
                  width={5}
                  height={1.5}
                  rx={0.75}
                  fill="rgba(255,255,255,0.55)"
                />
              ))}
              <text
                x={36}
                y={1.5}
                textAnchor="start"
                className="fill-white/80"
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: 5,
                  fontWeight: 800,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                Valid {template.expires_in_days || 30}d
              </text>
            </g>

            {/* Footer right: YOURS + Gao Social mark */}
            <text
              x={116}
              y={67}
              textAnchor="end"
              className="fill-white/80"
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: 5,
                fontWeight: 800,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              Yours
            </text>
            <text
              x={116}
              y={75}
              textAnchor="end"
              className="fill-white/45"
              style={{
                fontFamily: 'var(--font-inter), system-ui, sans-serif',
                fontSize: 3.5,
                fontWeight: 700,
                letterSpacing: '0.4em',
                textTransform: 'uppercase',
              }}
            >
              ◆ Gao Social
            </text>
          </motion.g>

          {/* "A GIFT FROM {business}" rendered as a real drone formation
              below the card. Launches once the card content has appeared. */}
          {subtitleFormation.points.map((p) => (
            <SubtitleDrone key={`sub-${p.idx}`} point={p} phase={phase} />
          ))}
        </svg>
      </div>

      {/* ── Action buttons appear after the show is done ─────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={phase === 'done' ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-x-0 bottom-24 px-4 sm:bottom-12 sm:px-5"
      >
        <div className="mx-auto flex w-full max-w-lg items-stretch gap-3 sm:max-w-md sm:gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl py-4 text-base font-semibold cursor-pointer sm:rounded-xl sm:py-3 sm:text-sm"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f4ff' }}
          >
            Stay here
          </button>
          <button
            onClick={onOpenWallet}
            className="flex-1 rounded-2xl py-4 text-base font-bold cursor-pointer sm:rounded-xl sm:py-3 sm:text-sm"
            style={{ background: '#00d4ff', color: '#0a0b0f', boxShadow: '0 14px 36px -16px rgba(0,212,255,0.7)' }}
          >
            Open wallet
          </button>
        </div>
      </motion.div>

      {/* Tap anywhere on the dim corners to dismiss (safety) */}
      <button
        onClick={onClose}
        aria-label="Close celebration"
        className="absolute right-4 top-4 h-9 w-9 rounded-full cursor-pointer text-white/60 hover:text-white"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        ✕
      </button>
    </motion.div>
  );
}

// ─── Drone primitive ──────────────────────────────────────────────────────

function Drone({
  point: p,
  stagger,
  arc,
  phase,
  morphDuration,
}: {
  point: DronePoint;
  stagger: number;
  arc: number;
  phase: 'launching' | 'text' | 'card' | 'cardIn' | 'done';
  morphDuration: number;
}) {
  // Stagger drones by letter index so the formation appears typed,
  // then jitter individuals so the swarm doesn't move in lockstep.
  const letterStagger = p.letterIdx * stagger;
  const indivJitter = (p.idx % 7) * 0.03;
  const launchDelay = letterStagger + indivJitter;

  // Drone "size" is the radial-gradient circle's radius — no separate halo
  // ring, so adjacent drones blend smoothly with no visible border edges.
  const glowR = p.sparkle ? 8 : 6;

  // Phase-driven motion target. Framer-motion smoothly tweens between
  // animate prop changes, so switching from launch keyframes to a single
  // {x,y} value at phase=='card' produces the morph effect.
  let animateTarget: Record<string, number | number[]>;
  let transitionConfig: Record<string, unknown>;

  if (phase === 'launching' || phase === 'text') {
    animateTarget = {
      x: [p.launchX, p.midX, p.x],
      y: [p.launchY, p.midY, p.y],
      opacity: [0, 1, 1],
    };
    transitionConfig = {
      duration: arc,
      delay: launchDelay,
      times: [0, 0.55, 1],
      ease: ['easeIn', 'easeOut'],
    };
  } else if (phase === 'card') {
    // Drones swarm into the card outline. Tiny per-drone jitter on the
    // duration so they don't all settle at the exact same instant.
    const jitter = (p.idx % 5) * 0.06;
    animateTarget = { x: p.cardX, y: p.cardY, opacity: 1 };
    transitionConfig = { duration: morphDuration + jitter, ease: 'easeInOut' };
  } else {
    // cardIn / done — fade the drones into a dim halo while the real
    // gift card preview slides up.
    animateTarget = { x: p.cardX, y: p.cardY, opacity: 0.18 };
    transitionConfig = { duration: 0.7, ease: 'easeOut' };
  }

  return (
    <motion.g
      initial={{ x: p.launchX, y: p.launchY, opacity: 0 }}
      animate={animateTarget}
      transition={transitionConfig}
    >
      {/* Soft radial-gradient glow — bright pinpoint center fading smoothly
          to transparent. Single circle replaces the previous halo + core
          combo so there's no visible ring edge. */}
      <motion.circle
        r={glowR}
        fill={`url(#${p.sparkle ? 'droneSparkle' : 'droneStd'})`}
        animate={{ opacity: [0.75, 1, 0.75] }}
        transition={{
          duration: p.pulseDur,
          delay: p.pulseDelay,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </motion.g>
  );
}

// ─── Subtitle drone — small, separate from the main formation ────────────
// Used by "A GIFT FROM {business}" line. Launches only once phase enters
// 'cardIn' so the line appears as a beat after the card content has settled.

function SubtitleDrone({
  point: p,
  phase,
}: {
  point: DronePoint;
  phase: 'launching' | 'text' | 'card' | 'cardIn' | 'done';
}) {
  const visible = phase === 'cardIn' || phase === 'done';
  // Stagger each letter by its index so the line types in left-to-right.
  const launchDelay = p.letterIdx * 0.06 + (p.idx % 5) * 0.02;
  const ARC = 1.2;

  return (
    <motion.g
      initial={{ x: p.launchX, y: p.launchY, opacity: 0 }}
      animate={
        visible
          ? {
              x: [p.launchX, p.midX, p.x],
              y: [p.launchY, p.midY, p.y],
              opacity: [0, 1, 1],
            }
          : { opacity: 0 }
      }
      transition={
        visible
          ? {
              duration: ARC,
              delay: launchDelay,
              times: [0, 0.55, 1],
              ease: ['easeIn', 'easeOut'],
            }
          : { duration: 0.3 }
      }
    >
      <motion.circle
        r={p.sparkle ? 2.0 : 1.4}
        fill="url(#droneStd)"
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{
          duration: p.pulseDur,
          delay: p.pulseDelay,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </motion.g>
  );
}

// ─── Backdrop sub-components ──────────────────────────────────────────────

function Starfield() {
  // Pure / deterministic positions — each star derived from its index using
  // `pseudoRand`. Same visual variety as Math.random() but render-time-pure
  // (satisfies the react-hooks/purity rule and matches across SSR/CSR).
  const stars = useMemo(() => {
    const arr: { x: number; y: number; r: number; o: number; dur: number; delay: number }[] = [];
    for (let i = 0; i < 90; i++) {
      const r1 = pseudoRand(i * 1 + 1);
      const r2 = pseudoRand(i * 2 + 7);
      const r3 = pseudoRand(i * 3 + 13);
      const r4 = pseudoRand(i * 4 + 23);
      const r5 = pseudoRand(i * 5 + 31);
      const r6 = pseudoRand(i * 6 + 41);
      arr.push({
        x: r1 * 100,
        y: r2 * 100,
        r: r3 < 0.85 ? 0.7 : 1.4,
        o: 0.3 + r4 * 0.5,
        dur: 2 + r5 * 4,
        delay: r6 * 3,
      });
    }
    return arr;
  }, []);
  return (
    <div className="absolute inset-0 pointer-events-none">
      {stars.map((s, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.r * 2,
            height: s.r * 2,
            background: 'white',
            opacity: s.o,
          }}
          animate={{ opacity: [s.o * 0.4, s.o, s.o * 0.4] }}
          transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// Deterministic pseudo-random (sin-based hash). Same input → same output,
// so star positions / shooting-star timings stay stable across renders and
// keep the React 19 react-hooks/purity rule happy.
function pseudoRand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function ShootingStars() {
  // Six shooting stars from deterministic positions / timings (purity rule).
  const shots = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const r1 = pseudoRand(i * 7 + 3);
        const r2 = pseudoRand(i * 11 + 17);
        const r3 = pseudoRand(i * 13 + 29);
        const r4 = pseudoRand(i * 17 + 47);
        const r5 = pseudoRand(i * 19 + 61);
        return {
          startX: 5 + r1 * 90,
          startY: -5,
          dx: 30 + r2 * 30,
          dy: 110,
          delay: i * 1.4 + r3 * 0.8,
          dur: 1.4 + r4 * 0.8,
          repeatDelay: 6 + r5 * 4,
        };
      }),
    [],
  );
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {shots.map((s, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            left: `${s.startX}%`,
            top: `${s.startY}%`,
            width: 90,
            height: 1.5,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)',
            transform: 'rotate(38deg)',
            transformOrigin: 'left',
          }}
          animate={{ x: [0, s.dx * 6], y: [0, s.dy * 4], opacity: [0, 1, 0] }}
          transition={{
            duration: s.dur,
            delay: s.delay,
            repeat: Infinity,
            repeatDelay: s.repeatDelay,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}
