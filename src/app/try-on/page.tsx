'use client';

// AR nail try-on. Uses MediaPipe HandLandmarker for real-time hand tracking
// and Canvas 2D for nail polish overlay. Public page (no auth) so it's
// shareable as a marketing tool.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Loader2, Camera, RefreshCcw, AlertTriangle, Download, Sparkles, X, BookOpen, Heart,
  Image as ImageIcon, Palette, Stamp, Layers, Hexagon, Hand,
} from 'lucide-react';
import { toast } from 'sonner';

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
  | 'leopard'
  // ── 2026 trending designs ────────────────────────────────────────
  | 'aura'           // radial glow at the tip — "aura nails"
  | 'glazed'         // milky iridescent glaze — Hailey Bieber donut
  | 'wavy-french'    // squiggly french tip
  | 'cherry'         // cherry pair on the tip
  | 'smiley'         // single smiley face at center
  | 'butterfly'      // butterfly silhouette
  | 'bow'            // small bow at the base — coquette aesthetic
  | 'cow'            // cow-print blobs
  | 'daisy'          // single daisy flower
  | 'cat-eye'        // magnetic shimmer streak
  | 'flame';         // flame-shaped tip

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

  // ── 2026 trending designs ────────────────────────────────────────────
  { id: 'aura-pink',     name: 'Aura Glow',     color: '#fbe1ec', finish: 'gloss', design: 'aura',           accent: '#ff6fa8' },
  { id: 'aura-violet',   name: 'Violet Aura',   color: '#ece6ff', finish: 'gloss', design: 'aura',           accent: '#9b6cff' },
  { id: 'glazed-donut',  name: 'Glazed Donut',  color: '#f6ede1', finish: 'chrome',design: 'glazed',         accent: '#fff7f0' },
  { id: 'wavy-french',   name: 'Wavy French',   color: '#ffd9d9', finish: 'gloss', design: 'wavy-french',    accent: '#ffffff' },
  { id: 'cherry-girl',   name: 'Cherry Girl',   color: '#fff5e8', finish: 'gloss', design: 'cherry',         accent: '#d11d2d' },
  { id: 'smiley-yellow', name: 'Smiley',        color: '#fff5e8', finish: 'gloss', design: 'smiley',         accent: '#ffcb2e' },
  { id: 'y2k-butterfly', name: 'Y2K Butterfly', color: '#cfeaff', finish: 'gloss', design: 'butterfly',      accent: '#7a5cff' },
  { id: 'coquette-bow',  name: 'Coquette Bow',  color: '#ffeaf0', finish: 'gloss', design: 'bow',            accent: '#ff6fa8' },
  { id: 'cow-print',     name: 'Cow Print',     color: '#ffffff', finish: 'gloss', design: 'cow',            accent: '#1a1a1a' },
  { id: 'daisy-cream',   name: 'Daisy Field',   color: '#fff5e8', finish: 'gloss', design: 'daisy',          accent: '#ffcb2e' },
  { id: 'cat-eye-emerald', name: 'Cat Eye',     color: '#0c3a2c', finish: 'gloss', design: 'cat-eye',        accent: '#67ffc4' },
  { id: 'flame-tip',     name: 'Flame Tips',    color: '#1a1a1a', finish: 'gloss', design: 'flame',          accent: '#ff7a1a' },
];

