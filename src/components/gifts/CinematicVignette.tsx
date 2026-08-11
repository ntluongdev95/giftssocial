'use client';

// Vignette + subtle film-grain overlay. Darkens the frame edges so the
// eye is drawn to the centered subject — the same trick every cinema
// DP uses to guide attention. Pure CSS; costs one paint layer.

type Props = {
  /** Strength at the corners, 0..1. Defaults to 0.65 which matches
   *  most romantic feature films. */
  intensity?: number;
};

export function CinematicVignette({ intensity = 0.65 }: Props) {
  const outer = Math.max(0, Math.min(1, intensity));
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `radial-gradient(ellipse at center,
                       transparent 45%,
                       rgba(0,0,0,${(outer * 0.55).toFixed(3)}) 82%,
                       rgba(0,0,0,${outer.toFixed(3)}) 100%)`,
      }}
    />
  );
}
