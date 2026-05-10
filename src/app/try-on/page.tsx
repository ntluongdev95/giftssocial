'use client';

// AR nail try-on. Uses MediaPipe HandLandmarker for real-time hand tracking
// and Canvas 2D for nail polish overlay. Public page (no auth) so it's
// shareable as a marketing tool.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Loader2, Camera, RefreshCcw, AlertTriangle, Download, Sparkles, X,
} from 'lucide-react';

// ─── Curated nail catalog ─────────────────────────────────────────────────
// Each entry has a base color + finish (gloss / matte / chrome / glitter)
// AND an optional design overlay drawn on top (french tip, hearts, etc.).
type Finish = 'gloss' | 'matte' | 'chrome' | 'glitter';
type Design =
  | 'plain'
  | 'french'
  | 'reverse-french'
  | 'gradient'
  | 'glitter-tip'
  | 'hearts'
  | 'stars'
  | 'flowers'
  | 'dots'
  | 'stripe'
  | 'galaxy'
  | 'leopard';

interface Polish {
  id: string;
  name: string;
  color: string;        // base color of the nail
  finish: Finish;
  design?: Design;      // optional pattern drawn on top of the base
  accent?: string;      // color used for the pattern (white / gold / etc.)
}

const POLISHES: Polish[] = [
  // ── Solid colors ─────────────────────────────────────────────────────
  { id: 'classic-red',   name: 'Classic Red',   color: '#c41e3a', finish: 'gloss' },
  { id: 'pink-bubblegum',name: 'Bubblegum',     color: '#ff6fa8', finish: 'gloss' },
  { id: 'nude-rose',     name: 'Nude Rose',     color: '#d8a899', finish: 'gloss' },
  { id: 'plum',          name: 'Plum',          color: '#6b1c47', finish: 'gloss' },
  { id: 'coral',         name: 'Coral',         color: '#ff7f5b', finish: 'gloss' },
  { id: 'lavender',      name: 'Lavender',      color: '#bda5e3', finish: 'gloss' },
  { id: 'mint',          name: 'Mint',          color: '#79e3c2', finish: 'gloss' },
  { id: 'navy',          name: 'Navy',          color: '#1c2860', finish: 'gloss' },
  { id: 'forest',        name: 'Forest',        color: '#1f4d33', finish: 'gloss' },
  { id: 'pearl-white',   name: 'Pearl',         color: '#f5f0e8', finish: 'gloss' },
  { id: 'matte-black',   name: 'Matte Black',   color: '#1a1a1a', finish: 'matte' },
  { id: 'matte-mocha',   name: 'Matte Mocha',   color: '#5e3a25', finish: 'matte' },
  { id: 'chrome-silver', name: 'Chrome Silver', color: '#c9d2dc', finish: 'chrome' },
  { id: 'chrome-gold',   name: 'Chrome Gold',   color: '#e6c168', finish: 'chrome' },
  { id: 'glitter-rose',  name: 'Glitter Rose',  color: '#e8a6c4', finish: 'glitter' },
  { id: 'glitter-silver',name: 'Glitter Silver',color: '#cfd8e3', finish: 'glitter' },

  // ── Designs ──────────────────────────────────────────────────────────
  { id: 'french-classic',name: 'French Classic',color: '#ffd9d9', finish: 'gloss', design: 'french',         accent: '#ffffff' },
  { id: 'french-gold',   name: 'French Gold',   color: '#f0d6c4', finish: 'gloss', design: 'french',         accent: '#e6c168' },
  { id: 'reverse-french',name: 'Reverse French',color: '#ffd9d9', finish: 'gloss', design: 'reverse-french', accent: '#ffffff' },
  { id: 'glitter-tips',  name: 'Glitter Tips',  color: '#ffd9d9', finish: 'gloss', design: 'glitter-tip',    accent: '#ffd76a' },
  { id: 'ombre-pink',    name: 'Ombre Pink',    color: '#ffd9d9', finish: 'gloss', design: 'gradient',       accent: '#ff6fa8' },
  { id: 'ombre-sunset',  name: 'Sunset Ombré',  color: '#ff7f5b', finish: 'gloss', design: 'gradient',       accent: '#ffd76a' },
  { id: 'pink-hearts',   name: 'Pink Hearts',   color: '#ffd9d9', finish: 'gloss', design: 'hearts',         accent: '#c41e3a' },
  { id: 'black-stars',   name: 'Black Stars',   color: '#1a1a1a', finish: 'gloss', design: 'stars',          accent: '#e6c168' },
  { id: 'red-flowers',   name: 'Cherry Flower', color: '#fff5e8', finish: 'gloss', design: 'flowers',        accent: '#c41e3a' },
  { id: 'black-dots',    name: 'Polka Dots',    color: '#fff5e8', finish: 'gloss', design: 'dots',           accent: '#1a1a1a' },
  { id: 'gold-stripe',   name: 'Gold Stripe',   color: '#1a1a1a', finish: 'gloss', design: 'stripe',         accent: '#e6c168' },
  { id: 'galaxy',        name: 'Galaxy',        color: '#0a0a3a', finish: 'gloss', design: 'galaxy',         accent: '#ffffff' },
  { id: 'leopard-tan',   name: 'Leopard',       color: '#e8d4a3', finish: 'gloss', design: 'leopard',        accent: '#5e3a25' },
];