// ─── Curated "Looks" — preset 5-nail combinations ───────────────────────
// Each look paints a specific design on every finger so users can apply a
// whole manicure in one tap. Mirrors how YouCam Nails organizes the
// "Looks" carousel. Order: [thumb, index, middle, ring, pinky].
function polishById(id: string): Polish {
  const p = POLISHES.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown polish id: ${id}`);
  return p;
}

interface Look {
  id: string;
  name: string;
  polishes: [Polish, Polish, Polish, Polish, Polish];
}

const LOOKS: Look[] = [
  {
    id: 'classic-nude',
    name: 'Classic Nude',
    polishes: ['nude-rose', 'nude-rose', 'nude-rose', 'nude-rose', 'nude-rose'].map(polishById) as Look['polishes'],
  },
  {
    id: 'glam-red',
    name: 'Glam Red',
    polishes: ['classic-red', 'classic-red', 'classic-red', 'classic-red', 'classic-red'].map(polishById) as Look['polishes'],
  },
  {
    id: 'french-tip',
    name: 'French Tip',
    polishes: ['french-classic', 'french-classic', 'french-classic', 'french-classic', 'french-classic'].map(polishById) as Look['polishes'],
  },
  {
    id: 'geometric',
    name: 'Geometric',
    polishes: ['gold-stripe', 'french-classic', 'matte-black', 'reverse-french', 'gold-stripe'].map(polishById) as Look['polishes'],
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold',
    polishes: ['nude-rose', 'chrome-gold', 'glitter-rose', 'chrome-gold', 'nude-rose'].map(polishById) as Look['polishes'],
  },
  {
    id: 'savanna',
    name: 'Savanna',
    polishes: ['leopard-tan', 'nude-rose', 'leopard-tan', 'matte-mocha', 'leopard-tan'].map(polishById) as Look['polishes'],
  },
  {
    id: 'cherry-girl',
    name: 'Cherry Girl',
    polishes: ['cherry-girl', 'classic-red', 'cherry-girl', 'classic-red', 'cherry-girl'].map(polishById) as Look['polishes'],
  },
  {
    id: 'coquette',
    name: 'Coquette',
    polishes: ['pink-bubblegum', 'coquette-bow', 'pink-bubblegum', 'coquette-bow', 'pink-bubblegum'].map(polishById) as Look['polishes'],
  },
  {
    id: 'y2k',
    name: 'Y2K',
    polishes: ['lavender', 'y2k-butterfly', 'lavender', 'y2k-butterfly', 'lavender'].map(polishById) as Look['polishes'],
  },
  {
    id: 'aura-glow',
    name: 'Aura Glow',
    polishes: ['aura-pink', 'aura-violet', 'aura-pink', 'aura-violet', 'aura-pink'].map(polishById) as Look['polishes'],
  },
  {
    id: 'galaxy',
    name: 'Galaxy',
    polishes: ['galaxy', 'matte-black', 'galaxy', 'matte-black', 'galaxy'].map(polishById) as Look['polishes'],
  },
  {
    id: 'glazed-donut',
    name: 'Glazed',
    polishes: ['glazed-donut', 'glazed-donut', 'glazed-donut', 'glazed-donut', 'glazed-donut'].map(polishById) as Look['polishes'],
  },
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

// ─── Top-level page — switches between Discover / Camera / Photo modes ──
export default function NailTryOnPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'discover' | 'camera' | 'photo'>('discover');
  const [perNailPolishes, setPerNailPolishes] = useState<Record<number, Polish>>({
    0: POLISHES[0], 1: POLISHES[0], 2: POLISHES[0], 3: POLISHES[0], 4: POLISHES[0],
  });

  if (mode === 'camera') {
    return (
      <CameraView
        initialPolishes={perNailPolishes}
        onSavePolishes={setPerNailPolishes}
        onBack={() => setMode('discover')}
      />
    );
  }

  if (mode === 'photo') {
    return (
      <PhotoView
        initialPolishes={perNailPolishes}
        onSavePolishes={setPerNailPolishes}
        onBack={() => setMode('discover')}
      />
    );
  }

  return (
    <DiscoverView
      onOpenCamera={() => setMode('camera')}
      onOpenPhoto={() => setMode('photo')}
      onPickDesign={(p) => {
        setPerNailPolishes({ 0: p, 1: p, 2: p, 3: p, 4: p });
        setMode('camera');
      }}
      onExit={() => router.push('/')}
    />
  );
}

// ─── Discover view — YouCam-style home screen ────────────────────────────
// Layout (top → bottom):
//   1. Header (Gao branding)
//   2. Hero showcase (5 nail-tile fingers + tagline)
//   3. Two big CTAs (Live Try on · Photo Try on)
//   4. Two small action cards (Tutorial · My Designs)

function DiscoverView({
  onOpenCamera,
  onOpenPhoto,
  onPickDesign,
  onExit,
}: {
  onOpenCamera: () => void;
  onOpenPhoto: () => void;
  onPickDesign: (p: Polish) => void;
  onExit: () => void;
}) {
  // Curated 5 polishes for the mobile "splayed hand" showcase.
  const showcase = useMemo(() => {
    const picks = ['nude-rose', 'classic-red', 'french-classic', 'navy', 'gold-stripe'];
    return picks
      .map((id) => POLISHES.find((p) => p.id === id))
      .filter((p): p is Polish => !!p);
  }, []);

  // Desktop showcase — a 9-tile bento grid of curated designs floating
  // around a "hero" centerpiece. Tiles are interactive: tap → opens the
  // live camera with that polish already painted on every nail.
  const featuredDesigns = useMemo(() => {
    const picks = [
      'classic-red',     // top-left
      'french-classic',  // top-mid
      'cherry-girl',     // top-right
      'galaxy',          // mid-left
      // centerpiece slot
      'chrome-gold',     // mid-right
      'coquette-bow',    // bottom-left
      'aura-pink',       // bottom-mid
      'leopard-tan',     // bottom-right
    ];
    return picks
      .map((id) => POLISHES.find((p) => p.id === id))
      .filter((p): p is Polish => !!p);
  }, []);

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden text-[#1a1a2e] lg:h-screen"
      style={{
        background: 'linear-gradient(180deg, #fde3e0 0%, #fef5f3 35%, #ffffff 100%)',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-2.5 lg:py-3"
        style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.04)' }}
      >
        <button
          onClick={onExit}
          aria-label="Exit"
          className="flex h-9 w-9 items-center justify-center rounded-full cursor-pointer"
          style={{ background: 'rgba(0,0,0,0.05)' }}
        >
          <ArrowLeft size={16} className="text-[#1a1a2e]" />
        </button>
        {/* Studio brand — platform default is "Nails Studio · by Gao
            Social". When a business registers their own AR studio later,
            wire `businessName` from URL/state to swap the title and
            demote "Gao Social" to a fine-print attribution. */}
        <div className="flex flex-col items-center leading-tight">
          <span
            className="text-base font-extrabold tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #ff6fa8, #c41e3a)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Nails Studio
          </span>
          <span className="text-[9px] uppercase tracking-[0.25em] text-[#1a1a2e]/55">
            by Gao Social
          </span>
        </div>
        <div className="h-9 w-9" />
      </header>

      <main className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col px-4 pb-3 pt-3 lg:max-w-none lg:px-0 lg:pb-0 lg:pt-0">
        {/* ── Hero ───────────────────────────────────────────────────── */}
        {/* Mobile: stacked card grows to fill remaining height.
            Desktop: full-bleed, no card frame. Both: zero page scroll. */}
        <div
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl lg:rounded-none lg:grid lg:h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-stretch lg:gap-0"
          style={{
            background: 'linear-gradient(135deg, #ffe0d8 0%, #fff5e8 60%, #ffe9f1 100%)',
          }}
        >
          {/* Soft decorative shapes (mobile-only — desktop hero is clean) */}
          <div className="pointer-events-none absolute -top-20 -left-12 h-48 w-48 rounded-full opacity-50 lg:hidden" style={{ background: 'radial-gradient(circle, rgba(255,111,168,0.35), transparent 70%)' }} />
          <div className="pointer-events-none absolute -bottom-16 -right-8 h-56 w-56 rounded-full opacity-40 lg:hidden" style={{ background: 'radial-gradient(circle, rgba(196,30,58,0.18), transparent 70%)' }} />

          {/* Left column — copy + CTAs + small actions */}
          <div className="relative flex shrink-0 flex-col px-5 pt-4 sm:px-7 sm:pt-6 lg:shrink lg:justify-center lg:px-16 lg:py-20 xl:px-24 2xl:px-32">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#c41e3a]/80 lg:text-xs">
              ✨ AR Nail Studio
            </p>
            <h1 className="mt-1 text-[20px] font-black leading-tight sm:text-[22px] lg:mt-3 lg:text-[52px] lg:leading-[1.02] 2xl:text-[60px]">
              Try on your next<br />nail look in seconds
            </h1>
            <p className="hidden lg:block mt-5 text-base text-[#1a1a2e]/70 max-w-lg leading-relaxed">
              Real-time AR powered by MediaPipe — paint your nails with one tap,
              try on dozens of designs, share to social. No fitting, no waiting.
            </p>

            {/* CTAs (desktop only — moved into the hero on lg+) */}
            <div className="hidden lg:grid lg:grid-cols-2 lg:gap-3 mt-7 max-w-md">
              <button
                onClick={onOpenCamera}
                className="relative flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3.5 cursor-pointer transition-transform active:scale-[0.98]"
                style={{
                  border: '2px solid transparent',
                  backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #ff6fa8, #c41e3a)',
                  backgroundOrigin: 'border-box',
                  backgroundClip: 'padding-box, border-box',
                  boxShadow: '0 6px 18px -8px rgba(196,30,58,0.45)',
                }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full shrink-0" style={{ background: 'linear-gradient(135deg, #ff6fa8, #c41e3a)' }}>
                  <Camera size={18} className="text-white" />
                </div>
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-sm font-bold">Live</span>
                  <span className="text-sm font-bold">Try on</span>
                </div>
              </button>
              <button
                onClick={onOpenPhoto}
                className="relative flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3.5 cursor-pointer transition-transform active:scale-[0.98]"
                style={{
                  border: '2px solid transparent',
                  backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #6ec5ff, #5b8def)',
                  backgroundOrigin: 'border-box',
                  backgroundClip: 'padding-box, border-box',
                  boxShadow: '0 6px 18px -8px rgba(91,141,239,0.45)',
                }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full shrink-0" style={{ background: 'linear-gradient(135deg, #6ec5ff, #5b8def)' }}>
                  <Sparkles size={18} className="text-white" />
                </div>
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-sm font-bold">Photo</span>
                  <span className="text-sm font-bold">Try on</span>
                </div>
              </button>
            </div>

            {/* Small actions (desktop) */}
            <div className="hidden lg:flex mt-3 max-w-md gap-3">
              <button
                onClick={() => toast.message('Tutorial', { description: 'A quick walkthrough is coming soon. For now, tap "Live Try on" and point your camera at your hand!' })}
                className="flex flex-1 items-center gap-2.5 rounded-2xl px-3 py-3 cursor-pointer transition-transform active:scale-[0.98]"
                style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(0,0,0,0.06)' }}
              >
                <BookOpen size={16} className="text-[#1a1a2e]" />
                <span className="text-sm font-semibold">Tutorial</span>
              </button>
              <button
                onClick={() => toast.message('My Designs', { description: 'Save your favorite looks. Heart-to-save coming in the next update.' })}
                className="flex flex-1 items-center gap-2.5 rounded-2xl px-3 py-3 cursor-pointer transition-transform active:scale-[0.98]"
                style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(0,0,0,0.06)' }}
              >
                <Heart size={16} className="text-[#1a1a2e]" />
                <span className="text-sm font-semibold">My Designs</span>
              </button>
            </div>

            {/* Desktop attribution — sits at the bottom of the left column */}
            <p className="hidden lg:block mt-10 text-[10px] uppercase tracking-[0.2em] text-[#1a1a2e]/35">
              Powered by MediaPipe hand-tracking · made with ✨ by Gao Social
            </p>
          </div>

          {/* Mobile-only hand hero — a real photo of a hand wearing nail
              polish, dropped by the team into `/public/images/try-on/`.
              Falls back to the SVG hand illustration if the file is
              missing (so the page never looks broken pre-asset). */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-2 lg:hidden">
            <HandHeroImage polishes={showcase} />
          </div>

          {/* Desktop-only floating showcase — bento grid of curated
              designs around a centerpiece. Each tile is tap-to-try-on. */}
          <div className="relative hidden lg:flex items-center justify-center px-8 py-10 2xl:px-12">
            <FeaturedDesignsShowcase
              designs={featuredDesigns}
              showcase={showcase}
              onPick={onPickDesign}
            />
          </div>

          {/* Tile float keyframes — staggered per-tile via inline delay. */}
          <style>{`
            @keyframes tryon-float-a {
              0%, 100% { transform: translateY(0) rotate(-3deg); }
              50%      { transform: translateY(-10px) rotate(-1deg); }
            }
            @keyframes tryon-float-b {
              0%, 100% { transform: translateY(0) rotate(2deg); }
              50%      { transform: translateY(-14px) rotate(4deg); }
            }
            @keyframes tryon-float-c {
              0%, 100% { transform: translateY(0) rotate(-1deg); }
              50%      { transform: translateY(-8px) rotate(1deg); }
            }
            @keyframes tryon-glow {
              0%, 100% { opacity: 0.5; transform: scale(1); }
              50%      { opacity: 0.8; transform: scale(1.05); }
            }
          `}</style>
        </div>

        {/* ── Mobile-only action stack — locked to the bottom of the
            viewport. CTAs first (primary actions), then the secondary
            row, then a one-line attribution. Everything is shrink-0 so
            the hero above gets all the leftover vertical space. */}
        <div className="mt-3 grid shrink-0 grid-cols-2 gap-2.5 lg:hidden">
          <button
            onClick={onOpenCamera}
            className="relative flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 cursor-pointer transition-transform active:scale-[0.98]"
            style={{
              border: '2px solid transparent',
              backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #ff6fa8, #c41e3a)',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              boxShadow: '0 6px 18px -8px rgba(196,30,58,0.45)',
            }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full shrink-0" style={{ background: 'linear-gradient(135deg, #ff6fa8, #c41e3a)' }}>
              <Camera size={16} className="text-white" />
            </div>
            <div className="flex flex-col text-left leading-tight">
              <span className="text-sm font-bold">Live</span>
              <span className="text-sm font-bold">Try on</span>
            </div>
          </button>
          <button
            onClick={onOpenPhoto}
            className="relative flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 cursor-pointer transition-transform active:scale-[0.98]"
            style={{
              border: '2px solid transparent',
              backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #6ec5ff, #5b8def)',
              backgroundOrigin: 'border-box',
              backgroundClip: 'padding-box, border-box',
              boxShadow: '0 6px 18px -8px rgba(91,141,239,0.45)',
            }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full shrink-0" style={{ background: 'linear-gradient(135deg, #6ec5ff, #5b8def)' }}>
              <Sparkles size={16} className="text-white" />
            </div>
            <div className="flex flex-col text-left leading-tight">
              <span className="text-sm font-bold">Photo</span>
              <span className="text-sm font-bold">Try on</span>
            </div>
          </button>
        </div>
        <div className="mt-2 grid shrink-0 grid-cols-2 gap-2.5 lg:hidden">
          <button
            onClick={() => toast.message('Tutorial', { description: 'A quick walkthrough is coming soon. For now, tap "Live Try on" and point your camera at your hand!' })}
            className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 cursor-pointer transition-transform active:scale-[0.98]"
            style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}
          >
            <BookOpen size={14} className="text-[#1a1a2e]" />
            <span className="text-xs font-semibold">Tutorial</span>
          </button>
          <button
            onClick={() => toast.message('My Designs', { description: 'Save your favorite looks. Heart-to-save coming in the next update.' })}
            className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 cursor-pointer transition-transform active:scale-[0.98]"
            style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}
          >
            <Heart size={14} className="text-[#1a1a2e]" />
            <span className="text-xs font-semibold">My Designs</span>
          </button>
        </div>

        <p className="mt-2 shrink-0 text-center text-[9px] uppercase tracking-[0.18em] text-[#1a1a2e]/35 lg:hidden">
          Powered by MediaPipe · made with ✨ by Gao Social
        </p>
      </main>
    </div>
  );
}

// ─── Hand hero image — tries the real photo first, falls back to the
// stylized SVG hand if the asset is missing. The photo lives at
// `/public/images/try-on/hand-hero.jpg`; drop in any high-res manicure
// photo and the page picks it up on next reload.
function HandHeroImage({ polishes }: { polishes: Polish[] }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (imgFailed) {
    return <HandShowcase polishes={polishes} />;
  }
  // Feather the photo edges so the photo's background (any color) fades
  // smoothly into the hero gradient. Multiply blend mode lets the hero's
  // warm tones bleed through any near-white photo background, so the image
  // doesn't read as a "pasted-in rectangle". Drop a PNG with a transparent
  // background to skip the blend entirely.
  const featherMask =
    'radial-gradient(ellipse 80% 90% at 50% 50%, #000 55%, transparent 100%)';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/try-on/hand-hero.jpg"
      alt="Hand wearing nail polish"
      onError={() => setImgFailed(true)}
      className="h-full max-h-full w-auto object-contain"
      style={{
        filter: 'drop-shadow(0 24px 50px rgba(196,30,58,0.18))',
        mixBlendMode: 'multiply',
        maskImage: featherMask,
        WebkitMaskImage: featherMask,
      }}
    />
  );
}

// ─── Hand illustration — a stylized realistic hand wearing the showcase
// polishes on each of its 5 nails. SVG so it scales crisply to any size
// the parent container provides. Used as a fallback if the hero photo is
// missing.
//
// Anatomy (viewBox 240 × 320):
//   • Palm/wrist block at the bottom (~y 200–320)
//   • 5 fingers fanning upward, each with knuckle creases
//   • Each finger ends in a nail oval that takes its polish color
//
// `polishes` is the 5-item showcase array (thumb → pinky).
function HandShowcase({ polishes }: { polishes: Polish[] }) {
  const SKIN = '#f0c8a6';
  const SKIN_SHADE = '#d9a888';
  const SKIN_DEEP = '#b6815f';

  // Finger geometry — each entry: [tipX, tipY, baseX, baseY, width, tilt°]
  // Thumb sits low and angles outward; middle is tallest.
  const fingers = [
    { tip: [54, 154],  base: [82, 230],  w: 28, nailW: 22, nailH: 26 }, // thumb
    { tip: [92, 32],   base: [102, 196], w: 26, nailW: 22, nailH: 28 }, // index
    { tip: [124, 14],  base: [128, 196], w: 28, nailW: 24, nailH: 30 }, // middle
    { tip: [156, 32],  base: [154, 196], w: 26, nailW: 22, nailH: 28 }, // ring
    { tip: [190, 56],  base: [180, 196], w: 24, nailW: 20, nailH: 24 }, // pinky
  ];

  return (
    <svg
      viewBox="0 0 240 320"
      className="h-full max-h-full w-auto"
      style={{ filter: 'drop-shadow(0 20px 40px rgba(196,30,58,0.18))' }}
      aria-label="Hand wearing showcase nail polishes"
    >
      <defs>
        <linearGradient id="hand-skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SKIN} />
          <stop offset="100%" stopColor={SKIN_SHADE} />
        </linearGradient>
        <radialGradient id="palm-shade" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0%" stopColor={SKIN} />
          <stop offset="100%" stopColor={SKIN_SHADE} />
        </radialGradient>
      </defs>

      {/* Palm + wrist — the base the fingers attach to */}
      <path
        d="
          M 56 230
          C 50 220, 50 210, 56 204
          C 60 198, 70 196, 82 198
          L 184 198
          C 196 196, 206 200, 210 210
          C 214 220, 212 240, 204 260
          C 198 280, 188 300, 170 312
          C 150 320, 110 320, 90 312
          C 72 300, 60 280, 56 260
          Z
        "
        fill="url(#palm-shade)"
      />
      {/* Palm shading — subtle curve along the thumb side */}
      <path
        d="M 56 220 C 64 230, 72 248, 70 270 C 68 285, 78 300, 90 308"
        stroke={SKIN_DEEP}
        strokeWidth="1"
        fill="none"
        opacity="0.35"
      />

      {/* Fingers — drawn back-to-front for natural depth */}
      {fingers.map((f, i) => {
        const polish = polishes[i];
        if (!polish) return null;
        const [tipX, tipY] = f.tip;
        const [baseX, baseY] = f.base;
        // Build a capsule-ish finger path from base to tip
        const dx = tipX - baseX;
        const dy = tipY - baseY;
        const len = Math.hypot(dx, dy);
        const nx = -dy / len; // perpendicular for width
        const ny = dx / len;
        const halfW = f.w / 2;
        const b1x = baseX + nx * halfW;
        const b1y = baseY + ny * halfW;
        const b2x = baseX - nx * halfW;
        const b2y = baseY - ny * halfW;
        const t1x = tipX + nx * (halfW * 0.78);
        const t1y = tipY + ny * (halfW * 0.78);
        const t2x = tipX - nx * (halfW * 0.78);
        const t2y = tipY - ny * (halfW * 0.78);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;

        // Knuckle crease — thin line ~40% up from the base
        const k1x = baseX + dx * 0.42 + nx * halfW * 0.85;
        const k1y = baseY + dy * 0.42 + ny * halfW * 0.85;
        const k2x = baseX + dx * 0.42 - nx * halfW * 0.85;
        const k2y = baseY + dy * 0.42 - ny * halfW * 0.85;

        return (
          <g key={i}>
            {/* Finger body */}
            <path
              d={`
                M ${b1x} ${b1y}
                L ${t1x} ${t1y}
                Q ${tipX + nx * 0.5} ${tipY + ny * 0.5},
                  ${t2x} ${t2y}
                L ${b2x} ${b2y}
                Z
              `}
              fill="url(#hand-skin)"
            />
            {/* Knuckle crease */}
            <line
              x1={k1x} y1={k1y} x2={k2x} y2={k2y}
              stroke={SKIN_DEEP}
              strokeWidth="0.6"
              opacity="0.4"
            />
            {/* Cuticle shadow — thin band just below the nail */}
            <ellipse
              cx={tipX} cy={tipY + 2}
              rx={f.nailW / 2 + 1}
              ry={2}
              fill={SKIN_DEEP}
              opacity="0.25"
              transform={`rotate(${angle - 90} ${tipX} ${tipY + 2})`}
            />
            {/* Nail */}
            <NailOnFinger
              cx={tipX}
              cy={tipY}
              w={f.nailW}
              h={f.nailH}
              rotation={angle - 90}
              polish={polish}
              id={`nail-${i}`}
            />
          </g>
        );
      })}
    </svg>
  );
}

// Renders a single nail at (cx, cy), rotated to follow the finger axis,
// filled with the polish color plus any design overlay. Uses inline
// gradients so each nail gets its own depth shading.
function NailOnFinger({
  cx, cy, w, h, rotation, polish, id,
}: {
  cx: number; cy: number; w: number; h: number; rotation: number; polish: Polish; id: string;
}) {
  const accent = polish.accent || '#ffffff';
  const half = { w: w / 2, h: h / 2 };
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rotation})`}>
      <defs>
        <linearGradient id={`${id}-base`} x1="0" y1="-1" x2="0" y2="1">
          <stop offset="0%" stopColor={lighten(polish.color, 18)} />
          <stop offset="60%" stopColor={polish.color} />
          <stop offset="100%" stopColor={darken(polish.color, 12)} />
        </linearGradient>
        <radialGradient id={`${id}-sheen`} cx="0.35" cy="0.3" r="0.5">
          <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          {/* Almond nail outline */}
          <path d={`
            M ${-half.w} ${half.h * 0.4}
            Q ${-half.w} ${-half.h}, 0 ${-half.h}
            Q ${half.w} ${-half.h}, ${half.w} ${half.h * 0.4}
            Q ${half.w * 0.7} ${half.h}, 0 ${half.h}
            Q ${-half.w * 0.7} ${half.h}, ${-half.w} ${half.h * 0.4}
            Z
          `} />
        </clipPath>
      </defs>

      {/* Base color */}
      <rect
        x={-half.w} y={-half.h}
        width={w} height={h}
        fill={`url(#${id}-base)`}
        clipPath={`url(#${id}-clip)`}
      />

      {/* Design overlay — rendered through Canvas-style logic */}
      {polish.design && (
        <g clipPath={`url(#${id}-clip)`}>
          {polish.design === 'french' && (
            <ellipse cx={0} cy={-half.h * 0.55} rx={half.w * 0.95} ry={half.h * 0.45} fill={accent} />
          )}
          {polish.design === 'reverse-french' && (
            <ellipse cx={0} cy={half.h * 0.65} rx={half.w * 0.95} ry={half.h * 0.4} fill={accent} />
          )}
          {polish.design === 'gradient' && (
            <rect x={-half.w} y={-half.h} width={w} height={h}
              fill={`url(#${id}-base)`}
              style={{ mixBlendMode: 'multiply' }}
            />
          )}
          {polish.design === 'stripe' && (
            <rect x={-half.w * 1.2} y={-half.h * 0.06} width={w * 1.4} height={half.h * 0.12}
              fill={accent}
              transform="rotate(-18)"
            />
          )}
          {polish.design === 'hearts' && (
            <text x={0} y={half.h * 0.18} fontSize={h * 0.5} fill={accent} textAnchor="middle">♥</text>
          )}
          {polish.design === 'stars' && (
            <text x={0} y={half.h * 0.18} fontSize={h * 0.45} fill={accent} textAnchor="middle">★</text>
          )}
          {polish.design === 'flowers' && (
            <text x={0} y={half.h * 0.22} fontSize={h * 0.5} fill={accent} textAnchor="middle">✿</text>
          )}
          {polish.design === 'glitter-tip' && Array.from({ length: 14 }).map((_, k) => {
            const r = pseudoRand(k * 7);
            const r2 = pseudoRand(k * 11);
            return <circle key={k} cx={(r - 0.5) * w * 0.9} cy={-half.h * 0.65 + r2 * half.h * 0.6} r={0.5 + r2 * 0.8} fill={accent} />;
          })}
        </g>
      )}

      {/* Glossy top sheen */}
      <ellipse
        cx={-half.w * 0.2}
        cy={-half.h * 0.45}
        rx={half.w * 0.55}
        ry={half.h * 0.32}
        fill={`url(#${id}-sheen)`}
        clipPath={`url(#${id}-clip)`}
      />

      {/* Nail outline */}
      <path
        d={`
          M ${-half.w} ${half.h * 0.4}
          Q ${-half.w} ${-half.h}, 0 ${-half.h}
          Q ${half.w} ${-half.h}, ${half.w} ${half.h * 0.4}
          Q ${half.w * 0.7} ${half.h}, 0 ${half.h}
          Q ${-half.w * 0.7} ${half.h}, ${-half.w} ${half.h * 0.4}
          Z
        `}
        fill="none"
        stroke="rgba(0,0,0,0.12)"
        strokeWidth="0.5"
      />
    </g>
  );
}

