'use client';

// GiftDropIntro — replay-overlay opening. Gift boxes and letters rain
// down from above; then the delivery vehicle appropriate to the
// sender→receiver distance flies/drives in to pick them up:
//
//   < 50 km    → 🕊️  dove flies in from the left with a letter
//   50–500 km  → 🏎️  supercar screeches in from the right
//   > 500 km   → ✈️  plane crosses the sky
//
// Auto-completes after ~5.5s via onComplete() so the parent can
// transition to the flight replay.

import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

export type VehicleKind = 'dove' | 'car' | 'plane';

interface Props {
  onComplete?: () => void;
  /** Distance in km between sender + receiver — decides the vehicle. */
  distanceKm?: number;
  /** Override the auto-picked vehicle (useful for testing). */
  vehicle?: VehicleKind;
  /** Milliseconds after mount to fire onComplete. Longer for plane
   *  since the jet cruises across the screen slowly (~10s). */
  autoAdvanceMs?: number;
}

// Auto-advance timing per vehicle — matches each delivery animation's
// (delay + duration) with a small buffer so the vehicle finishes its
// hero moment on-screen before the intro hands off to the flight phase.
//   dove  : 2.6s delay + 6.4s two-phase cruise → ~9.5s
//   car   : 2.6s delay + 2.2s screech          → ~5.5s
//   plane : 2.4s delay + 8.0s cruise           → ~11s
const DEFAULT_MS: Record<VehicleKind, number> = {
  dove:  9500,
  car:   5500,
  plane: 11000,
};

function pickVehicle(km: number): VehicleKind {
  if (km < 50) return 'dove';
  if (km < 500) return 'car';
  return 'plane';
}

const VEHICLE_META: Record<VehicleKind, {
  emoji: string;
  label: string;
  accent: string;
}> = {
  dove:  { emoji: '🕊️', label: 'Sending nearby',   accent: '#7dd3fc' },
  // Ferrari-red — paints the supercar body, headlight glow, speed
  // streaks, and the "On the road" caption.
  car:   { emoji: '🏎️', label: 'On the road',      accent: '#dc2626' },
  plane: { emoji: '✈️', label: 'Crossing the sky', accent: '#38bdf8' },
};

// Night sky backdrop — deep space at the top gradually warming into a
// subtle twilight glow at the horizon. The warm horizon strip (~15%
// of the height) is what lets the pitch-black silhouettes stand out
// clearly against the sky.
const NIGHT_SKY =
  'linear-gradient(180deg, ' +
    '#0b0f1c 0%, ' +
    '#06091a 40%, ' +
    '#0a0b1e 75%, ' +      // deepest layer just above horizon
    '#3d1e2a 92%, ' +       // faint plum glow starts
    '#5a2e2a 100%' +        // warm twilight red at the very bottom
  ')';

export default function GiftDropIntro({
  onComplete,
  distanceKm,
  vehicle: vehicleOverride,
  autoAdvanceMs,
}: Props) {
  const vehicle: VehicleKind = vehicleOverride ?? (typeof distanceKm === 'number' ? pickVehicle(distanceKm) : 'dove');
  const meta = VEHICLE_META[vehicle];
  const finalAutoAdvance = autoAdvanceMs ?? DEFAULT_MS[vehicle];

  useEffect(() => {
    if (!onComplete) return;
    const t = setTimeout(onComplete, finalAutoAdvance);
    return () => clearTimeout(t);
  }, [onComplete, finalAutoAdvance]);

  // Backdrop stars for the dove scene (starry night sky).
  const stars = useMemo(() => (
    Array.from({ length: 180 }).map((_, i) => {
      const tier = i % 7 === 0 ? 'bright' : i % 3 === 0 ? 'mid' : 'faint';
      const size = tier === 'bright' ? 1.6 + Math.random() * 1.4
                 : tier === 'mid'    ? 1.0 + Math.random() * 0.8
                 :                     0.6 + Math.random() * 0.6;
      const baseOpacity = tier === 'bright' ? 0.95 : tier === 'mid' ? 0.75 : 0.45;
      return {
        left: Math.random() * 100,
        top:  Math.random() * 100,
        size,
        baseOpacity,
        delay: Math.random() * 6,
        duration: 3 + Math.random() * 5,
      };
    })
  ), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Vehicle-specific backdrop — each vehicle flies through its
          own world so the intro reads as "delivery in the right kind
          of setting":
            dove  → starry night sky with a couple watching
            car   → nighttime city highway (side-view)
            plane → open sky with drifting clouds
      */}
      {vehicle === 'dove'  && <StarrySkyScene stars={stars} />}
      {vehicle === 'car'   && <HighwayScene />}
      {vehicle === 'plane' && <OpenSkyScene />}

      {/* Vehicle "delivery" animation (starts ~2.6s in) */}
      {vehicle === 'dove' && <DoveDelivery accent={meta.accent} />}
      {vehicle === 'car' && <CarDelivery accent={meta.accent} />}
      {vehicle === 'plane' && <PlaneDelivery accent={meta.accent} />}

      {/* Bottom label */}
      <motion.div
        className="absolute inset-x-0 bottom-[14%] flex flex-col items-center pointer-events-none px-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 3.4 }}
      >
        <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: meta.accent, textShadow: `0 0 12px ${meta.accent}66` }}>
          {meta.label}
        </div>
        <div className="text-white/90 text-sm font-semibold" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>
          {typeof distanceKm === 'number'
            ? `${formatDistance(distanceKm)} · ${meta.emoji} arriving`
            : `${meta.emoji} arriving`}
        </div>
      </motion.div>
    </div>
  );
}

// ─── SCENES ───────────────────────────────────────────────────────────
// One "world" per vehicle. Each scene owns its own backdrop + décor
// (stars, clouds, road, streetlights, …). The vehicle animation
// (DoveDelivery / CarDelivery / PlaneDelivery) renders on top.

interface StarSpec {
  left: number; top: number; size: number; baseOpacity: number;
  delay: number; duration: number;
}


