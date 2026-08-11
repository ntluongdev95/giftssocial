'use client';

import { useMemo } from 'react';

// Ambient shooting-star overlay layered on top of the drone show.
// Not rendered in WebGL — pure CSS-animated divs so it doesn't
// interfere with the drone canvas. Each star owns its own keyframe
// (generated at mount) that:
//
//   1) Holds the star INVISIBLE at its off-screen start for most of
//      the cycle,
//   2) Snaps to opacity 1 and streaks across the sky over ~1.4s,
//   3) Fades to opacity 0 at the end position.
//
// The N stars share a total cycle length but are STAGGERED via
// negative `animation-delay` so their shoots don't overlap — a
// tidy visual rhythm of "every ~10s one star vụt qua" instead of
// bursts of simultaneous streaks.

type Props = {
  /** How many stars to spawn. Their shoots stagger evenly across the
   *  cycle so at most one is visible at a time. Default 4 gives one
   *  visible star every ~cycle/count seconds. */
  count?: number;
  /** Cycle duration per star in ms. Default 12000. */
  cycleMs?: number;
};

// Deterministic PRNG so the star layout is stable across renders —
// no jitter from React re-render.
function makeRNG(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function ShootingStars({ count = 4, cycleMs = 12000 }: Props) {
  const stars = useMemo(() => {
    const rnd = makeRNG(count * 37 + Math.round(cycleMs / 100));
    return Array.from({ length: count }, (_, i) => {
      // Start off the left/top edge. End off the right/bottom edge.
      // vw/vh units so the stars naturally scale with the viewport.
      const startX = -12 - rnd() * 10;
      const startY = 4 + rnd() * 32;
      const endX = 105 + rnd() * 15;
      // End Y falls below start Y — reads as "gravity pulling the star
      // downward across the sky" rather than a horizontal laser.
      const endY = startY + 18 + rnd() * 30;
      const dx = endX - startX;
      const dy = endY - startY;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const delayMs = -(cycleMs / count) * i - Math.floor(rnd() * 600);
      return { i, startX, startY, endX, endY, angle, delayMs };
    });
  }, [count, cycleMs]);

  // Per-star keyframes injected inline. Each star waits ~72% of the
  // cycle at its start position, then streaks 72→97% (that's a
  // longer, more readable trail — ~1.75s for a 7s cycle) and fades.
  // Longer visible window makes shooting stars easy to catch even at
  // a quick glance.
  const keyframesCss = stars
    .map(
      (s) => `
    @keyframes gao-shoot-${s.i} {
      0%    { opacity: 0; transform: translate(${s.startX}vw, ${s.startY}vh) rotate(${s.angle}deg); }
      70%   { opacity: 0; transform: translate(${s.startX}vw, ${s.startY}vh) rotate(${s.angle}deg); }
      74%   { opacity: 1; transform: translate(${s.startX}vw, ${s.startY}vh) rotate(${s.angle}deg); }
      96%   { opacity: 1; transform: translate(${s.endX}vw, ${s.endY}vh) rotate(${s.angle}deg); }
      100%  { opacity: 0; transform: translate(${s.endX}vw, ${s.endY}vh) rotate(${s.angle}deg); }
    }
  `,
    )
    .join('\n');

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <style>{keyframesCss}</style>
      {stars.map((s) => (
        <div
          key={s.i}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            animation: `gao-shoot-${s.i} ${cycleMs}ms linear ${s.delayMs}ms infinite`,
            willChange: 'transform, opacity',
          }}
        >
          {/* Tail — a soft white streak trailing BEHIND the head.
              Longer + slightly thicker than the first iteration so
              it's clearly visible against the drone show. */}
          <div
            style={{
              position: 'absolute',
              left: -120,
              top: -1.5,
              width: 120,
              height: 3,
              background:
                'linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 30%, rgba(255,255,255,0.8) 75%, rgba(255,255,255,1) 100%)',
              borderRadius: '999px',
              filter: 'blur(0.4px)',
            }}
          />
          {/* Bright head — larger and more strongly haloed so users
              spot the streak even when their eyes are on the drone
              show at the middle of the frame. */}
          <div
            style={{
              position: 'absolute',
              left: -5,
              top: -5,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#fff',
              boxShadow:
                '0 0 14px rgba(255,255,255,1), 0 0 32px rgba(255,255,255,0.7), 0 0 56px rgba(180,220,255,0.45)',
            }}
          />
        </div>
      ))}
    </div>
  );
}