// ─── Desktop floating showcase ─────────────────────────────────────
// Replaces the old vertical marquee with a bento-style composition:
// a featured hand photo (or SVG fallback) in the centre + 8 nail
// polish tiles drifting around it. Tiles are interactive — tapping
// one opens the live camera with that polish already on every nail.
function FeaturedDesignsShowcase({
  designs,
  showcase,
  onPick,
}: {
  designs: Polish[];
  showcase: Polish[];
  onPick: (p: Polish) => void;
}) {
  // 8 fixed slots around the central hand. Each cell lives in an
  // absolutely positioned wrapper with its own float animation so the
  // composition feels alive without an explicit carousel.
  const positions: { top: string; left?: string; right?: string; anim: string; delay: number; size: number; rotation: number }[] = [
    { top: '4%',  left: '4%',   anim: 'a', delay: 0,    size: 110, rotation: -8 },
    { top: '6%',  left: '40%',  anim: 'b', delay: 0.6,  size: 95,  rotation: -3 },
    { top: '0%',  right: '6%',  anim: 'c', delay: 1.2,  size: 120, rotation: 6 },
    { top: '38%', left: '0%',   anim: 'b', delay: 1.8,  size: 100, rotation: -10 },
    { top: '36%', right: '0%',  anim: 'a', delay: 0.4,  size: 105, rotation: 8 },
    { top: '70%', left: '10%',  anim: 'c', delay: 2.0,  size: 95,  rotation: -5 },
    { top: '74%', left: '42%',  anim: 'a', delay: 1.4,  size: 110, rotation: 3 },
    { top: '68%', right: '8%',  anim: 'b', delay: 2.6,  size: 100, rotation: -2 },
  ];

  return (
    <div className="relative h-full w-full max-h-[680px]">
      {/* Soft pink glow behind the centerpiece for depth */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[55%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,111,168,0.35) 0%, transparent 60%)',
          animation: 'tryon-glow 6s ease-in-out infinite',
        }}
      />

      {/* Centerpiece — real hand photo if available, SVG hand as fallback */}
      <div
        className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
        style={{ width: '52%', maxHeight: '85%' }}
      >
        <HandHeroImage polishes={showcase} />
      </div>

      {/* Floating design tiles */}
      {designs.map((p, i) => {
        const pos = positions[i] || positions[0];
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p)}
            className="absolute group cursor-pointer"
            style={{
              top: pos.top,
              left: pos.left,
              right: pos.right,
              width: pos.size,
              height: pos.size * 1.25,
              animation: `tryon-float-${pos.anim} ${5 + (i % 3)}s ease-in-out infinite`,
              animationDelay: `${pos.delay}s`,
              transform: `rotate(${pos.rotation}deg)`,
            }}
            aria-label={`Try ${p.name}`}
            title={p.name}
          >
            <FloatingDesignTile polish={p} />
          </button>
        );
      })}
    </div>
  );
}