function StarrySkyScene({ stars }: { stars: StarSpec[] }) {
  return (
    <>
      {/* Nền hình ảnh thay cho NIGHT_SKY */}
      <motion.div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/scenes/dove-landscape.jpg)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />

      {/* Hiệu ứng sao nhấp nháy phủ lên trên ảnh */}
      {stars.map((s, i) => (
        <motion.div
          key={`star-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            background: '#fff',
            boxShadow: s.size > 1.4 ? `0 0 ${s.size * 2.5}px rgba(255,255,255,0.6)` : undefined,
          }}
          animate={{ opacity: [s.baseOpacity * 0.4, s.baseOpacity, s.baseOpacity * 0.4] }}
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </>
  );
}


// One pine tree — triangular crown + trunk. Coordinates are in the
// parent SVG's viewBox space (0..100 wide, ~40 tall from ground up).


// Car — SIDE-VIEW nighttime highway running LEFT → RIGHT across the
// screen. Multi-layer parallax for realism:
//   • deep night sky with faint stars (top 55%)
//   • distant city skyline silhouette on the horizon (slow drift right→left)
//   • guard rail / roadside grass strip
//   • asphalt road with painted yellow center dashes + white edges
//     (dashes scroll fast right→left so the car appears to move fwd)
//   • streetlight poles receding along the far side of the road
// The supercar itself renders on top of this scene.
function HighwayScene() {
  // Fast-scrolling yellow center-line dashes — 12 dashes cycling
  // right→left across the screen so the car reads as driving forward.
  const dashCount = 12;
  // Streetlight poles positioned every ~180px, slower parallax scroll.
  const lampCount = 6;

  return (
    <>
      {/* Night sky above the horizon */}
      <div className="absolute inset-x-0 top-0" style={{
        height: '58%',
        background: 'linear-gradient(180deg, #05070f 0%, #0b0e22 55%, #1a1a2e 100%)',
      }} />

      {/* Faint stars */}
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={`hstar-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 45}%`,
            width: 1 + Math.random() * 1.2,
            height: 1 + Math.random() * 1.2,
            background: '#fff',
            opacity: 0.3 + Math.random() * 0.5,
          }}
        />
      ))}

      {/* Horizon warm glow — distant city lights bleed */}
      <div className="absolute inset-x-0" style={{
        top: '52%', height: '8%',
        background: 'linear-gradient(180deg, transparent, rgba(255,140,60,0.28), rgba(255,80,40,0.12))',
        filter: 'blur(3px)',
      }} />

      {/* Distant city silhouette — scrolls slowly right→left for parallax */}
      <motion.div
        className="absolute inset-x-0"
        style={{ top: '48%', height: '12%' }}
        initial={{ x: 0 }}
        animate={{ x: '-30vw' }}
        transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
      >
        <svg viewBox="0 0 800 60" preserveAspectRatio="xMinYMax meet" className="w-[200%] h-full block">
          {/* Repeating city blocks */}
          <g fill="#000">
            <rect x="0"   y="20" width="30" height="40" />
            <rect x="35"  y="30" width="24" height="30" />
            <rect x="65"  y="10" width="40" height="50" />
            <rect x="110" y="24" width="20" height="36" />
            <rect x="135" y="18" width="34" height="42" />
            <rect x="175" y="32" width="28" height="28" />
            <rect x="210" y="8"  width="46" height="52" />
            <rect x="260" y="22" width="26" height="38" />
            <rect x="290" y="28" width="30" height="32" />
            <rect x="325" y="14" width="38" height="46" />
            <rect x="370" y="24" width="22" height="36" />
            <rect x="395" y="18" width="32" height="42" />
            <rect x="432" y="28" width="26" height="32" />
            <rect x="462" y="12" width="42" height="48" />
            <rect x="510" y="24" width="24" height="36" />
            <rect x="540" y="18" width="34" height="42" />
            <rect x="580" y="30" width="26" height="30" />
            <rect x="612" y="14" width="38" height="46" />
            <rect x="655" y="24" width="22" height="36" />
            <rect x="682" y="20" width="34" height="40" />
            <rect x="720" y="32" width="28" height="28" />
            <rect x="754" y="14" width="42" height="46" />
          </g>
          {/* A handful of window lights */}
          <g fill="#ffd166">
            <rect x="10"  y="30" width="2" height="2" opacity="0.9" />
            <rect x="18"  y="34" width="2" height="2" opacity="0.7" />
            <rect x="72"  y="24" width="2" height="2" opacity="0.9" />
            <rect x="86"  y="30" width="2" height="2" opacity="0.6" />
            <rect x="150" y="28" width="2" height="2" opacity="0.85" />
            <rect x="220" y="20" width="2" height="2" opacity="0.9" />
            <rect x="270" y="30" width="2" height="2" opacity="0.7" />
            <rect x="340" y="24" width="2" height="2" opacity="0.85" />
            <rect x="470" y="24" width="2" height="2" opacity="0.9" />
            <rect x="546" y="26" width="2" height="2" opacity="0.7" />
            <rect x="620" y="24" width="2" height="2" opacity="0.85" />
            <rect x="760" y="24" width="2" height="2" opacity="0.9" />
          </g>
        </svg>
      </motion.div>

      {/* Roadside grass strip between horizon and asphalt */}
      <div className="absolute inset-x-0" style={{
        top: '58%', height: '4%',
        background: 'linear-gradient(180deg, #0d1420, #182533)',
      }} />

      {/* ASPHALT — full-width flat road */}
      <div className="absolute inset-x-0" style={{
        bottom: 0, height: '38%',
        background: 'linear-gradient(180deg, #14171f 0%, #0a0c12 60%, #05060a 100%)',
      }} />

      {/* Road edge lines — white, top + bottom of the asphalt */}
      <div className="absolute inset-x-0" style={{ bottom: '37.6%', height: 2, background: '#e5e7eb', opacity: 0.85 }} />
      <div className="absolute inset-x-0" style={{ bottom: '2%',    height: 2, background: '#e5e7eb', opacity: 0.6  }} />

      {/* Yellow center-line dashes — scrolling right→left to fake motion */}
      <div className="absolute inset-x-0" style={{ bottom: '19%', height: 6 }}>
        {Array.from({ length: dashCount }).map((_, i) => (
          <motion.div
            key={`dash-${i}`}
            className="absolute"
            style={{
              top: 0,
              width: 40,
              height: 6,
              background: '#fbbf24',
              borderRadius: 2,
              boxShadow: '0 0 6px rgba(251,191,36,0.5)',
            }}
            initial={{ x: `${(i / dashCount) * 100}vw` }}
            animate={{ x: [`${(i / dashCount) * 100}vw`, `${((i / dashCount) * 100) - 100}vw`] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
          />
        ))}
      </div>

      {/* Streetlight poles — receding along the FAR side of the road,
          also parallax right→left, slower than the dashes. */}
      {Array.from({ length: lampCount }).map((_, i) => (
        <motion.div
          key={`lamp-${i}`}
          className="absolute"
          style={{
            bottom: '37%',
            left: 0,
            width: 2, height: '18%',
            background: 'linear-gradient(180deg, #94a3b8, #475569)',
          }}
          initial={{ x: `${(i / lampCount) * 100}vw` }}
          animate={{ x: [`${(i / lampCount) * 100}vw`, `${((i / lampCount) * 100) - 100}vw`] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        >
          {/* Lamp head */}
          <div style={{
            position: 'absolute', top: 0, left: -8,
            width: 20, height: 6,
            background: '#94a3b8',
            borderRadius: 2,
          }} />
          {/* Warm light halo */}
          <div style={{
            position: 'absolute', top: 4, left: -22,
            width: 48, height: 60,
            background: 'radial-gradient(ellipse at center top, rgba(255,200,120,0.65), transparent 70%)',
            filter: 'blur(4px)',
            pointerEvents: 'none',
          }} />
        </motion.div>
      ))}
    </>
  );
}

// Plane — open sky. Deep blue → dusk gradient with drifting cloud
// silhouettes at multiple depths for parallax, plus faint high-altitude
// stars near the top. No city / land — the sky IS the setting.
function OpenSkyScene() {
  // 8 cloud layers of varied size + speed for depth. Seeded so
  // positions stay stable across renders.
  const clouds = useMemo(() => (
    Array.from({ length: 8 }).map((_, i) => {
      const s = (i * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      return {
        id: i,
        top: 15 + r(1) * 60,
        size: 80 + r(2) * 180,             // 80-260px wide
        startX: -30 + r(3) * 20,
        duration: 24 + r(4) * 20,          // 24-44s across-screen
        delay: r(5) * 8,
        opacity: 0.2 + r(6) * 0.5,
      };
    })
  ), []);

  return (
    <>
      {/* Sky gradient — deep dusk blue fading to lighter dawn tone */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(180deg, #0a1230 0%, #1e3a6b 35%, #3d5c8f 65%, #6b7fa5 90%, #a8b3c8 100%)',
      }} />

      {/* Faint high-altitude stars — only in the very top strip */}
      {Array.from({ length: 22 }).map((_, i) => (
        <div
          key={`pstar-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top:  `${Math.random() * 25}%`,
            width: 1,
            height: 1,
            background: '#fff',
            opacity: 0.5,
          }}
        />
      ))}

      {/* Drifting clouds — LEFT → RIGHT parallax, multi-depth */}
      {clouds.map(c => (
        <motion.div
          key={`cloud-${c.id}`}
          className="absolute pointer-events-none"
          style={{
            top: `${c.top}%`,
            width: c.size,
            height: c.size * 0.5,
            opacity: c.opacity,
          }}
          initial={{ x: `${c.startX}vw` }}
          animate={{ x: '130vw' }}
          transition={{ duration: c.duration, delay: c.delay, repeat: Infinity, ease: 'linear' }}
        >
          <FluffyCloud />
        </motion.div>
      ))}
    </>
  );
}

