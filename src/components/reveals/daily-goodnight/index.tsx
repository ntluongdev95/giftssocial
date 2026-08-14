'use client';

// Good Night · Golden Lantern Festival · Lakeside Edition
// ─────────────────────────────────────────────────────────────────────
// A cinematic hand-crafted reveal set on the shore of a moonlit lake.
// The recipient's photo glows inside a paper lantern that a silhouette
// couple releases from the shore; more lanterns rise all around, an
// aurora ribbon shimmers above, and everything is mirrored in the
// still water below. The recipient's name writes itself across the
// sky in cursive calligraphy.
//
// Story arc (~32s):
//
//   0-1.5s OPEN            Deep black night sky, stars twinkle, a
//                          subtle meteor may pass.
//   1.5-3s HEART           A luminous 3D rose-red heart fades in at
//                          center-top of the sky, gently rotating on
//                          the Y-axis and beating like a real heart.
//   3.5-5s GREETING        "Chúc {name} ngủ ngon" writes itself in
//                          cursive under the heart, amber underline.
//   6-9s   PHOTO (opt)     If a photo is attached, it FALLS from
//                          above the viewport as a polaroid and
//                          settles bottom-left with a soft bounce.
//   7-9s   MESSAGE         Sender's handwritten message unfolds at
//                          the bottom, signature signs off in amber.
//   24s    SHARE CTA       Share button appears.
//   32s    AUTO-CLOSE      Reveal completes, advances to share step.
//
// Layers (bottom → top):
//   sky gradient → stars → aurora → mountains → mist →
//   ambient lanterns → hero lantern → shore silhouettes → lake water
//   → water reflection (mirrored) → fireflies foreground → text.

