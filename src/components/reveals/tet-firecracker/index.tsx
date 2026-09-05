'use client';

// Firecrackers & Lanterns — a night sky filled with rising fireworks,
// and a couple silhouette (backs to camera, close together) watching
// them burst upward. The password gate itself is handled upstream by
// KissReplayOverlay's generic PasswordLock (reads template_data.password),
// not here.
//
// The drone formation itself has 2 stages: a sparkling heart first,
// then it morphs in place into a waving banner ribbon carrying a
// greeting — echoing a real drone-show reference (a figure + a flag
// banner with text) without the figure, per explicit request.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getKissString, parseKissData } from '../_shared/useTemplateData';
import type { TemplateProps, TemplateConfig } from '../_types';

type Pt = { x: number; y: number; color?: string };

// ─────────────────────────────────────────────────────────────────────
// A sparkling drone-formed heart — drawn from the parametric heart
// curve (not an emoji glyph: 🎆 was found to render as a missing-glyph
// box in some environments, so shapes that matter are built from canvas
// primitives instead of relying on emoji-font coverage) and filled, so
// it samples as a solid glittering heart rather than just an outline.
// ─────────────────────────────────────────────────────────────────────
function sampleHeartComposite(): Pt[] {
  if (typeof document === 'undefined') return [];
  const W = 600, H = 600;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  const scale = 17, cx = W / 2, cy = H / 2 + 30;
  for (let i = 0; i <= 100; i++) {
    const t = (i / 100) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const px = cx + x * scale, py = cy - y * scale;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: Pt[] = [];
  const stride = 3;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        const nx = (x / W - 0.5) * 2;
        const ny = (y / H - 0.5) * 2;
        const m = (x + y) % 7;
        const color = m < 3 ? '#fecaca' : m < 6 ? '#f87171' : '#dc2626';
        pts.push({ x: nx, y: ny, color });
      }
    }
  }
  return pts;
}