// Simple SVG cloud — 4 overlapping circles + wide base plate for fluff.
function FluffyCloud() {
  return (
    <svg viewBox="0 0 200 100" className="w-full h-full">
      <g fill="#fff">
        <circle cx="45"  cy="60" r="30" />
        <circle cx="80"  cy="45" r="38" />
        <circle cx="120" cy="45" r="42" />
        <circle cx="160" cy="55" r="32" />
        <rect x="40" y="55" width="130" height="30" rx="12" />
      </g>
    </svg>
  );
}

// Reusable city skyline strip — 20+ buildings of varied heights with
// windows lit up. `near` flag renders bigger buildings + a warm rim
// light along the roof edges. `windowOpacity` scales the yellow glow.
function CitySkyline({ near = false, windowOpacity = 1 }: { near?: boolean; windowOpacity?: number }) {
  // Deterministic building list so re-renders don't reshuffle everything.
  const buildings = useMemo(() => {
    const arr: { x: number; w: number; h: number; type: 'flat' | 'antenna' | 'pyramid' }[] = [];
    let x = 0;
    const rand = mulberry32(near ? 42 : 84);
    while (x < 1000) {
      const w = (near ? 34 : 22) + Math.floor(rand() * (near ? 34 : 26));
      const h = (near ? 55 : 30) + Math.floor(rand() * (near ? 55 : 32));
      const roll = rand();
      const type: 'flat' | 'antenna' | 'pyramid' = roll < 0.15 ? 'antenna' : roll < 0.25 ? 'pyramid' : 'flat';
      arr.push({ x, w, h, type });
      x += w + 1;
    }
    return arr;
  }, [near]);

  const baseY = near ? 120 : 70;

  return (
    <>
      {/* Building bodies — solid black silhouette */}
      <g fill="#020306">
        {buildings.map((b, i) => (
          <rect key={`b-${i}`} x={b.x} y={baseY - b.h} width={b.w} height={b.h} />
        ))}
      </g>

      {/* Antennas + pyramid caps */}
      <g fill="#020306">
        {buildings.map((b, i) => {
          if (b.type === 'antenna') {
            return <rect key={`a-${i}`} x={b.x + b.w / 2 - 0.6} y={baseY - b.h - 12} width="1.2" height="12" />;
          }
          if (b.type === 'pyramid') {
            return (
              <polygon
                key={`p-${i}`}
                points={`${b.x},${baseY - b.h} ${b.x + b.w},${baseY - b.h} ${b.x + b.w / 2},${baseY - b.h - 10}`}
              />
            );
          }
          return null;
        })}
      </g>

      {/* Warm rim highlight along roof lines (only for near layer — sells depth) */}
      {near && (
        <g fill="#ffd18c" opacity="0.35">
          {buildings.map((b, i) => (
            <rect key={`r-${i}`} x={b.x} y={baseY - b.h - 0.5} width={b.w} height="0.6" />
          ))}
        </g>
      )}

      {/* Window lights — dense grid on each building, random on/off pattern
          so it looks lived-in rather than uniform. */}
      <g>
        {buildings.map((b, i) => {
          const rand = mulberry32(b.x * 7 + i);
          const cellW = near ? 2.5 : 1.8;
          const cellH = near ? 3.5 : 2.6;
          const gapX = 1.2;
          const gapY = 1.5;
          const cols = Math.floor((b.w - 3) / (cellW + gapX));
          const rows = Math.floor((b.h - 5) / (cellH + gapY));
          const cells = [];
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const roll = rand();
              if (roll > 0.55) {
                const bright = roll > 0.9;
                cells.push(
                  <rect
                    key={`w-${i}-${r}-${c}`}
                    x={b.x + 1.5 + c * (cellW + gapX)}
                    y={baseY - b.h + 2 + r * (cellH + gapY)}
                    width={cellW}
                    height={cellH}
                    fill={bright ? '#ffe08a' : '#fbbf24'}
                    opacity={windowOpacity * (bright ? 1 : 0.7)}
                  />
                );
              }
            }
          }
          return cells;
        })}
      </g>
    </>
  );
}

