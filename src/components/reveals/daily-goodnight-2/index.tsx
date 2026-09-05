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
// DroneShowCanvas — a real drone-show simulation, canvas-rendered (not
// individual DOM nodes): hundreds of glowing points launch from the
// ground, climb with a gentle wobble, and settle into a heart-shaped
// pair of hands plus the greeting text sampled from an offscreen canvas
// (same technique real drone-show visualizers use — rasterize the target
// shape, sample its opaque pixels, animate points toward each sample).
// ─────────────────────────────────────────────────────────────────────
const GALAXY_SPIN_S = 3.2; // grand 3D-spinning galaxy act, before the heart forms
const GALAXY_ARMS = 3;
const GALAXY_STAR_COUNT = 220;

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

type Drone = {
  x: number; y: number; tx: number; ty: number;
  hue: 'gold' | 'rose'; phase: number; size: number; delay: number;
};

/** Sample the opaque pixels of an offscreen canvas drawing (text/shape)
 * into a scattered point cloud — real drone-show software rasterizes
 * the target artwork the same way, then assigns one drone per sample. */
function samplePoints(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  w: number,
  h: number,
  step: number,
): { x: number; y: number }[] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.floor(w));
  c.height = Math.max(1, Math.floor(h));
  const ctx = c.getContext('2d');
  if (!ctx) return [];
  draw(ctx, c.width, c.height);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  const pts: { x: number; y: number }[] = [];
  for (let y = 0; y < c.height; y += step) {
    for (let x = 0; x < c.width; x += step) {
      const a = data[(y * c.width + x) * 4 + 3] ?? 0;
      if (a > 128) pts.push({ x: x + (Math.random() - 0.5) * 1.5, y: y + (Math.random() - 0.5) * 1.5 });
    }
  }
  return pts;
}

/** Heart formed by two hands closing together, mirrored — traced from
 * the drone-show reference photo (back-of-hand outer edge, knuckle/top
 * curve, scalloped finger waves, thumb crease, forearm angling away). */
function drawHandsHeart(c: CanvasRenderingContext2D, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const S = Math.min(w / 100, h / 100);
  c.translate((w - 100 * S) / 2, (h - 100 * S) / 2);
  c.scale(S, S);
  c.strokeStyle = '#fff';
  c.fillStyle = '#fff';
  c.lineCap = 'round';
  c.lineJoin = 'round';

  const half = (dir: 1 | -1) => {
    c.save();
    c.translate(50, 0);
    c.scale(dir, 1);

    c.beginPath();
    c.moveTo(0, 92);
    c.bezierCurveTo(-16, 76, -34, 62, -44, 46);
    c.bezierCurveTo(-54, 28, -44, 10, -28, 10);
    c.bezierCurveTo(-16, 10, -8, 18, -2, 28);
    c.lineTo(-2, 34);
    c.bezierCurveTo(-10, 30, -18, 34, -20, 44);
    c.bezierCurveTo(-14, 52, -8, 66, 0, 80);
    c.closePath();
    c.globalAlpha = 0.22;
    c.fill();
    c.globalAlpha = 1;
    c.lineWidth = 2.4;
    c.stroke();

    c.lineWidth = 1.3;
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      c.beginPath();
      c.moveTo(-44 + t * 8, 44 - t * 12);
      c.bezierCurveTo(-36 + t * 10, 26 - t * 8, -22 + t * 8, 16 + t * 4, -8 - t * 4, 24 + t * 10);
      c.stroke();
    }

    c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(-18, 44);
    c.bezierCurveTo(-12, 56, -6, 68, -1, 80);
    c.stroke();

    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-40, 50);
    c.bezierCurveTo(-48, 66, -54, 80, -58, 98);
    c.stroke();
    c.restore();
  };
  half(1);
  half(-1);
}

