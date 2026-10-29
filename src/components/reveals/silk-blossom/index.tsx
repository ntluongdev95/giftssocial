'use client';

// SilkBlossom reveal — Vietnamese Women's Day (20/10) flagship template.
//
// Phase 1 'curtain' — a theater curtain opens to reveal an event welcome
// line (hardcoded for this occasion, not per-sender data). Phase 2
// 'main' is the original rose-rain-style keepsake card: warm rose-gold
// backdrop, drifting hibiscus/cherry-blossom/tulip petals, soft flowing
// silk-ribbon light streaks evoking áo dài fabric in motion.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TemplateProps } from '../_types';
import TemplateShell from '../_shared/TemplateShell';
import SenderSignature from '../_shared/SenderSignature';
import HandwrittenNote from '../_shared/HandwrittenNote';
import PolaroidStack from '../_shared/PolaroidStack';

const PETAL_COUNT = 30;
const PETALS = ['🌺', '🌸', '🌷'];
const ACCENT = '#e11d48'; // matches the vietnam-womens-day occasion's theme_color

type Phase = 'curtain' | 'breakthrough' | 'main';

// Theater curtain opening — two velvet panels slide apart to reveal the
// event's welcome line. Fold texture is a repeating gradient (no image
// assets needed). Stops clicks from bubbling to TemplateShell's
// click-to-close while the intro is still playing.
type DronePt = { x: number; y: number; warm: boolean; group?: number };

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function packToCount(pts: DronePt[], n: number): DronePt[] {
  if (pts.length === 0) return [];
  if (pts.length >= n) {
    const stride = pts.length / n;
    return Array.from({ length: n }, (_, i) => pts[Math.floor(i * stride)]);
  }
  return Array.from({ length: n }, (_, i) => pts[i % pts.length]);
}

// Curtain's welcome line, sampled as an actual drone-light point cloud
// (same technique as the breakthrough sequence below) instead of CSS
// text — three lines, each its own group so they visibly build in
// sequence: headline (2 lines) then the host credit, smaller.

function sampleCurtainHeadline(): DronePt[] {
  if (typeof document === 'undefined') return [];
  const W = 1400, H = 900;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  const stride = 2;
  const pts: DronePt[] = [];

  // Samples one line, tagging each pixel with the index of the
  // CHARACTER (not the whole line) it belongs to — group = groupStart
  // + char index — so dots can stagger in letter by letter. Returns
  // the next free group index for the following line.
  const sampleLineByChar = (text: string, cy: number, maxPx: number, warm: boolean, groupStart: number): number => {
    let size = maxPx;
    ctx.textAlign = 'left';
    ctx.font = `800 ${size}px "Inter", "Segoe UI", sans-serif`;
    while (ctx.measureText(text).width > W * 0.92 && size > 20) {
      size -= 4;
      ctx.font = `800 ${size}px "Inter", "Segoe UI", sans-serif`;
    }
    const totalWidth = ctx.measureText(text).width;
    const startX = W / 2 - totalWidth / 2;
    const bounds: { start: number; end: number }[] = [];
    let cum = startX;
    for (let i = 0; i < text.length; i++) {
      const w = ctx.measureText(text[i]).width;
      bounds.push({ start: cum, end: cum + w });
      cum += w;
    }

    ctx.clearRect(0, 0, W, H);
    ctx.fillText(text, startX, cy);
    const { data } = ctx.getImageData(0, 0, W, H);
    for (let y = 0; y < H; y += stride) {
      for (let x = 0; x < W; x += stride) {
        if (data[(y * W + x) * 4 + 3] > 128) {
          const charIdx = bounds.findIndex(b => x >= b.start && x < b.end);
          if (charIdx === -1) continue;
          pts.push({ x: (x / W - 0.5) * 2, y: (y / H - 0.5) * 2, warm, group: groupStart + charIdx });
        }
      }
    }
    return groupStart + text.length;
  };

  let group = 0;
  group = sampleLineByChar('Chúc Mừng Ngày Phụ Nữ', H * 0.26, 150, true, group);
  sampleLineByChar('Việt Nam 20/10', H * 0.52, 180, true, group);

  return pts;
}

// A classic parametric heart curve, filled — the shape the swirling
// galaxy below settles into.
function sampleHeart(): DronePt[] {
  if (typeof document === 'undefined') return [];
  const W = 900, H = 900;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.fillStyle = '#fff';

  ctx.beginPath();
  const scale = 22;
  for (let t = 0; t <= Math.PI * 2 + 0.01; t += 0.01) {
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    const x = 450 + hx * scale, y = 450 + hy * scale;
    if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: DronePt[] = [];
  const stride = 4;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        pts.push({ x: (x / W - 0.5) * 2, y: (y / H - 0.5) * 2, warm: true });
      }
    }
  }
  return pts;
}

const CURTAIN_INTRO_DOT_COUNT = 3400;