// Cheap deterministic PRNG so window lights + building sizes stay
// stable across renders without pulling in a whole library.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Two silhouettes watching the sky ─────────────────────────────────
// A couple in an intimate embrace, watching the stars together. Their
// shoulders overlap; his right arm wraps around her back and rests on
// her far shoulder, her left arm slips around his waist. Heads tilt
// back to look up — hers rests slightly against his shoulder. Both
// figures share a single, gentle synchronised sway so the embrace
// reads as a single couple rather than two separate people.
function TwoSilhouettes() {
  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none">
      {/* NO black fade overlay here — the NIGHT_SKY backdrop already
          transitions to a warm twilight glow at the horizon so the
          pitch-black silhouettes stand out clearly against it. Adding
          a dark overlay would swallow them again. */}

      <svg
        viewBox="0 0 400 280"
        className="relative w-full"
        style={{ maxHeight: 320, display: 'block' }}
        preserveAspectRatio="xMidYEnd meet"
      >
        {/* Ground line — subtle, blends with horizon fade */}
        <line x1="0" y1="260" x2="400" y2="260" stroke="#000" strokeWidth="2" opacity="0.5" />

        {/* Group both figures inside ONE g so they sway together (breathe
             as a couple, not two separate silhouettes). */}
        <motion.g
          fill="#000"
          animate={{ rotate: [-0.3, 0.3, -0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '200px 260px' }}
        >
          {/* ── HIS ARM around her back — drawn FIRST so it sits behind
                 both bodies. Ends on her far shoulder. */}
          <path d="M 189 158 Q 205 154 220 156 Q 234 158 245 163 Q 245 168 240 168 Q 228 165 216 165 Q 204 165 192 168 Z" />

          {/* ── LEFT figure (masc) — center x=185, taller, broader.
                 Head tilted back ~18°. Shoulder pressed against her. */}
          {/* Neck */}
          <path d="M 181 138 Q 185 142 189 138 L 189 148 L 181 148 Z" />
          {/* Head — tilted back to look up */}
          <path
            transform="rotate(-16 185 128)"
            d="M 185 108 Q 197 108 197 122 Q 197 132 191 138 Q 185 141 179 138 Q 173 132 173 122 Q 173 108 185 108 Z"
          />
          {/* Short hair */}
          <path
            transform="rotate(-16 185 128)"
            d="M 173 116 Q 173 104 185 104 Q 197 104 197 116 Q 191 112 185 112 Q 179 112 173 116 Z"
          />
          {/* His shoulders + torso — right shoulder reaches over to meet
              her body at x≈205. */}
          <path d="M 167 148 Q 165 154 167 160 L 171 178 Q 171 200 173 220 L 200 220 L 200 158 Q 195 145 185 145 Q 175 145 167 148 Z" />
          {/* Left arm — hanging at his side */}
          <path d="M 169 158 Q 162 172 160 190 Q 160 202 162 210 L 169 210 Q 170 200 170 190 Q 172 176 175 168 Z" />
          {/* Legs */}
          <path d="M 173 218 L 171 260 L 185 260 L 187 220 Z" />
          <path d="M 187 220 L 189 260 L 200 260 L 200 218 Z" />
          {/* Feet */}
          <ellipse cx="176" cy="260" rx="6" ry="2" />
          <ellipse cx="194" cy="260" rx="6" ry="2" />

          {/* ── RIGHT figure (fem) — center x=218, close against him,
                 head slightly leaning toward his shoulder. */}
          {/* Neck */}
          <path d="M 214 148 Q 218 152 222 148 L 222 158 L 214 158 Z" />
          {/* Head — tilted back + slightly toward his shoulder (rotate -8
              instead of +18 so she leans LEFT into him while still
              looking up). */}
          <path
            transform="rotate(-8 218 138)"
            d="M 218 120 Q 229 120 229 132 Q 229 142 223 148 Q 218 150 213 148 Q 207 142 207 132 Q 207 120 218 120 Z"
          />
          {/* Long hair — cascades over her left shoulder + back */}
          <path
            transform="rotate(-8 218 138)"
            d="M 207 128 Q 202 138 202 156 Q 202 174 208 184 L 220 184 Q 228 176 229 158 Q 230 138 229 128 Q 224 122 218 122 Q 212 122 207 128 Z"
          />
          {/* Her torso — left side pressed against his right side (x=200
              is the shared boundary between their bodies). */}
          <path d="M 200 158 L 200 220 L 236 220 Q 238 200 238 190 L 240 172 Q 242 166 240 158 Q 232 155 218 155 Q 208 155 200 158 Z" />
          {/* Her LEFT arm — wraps around HIS waist. Drawn on top so it
              lands over his torso, ending near his left side. */}
          <path d="M 207 172 Q 195 176 182 180 Q 176 180 176 185 Q 176 188 182 188 Q 195 186 208 184 Q 214 180 214 176 Z" />
          {/* Her right arm — hanging at her side */}
          <path d="M 240 168 Q 246 182 248 200 Q 248 210 246 218 L 240 218 Q 240 208 240 200 Q 238 184 236 176 Z" />
          {/* Legs */}
          <path d="M 210 218 L 208 260 L 220 260 L 222 220 Z" />
          <path d="M 222 220 L 224 260 L 236 260 L 236 218 Z" />
          {/* Feet */}
          <ellipse cx="214" cy="260" rx="5.5" ry="2" />
          <ellipse cx="230" cy="260" rx="5.5" ry="2" />
        </motion.g>

        {/* Tiny sparkle above them — the star they're both watching */}
        <motion.g
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.9, 1.15, 0.9] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '200px 60px' }}
        >
          <circle cx="200" cy="60" r="1.8" fill="#fef3c7" />
          <circle cx="200" cy="60" r="5" fill="#fef3c7" opacity="0.35" />
          <circle cx="200" cy="60" r="10" fill="#fef3c7" opacity="0.12" />
        </motion.g>
      </svg>
    </div>
  );
}

// ── Vehicle deliveries ────────────────────────────────────────────────

// Dove: flies in from LEFT → RIGHT in TWO phases —
//   Phase A: fast entrance to the middle of the screen (~2.4s)
//   Phase B: gentle continued cruise onward to near the right edge (~4s)
// Keyframes with a `times` array control the split so the middle is
// reached earlier, then the second half plays out more leisurely.
//
// 🕊️ Apple/Google emoji faces LEFT by default, so we scaleX(-1) on a
// STATIC wrapper (not on the animated element — framer-motion writes to
// `transform` for its y/scaleY animation and would clobber the flip).
// function DoveDelivery({ accent }: { accent: string }) {
//   // Companion flock — 10 doves fly alongside the hero at varied
//   // vertical positions + wing-flap phases. Only the hero carries the
//   // letter; the companions are just flying, giving the scene depth
//   // and a "flock returning home" feel.
//   // 18 companion birds in 3 depth tiers so the flock has real
//   // perspective (tiny far birds up to nearly-hero-sized close ones).
//   // Wing-flap timing spans slow gentle flaps (1.1s) to rapid short
//   // flaps (0.4s) so no two birds sync — reads as a real flock, not a
//   // cloned array.
//   const flock = useMemo(() => (
//     Array.from({ length: 18 }).map((_, i) => {
//       const seed = (i * 2654435761) >>> 0;
//       const r = (n: number) => (((seed ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;