import { useMemo, useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { getKissString } from '../_shared/useTemplateData';
import type { TemplateProps, TemplateConfig } from '../_types';

// Reveal auto-completes after this many ms — parent overlay advances
// to the share step. User can also tap the button to advance sooner.
const REVEAL_DURATION_MS = 32_000;

// ─── Palette ─────────────────────────────────────────────────────────
const ACCENT      = '#f59e0b';   // warm amber
const ACCENT_DEEP = '#c2410c';   // deep terracotta
const ACCENT_HOT  = '#fef3c7';   // hot cream (candle core)
const AURORA_A    = '#7c3aed';   // violet
const AURORA_B    = '#22d3ee';   // cyan
const AURORA_C    = '#f472b6';   // pink
const FIREFLY     = '#fef08a';   // pale yellow

// ─────────────────────────────────────────────────────────────────────
// Particle heart + persistent galaxy — 4-phase canvas reveal.
//
// TWO particle roles share one canvas:
//   HEART  (~1200 dots) — reject-sampled inside the heart curve
//     (x² + y² − 1)³ − x² · y³ ≤ 0. Follow the wow arc:
//        gather → spinning upper-galaxy → collapse into heart shape.
//   GALAXY (~600 dots)  — always live in a SECOND smaller galaxy
//     positioned BELOW the heart. Spin forever in bluish-purple
//     starlight so the heart appears suspended above a cosmic disk.
//
//   Phase 1  GATHER  (0-1.2s)  — heart dust flies to upper galaxy,
//                                galaxy dust flies to lower galaxy.
//   Phase 2  GALAXY  (1.2-3.2s)— both galaxies spin together.
//   Phase 3  MORPH   (3.2-5.0s)— upper galaxy COLLAPSES into heart;
//                                lower galaxy keeps spinning. WOW.
//   Phase 4  IDLE    (5s+)     — heart breathes above, galaxy spins
//                                beneath forever.
// ─────────────────────────────────────────────────────────────────────
function ParticleHeart({ delay = 0 }: { delay?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delay * 1000);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Two visual centers on the tall canvas — heart above, galaxy below.
    // On mobile the viewport is narrow (W small) so Math.min(W, H*0.9)
    // used to be W, giving a tiny heart. Now we use a base that leans
    // on the viewport's minor axis with a floor so mobile stays big.
    const heartCx = W / 2;
    const heartCy = H * 0.22;                           // ~21vh from top
    const isNarrow = W < 720;                           // typical mobile portrait
    const heartScale = isNarrow
      ? W * 0.34                                        // ~68vw wide heart on mobile
      : Math.min(W, H * 0.9) * 0.19;

    const galaxyCx = W / 2;
    const galaxyCy = H * 0.52;                          // ~50vh — middle of screen
    const galaxyScale = isNarrow
      ? W * 0.42                                        // ~84vw wide galaxy on mobile
      : Math.min(W, H * 0.9) * 0.22;

    type Role = 'heart' | 'galaxy';
    type P = {
      role: Role;
      // Heart target (only used when role === 'heart')
      tx: number; ty: number;
      // Galaxy assignment (polar) — heart particles use upper galaxy,
      // galaxy particles use lower galaxy.
      armAngle: number;
      armRadius: number;
      // Scatter start
      sx: number; sy: number;
      size: number;
      hue: number; light: number;              // heart particle target hue
      alpha: number;
      twinkle: number;
    };
    const particles: P[] = [];

    const HEART_TARGET = 1200;
    const GALAXY_TARGET = 600;

    // ── Heart particles (reject-sample inside the heart curve) ──
    let attempts = 0;
    while (particles.length < HEART_TARGET && attempts < HEART_TARGET * 40) {
      attempts++;
      const rx = (Math.random() - 0.5) * 2.6;
      const ry = (Math.random() - 0.5) * 2.6;
      const a = rx * rx + ry * ry - 1;
      if (a * a * a - rx * rx * ry * ry * ry > 0) continue;

      const tx = heartCx + rx * heartScale;
      const ty = heartCy - ry * heartScale;

      const idx = particles.length;
      const arm = idx % 3;
      const armT = idx / HEART_TARGET;
      const armAngle = arm * ((Math.PI * 2) / 3)
                     + armT * Math.PI * 2.3
                     + (Math.random() - 0.5) * 0.4;
      const armRadius = 0.12 + Math.sqrt(armT) * 0.9
                      + (Math.random() - 0.5) * 0.06;

      const dist = Math.hypot(rx, ry);
      particles.push({
        role: 'heart',
        tx, ty, armAngle, armRadius,
        sx: heartCx + (Math.random() - 0.5) * W * 1.8,
        sy: heartCy + (Math.random() - 0.5) * H * 1.6,
        size: 0.7 + Math.random() * 1.5,
        hue: 348 + Math.random() * 14,
        light: 42 + dist * 24 + Math.random() * 10,
        alpha: 0.6 + Math.random() * 0.35,
        twinkle: Math.random() * Math.PI * 2,
      });
    }

    // ── Lower galaxy particles (spiral arms, differential rotation) ──
    // Inner particles smaller-radius get bigger sizes + higher alpha →
    // bright dense core. Outer are dimmer wispy dust. Each particle
    // gets its own orbital speed via Kepler-like 1/√r so the swirl
    // feels physically real (inner sweeps fast, outer drags).
    for (let i = 0; i < GALAXY_TARGET; i++) {
      const arm = i % 4;
      const armT = i / GALAXY_TARGET;
      const armAngle = arm * ((Math.PI * 2) / 4)
                     + armT * Math.PI * 3.2
                     + (Math.random() - 0.5) * 0.6;
      const armRadius = 0.08 + Math.sqrt(armT) * 0.98
                      + (Math.random() - 0.5) * 0.08;
      // Radial "drift" — each particle wobbles in/out slightly around
      // its arm radius, creating a breathing swirl
      const twinkle = Math.random() * Math.PI * 2;
      // Core weighting — brighter, larger, denser toward center
      const coreWeight = Math.max(0, 1 - armRadius);
      const sizeBase = 0.55 + Math.random() * 1.1 + coreWeight * 1.4;
      const alphaBase = 0.45 + Math.random() * 0.35 + coreWeight * 0.25;

      particles.push({
        role: 'galaxy',
        tx: 0, ty: 0,
        armAngle, armRadius,
        sx: galaxyCx + (Math.random() - 0.5) * W * 1.5,
        sy: galaxyCy + (Math.random() - 0.5) * H * 1.2,
        size: sizeBase,
        hue: 0, light: 0,
        alpha: Math.min(1, alphaBase),
        twinkle,
      });
    }

    // Phase timing (ms)
    const GATHER_MS = 1200;
    const GALAXY_MS = 2000;
    const MORPH_MS  = 1800;
    const gatherEnd = GATHER_MS;
    const galaxyEnd = GATHER_MS + GALAXY_MS;
    const morphEnd  = galaxyEnd + MORPH_MS;

    const startTime = performance.now();

    const upperGalaxyXY = (p: P, spinRot: number): [number, number] => {
      const a = p.armAngle + spinRot;
      const r = p.armRadius * heartScale * 1.1;
      return [heartCx + Math.cos(a) * r, heartCy + Math.sin(a) * r * 0.65];
    };
    // Lower galaxy uses per-particle DIFFERENTIAL rotation. Inner
    // particles orbit faster (Kepler v ∝ 1/√r) so the swirl reads as
    // a gravitational vortex, not a rigid wheel. Each particle also
    // wobbles its radius slightly (radial breathing) for magic.
    const lowerGalaxyXY = (p: P, elapsed: number, tiltPhase: number): [number, number] => {
      const orbitalSpeed = 1.55 / Math.sqrt(p.armRadius + 0.25);       // faster inner, faster outer overall
      const a = p.armAngle - (elapsed / 1000) * orbitalSpeed;
      const rBreath = 1 + 0.055 * Math.sin(elapsed / 900 + p.twinkle); // radial pulse
      const r = p.armRadius * galaxyScale * rBreath;
      // Disk tilt wobble — the whole disk gently tips (as if drifting
      // in cosmic wind) which is what gives the "công trọng" gravity
      // magic feel.
      const tilt = 0.42 + 0.12 * Math.sin(tiltPhase);
      return [galaxyCx + Math.cos(a) * r, galaxyCy + Math.sin(a) * r * tilt];
    };

    const draw = (now: number) => {
      const elapsed = now - startTime;

      // ── Motion trails via destination-out (magic swirl arcs) ──
      // Each frame we FADE existing canvas content by ~12% instead of
      // clearing it entirely. Older particle positions bleed to
      // transparent, leaving faint arc trails behind fast orbits.
      // Because we use destination-out (not fillRect), there's no
      // rectangular boundary — the canvas alpha remains transparent
      // over unused areas.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      ctx.fillRect(0, 0, W, H);

      const spinBase = elapsed / 1000 * 1.1;                       // faster overall spin
      const morphT = Math.max(0, Math.min(1, (elapsed - galaxyEnd) / MORPH_MS));
      const upperSpin = spinBase * (1 - morphT * 0.7);
      const tiltPhase = elapsed / 3800;                             // slow disk tilt wobble

      ctx.globalCompositeOperation = 'lighter';

      for (const p of particles) {
        let x: number, y: number;
        let colorH: number, colorL: number, colorS: number;
        let sizeMul = 1;

        if (p.role === 'galaxy') {
          // Lower galaxy — gather with a curved trajectory, then swirl
          // forever with differential rotation + radial breathing.
          const t = Math.min(1, elapsed / gatherEnd);
          const eased = 1 - Math.pow(1 - t, 3);
          const [gx, gy] = lowerGalaxyXY(p, elapsed, tiltPhase);
          x = p.sx + (gx - p.sx) * eased;
          y = p.sy + (gy - p.sy) * eased;

          // Core weighting again for colour → hot violet-white at
          // core, cool blue-purple at edges, subtle drift over time.
          const coreWeight = Math.max(0, 1 - p.armRadius);
          const hueBase = 232 + Math.sin(elapsed / 2600 + p.twinkle) * 20;
          colorH = hueBase - coreWeight * 8;                          // core skews warmer
          colorS = 55 + coreWeight * 15;
          colorL = 68 + coreWeight * 20;                              // brighter core

          // Twinkle — inner particles twinkle faster / harder
          const twSpeed = 180 + p.armRadius * 240;
          sizeMul = 0.75 + 0.55 * Math.sin(elapsed / twSpeed + p.twinkle);
        } else if (elapsed < gatherEnd) {
          // Heart phase 1: scatter → upper galaxy
          const t = elapsed / gatherEnd;
          const eased = 1 - Math.pow(1 - t, 3);
          const [gx, gy] = upperGalaxyXY(p, upperSpin);
          x = p.sx + (gx - p.sx) * eased;
          y = p.sy + (gy - p.sy) * eased;
          colorH = 210; colorL = 82; colorS = 30;
        } else if (elapsed < galaxyEnd) {
          // Heart phase 2: upper galaxy spinning
          const [gx, gy] = upperGalaxyXY(p, upperSpin);
          x = gx; y = gy;
          colorH = 210; colorL = 82; colorS = 30;
          sizeMul = 0.8 + 0.4 * Math.sin(elapsed / 250 + p.twinkle);
        } else if (elapsed < morphEnd) {
          // Heart phase 3: galaxy → heart (the wow)
          const t = morphT;
          const eased = 1 - Math.pow(1 - t, 3);
          const [gx, gy] = upperGalaxyXY(p, upperSpin);
          x = gx + (p.tx - gx) * eased;
          y = gy + (p.ty - gy) * eased;
          colorH = 210 + (p.hue - 210) * eased;
          colorL = 82 + (p.light - 82) * eased;
          colorS = 30 + (88 - 30) * eased;
        } else {
          // Heart phase 4: idle breathe
          const heartT = (elapsed - morphEnd) / 1000;
          const breath = 1 + 0.035 * Math.sin(heartT * 2.4);
          const bx = heartCx + (p.tx - heartCx) * breath;
          const by = heartCy + (p.ty - heartCy) * breath;
          x = bx + (Math.random() - 0.5) * 0.8;
          y = by + (Math.random() - 0.5) * 0.8;
          colorH = p.hue; colorL = p.light; colorS = 88;
        }

        ctx.fillStyle = `hsla(${colorH}, ${colorS}%, ${colorL}%, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size * sizeMul, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(rafRef.current);
  }, [mounted]);

  // Canvas covers most of the viewport so the lower galaxy has room
  // to live beneath the heart without falling off-screen.
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: 0,
        top: 0,
        width: '100vw',
        height: '95vh',
        perspective: 1600,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay }}
    >
      <motion.div
        style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d' }}
        animate={{ rotateY: [-14, 14, -14] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </motion.div>
    </motion.div>
  );
}

function DailyGoodnightReveal({ kiss, onClose }: TemplateProps) {
  const photoUrl = getKissString(kiss, 'photo');
  const rawName =
    (getKissString(kiss, 'name') || kiss.receiver_name || 'you').trim();
  const displayName = rawName || 'you';

  // Ephemeral hearts spawned on tap — expire themselves after floating up.
  // Interactive delight: recipient taps anywhere → a small heart rises.
  const [tapHearts, setTapHearts] = useState<{ id: number; x: number; y: number; emoji: string; hue: number }[]>([]);
  const spawnHeart = (e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore taps on interactive descendants (close button, music pill).
    const target = e.target as HTMLElement;
    if (target.closest('button, a')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const emojis = ['❤️', '💕', '💖', '💗', '💘', '♥'];
    setTapHearts(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        hue: Math.random() * 40 - 20,
      },
    ].slice(-30));  // cap at 30 so DOM stays lean
  };

  // Time limit — auto-advance to the share step after the story arc
  // completes. Parent (KissReplayOverlay) turns onClose into setStep('share').
  useEffect(() => {
    const autoClose = setTimeout(() => onClose(), REVEAL_DURATION_MS);
    return () => clearTimeout(autoClose);
  }, [onClose]);

  // Stars — 220 across the upper 60% of sky, 3 brightness tiers so
  // the field feels natural against pitch-black backdrop.
  const stars = useMemo(() => (
    Array.from({ length: 220 }).map((_, i) => {
      const s = (i * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      const tier = i % 8 === 0 ? 'bright' : i % 3 === 0 ? 'mid' : 'faint';
      return {
        left: r(1) * 100,
        top:  r(2) * 60,
        size: tier === 'bright' ? 1.8 + r(3) * 1.2
            : tier === 'mid'    ? 1.0 + r(3) * 0.6
            :                     0.5 + r(3) * 0.5,
        delay: 2 + r(4) * 6,
        duration: 3 + r(5) * 4,
        baseOpacity: tier === 'bright' ? 1.0
                   : tier === 'mid'    ? 0.85
                   :                     0.55,
      };
    })
  ), []);

  // Shooting stars — SUBTLE accents. Real meteors are quick faint
  // streaks (0.3-0.8s), thin, thin trail, no dramatic glow. They set
  // atmosphere; the drone name is the hero. 4 sequenced streaks
  // spaced ~10s apart so they feel like distinct occasional wishes.
  const shootingStars = useMemo(() => {
    const COUNT = 4;
    const GAP = 10;                                         // seconds between arrivals
    const CYCLE = COUNT * GAP;                              // full loop ~40s
    return Array.from({ length: COUNT }).map((_, i) => {
      const s = (i * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;

      const angleDeg = 30 + r(1) * 20;                      // 30-50°
      const angleRad = (angleDeg * Math.PI) / 180;

      const distance = 55 + r(2) * 25;                      // 55-80vw — shorter travel
      const dxSign = i % 2 === 0 ? 1 : -1;
      const dx = Math.cos(angleRad) * distance * dxSign;
      const dy = Math.sin(angleRad) * distance;

      // Enter from top edge, exit lower down — like a real meteor
      const startX = dxSign > 0 ? 5 + r(4) * 30 : 65 + r(4) * 30;
      const startY = -8 + r(5) * 8;                          // just above viewport

      const trailAngle = (Math.atan2(dy, dx) * 180) / Math.PI;

      const duration = 0.45 + r(6) * 0.35;                  // 0.45-0.8s — fast blink

      return {
        id: i,
        startX, startY, dx, dy, trailAngle,
        duration,
        delay:       i * GAP + r(7) * 1.5 + 4,              // first at ~4-5s
        repeatDelay: CYCLE - duration,
        length:      80 + r(9) * 40,                        // 80-120px — SHORT thin streak
      };
    });
  }, []);

  // 18 fireflies floating in the foreground near the shore
  const fireflies = useMemo(() => (
    Array.from({ length: 18 }).map((_, i) => {
      const s = (i * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      return {
        id: i,
        left: 10 + r(1) * 80,
        bottom: 20 + r(2) * 20,
        driftX: (r(3) - 0.5) * 80,
        driftY: (r(4) - 0.5) * 40,
        duration: 6 + r(5) * 4,
        delay: 3 + r(6) * 8,
        size: 3 + r(7) * 3,
      };
    })
  ), []);

  // Drone show — sample the receiver's name into pixel targets, then
  // each dot becomes a bright LED "drone" that flies in from a random
  // off-screen edge and assembles into the name shape. Feels like a
  // modern drone light show writing across the night sky.
  //
  // Timeline (relative to reveal start):
  //   0-2s   : sky quiet, first meteor
  //   2-6s   : drones fly in from all 4 edges toward targets
  //   6-9s   : drones lock into formation, gentle breathing pulse
  //   9s+    : "chúc" / "ngủ ngon" text fades in around the formation
  //   12-14s : sender message unfolds below
  //   14-18s : photo reveals (if any) via chosen concept
  //
  // Text is rendered off-screen in a hidden canvas; pixels with
  // alpha > threshold become target positions. ~100 drones total.
  return (
    <div className="fixed inset-0 z-[200] overflow-hidden cursor-pointer" onClick={spawnHeart}>
      {/* ─── SKY BACKDROP · deep BLACK night sky ─────────────────────
             Pure velvet black with only a whisper of navy at the very
             top so the stars have something to breathe against. No
             warm dusk / horizon glow — lanterns provide all the warmth
             so they stand out against the darkness. */}
      <div className="absolute inset-0" style={{
        background:
          'radial-gradient(ellipse at 50% 15%, rgba(20,15,45,0.35) 0%, transparent 55%),' +
          'linear-gradient(180deg, #000105 0%, #010208 45%, #000104 100%)',
      }} />

      {/* ─── STARS · 220 dots across upper 60%, 3 brightness tiers ── */}
      {stars.map((s, i) => (
        <motion.div
          key={`star-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${s.left}%`, top: `${s.top}%`,
            width: s.size, height: s.size,
            background: '#ffffff',
            // Every star gets a soft white halo — bigger stars glow
            // stronger so they read as "sang" (bright) even against
            // pitch-black sky.
            boxShadow: s.size > 1.4
              ? `0 0 ${s.size * 3}px rgba(255,255,255,0.9), 0 0 ${s.size * 6}px rgba(255,255,255,0.35)`
              : `0 0 ${s.size * 2}px rgba(255,255,255,0.55)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [s.baseOpacity * 0.35, s.baseOpacity, s.baseOpacity * 0.35] }}
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* ─── SHOOTING STARS · 4 subtle streaks ~10s apart ────────────
             Short thin streak with pre-rotated tapered gradient.
             The whole streak is translated across the sky in a fast
             ~0.6s pass. No scale, no dot, no dramatic glow. */}
      {shootingStars.map(ss => (
        <motion.div
          key={`ss-${ss.id}`}
          className="absolute pointer-events-none"
          style={{ left: 0, top: 0 }}
          initial={{
            x: `${ss.startX}vw`,
            y: `${ss.startY}vh`,
            opacity: 0,
          }}
          animate={{
            x: `${ss.startX + ss.dx}vw`,
            y: `${ss.startY + ss.dy}vh`,
            opacity: [0, 0.7, 0.7, 0],
          }}
          transition={{
            duration: ss.duration,
            delay: ss.delay,
            repeat: Infinity,
            repeatDelay: ss.repeatDelay,
            ease: 'linear',
            times: [0, 0.15, 0.75, 1],
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: 0,                          // head at outer origin
              top: -0.75,
              width: ss.length,
              height: 1.5,                       // thin
              transformOrigin: '100% 50%',
              transform: `rotate(${ss.trailAngle}deg)`,
              borderRadius: 1.5,
              background:
                'linear-gradient(to right,' +
                '  rgba(255,255,255,0) 0%,' +
                '  rgba(255,255,255,0.15) 60%,' +
                '  rgba(255,255,255,0.7) 95%,' +
                '  rgba(255,255,255,0.9) 100%)',
              boxShadow: '0 0 3px rgba(255,255,255,0.4)',   // single soft glow
            }}
          />
        </motion.div>
      ))}

      {/* ─── PHOTO INSIDE THE HEART · heart-shaped clip, sits at the
             centre of the particle heart. This template REQUIRES a
             photo — the reveal is designed around it. Materializes at
             ~7s after the particle heart completes its morph, so the
             sequence reads: dust gathers → galaxy → heart forms from
             particles → photo shimmers into life within the heart. */}
      {photoUrl && (
        // Outer wrapper handles STATIC centering via translate(-50%,-50%)
        // — placed OUTSIDE the motion.div because framer-motion's own
        // scale animation would otherwise overwrite the transform.
        <div
          className="absolute pointer-events-none"
          style={{
            left: '50%',
            top: '22vh',                              // matches heartCy = H×0.22
            transform: 'translate(-50%, -50%)',
            width: 'clamp(150px, 32vw, 220px)',
            height: 'clamp(150px, 32vw, 220px)',
          }}
        >
        <motion.div
          style={{ width: '100%', height: '100%' }}
          initial={{ opacity: 0, scale: 0.35 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.8, delay: 7, ease: [0.16, 1, 0.3, 1] }}
        >
          <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ overflow: 'visible' }}>
            <defs>
              <clipPath id="photo-heart-clip">
                <path d="M50 88 C 20 66, 4 46, 4 30 C 4 14, 18 4, 30 4 C 40 4, 46 10, 50 20 C 54 10, 60 4, 70 4 C 82 4, 96 14, 96 30 C 96 46, 80 66, 50 88 Z" />
              </clipPath>
            </defs>
            {/* Photo clipped to the heart curve */}
            <image
              href={photoUrl}
              x="0" y="0" width="100" height="100"
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#photo-heart-clip)"
              style={{ filter: 'drop-shadow(0 0 12px rgba(244,63,94,0.5))' }}
            />
            {/* Glowing rose rim outline */}
            <path
              d="M50 88 C 20 66, 4 46, 4 30 C 4 14, 18 4, 30 4 C 40 4, 46 10, 50 20 C 54 10, 60 4, 70 4 C 82 4, 96 14, 96 30 C 96 46, 80 66, 50 88 Z"
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="1.2"
              style={{ filter: 'drop-shadow(0 0 4px #ec4899) drop-shadow(0 0 12px rgba(244,63,94,0.55))' }}
            />
          </svg>
        </motion.div>
        </div>
      )}

      {/* ─── MOUNTAINS · silhouette range ─────────────────────── */}
      <svg
        viewBox="0 0 1000 220"
        preserveAspectRatio="none"
        className="absolute inset-x-0 w-full pointer-events-none"
        style={{ bottom: '30%', height: '20%' }}
      >
        {/* Far mountains — cool near-black navy, blends with night sky */}
        <path
          d="M 0 220 L 0 140 Q 80 100 160 120 T 320 105 T 500 90 T 680 100 T 850 80 T 1000 105 L 1000 220 Z"
          fill="#050a14"
          opacity="0.9"
        />
        {/* Near mountains — pitch black silhouette */}
        <path
          d="M 0 220 L 0 170 Q 120 150 240 160 T 460 150 T 700 165 T 1000 155 L 1000 220 Z"
          fill="#000104"
        />
      </svg>

      {/* ─── MIST · cool low fog between mountains and water ──── */}
      <div className="absolute inset-x-0 pointer-events-none" style={{
        bottom: '28%', height: '10%',
        background: 'linear-gradient(180deg, transparent, rgba(60,80,120,0.14) 40%, rgba(40,60,100,0.18))',
        filter: 'blur(4px)',
      }} />

      {/* ─── SHORE + TWO SILHOUETTES · sitting side by side (distant
             ambient — kept from start for scene depth) ────────── */}
      <div className="absolute inset-x-0 pointer-events-none" style={{ bottom: '30%' }}>
        <ShoreSilhouettes accent={ACCENT} />
      </div>

      {/* ─── SINGLE FIGURE · stands ON the galaxy, gazing up at the
             heart. Feet anchored at the galaxy centreline. Fades in
             after the heart wow so the eye lands on the heart first. */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          left: '50%',
          top: '42vh',                             // head-top; feet land near galaxy center ~50vh
          transform: 'translateX(-50%)',
          width: 'clamp(70px, 10vw, 110px)',
          height: 'clamp(120px, 17vw, 190px)',
        }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.6, delay: 8, ease: [0.16, 1, 0.3, 1] }}
      >
        <SingleFigure accent={ACCENT_HOT} />
      </motion.div>

      {/* ─── FLYING HEARTS · rise from the figure up to the photo in
             the heart. 6 hearts on staggered infinite loops so there's
             always at least one drifting upward. Each sways left-right
             during the flight (sine drift) and fades near the top. */}
      {[0, 1, 2, 3, 4, 5].map(i => {
        const s = (i * 2654435761) >>> 0;
        const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
        const sway = (r(1) - 0.5) * 12;                    // ±6vw sway
        const size = 14 + r(2) * 10;                       // 14-24px
        const dur = 4.5 + r(3) * 1.5;                      // 4.5-6s ascent
        return (
          <motion.div
            key={`fh-${i}`}
            className="absolute pointer-events-none"
            style={{
              left: '50%',
              top: '48vh',                                 // near figure's chest
              transform: 'translateX(-50%)',
              width: size,
              height: size,
            }}
            initial={{ y: 0, x: 0, opacity: 0, scale: 0.3 }}
            animate={{
              y:       [0, `-32vh`],                       // travel up to heart center
              x:       [0, `${sway}vw`, `${-sway}vw`, `${sway * 0.4}vw`],
              opacity: [0, 0.95, 0.95, 0],
              scale:   [0.3, 1, 1, 0.7],
            }}
            transition={{
              duration: dur,
              delay: 10 + i * 0.8,                         // start after figure lands
              repeat: Infinity,
              repeatDelay: 2 + (i % 3),
              ease: 'easeOut',
              times: [0, 0.2, 0.75, 1],
            }}
          >
            <svg viewBox="0 0 20 20" width="100%" height="100%" style={{ filter: 'drop-shadow(0 0 4px #ef4444) drop-shadow(0 0 10px rgba(244,63,94,0.6))' }}>
              <path d="M 10 18 C 4 13, 1 9, 1 6 C 1 3, 3 1, 6 1 C 8 1, 9 2, 10 4 C 11 2, 12 1, 14 1 C 17 1, 19 3, 19 6 C 19 9, 16 13, 10 18 Z" fill="#ef4444" />
              <path d="M 10 18 C 4 13, 1 9, 1 6 C 1 3, 3 1, 6 1 C 8 1, 9 2, 10 4 C 11 2, 12 1, 14 1 C 17 1, 19 3, 19 6 C 19 9, 16 13, 10 18 Z" fill="url(#fh-sheen)" opacity="0.7" />
              <defs>
                <radialGradient id="fh-sheen" cx="30%" cy="25%" r="50%">
                  <stop offset="0%"   stopColor="#fff" stopOpacity="0.9" />
                  <stop offset="60%"  stopColor="#fff" stopOpacity="0" />
                </radialGradient>
              </defs>
            </svg>
          </motion.div>
        );
      })}

      {/* ─── LAKE WATER · dark reflective surface ────────────── */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{
        height: '30%',
        background:
          'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(20,10,25,0.85) 40%, #050208 100%)',
      }}>
        {/* Wave ripples — subtle horizontal streaks */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <motion.div
            key={`wave-${i}`}
            className="absolute inset-x-0"
            style={{
              top: `${8 + i * 11}%`,
              height: 1,
              background: `linear-gradient(90deg, transparent 10%, rgba(200,220,255,${0.08 + Math.random() * 0.08}) 50%, transparent 90%)`,
              filter: 'blur(0.5px)',
            }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 3 + i * 0.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
          />
        ))}
      </div>

      {/* ─── FIREFLIES · foreground magic ────────────────────── */}
      {fireflies.map(f => (
        <motion.div
          key={`ff-${f.id}`}
          className="absolute pointer-events-none rounded-full"
          style={{
            left: `${f.left}%`,
            bottom: `${f.bottom}%`,
            width: f.size,
            height: f.size,
            background: FIREFLY,
            boxShadow: `0 0 8px ${FIREFLY}, 0 0 16px ${FIREFLY}88, 0 0 32px ${FIREFLY}55`,
          }}
          initial={{ opacity: 0, x: 0, y: 0 }}
          animate={{
            x: [0, f.driftX, -f.driftX * 0.5, 0],
            y: [0, f.driftY, -f.driftY, 0],
            opacity: [0, 1, 0.4, 1, 0.3, 1, 0],
          }}
          transition={{
            duration: f.duration,
            delay: f.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* ─── 3D PARTICLE HEART · ~1400 rose-red dots forming the heart
             curve, drifting/converging + subtle 3D swing + bloom halo.
             Sits high in the sky. */}
      <ParticleHeart delay={0.8} />


      {/* ─── GREETING · "Chúc {name} ngủ ngon" under the heart ────── */}
      <motion.div
        className="absolute inset-x-0 pointer-events-none text-center px-6"
        style={{ top: '66%' }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.6, delay: 6 }}
      >
        <div
          style={{
            fontFamily: '"Dancing Script", "Segoe Script", "Snell Roundhand", cursive',
            fontSize: 'clamp(28px, 5vw, 56px)',
            fontWeight: 500,
            color: '#fff',
            lineHeight: 1.1,
            textShadow: `
              0 0 18px ${ACCENT}88,
              0 0 36px ${ACCENT}55,
              0 4px 20px rgba(0,0,0,0.75)
            `,
          }}
        >
          Chúc {displayName} ngủ ngon
        </div>
        <motion.div
          className="mx-auto mt-3 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: 'clamp(140px, 26%, 300px)' }}
          transition={{ duration: 1.8, delay: 7.5, ease: [0.16, 1, 0.3, 1] }}
          style={{
            height: 1.5,
            background: `linear-gradient(90deg, transparent, ${ACCENT}, ${ACCENT_HOT}, ${ACCENT}, transparent)`,
            filter: `drop-shadow(0 0 6px ${ACCENT})`,
            opacity: 0.75,
          }}
        />
      </motion.div>

      {/* ─── SENDER MESSAGE · handwritten note, appears BELOW the
             greeting after the heart + greeting settle. */}
      {kiss.message && (
        <motion.div
          className="absolute inset-x-0 pointer-events-none px-8 text-center"
          style={{ top: '78%' }}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.6, delay: 9 }}
        >
          <div
            className="max-w-lg mx-auto leading-relaxed"
            style={{
              fontFamily: '"Dancing Script", "Segoe Script", cursive',
              color: 'rgba(255,240,220,0.95)',
              textShadow: '0 2px 12px rgba(0,0,0,0.8)',
              fontSize: 'clamp(20px, 3vw, 28px)',
              fontStyle: 'italic',
            }}
          >
            &ldquo;{kiss.message}&rdquo;
          </div>
          {kiss.sender_name && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 11 }}
              className="mt-3"
              style={{
                fontFamily: '"Dancing Script", cursive',
                color: ACCENT,
                fontSize: 20,
                textShadow: `0 0 12px ${ACCENT}66`,
              }}
            >
              — {kiss.sender_name}
            </motion.div>
          )}
        </motion.div>
      )}

      {/* ─── TAP HEARTS · spawn on every tap, float up + fade ── */}
      {tapHearts.map(h => (
        <motion.div
          key={h.id}
          className="absolute pointer-events-none select-none"
          style={{
            left: h.x - 16,
            top:  h.y - 16,
            fontSize: 32,
            filter: `drop-shadow(0 0 10px ${ACCENT}88) hue-rotate(${h.hue}deg)`,
          }}
          initial={{ y: 0, scale: 0.4, opacity: 0 }}
          animate={{
            y: -180,
            scale: [0.4, 1.4, 1.1, 0.9],
            opacity: [0, 1, 1, 0],
          }}
          transition={{ duration: 2.4, ease: 'easeOut' }}
          onAnimationComplete={() => setTapHearts(prev => prev.filter(x => x.id !== h.id))}
        >
          {h.emoji}
        </motion.div>
      ))}

      {/* Tap hint · appears briefly at start */}
      <motion.div
        className="absolute inset-x-0 pointer-events-none text-center px-6"
        style={{ bottom: '2%' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.55, 0.55, 0] }}
        transition={{ duration: 6, delay: 4, times: [0, 0.15, 0.75, 1] }}
      >
        <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: ACCENT, textShadow: `0 0 8px ${ACCENT}` }}>
          ♥ chạm để thả tim ♥
        </div>
      </motion.div>

      {/* Close button — highest z-index */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 z-[220] w-9 h-9 rounded-full bg-black/60 backdrop-blur text-white flex items-center justify-center cursor-pointer hover:bg-black/80"
        style={{ boxShadow: `0 0 12px ${ACCENT}55` }}
      >
        <X size={18} />
      </button>

      {/* AudioPlayer moved to KissReplayOverlay so music plays across
          the ENTIRE journey (intro → flying → template) instead of
          only during the template reveal. */}
    </div>
  );
}