// A single floating tile — a glossy nail-shaped chip with the design
// rendered on it, plus a label that fades up on hover. Tappable.
function FloatingDesignTile({ polish }: { polish: Polish }) {
  return (
    <div className="relative h-full w-full transition-transform group-hover:scale-110">
      {/* Drop shadow halo (color-matched to the polish) */}
      <div
        className="absolute inset-x-0 -bottom-3 h-6 rounded-full blur-xl opacity-60"
        style={{ background: polish.color }}
      />
      {/* Nail-shaped tile */}
      <div
        className="relative h-full w-full overflow-hidden"
        style={{
          background: `linear-gradient(160deg, ${polish.color} 0%, ${polish.accent || polish.color} 100%)`,
          borderRadius: '50% 50% 22% 22% / 60% 60% 18% 18%',
          boxShadow: `
            inset 0 -14px 24px rgba(0,0,0,0.22),
            inset 0 8px 16px rgba(255,255,255,0.35),
            0 14px 32px -12px ${polish.color}cc,
            0 0 0 1px rgba(255,255,255,0.45)
          `,
        }}
      >
        {/* Top-left sheen */}
        <span
          className="pointer-events-none absolute"
          style={{
            top: '8%', left: '14%', width: '38%', height: '28%',
            background: 'radial-gradient(ellipse, rgba(255,255,255,0.55) 0%, transparent 70%)',
            filter: 'blur(2px)',
            borderRadius: '50%',
          }}
        />
        {/* Design overlay if any */}
        {polish.design && (
          <SwatchDesign design={polish.design} accent={polish.accent || '#fff'} base={polish.color} />
        )}
        {!polish.design && polish.finish === 'chrome' && (
          <span
            className="pointer-events-none absolute inset-1"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, transparent 50%, rgba(255,255,255,0.18) 100%)',
              borderRadius: 'inherit',
            }}
          />
        )}
        {!polish.design && polish.finish === 'glitter' && (
          <span
            className="pointer-events-none absolute inset-0 opacity-75"
            style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 0.6px, transparent 1.2px)',
              backgroundSize: '6px 6px',
              borderRadius: 'inherit',
            }}
          />
        )}
      </div>

      {/* Label — fades in on hover */}
      <span
        className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          background: 'rgba(26,26,46,0.85)',
          color: 'white',
          backdropFilter: 'blur(8px)',
        }}
      >
        {polish.name}
      </span>
    </div>
  );
}