function DroneShowCanvas({ text }: { text: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let drones: Drone[] = [];
    let W = 0;
    let H = 0;

    const build = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const heartH = H * 0.5;
      const heartW = Math.min(W * 0.7, heartH * 1.15);
      const step = W < 520 ? 5 : 6;

      const heartPts = samplePoints(drawHandsHeart, heartW, heartH, step).map((p) => ({
        x: p.x + (W - heartW) / 2,
        y: p.y + H * 0.03,
        heart: true,
      }));

      // Bigger relative to screen height on narrow phones — otherwise the
      // fixed-width text budget forces the font small to fit a long
      // phrase on a narrow viewport.
      const textH = H * (W < 520 ? 0.27 : 0.16);
      const textPts = samplePoints(
        (c, w, h) => {
          c.clearRect(0, 0, w, h);
          let size = Math.floor(h * 0.88);
          c.textBaseline = 'middle';
          c.textAlign = 'center';
          c.fillStyle = '#fff';
          do {
            c.font = `700 ${size}px ${FONT_HERO}`;
            if (c.measureText(text).width <= w * 0.98) break;
            size -= 2;
          } while (size > 8);
          c.fillText(text, w / 2, h / 2);
        },
        W * 0.98,
        textH,
        W < 520 ? 3 : 4,
      ).map((p) => ({ x: p.x + W * 0.01, y: p.y + H * (W < 520 ? 0.56 : 0.62), heart: false }));

      // Drones wait out the galaxy-spin act (see GalaxyBackdrop) before
      // launching, so the formation reads as "the galaxy settles, THEN
      // the drones take off" rather than both happening at once.
      const startOffset = GALAXY_SPIN_S - 0.4;
      const targets = [...heartPts, ...textPts];
      drones = targets.map((t, i) => ({
        x: W / 2 + (Math.random() - 0.5) * W,
        y: H + Math.random() * H * 0.5,
        tx: t.x,
        ty: t.y,
        hue: t.heart ? 'rose' : 'gold',
        phase: Math.random() * Math.PI * 2,
        size: t.heart ? 1.6 : 1.4,
        delay: startOffset + (t.heart ? 0 : 0.35) + (i % 40) * 0.004 + Math.random() * 0.25,
      }));
    };

    build();
    const onResize = () => build();
    window.addEventListener('resize', onResize);

    const start = performance.now();
    const loop = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (const d of drones) {
        const k = Math.min(1, Math.max(0, (t - d.delay) / 2.2));
        const e = 1 - (1 - k) ** 3;
        const wobble = Math.sin(t * 1.6 + d.phase) * (1 - e * 0.85) * 10;
        const x = d.x + (d.tx - d.x) * e + wobble;
        const y = d.y + (d.ty - d.y) * e + Math.cos(t * 1.4 + d.phase) * (1 - e) * 8;

        const twinkle = 0.8 + 0.2 * Math.sin(t * 3 + d.phase);
        // Capped well under 1 and the glow kept small — hundreds of these
        // sit close together in the heart/text shapes, and with additive
        // ("lighter") blending, glows that are too big or too bright pile
        // up into a single blown-out white blob instead of reading as
        // individual points of light.
        const alpha = Math.min(0.8, k * 1.1) * twinkle;
        if (alpha <= 0.004) continue;
        const r = d.size;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        const col = d.hue === 'gold' ? '255,244,214' : '255,120,150';
        g.addColorStop(0, `rgba(255,255,255,${alpha * 0.9})`);
        g.addColorStop(0.35, `rgba(${col},${alpha * 0.5})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.95, alpha * 1.15)})`;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [text]);

  return <canvas ref={canvasRef} className="size-full" aria-hidden />;
}

// ─────────────────────────────────────────────────────────────────────
// MatrixRain — classic "hacker screen" digital rain, but the falling
// columns spell out romantic phrases instead of random glyphs. Sits
// behind the mailbox tap prompt as the drone canvas fades out.
// ─────────────────────────────────────────────────────────────────────
const FONT_MONO = "'JetBrains Mono', 'Courier New', ui-monospace, monospace";

function MatrixRain({ phrases }: { phrases: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phrasesRef = useRef(phrases);
  useEffect(() => {
    phrasesRef.current = phrases;
  }, [phrases]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const fontSize = 18;
    const colWidth = fontSize * 1.15;
    const colLen = 30;
    let columns: { chars: string[]; y: number; speed: number; hue: 'gold' | 'rose' }[] = [];
    // A handful of whole phrases sliding sideways across the screen —
    // mixed in with the vertical rain for "có chữ ngang có chữ dọc".
    let hRows: { y: number; x: number; dir: 1 | -1; speed: number; text: string; hue: 'gold' | 'rose' }[] = [];
    let W = 0;
    let H = 0;

    // Each column spells out one whole phrase, repeating — legible as it
    // scrolls by, instead of fully random unreadable glyphs.
    const pickPhrase = () => {
      const list = phrasesRef.current;
      return (list[Math.floor(Math.random() * list.length)] || 'YÊU EM').replace(/\s+/g, ' ').trim();
    };
    const pickChars = () => {
      const phrase = pickPhrase();
      return Array.from({ length: colLen }, (_, k) => phrase[k % phrase.length] || ' ');
    };

    const build = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Resizing the canvas resets all context state (font, alignment),
      // so these need reapplying here, not just once before the loop.
      ctx.textAlign = 'center';
      ctx.font = `700 ${fontSize}px ${FONT_MONO}`;

      const count = Math.ceil(W / colWidth);
      columns = Array.from({ length: count }, (_, i) => ({
        chars: pickChars(),
        y: -Math.random() * H,
        // True Matrix pace — fast enough that it reads as a cascade,
        // not a slow drift.
        speed: 170 + Math.random() * 160,
        hue: i % 3 === 0 ? 'rose' : 'gold',
      }));

      const rowCount = Math.max(3, Math.round(H / 220));
      hRows = Array.from({ length: rowCount }, (_, i) => {
        const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
        return {
          y: (H / (rowCount + 1)) * (i + 1),
          x: dir === 1 ? -Math.random() * W : W + Math.random() * W,
          dir,
          speed: 90 + Math.random() * 70,
          text: pickPhrase(),
          hue: i % 2 === 0 ? 'gold' : 'rose',
        };
      });
    };

    build();
    const onResize = () => build();
    window.addEventListener('resize', onResize);

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Faded clear (not a full wipe) leaves the classic trailing streak
      // behind each falling column — kept short and strongly faded so
      // the letters stay crisp instead of smearing into a blur.
      ctx.fillStyle = 'rgba(2,2,18,0.4)';
      ctx.fillRect(0, 0, W, H);

      columns.forEach((col, i) => {
        col.y += col.speed * dt;
        if (col.y > H + col.chars.length * fontSize) {
          col.y = -Math.random() * H * 0.6;
          col.chars = pickChars();
          col.hue = Math.random() < 0.3 ? 'rose' : 'gold';
        }
        const x = i * colWidth + colWidth / 2;
        col.chars.forEach((ch, j) => {
          const y = col.y - j * fontSize;
          if (y < -fontSize || y > H + fontSize) return;
          // Leading character bright white, the trail fades warm gold/rose.
          if (j === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
          } else {
            const fade = Math.max(0, 1 - j / col.chars.length);
            const col2 = col.hue === 'gold' ? '255,244,214' : '255,140,170';
            ctx.fillStyle = `rgba(${col2},${Math.min(0.7, fade * 0.75)})`;
          }
          ctx.fillText(ch, x, y);
        });
      });

      const prevAlign = ctx.textAlign;
      ctx.textAlign = 'left';
      hRows.forEach((row) => {
        row.x += row.dir * row.speed * dt;
        const textW = ctx.measureText(row.text).width;
        if (row.dir === 1 && row.x > W) {
          row.x = -textW - Math.random() * W * 0.4;
          row.text = pickPhrase();
        } else if (row.dir === -1 && row.x < -textW) {
          row.x = W + Math.random() * W * 0.4;
          row.text = pickPhrase();
        }
        const col2 = row.hue === 'gold' ? '255,244,214' : '255,140,170';
        ctx.fillStyle = `rgba(${col2},0.55)`;
        ctx.fillText(row.text, row.x, row.y);
      });
      ctx.textAlign = prevAlign;

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="size-full" aria-hidden />;
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
// galaxy spin → heart+text drone formation, held a beat, then the
// mailbox phase takes over (Matrix-style falling text + tap prompt).
const DRONE_FINALE_MS = 6600;

function DailyGoodnight2Reveal({ kiss, onClose }: TemplateProps) {
  const rawName = (getKissString(kiss, 'name') || kiss.receiver_name || 'em').trim();
  const displayName = rawName || 'em';

  // All uploaded photos — photo 1 becomes the heart puzzle; the final
  // message screen shows every photo the sender uploaded (just the one,
  // if that's all there is).
  const allPhotos = useMemo(() => {
    const raw = parseKissData(kiss).photos;
    const list = Array.isArray(raw) ? raw.filter((u): u is string => typeof u === 'string' && !!u) : [];
    if (list.length > 0) return list;
    const single = getKissString(kiss, 'photo') || kiss.sender_avatar;
    return single ? [single] : [DEFAULT_PUZZLE_IMG];
  }, [kiss]);
  const photoUrl = allPhotos[0];

  // 'mailbox' sits between the drone show and the actual message — the
  // wish only appears once the player taps to open it, instead of just
  // auto-revealing after the animation, so opening it feels earned.
  const [phase, setPhase] = useState<'puzzle' | 'drone' | 'mailbox' | 'final'>('puzzle');

  const handleSolved = useCallback(() => {
    setPhase((p) => (p === 'puzzle' ? 'drone' : p));
    playHeartbeat();
    setTimeout(() => playCelebration(), 300);
    setTimeout(() => setPhase((p) => (p === 'drone' ? 'mailbox' : p)), DRONE_FINALE_MS);
  }, []);

  const openMailbox = useCallback(() => {
    setPhase((p) => (p === 'mailbox' ? 'final' : p));
    playMessageChime();
    setTimeout(() => onClose(), 9000);
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

      {/* ── Drone-show finale: full-screen 3D galaxy spin, then the drones
          climb into a heart + greeting and hold — plays AFTER the puzzle
          is solved, then hands off to the mailbox phase below. ── */}
      <AnimatePresence>
        {phase === 'drone' && (
          <motion.div key="drone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 1 }}>
            <div className="pointer-events-none absolute inset-0 z-30">
              <GalaxyBackdrop />
            </div>
            <div className="pointer-events-none absolute inset-0 z-30">
              <DroneShowCanvas text={`CHÚC ${displayName.toLocaleUpperCase('vi')} NGỦ NGON`} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mailbox — a "hacker screen" of falling text (em ngủ ngon /
          yêu em / I love you) behind a tap-to-open envelope icon ── */}
      <AnimatePresence>
        {phase === 'mailbox' && (
          <motion.div
            key="mailbox"
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 px-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="pointer-events-none absolute inset-0">
              <MatrixRain phrases={[displayName.toLocaleUpperCase('vi'), 'EM NGỦ NGON', 'YÊU EM', 'I LOVE YOU']} />
            </div>
            <motion.button
              type="button"
              onClick={openMailbox}
              className="relative cursor-pointer"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Mở hộp thư để xem lời chúc"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                style={{ filter: `drop-shadow(0 0 18px ${MOON_MID}99)` }}
              >
                <svg width="84" height="84" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="2" y="6" width="20" height="14" rx="2.5" fill={MOON_MID} fillOpacity="0.16" stroke={MOON_MID} strokeWidth="1.4" />
                  <path d="M2.5 7 L12 14 L21.5 7" stroke={MOON_MID} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  <circle cx="12" cy="13" r="2.6" fill={HEART} stroke="#fff" strokeWidth="0.8" />
                </svg>
              </motion.div>
            </motion.button>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.85 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="relative pointer-events-none"
              style={{
                fontFamily: FONT_WHISPER,
                fontStyle: 'italic',
                fontSize: 'clamp(14px, 2.4vw, 18px)',
                color: 'rgba(255,255,255,0.85)',
                textShadow: '0 2px 10px rgba(0,0,0,0.7)',
              }}
            >
              Chạm để mở hộp thư
            </motion.p>
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
            {/* Photo 1 became the heart puzzle — here every uploaded photo
                shows up (just the one, if that's all the sender added). */}
            <motion.div
              className="mx-auto mt-4 flex justify-center gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              {allPhotos.slice(0, 2).map((url, i) => (
                <div
                  key={url + i}
                  className="overflow-hidden rounded-lg border-[3px] border-white bg-white shadow-[0_6px_18px_rgba(0,0,0,0.5)]"
                  style={{
                    width: allPhotos.length > 1 ? 92 : 128,
                    height: allPhotos.length > 1 ? 92 : 128,
                    transform: `rotate(${i === 0 ? -4 : 4}deg)`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              ))}
            </motion.div>
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