// ─────────────────────────────────────────────────────────────────────
// A flowing banner ribbon — outline (stroked) with curled ends, plus a
// line of text sampled (filled) on top so the ribbon reads as carrying
// a message, echoing the drone-show reference's waving flag + caption.
// ─────────────────────────────────────────────────────────────────────
function sampleBannerOutline(line: string): Pt[] {
  if (typeof document === 'undefined') return [];
  const W = 1000, H = 380;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const midY = H / 2;
  const amp = 22, waveLen = W - 140;
  const topY = (x: number) => midY - 55 + Math.sin(((x - 70) / waveLen) * Math.PI * 2) * amp;
  const botY = (x: number) => midY + 55 + Math.sin(((x - 70) / waveLen) * Math.PI * 2) * amp;

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // ribbon band — top edge left→right, then bottom edge right→left,
  // closing into one wavy loop
  ctx.beginPath();
  for (let x = 70; x <= W - 70; x += 8) {
    const y = topY(x);
    if (x === 70) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  for (let x = W - 70; x >= 70; x -= 8) {
    ctx.lineTo(x, botY(x));
  }
  ctx.closePath();
  ctx.stroke();

  // curled ends, like a flag/scroll rolling up on each side
  ctx.beginPath();
  ctx.arc(70, midY, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W - 70, midY, 26, 0, Math.PI * 2);
  ctx.stroke();

  // the message, filled (solid), sized to fit inside the ribbon band
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 80;
  ctx.font = `800 ${size}px "Inter", "Segoe UI", sans-serif`;
  while (ctx.measureText(line).width > W * 0.72 && size > 20) {
    size -= 3;
    ctx.font = `800 ${size}px "Inter", "Segoe UI", sans-serif`;
  }
  ctx.fillText(line, W / 2, midY);

  const { data } = ctx.getImageData(0, 0, W, H);
  const pts: Pt[] = [];
  const stride = 2;
  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        const nx = (x / W - 0.5) * 2;
        const ny = (y / H - 0.5) * 2;
        const m = (x + y) % 5;
        const color = m < 2 ? '#fecaca' : m < 4 ? '#fde68a' : '#fbbf24';
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

const HEART_DOT_COUNT = 3400;
const HEART_ENTRANCE_MS = 1600;
const BANNER_STAGE_DELAY_MS = 4500;
const STAGE_MORPH_MS = 1300;

// Heart → flowing banner, in place. Stage 0 is the sparkling heart
// (entrance from scattered points); stage 1 morphs the SAME formation
// into a waving banner ribbon carrying a message, echoing the
// drone-show reference's flag + caption.
function DroneHeartThenBanner({ text }: { text: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stage, setStage] = useState<0 | 1>(0);
  const stageRef = useRef(stage);
  useEffect(() => { stageRef.current = stage; }, [stage]);

  useEffect(() => {
    const t = window.setTimeout(() => setStage(1), BANNER_STAGE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  const pointSets = useMemo(() => ([
    packToCount(sampleHeartComposite(), HEART_DOT_COUNT),
    packToCount(sampleBannerOutline(text), HEART_DOT_COUNT),
  ]), [text]);

  const framing = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const set of pointSets) {
      for (const p of set) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      }
    }
    const spanX = Math.max(0.01, maxX - minX), spanY = Math.max(0.01, maxY - minY);
    return { midX: (minX + maxX) / 2, midY: (minY + maxY) / 2, spanX, spanY };
  }, [pointSets]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || pointSets[0].length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = W / 2, cy = H / 2;
    const { midX, midY, spanX, spanY } = framing;
    const scale = Math.min(W / spanX, H / spanY) * 0.92;

    type Dot = { x: number; y: number; fromX: number; fromY: number; color: string; size: number; twinkle: number; morphStart: number; delay: number };
    const initial = pointSets[0];
    const dots: Dot[] = initial.map(p => {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.min(W, H) * (0.7 + Math.random() * 0.9);
      const scatterX = cx + Math.cos(angle) * dist, scatterY = cy + Math.sin(angle) * dist;
      return {
        x: scatterX, y: scatterY, fromX: scatterX, fromY: scatterY,
        color: p.color || '#f87171', size: 1.2 + Math.random() * 1.4,
        twinkle: Math.random() * Math.PI * 2, delay: Math.random() * 500,
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
          const np = pointSets[currentStage][i];
          if (np?.color) dots[i].color = np.color;
        }
        lastRenderStage = currentStage;
      }

      // Full clear every frame — a partial fade accumulates brightness
      // on a held shape until it washes out illegible (bug found +
      // fixed the same way across the other drone-light templates).
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      const targetSet = pointSets[currentStage];
      const morphMs = currentStage === 0 ? HEART_ENTRANCE_MS : STAGE_MORPH_MS;
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const tp = targetSet[i];
        const tx = cx + (tp.x - midX) * scale, ty = cy + (tp.y - midY) * scale;
        const elapsed = Math.max(0, now - d.morphStart - d.delay);
        const t = Math.min(1, elapsed / morphMs);
        const eased = 1 - Math.pow(1 - t, 3);
        // Chaotic swirl during the heart's entrance only — the dots
        // wander/wobble as they fly in, settling down as they approach
        // the target instead of moving in one flat straight line.
        const swirl = currentStage === 0 ? (1 - eased) * 46 : 0;
        const wobbleX = swirl * Math.sin(now / 140 + d.twinkle * 3.1);
        const wobbleY = swirl * Math.cos(now / 160 + d.twinkle * 2.3);
        d.x = d.fromX + (tx - d.fromX) * eased + wobbleX;
        d.y = d.fromY + (ty - d.fromY) * eased + wobbleY;

        const tw = 0.75 + 0.4 * Math.sin(now / 220 + d.twinkle);
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
    const syncInterval = window.setInterval(() => { currentStage = stageRef.current; }, 100);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(syncInterval);
    };
  }, [pointSets, framing]);

  return (
    <motion.div
      style={{ position: 'relative', transformOrigin: '50% 50%' }}
      animate={stage === 1 ? { rotate: [-2, 2, -2] } : { rotate: 0 }}
      transition={stage === 1 ? { duration: 5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.6 }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '94vw', maxWidth: 420, height: '94vw', maxHeight: 420, display: 'block' }}
      />
    </motion.div>
  );
}

