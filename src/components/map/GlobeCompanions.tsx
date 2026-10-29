'use client';

// GlobeCompanions — the "red thread of fate" pair, Tơ (yarn spool) and
// Nguyệt (moon), walking together at the top of the 3D globe at
// /world, gazing out over the world. A plain fixed overlay anchored to
// the map viewport itself (not a maplibregl.Marker) — always sits at
// the same spot on screen, the visual apex of the globe, no matter how
// the globe underneath is rotated, panned, or zoomed. "nguyet" is
// mirrored to face "to" (they walk facing each other, not both facing
// forward).
//
// Both just sit (public/images/globe-companions/{id}_sit.png) — no
// expression/pose changes.
//
// Plus two continuous movement layers on top of the sit art (no extra
// art needed for either):
//   - A walking gait — horizontal sway + a footstep-cadence bob, each
//     character on its own period/phase so they don't step in lockstep.
//   - Shooting stars occasionally streak past overhead; when one does,
//     both characters flinch/duck out of its way, then settle back
//     into their walk.
//
// A missing sit file is never shown as a broken image — it's preloaded
// and verified first; if it 404s, the character just stays hidden
// rather than showing anything broken.

import { useEffect, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';

const IDLE_POSE = 'sit';

const STAR_GAP_MIN_MS = 7000;
const STAR_GAP_MAX_MS = 14000;
const STAR_FLIGHT_MS = 900;
// How far into the star's flight it's roughly overhead of the pair —
// that's when the dodge should fire, not at spawn or at despawn.
const STAR_PASS_DELAY_MS = STAR_FLIGHT_MS * 0.5;

function poseUrl(characterId: string, pose: string) {
  return `/images/globe-companions/${characterId}_${pose}.png`;
}

interface CharacterConfig {
  id: string;
  // Fixed pixel offset from center — NOT a percentage. A % gap looks
  // right on a narrow phone but scales up into a huge real gap on a
  // wide desktop viewport, since the character's own size stays a
  // fixed 72px regardless of screen width. Pixels keep them sitting
  // the same close distance apart on any screen size.
  centerOffsetPx: number;
  walkDelay: number;
  flip?: boolean; // mirror horizontally, to face the other character
}

const CHARACTERS: CharacterConfig[] = [
  { id: 'to', centerOffsetPx: -34, walkDelay: 0 },
  { id: 'nguyet', centerOffsetPx: 34, walkDelay: 0.5, flip: true },
];

function CompanionCharacter({
  id, centerOffsetPx, walkDelay, flip, dodgeSignal,
}: CharacterConfig & { dodgeSignal: number }) {
  const [everLoaded, setEverLoaded] = useState(false);
  const everLoadedRef = useRef(false);
  const activeSrc = poseUrl(id, IDLE_POSE);

  // Dodge is a one-off burst layered on TOP of the continuous walk
  // loop below (separate element, separate transform) — imperative
  // controls so it plays once per signal without fighting the loop.
  const dodgeControls = useAnimationControls();
  const lastDodgeRef = useRef(0);
  useEffect(() => {
    if (dodgeSignal === 0 || dodgeSignal === lastDodgeRef.current) return;
    lastDodgeRef.current = dodgeSignal;
    dodgeControls.start({
      x: [0, -16, 12, 0],
      y: [0, 12, -3, 0],
      rotate: [0, -10, 7, 0],
      transition: { duration: 0.5, ease: 'easeOut' },
    });
  }, [dodgeSignal, dodgeControls]);

  return (
    <motion.div
      className="absolute"
      style={{
        left: '50%',
        // The search bar + StoriesRail sit above the globe at the top of
        // the screen and are NOT purely decorative — StoriesRail opts
        // back into pointer-events (it's `pointer-events-auto` inside an
        // otherwise pass-through top bar) so its bounding box, including
        // the empty gaps between avatars, swallows taps meant for
        // whatever's underneath. A plain "15%" put the companions'
        // clickable area right inside that box. max() keeps them below
        // it on short screens while still scaling down a bit on tall
        // ones, instead of a fixed px that'd sit too low on a tablet.
        top: 'max(265px, 24%)',
        width: 72, height: 72, marginLeft: centerOffsetPx - 36,
        display: everLoaded ? 'block' : 'none',
      }}
      // A walking gait: horizontal sway + a footstep-cadence bob (two
      // dips per cycle, like alternating steps) + a slight lean into
      // each step. Own period/phase per character so they don't step
      // in lockstep with each other.
      animate={{
        x: [0, 15, 0, -15, 0],
        y: [0, -8, 0, -8, 0],
        rotate: [-3, 3, -3, 3, -3],
      }}
      transition={{ duration: 3.2, delay: walkDelay, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.div
        aria-hidden="true"
        animate={dodgeControls}
        style={{ width: 72, height: 72, filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.4))' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeSrc}
          alt=""
          className="w-full h-full object-contain"
          style={{ transform: flip ? 'scaleX(-1)' : undefined }}
          onLoad={() => { everLoadedRef.current = true; setEverLoaded(true); }}
          onError={() => { if (!everLoadedRef.current) setEverLoaded(false); }}
        />
      </motion.div>
    </motion.div>
  );
}

interface ShootingStar {
  id: number;
  topPct: number;
  fromLeft: boolean;
}

/** Occasional shooting stars streaking past overhead the pair. */
function ShootingStars({ onPass }: { onPass: () => void }) {
  const [stars, setStars] = useState<ShootingStar[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number;
    let nextId = 0;

    const schedule = () => {
      const wait = STAR_GAP_MIN_MS + Math.random() * (STAR_GAP_MAX_MS - STAR_GAP_MIN_MS);
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        const id = nextId++;
        const star: ShootingStar = {
          id,
          topPct: 4 + Math.random() * 12,
          fromLeft: Math.random() < 0.5,
        };
        setStars((prev) => [...prev, star]);
        window.setTimeout(() => { if (!cancelled) onPass(); }, STAR_PASS_DELAY_MS);
        window.setTimeout(() => {
          setStars((prev) => prev.filter((s) => s.id !== id));
        }, STAR_FLIGHT_MS + 100);
        schedule();
      }, wait);
    };
    schedule();

    return () => { cancelled = true; window.clearTimeout(timeoutId); };
  }, [onPass]);

  return (
    <>
      {stars.map((s) => (
        <motion.div
          key={s.id}
          className="absolute pointer-events-none"
          style={{ top: `${s.topPct}%`, width: 64, height: 2 }}
          initial={{ left: s.fromLeft ? '-8%' : '106%', opacity: 0 }}
          animate={{ left: s.fromLeft ? '106%' : '-8%', opacity: [0, 1, 1, 0] }}
          transition={{ duration: STAR_FLIGHT_MS / 1000, ease: 'linear' }}
        >
          <div
            style={{
              width: '100%', height: '100%',
              background: s.fromLeft
                ? 'linear-gradient(90deg, transparent, #fff)'
                : 'linear-gradient(270deg, transparent, #fff)',
              boxShadow: '0 0 6px 1px rgba(255,255,255,0.8)',
              borderRadius: 999,
            }}
          />
        </motion.div>
      ))}
    </>
  );
}

export default function GlobeCompanions() {
  const [dodgeSignal, setDodgeSignal] = useState(0);

  return (
    <>
      {CHARACTERS.map((c) => (
        <CompanionCharacter key={c.id} {...c} dodgeSignal={dodgeSignal} />
      ))}
      <ShootingStars onPass={() => setDodgeSignal((n) => n + 1)} />
    </>
  );
}