//       // Depth tier — first 6 near, next 6 mid, last 6 far
//       const tier: 'near' | 'mid' | 'far' =
//         i < 6 ? 'near' : i < 12 ? 'mid' : 'far';

//       // Size range varies dramatically by tier for real perspective
//       const size = tier === 'near' ? 0.85 + r(3) * 0.35        // 0.85-1.20 (nearly hero-size)
//                  : tier === 'mid'  ? 0.5  + r(3) * 0.3         // 0.50-0.80
//                  :                    0.22 + r(3) * 0.2;        // 0.22-0.42 (tiny far birds)

//       // Position spread bigger for far birds (fill the sky), tighter for near
//       const spreadY = tier === 'near' ? 280 : tier === 'mid' ? 380 : 460;
//       const spreadX = tier === 'near' ? 340 : tier === 'mid' ? 500 : 620;

//       // Wing-flap variety: near birds flap slower (bigger species),
//       // mid birds normal, far birds quick (small quick-flapping birds).
//       const flapDuration = tier === 'near' ? 0.85 + r(5) * 0.35   // 0.85-1.20s slow
//                         : tier === 'mid'  ? 0.55 + r(5) * 0.3    // 0.55-0.85s medium
//                         :                    0.35 + r(5) * 0.25;  // 0.35-0.60s rapid

//       return {
//         id: i,
//         tier,
//         offsetY: -spreadY / 2 + r(1) * spreadY,
//         offsetX: -spreadX / 2 + r(2) * spreadX,
//         size,
//         opacity: tier === 'near' ? 0.85 + r(4) * 0.15
//                : tier === 'mid'  ? 0.6  + r(4) * 0.25
//                :                    0.35 + r(4) * 0.25,
//         flapDuration,
//         flapDelay: r(6) * 1.2,               // stagger up to 1.2s
//         bobAmt: tier === 'near' ? 10 + r(7) * 6
//               : tier === 'mid'  ? 6  + r(7) * 6
//               :                    3  + r(7) * 4,
//         // Some birds glide subtly (rotation sway) for extra life
//         gliderRotate: (r(8) - 0.5) * 8,       // ±4°
//       };
//     })
//   ), []);

//   return (
//     <motion.div
//       className="absolute top-1/2 pointer-events-none"
//       style={{ left: 0, y: '-50%' }}
//       initial={{ x: '-30vw', opacity: 0 }}
//       animate={{
//         x: ['-30vw', '50vw', '92vw'],
//         opacity: [0, 1, 1],
//       }}
//       transition={{
//         delay: 2.6,
//         duration: 6.4,
//         times: [0, 0.38, 1],
//         ease: 'easeInOut',
//       }}
//     >
//       {/* ── FLOCK · 18 companion doves in 3 depth tiers around hero ── */}
//       {flock.map(bird => (
//         <div
//           key={`flock-${bird.id}`}
//           style={{
//             position: 'absolute',
//             left: bird.offsetX,
//             top: bird.offsetY,
//             transform: `scale(${bird.size}) scaleX(-1) rotate(${bird.gliderRotate}deg)`,
//             transformOrigin: 'center center',
//             opacity: bird.opacity,
//           }}
//         >
//           <motion.div
//             className="text-5xl md:text-6xl"
//             animate={{
//               y: [0, -bird.bobAmt, 0],
//               scaleY: [1, 0.78, 1],
//             }}
//             transition={{
//               duration: bird.flapDuration,
//               delay: bird.flapDelay,
//               repeat: Infinity,
//               ease: 'easeInOut',
//             }}
//             style={{
//               filter: `drop-shadow(0 4px 10px rgba(0,0,0,0.5)) drop-shadow(0 0 20px ${accent}33)`,
//               display: 'block',
//               transformOrigin: 'center bottom',
//             }}
//           >
//             🕊️
//           </motion.div>
//         </div>
//       ))}

//       {/* ── HERO · the only bird carrying the letter ── */}
//       <div style={{ transform: 'translateX(-50%) scaleX(-1)' }}>
//         <motion.div
//           className="text-6xl md:text-7xl"
//           animate={{ y: [0, -8, 0], scaleY: [1, 0.82, 1] }}
//           transition={{ duration: 0.75, repeat: Infinity, ease: 'easeInOut' }}
//           style={{
//             filter: `drop-shadow(0 6px 16px rgba(0,0,0,0.6)) drop-shadow(0 0 30px ${accent}88)`,
//             display: 'block',
//             transformOrigin: 'center bottom',
//           }}
//         >
//           🕊️
//         </motion.div>
//         {/* Un-flip the letter so 💌 doesn't render mirrored */}
//         <div style={{ transform: 'scaleX(-1)' }}>
//           <motion.div
//             className="text-3xl -mt-2 text-center"
//             animate={{ rotate: [-14, 14, -14] }}
//             transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
//             style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.5))' }}
//           >
//             💌
//           </motion.div>
//         </div>
//       </div>
//     </motion.div>
//   );
// }