// Curtain's whole opening sequence as ONE continuous particle stream —
// previously two separate components (galaxy→heart, then a fresh
// headline point-cloud) crossfading into each other. Now the SAME
// dots do it all: swirling galaxy disc → gathers into a heart → holds
// → bursts outward → (staggered by character) fly into the headline
// text. The heart visibly becomes the letters, as asked, instead of
// one shape fading while a different one fades in.
function CurtainIntro({ onSettled }: { onSettled: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const heartPoints = useMemo(() => packToCount(sampleHeart(), CURTAIN_INTRO_DOT_COUNT), []);
  const textPoints = useMemo(() => packToCount(sampleCurtainHeadline(), CURTAIN_INTRO_DOT_COUNT), []);

  useEffect(() => {
    if (typeof window === 'undefined' || !canvasRef.current || heartPoints.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = W / 2, cy = H / 2;

    const fitScale = (pts: DronePt[], pad: number) => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const spanX = Math.max(0.01, maxX - minX), spanY = Math.max(0.01, maxY - minY);
      return { scale: Math.min(W / spanX, H / spanY) * pad, midX: (minX + maxX) / 2, midY: (minY + maxY) / 2 };
    };
    const heartFit = fitScale(heartPoints, 0.8);
    const textFit = fitScale(textPoints, 0.97);

    // Timeline (ms from mount)
    const START_DELAY = 2500;      // wait for the curtain to finish opening
    const GALAXY_MS = 1800;        // swirling disc
    const MORPH_HEART_MS = 1400;   // spiral gathers into the heart
    const HOLD_HEART_MS = 900;     // hold before bursting
    const BURST_MS = 500;          // quick, unified burst outward
    const CHAR_STAGGER_MS = 70;    // then each letter's dots stack in
    const MORPH_TEXT_MS = 1000;    // burst position → character position

    const T_GALAXY_END = GALAXY_MS;
    const T_HEART_END = T_GALAXY_END + MORPH_HEART_MS;
    const T_HOLD_END = T_HEART_END + HOLD_HEART_MS;
    const T_BURST_END = T_HOLD_END + BURST_MS;
    const maxGroup = textPoints.reduce((m, p) => Math.max(m, p.group ?? 0), 0);
    const totalMs = START_DELAY + T_BURST_END + maxGroup * CHAR_STAGGER_MS + MORPH_TEXT_MS + 300;

    const dots = heartPoints.map((hp, i) => {
      const tp = textPoints[i] ?? hp;
      const heartX = cx + (hp.x - heartFit.midX) * heartFit.scale, heartY = cy + (hp.y - heartFit.midY) * heartFit.scale;
      const textX = cx + (tp.x - textFit.midX) * textFit.scale, textY = cy + (tp.y - textFit.midY) * textFit.scale;

      const s = ((i + 1) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;

      // Burst direction: radially outward from this dot's own heart
      // position — the heart appears to explode apart from itself.
      const burstAngle = Math.atan2(heartY - cy, heartX - cx) + (r(5) - 0.5) * 0.6;
      const burstDist = Math.min(W, H) * (0.35 + r(6) * 0.3);
      const burstX = heartX + Math.cos(burstAngle) * burstDist;
      const burstY = heartY + Math.sin(burstAngle) * burstDist;

      return {
        heartX, heartY, burstX, burstY, textX, textY,
        radius: 40 + r(1) * Math.min(W, H) * 0.42,
        baseAngle: r(2) * Math.PI * 2,
        size: 1.1 + r(3) * 1.2,
        twinkle: r(4) * Math.PI * 2,
        charDelay: (tp.group ?? 0) * CHAR_STAGGER_MS + r(7) * 40,
      };
    });

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const startTime = performance.now();
    let raf = 0;
    let fired = false;

    const draw = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      if (!fired && elapsed > totalMs) { fired = true; onSettled(); }

      const e = elapsed - START_DELAY;
      if (e >= 0) {
        for (const d of dots) {
          let x: number, y: number;
          let flashWhite = false;
          if (e < T_GALAXY_END) {
            const angle = d.baseAngle + e * 0.0022;
            x = cx + Math.cos(angle) * d.radius;
            y = cy + Math.sin(angle) * d.radius * 0.38;
          } else if (e < T_HEART_END) {
            const t = easeOutCubic(Math.min(1, (e - T_GALAXY_END) / MORPH_HEART_MS));
            const angle = d.baseAngle + e * 0.0022 * (1 - t);
            const gx = cx + Math.cos(angle) * d.radius, gy = cy + Math.sin(angle) * d.radius * 0.38;
            x = gx + (d.heartX - gx) * t;
            y = gy + (d.heartY - gy) * t;
          } else if (e < T_HOLD_END) {
            x = d.heartX; y = d.heartY;
          } else if (e < T_BURST_END) {
            const t = Math.min(1, (e - T_HOLD_END) / BURST_MS);
            x = d.heartX + (d.burstX - d.heartX) * t;
            y = d.heartY + (d.burstY - d.heartY) * t;
            flashWhite = true;
          } else {
            const e2 = e - T_BURST_END - d.charDelay;
            if (e2 < 0) {
              x = d.burstX; y = d.burstY;
            } else {
              const t = easeOutCubic(Math.min(1, e2 / MORPH_TEXT_MS));
              x = d.burstX + (d.textX - d.burstX) * t;
              y = d.burstY + (d.textY - d.burstY) * t;
            }
          }

          const settled = e >= T_BURST_END + maxGroup * CHAR_STAGGER_MS + MORPH_TEXT_MS;
          const tw = settled ? 0.9 + 0.14 * Math.sin(now / 260 + d.twinkle) : 1;
          ctx.fillStyle = flashWhite ? '#fff8e1' : '#fda4af';
          ctx.globalAlpha = Math.min(1, tw);
          ctx.beginPath();
          ctx.arc(x, y, d.size * tw, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [heartPoints, textPoints, onSettled]);

  return (
    <motion.div
      className="absolute inset-x-0 flex items-center justify-center pointer-events-none"
      style={{ top: '26%', zIndex: 2 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <canvas ref={canvasRef} style={{ width: '98vw', maxWidth: 560, height: '40vh', display: 'block' }} />
    </motion.div>
  );
}

// Edge sparkles — small stars that burst off each curtain panel's inner
// seam as it slides away, like stardust shaking loose from the fabric.
// Placed as children of the panel itself so they ride along with its
// slide transform for free.
const EDGE_SPARKLE_POSITIONS = [10, 26, 42, 58, 74, 90];

// A single scrolling ticker row — the string is doubled back-to-back
// and the wrapper slides exactly -50% on an infinite loop, so the
// seam between repeats is invisible and the scroll reads as endless.
function MarqueeRow({ text, direction, color, top, duration }: {
  text: string; direction: 'left' | 'right'; color: string; top: number; duration: number;
}) {
  return (
    <div className="absolute left-0 right-0 overflow-hidden" style={{ top, height: 20 }}>
      <motion.div
        className="flex whitespace-nowrap"
        style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', color, textShadow: `0 0 6px ${color}88` }}
        animate={{ x: direction === 'left' ? ['0%', '-50%'] : ['-50%', '0%'] }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
      >
        <span>{text.repeat(8)}</span>
        <span>{text.repeat(8)}</span>
      </motion.div>
    </div>
  );
}

// Fills the gap between the ticker and the drone headline: a small
// terminal box that types out a role-flavoured status line (Dev's
// "Hello World", PM's sprint status, Tester's pass rate, Designer's
// pixel-perfect nod), holds, erases, then cycles to the next role —
// forever. Self-contained recursive-timeout loop (same shape as
// useTypewriter above), not multiple interacting state machines.
const ROLE_LINES: { role: string; text: string }[] = [
  { role: 'dev', text: 'console.log("Hello World");' },
  { role: 'pm', text: 'Sprint status: ON TRACK ✓' },
  { role: 'tester', text: 'Tests passed: 100% · 0 bugs ✓' },
  { role: 'designer', text: 'Pixel perfect ✨' },
];

function RoleTyping() {
  const [display, setDisplay] = useState('');
  const [roleIdx, setRoleIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const run = (idx: number) => {
      const { text } = ROLE_LINES[idx];
      let i = 0;
      const typeStep = () => {
        if (cancelled) return;
        i++;
        setDisplay(text.slice(0, i));
        timer = i < text.length ? setTimeout(typeStep, 45) : setTimeout(eraseStep, 1100);
      };
      let j = text.length;
      function eraseStep() {
        if (cancelled) return;
        j--;
        setDisplay(text.slice(0, Math.max(0, j)));
        if (j > 0) {
          timer = setTimeout(eraseStep, 20);
        } else {
          timer = setTimeout(() => {
            const next = (idx + 1) % ROLE_LINES.length;
            setRoleIdx(next);
            run(next);
          }, 350);
        }
      }
      typeStep();
    };

    // Starts right as the curtain finishes opening (matches the fade-in
    // delay below) so typing begins fresh instead of mid-cycle behind
    // an invisible box.
    timer = setTimeout(() => run(0), 2500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  return (
    <motion.div
      className="absolute inset-x-0 flex items-center justify-center px-8 pointer-events-none"
      style={{ top: '20%', zIndex: 1 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 2.5 }}
    >
      <div
        className="rounded-xl overflow-hidden"
        style={{
          width: 'min(86vw, 360px)',
          background: '#0d0d10', border: '1px solid rgba(253,164,175,0.35)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.6), 0 0 0 6px rgba(0,0,0,0.3)',
        }}
      >
        {/* Title bar — macOS-style traffic lights, reads as an actual
            monitor/terminal window rather than a plain text chip. */}
        <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: '#1a1a1f', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57' }} />
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#febc2e' }} />
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#28c840' }} />
          <span className="ml-auto text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>team1.sh</span>
        </div>

        {/* Screen body */}
        <div className="px-4 py-3" style={{ fontFamily: '"Courier New", monospace', fontSize: 13 }}>
          <span style={{ color: '#fbbf24', fontWeight: 700 }}>{ROLE_LINES[roleIdx].role}</span>
          <span style={{ color: '#fda4af' }}>&gt; </span>
          <span style={{ color: '#fff' }}>{display}</span>
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            style={{ color: '#fda4af' }}
          >
            ▋
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
}

function CurtainSparkles({ side }: { side: 'left' | 'right' }) {
  return (
    <>
      {EDGE_SPARKLE_POSITIONS.map((top, i) => (
        <motion.span
          key={i}
          className="absolute select-none pointer-events-none"
          style={{
            [side === 'left' ? 'right' : 'left']: -8,
            top: `${top}%`,
            fontSize: 11 + (i % 3) * 4,
            color: '#fde68a',
            textShadow: '0 0 6px #fde68a, 0 0 12px #fbbf24',
          }}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: [0, 1, 0], scale: [0.3, 1.3, 0.5] }}
          transition={{ delay: 0.9 + i * 0.08, duration: 1.2, ease: 'easeOut' }}
        >
          ✨
        </motion.span>
      ))}
    </>
  );
}

// Reveals `text` one character at a time — used for the line below the
// drone headline instead of another particle formation.
function useTypewriter(text: string, speed = 45, startDelay = 200) {
  const [rendered, setRendered] = useState('');
  useEffect(() => {
    let i = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const startTimer = setTimeout(() => {
      interval = setInterval(() => {
        i++;
        setRendered(text.slice(0, i));
        if (i >= text.length && interval) clearInterval(interval);
      }, speed);
    }, startDelay);
    return () => { clearTimeout(startTimer); if (interval) clearInterval(interval); };
  }, [text, speed, startDelay]);
  return { text: rendered, done: rendered.length >= text.length };
}

const CURTAIN_SUBTITLE = 'Những Bông Hồng Trong Giới Công Nghệ';

function Curtain({ onDone }: { onDone: () => void }) {
  const [showSubtitle, setShowSubtitle] = useState(false);
  // Stable identity — CurtainIntro's draw-loop effect depends on this
  // callback; a fresh inline arrow every render would restart the
  // whole RAF animation (scatter → re-assemble) the instant the state
  // it triggers causes Curtain to re-render.
  const handleSettled = useCallback(() => setShowSubtitle(true), []);
  const subtitleTyped = useTypewriter(showSubtitle ? CURTAIN_SUBTITLE : '', 45, 200);
  // useTypewriter('') reports done=true trivially (empty string has
  // nothing left to type) — gate on showSubtitle too, or the button
  // would appear instantly, before the subtitle even starts.
  const showButton = showSubtitle && subtitleTyped.done;
  const foldStripes = (angle: number) =>
    `repeating-linear-gradient(${angle}deg, #6b0f23, #6b0f23 16px, #8f1a31 16px, #8f1a31 32px)`;

  // Starry-night backdrop, revealed behind the curtain — seeded so stars
  // don't reshuffle every render.
  const stars = useMemo(() => Array.from({ length: 70 }, (_, i) => {
    const s = ((i + 1) * 2654435761) >>> 0;
    const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
    return {
      left: r(1) * 100,
      top: r(2) * 100,
      size: 1 + r(3) * 2.4,
      dur: 1.8 + r(4) * 2.4,
      delay: r(5) * 3,
    };
  }), []);

  const shootingStars = useMemo(() => [
    { top: 14, left: 8, delay: 1.9, dur: 1.1 },
    { top: 32, left: 58, delay: 3.0, dur: 1.0 },
  ], []);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ perspective: 900 }} onClick={(e) => e.stopPropagation()}>
      {/* Backdrop — plain black night sky; the pink lives in the text
          and stars, not the sky itself, revealed as the curtain parts */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at top, #0d0d12 0%, #060608 50%, #000000 100%)' }} />

      {/* Twinkling stars */}
      {stars.map((s, i) => (
        <motion.div
          key={`star-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size,
            background: '#fff', boxShadow: '0 0 4px #fff, 0 0 8px #f9a8d499',
          }}
          animate={{ opacity: [0.15, 1, 0.15] }}
          transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* Shooting stars — quick diagonal streaks for extra drama */}
      {shootingStars.map((sh, i) => (
        <motion.div
          key={`shoot-${i}`}
          className="absolute pointer-events-none"
          style={{
            left: `${sh.left}%`, top: `${sh.top}%`, width: 90, height: 2,
            background: 'linear-gradient(90deg, transparent, #fff, #fde68a)',
            borderRadius: 999, transform: 'rotate(32deg)',
          }}
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: [0, 1, 0], x: 120 }}
          transition={{ delay: sh.delay, duration: sh.dur, ease: 'easeIn' }}
        />
      ))}

      {/* Spotlight flash — brief flare the instant the gap opens, right
          before the headline starts assembling. Purely decorative. */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 42%, #fff8e1 0%, #fde68a88 25%, transparent 60%)' }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 0.9, 0], scale: [0.4, 1.6, 2.2] }}
        transition={{ delay: 1.3, duration: 1, ease: 'easeOut' }}
      />

      {/* Terminal line cycling through team roles — fills the gap
          between the ticker and the drone headline below. */}
      <RoleTyping />

      {/* One continuous particle stream: galaxy → heart → burst →
          headline text, all the same dots. */}
      <CurtainIntro onSettled={handleSettled} />

      {/* Typed line below the drone headline — gõ chữ instead of another
          particle formation. */}
      {showSubtitle && (
        <div className="absolute inset-x-0 flex items-center justify-center px-8 text-center" style={{ top: '68%' }}>
          <div
            className="text-lg sm:text-xl italic"
            style={{ color: '#fda4af', fontFamily: 'Georgia, serif', textShadow: '0 4px 16px rgba(0,0,0,0.6)' }}
          >
            {subtitleTyped.text}
            {!subtitleTyped.done && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.9, repeat: Infinity }}
                style={{ marginLeft: 2, color: '#fbbf24' }}
              >
                |
              </motion.span>
            )}
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-[14%] flex items-center justify-center px-8">
        {showButton && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            onClick={onDone}
            className="rounded-xl px-6 py-3 text-sm font-bold cursor-pointer"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #fbbf24)`, color: '#fff', boxShadow: `0 4px 20px ${ACCENT}66` }}
          >
            Tiếp tục →
          </motion.button>
        )}
      </div>

      {/* Left velvet panel */}
      <motion.div
        className="absolute top-0 left-0 h-full"
        style={{ width: '52%', background: foldStripes(80), boxShadow: 'inset -24px 0 50px rgba(0,0,0,0.55)' }}
        initial={{ x: '0%', rotateY: 0 }}
        animate={{ x: '-100%', rotateY: -6 }}
        transition={{ delay: 0.8, duration: 1.6, ease: [0.76, 0, 0.24, 1] }}
      >
        <CurtainSparkles side="left" />
      </motion.div>

      {/* Right velvet panel */}
      <motion.div
        className="absolute top-0 right-0 h-full"
        style={{ width: '52%', background: foldStripes(100), boxShadow: 'inset 24px 0 50px rgba(0,0,0,0.55)' }}
        initial={{ x: '0%', rotateY: 0 }}
        animate={{ x: '100%', rotateY: 6 }}
        transition={{ delay: 0.8, duration: 1.6, ease: [0.76, 0, 0.24, 1] }}
      >
        <CurtainSparkles side="right" />
      </motion.div>

      {/* Valance + ticker — pushed down below KissReplayOverlay's
          top-6/h-10 mute+close buttons (occupy ~y24-64px) so the
          scrolling text no longer sits behind them. Hidden until the
          curtain finishes opening (2.4s), same gate as the drone
          headline and the terminal below. */}
      <motion.div
        className="absolute left-0 right-0 overflow-hidden"
        style={{ top: 68, height: 54, background: 'linear-gradient(180deg, #1a1a1a, #000)', boxShadow: '0 4px 14px rgba(0,0,0,0.5)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 2.5 }}
      >
        <MarqueeRow text="✦ HOSTED BY TEAM1 VN " direction="left" color="#fda4af" top={4} duration={16} />
        <MarqueeRow text="BUILDTOLAUNCH.ORG AND OTHER PARTNERS. " direction="right" color="#fbbf24" top={29} duration={20} />
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DroneBreakthrough — Phase 2: a drone-light point cloud first forms a
// flat icon of a woman typing at a computer (the "grind"/journey),
// holds for a beat, then bursts apart and reforms into a rising star
// (the "breakthrough" — tự hào/pride payoff). Same canvas pixel-
// sampling + RAF flight technique as newyear-countdown's drone
// headline: draw a shape to a hidden canvas, read its opaque pixels as
// normalized target points, then animate dots flying to those targets.
// ─────────────────────────────────────────────────────────────────────

// Flat icon: a woman (head + hair + ponytail + shoulders) sitting
// behind a monitor, hands on a keyboard, a few "code line" marks on
// the screen. Points above the monitor are tagged "warm" (her), points
// at/below are "cool" (the tech) — two glow tones from one silhouette.
// A clean open-laptop icon — the journey's opening beat. Earlier
// attempts at a detailed "woman at a computer" scene (front-facing
// with arms, then a back-view with a chair) kept reading as a messy
// blob at particle density; a single bold, iconic object — the same
// principle that makes the rocket read so clearly — works far better
// for a real drone-show silhouette. Screen interior tagged warm (pink
// glow) against a white frame/base, same two-tone language as the
// rest of the journey.
function sampleLaptop(): DronePt[] {
  if (typeof document === 'undefined') return [];
  const W = 900, H = 900;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.fillStyle = '#fff';

  // Screen (outer frame)
  const screenX = 290, screenY = 160, screenW = 320, screenH = 340;
  roundRectPath(ctx, screenX, screenY, screenW, screenH, 24); ctx.fill();

  // Base / keyboard deck — angled trapezoid, wider at the front edge,
  // the classic "open laptop" silhouette.
  ctx.beginPath();
  ctx.moveTo(250, 500);
  ctx.lineTo(650, 500);
  ctx.lineTo(700, 570);
  ctx.lineTo(200, 570);
  ctx.closePath();
  ctx.fill();

  // Trackpad accent
  roundRectPath(ctx, 400, 520, 100, 30, 8); ctx.fill();

  // Inner screen bounds used only for color-tagging below (not drawn
  // as a separate shape — a visible inset border reads as clutter at
  // this density, a color difference alone reads as "the screen is on").
  const innerX = screenX + 26, innerY = screenY + 26, innerW = screenW - 52, innerH = screenH - 52;

  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: DronePt[] = [];
  const stride = 3;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        const glowing = x > innerX && x < innerX + innerW && y > innerY && y < innerY + innerH;
        pts.push({ x: (x / W - 0.5) * 2, y: (y / H - 0.5) * 2, warm: glowing });
      }
    }
  }
  return pts;
}

// Three elegant Vietnamese women — nón lá (conical hat) + áo dài,
// drawn as outline strokes (not filled blobs), the same technique that
// made the heart banner above this scene read cleanly: a thin
// continuous line traces each shape rather than filling it solid.
// Reduced from 5 simple "universal woman" icons to 3 of these richer
// silhouettes — more detail per figure needs more of the shared dot
// budget each, so fewer figures keeps each one legible. Hat tagged
// warm (gold, via this scene's stage accent color below); head, body
// and the two flowing áo dài panels tagged cool (white). Joined by the
// same gentle arcing "joined hands" curve as before between each
// adjacent pair. Earlier attempts at this beat — an abstract
// hub-and-spoke network, open hands with individual fingers, fists
// stacked in a pile, even a canvas-rendered 🤝 emoji, then a plain
// bell-dress icon — either didn't read as "hands"/"people" or didn't
// feel distinctly Vietnamese; this is the first version to attempt
// nón lá + áo dài specifically, using the outline-stroke approach
// proven reliable on the heart banner and mandala rings elsewhere in
// this file (fine filled detail is what fails at particle density,
// not a clean traced outline).
function sampleCommunity(): DronePt[] {
  if (typeof document === 'undefined') return [];
  const W = 900, H = 900;
  const figCanvas = document.createElement('canvas');
  figCanvas.width = W; figCanvas.height = H;
  const fctx = figCanvas.getContext('2d');
  const hatCanvas = document.createElement('canvas');
  hatCanvas.width = W; hatCanvas.height = H;
  const hctx = hatCanvas.getContext('2d');
  const linkCanvas = document.createElement('canvas');
  linkCanvas.width = W; linkCanvas.height = H;
  const lctx = linkCanvas.getContext('2d');
  if (!fctx || !hctx || !lctx) return [];

  const xs = [220, 450, 680];
  const linkY = 400;

  // Joined hands — a gentle arc dipping between each adjacent pair,
  // the way linked arms naturally droop, rather than a rigid bar.
  lctx.strokeStyle = '#fff';
  lctx.lineCap = 'round';
  lctx.lineWidth = 16;
  for (let i = 0; i < xs.length - 1; i++) {
    const midX = (xs[i] + xs[i + 1]) / 2;
    lctx.beginPath();
    lctx.moveTo(xs[i] + 58, linkY);
    lctx.quadraticCurveTo(midX, linkY + 55, xs[i + 1] - 58, linkY);
    lctx.stroke();
  }

  for (const cx of xs) {
    // Nón lá — a shallow curved dome (bezier top arc + a shallow
    // concave underside), not a sharp-cornered triangle. Straight
    // lineTo polygons were the core problem with the previous version:
    // they read as a crude stick-figure sketch instead of the smooth,
    // calligraphic line real drone-show silhouettes use.
    hctx.strokeStyle = '#fff';
    hctx.lineCap = 'round';
    hctx.lineJoin = 'round';
    hctx.lineWidth = 11;
    hctx.beginPath();
    hctx.moveTo(cx - 85, 235);
    hctx.bezierCurveTo(cx - 60, 108, cx + 72, 98, cx + 95, 222);
    hctx.quadraticCurveTo(cx + 5, 205, cx - 85, 235);
    hctx.closePath();
    hctx.stroke();

    // Head, bodice and the two flowing áo dài panels — all one
    // "figure" outline layer, every segment a curve, none a straight
    // lineTo.
    fctx.strokeStyle = '#fff';
    fctx.lineCap = 'round';
    fctx.lineJoin = 'round';

    fctx.lineWidth = 8;
    fctx.beginPath();
    fctx.arc(cx + 16, 252, 25, 0, Math.PI * 2);
    fctx.stroke();

    // Raised arm, one hand near the hat brim.
    fctx.lineWidth = 9;
    fctx.beginPath();
    fctx.moveTo(cx + 50, 310);
    fctx.quadraticCurveTo(cx + 95, 270, cx + 70, 225);
    fctx.stroke();

    // Bodice — a rounded hourglass outline (shoulder curve → side
    // curve → waist curve → side curve), closed, instead of a
    // 4-cornered trapezoid.
    fctx.lineWidth = 9;
    fctx.beginPath();
    fctx.moveTo(cx - 50, 300);
    fctx.quadraticCurveTo(cx + 3, 280, cx + 55, 296);
    fctx.quadraticCurveTo(cx + 50, 340, cx + 34, 382);
    fctx.quadraticCurveTo(cx + 3, 395, cx - 28, 382);
    fctx.quadraticCurveTo(cx - 45, 340, cx - 50, 300);
    fctx.closePath();
    fctx.stroke();

    // Two long áo dài panels flowing to the ground on a soft S-bow —
    // open at the bottom, not a closed skirt shape.
    fctx.lineWidth = 8;
    fctx.beginPath();
    fctx.moveTo(cx - 24, 378);
    fctx.bezierCurveTo(cx - 72, 480, cx - 64, 620, cx - 46, 745);
    fctx.stroke();
    fctx.beginPath();
    fctx.moveTo(cx + 18, 378);
    fctx.bezierCurveTo(cx + 70, 480, cx + 70, 620, cx + 58, 745);
    fctx.stroke();
  }

  const fData = fctx.getImageData(0, 0, W, H).data;
  const hData = hctx.getImageData(0, 0, W, H).data;
  const lData = lctx.getImageData(0, 0, W, H).data;
  const pts: DronePt[] = [];
  const stride = 2;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      const idx = (y * W + x) * 4 + 3;
      if (hData[idx] > 128) {
        pts.push({ x: (x / W - 0.5) * 2, y: (y / H - 0.5) * 2, warm: true });
      } else if (fData[idx] > 128 || lData[idx] > 128) {
        pts.push({ x: (x / W - 0.5) * 2, y: (y / H - 0.5) * 2, warm: false });
      }
    }
  }
  return pts;
}

// A real Vietnamese drone-show motif — a bronze-drum (trống đồng)
// mandala of concentric rings around a sunburst center, flanked below
// by two long-necked "chim Lạc" birds sweeping outward, mirroring the
// actual large-scale drone displays this template is themed after
// (replaces the earlier literal globe-with-pin version). Birds are
// tagged warm (pink); the disc stays white. Every bird part — neck,
// beak, tail feathers — is a continuously-tapering FILLED curve
// (taperedCurve), never a thin stroke or individual feather line:
// the same lesson the fingers/fists failures taught earlier in this
// file — bold filled shapes read as particle clouds, fine linear
// detail doesn't. Birds and disc are built on separate hidden
// canvases and sampled independently for an exact pink/white split.
// A rocket silhouette — nose cone, body, two fins, exhaust flame. The
// journey's final beat: launch. Flame/fins (lower half) tagged warm
// so the base glows pink like exhaust light.
// Fixed per-bird pivot (≈shoulder) + facing direction + scale for each
// bird in the flock — plain constants rather than anything derived
// from the sampled pixels, so the per-frame wing-flap rotation in
// DroneBreakthrough can rotate a bird's points around the exact point
// its wing was drawn around without having to re-detect it from pixel
// data. pivotX/pivotY are the same bx/by pre-converted to the
// normalized (-1..1) space DronePt coordinates live in, since that's
// the space the rotation runs in (before the fitScale transform).
const BIRD_FLOCK = [
  { bx: 380, by: 430, dir: 1, scale: 1.0 },
  { bx: 600, by: 330, dir: 1, scale: 0.75 },
  { bx: 250, by: 300, dir: 1, scale: 0.6 },
  { bx: 650, by: 520, dir: 1, scale: 0.55 },
].map((b) => ({ ...b, pivotX: (b.bx / 900 - 0.5) * 2, pivotY: (b.by / 900 - 0.5) * 2 }));

// One full up-down wing cycle, and how far (radians) each point swings
// around its bird's pivot at the peak of the beat — used by
// DroneBreakthrough's per-frame flap rotation, not by sampleBirdFlock.
const FLAP_PERIOD_MS = 420;
const FLAP_MAX_RAD = 0.5;

// A small flock of birds in flight — replaces the rocket at the
// sender's request ("drone birds flying across the sky, continuously
// flapping"). Each bird is the same two-shape primitive (round body
// blob + swept wing-blade bezier) the removed world-map scene's birds
// used, drawn once per bird in a neutral mid-flap pose.
//
// The flap itself is NOT baked in here as a second sampled frame —
// that would need two independently raster-sampled point sets to line
// up index-for-index, which packToCount's stride/hash selection
// doesn't guarantee closely enough for a clean continuous oscillation
// (it reads fine for this file's big scatter/burst transitions, which
// hide any mismatch in motion blur, but a small repeating flap would
// show it as jitter). Instead every point is tagged with which bird it
// belongs to (group), and DroneBreakthrough rotates it around that
// bird's own pivot by a sine-wave angle every frame: a wingtip point
// (far from the pivot) sweeps a visible arc while a body point (near
// the pivot) barely moves — the same relationship a real wing has,
// with no frame-matching needed at all.
function sampleBirdFlock(): DronePt[] {
  if (typeof document === 'undefined') return [];
  const W = 900, H = 900;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const pts: DronePt[] = [];
  const stride = 3;

  BIRD_FLOCK.forEach((b, birdIdx) => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    const s = b.scale, dir = b.dir;

    ctx.beginPath();
    ctx.arc(b.bx - dir * 20 * s, b.by - 20 * s, 26 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(b.bx - dir * 5 * s, b.by - 5 * s);
    ctx.quadraticCurveTo(b.bx + dir * 75 * s, b.by - 100 * s, b.bx + dir * 180 * s, b.by - 30 * s);
    ctx.quadraticCurveTo(b.bx + dir * 70 * s, b.by + 35 * s, b.bx - dir * 5 * s, b.by - 5 * s);
    ctx.closePath();
    ctx.fill();

    const { data } = ctx.getImageData(0, 0, W, H);
    for (let y = 0; y < H; y += stride) {
      for (let x = 0; x < W; x += stride) {
        if (data[(y * W + x) * 4 + 3] > 128) {
          // Wing points (tagged warm → gold) vs body points (cool →
          // cream-white), split by distance from the shoulder pivot —
          // the body blob has a ~26*s radius, so anything further out
          // is on the wing.
          const dist = Math.hypot(x - b.bx, y - b.by);
          pts.push({
            x: (x / W - 0.5) * 2, y: (y / H - 0.5) * 2,
            warm: dist > 34 * s,
            group: birdIdx,
          });
        }
      }
    }
  });

  return pts;
}

// (packToCount, shared 1:1 index correspondence across shapes, is
// declared near the top of this file alongside DronePt/roundRectPath.)

// Scramble glyphs for MatrixRainColumn's digital-rain backdrop below —
// the laptop-stage caption used to be its own "hacker decrypt" letter
// reveal built on this same alphabet (scramble → resolve, green
// monospace), but the sender asked for it to match the pink italic
// paragraph style every later stage uses instead, so that reveal
// technique (HackerLetter/FallingLetters/FallingCaption) was removed;
// this constant is still needed here for the rain itself.
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*<>/\\';

// One column of a Matrix-style digital-rain backdrop — a short vertical
// strip of glyphs, brightest at the leading (bottom) edge, trailing off
// above it, looping top-to-bottom forever. A handful of its characters
// swap at random every tick so the column reads as "live" without
// re-rendering the whole thing.
function MatrixRainColumn({ leftPct, length, duration, delay, fontSize }: {
  leftPct: number; length: number; duration: number; delay: number; fontSize: number;
}) {
  const [chars, setChars] = useState<string[]>(() =>
    Array.from({ length }, () => SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)])
  );
  useEffect(() => {
    const interval = setInterval(() => {
      setChars((prev) => {
        const next = prev.slice();
        next[Math.floor(Math.random() * next.length)] = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        return next;
      });
    }, 120);
    return () => clearInterval(interval);
  }, [length]);

  return (
    <motion.div
      className="absolute top-0 pointer-events-none select-none"
      style={{ left: `${leftPct}%`, fontFamily: '"Courier New", monospace', fontSize, lineHeight: `${fontSize + 3}px`, textAlign: 'center' }}
      initial={{ y: '-110%' }}
      animate={{ y: '110%' }}
      transition={{ duration, delay, repeat: Infinity, ease: 'linear' }}
    >
      {chars.map((c, i) => (
        <div key={i} style={{ color: '#fda4af', opacity: i === chars.length - 1 ? 1 : Math.max(0.08, 1 - i * (1 / chars.length)) }}>
          {c}
        </div>
      ))}
    </motion.div>
  );
}

const RAIN_COLUMN_COUNT = 46;

// Matrix-style digital rain, falling around the laptop while it's on
// screen — reinforces the "hacker" look the caption below already has.
// Plain CSS/Framer columns, not canvas — costs nothing on the particle
// RAF loop. Fall duration and start delay are both short on purpose:
// this whole effect only lives for the laptop stage's time on screen
// (it unmounts the instant showCaption leaves 'grind'), so a slow
// multi-second drop with a long random start delay — the first
// version used 2.8-5s falls with up to a 2.5s delay — meant most
// columns never even got moving before the stage ended, which is why
// the rain was invisible in practice.
function MatrixRain() {
  const columns = useMemo(() => Array.from({ length: RAIN_COLUMN_COUNT }, (_, i) => {
    const s = ((i + 1) * 2654435761) >>> 0;
    const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
    return {
      leftPct: (i / RAIN_COLUMN_COUNT) * 100 + r(1) * (100 / RAIN_COLUMN_COUNT) * 0.7,
      length: 9 + Math.floor(r(2) * 6),
      duration: 0.8 + r(3) * 0.6,
      delay: r(4) * 0.3,
      fontSize: 12 + Math.floor(r(5) * 4),
    };
  }), []);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ opacity: 0.85 }}>
      {columns.map((c, i) => <MatrixRainColumn key={i} {...c} />)}
    </div>
  );
}

// A handful of actual theme words — not scrambled, held upright and
// readable — falling down through the same rain, slower and in full
// color so the user can actually read them as they drift by, unlike
// the single-glyph columns above which are a texture, not meant to be
// read.
const RAIN_WORDS = [
  'VIETNAMESE WOMEN', 'AI', 'WEB3', 'TEAM1 VN', 'CODE', 'BUILD', 'LAUNCH', 'DEV', 'CLOUD', 'DATA',
  'PHỤ NỮ VIỆT NAM', 'CỘNG ĐỒNG', 'KIẾN TẠO', 'TƯƠNG LAI', 'BREAKTHROUGH', 'INNOVATION',
];

function FallingWord({ leftPct, word, duration, delay, fontSize }: {
  leftPct: number; word: string; duration: number; delay: number; fontSize: number;
}) {
  return (
    <motion.div
      className="absolute top-0 pointer-events-none select-none whitespace-nowrap"
      style={{
        left: `${leftPct}%`, fontFamily: '"Courier New", monospace', fontWeight: 700,
        fontSize, color: '#fda4af', textShadow: '0 0 6px #fda4af99, 0 2px 6px rgba(0,0,0,0.6)',
      }}
      // Fixed viewport units, not percentages — a motion.div's y
      // percentage is relative to the ELEMENT'S OWN height (standard
      // CSS transform behavior), and a single text line is only
      // ~15-20px tall, so animating -10%→130% of THAT moved it by a
      // few imperceptible pixels instead of across the scene. The
      // surrounding container is a fixed 62vh, so vh units travel the
      // actual visible distance.
      initial={{ y: '-4vh', opacity: 0 }}
      animate={{ y: '66vh', opacity: [0, 1, 1, 0] }}
      transition={{ duration, delay, repeat: Infinity, repeatDelay: 0.25, ease: 'linear', opacity: { duration, times: [0, 0.08, 0.85, 1] } }}
    >
      {word}
    </motion.div>
  );
}

function FallingWords() {
  const words = useMemo(() => RAIN_WORDS.map((word, i) => {
    const s = ((i + 1) * 2654435761) >>> 0;
    const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
    return {
      word,
      leftPct: 4 + r(1) * 74,
      duration: 3.4 + r(2) * 2.2,
      // Staggered by index (not purely random) so the words enter
      // spread out across the fall cycle instead of clumping together
      // at the top in the first second.
      delay: i * 0.32 + r(3) * 0.3,
      fontSize: 12 + Math.floor(r(4) * 4),
    };
  }), []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {words.map((w, i) => <FallingWord key={i} {...w} />)}
    </div>
  );
}

// Cursive "Phụ nữ Việt Nam / Cùng nhau kiến tạo tương lai" headline
// above the women photo. Dancing Script is already loaded globally
// (src/app/globals.css, for other templates' DOM text) — this is its
// first canvas use, so document.fonts.load() is awaited before
// sampling, otherwise ctx.font would silently fall back to a generic
// cursive font and the letterforms wouldn't match the reference.
// A left-to-right "pen/nozzle tracing" reveal for one line of the
// headline. Earlier version sampled each glyph into particle dots like
// the rest of this file's drone-formation shapes, but at the size this
// has to fit on a phone screen above the photo, the cursive strokes'
// dots overlapped into an unreadable blur — small glyphs don't have
// enough dot-to-dot overlap to read clearly under the file's additive
// 'lighter' blend (same root cause as the dimming note that used to
// live here, just worse at mobile scale: the earlier fix compensated
// for faintness, not illegibility). Real DOM text stays crisp at any
// size; a clip-path wipe + a small traveling glow dot keep the
// "being traced by a drone/pen" feel without needing particle dots to
// render the glyphs themselves.
function TracedLine({ text, fontSize, delay, color, glow }: {
  text: string; fontSize: string; delay: number; color: string; glow: string;
}) {
  const DURATION = 1.3;
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <motion.div
        initial={{ clipPath: 'inset(0 100% 0 0)' }}
        animate={{ clipPath: 'inset(0 0% 0 0)' }}
        transition={{ duration: DURATION, delay, ease: 'easeOut' }}
        style={{
          fontFamily: '"Dancing Script", cursive',
          fontWeight: 700,
          fontSize,
          color,
          textShadow: `0 0 10px ${glow}, 0 0 22px ${glow}`,
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </motion.div>
      <motion.div
        initial={{ left: '0%', opacity: 0 }}
        animate={{ left: '100%', opacity: [0, 1, 1, 0] }}
        transition={{ duration: DURATION, delay, ease: 'linear', times: [0, 0.05, 0.92, 1] }}
        style={{
          position: 'absolute', top: '50%', width: 8, height: 8, marginLeft: -4, marginTop: -4,
          borderRadius: '50%', background: '#fff8e1',
          boxShadow: '0 0 10px 3px rgba(255,248,225,0.9), 0 0 20px 6px rgba(253,164,175,0.6)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function CommunityHeadlineText() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <TracedLine
        text="Phụ nữ Việt Nam"
        fontSize="clamp(30px, 9vw, 42px)"
        delay={0}
        color="#fda4af"
        glow="rgba(253,164,175,0.65)"
      />
      <TracedLine
        text="Cùng nhau kiến tạo tương lai"
        fontSize="clamp(17px, 5vw, 23px)"
        delay={1.55}
        color="#fde68a"
        glow="rgba(253,230,138,0.8)"
      />
    </div>
  );
}

// Headline above the finale photo — the sender's FIRST reference image
// for this scene (before they settled on the plain lotus version, no
// baked-in text, and asked for the photo to be used directly) had this
// exact two-line cursive text on it. Recreated here with the same
// TracedLine technique as the community headline instead of being
// baked into the image, so it stays crisp at any size.
function BreakthroughHeadlineText() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <TracedLine
        text="Cùng nhau phá vỡ giới hạn"
        fontSize="clamp(26px, 8vw, 38px)"
        delay={0}
        color="#c4b5fd"
        glow="rgba(196,181,253,0.65)"
      />
      <TracedLine
        text="Đưa phụ nữ Việt Nam trên bản đồ thế giới"
        fontSize="clamp(14px, 4.2vw, 19px)"
        delay={1.55}
        color="#fde68a"
        glow="rgba(253,230,138,0.8)"
      />
    </div>
  );
}

const AMBIENT_GLOW_COUNT = 42;
const AMBIENT_GLOW_COLORS = ['#fda4af', '#fde68a', '#c4b5fd', '#f9a8d4'];

// Fills the open space below the photo (and around the headline) with
// drone-light motes drifting slowly upward and twinkling as they go —
// the headline + photo only fill about a third of the screen (capped
// by the photo's own wide aspect ratio, so making it wider doesn't
// make it much taller), leaving the rest of the community scene plain
// black otherwise; this reads as a sky still full of drones after the
// formation rather than empty space. Every 5th mote runs noticeably
// bigger + pulses, like a drone closer to camera, for depth and a
// stronger "real light show" read rather than a flat field of
// identical sparks. Pure DOM + CSS transform animation (no canvas, no
// RAF loop) — even ~40 small elements is negligible next to the
// particle canvases elsewhere in this file, and Framer's transform-
// based tween is GPU-composited either way.
function CommunityAmbientGlow() {
  const dots = useMemo(() => Array.from({ length: AMBIENT_GLOW_COUNT }, (_, i) => {
    const seed = ((i + 1) * 2654435761) >>> 0;
    const r = (n: number) => (((seed ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
    const big = i % 5 === 0;
    return {
      left: 4 + r(1) * 92,
      size: big ? 7 + r(2) * 5 : 2.8 + r(2) * 4,
      color: AMBIENT_GLOW_COLORS[i % AMBIENT_GLOW_COLORS.length],
      duration: 4.5 + r(3) * 4,
      delay: r(4) * 6,
      driftX: (r(5) - 0.5) * 32,
      big,
    };
  }), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {dots.map((d, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${d.left}%`, width: d.size, height: d.size,
            background: d.color, boxShadow: `0 0 ${d.size * (d.big ? 3.2 : 2.6)}px ${d.color}`,
          }}
          initial={{ top: '102%', opacity: 0, x: 0, scale: 1 }}
          animate={{
            top: '-6%',
            opacity: d.big ? [0, 1, 0.6, 1, 0] : [0, 1, 1, 0],
            x: [0, d.driftX, 0],
            scale: d.big ? [1, 1.4, 1, 1.4, 1] : 1,
          }}
          transition={{ duration: d.duration, delay: d.delay, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </div>
  );
}

const GALAXY_STAR_COUNT = 50;
const GALAXY_NEBULA_COLORS = ['rgba(139,92,246,0.55)', 'rgba(219,39,119,0.45)', 'rgba(56,189,248,0.4)'];
const GALAXY_DRONE_COLORS = ['#fda4af', '#fde68a', '#c4b5fd', '#f9a8d4'];
const GALAXY_STREAK_COUNT = 4;

// Fills the open black space below the finale photo with a layered
// "3D" starfield + a couple of soft drifting nebula glows — the
// sender's follow-up ask, suggesting a 3D galaxy specifically, after
// the same gap on the community scene was fixed with plain ambient
// motes (see CommunityAmbientGlow above). Three depth tiers (far/mid/
// near, via correlated size + brightness + drift speed, not an actual
// z-translate — cheap depth, not a 3D engine) read as depth the way
// real starfields do: many small dim slow stars, a few big bright fast
// ones. The nebula blobs are large soft radial gradients pulsing
// slowly behind them for the galaxy's color-cloud look. This also
// visually continues the starry night sky already baked into the
// photo above instead of cutting off hard at its edge.
//
// Pushed further ("more drone, more wow") with two additions: the
// near tier is now tinted with this file's drone-light palette instead
// of plain white — far/mid stay white/cream so it still reads as a
// real starfield, but the closest, brightest points read as drones,
// not stars. And a handful of fast diagonal "streaks" loop through
// rarely (long random delay) — a bright drone visibly zipping across
// the sky, not just hovering, for an occasional surprise flourish.
// Pure DOM + CSS transform animation, same approach as
// CommunityAmbientGlow — no canvas, no RAF loop.
function PrideGalaxyField() {
  const stars = useMemo(() => Array.from({ length: GALAXY_STAR_COUNT }, (_, i) => {
    const seed = ((i + 1) * 2654435761) >>> 0;
    const r = (n: number) => (((seed ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
    const tier = r(1) < 0.55 ? 0 : r(1) < 0.85 ? 1 : 2;
    const size = [1.2, 2.2, 3.6][tier] + r(2) * [1, 1.4, 2][tier];
    const color = tier === 2 ? GALAXY_DRONE_COLORS[i % GALAXY_DRONE_COLORS.length] : '#fff8e1';
    return {
      left: 2 + r(3) * 96,
      size,
      color,
      glow: tier === 2,
      maxOpacity: [0.5, 0.75, 1][tier],
      duration: [9, 6.5, 4.5][tier] + r(4) * 2,
      delay: r(5) * 6,
    };
  }), []);

  const nebulae = useMemo(() => Array.from({ length: 3 }, (_, i) => {
    const seed = ((i + 101) * 2654435761) >>> 0;
    const r = (n: number) => (((seed ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
    return {
      left: 8 + r(1) * 84,
      top: 38 + r(2) * 48,
      size: 260 + r(3) * 180,
      color: GALAXY_NEBULA_COLORS[i % GALAXY_NEBULA_COLORS.length],
      duration: 12 + r(4) * 7,
    };
  }), []);

  const streaks = useMemo(() => Array.from({ length: GALAXY_STREAK_COUNT }, (_, i) => {
    const seed = ((i + 201) * 2654435761) >>> 0;
    const r = (n: number) => (((seed ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
    const startLeft = r(1) * 70;
    const startTop = 10 + r(2) * 70;
    return {
      startLeft, startTop,
      travelX: 120 + r(3) * 80,
      travelY: 40 + r(4) * 50,
      color: GALAXY_DRONE_COLORS[i % GALAXY_DRONE_COLORS.length],
      // Quick zip (0.7-1s) then a long rest before the next pass, so it
      // reads as an occasional flourish, not a constant distraction.
      duration: 0.7 + r(5) * 0.3,
      delay: 3 + r(6) * 10,
      repeatDelay: 6 + r(7) * 8,
    };
  }), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {nebulae.map((n, i) => (
        <motion.div
          key={`nebula-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${n.left}%`, top: `${n.top}%`, width: n.size, height: n.size,
            background: `radial-gradient(circle, ${n.color} 0%, transparent 70%)`,
            filter: 'blur(10px)',
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ opacity: 0.45, scale: 0.9 }}
          animate={{ opacity: [0.45, 0.85, 0.45], scale: [0.9, 1.2, 0.9] }}
          transition={{ duration: n.duration, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {stars.map((s, i) => (
        <motion.span
          key={`star-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${s.left}%`, width: s.size, height: s.size, background: s.color,
            boxShadow: s.glow ? `0 0 ${s.size * 2.5}px ${s.color}` : undefined,
          }}
          initial={{ top: '104%', opacity: 0 }}
          animate={{ top: '-4%', opacity: [0, s.maxOpacity, s.maxOpacity * 0.3, s.maxOpacity, 0] }}
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: 'linear' }}
        />
      ))}
      {streaks.map((st, i) => (
        <motion.span
          key={`streak-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${st.startLeft}%`, top: `${st.startTop}%`, width: 46, height: 2,
            background: `linear-gradient(90deg, transparent, ${st.color}, #fff8e1)`,
            boxShadow: `0 0 8px 1px ${st.color}`,
            transformOrigin: 'left center',
            rotate: `${Math.atan2(st.travelY, st.travelX) * (180 / Math.PI)}deg`,
          }}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{
            x: [0, `${st.travelX}vw`],
            y: [0, `${st.travelY}vh`],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: st.duration, delay: st.delay, repeat: Infinity, repeatDelay: st.repeatDelay,
            // A per-property transition override replaces the whole
            // transition spec for that property, not just the fields
            // given — it does NOT inherit delay/repeat from the
            // top-level transition sitting next to it. Without delay/
            // repeat/repeatDelay repeated here, opacity was jumping to
            // full brightness immediately on mount (delay defaulting
            // to 0) while x/y correctly waited — a bright static flash
            // at the start position instead of a delayed, moving
            // streak. Caught by polling the actual DOM opacity instead
            // of trusting the code read right.
            ease: 'easeIn', opacity: {
              duration: st.duration, delay: st.delay, repeat: Infinity, repeatDelay: st.repeatDelay,
              times: [0, 0.15, 0.7, 1],
            },
          }}
        />
      ))}
    </div>
  );
}

type ColorPt = { x: number; y: number; r: number; g: number; b: number };

// Samples the sender's reference photo's bright pixels — it's already
// drawn as thin gold/purple light-trail silhouettes on a dark-navy
// background, i.e. it already reads like a drone-show photograph —
// into a particle point set carrying each point's own real sampled
// color. x/y are 0..1 fractions of the sampled canvas, which is drawn
// at the image's own aspect ratio, so they map directly onto an
// object-fit:'contain' box the same way the real <img> does.
// Downsampled with the same hash-based pseudo-random pick this file
// uses elsewhere (packToCount's deterministic stride-pick shows up as
// scanline banding on a filled region).
function sampleWomenPhotoPoints(img: HTMLImageElement, count: number): ColorPt[] {
  const W = 480;
  const H = Math.round(W * (img.naturalHeight / img.naturalWidth));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: ColorPt[] = [];
  const stride = 2;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      const idx = (y * W + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      if (0.299 * r + 0.587 * g + 0.114 * b > 55) {
        pts.push({ x: x / W, y: y / H, r, g, b });
      }
    }
  }
  if (pts.length <= count) return pts;
  return Array.from({ length: count }, (_, i) => pts[(((i + 1) * 2654435761) >>> 0) % pts.length]);
}

// The community scene's figures — the sender's own reference photo
// (six women in áo dài holding hands, viewed from behind, with a
// Vietnam map + star and lotus-flower accents) used directly instead
// of a procedural particle recreation. Several rounds of hand-built
// bezier-curve attempts (candle-like silhouettes from a shoulder
// V-notch bug, a dress that read as "two legs" until switched to a
// fill, visible scanline banding until the sampling was re-hashed)
// each closed real gaps but still fell short of the reference's
// fidelity — using the actual image sidesteps that gap entirely and
// is the sender's own explicit ask ("put the image in the code").
//
// A plain fade/scale-in on the flat photo read as "a picture just
// appeared", not a drone show — the sender asked for it to feel like
// real drones assembling the picture. So the photo's own bright pixels
// are sampled into particles (above) that scatter in from random
// positions and converge onto their real spot in the image, each
// carrying the photo's own color at that point; the real <img>
// crossfades in underneath as they settle, so the swarm visibly
// "resolves into" the photo instead of the photo just fading in. Once
// settled, the overlay steps down to a light twinkling shimmer (same
// settled-twinkle language the main breakthrough canvas already uses)
// so the photo stays readable while still feeling like individually
// lit points, not a static image.
//
// Generalized to take `src` once the sender asked for a SECOND photo
// (a full drone-show mockup — women + world map + lotus + city skyline)
// to replace the bird-flock finale the same way this one replaced the
// procedural community figures — same technique, different image.
function DroneFormedPhoto({ src }: { src: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !wrapRef.current || !canvasRef.current) return;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let cancelled = false;
    const img = new Image();
    img.src = src;
    img.onload = () => {
      if (cancelled) return;
      const pts = sampleWomenPhotoPoints(img, 900);
      if (pts.length === 0) {
        if (imgRef.current) imgRef.current.style.opacity = '1';
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const rect = wrap.getBoundingClientRect();
      const W = rect.width, H = rect.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // object-fit:'contain' math, so sampled points land exactly
      // where the real <img> underneath draws them.
      const imgAR = img.naturalWidth / img.naturalHeight;
      const boxAR = W / H;
      let dw: number, dh: number, dx: number, dy: number;
      if (imgAR > boxAR) { dw = W; dh = W / imgAR; dx = 0; dy = (H - dh) / 2; }
      else { dh = H; dw = H * imgAR; dy = 0; dx = (W - dw) / 2; }

      const cx = W / 2, cy = H / 2;
      const dots = pts.map((p) => {
        const targetX = dx + p.x * dw, targetY = dy + p.y * dh;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.min(W, H) * (0.6 + Math.random() * 0.8);
        return {
          fromX: cx + Math.cos(angle) * dist, fromY: cy + Math.sin(angle) * dist,
          targetX, targetY,
          color: `rgb(${p.r},${p.g},${p.b})`,
          delay: Math.random() * 350,
          size: 1.1 + Math.random() * 1.1,
          twinkle: Math.random() * Math.PI * 2,
        };
      });

      const CONVERGE_MS = 1400;
      const startTime = performance.now();
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

      const draw = (now: number) => {
        const elapsed = now - startTime;
        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';

        // Real photo crossfades in through the back half of the
        // converge window, directly mutating the <img>'s own style —
        // not React state, which would re-render every frame.
        const fadeT = Math.min(1, Math.max(0, (elapsed - CONVERGE_MS * 0.5) / (CONVERGE_MS * 0.7)));
        if (imgRef.current) imgRef.current.style.opacity = String(fadeT);

        // After convergence, the whole overlay steps down to a light
        // shimmer so the photo reads clearly underneath it.
        const overlayAlpha = elapsed < CONVERGE_MS ? 1 : Math.max(0.3, 1 - (elapsed - CONVERGE_MS) / 900);

        for (const d of dots) {
          const e = Math.max(0, elapsed - d.delay);
          const t = easeOutCubic(Math.min(1, e / CONVERGE_MS));
          const x = d.fromX + (d.targetX - d.fromX) * t;
          const y = d.fromY + (d.targetY - d.fromY) * t;
          const settled = e >= CONVERGE_MS;
          const tw = settled ? 0.75 + 0.35 * Math.sin(now / 260 + d.twinkle) : 1;
          ctx.globalAlpha = Math.min(1, t) * overlayAlpha * tw;
          ctx.fillStyle = d.color;
          ctx.beginPath();
          ctx.arc(x, y, d.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
    };

    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [src]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <img
        ref={imgRef}
        src={src}
        alt=""
        style={{
          width: '100%', height: '100%', objectFit: 'contain', opacity: 0,
          filter: 'drop-shadow(0 0 20px rgba(167,139,250,0.35))',
        }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
    </div>
  );
}

const BREAKTHROUGH_DOT_COUNT = 4600;

function DroneBreakthrough({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showCaption, setShowCaption] = useState<'none' | 'grind' | 'build' | 'pride'>('none');
  const [showButton, setShowButton] = useState(false);

  const laptopPoints = useMemo(() => packToCount(sampleLaptop(), BREAKTHROUGH_DOT_COUNT), []);
  const communityPoints = useMemo(() => packToCount(sampleCommunity(), BREAKTHROUGH_DOT_COUNT), []);
  // Still named "rocket*" throughout below (rocketPoints/rocketFit/
  // rocketX/rocketY/rocketWarm/T_ROCKET_END...) even though the shape
  // is now a bird flock — purely a naming leftover from the swap, kept
  // as-is to avoid a mechanical rename across every call site below.
  const rocketPoints = useMemo(() => packToCount(sampleBirdFlock(), BREAKTHROUGH_DOT_COUNT), []);

  useEffect(() => {
    if (typeof window === 'undefined' || !canvasRef.current || laptopPoints.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = W / 2, cy = H / 2;

    // Fits a point set's ACTUAL bounding box to the canvas (not a
    // fixed fraction) so each shape uses as much of the display as it
    // can — fine details (chip pins, rocket fins) stay legible.
    const fitScale = (pts: DronePt[], pad: number) => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const spanX = Math.max(0.01, maxX - minX);
      const spanY = Math.max(0.01, maxY - minY);
      return { scale: Math.min(W / spanX, H / spanY) * pad, midX: (minX + maxX) / 2, midY: (minY + maxY) / 2 };
    };
    const laptopFit = fitScale(laptopPoints, 0.92);
    const communityFit = fitScale(communityPoints, 0.8);
    const rocketFit = fitScale(rocketPoints, 0.7);

    // Laptop's inner screen rect (source-space 316,186,268,288 — see
    // sampleLaptop's innerX/Y/W/H), mapped through the same transform
    // as the laptop's dots, so the "running code" lines drawn below
    // land exactly inside the particle-drawn screen.
    const toNorm = (px: number, py: number) => ({ x: (px / 900 - 0.5) * 2, y: (py / 900 - 0.5) * 2 });
    const corner1 = toNorm(316, 186), corner2 = toNorm(316 + 268, 186 + 288);
    const screenPx1 = cx + (corner1.x - laptopFit.midX) * laptopFit.scale;
    const screenPy1 = cy + (corner1.y - laptopFit.midY) * laptopFit.scale;
    const screenPx2 = cx + (corner2.x - laptopFit.midX) * laptopFit.scale;
    const screenPy2 = cy + (corner2.y - laptopFit.midY) * laptopFit.scale;
    const screenRect = {
      x: Math.min(screenPx1, screenPx2), y: Math.min(screenPy1, screenPy2),
      w: Math.abs(screenPx2 - screenPx1), h: Math.abs(screenPy2 - screenPy1),
    };
    const CODE_LINES = [
      'const build = () => {', '  npm run deploy', '  tests.passAll();',
      'import React from "react"', 'function launch(team) {', '  return success;',
      '} // done', 'git commit -m "ship it"', 'while (coding) { learn(); }',
    ];
    const codeLineH = 19;

    // Keyboard key grid (source-space 240,510,420,52 — inset within
    // the laptop's base trapezoid, see sampleLaptop), mapped the same
    // way as the screen, so individual keys can flash as if typed.
    const kbCorner1 = toNorm(240, 510), kbCorner2 = toNorm(240 + 420, 510 + 52);
    const kbPx1 = cx + (kbCorner1.x - laptopFit.midX) * laptopFit.scale;
    const kbPy1 = cy + (kbCorner1.y - laptopFit.midY) * laptopFit.scale;
    const kbPx2 = cx + (kbCorner2.x - laptopFit.midX) * laptopFit.scale;
    const kbPy2 = cy + (kbCorner2.y - laptopFit.midY) * laptopFit.scale;
    const keyboardRect = {
      x: Math.min(kbPx1, kbPx2), y: Math.min(kbPy1, kbPy2),
      w: Math.abs(kbPx2 - kbPx1), h: Math.abs(kbPy2 - kbPy1),
    };
    const KB_COLS = 10, KB_ROWS = 2;
    const keys = Array.from({ length: KB_COLS * KB_ROWS }, (_, i) => ({
      col: i % KB_COLS, row: Math.floor(i / KB_COLS),
      // Each key gets its own little typing rhythm — random offset +
      // period so they flash independently, not all in lockstep.
      phaseOffset: (i * 137) % 900,
      period: 260 + (i % 5) * 60,
    }));

    // Journey timeline (ms from mount): Woman at a computer (the
    // grind) → bursts into a chip/circuit (building) → bursts into the
    // community photo → bursts again into a flock of birds that
    // flies, flapping, off into the distance (breakthrough).
    // Slowed down across the board — gather/hold/reform phases get
    // noticeably more time (bursts stay quick/punchy on purpose, the
    // snap is part of the drama).
    // Slowed down again — the appearing/gathering/reforming moments
    // (scatter-in, morphs) get noticeably more time so each shape
    // visibly builds instead of snapping together; bursts stay quick.
    // Slowed down a third time — the transitions BETWEEN shapes
    // (burst + reform) now get noticeably more time each, so the
    // morph itself is visible rather than a quick blur; holds are
    // unchanged.
    // Slowed down a fourth time — rebuilt around a ~10s-per-scene
    // budget (reform + hold + burst each), so every shape (laptop,
    // community, map, rocket) gets a full ~10s on screen instead of
    // ~5-6s; bursts stay short/punchy, reform+hold absorb the rest.
    // Slowed down a fifth time — the sender asked for more reading
    // time specifically, so this round only stretches each stage's
    // HOLD window (where its caption paragraph sits still and is
    // readable), not the scatter/reform/burst motion, which stays at
    // its established pace. The laptop stage's hold grew the most
    // (4.4s → 8.4s) since its caption previously had the least time of
    // the three by a wide margin; community's hold grew a bit further
    // on top of its already-generous photo display (10s → 13s). The
    // breakthrough stage's caption already had unbounded reading time
    // (it just sits until the viewer taps "Tiếp tục"), so it needed no
    // change on that front — its hold/launch timings only shifted
    // later because everything before them did.
    const T_SCATTER_END = 5600;      // fly in → laptop silhouette
    const T_HOLD1_END = 12900;       // hold as laptop
    const T_BURST1_END = 14000;      // quick radial burst
    const T_COMMUNITY_END = 19600;   // reform into a community ring
    const T_HOLD2_END = 25900;       // hold as community ring
    const T_BURST2_END = 27000;      // quick radial burst
    const T_ROCKET_END = 32600;      // reform into the bird flock
    const T_ROCKET_HOLD_END = 35900; // cruising flight, flapping + drifting
    const T_LAUNCH_END = 39200;      // peels off diagonally and fades

    const dots = laptopPoints.map((wp, i) => {
      const cp = communityPoints[i] ?? wp;
      const rp = rocketPoints[i] ?? wp;
      const laptopX = cx + (wp.x - laptopFit.midX) * laptopFit.scale, laptopY = cy + (wp.y - laptopFit.midY) * laptopFit.scale;
      const communityX = cx + (cp.x - communityFit.midX) * communityFit.scale, communityY = cy + (cp.y - communityFit.midY) * communityFit.scale;
      const rocketX = cx + (rp.x - rocketFit.midX) * rocketFit.scale, rocketY = cy + (rp.y - rocketFit.midY) * rocketFit.scale;

      const angle = Math.random() * Math.PI * 2;
      const scatterDist = Math.min(W, H) * (0.9 + Math.random() * 1.1);
      const fromX = cx + Math.cos(angle) * scatterDist;
      const fromY = cy + Math.sin(angle) * scatterDist * 0.7 - H * 0.2;

      // Each burst pushes radially outward from wherever this dot
      // currently sits — the shape appears to explode apart from
      // itself, the same move reused for every transition.
      const burst = (x: number, y: number) => {
        const a = Math.atan2(y - cy, x - cx) + (Math.random() - 0.5) * 0.7;
        const d = Math.min(W, H) * (0.3 + Math.random() * 0.26);
        return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
      };
      const burst1 = burst(laptopX, laptopY);
      const burst2 = burst(communityX, communityY);

      return {
        fromX, fromY, laptopX, laptopY,
        burst1X: burst1.x, burst1Y: burst1.y, communityX, communityY,
        burst2X: burst2.x, burst2Y: burst2.y, rocketX, rocketY,
        // Raw (pre-fitScale) normalized position + which bird this
        // point belongs to — the per-frame wing-flap rotation needs
        // both: it rotates (rocketNormX, rocketNormY) around that
        // bird's own pivot, in the same normalized space BIRD_FLOCK's
        // pivots are defined in, then applies the fitScale transform
        // itself (rocketX/rocketY are already-transformed and only
        // used for the burst-in reform lerp below, not the flap).
        rocketNormX: rp.x, rocketNormY: rp.y, birdIdx: rp.group ?? 0,
        // Bug fix: these used to fall back to the laptop point's own
        // "warm" tag for every stage (there was no rocket-specific
        // field), so the rocket flame/fins split was actually driven
        // by unrelated noise from the laptop shape at the same index —
        // not by its own structure at all. Each stage now reads its
        // own shape's tag. (Community no longer needs one — see the
        // skip-and-cover note below.)
        warm: wp.warm, rocketWarm: rp.warm,
        size: 1.3 + Math.random() * 1.3,
        delay: Math.random() * 280,
        twinkle: Math.random() * Math.PI * 2,
      };
    });

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const easeIn = (t: number) => t * t;
    const startTime = performance.now();
    let raf = 0;
    const fired = { grind: false, build: false, pride: false, button: false };

    const draw = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      if (!fired.grind && elapsed > T_SCATTER_END) { fired.grind = true; setShowCaption('grind'); }
      if (!fired.build && elapsed > T_BURST1_END) { fired.build = true; setShowCaption('build'); }
      if (!fired.pride && elapsed > T_BURST2_END) { fired.pride = true; setShowCaption('pride'); }
      if (!fired.button && elapsed > T_LAUNCH_END) { fired.button = true; setShowButton(true); }

      // Once the flock has reformed (T_ROCKET_END), it cruises with a
      // slow rightward glide + gentle bob instead of sitting static,
      // then once the hold is over (T_ROCKET_HOLD_END) peels off
      // diagonally and fades — the same shared-drift-applied-to-every-
      // dot approach the old straight-up rocket launch used, just a
      // continuous cruise added before the peel-off instead of a
      // static hold.
      const flockElapsed = Math.max(0, elapsed - T_ROCKET_END);
      const launchT = elapsed < T_ROCKET_HOLD_END ? 0 : Math.min(1, (elapsed - T_ROCKET_HOLD_END) / (T_LAUNCH_END - T_ROCKET_HOLD_END));
      const flockDriftX = flockElapsed * 0.012 + easeIn(launchT) * W * 0.9;
      const flockDriftY = Math.sin(elapsed / 900) * 6 - easeIn(launchT) * H * 0.9;
      const launchAlpha = 1 - Math.min(1, launchT * 1.15);

      for (const d of dots) {
        const e = Math.max(0, elapsed - d.delay);
        let x: number, y: number;
        if (e < T_SCATTER_END) {
          const t = easeOutCubic(Math.min(1, e / T_SCATTER_END));
          x = d.fromX + (d.laptopX - d.fromX) * t;
          y = d.fromY + (d.laptopY - d.fromY) * t;
        } else if (e < T_HOLD1_END) {
          x = d.laptopX; y = d.laptopY;
        } else if (e < T_BURST1_END) {
          const t = Math.min(1, (e - T_HOLD1_END) / (T_BURST1_END - T_HOLD1_END));
          x = d.laptopX + (d.burst1X - d.laptopX) * t;
          y = d.laptopY + (d.burst1Y - d.laptopY) * t;
        } else if (e < T_COMMUNITY_END) {
          const t = easeOutCubic(Math.min(1, (e - T_BURST1_END) / (T_COMMUNITY_END - T_BURST1_END)));
          x = d.burst1X + (d.communityX - d.burst1X) * t;
          y = d.burst1Y + (d.communityY - d.burst1Y) * t;
        } else if (e < T_HOLD2_END) {
          x = d.communityX; y = d.communityY;
        } else if (e < T_BURST2_END) {
          const t = Math.min(1, (e - T_HOLD2_END) / (T_BURST2_END - T_HOLD2_END));
          x = d.communityX + (d.burst2X - d.communityX) * t;
          y = d.communityY + (d.burst2Y - d.communityY) * t;
        } else if (e < T_ROCKET_END) {
          const t = easeOutCubic(Math.min(1, (e - T_BURST2_END) / (T_ROCKET_END - T_BURST2_END)));
          x = d.burst2X + (d.rocketX - d.burst2X) * t;
          y = d.burst2Y + (d.rocketY - d.burst2Y) * t;
        } else {
          // Continuous wing flap: rotate this point around its own
          // bird's pivot by a sine-wave angle (see sampleBirdFlock's
          // comment for why this is a rotation, not a second sampled
          // frame). At e===T_ROCKET_END, flapPhase===0 so the rotation
          // is a no-op and this lands exactly on d.rocketX/rocketY —
          // no snap from the reform lerp above.
          const bird = BIRD_FLOCK[d.birdIdx] ?? BIRD_FLOCK[0];
          const flapAngle = Math.sin((e - T_ROCKET_END) / FLAP_PERIOD_MS * Math.PI * 2) * FLAP_MAX_RAD;
          const cosA = Math.cos(flapAngle), sinA = Math.sin(flapAngle);
          const relX = d.rocketNormX - bird.pivotX, relY = d.rocketNormY - bird.pivotY;
          const rotX = bird.pivotX + relX * cosA - relY * sinA;
          const rotY = bird.pivotY + relX * sinA + relY * cosA;
          x = cx + (rotX - rocketFit.midX) * rocketFit.scale + flockDriftX;
          y = cy + (rotY - rocketFit.midY) * rocketFit.scale + flockDriftY;
        }

        // DroneFormedPhoto overlays fully cover both the community
        // window (T_BURST1_END..T_BURST2_END) and, now, the entire
        // rest of the sequence too — the bird flock that used to
        // render from T_BURST2_END onward was replaced by a second
        // DroneFormedPhoto (the sender's drone-show finale mockup) the
        // same way the procedural community figures were, so these
        // dots (including all the flap-rotation math above) are never
        // actually visible past T_BURST1_END; skipping the draw call
        // still recovers the FPS stacking particle canvases cost, even
        // though the position math above still runs for them.
        if (e >= T_BURST1_END) continue;

        // Birds are never in a true static hold (always flapping and
        // drifting), so this applies a gentle continuous shimmer the
        // whole time they're in flight instead of gating it behind a
        // "settled, not yet launched" state the way the old static
        // rocket hold did.
        const tw = e >= T_ROCKET_END ? 0.88 + 0.18 * Math.sin(now / 200 + d.twinkle) : 1;
        // Each stage reads its OWN shape's warm tag — not just the
        // laptop's, which every stage silently fell back to before
        // this fix (see the bug-fix comment at the dots array above).
        // On the rocket, the flame/fins use rocketWarm. (Community
        // dots never reach here — they're skipped above, fully covered
        // by the richer CommunityWomenBanner overlay instead.)
        const isPink = e >= T_BURST2_END ? d.rocketWarm : d.warm;
        // Each stage's "warm" accent gets its own color instead of a
        // flat pink throughout — the rocket's flame/fins read as fire
        // (orange), echoing the richer multi-color look the women
        // banner above the community scene already has.
        let warmColor = '#fda4af';
        if (e >= T_BURST2_END) warmColor = '#fb923c';
        else if (e >= T_BURST1_END) warmColor = '#fbbf24';
        ctx.fillStyle = isPink ? warmColor : '#fff';
        ctx.globalAlpha = Math.min(1, tw) * (e >= T_ROCKET_END ? launchAlpha : 1);
        ctx.beginPath();
        ctx.arc(x, y, d.size * tw, 0, Math.PI * 2);
        ctx.fill();
      }

      // Running code lines inside the laptop's screen — only while it's
      // settled and before it bursts (T_SCATTER_END..T_HOLD1_END),
      // clipped strictly to the particle-drawn screen rect so it reads
      // as "on the screen", not floating free.
      if (elapsed >= T_SCATTER_END * 0.9 && elapsed < T_BURST1_END && screenRect.w > 4 && screenRect.h > 4) {
        const fadeIn = Math.min(1, (elapsed - T_SCATTER_END * 0.9) / (T_SCATTER_END * 0.1));
        const fadeOut = elapsed > T_HOLD1_END ? Math.max(0, 1 - (elapsed - T_HOLD1_END) / (T_BURST1_END - T_HOLD1_END)) : 1;
        ctx.save();
        ctx.beginPath();
        ctx.rect(screenRect.x, screenRect.y, screenRect.w, screenRect.h);
        ctx.clip();
        ctx.globalCompositeOperation = 'source-over';
        // Dim backdrop so the code reads as "the screen switched to an
        // editor", not text lost in the pink particle dots behind it.
        ctx.fillStyle = `rgba(20,5,10,${0.55 * fadeIn * fadeOut})`;
        ctx.fillRect(screenRect.x, screenRect.y, screenRect.w, screenRect.h);
        ctx.font = `${Math.max(13, screenRect.w / 20)}px "Courier New", monospace`;
        ctx.textBaseline = 'top';
        // No ctx.shadowBlur here — it was re-applied every frame across
        // ~15-20 fillText calls per frame and was part of the same
        // canvas-shadow performance trap that caused lag through this
        // whole stage (see DroneCaptionText above). The brighter fill
        // color alone already reads clearly against the dim backdrop.
        ctx.fillStyle = `rgba(255,241,189,${fadeIn * fadeOut})`;
        const scrollPx = (elapsed * 0.022) % (CODE_LINES.length * codeLineH);
        for (let i = -1; i <= Math.ceil(screenRect.h / codeLineH) + 1; i++) {
          const lineIdx = (((i + Math.floor(scrollPx / codeLineH)) % CODE_LINES.length) + CODE_LINES.length) % CODE_LINES.length;
          const y = screenRect.y + i * codeLineH - (scrollPx % codeLineH);
          ctx.fillText(CODE_LINES[lineIdx], screenRect.x + 6, y);
        }
        ctx.restore();

        // Keyboard keys flashing as if being typed — same fade window
        // as the code, clipped to the keyboard's own rect.
        if (keyboardRect.w > 4 && keyboardRect.h > 4) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(keyboardRect.x, keyboardRect.y, keyboardRect.w, keyboardRect.h);
          ctx.clip();
          const keyW = keyboardRect.w / KB_COLS, keyH = keyboardRect.h / KB_ROWS;
          for (const k of keys) {
            const t = ((elapsed + k.phaseOffset) % k.period) / k.period;
            // Sharp "key press" pulse — bright for a brief instant,
            // dark the rest of the cycle, not a smooth sine wave.
            const pressed = t < 0.12;
            const kx = keyboardRect.x + k.col * keyW, ky = keyboardRect.y + k.row * keyH;
            ctx.fillStyle = pressed
              ? `rgba(253,230,160,${0.9 * fadeIn * fadeOut})`
              : `rgba(253,164,175,${0.22 * fadeIn * fadeOut})`;
            roundRectPath(ctx, kx + 1.5, ky + 1.5, keyW - 3, keyH - 3, 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [laptopPoints, communityPoints, rocketPoints]);

  return (
    <div className="absolute inset-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at top, #0d0d12 0%, #060608 50%, #000000 100%)' }} />

      {/* Digital rain around the laptop — same footprint as the canvas
          below, lower z-index so it sits behind it, only while the
          laptop stage (and its own code/caption) is on screen. */}
      {showCaption === 'grind' && (
        <div className="absolute inset-x-0 flex items-center justify-center pointer-events-none" style={{ top: '6%', height: '62vh', zIndex: 1 }}>
          <div style={{ width: '96vw', maxWidth: 460, height: '100%', position: 'relative' }}>
            <MatrixRain />
            <FallingWords />
          </div>
        </div>
      )}


      <motion.div
        className="absolute inset-x-0 flex items-center justify-center pointer-events-none"
        style={{ top: '6%', zIndex: 2 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '96vw', maxWidth: 460, height: '62vh', display: 'block',
            // Same cheap single-pass glow technique as the heart banner
            // (CSS drop-shadow on the whole canvas, not per-dot
            // shadowBlur) — applies across every stage of the journey,
            // not just the community scene. One drop-shadow, not two —
            // with the heart + women banners also each applying their
            // own filter during the community scene, stacking doubles
            // everywhere added up to a measurable FPS cost.
            filter: 'drop-shadow(0 0 10px rgba(253,164,175,0.4))',
          }}
        />
      </motion.div>

      {/* Ambient drone-light motes — fills the open black space the
          headline+photo block leaves below it (and around it) instead
          of leaving it plain. Sits above the main canvas but below the
          headline/photo so it doesn't compete with them. */}
      {showCaption === 'build' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2.3 }}>
          <CommunityAmbientGlow />
        </div>
      )}

      {/* Headline + photo, stacked in one flex column instead of two
          independently-guessed absolute top/height boxes — that's what
          produced the bad layout: the headline's box started at
          top:0% (colliding with KissReplayOverlay's top-6/h-10
          mute+close buttons, ~y24-64px) and the photo's box was a
          fixed 62vh tall, far taller than the actual ~2:1 photo it
          centered inside, leaving a dead gap above it and another
          below before the caption. A flex column with a real
          aspect-ratio box for the photo sizes both to their actual
          content and lets the gap between them come from one real
          value instead of two numbers that happened not to collide. */}
      {showCaption === 'build' && (
        <motion.div
          className="absolute inset-x-0 flex flex-col items-center pointer-events-none"
          style={{ top: 'max(9%, 76px)', zIndex: 2.6, gap: '3vh' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div style={{ width: '94vw', maxWidth: 440 }}>
            <CommunityHeadlineText />
          </div>
          <div
            className="flex items-center justify-center"
            style={{
              width: '92vw', maxWidth: 460, aspectRatio: '1622 / 796', borderRadius: 12,
              background: 'radial-gradient(ellipse at center, rgba(13,13,18,0.95) 0%, rgba(6,6,8,0.96) 55%, rgba(0,0,0,0.97) 100%)',
            }}
          >
            <DroneFormedPhoto src="/images/silk-blossom/women-chung-tay.jpg" />
          </div>
        </motion.div>
      )}

      {/* 3D-ish galaxy field — fills the open black space below the
          finale photo, same role CommunityAmbientGlow plays for the
          'build' stage above, just with a cosmic rather than drone-
          light flavor to match this scene's world-map/global theme. */}
      {showCaption === 'pride' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2.3 }}>
          <PrideGalaxyField />
        </div>
      )}

      {/* Headline + photo, same flex-column pattern as the community
          block above (not two independently-guessed absolute boxes —
          see that block's comment for why). The bird flock's own
          reform/flap/flight (still computed above, just skipped at
          draw time) is replaced by a second DroneFormedPhoto, the same
          technique and the same move as the community photo: the
          sender sent an actual drone-show mockup (women + world map +
          lotus + city skyline) and asked for this scene to show it
          directly rather than the procedural bird flock. Pushed down
          by the headline above it instead of sitting right at the top
          edge. */}
      {showCaption === 'pride' && (
        <motion.div
          className="absolute inset-x-0 flex flex-col items-center pointer-events-none"
          style={{ top: 'max(9%, 76px)', zIndex: 2.6, gap: '3vh' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div style={{ width: '94vw', maxWidth: 440 }}>
            <BreakthroughHeadlineText />
          </div>
          <div
            className="flex items-center justify-center"
            style={{
              width: '92vw', maxWidth: 460, aspectRatio: '1672 / 941', borderRadius: 12,
              background: 'radial-gradient(ellipse at center, rgba(13,13,18,0.95) 0%, rgba(6,6,8,0.96) 55%, rgba(0,0,0,0.97) 100%)',
            }}
          >
            <DroneFormedPhoto src="/images/silk-blossom/global-impact.jpg" />
          </div>
        </motion.div>
      )}

      {/* Pinned near the bottom for 'grind' only: 'build' and 'pride'
          each show a photo above (see both blocks above) that only
          reaches about a third of the way down the screen (capped by
          its own wide aspect ratio — making it wider doesn't make it
          much taller), so anchoring the caption at the same bottom-8%
          every stage used left a large empty gap below the photo.
          Pulling those two stages' captions up closes most of that gap
          directly, instead of trying to visually fill a gap that
          didn't need to be that big in the first place. */}
      <div
        className="absolute inset-x-0 flex flex-col items-center px-8 text-center gap-5"
        style={{ bottom: showCaption === 'build' || showCaption === 'pride' ? '32%' : '8%' }}
      >
        <AnimatePresence mode="wait">
          {showCaption === 'grind' && (
            <motion.div
              key="grind"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.6 }}
              className="text-xs sm:text-sm italic leading-relaxed max-w-[310px] sm:max-w-[420px]"
              style={{ color: '#fbcfe8', fontFamily: 'Georgia, serif' }}
            >
              Mỗi dòng code bắt đầu từ một ý tưởng nhỏ, mỗi đêm thức khuya là một
              bước tiến thầm lặng. Đây là nơi những người phụ nữ yêu công nghệ cùng
              nhau học hỏi, cùng nhau xây dựng, và cùng nhau tin rằng giấc mơ của
              mình hoàn toàn có thể trở thành hiện thực.
            </motion.div>
          )}
          {showCaption === 'build' && (
            <motion.div
              key="build"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.6 }}
              className="text-xs sm:text-sm italic leading-relaxed max-w-[310px] sm:max-w-[420px]"
              style={{ color: '#fbcfe8', fontFamily: 'Georgia, serif' }}
            >
              Chúng ta không chỉ gặp nhau để học hỏi. Chúng ta gặp nhau để cùng xây dựng.
              Để mỗi ý tưởng có nơi bắt đầu, mỗi tài năng có cơ hội phát triển và mỗi người
              đều biết rằng tiếng nói của mình có giá trị.
            </motion.div>
          )}
          {showCaption === 'pride' && (
            <motion.div
              key="pride"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.6 }}
              className="text-xs sm:text-sm italic leading-relaxed max-w-[310px] sm:max-w-[420px]"
              style={{ color: '#fbcfe8', fontFamily: 'Georgia, serif' }}
            >
              Chúng ta không chỉ cùng nhau bước đi. Chúng ta cùng nhau đưa hình ảnh
              người phụ nữ Việt Nam vươn ra thế giới. Để mỗi bước chân đều để lại dấu ấn,
              mỗi câu chuyện đều truyền cảm hứng, và năm châu đều biết đến vẻ đẹp kiên
              cường ấy.
            </motion.div>
          )}
        </AnimatePresence>

        {showButton && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            onClick={onDone}
            className="rounded-xl px-6 py-3 text-sm font-bold cursor-pointer"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #fbbf24)`, color: '#fff', boxShadow: `0 4px 20px ${ACCENT}66` }}
          >
            Tiếp tục →
          </motion.button>
        )}
      </div>
    </div>
  );
}

export default function SilkBlossomReveal({ kiss, currentUserId, onClose, onSendBack }: TemplateProps) {
  const [phase, setPhase] = useState<Phase>('curtain');
  const senderName = kiss.sender_name || 'Someone';
  const receiverName = currentUserId === kiss.receiver_id ? 'You' : (kiss.receiver_name || 'Recipient');
  const canSendBack = currentUserId === kiss.receiver_id && !!onSendBack;

  const photos: string[] = useMemo(() => {
    try { return kiss.photos ? JSON.parse(kiss.photos) : []; } catch { return []; }
  }, [kiss.photos]);

  // Stable per-mount seed so petals/ribbons don't reshuffle every render.
  const petals = useMemo(() => Array.from({ length: PETAL_COUNT }, (_, i) => ({
    emoji: PETALS[i % PETALS.length],
    left: `${(i * 31 + 7) % 100}%`,
    delay: (i * 0.17) % 3.5,
    duration: 6 + ((i * 7) % 8) * 0.5,
    drift: ((i * 19) % 180) - 90,
    size: 18 + ((i * 5) % 20),
    rot: ((i * 37) % 540) - 270,
  })), []);

  // Soft silk-ribbon light streaks — evokes áo dài fabric flowing
  // without drawing a literal figure (kept abstract on purpose).
  const ribbons = useMemo(() => Array.from({ length: 3 }, (_, i) => ({
    top: `${18 + i * 28}%`,
    duration: 9 + i * 2.5,
    delay: i * 0.8,
    rot: -14 + i * 9,
  })), []);

  return (
    <TemplateShell
      sender={{ name: senderName, avatarUrl: kiss.sender_avatar }}
      receiver={{ name: receiverName, avatarUrl: kiss.receiver_avatar }}
      onClose={onClose}
      accent={ACCENT}
      // KissReplayOverlay already renders a top-right mute+close pair
      // above every template — this shell's own X sat right on top of
      // it, reading as two X's (see TemplateShell's own doc comment).
      showCloseButton={false}
      backdrop={
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at top, #fda4af 0%, #be123c 45%, #4a041a 100%)' }} />
      }
    >
      {/* No mode="wait" here on purpose — each phase draws its own
          opaque backdrop, and the next phase needs to mount and paint
          immediately (on top, since it's later in this JSX) so it
          covers the previous phase's backdrop as it fades out.
          mode="wait" delays mounting until the exit finishes, so for
          that ~0.6s only the exiting phase (fading toward transparent)
          is on screen, bleeding through to TemplateShell's own rose-red
          backdrop underneath — a brief red flash on every transition. */}
      <AnimatePresence>
        {phase === 'curtain' && (
          <motion.div key="curtain" className="absolute inset-0" exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <Curtain onDone={() => setPhase('breakthrough')} />
          </motion.div>
        )}

        {phase === 'breakthrough' && (
          <motion.div key="breakthrough" className="absolute inset-0" exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <DroneBreakthrough onDone={() => setPhase('main')} />
          </motion.div>
        )}

        {phase === 'main' && (
          <motion.div key="main" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
            {/* Flowing silk ribbons — thin blurred gradient streaks drifting slowly */}
            {ribbons.map((r, i) => (
              <motion.div
                key={`ribbon-${i}`}
                className="absolute left-[-20%] pointer-events-none"
                style={{
                  top: r.top, width: '140%', height: 3, borderRadius: 999,
                  background: `linear-gradient(90deg, transparent, ${ACCENT}00, #fde68a99, ${ACCENT}88, transparent)`,
                  filter: 'blur(3px)', transform: `rotate(${r.rot}deg)`,
                }}
                initial={{ x: '-10%', opacity: 0 }}
                animate={{ x: ['-10%', '6%', '-10%'], opacity: [0, 0.8, 0.8, 0] }}
                transition={{ duration: r.duration, delay: r.delay, repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}

            {/* Falling petals — hibiscus, cherry blossom, tulip mixed like a bouquet */}
            {petals.map((p, i) => (
              <motion.span
                key={i}
                className="absolute pointer-events-none select-none"
                style={{ left: p.left, top: `-${p.size}px`, fontSize: p.size }}
                initial={{ y: 0, x: 0, rotate: 0, opacity: 0 }}
                animate={{ y: '110vh', x: p.drift, rotate: p.rot, opacity: [0, 1, 1, 0.85, 0] }}
                transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, repeatDelay: 0.3, ease: 'linear' }}
              >
                {p.emoji}
              </motion.span>
            ))}

            {/* Center card */}
            <div className="absolute inset-0 flex items-center justify-center px-6 py-12 overflow-y-auto">
              <motion.div
                initial={{ scale: 0.9, opacity: 0, rotateX: -12 }}
                animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-full max-w-md rounded-2xl overflow-visible pointer-events-auto my-auto"
                style={{
                  background: 'linear-gradient(180deg, rgba(40,10,20,0.92) 0%, rgba(20,5,12,0.95) 100%)',
                  border: `1px solid ${ACCENT}55`,
                  boxShadow: `0 20px 80px ${ACCENT}55, 0 0 40px rgba(253,164,175,0.25)`,
                  backdropFilter: 'blur(20px)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Top accent bar — rose to gold, nodding to áo dài silk */}
                <div className="h-1 w-full rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${ACCENT}, #fbbf24, ${ACCENT})` }} />

                <div className="p-6 flex flex-col items-center text-center">
                  <SenderSignature
                    name={senderName}
                    avatarUrl={kiss.sender_avatar}
                    shape="round"
                    accent={ACCENT}
                    size={88}
                    caption="gửi lời chúc 20/10 🌺"
                  />

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.1, duration: 0.5 }}
                    className="mt-5"
                  >
                    <div className="text-[9px] uppercase tracking-[0.4em] font-bold" style={{ color: ACCENT }}>
                      20 Tháng 10
                    </div>
                    <div className="text-lg font-bold text-white mt-1" style={{ fontFamily: 'Georgia, serif' }}>
                      Chúc Mừng Ngày Phụ Nữ Việt Nam
                    </div>
                  </motion.div>

                  {kiss.message && (
                    <div className="w-full mt-3">
                      <HandwrittenNote
                        message={kiss.message}
                        senderName={senderName}
                        accent={ACCENT}
                        signOff="Trân trọng"
                        delay={1.4}
                      />
                    </div>
                  )}

                  <PolaroidStack photos={photos} delay={1.7} caption={senderName} />

                  {typeof kiss.open_count === 'number' && typeof kiss.max_opens === 'number' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 2.0, duration: 0.4 }}
                      className="mt-4 flex items-center gap-1.5 text-[9px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: `${ACCENT}25`, color: '#fda4af', border: `1px solid ${ACCENT}55` }}
                    >
                      <span>🌺</span>
                      <span>Opened {kiss.open_count} / {kiss.max_opens} times</span>
                    </motion.div>
                  )}

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2.2, duration: 0.5 }}
                    className="mt-6 flex items-center gap-2"
                  >
                    {canSendBack && onSendBack ? (
                      <button
                        onClick={() => { onSendBack(kiss.sender_id); onClose(); }}
                        className="rounded-xl px-6 py-3 text-sm font-bold cursor-pointer transition-transform active:scale-95"
                        style={{ background: `linear-gradient(135deg, ${ACCENT}, #fbbf24)`, color: '#fff', boxShadow: `0 4px 20px ${ACCENT}66` }}
                      >
                        🌺 Gửi Lại Lời Chúc
                      </button>
                    ) : (
                      <button onClick={onClose} className="rounded-xl px-6 py-3 text-sm font-semibold cursor-pointer" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}>
                        Close
                      </button>
                    )}
                  </motion.div>
                </div>

                <div className="border-t px-6 py-3 flex items-center justify-between" style={{ borderColor: `${ACCENT}22` }}>
                  <div className="text-[8px] uppercase tracking-widest text-white/40">Delivered via Gao</div>
                  <div className="text-[9px] italic font-bold" style={{ color: ACCENT, fontFamily: 'Georgia, serif' }}>— {senderName}</div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </TemplateShell>
  );
}
