'use client';

import { useMemo } from 'react';

// Dense CSS-based twinkling starfield rendered as a bottom-most
// backdrop layer. Separate from the WebGL scene's own starfield —
// the WebGL stars are fogged and hard to see against the drone
// show, while these DOM-based stars live in front of the black
// backdrop and always read clearly.
//
// ~180 stars scattered across the viewport with per-star twinkle
// (opacity oscillation on its own phase + duration). Everything is
// pure CSS animation so nothing runs on the JS main loop.

type Props = {
  /** How many stars to render. 180 gives a "milky-way lite" density
   *  that reads as a full night sky without hurting perf. */
  count?: number;
};

// Deterministic PRNG so the star pattern stays stable across renders.
function makeRNG(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function NightSkyBackdrop({ count = 180 }: Props) {
  const stars = useMemo(() => {
    const rnd = makeRNG(count * 61 + 91);
    return Array.from({ length: count }, (_, i) => {
      // 15% of stars are "hero" — bigger + brighter with a soft glow
      // halo. The rest are tiny points. Feels like real sky where a
      // few bright stars stand out against a haze of faint ones.
      const isHero = rnd() < 0.15;
      const size = isHero ? 1.6 + rnd() * 1.6 : 0.6 + rnd() * 0.9;
      const baseOpacity = isHero ? 0.75 + rnd() * 0.25 : 0.35 + rnd() * 0.4;
      return {
        i,
        x: rnd() * 100,                // vw
        y: rnd() * 100,                // vh
        size,
        baseOpacity,
        isHero,
        // Twinkle duration + phase — non-repeating pattern so no two
        // adjacent stars twinkle in sync.
        duration: 2.4 + rnd() * 4.5,   // 2.4-6.9s
        delay: -rnd() * 6,             // negative → in-flight on mount
        // Slight blueish or warm tint for a few stars to break up
        // the pure-white pattern.
        tint: rnd() < 0.2 ? '#ffe0aa' : rnd() < 0.5 ? '#b8dfff' : '#ffffff',
      };
    });
  }, [count]);

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
      <style>{`
        @keyframes gao-twinkle {
          0%, 100% { opacity: var(--base, 0.5); transform: scale(1); }
          50%      { opacity: calc(var(--base, 0.5) * 0.3); transform: scale(0.85); }
        }
      `}</style>
      {stars.map((s) => (
        <div
          key={s.i}
          style={{
            position: 'absolute',
            left: `${s.x}vw`,
            top: `${s.y}vh`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            marginLeft: `-${s.size / 2}px`,
            marginTop: `-${s.size / 2}px`,
            borderRadius: '50%',
            background: s.tint,
            boxShadow: s.isHero
              ? `0 0 ${s.size * 3}px ${s.tint}88, 0 0 ${s.size * 6}px ${s.tint}44`
              : undefined,
            animation: `gao-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
            ['--base' as string]: String(s.baseOpacity),
            willChange: 'opacity, transform',
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