// MediaPipe finger landmark indices: { dip = joint just below tip, tip = fingertip }
const FINGER_JOINTS: Array<{ dip: number; tip: number }> = [
  { dip: 3,  tip: 4  }, // thumb
  { dip: 7,  tip: 8  }, // index
  { dip: 11, tip: 12 }, // middle
  { dip: 15, tip: 16 }, // ring
  { dip: 19, tip: 20 }, // pinky
];

interface HandLandmark { x: number; y: number; z: number }
type HandLandmarker = {
  detectForVideo: (video: HTMLVideoElement, timestamp: number) => {
    landmarks: HandLandmark[][];
    handedness?: { categoryName: string }[][];
  };
  close: () => void;
};

export default function NailTryOnPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  // Selected polish kept on a ref so the render loop sees the latest pick
  // without re-triggering useEffect.
  const polishRef = useRef<Polish>(POLISHES[0]);

  const [polish, setPolish] = useState<Polish>(POLISHES[0]);
  useEffect(() => { polishRef.current = polish; }, [polish]);

  const [phase, setPhase] = useState<'init' | 'ready' | 'error'>('init');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [handsDetected, setHandsDetected] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [snapshot, setSnapshot] = useState<string | null>(null);

  // ─── Initialise camera + MediaPipe ─────────────────────────────────────
  const init = useCallback(async (mode: 'user' | 'environment') => {
    setPhase('init');
    setErrorMsg('');
    try {
      // Camera first — fail fast with a clear error if blocked.
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        throw new Error('Camera needs HTTPS or localhost. Open this page over https://.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('Video element missing');
      video.srcObject = stream;
      await video.play();

      // MediaPipe HandLandmarker — model + WASM hosted on Google CDN.
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'
      );
      const landmarker = (await HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
      })) as unknown as HandLandmarker;
      landmarkerRef.current = landmarker;

      setPhase('ready');
    } catch (err) {
      const e = err as { name?: string; message?: string } | undefined;
      const reason =
        e?.name === 'NotAllowedError' ? 'Camera permission denied. Allow it in your browser, then reload.'
        : e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError' ? 'No camera available on this device.'
        : e?.name === 'NotReadableError' ? 'Camera is already in use by another app.'
        : e?.message || 'Could not start the camera.';
      setErrorMsg(reason);
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    init(facingMode);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // ─── Render loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'ready') return;
    let lastTs = -1;

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !canvas || !landmarker || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Mirror only the front-facing camera so movement matches.
      ctx.save();
      if (facingMode === 'user') {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();

      // MediaPipe needs strictly increasing timestamps in ms.
      const ts = performance.now();
      if (ts > lastTs) {
        lastTs = ts;
        try {
          const result = landmarker.detectForVideo(video, ts);
          const hands = result.landmarks || [];
          setHandsDetected(hands.length > 0);
          for (const lm of hands) {
            drawNails(ctx, lm, w, h, facingMode === 'user', polishRef.current);
          }
        } catch {
          /* model might not be ready yet on first frame */
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, facingMode]);

  // ─── Snapshot ─────────────────────────────────────────────────────────
  const capture = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSnapshot(canvas.toDataURL('image/png'));
  };

  const downloadSnapshot = () => {
    if (!snapshot) return;
    const a = document.createElement('a');
    a.href = snapshot;
    a.download = `nail-tryon-${polish.id}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white">
      {/* Top bar */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-3"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)' }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full cursor-pointer"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/60">Gao Social</span>
          <span className="text-sm font-bold flex items-center gap-1.5">
            <Sparkles size={14} className="text-[#00d4ff]" /> Nail try-on
          </span>
        </div>
        <button
          onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
          aria-label="Switch camera"
          className="flex h-10 w-10 items-center justify-center rounded-full cursor-pointer"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
        >
          <RefreshCcw size={16} />
        </button>
      </header>

      {/* Hidden video (used as MediaPipe input); canvas is what the user sees */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="hidden"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Loading veil */}
      <AnimatePresence>
        {phase === 'init' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center"
            style={{ background: 'rgba(10,11,15,0.92)' }}
          >
            <Loader2 size={32} className="animate-spin text-[#00d4ff]" />
            <p className="mt-4 text-sm font-semibold">Starting AR camera…</p>
            <p className="mt-1 text-xs text-white/55">Loading hand-tracking model</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error veil */}
      <AnimatePresence>
        {phase === 'error' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center px-8 text-center"
            style={{ background: 'rgba(10,11,15,0.95)' }}
          >
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
              <AlertTriangle size={24} />
            </div>
            <p className="text-base font-bold">Camera unavailable</p>
            <p className="mt-1.5 max-w-sm text-sm text-white/70">{errorMsg}</p>
            <div className="mt-5 flex items-center gap-2">
              <button
                onClick={() => router.back()}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}
              >
                Go back
              </button>
              <button
                onClick={() => init(facingMode)}
                className="rounded-xl px-5 py-2.5 text-sm font-bold cursor-pointer"
                style={{ background: '#00d4ff', color: '#0a0b0f' }}
              >
                Try again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No-hand hint */}
      <AnimatePresence>
        {phase === 'ready' && !handsDetected && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-1/2 top-20 z-10 -translate-x-1/2 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap"
            style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}
          >
            👋 Show your hand to the camera
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom controls — palette + capture */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 px-4 pb-6 pt-4"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)' }}
      >
        {/* Selected polish label */}
        <div className="flex items-center justify-center gap-2 text-xs">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: polish.color, boxShadow: `0 0 12px ${polish.color}aa` }} />
          <span className="font-semibold">{polish.name}</span>
          <span className="text-white/45">·</span>
          <span className="text-white/55 capitalize">{polish.finish}</span>
        </div>

        {/* Color palette — horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
          {POLISHES.map((p) => (
            <button
              key={p.id}
              onClick={() => setPolish(p)}
              aria-label={p.name}
              title={p.name}
              className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full cursor-pointer transition-transform"
              style={{
                background: p.color,
                border: polish.id === p.id ? '2px solid white' : '2px solid rgba(255,255,255,0.15)',
                boxShadow: polish.id === p.id
                  ? `0 0 0 3px rgba(0,212,255,0.6), 0 4px 12px ${p.color}66`
                  : `0 4px 8px rgba(0,0,0,0.4)`,
                transform: polish.id === p.id ? 'scale(1.08)' : 'scale(1)',
              }}
            >
              {/* Finish overlays — only when there's no design */}
              {!p.design && p.finish === 'chrome' && (
                <span
                  className="pointer-events-none absolute inset-1 rounded-full"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.7) 0%, transparent 50%, rgba(255,255,255,0.2) 100%)' }}
                />
              )}
              {!p.design && p.finish === 'glitter' && (
                <span
                  className="pointer-events-none absolute inset-0 rounded-full opacity-70"
                  style={{
                    backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 0.5px, transparent 1px)',
                    backgroundSize: '5px 5px',
                  }}
                />
              )}
              {/* Design previews on the swatch */}
              {p.design && <SwatchDesign design={p.design} accent={p.accent || '#ffffff'} base={p.color} />}
            </button>
          ))}
        </div>

        {/* Capture button */}
        <div className="flex items-center justify-center pt-1">
          <button
            onClick={capture}
            aria-label="Capture"
            className="relative flex h-16 w-16 items-center justify-center rounded-full cursor-pointer"
            style={{ background: 'white', boxShadow: '0 0 0 4px rgba(255,255,255,0.18)' }}
          >
            <Camera size={26} className="text-black" />
          </button>
        </div>
      </div>

      {/* Snapshot preview */}
      <AnimatePresence>
        {snapshot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center px-5"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          >
            <button
              onClick={() => setSnapshot(null)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">Your nails</p>
            <img
              src={snapshot}
              alt="Captured try-on"
              className="max-h-[60vh] w-full max-w-md rounded-2xl object-contain"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <div className="mt-4 flex w-full max-w-md items-center gap-2">
              <button
                onClick={() => setSnapshot(null)}
                className="flex-1 rounded-xl py-3 text-sm font-semibold cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
              >
                Try another
              </button>
              <button
                onClick={downloadSnapshot}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold cursor-pointer"
                style={{ background: '#00d4ff', color: '#0a0b0f' }}
              >
                <Download size={14} /> Save
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Swatch design preview ───────────────────────────────────────────────
// Renders a small visual hint of each design on the circular swatch so users
// can recognize "French tip", "Hearts", etc. at a glance.

function SwatchDesign({ design, accent, base }: { design: Design; accent: string; base: string }) {
  if (design === 'french') {
    return (
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
        style={{ background: accent, borderRadius: '999px 999px 0 0' }}
      />
    );
  }
  if (design === 'reverse-french') {
    return (
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3"
        style={{ background: accent, borderRadius: '0 0 999px 999px' }}
      />
    );
  }
  if (design === 'gradient') {
    return (
      <span
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ background: `linear-gradient(180deg, ${base} 0%, ${accent} 100%)` }}
      />
    );
  }
  if (design === 'glitter-tip') {
    return (
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-2/5 opacity-80"
        style={{
          background: `radial-gradient(${accent} 0.7px, transparent 1.2px)`,
          backgroundSize: '4px 4px',
          borderRadius: '999px 999px 0 0',
        }}
      />
    );
  }
  if (design === 'hearts') {
    return <SwatchEmoji ch="♥" color={accent} />;
  }
  if (design === 'stars') {
    return <SwatchEmoji ch="★" color={accent} />;
  }
  if (design === 'flowers') {
    return <SwatchEmoji ch="✿" color={accent} />;
  }
  if (design === 'dots') {
    return (
      <span
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          backgroundImage: `radial-gradient(${accent} 1.2px, transparent 1.5px)`,
          backgroundSize: '8px 8px',
        }}
      />
    );
  }
  if (design === 'stripe') {
    return (
      <span
        className="pointer-events-none absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 -rotate-12"
        style={{ background: accent }}
      />
    );
  }
  if (design === 'galaxy') {
    return (
      <span
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          backgroundImage: `radial-gradient(${accent} 0.5px, transparent 1px)`,
          backgroundSize: '4px 4px',
        }}
      />
    );
  }
  if (design === 'leopard') {
    return (
      <span
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          backgroundImage:
            `radial-gradient(${accent} 1.5px, transparent 2px)`,
          backgroundSize: '7px 7px',
          backgroundPosition: '0 0, 3px 3px',
          opacity: 0.85,
        }}
      />
    );
  }
  return null;
}

function SwatchEmoji({ ch, color }: { ch: string; color: string }) {
  return (
    <span
      className="pointer-events-none absolute inset-0 flex items-center justify-center text-[14px] font-bold"
      style={{ color }}
    >
      {ch}
    </span>
  );
}

// ─── Nail rendering ──────────────────────────────────────────────────────
// Draws a glossy/matte/chrome/glitter nail-polish ellipse over each fingertip
// using the MediaPipe landmark for the finger's tip and DIP joint to compute
// position, orientation, and size.

function drawNails(
  ctx: CanvasRenderingContext2D,
  landmarks: HandLandmark[],
  width: number,
  height: number,
  mirrored: boolean,
  polish: Polish,
) {
  const project = (lm: HandLandmark) => {
    const x = mirrored ? (1 - lm.x) * width : lm.x * width;
    return { x, y: lm.y * height };
  };

  for (const f of FINGER_JOINTS) {
    const dip = project(landmarks[f.dip]);
    const tip = project(landmarks[f.tip]);
    const dx = tip.x - dip.x;
    const dy = tip.y - dip.y;
    const len = Math.hypot(dx, dy);
    if (len < 6) continue;
    const angle = Math.atan2(dy, dx);

    // Nail size proportional to last-segment length. Scale tuned by eye.
    const nailLen = len * 0.85;
    const nailW = len * 0.6;
    // Center placed slightly forward of the DIP joint toward the tip.
    const cx = dip.x + dx * 0.55;
    const cy = dip.y + dy * 0.55;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Base ellipse — color slab.
    if (polish.finish === 'chrome') {
      const grad = ctx.createLinearGradient(-nailLen / 2, 0, nailLen / 2, 0);
      grad.addColorStop(0, lighten(polish.color, 35));
      grad.addColorStop(0.45, polish.color);
      grad.addColorStop(0.55, lighten(polish.color, 12));
      grad.addColorStop(1, lighten(polish.color, 30));
      ctx.fillStyle = grad;
    } else if (polish.finish === 'matte') {
      ctx.fillStyle = polish.color;
    } else {
      const grad = ctx.createLinearGradient(0, -nailW / 2, 0, nailW / 2);
      grad.addColorStop(0, lighten(polish.color, 12));
      grad.addColorStop(0.55, polish.color);
      grad.addColorStop(1, darken(polish.color, 18));
      ctx.fillStyle = grad;
    }
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(0, 0, nailLen / 2, nailW / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlight strip — gloss/chrome only.
    if (polish.finish === 'gloss' || polish.finish === 'chrome') {
      ctx.globalAlpha = polish.finish === 'chrome' ? 0.55 : 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-nailLen * 0.08, -nailW * 0.18, nailLen * 0.32, nailW * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Glitter speckle — random dots over the surface.
    if (polish.finish === 'glitter') {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#ffffff';
      const flecks = 22;
      for (let i = 0; i < flecks; i++) {
        // Cheap PRNG seeded by finger so flecks don't shimmer wildly each frame.
        const seed = (f.tip * 31 + i) * 9301;
        const rx = ((seed % 9301) / 9301) * 2 - 1;
        const ry = (((seed >> 4) % 9301) / 9301) * 2 - 1;
        const px = rx * nailLen * 0.35;
        const py = ry * nailW * 0.32;
        ctx.beginPath();
        ctx.arc(px, py, 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Design overlay ──────────────────────────────────────────────
    if (polish.design && polish.design !== 'plain') {
      // Clip to nail ellipse so designs never bleed outside the nail.
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, nailLen / 2, nailW / 2, 0, 0, Math.PI * 2);
      ctx.clip();
      drawDesign(ctx, polish, nailLen, nailW, f.tip);
      ctx.restore();
    }

    ctx.restore();
  }
}

// ─── Design renderers ────────────────────────────────────────────────────
// All draw inside a coordinate system centered on the nail (0,0 = center,
// +x = toward fingertip, +/- y = nail width axis), already clipped to the
// nail ellipse.

function drawDesign(
  ctx: CanvasRenderingContext2D,
  polish: Polish,
  L: number,
  W: number,
  fingerSeed: number,
) {
  const accent = polish.accent || '#ffffff';
  switch (polish.design) {
    case 'french': drawFrench(ctx, L, W, accent); break;
    case 'reverse-french': drawReverseFrench(ctx, L, W, accent); break;
    case 'gradient': drawGradient(ctx, L, W, polish.color, accent); break;
    case 'glitter-tip': drawGlitterTip(ctx, L, W, accent, fingerSeed); break;
    case 'hearts': drawHearts(ctx, L, W, accent); break;
    case 'stars': drawStars(ctx, L, W, accent); break;
    case 'flowers': drawFlowers(ctx, L, W, accent); break;
    case 'dots': drawDots(ctx, L, W, accent, fingerSeed); break;
    case 'stripe': drawStripe(ctx, L, W, accent); break;
    case 'galaxy': drawGalaxy(ctx, L, W, accent, fingerSeed); break;
    case 'leopard': drawLeopard(ctx, L, W, accent, fingerSeed); break;
    default: break;
  }
}

// White (or accent) tip on the top ~30% of the nail.
function drawFrench(ctx: CanvasRenderingContext2D, L: number, W: number, accent: string) {
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = accent;
  ctx.beginPath();
  // Tip is at +x. Rectangle covering the tip side, clipped to ellipse.
  ctx.rect(L * 0.18, -W, L, W * 2);
  ctx.fill();
  // Subtle shadow under the tip line
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(L * 0.16, -W, 1.4, W * 2);
}

// Crescent at the BASE (cuticle side, -x).
function drawReverseFrench(ctx: CanvasRenderingContext2D, L: number, W: number, accent: string) {
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.rect(-L, -W, L * 0.7, W * 2);
  ctx.fill();
}

// Gradient from base color (cuticle) to accent (tip).
function drawGradient(ctx: CanvasRenderingContext2D, L: number, W: number, base: string, accent: string) {
  const grad = ctx.createLinearGradient(-L / 2, 0, L / 2, 0);
  grad.addColorStop(0, base);
  grad.addColorStop(1, accent);
  ctx.fillStyle = grad;
  ctx.globalAlpha = 0.95;
  ctx.fillRect(-L, -W, L * 2, W * 2);
}

// Glitter speckle limited to top ~40% of nail (the tip).
function drawGlitterTip(ctx: CanvasRenderingContext2D, L: number, W: number, accent: string, seed: number) {
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = accent;
  for (let i = 0; i < 30; i++) {
    const r = pseudoRand(seed * 7 + i);
    const r2 = pseudoRand(seed * 11 + i);
    const px = L * 0.05 + r * L * 0.45;       // x in tip half
    const py = (r2 * 2 - 1) * W * 0.42;
    const sz = 0.5 + pseudoRand(seed * 13 + i) * 0.8;
    ctx.beginPath();
    ctx.arc(px, py, sz, 0, Math.PI * 2);
    ctx.fill();
  }
}

// One small heart in the center, plus a tiny one above.
function drawHearts(ctx: CanvasRenderingContext2D, L: number, W: number, accent: string) {
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.95;
  drawHeart(ctx, 0, 0, Math.min(L, W) * 0.32);
}

function drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.4);
  ctx.bezierCurveTo(cx, cy + size * 0.1, cx - size * 0.5, cy - size * 0.4, cx - size * 0.5, cy - size * 0.1);
  ctx.bezierCurveTo(cx - size * 0.5, cy + size * 0.2, cx, cy + size * 0.5, cx, cy + size * 0.7);
  ctx.bezierCurveTo(cx, cy + size * 0.5, cx + size * 0.5, cy + size * 0.2, cx + size * 0.5, cy - size * 0.1);
  ctx.bezierCurveTo(cx + size * 0.5, cy - size * 0.4, cx, cy + size * 0.1, cx, cy + size * 0.4);
  ctx.fill();
}

// Two small five-point stars.
function drawStars(ctx: CanvasRenderingContext2D, L: number, W: number, accent: string) {
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.95;
  drawStar(ctx, -L * 0.18, -W * 0.05, Math.min(L, W) * 0.18, 5);
  drawStar(ctx, L * 0.2, W * 0.1, Math.min(L, W) * 0.14, 5);
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, points: number) {
  ctx.beginPath();
  const inner = r * 0.4;
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? r : inner;
    const a = (Math.PI / points) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

// One simple 5-petal flower with a yellow center.
function drawFlowers(ctx: CanvasRenderingContext2D, L: number, W: number, accent: string) {
  const cx = 0;
  const cy = 0;
  const r = Math.min(L, W) * 0.18;
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = accent;
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    ctx.beginPath();
    ctx.arc(px, py, r * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // Center
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

// Polka dots — fixed-position dots so they don't jitter.
function drawDots(ctx: CanvasRenderingContext2D, L: number, W: number, accent: string, seed: number) {
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.95;
  for (let i = 0; i < 7; i++) {
    const rx = pseudoRand(seed * 17 + i);
    const ry = pseudoRand(seed * 23 + i);
    const px = (rx * 2 - 1) * L * 0.4;
    const py = (ry * 2 - 1) * W * 0.4;
    ctx.beginPath();
    ctx.arc(px, py, Math.min(L, W) * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
}

// One thin diagonal stripe across the nail.
function drawStripe(ctx: CanvasRenderingContext2D, L: number, W: number, accent: string) {
  ctx.save();
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.95;
  ctx.rotate(-0.5);
  ctx.fillRect(-L, -W * 0.08, L * 2, W * 0.16);
  ctx.restore();
}

// Tiny stars + dust over a dark base.
function drawGalaxy(ctx: CanvasRenderingContext2D, L: number, W: number, accent: string, seed: number) {
  // Subtle nebula tint
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(L, W) / 2);
  grad.addColorStop(0, 'rgba(167,139,250,0.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(-L, -W, L * 2, W * 2);

  // Dust speckles
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 35; i++) {
    const rx = pseudoRand(seed * 41 + i);
    const ry = pseudoRand(seed * 53 + i);
    const px = (rx * 2 - 1) * L * 0.42;
    const py = (ry * 2 - 1) * W * 0.42;
    const sz = 0.4 + pseudoRand(seed * 59 + i) * 0.6;
    ctx.beginPath();
    ctx.arc(px, py, sz, 0, Math.PI * 2);
    ctx.fill();
  }
  // 1-2 brighter "stars"
  drawStar(ctx, L * 0.15, -W * 0.18, Math.min(L, W) * 0.08, 5);
  drawStar(ctx, -L * 0.22, W * 0.12, Math.min(L, W) * 0.06, 5);
}

// Leopard print — irregular blobs with thin outlines.
function drawLeopard(ctx: CanvasRenderingContext2D, L: number, W: number, accent: string, seed: number) {
  for (let i = 0; i < 6; i++) {
    const rx = pseudoRand(seed * 67 + i);
    const ry = pseudoRand(seed * 71 + i);
    const px = (rx * 2 - 1) * L * 0.36;
    const py = (ry * 2 - 1) * W * 0.32;
    const r = Math.min(L, W) * (0.06 + pseudoRand(seed * 79 + i) * 0.04);

    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(px, py, r * 1.2, r * 0.9, pseudoRand(seed * 83 + i) * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    // Tiny dots beside the blob for the speckled leopard look
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(px - r * 0.6, py - r * 0.5, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + r * 0.7, py + r * 0.4, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Deterministic pseudo-random so designs don't shimmer between frames.
function pseudoRand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function lighten(hex: string, percent: number): string {
  const { r, g, b } = parseHex(hex);
  const f = percent / 100;
  return rgb(
    Math.round(r + (255 - r) * f),
    Math.round(g + (255 - g) * f),
    Math.round(b + (255 - b) * f)
  );
}

function darken(hex: string, percent: number): string {
  const { r, g, b } = parseHex(hex);
  const f = 1 - percent / 100;
  return rgb(Math.round(r * f), Math.round(g * f), Math.round(b * f));
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const v = h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function rgb(r: number, g: number, b: number): string {
  return `rgb(${r},${g},${b})`;
}