function TetFirecrackerReveal({ kiss, onClose }: TemplateProps) {
  const rawName = (getKissString(kiss, 'name') || kiss.receiver_name || '').trim();
  const photos: string[] = (() => {
    const raw = parseKissData(kiss).photos;
    if (Array.isArray(raw)) {
      const list = raw.filter((u): u is string => typeof u === 'string' && !!u);
      if (list.length > 0) return list.slice(0, 2);
    }
    const single = getKissString(kiss, 'photo');
    return single ? [single] : [];
  })();

  const [showNote, setShowNote] = useState(false);
  const [messageSeen, setMessageSeen] = useState(false);
  const openMessage = () => { setShowNote(true); setMessageSeen(true); };
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (kiss.message && !messageSeen) return;
    const t = window.setTimeout(() => onClose?.(), 16000);
    return () => window.clearTimeout(t);
  }, [kiss.message, messageSeen, onClose]);

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

  // Fireworks — red/gold/orange, rising and bursting continuously.
  const fireworks = useMemo(() => {
    const COLORS = ['#ef4444', '#fbbf24', '#f97316', '#fde047', '#dc2626', '#fff', '#fb923c'];
    const TYPES = ['peony', 'peony', 'crackle', 'peony', 'willow', 'crackle'] as const;
    return Array.from({ length: 12 }).map((_, i) => {
      const s = ((i + 900) * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      const period = 2.6 + r(1) * 2.2;
      const scale = 0.7 + r(7) * 0.7;
      return {
        x: 6 + r(2) * 88,
        y: 6 + r(3) * 50,
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

  return (
    <div
      className="fixed inset-0 z-200 overflow-hidden select-none"
      style={{ background: 'linear-gradient(180deg, #050103 0%, #0d0305 45%, #200608 75%, #3a0a0a 100%)', fontFamily: "'Playfair Display', Georgia, serif" }}
      onClick={() => {
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

      {/* ── FIREWORKS — rise from the ground and burst overhead ── */}
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

      {/* ── DRONE FORMATION — sparkling heart, then morphs into a
             waving banner carrying a greeting ── */}
      <motion.div
        className="absolute inset-x-0 flex justify-center pointer-events-none"
        style={{ top: '24%', zIndex: 4 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.8 }}
      >
        <DroneHeartThenBanner text="I LOVE YOU" />
      </motion.div>

      {/* ── COUPLE SILHOUETTE — backs to camera, close together,
             watching the fireworks burst overhead. Stylised (not the
             sender's own photos, per established preference). ── */}
      <motion.div
        className="absolute inset-x-0 flex justify-center pointer-events-none"
        style={{ bottom: 0, height: '42%', zIndex: 6 }}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.4, delay: 0.6, ease: 'easeOut' }}
      >
        <div
          className="absolute"
          style={{
            bottom: '4%', width: 260, height: 200,
            background: 'radial-gradient(ellipse at center, rgba(253,230,138,0.32) 0%, rgba(251,146,60,0.14) 45%, transparent 75%)',
          }}
        />
        <svg
          viewBox="0 0 300 200"
          width="80vw"
          style={{ maxWidth: 440, display: 'block' }}
          preserveAspectRatio="xMidYMax meet"
        >
          <path
            d="M118,78 C126,68 138,68 148,78 C152,82 150,90 145,88 C136,80 126,80 120,87 C115,91 112,83 118,78 Z"
            fill="#04010a"
          />
          <path
            d="M62,52 C44,52 34,68 35,90 C36,118 42,150 52,200 L104,200 C112,150 116,118 114,90 C113,68 100,52 82,52 C76,47 68,47 62,52 Z"
            fill="#04010a"
          />
          <circle cx="70" cy="30" r="19" fill="#04010a" />
          <path
            d="M133,62 C117,62 108,76 109,96 C110,120 115,150 123,200 L171,200 C178,150 182,120 181,96 C180,76 168,62 152,62 C147,58 139,58 133,62 Z"
            fill="#04010a"
          />
          <circle cx="141" cy="42" r="17" fill="#04010a" />
        </svg>
      </motion.div>

      {/* ── TITLE MARQUEE — two ticker lines running opposite
             directions: "Happy New Year 2027" on top, the couple's
             names + a heart just below. ── */}
      <div
        className="absolute inset-x-0 overflow-hidden pointer-events-none"
        style={{ top: '4%', height: 40, zIndex: 7 }}
      >
        <motion.div
          className="flex items-center whitespace-nowrap"
          style={{ width: 'max-content' }}
          animate={{ x: ['0%', '-25%'] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              style={{
                fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700,
                fontSize: 26, color: '#fde68a', textShadow: '0 0 20px rgba(251,191,36,0.5)', marginRight: 28,
              }}
            >
              Happy New Year 2027&nbsp;&nbsp;•
            </span>
          ))}
        </motion.div>
      </div>
      {/* ── PHOTO MARQUEE — the sender's own uploaded photos, framed as
             glowing circular medallions on a little gold chain, a heart
             charm between each — a creative stand-in for a second plain
             text line. Falls back to the names+heart text line when no
             photo was uploaded. ── */}
      {photos.length > 0 ? (
        <div
          className="absolute inset-x-0 overflow-hidden pointer-events-none"
          style={{ top: 'calc(4% + 40px)', height: 64, zIndex: 7 }}
        >
          <motion.div
            className="flex items-center"
            style={{ width: 'max-content' }}
            animate={{ x: ['-25%', '0%'] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'linear' }}
          >
            {Array.from({ length: 4 }).flatMap((_, rep) => photos.map((url, pi) => (
              <div key={`${rep}-${pi}`} className="flex items-center" style={{ marginRight: 22 }}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setZoomedPhoto(url); }}
                  className="rounded-full overflow-hidden cursor-pointer pointer-events-auto"
                  style={{
                    width: 48, height: 48, padding: 0, border: '2px solid #fde68a',
                    boxShadow: '0 0 14px rgba(251,191,36,0.6), 0 0 4px rgba(239,68,68,0.5)',
                    transform: `rotate(${pi % 2 === 0 ? -6 : 6}deg)`,
                  }}
                  aria-label="Xem ảnh lớn"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="size-full object-cover" draggable={false} />
                </button>
                <span style={{ marginLeft: 14, fontSize: 20, color: '#f87171', textShadow: '0 0 8px rgba(239,68,68,0.6)' }}>♥</span>
              </div>
            )))}
          </motion.div>
        </div>
      ) : (
        <div
          className="absolute inset-x-0 overflow-hidden pointer-events-none"
          style={{ top: 'calc(4% + 42px)', height: 26, zIndex: 7 }}
        >
          <motion.div
            className="flex items-center whitespace-nowrap"
            style={{ width: 'max-content' }}
            animate={{ x: ['-25%', '0%'] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'linear' }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <span
                key={i}
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontStyle: 'italic',
                  fontSize: 17, color: '#fecaca', textShadow: '0 0 10px rgba(239,68,68,0.5)', marginRight: 20,
                }}
              >
                {kiss.sender_name || 'Anh'} ❤️ {rawName || 'Em'}&nbsp;&nbsp;•
              </span>
            ))}
          </motion.div>
        </div>
      )}

      {/* ── Tap-to-open, fingerprint style ── */}
      {!showNote && (
        <motion.div
          className="absolute inset-x-0 flex flex-col items-center pointer-events-none"
          style={{ top: '76%', zIndex: 12 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.6 }}
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
                style={{ border: '2px solid rgba(251,191,36,0.65)' }}
                animate={{ scale: [1, 1.45, 1], opacity: [0.75, 0, 0.75] }}
                transition={{ duration: 1.7, repeat: Infinity, ease: 'easeOut' }}
              />
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(251,191,36,0.55)', backdropFilter: 'blur(4px)' }}
              >
                <span style={{ fontSize: 26 }}>🫆</span>
              </div>
            </div>
            <span
              className="mt-2 rounded-full"
              style={{
                padding: '4px 14px', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
                border: '1px solid rgba(251,191,36,0.4)', color: '#fde68a', fontSize: 12, fontStyle: 'italic',
              }}
            >
              Tap to open
            </span>
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {showNote && (
          <motion.div
            className="fixed inset-0 z-300 flex items-center justify-center px-6"
            style={{ background: 'rgba(20,2,2,0.9)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onClose?.()}
          >
            <motion.div
              className="w-full max-w-sm rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(160deg, #4a1010 0%, #7f1d1d 100%)',
                border: '1px solid rgba(251,191,36,0.4)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              }}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ height: 5, background: 'linear-gradient(90deg, #f59e0b, #fde68a, #ef4444, #f59e0b)' }} />
              <div className="p-6 text-center">
                <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#fde68a' }}>
                  🧨 Tết Rộn Ràng
                </div>
                {photos.length > 0 && (
                  <div className="flex justify-center gap-2 mb-4">
                    {photos.map((url, i) => (
                      <div
                        key={i}
                        className="overflow-hidden rounded-lg"
                        style={{ width: 90, height: 90, border: '3px solid #fdfbf5', boxShadow: '0 6px 18px rgba(0,0,0,0.4)', transform: `rotate(${i === 0 ? -4 : 4}deg)` }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="size-full object-cover" draggable={false} />
                      </div>
                    ))}
                  </div>
                )}
                {kiss.message && (
                  <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 17, color: '#fdfbf5', lineHeight: 1.6 }}>
                    &ldquo;{kiss.message}&rdquo;
                  </p>
                )}
                {rawName && (
                  <div className="mt-4 text-sm" style={{ color: '#fde68a' }}>
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

      {/* ── Photo lightbox — tap a marquee medallion to zoom it in ── */}
      <AnimatePresence>
        {zoomedPhoto && (
          <motion.div
            className="fixed inset-0 z-400 flex items-center justify-center px-6"
            style={{ background: 'rgba(5,0,2,0.92)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { e.stopPropagation(); setZoomedPhoto(null); }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="rounded-2xl overflow-hidden"
              style={{ border: '3px solid #fde68a', boxShadow: '0 0 40px rgba(251,191,36,0.4)', maxWidth: '86vw', maxHeight: '70vh' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={zoomedPhoto} alt="" className="block max-w-full max-h-full object-contain" draggable={false} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TetFirecrackerReveal;

export const TetFirecrackerConfig: TemplateConfig = {
  id: 'tet-firecracker',
  name: 'Firecrackers & Lanterns',
  occasionIds: ['tet'],
  emoji: '🧨',
  description: 'A night sky of rising fireworks over a couple watching together.',
  thumbnailBg: 'linear-gradient(135deg, #450a0a, #dc2626)',
  Component: TetFirecrackerReveal,
};
