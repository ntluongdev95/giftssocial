'use client';

// Silhouette of a couple standing on the ground looking up at the sky.
// Composed with the drone-show canvas above, it creates the classic
// "two lovers watching fireworks" shot — the emotional anchor of the
// whole scene.
//
// Deliberately stylised, not photorealistic:
//   - Solid near-black paths on a subtle horizon-gradient ground.
//   - Pink rim-light along the top of each head/shoulder, driven by
//     the drones "shining" from above.
//   - Tiny CSS breath animation so the figures aren't stone-still.
//
// Positioned at the bottom of the parent (which should have
// `position: relative` — HeartView provides that). No JavaScript work
// at runtime; everything is SVG + a couple of keyframes.

type Props = {
  /** 'couple' shows two figures (girl + guy). 'solo' shows one figure.
   *  Defaults to couple because that fits the romantic gift theme
   *  best; solo is available for gifts sent to yourself. */
  variant?: 'couple' | 'solo';
  /** 0..1 — how much of the screen the silhouette should occupy at the
   *  bottom. 0.22 (default) is the "wide shot" look that lets the
   *  drone show breathe above the ground. */
  height?: number;
};

export function SkyWatcherSilhouette({
  variant = 'couple',
  height = 0.24,
}: Props) {
  const heightPct = `${Math.max(10, Math.min(60, height * 100))}%`;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: heightPct,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes gao-skywatch-breath {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-1.5px); }
        }
        @keyframes gao-skywatch-breath-2 {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-1.2px); }
        }
      `}</style>

      {/* Horizon glow — pink haze bleeding up from the ground where the
          drones "reflect". Sells the light source is above and behind
          the figures. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '55%',
          background:
            'radial-gradient(ellipse at 50% 100%, rgba(255,77,139,0.22) 0%, rgba(255,77,139,0.08) 30%, transparent 70%)',
        }}
      />
      {/* Ground — subtle darker floor so the silhouettes have a plane
          to stand on, not float. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '38%',
          background:
            'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.85) 100%)',
        }}
      />

      {/* Silhouettes — SVG scales to the container. preserveAspectRatio
          "xMidYMax meet" keeps the ground line locked to the bottom
          when the container's aspect ratio changes. */}
      <svg
        viewBox="0 0 400 220"
        preserveAspectRatio="xMidYMax meet"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
        }}
      >
        <defs>
          {/* Rim light along the tops of heads/shoulders — the drone
              show is up-and-behind, so the highlight is on the top
              curve of each figure. */}
          <linearGradient id="gao-rim-pink" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,180,210,0.85)" />
            <stop offset="35%" stopColor="rgba(255,120,170,0.45)" />
            <stop offset="100%" stopColor="rgba(255,180,210,0)" />
          </linearGradient>
          {/* Solid black body colour with a hint of very dark plum so
              the figures don't disappear against the star-black sky. */}
          <linearGradient id="gao-body" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"  stopColor="#0f0a12" />
            <stop offset="100%" stopColor="#000000" />
          </linearGradient>

          {/* Filter to soften the head glow so it reads as diffused
              backlight, not a hard highlight. */}
          <filter id="gao-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>

        {variant === 'couple' ? (
          <>
            {/* Girl (left). Slight forward lean + long-hair silhouette. */}
            <g
              style={{
                transformOrigin: '170px 220px',
                animation: 'gao-skywatch-breath 5.5s ease-in-out infinite',
              }}
            >
              {/* Rim glow behind the head (drone light spill). */}
              <ellipse
                cx="170"
                cy="55"
                rx="18"
                ry="12"
                fill="url(#gao-rim-pink)"
                opacity="0.7"
                filter="url(#gao-glow)"
              />
              {/* Body path — head tilted back slightly (chin extends
                  forward), hair falls behind, dress flares to the
                  ground. */}
              <path
                d="
                  M170 42
                  c 5 0 9 4 9 9
                  c 0 3 -1 6 -3 8
                  l 7 3
                  c 3 1 5 3 5 6
                  l 0 12
                  c 0 2 -1 4 -3 5
                  l 8 4
                  l 4 128
                  l -38 0
                  l 4 -128
                  l 8 -4
                  c -2 -1 -3 -3 -3 -5
                  l 0 -12
                  c 0 -3 2 -5 5 -6
                  l 7 -3
                  c -2 -2 -3 -5 -3 -8
                  c 0 -5 4 -9 9 -9
                  z
                "
                fill="url(#gao-body)"
              />
              {/* Hair strands falling behind, gives feminine silhouette. */}
              <path
                d="M158 55 q -2 22 0 44 l 6 0 q -2 -22 -2 -44 z"
                fill="url(#gao-body)"
              />
              <path
                d="M182 55 q 2 22 0 44 l -6 0 q 2 -22 2 -44 z"
                fill="url(#gao-body)"
              />
              {/* Rim highlight along top of head. */}
              <path
                d="M162 42 q 8 -6 16 0"
                stroke="rgba(255,180,210,0.6)"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
              />
            </g>

            {/* Guy (right). Straighter body, shorter hair silhouette. */}
            <g
              style={{
                transformOrigin: '230px 220px',
                animation: 'gao-skywatch-breath-2 6.2s ease-in-out infinite',
              }}
            >
              <ellipse
                cx="230"
                cy="48"
                rx="17"
                ry="11"
                fill="url(#gao-rim-pink)"
                opacity="0.6"
                filter="url(#gao-glow)"
              />
              <path
                d="
                  M230 36
                  c 5 0 9 4 9 9
                  c 0 3 -1 6 -3 8
                  l 6 3
                  c 3 1 5 3 5 6
                  l 0 14
                  c 0 3 -2 6 -5 7
                  l 3 3
                  l 3 60
                  l -1 78
                  l -14 0
                  l -3 -74
                  l -3 74
                  l -14 0
                  l -1 -78
                  l 3 -60
                  l 3 -3
                  c -3 -1 -5 -4 -5 -7
                  l 0 -14
                  c 0 -3 2 -5 5 -6
                  l 6 -3
                  c -2 -2 -3 -5 -3 -8
                  c 0 -5 4 -9 9 -9
                  z
                "
                fill="url(#gao-body)"
              />
              <path
                d="M222 36 q 8 -5 16 0"
                stroke="rgba(255,180,210,0.55)"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
              />
            </g>

            {/* Held hands — a small connector shape between the two
                figures. Makes the couple read as "together" not just
                "adjacent". */}
            <path
              d="M188 132 q 6 -3 24 0"
              stroke="rgba(255,180,210,0.35)"
              strokeWidth="1"
              fill="none"
              strokeLinecap="round"
            />
          </>
        ) : (
          <g
            style={{
              transformOrigin: '200px 220px',
              animation: 'gao-skywatch-breath 5.5s ease-in-out infinite',
            }}
          >
            <ellipse
              cx="200"
              cy="48"
              rx="18"
              ry="12"
              fill="url(#gao-rim-pink)"
              opacity="0.7"
              filter="url(#gao-glow)"
            />
            <path
              d="
                M200 36
                c 5 0 9 4 9 9
                c 0 3 -1 6 -3 8
                l 6 3
                c 3 1 5 3 5 6
                l 0 14
                c 0 3 -2 6 -5 7
                l 3 3
                l 3 60
                l -1 78
                l -14 0
                l -3 -74
                l -3 74
                l -14 0
                l -1 -78
                l 3 -60
                l 3 -3
                c -3 -1 -5 -4 -5 -7
                l 0 -14
                c 0 -3 2 -5 5 -6
                l 6 -3
                c -2 -2 -3 -5 -3 -8
                c 0 -5 4 -9 9 -9
                z
              "
              fill="url(#gao-body)"
            />
            <path
              d="M192 36 q 8 -5 16 0"
              stroke="rgba(255,180,210,0.6)"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