// ─── Camera / AR view — the real-time try-on with palette + capture ──────
function CameraView({
  initialPolishes,
  onSavePolishes,
  onBack,
}: {
  initialPolishes: Record<number, Polish>;
  onSavePolishes: (p: Record<number, Polish>) => void;
  onBack: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  // Per-finger polish map (0=thumb … 4=pinky). Both hands share the same
  // map for symmetry — mismatched manicures stay consistent left/right.
  // Seeded from `initialPolishes` (whatever the parent picked on the
  // Discover view) and lifted back to the parent on every change so the
  // selection persists across Discover ↔ Camera mode switches.
  const polishesRef = useRef<Record<number, Polish>>(initialPolishes);

  const [perNailPolishes, setPerNailPolishes] = useState<Record<number, Polish>>(initialPolishes);
  useEffect(() => {
    polishesRef.current = perNailPolishes;
    onSavePolishes(perNailPolishes);
  }, [perNailPolishes, onSavePolishes]);

  // 'all' = next palette tap applies to every nail; 0..4 = target one finger.
  const [selectedFinger, setSelectedFinger] = useState<'all' | number>('all');

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
            drawNails(ctx, lm, w, h, facingMode === 'user', polishesRef.current);
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
    a.download = `nail-tryon-${perNailPolishes[0]?.id || 'mix'}-${Date.now()}.png`;
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
          onClick={onBack}
          aria-label="Back to designs"
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
                onClick={onBack}
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
        {/* Finger selector — pick which nail the next palette tap applies to */}
        <FingerSelector
          selected={selectedFinger}
          onChange={setSelectedFinger}
          polishes={perNailPolishes}
        />

        {/* Selected polish label — shows current finger's polish (or All) */}
        {(() => {
          const display = selectedFinger === 'all' ? perNailPolishes[0] : perNailPolishes[selectedFinger];
          const prefix = selectedFinger === 'all'
            ? null
            : ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'][selectedFinger];
          return (
            <div className="flex items-center justify-center gap-2 text-xs">
              {prefix && (
                <span className="text-white/55 text-[10px] uppercase tracking-[0.18em]">{prefix} ·</span>
              )}
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: display.color, boxShadow: `0 0 12px ${display.color}aa` }} />
              <span className="font-semibold">{display.name}</span>
              <span className="text-white/45">·</span>
              <span className="text-white/55 capitalize">{display.finish}</span>
            </div>
          );
        })()}

        {/* Color palette — horizontal scroll. Tapping applies to the selected
            finger (or to all five if 'all' is selected). */}
        <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
          {POLISHES.map((p) => {
            const isCurrent = selectedFinger === 'all'
              ? Object.values(perNailPolishes).every((q) => q.id === p.id)
              : perNailPolishes[selectedFinger]?.id === p.id;
            return (
            <button
              key={p.id}
              onClick={() => {
                setPerNailPolishes((prev) => {
                  if (selectedFinger === 'all') {
                    return { 0: p, 1: p, 2: p, 3: p, 4: p };
                  }
                  return { ...prev, [selectedFinger]: p };
                });
              }}
              aria-label={p.name}
              title={p.name}
              className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full cursor-pointer transition-transform"
              style={{
                background: p.color,
                border: isCurrent ? '2px solid white' : '2px solid rgba(255,255,255,0.15)',
                boxShadow: isCurrent
                  ? `0 0 0 3px rgba(0,212,255,0.6), 0 4px 12px ${p.color}66`
                  : `0 4px 8px rgba(0,0,0,0.4)`,
                transform: isCurrent ? 'scale(1.08)' : 'scale(1)',
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
            );
          })}
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

// ─── Photo Try-on view — same nail-overlay pipeline as the live camera,
// but applied to a single uploaded image (gallery pick or camera capture).
// Flow:
//   1. picker — show "Take Photo" + "From Album" CTAs
//   2. loading — load MediaPipe (IMAGE mode), decode image, run detection
//   3. ready — paint nails on a canvas; user swaps polishes; canvas re-renders
//   4. error — no hand detected → suggest a clearer photo

// Default model hand image — shown immediately on Photo Try-on entry so
// users see a result the moment they tap the CTA (matches YouCam Nails).
// Falls back to the marketing hero image if the dedicated model isn't
// dropped in yet. Replace by adding a clean hand photo at
// /public/images/try-on/photo-default.jpg.
const PHOTO_DEFAULT_CANDIDATES = [
  '/images/try-on/photo-default.jpg',
  '/images/try-on/hand-hero.jpg',
];

type PhotoTab = 'looks' | 'color' | 'prints' | 'patterns';

// Categorise the polish catalog by YouCam Nails' tab taxonomy. Each polish
// can belong to exactly one category in the bottom-panel tabs.
// • Color    — solid polishes with no design (finish dictates look)
// • Prints   — designs with figure/character motifs (hearts, smiley, etc.)
// • Patterns — designs that fill the whole nail with a pattern/effect
const PRINT_DESIGNS = new Set<Design>([
  'hearts', 'stars', 'flowers', 'cherry', 'smiley', 'butterfly', 'bow', 'daisy',
]);
const PATTERN_DESIGNS = new Set<Design>([
  'french', 'reverse-french', 'gradient', 'glitter-tip', 'dots', 'stripe',
  'galaxy', 'leopard', 'aura', 'glazed', 'wavy-french', 'cow', 'cat-eye',
  'flame',
]);

const COLOR_POLISHES = POLISHES.filter((p) => !p.design);
const PRINT_POLISHES = POLISHES.filter((p) => p.design && PRINT_DESIGNS.has(p.design));
const PATTERN_POLISHES = POLISHES.filter((p) => p.design && PATTERN_DESIGNS.has(p.design));

function PhotoView({
  initialPolishes,
  onSavePolishes,
  onBack,
}: {
  initialPolishes: Record<number, Polish>;
  onSavePolishes: (p: Record<number, Polish>) => void;
  onBack: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const handsRef = useRef<HandLandmark[][]>([]);
  const polishesRef = useRef<Record<number, Polish>>(initialPolishes);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const albumInputRef = useRef<HTMLInputElement | null>(null);

  const [perNailPolishes, setPerNailPolishes] = useState<Record<number, Polish>>(initialPolishes);
  const [selectedFinger, setSelectedFinger] = useState<'all' | number>('all');
  // phase = 'loading' on initial mount → auto-load the default hand;
  // 'ready' once detection succeeds; 'error' if detection fails; 'no-hand'
  // when the user uploads a photo without a visible hand (separate from
  // generic error so we can keep showing the previous result underneath).
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error' | 'no-hand'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PhotoTab>('looks');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeLookId, setActiveLookId] = useState<string | null>(null);
  // Tracks whether the result currently shown is the built-in default
  // model — used to label retake CTAs ("Use my photo" vs "New photo").
  const [usingDefault, setUsingDefault] = useState(true);

  // Lazy-init MediaPipe HandLandmarker (IMAGE mode). Re-uses the same
  // CDN-hosted model as CameraView so users only download it once.
  const ensureLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
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
      runningMode: 'IMAGE',
      numHands: 2,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)) as unknown as HandLandmarker & {
      detect: (img: HTMLImageElement | HTMLCanvasElement) => {
        landmarks: HandLandmark[][];
        handedness?: { categoryName: string }[][];
      };
    };
    landmarkerRef.current = landmarker;
    return landmarker;
  }, []);

  // Repaints the canvas with the source image + current polishes overlay.
  // Called both after detection and any time the polish map changes.
  const renderResult = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const hands = handsRef.current;
    if (!canvas || !img) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    for (const lm of hands) {
      drawNails(ctx, lm, canvas.width, canvas.height, false, polishesRef.current);
    }
  }, []);

  // Repaint whenever the polish map changes (live preview while user taps colors).
  useEffect(() => {
    polishesRef.current = perNailPolishes;
    onSavePolishes(perNailPolishes);
    if (phase === 'ready') renderResult();
  }, [perNailPolishes, phase, renderResult, onSavePolishes]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  // Shared "load image + run detection + paint" routine. `isDefault`
  // tracks whether the source is the built-in model hand or a user pick.
  const loadAndDetect = useCallback(async (
    sourceUrl: string,
    isDefault: boolean,
    revokeAfter = false,
  ) => {
    setErrorMsg('');
    try {
      const landmarker = await ensureLandmarker() as HandLandmarker & {
        detect: (img: HTMLImageElement) => {
          landmarks: HandLandmark[][];
          handedness?: { categoryName: string }[][];
        };
      };

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error(isDefault ? 'default-missing' : 'Could not load image'));
        el.src = sourceUrl;
      });

      // Downscale large photos for fast detection + render.
      const MAX_EDGE = 1600;
      const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
      let target: HTMLImageElement = img;
      if (longEdge > MAX_EDGE) {
        const scale = MAX_EDGE / longEdge;
        const off = document.createElement('canvas');
        off.width = Math.round(img.naturalWidth * scale);
        off.height = Math.round(img.naturalHeight * scale);
        const offCtx = off.getContext('2d');
        if (offCtx) {
          offCtx.drawImage(img, 0, 0, off.width, off.height);
          const scaled = new Image();
          scaled.src = off.toDataURL('image/jpeg', 0.9);
          await new Promise((r) => { scaled.onload = r; });
          target = scaled;
        }
      }
      imageRef.current = target;

      const result = landmarker.detect(target);
      const hands = result.landmarks || [];

      if (revokeAfter) URL.revokeObjectURL(sourceUrl);

      if (!hands.length) {
        if (isDefault) {
          // The bundled default has no hand — most likely the asset isn't
          // dropped in yet. Show a friendly error rather than the generic
          // "no hand" so the developer knows what's happening.
          setErrorMsg('Default model image is missing — drop a hand photo at /public/images/try-on/photo-default.jpg or use your own photo.');
          setPhase('error');
        } else {
          setErrorMsg('No hand detected — try a clearer photo with your whole hand visible and fingers spread.');
          setPhase('no-hand');
        }
        return;
      }

      handsRef.current = hands;
      setUsingDefault(isDefault);
      setPhase('ready');
      requestAnimationFrame(() => renderResult());
    } catch (err) {
      const e = err as { message?: string } | undefined;
      if (e?.message === 'default-missing') {
        setErrorMsg('Default model image is missing — drop a hand photo at /public/images/try-on/photo-default.jpg or use your own photo.');
      } else {
        setErrorMsg(e?.message || 'Could not analyse the photo.');
      }
      setPhase('error');
    }
  }, [ensureLandmarker, renderResult]);

  // ── Auto-load default model hand on mount ────────────────────────────
  // Tries each candidate path in order so the page works whether the
  // dedicated `photo-default.jpg` is dropped in or only the marketing
  // `hand-hero.jpg` exists.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const url of PHOTO_DEFAULT_CANDIDATES) {
        if (cancelled) return;
        // Probe the URL with a HEAD-ish image load before running detection.
        const ok = await new Promise<boolean>((resolve) => {
          const probe = new Image();
          probe.onload = () => resolve(true);
          probe.onerror = () => resolve(false);
          probe.src = url;
        });
        if (cancelled) return;
        if (!ok) continue;
        await loadAndDetect(url, true);
        return;
      }
      if (!cancelled) {
        setErrorMsg('No default model image found. Drop a hand photo at /public/images/try-on/photo-default.jpg or tap the camera icon to use your own.');
        setPhase('error');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = useCallback(async (file: File | null | undefined) => {
    if (!file) return;
    setPickerOpen(false);
    setPhase('loading');
    const url = URL.createObjectURL(file);
    await loadAndDetect(url, false, true);
  }, [loadAndDetect]);

  const onPickFromCamera = () => { setPickerOpen(false); cameraInputRef.current?.click(); };
  const onPickFromAlbum = () => { setPickerOpen(false); albumInputRef.current?.click(); };

  const onSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSnapshot(canvas.toDataURL('image/jpeg', 0.92));
  };

  const downloadSnapshot = () => {
    if (!snapshot) return;
    const a = document.createElement('a');
    a.href = snapshot;
    a.download = `nail-photo-${perNailPolishes[0]?.id || 'mix'}-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Apply a preset Look — paints all 5 nails in one tap.
  const applyLook = (look: Look) => {
    setActiveLookId(look.id);
    setPerNailPolishes({
      0: look.polishes[0],
      1: look.polishes[1],
      2: look.polishes[2],
      3: look.polishes[3],
      4: look.polishes[4],
    });
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-white text-[#1a1a2e]">
      {/* Top bar — home / camera / save (YouCam-style) */}
      <header className="relative z-20 flex shrink-0 items-center justify-between border-b border-black/5 bg-white px-4 py-3">
        <button
          onClick={onBack}
          aria-label="Back home"
          className="flex h-10 w-10 items-center justify-center rounded-full cursor-pointer hover:bg-black/5"
        >
          <ArrowLeft size={18} />
        </button>
        <button
          onClick={() => setPickerOpen(true)}
          aria-label="Use my own photo"
          className="flex h-10 w-10 items-center justify-center rounded-full cursor-pointer hover:bg-black/5"
        >
          <Camera size={20} />
        </button>
        <button
          onClick={onSave}
          disabled={phase !== 'ready'}
          className="rounded-full px-4 py-2 text-sm font-bold cursor-pointer disabled:opacity-40"
          style={{
            background: 'linear-gradient(135deg, #ff6fa8, #c41e3a)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Save
        </button>
      </header>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={albumInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {/* Canvas stage */}
      <div className="relative flex flex-1 min-h-0 items-center justify-center bg-white">
        {phase === 'ready' && (
          <canvas
            ref={canvasRef}
            className="max-h-full max-w-full object-contain"
          />
        )}

        {/* Loading veil */}
        <AnimatePresence>
          {phase === 'loading' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-white"
            >
              <Loader2 size={32} className="animate-spin text-[#c41e3a]" />
              <p className="mt-4 text-sm font-semibold">Loading…</p>
              <p className="mt-1 text-xs text-[#1a1a2e]/55">Finding the nails</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* No-hand banner — non-blocking, overlays the previous result */}
        <AnimatePresence>
          {phase === 'no-hand' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute left-1/2 top-4 z-10 -translate-x-1/2 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-lg"
              style={{ background: '#fff', border: '1px solid rgba(248,113,113,0.4)', color: '#c41e3a' }}
            >
              <AlertTriangle size={14} />
              <span>No hand detected — try a clearer photo.</span>
              <button
                onClick={() => setPhase('ready')}
                className="ml-1 cursor-pointer rounded-full p-1 hover:bg-black/5"
                aria-label="Dismiss"
              >
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error veil */}
        <AnimatePresence>
          {phase === 'error' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-white px-8 text-center"
            >
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(248,113,113,0.12)', color: '#c41e3a' }}>
                <AlertTriangle size={24} />
              </div>
              <p className="text-base font-bold">Couldn&apos;t load model hand</p>
              <p className="mt-1.5 max-w-sm text-sm text-[#1a1a2e]/70">{errorMsg}</p>
              <div className="mt-5 flex items-center gap-2">
                <button
                  onClick={onBack}
                  className="rounded-xl px-5 py-2.5 text-sm font-semibold cursor-pointer"
                  style={{ background: 'rgba(0,0,0,0.05)' }}
                >
                  Go back
                </button>
                <button
                  onClick={() => setPickerOpen(true)}
                  className="rounded-xl px-5 py-2.5 text-sm font-bold cursor-pointer text-white"
                  style={{ background: 'linear-gradient(135deg, #ff6fa8, #c41e3a)' }}
                >
                  Use my photo
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom panel — Looks/Color carousel + tab bar */}
      {(phase === 'ready' || phase === 'no-hand') && (
        <div className="relative z-10 shrink-0 border-t border-black/5 bg-[#fafafa]">
          {/* Carousel — content depends on active tab */}
          <div className="px-3 pt-3">
            {activeTab === 'looks' ? (
              <div className="flex gap-3 overflow-x-auto pb-3 [&::-webkit-scrollbar]:hidden">
                {/* "Original" tile — clears the manicure (uses a barely-tinted polish) */}
                <button
                  onClick={() => {
                    const bare = POLISHES.find((p) => p.id === 'pearl-white') || POLISHES[0];
                    setActiveLookId(null);
                    setPerNailPolishes({ 0: bare, 1: bare, 2: bare, 3: bare, 4: bare });
                  }}
                  className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
                  aria-label="Clear look"
                >
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full"
                    style={{
                      background: 'white',
                      border: activeLookId === null ? '2px solid #c41e3a' : '2px solid rgba(0,0,0,0.1)',
                    }}
                  >
                    <X size={18} className="text-[#1a1a2e]/55" />
                  </div>
                  <span className="text-[10px] font-semibold text-[#1a1a2e]/65">Original</span>
                </button>

                {LOOKS.map((look) => {
                  const active = activeLookId === look.id;
                  return (
                    <button
                      key={look.id}
                      onClick={() => applyLook(look)}
                      className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
                      aria-label={`Apply ${look.name}`}
                    >
                      <div
                        className="relative rounded-2xl px-2 py-1.5"
                        style={{
                          background: active ? 'rgba(196,30,58,0.08)' : 'transparent',
                          border: active ? '2px solid #c41e3a' : '2px solid transparent',
                        }}
                      >
                        <LookThumbnail polishes={look.polishes} />
                      </div>
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color: active ? '#c41e3a' : 'rgba(26,26,46,0.65)' }}
                      >
                        {look.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                {/* Color / Prints / Patterns tabs — per-finger picker + filtered palette */}
                <div className="mb-2 flex items-center justify-between px-1">
                  <FingerSelectorLight
                    selected={selectedFinger}
                    onChange={setSelectedFinger}
                    polishes={perNailPolishes}
                  />
                </div>
                {(() => {
                  const palette =
                    activeTab === 'color' ? COLOR_POLISHES
                    : activeTab === 'prints' ? PRINT_POLISHES
                    : PATTERN_POLISHES;
                  return (
                    <div className="flex gap-2 overflow-x-auto pb-3 [&::-webkit-scrollbar]:hidden">
                      {palette.map((p) => {
                        const isCurrent = selectedFinger === 'all'
                          ? Object.values(perNailPolishes).every((q) => q.id === p.id)
                          : perNailPolishes[selectedFinger]?.id === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              setActiveLookId(null);
                              setPerNailPolishes((prev) => {
                                if (selectedFinger === 'all') {
                                  return { 0: p, 1: p, 2: p, 3: p, 4: p };
                                }
                                return { ...prev, [selectedFinger]: p };
                              });
                            }}
                            aria-label={p.name}
                            title={p.name}
                            className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full cursor-pointer transition-transform"
                            style={{
                              background: p.color,
                              border: isCurrent ? '2px solid #c41e3a' : '2px solid rgba(0,0,0,0.08)',
                              boxShadow: isCurrent
                                ? `0 0 0 3px rgba(196,30,58,0.18), 0 4px 12px ${p.color}66`
                                : `0 2px 6px rgba(0,0,0,0.08)`,
                              transform: isCurrent ? 'scale(1.08)' : 'scale(1)',
                            }}
                          >
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
                            {p.design && <SwatchDesign design={p.design} accent={p.accent || '#ffffff'} base={p.color} />}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          {/* Tab bar — matches YouCam Nails taxonomy. Shape + Hand are
              visible but stubbed (toast on tap) so the layout reads
              identically to the reference while the underlying renderer
              support catches up. */}
          <div className="grid grid-cols-6 border-t border-black/5">
            <PhotoTabButton
              icon={<Palette size={16} />}
              label="Color"
              active={activeTab === 'color'}
              onClick={() => setActiveTab('color')}
            />
            <PhotoTabButton
              icon={<Heart size={16} />}
              label="Looks"
              active={activeTab === 'looks'}
              onClick={() => setActiveTab('looks')}
            />
            <PhotoTabButton
              icon={<Stamp size={16} />}
              label="Prints"
              active={activeTab === 'prints'}
              onClick={() => setActiveTab('prints')}
            />
            <PhotoTabButton
              icon={<Layers size={16} />}
              label="Patterns"
              active={activeTab === 'patterns'}
              onClick={() => setActiveTab('patterns')}
            />
            <PhotoTabButton
              icon={<Hexagon size={16} />}
              label="Shape"
              active={false}
              onClick={() => toast.message('Shape', { description: 'Pick a nail shape — coming soon (square, oval, almond, coffin, stiletto).' })}
            />
            <PhotoTabButton
              icon={<Hand size={16} />}
              label="Hand"
              active={false}
              onClick={() => toast.message('Hand', { description: 'Switch model hand + skin tone — coming soon.' })}
            />
          </div>
        </div>
      )}

      {/* Picker sheet — opens when user taps the camera icon */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-end"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            onClick={() => setPickerOpen(false)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8"
            >
              <div className="mb-2 flex justify-center">
                <span className="h-1.5 w-10 rounded-full bg-black/10" />
              </div>
              <h2 className="text-center text-lg font-black text-[#1a1a2e]">Use your own photo</h2>
              <p className="mt-1 text-center text-xs text-[#1a1a2e]/55">
                Best results: palm facing down, fingers spread, good lighting.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={onPickFromCamera}
                  className="flex flex-col items-center gap-2 rounded-2xl px-4 py-5 cursor-pointer transition-transform active:scale-[0.97]"
                  style={{ background: 'rgba(196,30,58,0.06)', border: '1px solid rgba(196,30,58,0.12)' }}
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ background: 'linear-gradient(135deg, #ff6fa8, #c41e3a)' }}
                  >
                    <Camera size={20} className="text-white" />
                  </div>
                  <span className="text-sm font-bold">Take Photo</span>
                </button>
                <button
                  onClick={onPickFromAlbum}
                  className="flex flex-col items-center gap-2 rounded-2xl px-4 py-5 cursor-pointer transition-transform active:scale-[0.97]"
                  style={{ background: 'rgba(91,141,239,0.06)', border: '1px solid rgba(91,141,239,0.15)' }}
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ background: 'linear-gradient(135deg, #6ec5ff, #5b8def)' }}
                  >
                    <ImageIcon size={20} className="text-white" />
                  </div>
                  <span className="text-sm font-bold">From Album</span>
                </button>
              </div>
              {!usingDefault && (
                <button
                  onClick={() => {
                    setPickerOpen(false);
                    setPhase('loading');
                    void (async () => {
                      for (const url of PHOTO_DEFAULT_CANDIDATES) {
                        const ok = await new Promise<boolean>((resolve) => {
                          const probe = new Image();
                          probe.onload = () => resolve(true);
                          probe.onerror = () => resolve(false);
                          probe.src = url;
                        });
                        if (ok) {
                          await loadAndDetect(url, true);
                          return;
                        }
                      }
                    })();
                  }}
                  className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold cursor-pointer"
                  style={{ background: 'rgba(0,0,0,0.04)' }}
                >
                  Use model hand instead
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">Your look</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={snapshot}
              alt="Photo try-on result"
              className="max-h-[60vh] w-full max-w-md rounded-2xl object-contain"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <div className="mt-4 flex w-full max-w-md items-center gap-2">
              <button
                onClick={() => setSnapshot(null)}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}
              >
                Back
              </button>
              <button
                onClick={downloadSnapshot}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold cursor-pointer"
                style={{ background: '#6ec5ff', color: '#0a0b0f' }}
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

  // ─── 2026 trending designs ──────────────────────────────────────────
  if (design === 'aura') {
    return (
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${accent}cc 0%, ${accent}66 25%, transparent 55%)`,
          borderRadius: 'inherit',
          mixBlendMode: 'screen',
        }}
      />
    );
  }
  if (design === 'glazed') {
    return (
      <>
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(255,222,234,0.25) 35%, rgba(200,222,255,0.25) 65%, rgba(255,255,255,0.45) 100%)',
            borderRadius: 'inherit',
          }}
        />
        <span
          className="pointer-events-none absolute"
          style={{
            top: '10%', left: '18%', width: '34%', height: '28%',
            background: 'radial-gradient(ellipse, rgba(255,255,255,0.8), transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(2px)',
          }}
        />
      </>
    );
  }
  if (design === 'wavy-french') {
    return (
      <svg
        viewBox="0 0 40 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 top-0 h-2/5 w-full"
        aria-hidden
      >
        <defs>
          <clipPath id="wf-clip" clipPathUnits="objectBoundingBox">
            <path d="M0,0 L1,0 L1,0.75 C0.85,0.95 0.7,0.55 0.5,0.78 C0.3,1.0 0.15,0.6 0,0.85 Z" />
          </clipPath>
        </defs>
        <rect x="0" y="0" width="40" height="100" fill={accent} clipPath="url(#wf-clip)" />
      </svg>
    );
  }
  if (design === 'cherry') {
    return <SwatchEmoji ch="🍒" color={accent} />;
  }
  if (design === 'smiley') {
    return (
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{ color: '#1a1a1a' }}
      >
        <svg viewBox="0 0 24 24" width="55%" height="55%" aria-hidden>
          <circle cx="12" cy="12" r="10" fill={accent} />
          <circle cx="9" cy="10" r="1.4" fill="#1a1a1a" />
          <circle cx="15" cy="10" r="1.4" fill="#1a1a1a" />
          <path d="M8 14 Q12 18 16 14" stroke="#1a1a1a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  if (design === 'butterfly') {
    return <SwatchEmoji ch="🦋" color={accent} />;
  }
  if (design === 'bow') {
    return (
      <span
        className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center text-[14px]"
        aria-hidden
      >
        🎀
      </span>
    );
  }
  if (design === 'cow') {
    return (
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 38% 22% at 28% 30%, ${accent} 60%, transparent 62%),
            radial-gradient(ellipse 30% 18% at 70% 55%, ${accent} 60%, transparent 62%),
            radial-gradient(ellipse 22% 14% at 30% 75%, ${accent} 60%, transparent 62%)
          `,
          borderRadius: 'inherit',
          opacity: 0.95,
        }}
      />
    );
  }
  if (design === 'daisy') {
    return (
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" width="60%" height="60%">
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i * 72 * Math.PI) / 180;
            const cx = 12 + Math.cos(a - Math.PI / 2) * 4.5;
            const cy = 12 + Math.sin(a - Math.PI / 2) * 4.5;
            return <ellipse key={i} cx={cx} cy={cy} rx="2.3" ry="3.4" fill="#ffffff" transform={`rotate(${i * 72} ${cx} ${cy})`} />;
          })}
          <circle cx="12" cy="12" r="2" fill={accent} />
        </svg>
      </span>
    );
  }
  if (design === 'cat-eye') {
    return (
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 90% 18% at 50% 50%, ${accent}, transparent 60%)`,
          borderRadius: 'inherit',
          mixBlendMode: 'screen',
        }}
      />
    );
  }
  if (design === 'flame') {
    return (
      <svg
        viewBox="0 0 40 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="flame-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffcc33" />
            <stop offset="50%" stopColor={accent} />
            <stop offset="100%" stopColor="#c41e3a" />
          </linearGradient>
          <clipPath id="flame-clip" clipPathUnits="objectBoundingBox">
            <path d="M0,0 L1,0 L1,0.55 C0.85,0.85 0.7,0.45 0.55,0.8 C0.4,0.5 0.25,0.95 0.1,0.6 C0.05,0.7 0,0.55 0,0.8 Z" />
          </clipPath>
        </defs>
        <rect x="0" y="0" width="40" height="100" fill="url(#flame-grad)" clipPath="url(#flame-clip)" />
      </svg>
    );
  }
  return null;
}