export function DoveDelivery({ accent }: { accent: string }) {
  const flock = useMemo(() => (
    Array.from({ length: 18 }).map((_, i) => {
      const seed = (i * 2654435761) >>> 0;
      const r = (n: number) => (((seed ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;

      // Chia tầng chiều sâu: 6 con gần, 6 con vừa, 6 con xa
      const tier: 'near' | 'mid' | 'far' = i < 6 ? 'near' : i < 12 ? 'mid' : 'far';

      // Kích thước chênh lệch rõ rệt
      const size = tier === 'near' ? 0.85 + r(3) * 0.35
                 : tier === 'mid'  ? 0.5  + r(3) * 0.3
                 :                    0.22 + r(3) * 0.2;

      // 1. TẢN RỘNG KHOẢNG CÁCH (X và Y xa nhau hơn rất nhiều)
      const spreadY = tier === 'near' ? 320 : tier === 'mid' ? 450 : 580;
      const spreadX = tier === 'near' ? 600 : tier === 'mid' ? 900 : 1200;

      const offsetY = -spreadY / 2 + r(1) * spreadY;
      const offsetX = -spreadX / 2 + r(2) * spreadX;

      // 2. VẬN TỐC & THỜI GIAN BAY KHÁC NHAU (Có con lướt nhanh, con lơ đễnh tụt lại)
      const flightDuration = 5.5 + r(9) * 2.5; // Bay từ 5.5s - 8.0s
      const flightDelay = 1.8 + r(10) * 1.8;   // Xuất hiện lệch nhau tới 1.8s

      // 3. QUỸ ĐẠO BẤT QUY TẮC (Nhấp nhô bay dốc/lượn sóng riêng)
      const driftY = (r(11) - 0.5) * 120; // Độ lệch trục dọc khi di chuyển

      // Nhịp vỗ cánh
      const flapDuration = tier === 'near' ? 0.85 + r(5) * 0.35
                        : tier === 'mid'  ? 0.55 + r(5) * 0.3
                        :                    0.35 + r(5) * 0.25;

      return {
        id: i,
        tier,
        size,
        offsetY,
        offsetX,
        driftY,
        flightDuration,
        flightDelay,
        opacity: tier === 'near' ? 0.85 + r(4) * 0.15
               : tier === 'mid'  ? 0.6  + r(4) * 0.25
               :                    0.35 + r(4) * 0.25,
        flapDuration,
        flapDelay: r(6) * 1.2,
        bobAmt: tier === 'near' ? 12 + r(7) * 8
              : tier === 'mid'  ? 7  + r(7) * 6
              :                    3  + r(7) * 4,
        gliderRotate: (r(8) - 0.5) * 12, // Độ nghiêng chao cánh tự nhiên ±6°
      };
    })
  ), []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* ── ĐÀN CHIM ĐỒNG HÀNH (Mỗi con có luồng di chuyển x/y riêng) ── */}
      {flock.map(bird => (
        <motion.div
          key={`flock-${bird.id}`}
          className="absolute top-1/2"
          style={{
            left: 0,
            y: '-50%',
            opacity: bird.opacity,
          }}
          initial={{ x: '-35vw', opacity: 0 }}
          animate={{
            x: ['-35vw', '50vw', '110vw'],
            y: [`calc(-50% + ${bird.offsetY}px)`, `calc(-50% + ${bird.offsetY + bird.driftY}px)`],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            delay: bird.flightDelay,
            duration: bird.flightDuration,
            ease: 'easeInOut',
            times: [0, 0.4, 0.85, 1],
          }}
        >
          {/* Định vị chênh lệch vị trí ban đầu + Scale kích thước */}
          <div
            style={{
              transform: `translateX(${bird.offsetX}px) scale(${bird.size}) scaleX(-1) rotate(${bird.gliderRotate}deg)`,
              transformOrigin: 'center center',
            }}
          >
            {/* Chuyển động đập cánh & nhô người */}
            <motion.div
              className="text-5xl md:text-6xl"
              animate={{
                y: [0, -bird.bobAmt, 0],
                scaleY: [1, 0.75, 1],
              }}
              transition={{
                duration: bird.flapDuration,
                delay: bird.flapDelay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{
                filter: `drop-shadow(0 4px 10px rgba(0,0,0,0.5)) drop-shadow(0 0 20px ${accent}33)`,
                display: 'block',
                transformOrigin: 'center bottom',
              }}
            >
              🕊️
            </motion.div>
          </div>
        </motion.div>
      ))}

      {/* ── CHIM ANH HÙNG (HERO DOVE MANG THƯ) ── */}
      <motion.div
        className="absolute top-1/2 z-10"
        style={{ left: 0, y: '-50%' }}
        initial={{ x: '-30vw', opacity: 0 }}
        animate={{
          x: ['-30vw', '50vw', '105vw'],
          opacity: [0, 1, 1, 0],
        }}
        transition={{
          delay: 2.6,
          duration: 6.4,
          times: [0, 0.38, 0.9, 1],
          ease: 'easeInOut',
        }}
      >
        <div style={{ transform: 'translateX(-50%) scaleX(-1)' }}>
          <motion.div
            className="text-6xl md:text-7xl"
            animate={{ y: [0, -10, 0], scaleY: [1, 0.8, 1] }}
            transition={{ duration: 0.75, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              filter: `drop-shadow(0 6px 16px rgba(0,0,0,0.6)) drop-shadow(0 0 30px ${accent}88)`,
              display: 'block',
              transformOrigin: 'center bottom',
            }}
          >
            🕊️
          </motion.div>

          {/* Bức thư 💌 đảo ngược lại để không bị ngược chiều */}
          <div style={{ transform: 'scaleX(-1)' }}>
            <motion.div
              className="text-3xl -mt-2 text-center"
              animate={{ rotate: [-14, 14, -14] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.5))' }}
            >
              💌
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}





// Link GIF chim bồ câu trắng vỗ cánh nền trong suốt chất lượng cao

// Car: hand-drawn SVG supercar cruising LEFT → RIGHT along the highway
// laid down by HighwayScene. Body has aerodynamic silhouette, tinted
// windshield, alloy wheels with rotating spokes, glowing headlight +
// taillight, and speed streaks behind it while it moves.
function CarDelivery({ accent }: { accent: string }) {
  return (
    <>
      {/* Speed streaks behind the car — flash in as it passes */}
      {Array.from({ length: 10 }).map((_, i) => (
        <motion.div
          key={`streak-${i}`}
          className="absolute rounded-full"
          style={{
            // Anchor around the road center (bottom ~20%)
            bottom: `${18 + (i - 5) * 2}%`,
            left: 0,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
            filter: `drop-shadow(0 0 8px ${accent}aa)`,
          }}
          initial={{ x: '-20vw', width: 0 }}
          animate={{ x: ['-20vw', '30vw', '120vw'], width: [0, 260, 0] }}
          transition={{ delay: 2.8 + i * 0.06, duration: 2.2, ease: 'easeOut' }}
        />
      ))}

      {/* Headlight cone — bright forward beam ahead of the car */}
      <motion.div
        className="absolute pointer-events-none"
        style={{ bottom: '13%', left: 0 }}
        initial={{ x: '-25vw', opacity: 0 }}
        animate={{ x: '95vw', opacity: [0, 0.9, 0.9, 0.9, 0] }}
        transition={{ delay: 2.6, duration: 5.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div style={{
          width: 260,
          height: 90,
          background: 'linear-gradient(90deg, rgba(255,240,200,0.55), rgba(255,240,200,0.15), transparent)',
          filter: 'blur(10px)',
          transform: 'translateX(80px) translateY(-30px) skewY(-3deg)',
        }} />
      </motion.div>

      {/* The supercar — cruises LEFT → RIGHT along the road */}
      <motion.div
        className="absolute pointer-events-none"
        style={{ bottom: '11%', left: 0, transformOrigin: 'center bottom' }}
        initial={{ x: '-25vw', opacity: 0 }}
        animate={{ x: '95vw', opacity: 1 }}
        transition={{
          x:       { delay: 2.6, duration: 5.5, ease: [0.22, 1, 0.36, 1] },
          opacity: { delay: 2.6, duration: 0.4 },
        }}
      >
        <motion.div
          animate={{ y: [0, -1, 0, -0.5, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            filter: `drop-shadow(0 10px 20px rgba(0,0,0,0.75)) drop-shadow(0 0 30px ${accent}44)`,
          }}
        >
          <Supercar accent={accent} />
        </motion.div>
      </motion.div>
    </>
  );
}

// Hand-drawn SVG supercar — sleek low-profile silhouette facing RIGHT
// (direction of travel). Aerodynamic body, tinted windshield, twin
// alloy wheels with rotating spokes, headlight + taillight glows.
function Supercar({ accent }: { accent: string }) {
  return (
    <svg
      width="260"
      height="80"
      viewBox="0 0 320 100"
      style={{ display: 'block' }}
    >
      <defs>
        {/* Body paint — accent color with a highlight on top */}
        <linearGradient id="carBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={lighten(accent, 0.25)} />
          <stop offset="40%"  stopColor={accent} />
          <stop offset="100%" stopColor={darken(accent, 0.4)} />
        </linearGradient>
        {/* Windshield tint */}
        <linearGradient id="carGlass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#4b6584" />
          <stop offset="100%" stopColor="#1a2333" />
        </linearGradient>
        {/* Wheel gradient */}
        <radialGradient id="carWheel">
          <stop offset="0%"  stopColor="#4b5563" />
          <stop offset="60%" stopColor="#1f2937" />
          <stop offset="100%" stopColor="#050505" />
        </radialGradient>
      </defs>

      {/* Ground shadow under the car — soft ellipse */}
      <ellipse cx="160" cy="90" rx="140" ry="6" fill="#000" opacity="0.55" />

      {/* MAIN BODY — sleek low-profile silhouette (facing RIGHT).
          Rear at x=20 (short trunk + spoiler), front at x=310 (long
          aerodynamic hood). Roof line dips low over the cabin. */}
      <path
        d="
          M 20 68
          L 30 55
          L 60 46
          L 90 32
          L 130 26
          L 170 26
          Q 200 26 218 44
          L 265 50
          Q 300 54 310 65
          L 310 74
          L 20 74
          Z"
        fill="url(#carBody)"
        stroke={darken(accent, 0.55)}
        strokeWidth="0.8"
      />

      {/* Sculpted side vent + lower panel accent */}
      <path
        d="M 100 62 L 200 62 L 210 68 L 90 68 Z"
        fill={darken(accent, 0.55)}
        opacity="0.7"
      />

      {/* WINDSHIELD + WINDOWS — one continuous tinted glass sweep */}
      <path
        d="M 95 34 L 128 30 L 168 30 Q 195 30 212 44 L 175 44 L 155 44 L 130 46 L 108 48 Z"
        fill="url(#carGlass)"
        stroke="#0f172a"
        strokeWidth="0.5"
      />
      {/* Roof-line reflection highlight */}
      <path
        d="M 128 30 L 168 30 Q 190 30 205 42"
        stroke="#fff"
        strokeWidth="1.2"
        fill="none"
        opacity="0.55"
      />

      {/* Door line */}
      <line x1="135" y1="46" x2="132" y2="68" stroke={darken(accent, 0.6)} strokeWidth="0.8" opacity="0.7" />

      {/* REAR SPOILER — a small lip at the back */}
      <path d="M 20 62 L 30 55 L 42 55 L 42 60 L 30 60 Z" fill={darken(accent, 0.6)} />
      <path d="M 20 55 L 30 55 L 30 60 L 20 60 Z" fill={darken(accent, 0.7)} opacity="0.85" />

      {/* HEADLIGHT — front (right side of car) with bright glow */}
      <ellipse cx="298" cy="60" rx="8" ry="4" fill="#fef3c7" />
      <ellipse cx="298" cy="60" rx="14" ry="7" fill="#fef3c7" opacity="0.35" />
      <ellipse cx="298" cy="60" rx="22" ry="10" fill="#fef3c7" opacity="0.15" />

      {/* TAILLIGHT — back (left side of car) red */}
      <rect x="22" y="58" width="10" height="6" rx="1" fill="#ef4444" />
      <ellipse cx="27" cy="61" rx="14" ry="5" fill="#ef4444" opacity="0.35" />

      {/* AIR INTAKE mesh — front bumper */}
      <rect x="272" y="66" width="30" height="4" fill="#0a0a0a" opacity="0.9" />
      <line x1="272" y1="68" x2="302" y2="68" stroke="#374151" strokeWidth="0.3" />

      {/* WHEELS — 2 rotating wheels with alloy rims */}
      <RotatingWheel cx={68}  cy={78} r={16} />
      <RotatingWheel cx={252} cy={78} r={16} />

      {/* Fender arches over the wheels */}
      <path d="M 50 78 Q 68 60 86 78" fill="none" stroke={darken(accent, 0.6)} strokeWidth="1.2" />
      <path d="M 234 78 Q 252 60 270 78" fill="none" stroke={darken(accent, 0.6)} strokeWidth="1.2" />
    </svg>
  );
}

// Reusable spinning alloy wheel — 5 spokes.
function RotatingWheel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      {/* Tire */}
      <circle cx={cx} cy={cy} r={r} fill="url(#carWheel)" stroke="#000" strokeWidth="0.6" />
      {/* Rim */}
      <circle cx={cx} cy={cy} r={r * 0.65} fill="#94a3b8" />
      {/* Rotating spokes */}
      <g style={{
        transformOrigin: `${cx}px ${cy}px`,
        animation: 'gaoWheelSpin 0.35s linear infinite',
      }}>
        {[0, 72, 144, 216, 288].map(angle => (
          <rect
            key={angle}
            x={cx - 1}
            y={cy - r * 0.6}
            width="2"
            height={r * 0.55}
            fill="#e5e7eb"
            transform={`rotate(${angle} ${cx} ${cy})`}
          />
        ))}
        <circle cx={cx} cy={cy} r={r * 0.2} fill="#4b5563" stroke="#000" strokeWidth="0.5" />
      </g>
      {/* Inline keyframes so the SVG can spin without CSS-in-JS setup */}
      <style>{`
        @keyframes gaoWheelSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </g>
  );
}

// Tiny helpers to shade the accent color for gradients / shadows.
// Both take a hex like "#f97316" and return a lightened / darkened hex.
function lighten(hex: string, amt: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    Math.min(255, Math.round(r + (255 - r) * amt)),
    Math.min(255, Math.round(g + (255 - g) * amt)),
    Math.min(255, Math.round(b + (255 - b) * amt)),
  );
}
function darken(hex: string, amt: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    Math.max(0, Math.round(r * (1 - amt))),
    Math.max(0, Math.round(g * (1 - amt))),
    Math.max(0, Math.round(b * (1 - amt))),
  );
}
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '');
  const n = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Plane: cruises slowly across the sky (LEFT → RIGHT) like a real
// high-altitude jet — subtle vertical drift for turbulence, and a
// 3-layer contrail (bright inner, soft middle, wide diffuse outer)
// that lingers behind. SVG jet silhouette instead of the emoji so it
// looks less cartoony against the deep-space sky.
// function PlaneDelivery({ accent }: { accent: string }) {
//   // Slow cruise: 8s to cross the screen. Real-jet-feeling.
//   const CRUISE_DELAY = 2.4;
//   const CRUISE_DURATION = 8.0;

//   return (
//     <>
//       {/* Wide diffuse contrail — the "spread out" old part */}
//       <motion.div
//         className="absolute rounded-full"
//         style={{
//           top: 'calc(38% + 8px)',
//           left: '-5vw',
//           height: 10,
//           background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 30%, rgba(255,255,255,0.06) 80%, transparent 100%)',
//           filter: 'blur(6px)',
//         }}
//         initial={{ width: 0 }}
//         animate={{ width: ['0vw', '96vw'] }}
//         transition={{ delay: CRUISE_DELAY, duration: CRUISE_DURATION, ease: 'linear' }}
//       />

//       {/* Middle contrail — softer white */}
//       <motion.div
//         className="absolute rounded-full"
//         style={{
//           top: 'calc(38% + 3px)',
//           left: '-5vw',
//           height: 4,
//           background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 15%, rgba(255,255,255,0.25) 70%, transparent 100%)',
//           filter: 'blur(2px)',
//         }}
//         initial={{ width: 0 }}
//         animate={{ width: ['0vw', '96vw'] }}
//         transition={{ delay: CRUISE_DELAY, duration: CRUISE_DURATION, ease: 'linear' }}
//       />

//       {/* Bright inner contrail — the fresh trail right behind the plane */}
//       <motion.div
//         className="absolute rounded-full"
//         style={{
//           top: '38%',
//           left: '-5vw',
//           height: 2,
//           background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.95) 8%, rgba(255,255,255,0.5) 40%, transparent 100%)',
//         }}
//         initial={{ width: 0 }}
//         animate={{ width: ['0vw', '96vw'] }}
//         transition={{ delay: CRUISE_DELAY, duration: CRUISE_DURATION, ease: 'linear' }}
//       />

//       {/* Plane — SVG jet silhouette. Slight vertical drift = turbulence. */}
//       <motion.div
//         className="absolute pointer-events-none"
//         style={{ top: '36%', left: 0 }}
//         initial={{ x: '-15vw', opacity: 0 }}
//         animate={{
//           x: '105vw',
//           opacity: 1,
//           y: [0, -4, 2, -3, 0, 3, -2],
//         }}
//         transition={{
//           x: { delay: CRUISE_DELAY, duration: CRUISE_DURATION, ease: 'linear' },
//           opacity: { delay: CRUISE_DELAY, duration: 0.4 },
//           y: { delay: CRUISE_DELAY, duration: CRUISE_DURATION, ease: 'easeInOut', times: [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1] },
//         }}
//       >
//         <JetSilhouette accent={accent} />
//       </motion.div>
//     </>
//   );
// }

// Realistic jet — top-down silhouette. Sits horizontally so it reads
// as flying LEFT → RIGHT. Uses the accent color for a subtle underglow
// (running light) at the nose + tail.
function JetSilhouette({ accent }: { accent: string }) {
  return (
    <svg
      width="110"
      height="42"
      viewBox="0 0 220 84"
      style={{
        filter: `drop-shadow(0 6px 12px rgba(0,0,0,0.65)) drop-shadow(0 0 22px ${accent}44)`,
        display: 'block',
      }}
    >
      {/* Fuselage — long slim body, nose pointing RIGHT (direction of travel) */}
      <path
        d="M 10 42 C 10 36 20 32 40 32 L 170 32 C 190 32 208 36 214 40 L 214 44 C 208 48 190 52 170 52 L 40 52 C 20 52 10 48 10 42 Z"
        fill="#e5e7eb"
      />
      {/* Main wings — swept back, big triangle */}
      <path
        d="M 90 40 L 70 8  L 105 8  L 130 40 Z"
        fill="#cbd5e1"
      />
      <path
        d="M 90 44 L 70 76 L 105 76 L 130 44 Z"
        fill="#cbd5e1"
      />
      {/* Tail wing — smaller triangle near the back */}
      <path d="M 40 40 L 24 22 L 50 22 L 60 40 Z" fill="#94a3b8" />
      <path d="M 40 44 L 24 62 L 50 62 L 60 44 Z" fill="#94a3b8" />
      {/* Vertical stabiliser on top */}
      <path d="M 30 32 L 20 12 L 42 12 L 52 32 Z" fill="#94a3b8" />
      {/* Cockpit tint */}
      <path d="M 175 38 L 200 38 L 205 42 L 200 46 L 175 46 Z" fill="#0f172a" opacity="0.7" />
      {/* Nose running light */}
      <circle cx="212" cy="42" r="2" fill={accent} opacity="0.85">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="1.4s" repeatCount="indefinite" />
      </circle>
      {/* Tail running light */}
      <circle cx="14" cy="42" r="1.6" fill={accent} opacity="0.6">
        <animate attributeName="opacity" values="0.2;0.8;0.2" dur="1.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

// Falling item picker — mixes emoji (gifts, letters, hearts) with
// occasional "LOVE" text tokens so the rain reads as both gifts and
// affection. Text tokens render pink + glowing, emojis render normal.
type FallingKind = 'emoji' | 'text';
interface FallingItem { kind: FallingKind; content: string; }

const EMOJI_POOL = ['🎁', '💌', '📮', '💝', '🎀', '📦', '❤️', '💕', '💖', '💗', '💘', '✉️'];
const TEXT_POOL  = ['LOVE', 'love', 'LOVE', '♥', 'LOVE', 'xoxo'];

function pickItem(i: number): FallingItem {
  // Every 4th item is a "LOVE" text token; the rest are emoji.
  if (i % 4 === 3) return { kind: 'text', content: TEXT_POOL[(i / 4) % TEXT_POOL.length] };
  return { kind: 'emoji', content: EMOJI_POOL[i % EMOJI_POOL.length] };
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}