// ── AURORA RIBBON · shimmering colored waves across upper sky ────────
function AuroraRibbon() {
  return (
    <svg
      viewBox="0 0 1000 400"
      preserveAspectRatio="none"
      className="absolute inset-x-0 top-0 w-full pointer-events-none"
      style={{ height: '55%', opacity: 0.5, mixBlendMode: 'screen' }}
    >
      <defs>
        <linearGradient id="aurora-a" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={AURORA_A} stopOpacity="0" />
          <stop offset="50%"  stopColor={AURORA_A} stopOpacity="0.7" />
          <stop offset="100%" stopColor={AURORA_A} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="aurora-b" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={AURORA_B} stopOpacity="0" />
          <stop offset="50%"  stopColor={AURORA_B} stopOpacity="0.7" />
          <stop offset="100%" stopColor={AURORA_B} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="aurora-c" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={AURORA_C} stopOpacity="0" />
          <stop offset="50%"  stopColor={AURORA_C} stopOpacity="0.6" />
          <stop offset="100%" stopColor={AURORA_C} stopOpacity="0" />
        </linearGradient>
        <filter id="aurora-blur">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>
      <g filter="url(#aurora-blur)">
        <motion.path
          d="M -100 180 Q 250 60 500 140 T 1100 100 L 1100 260 Q 750 320 500 240 T -100 260 Z"
          fill="url(#aurora-a)"
          animate={{ d: [
            'M -100 180 Q 250 60 500 140 T 1100 100 L 1100 260 Q 750 320 500 240 T -100 260 Z',
            'M -100 160 Q 250 100 500 120 T 1100 140 L 1100 240 Q 750 280 500 220 T -100 240 Z',
            'M -100 180 Q 250 60 500 140 T 1100 100 L 1100 260 Q 750 320 500 240 T -100 260 Z',
          ] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.path
          d="M -100 220 Q 300 140 500 180 T 1100 160 L 1100 320 Q 700 380 500 300 T -100 320 Z"
          fill="url(#aurora-b)"
          animate={{ d: [
            'M -100 220 Q 300 140 500 180 T 1100 160 L 1100 320 Q 700 380 500 300 T -100 320 Z',
            'M -100 240 Q 300 200 500 200 T 1100 180 L 1100 300 Q 700 340 500 280 T -100 300 Z',
            'M -100 220 Q 300 140 500 180 T 1100 160 L 1100 320 Q 700 380 500 300 T -100 320 Z',
          ] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        <motion.path
          d="M -100 140 Q 200 40 500 100 T 1100 80 L 1100 220 Q 800 260 500 200 T -100 220 Z"
          fill="url(#aurora-c)"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
      </g>
    </svg>
  );
}

// ── SHORE SILHOUETTES · two adults sitting on the ground, looking up ─
function ShoreSilhouettes({ accent }: { accent: string }) {
  return (
    <svg
      viewBox="0 0 400 140"
      preserveAspectRatio="xMidYEnd meet"
      className="w-full block"
      style={{ maxHeight: 160 }}
    >
      {/* Ground line */}
      <line x1="0" y1="130" x2="400" y2="130" stroke="#000" strokeWidth="1.5" opacity="0.7" />

      {/* Small warm glow between them where the hero lantern originates */}
      <motion.ellipse
        cx="200" cy="110" rx="20" ry="6"
        fill={accent}
        opacity="0.4"
        style={{ filter: `drop-shadow(0 0 12px ${accent})` }}
        animate={{ opacity: [0.2, 0.7, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* LEFT figure — sitting cross-legged, head tilted back looking up */}
      <g fill="#000">
        {/* Head */}
        <ellipse cx="175" cy="60" rx="9" ry="10" transform="rotate(-10 175 60)" />
        {/* Short hair top */}
        <path
          d="M 165 55 Q 165 45 175 45 Q 185 45 185 55 Q 179 51 175 51 Q 171 51 165 55 Z"
          transform="rotate(-10 175 60)"
        />
        {/* Neck */}
        <rect x="172" y="70" width="6" height="6" />
        {/* Torso — leaning back slightly */}
        <path d="M 162 76 Q 158 90 162 108 L 190 108 Q 194 90 190 76 Q 184 74 175 74 Q 168 74 162 76 Z" />
        {/* Arm reaching toward the other */}
        <path d="M 190 84 Q 200 88 208 92 Q 208 96 205 96 Q 196 92 188 90 Z" />
        {/* Crossed legs — abstract triangle shape */}
        <path d="M 158 108 L 152 130 L 200 130 L 200 108 Z" />
      </g>

      {/* RIGHT figure — sitting close, long hair, head tilted */}
      <g fill="#000">
        <ellipse cx="225" cy="60" rx="9" ry="10" transform="rotate(10 225 60)" />
        {/* Long hair cascade */}
        <path
          d="M 215 55 Q 210 62 210 76 Q 210 90 216 96 L 232 96 Q 240 90 240 76 Q 240 62 235 55 Q 230 51 225 51 Q 220 51 215 55 Z"
          transform="rotate(10 225 60)"
        />
        <rect x="222" y="72" width="6" height="6" />
        <path d="M 210 78 Q 206 92 210 108 L 240 108 Q 244 92 240 78 Q 234 76 225 76 Q 216 76 210 78 Z" />
        {/* Left arm reaching toward the other */}
        <path d="M 210 84 Q 200 88 192 92 Q 192 96 195 96 Q 204 92 212 90 Z" />
        {/* Crossed legs */}
        <path d="M 200 108 L 200 130 L 248 130 L 242 108 Z" />
      </g>
    </svg>
  );
}

// ── SINGLE FIGURE ─────────────────────────────────────────────────────
// One silhouette viewed from BEHIND, standing on top of the galaxy disk,
// gazing UP at the heart. Feet at the bottom of the viewBox — the
// container places those feet on the galaxy centreline. Warm rim halo
// on head/shoulders picks up the heart's light. Arms slightly out to
// the sides suggest reaching / offering.
function SingleFigure({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 120 200" preserveAspectRatio="xMidYEnd meet" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <radialGradient id="figure-halo" cx="50%" cy="20%" r="55%">
          <stop offset="0%"   stopColor={accent} stopOpacity="0.5" />
          <stop offset="55%"  stopColor="#f472b6" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Warm halo above head */}
      <ellipse cx="60" cy="30" rx="60" ry="40" fill="url(#figure-halo)" />

      <g fill="#000">
        {/* Head from behind */}
        <ellipse cx="60" cy="36" rx="18" ry="20" />
        {/* Short hair silhouette */}
        <path d="M 42 38 Q 42 16 60 16 Q 78 16 78 38 Q 72 28 60 28 Q 48 28 42 38 Z" />
        {/* Neck */}
        <rect x="52" y="54" width="16" height="10" />
        {/* Torso — broad shoulders, taper at waist */}
        <path d="M 32 64
                 Q 26 90 30 138
                 L 90 138
                 Q 94 90 88 64
                 Q 76 58 60 58
                 Q 44 58 32 64 Z" />
        {/* Left arm — hanging slightly out to the side */}
        <path d="M 32 68
                 Q 22 92 26 128
                 Q 22 130 20 128
                 Q 14 92 26 66 Z" />
        {/* Right arm — hanging slightly out to the side */}
        <path d="M 88 68
                 Q 98 92 94 128
                 Q 98 130 100 128
                 Q 106 92 94 66 Z" />
        {/* Legs — standing wide-stance */}
        <path d="M 34 138 L 30 200 L 54 200 L 58 138 Z" />
        <path d="M 62 138 L 66 200 L 90 200 L 86 138 Z" />
      </g>

      {/* Rim light on head + shoulders — catches light from the heart above */}
      <g opacity="0.5" fill={accent} style={{ filter: `drop-shadow(0 0 6px ${accent})` }}>
        <path d="M 44 26 Q 60 14 76 26 Q 68 18 60 18 Q 52 18 44 26 Z" />
        <path d="M 32 66 Q 60 58 88 66 Q 78 62 60 62 Q 42 62 32 66 Z" />
      </g>
    </svg>
  );
}

// ── LANTERN COMPONENTS ────────────────────────────────────────────────

// Ambient lantern — used dozens of times for the fleet + reflections
function Lantern() {
  return (
    <svg width="60" height="90" viewBox="0 0 60 90">
      <defs>
        <radialGradient id="lantern-glow-body" cx="50%" cy="50%">
          <stop offset="0%"   stopColor={ACCENT_HOT} stopOpacity="0.95" />
          <stop offset="45%"  stopColor={ACCENT}     stopOpacity="0.9" />
          <stop offset="90%"  stopColor={ACCENT_DEEP} stopOpacity="0.75" />
          <stop offset="100%" stopColor={ACCENT_DEEP} stopOpacity="0.5" />
        </radialGradient>
      </defs>
      <line x1="30" y1="0" x2="30" y2="14" stroke="#78350f" strokeWidth="0.8" />
      <ellipse cx="30" cy="15" rx="10" ry="3" fill="#7c2d12" />
      <path
        d="M 20 16 Q 12 30 12 45 Q 12 60 20 74 L 40 74 Q 48 60 48 45 Q 48 30 40 16 Z"
        fill="url(#lantern-glow-body)"
        stroke={ACCENT_DEEP}
        strokeWidth="0.6"
        style={{ filter: `drop-shadow(0 0 8px ${ACCENT})` }}
      />
      <line x1="14" y1="30" x2="46" y2="30" stroke={ACCENT_DEEP} strokeWidth="0.4" opacity="0.7" />
      <line x1="13" y1="45" x2="47" y2="45" stroke={ACCENT_DEEP} strokeWidth="0.4" opacity="0.7" />
      <line x1="14" y1="60" x2="46" y2="60" stroke={ACCENT_DEEP} strokeWidth="0.4" opacity="0.7" />
      <ellipse cx="30" cy="75" rx="10" ry="3" fill="#7c2d12" />
      <line x1="30" y1="78" x2="30" y2="86" stroke="#78350f" strokeWidth="0.6" />
      <circle cx="30" cy="87" r="1.5" fill={ACCENT} />
    </svg>
  );
}

// Hero lantern — bigger + carries the recipient's photo
function HeroLantern({ photoUrl }: { photoUrl?: string }) {
  return (
    <svg width="240" height="360" viewBox="0 0 240 360">
      <defs>
        <radialGradient id="hero-body-glow" cx="50%" cy="55%">
          <stop offset="0%"   stopColor={ACCENT_HOT} stopOpacity="1" />
          <stop offset="30%"  stopColor={ACCENT}     stopOpacity="0.95" />
          <stop offset="70%"  stopColor={ACCENT_DEEP} stopOpacity="0.85" />
          <stop offset="100%" stopColor={ACCENT_DEEP} stopOpacity="0.5" />
        </radialGradient>
        <clipPath id="hero-photo-mask">
          <circle cx="120" cy="180" r="60" />
        </clipPath>
        <filter id="hero-paper-noise" x="0" y="0" width="1" height="1">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" />
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.85  0 0 0 0 0.6  0 0 0 0.15 0" />
        </filter>
      </defs>

      {/* Rope */}
      <line x1="120" y1="0" x2="120" y2="46" stroke="#78350f" strokeWidth="2.2" />
      <ellipse cx="120" cy="20" rx="6" ry="6" fill="#78350f" />

      {/* Top cap */}
      <ellipse cx="120" cy="52" rx="42" ry="10" fill="#7c2d12" />
      <ellipse cx="120" cy="50" rx="42" ry="8" fill="#c2410c" />

      {/* Body */}
      <path
        d="M 78 54 Q 48 130 48 180 Q 48 232 78 306 L 162 306 Q 192 232 192 180 Q 192 130 162 54 Z"
        fill="url(#hero-body-glow)"
        stroke={ACCENT_DEEP}
        strokeWidth="1.6"
        style={{ filter: `drop-shadow(0 0 40px ${ACCENT}) drop-shadow(0 0 80px ${ACCENT}88)` }}
      />

      {/* Bamboo seams */}
      {[90, 130, 180, 230, 270].map(y => (
        <line
          key={y}
          x1={y === 90 || y === 270 ? 66 : y === 130 || y === 230 ? 52 : 48}
          y1={y}
          x2={y === 90 || y === 270 ? 174 : y === 130 || y === 230 ? 188 : 192}
          y2={y}
          stroke={ACCENT_DEEP}
          strokeWidth="1.2"
          opacity="0.75"
        />
      ))}

      {/* Photo inside */}
      {photoUrl ? (
        <>
          <circle cx="120" cy="180" r="60" fill={ACCENT_HOT} opacity="0.4" />
          <g clipPath="url(#hero-photo-mask)">
            <image
              href={photoUrl}
              x="60" y="120" width="120" height="120"
              preserveAspectRatio="xMidYMid slice"
              style={{ mixBlendMode: 'screen', opacity: 0.75 }}
            />
          </g>
          <circle
            cx="120" cy="180" r="60"
            fill="none"
            stroke={ACCENT_HOT}
            strokeWidth="1.5"
            opacity="0.6"
            style={{ filter: `drop-shadow(0 0 10px ${ACCENT})` }}
          />
        </>
      ) : (
        <g>
          <ellipse cx="120" cy="200" rx="18" ry="30" fill={ACCENT_HOT} opacity="0.85" />
          <ellipse cx="120" cy="192" rx="10" ry="18" fill="#fff" opacity="0.6" />
        </g>
      )}

      {/* Bottom cap */}
      <ellipse cx="120" cy="308" rx="42" ry="10" fill="#7c2d12" />
      <ellipse cx="120" cy="306" rx="42" ry="8" fill="#c2410c" />

      {/* Tassel */}
      <line x1="120" y1="316" x2="120" y2="352" stroke="#78350f" strokeWidth="1.4" />
      <circle cx="120" cy="356" r="6" fill={ACCENT} style={{ filter: `drop-shadow(0 0 6px ${ACCENT})` }} />

      {/* Paper texture overlay */}
      <path
        d="M 78 54 Q 48 130 48 180 Q 48 232 78 306 L 162 306 Q 192 232 192 180 Q 192 130 162 54 Z"
        filter="url(#hero-paper-noise)"
        opacity="0.25"
      />
    </svg>
  );
}

export default DailyGoodnightReveal;

export const DailyGoodnightConfig: TemplateConfig = {
  id: 'daily-goodnight',
  name: 'Good Night',
  occasionIds: ['daily'],
  emoji: '🏮',
  description: 'Lakeside golden lantern festival — two silhouettes release a photo-lit lantern from the shore, an aurora shimmers above, dozens more lanterns rise and reflect in the still water, ending with a handwritten "chúc ngủ ngon".',
  thumbnailBg: 'linear-gradient(135deg, #050208, #7c3aed, #f59e0b)',
  Component: DailyGoodnightReveal,
};