// ─── Finger selector — pick which nail the next palette tap applies to ──
// 'All' applies to every nail (default). Tapping a specific finger isolates
// edits to that finger; both hands share the same map so the selection
// reads as "Ring fingers" (plural). Each chip shows the current polish
// color of that finger so users can see at a glance what's where.

function FingerSelector({
  selected,
  onChange,
  polishes,
}: {
  selected: 'all' | number;
  onChange: (next: 'all' | number) => void;
  polishes: Record<number, Polish>;
}) {
  const fingers = [
    { idx: 0, label: 'Thumb' },
    { idx: 1, label: 'Index' },
    { idx: 2, label: 'Middle' },
    { idx: 3, label: 'Ring' },
    { idx: 4, label: 'Pinky' },
  ];
  return (
    <div className="flex items-center justify-center gap-1.5 pb-1">
      <button
        onClick={() => onChange('all')}
        className="rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors"
        style={{
          background: selected === 'all' ? 'rgba(0,212,255,0.18)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${selected === 'all' ? 'rgba(0,212,255,0.45)' : 'rgba(255,255,255,0.1)'}`,
          color: selected === 'all' ? '#00d4ff' : '#a3adc3',
        }}
      >
        All
      </button>
      {fingers.map((f) => {
        const active = selected === f.idx;
        const color = polishes[f.idx]?.color || '#888';
        return (
          <button
            key={f.idx}
            onClick={() => onChange(f.idx)}
            title={f.label}
            aria-label={f.label}
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 cursor-pointer transition-colors"
            style={{
              background: active ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${active ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: color, boxShadow: active ? `0 0 8px ${color}88` : 'none' }}
            />
            <span
              className="text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: active ? '#00d4ff' : '#a3adc3' }}
            >
              {f.label}
            </span>
          </button>
        );
      })}
    </div>
  );
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

// ─── PhotoView helpers ─────────────────────────────────────────────────

// Mini hand thumbnail for the "Looks" carousel — 5 mini nail tiles in a
// row, each painted with the look's per-finger polish. Lets users see
// what a look will deliver before applying it.
function LookThumbnail({ polishes }: { polishes: Polish[] }) {
  return (
    <div className="flex h-12 items-end gap-[3px]">
      {polishes.map((p, i) => {
        // Middle finger tallest, thumb/pinky shortest — same proportions
        // as a real hand for instant recognizability.
        const h = [22, 32, 40, 34, 24][i];
        return (
          <div
            key={i}
            className="relative w-3 overflow-hidden"
            style={{
              height: h,
              background: p.color,
              borderRadius: '50% 50% 22% 22% / 60% 60% 18% 18%',
              boxShadow: 'inset 0 -3px 6px rgba(0,0,0,0.18), inset 0 2px 4px rgba(255,255,255,0.4)',
            }}
          >
            {p.design && (
              <SwatchDesign design={p.design} accent={p.accent || '#fff'} base={p.color} />
            )}
            {!p.design && p.finish === 'chrome' && (
              <span
                className="pointer-events-none absolute inset-0"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.55) 0%, transparent 60%)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Light-theme tab button for the Photo Try-on bottom panel.
function PhotoTabButton({
  icon, label, active, onClick,
}: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 py-3 cursor-pointer transition-colors"
      style={{
        color: active ? '#c41e3a' : 'rgba(26,26,46,0.55)',
        background: active ? 'rgba(196,30,58,0.04)' : 'transparent',
      }}
    >
      {icon}
      <span className="text-[11px] font-bold">{label}</span>
    </button>
  );
}

// Compact light-theme finger selector for the Photo Try-on Color tab.
// Same behavior as FingerSelector but styled for a white background.
function FingerSelectorLight({
  selected, onChange, polishes,
}: {
  selected: 'all' | number;
  onChange: (next: 'all' | number) => void;
  polishes: Record<number, Polish>;
}) {
  const fingers = [
    { idx: 0, label: 'Thumb' },
    { idx: 1, label: 'Index' },
    { idx: 2, label: 'Middle' },
    { idx: 3, label: 'Ring' },
    { idx: 4, label: 'Pinky' },
  ];
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange('all')}
        className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors"
        style={{
          background: selected === 'all' ? '#c41e3a' : 'rgba(0,0,0,0.05)',
          color: selected === 'all' ? 'white' : 'rgba(26,26,46,0.65)',
        }}
      >
        All
      </button>
      {fingers.map((f) => {
        const active = selected === f.idx;
        const color = polishes[f.idx]?.color || '#888';
        return (
          <button
            key={f.idx}
            onClick={() => onChange(f.idx)}
            aria-label={f.label}
            className="relative flex h-7 w-7 items-center justify-center rounded-full cursor-pointer"
            style={{
              background: color,
              border: active ? '2px solid #c41e3a' : '2px solid rgba(0,0,0,0.08)',
              boxShadow: active ? '0 0 0 2px rgba(196,30,58,0.18)' : 'none',
            }}
          >
            <span className="sr-only">{f.label}</span>
          </button>
        );
      })}
    </div>
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
  polishes: Record<number, Polish>,
) {
  const project = (lm: HandLandmark) => {
    const x = mirrored ? (1 - lm.x) * width : lm.x * width;
    return { x, y: lm.y * height };
  };

  for (let fingerIdx = 0; fingerIdx < FINGER_JOINTS.length; fingerIdx++) {
    const f = FINGER_JOINTS[fingerIdx];
    const polish = polishes[fingerIdx] || polishes[0];
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
    case 'aura': drawAura(ctx, L, W, accent); break;
    case 'glazed': drawGlazed(ctx, L, W); break;
    case 'wavy-french': drawWavyFrench(ctx, L, W, accent); break;
    case 'cherry': drawEmoji(ctx, L, W, '🍒'); break;
    case 'smiley': drawSmiley(ctx, L, W, accent); break;
    case 'butterfly': drawEmoji(ctx, L, W, '🦋'); break;
    case 'bow': drawEmoji(ctx, L, W, '🎀', 0.55); break;
    case 'cow': drawCow(ctx, L, W, accent, fingerSeed); break;
    case 'daisy': drawDaisy(ctx, L, W, accent); break;
    case 'cat-eye': drawCatEye(ctx, L, W, accent); break;
    case 'flame': drawFlame(ctx, L, W, accent); break;
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

// ─── 2026 trending designs — Canvas renderers ─────────────────────────────

// Aura nails — soft radial glow at the tip half.
function drawAura(ctx: CanvasRenderingContext2D, L: number, W: number, accent: string) {
  const grad = ctx.createRadialGradient(L * 0.2, 0, 0, L * 0.2, 0, Math.max(L, W) * 0.85);
  grad.addColorStop(0, accent + 'cc');
  grad.addColorStop(0.45, accent + '55');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.globalCompositeOperation = 'screen';
  ctx.fillRect(-L, -W, L * 2, W * 2);
  ctx.globalCompositeOperation = 'source-over';
}

// Glazed donut — iridescent milky shimmer.
function drawGlazed(ctx: CanvasRenderingContext2D, L: number, W: number) {
  const grad = ctx.createLinearGradient(-L, -W, L, W);
  grad.addColorStop(0, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.35, 'rgba(255,222,234,0.35)');
  grad.addColorStop(0.65, 'rgba(200,222,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0.45)');
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = grad;
  ctx.fillRect(-L, -W, L * 2, W * 2);
  // Soft top-left sheen
  const sheen = ctx.createRadialGradient(-L * 0.3, -W * 0.4, 0, -L * 0.3, -W * 0.4, Math.max(L, W) * 0.7);
  sheen.addColorStop(0, 'rgba(255,255,255,0.55)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(-L, -W, L * 2, W * 2);
}

// Wavy french — squiggle band at the tip.
function drawWavyFrench(ctx: CanvasRenderingContext2D, L: number, W: number, accent: string) {
  ctx.save();
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.95;
  const tip = L * 0.18;
  const amp = W * 0.18;
  ctx.beginPath();
  ctx.moveTo(L, -W);
  ctx.lineTo(tip, -W);
  // Squiggle along tip→base boundary (vertical at x=tip)
  for (let t = -W; t <= W; t += 1) {
    const x = tip - amp * Math.sin((t / W) * Math.PI * 1.8);
    ctx.lineTo(x, t);
  }
  ctx.lineTo(L, W);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Generic emoji renderer — for cherry / butterfly / bow.
function drawEmoji(ctx: CanvasRenderingContext2D, L: number, W: number, ch: string, scale = 0.7) {
  ctx.save();
  const size = Math.min(L, W) * 2 * scale;
  ctx.font = `${size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.95;
  ctx.fillText(ch, 0, 0);
  ctx.restore();
}

function drawSmiley(ctx: CanvasRenderingContext2D, L: number, W: number, accent: string) {
  const r = Math.min(L, W) * 0.55;
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(-r * 0.3, -r * 0.18, r * 0.12, 0, Math.PI * 2);
  ctx.arc(r * 0.3, -r * 0.18, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, r * 0.05, r * 0.5, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
}

function drawCow(ctx: CanvasRenderingContext2D, L: number, W: number, accent: string, seed: number) {
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.92;
  for (let i = 0; i < 4; i++) {
    const rx = pseudoRand(seed * 89 + i);
    const ry = pseudoRand(seed * 97 + i);
    const px = (rx * 2 - 1) * L * 0.38;
    const py = (ry * 2 - 1) * W * 0.34;
    const rad = Math.min(L, W) * (0.18 + pseudoRand(seed * 101 + i) * 0.1);
    ctx.beginPath();
    ctx.ellipse(px, py, rad * 1.25, rad * 0.85, pseudoRand(seed * 103 + i) * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDaisy(ctx: CanvasRenderingContext2D, L: number, W: number, accent: string) {
  const r = Math.min(L, W) * 0.32;
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.95;
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 - 90) * (Math.PI / 180);
    const px = Math.cos(a) * r * 0.55;
    const py = Math.sin(a) * r * 0.55;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.28, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
}

function drawCatEye(ctx: CanvasRenderingContext2D, L: number, W: number, accent: string) {
  const grad = ctx.createLinearGradient(-L, 0, L, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.4, accent + 'aa');
  grad.addColorStop(0.5, accent + 'ff');
  grad.addColorStop(0.6, accent + 'aa');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = grad;
  ctx.fillRect(-L, -W * 0.22, L * 2, W * 0.44);
  ctx.globalCompositeOperation = 'source-over';
}

function drawFlame(ctx: CanvasRenderingContext2D, L: number, W: number, accent: string) {
  ctx.save();
  // Flame fills the tip half with wavy outline + warm gradient.
  const grad = ctx.createLinearGradient(L * 0.2, 0, L, 0);
  grad.addColorStop(0, '#c41e3a');
  grad.addColorStop(0.55, accent);
  grad.addColorStop(1, '#ffcc33');
  ctx.fillStyle = grad;
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.moveTo(L, -W);
  ctx.lineTo(L, W);
  // 3 flame-shaped tongues along the tip border
  const baseX = L * 0.05;
  const peaks = [-W * 0.55, 0, W * 0.55];
  for (let i = peaks.length - 1; i >= 0; i--) {
    ctx.lineTo(baseX + W * 0.25, peaks[i] + W * 0.2);
    ctx.lineTo(baseX - W * 0.12, peaks[i]);
    ctx.lineTo(baseX + W * 0.25, peaks[i] - W * 0.2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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
