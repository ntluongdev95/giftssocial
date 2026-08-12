'use client';

import {
  useCallback,
  useEffect,
  useRef,
} from 'react';

type FormationType = 'drone' | 'car' | 'plane';

interface CinematicDroneFormationProps {
  type?: FormationType;
  text?: string;
  duration?: number;
  onComplete?: () => void;
}

interface Drone {
  x: number;
  y: number;

  sx: number;
  sy: number;

  tx: number;
  ty: number;

  vx: number;
  vy: number;

  size: number;
  alpha: number;

  phase: number;
  speed: number;

  delay: number;

  hue: number;

  formed: boolean;
}

interface Point {
  x: number;
  y: number;
}

const DPR_LIMIT = 2;

const clamp = (
  value: number,
  min: number,
  max: number
) => Math.max(min, Math.min(max, value));

const lerp = (
  a: number,
  b: number,
  t: number
) => a + (b - a) * t;

const easeOutCubic = (t: number) =>
  1 - Math.pow(1 - t, 3);

const easeInOutCubic = (t: number) =>
  t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;

const easeOutExpo = (t: number) =>
  t === 1
    ? 1
    : 1 - Math.pow(2, -10 * t);

function random(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/**
 * Create a pixel representation of text.
 *
 * Each sampled pixel becomes one drone.
 */
function createTextPoints(
  canvas: HTMLCanvasElement,
  text: string
): Point[] {
  const ctx = canvas.getContext('2d');

  if (!ctx) return [];

  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const fontSize = Math.min(
    width * 0.105,
    height * 0.28
  );

  ctx.font = `
    900 ${fontSize}px
    Arial Black,
    Inter,
    Helvetica,
    sans-serif
  `;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#ffffff';

  ctx.fillText(
    text,
    width / 2,
    height / 2
  );

  const image = ctx.getImageData(
    0,
    0,
    width,
    height
  );

  const points: Point[] = [];

  /**
   * Larger step = fewer drones.
   *
   * Desktop:
   * around 350–700 drones.
   */
  const step =
    width > 1200
      ? 7
      : width > 700
        ? 6
        : 5;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index =
        (y * width + x) * 4;

      const alpha =
        image.data[index + 3];

      if (alpha > 100) {
        points.push({
          x,
          y,
        });
      }
    }
  }

  /**
   * Prevent excessive drone count.
   */
  const maxPoints =
    width > 1000
      ? 850
      : 600;

  if (points.length <= maxPoints) {
    return points;
  }

  const result: Point[] = [];

  const stride =
    points.length / maxPoints;

  for (
    let i = 0;
    i < maxPoints;
    i++
  ) {
    result.push(
      points[
        Math.floor(i * stride)
      ]
    );
  }

  return result;
}

/**
 * Generate an approximate car silhouette.
 *
 * Used after the text formation.
 */
function createCarPoints(
  width: number,
  height: number
): Point[] {
  const points: Point[] = [];

  const cx = width / 2;
  const cy = height / 2;

  const scale = Math.min(
    width,
    height
  ) * 0.35;

  const addEllipse = (
    ex: number,
    ey: number,
    rx: number,
    ry: number
  ) => {
    for (
      let y = -ry;
      y <= ry;
      y += 7
    ) {
      for (
        let x = -rx;
        x <= rx;
        x += 7
      ) {
        const value =
          (x * x) / (rx * rx) +
          (y * y) / (ry * ry);

        if (value <= 1) {
          points.push({
            x: cx + ex + x,
            y: cy + ey + y,
          });
        }
      }
    }
  };

  /**
   * Main body.
   */
  for (
    let y = -scale * 0.12;
    y <= scale * 0.12;
    y += 7
  ) {
    for (
      let x = -scale * 0.9;
      x <= scale * 0.9;
      x += 7
    ) {
      const normalized =
        Math.abs(x) /
        (scale * 0.9);

      const roof =
        Math.abs(y) /
        (scale * 0.12);

      if (
        roof < 1 &&
        normalized < 1
      ) {
        points.push({
          x: cx + x,
          y: cy + y,
        });
      }
    }
  }

  /**
   * Roof / cabin.
   */
  for (
    let y = -scale * 0.42;
    y <= -scale * 0.1;
    y += 7
  ) {
    const progress =
      (y + scale * 0.42) /
      (scale * 0.32);

    const halfWidth =
      scale *
      (0.28 + progress * 0.25);

    for (
      let x = -halfWidth;
      x <= halfWidth;
      x += 7
    ) {
      points.push({
        x: cx + x,
        y: cy + y,
      });
    }
  }

  /**
   * Front windshield.
   */
  for (
    let y = -scale * 0.38;
    y <= -scale * 0.12;
    y += 7
  ) {
    const ratio =
      (y + scale * 0.38) /
      (scale * 0.26);

    const halfWidth =
      scale *
      (0.28 + ratio * 0.12);

    for (
      let x = -halfWidth;
      x <= halfWidth;
      x += 7
    ) {
      if (Math.abs(x) > scale * 0.04) {
        points.push({
          x: cx + x,
          y: cy + y,
        });
      }
    }
  }

  /**
   * Wheels.
   */
  addEllipse(
    -scale * 0.55,
    scale * 0.12,
    scale * 0.16,
    scale * 0.16
  );

  addEllipse(
    scale * 0.55,
    scale * 0.12,
    scale * 0.16,
    scale * 0.16
  );

  return points;
}

/**
 * Approximate airplane silhouette.
 */
function createPlanePoints(
  width: number,
  height: number
): Point[] {
  const points: Point[] = [];

  const cx = width / 2;
  const cy = height / 2;

  const scale =
    Math.min(width, height) *
    0.36;

  /**
   * Body.
   */
  for (
    let x = -scale;
    x <= scale;
    x += 7
  ) {
    const normalized =
      Math.abs(x) / scale;

    const halfHeight =
      scale *
      0.06 *
      (1 - normalized * 0.35);

    for (
      let y = -halfHeight;
      y <= halfHeight;
      y += 7
    ) {
      points.push({
        x: cx + x,
        y: cy + y,
      });
    }
  }

  /**
   * Wings.
   */
  for (
    let x = -scale * 0.45;
    x <= scale * 0.45;
    x += 7
  ) {
    const normalized =
      Math.abs(x) /
      (scale * 0.45);

    const wing =
      scale *
      0.45 *
      (1 - normalized);

    for (
      let y = -wing;
      y <= wing;
      y += 7
    ) {
      points.push({
        x: cx + x,
        y: cy + y,
      });
    }
  }

  /**
   * Tail.
   */
  for (
    let x = -scale * 0.82;
    x <= -scale * 0.55;
    x += 7
  ) {
    const wing =
      scale *
      0.2 *
      (1 -
        Math.abs(
          x +
            scale *
              0.68
        ) /
          (scale * 0.14));

    for (
      let y = -wing;
      y <= wing;
      y += 7
    ) {
      points.push({
        x: cx + x,
        y: cy + y,
      });
    }
  }

  return points;
}

function createInitialDrones(
  width: number,
  height: number,
  targets: Point[]
): Drone[] {
  return targets.map(
    (target, index) => {
      const angle =
        Math.random() *
        Math.PI *
        2;

      const distance =
        random(
          width * 0.25,
          width * 0.8
        );

      return {
        x:
          width / 2 +
          Math.cos(angle) *
            distance,

        y:
          height / 2 +
          Math.sin(angle) *
            distance,

        sx:
          width / 2 +
          Math.cos(angle) *
            distance,

        sy:
          height / 2 +
          Math.sin(angle) *
            distance,

        tx: target.x,
        ty: target.y,

        vx: 0,
        vy: 0,

        size: random(
          1.1,
          2.3
        ),

        alpha: random(
          0.55,
          1
        ),

        phase:
          Math.random() *
          Math.PI *
          2,

        speed: random(
          0.7,
          1.3
        ),

        delay:
          index /
          targets.length *
          0.65,

        hue:
          random(
            325,
            355
          ),

        formed: false,
      };
    }
  );
}

export default function CinematicDroneFormation({
  type = 'drone',
  text = 'ARE YOU READY',
  duration = 10500,
  onComplete,
}: CinematicDroneFormationProps) {
  const canvasRef =
    useRef<HTMLCanvasElement | null>(
      null
    );

  const animationRef =
    useRef<number | null>(
      null
    );

  const startTimeRef =
    useRef<number | null>(
      null
    );

  const completedRef =
    useRef(false);

  const dronesRef =
    useRef<Drone[]>([]);

  const dimensionsRef =
    useRef({
      width: 0,
      height: 0,
      dpr: 1,
    });

  const formationCanvasRef =
    useRef<HTMLCanvasElement | null>(
      null
    );

  const createFormation =
    useCallback(
      (
        width: number,
        height: number
      ) => {
        /**
         * For text formation we use
         * a temporary canvas.
         */
        if (
          type === 'drone'
        ) {
          const temp =
            document.createElement(
              'canvas'
            );

          temp.width =
            Math.floor(width);

          temp.height =
            Math.floor(height);

          formationCanvasRef.current =
            temp;

          return createTextPoints(
            temp,
            text
          );
        }

        if (
          type === 'car'
        ) {
          return createCarPoints(
            width,
            height
          );
        }

        return createPlanePoints(
          width,
          height
        );
      },
      [text, type]
    );

  const resize =
    useCallback(() => {
      const canvas =
        canvasRef.current;

      if (!canvas) return;

      const rect =
        canvas.getBoundingClientRect();

      const dpr = Math.min(
        window.devicePixelRatio ||
          1,
        DPR_LIMIT
      );

      const width =
        Math.max(
          1,
          Math.floor(
            rect.width
          )
        );

      const height =
        Math.max(
          1,
          Math.floor(
            rect.height
          )
        );

      canvas.width =
        Math.floor(
          width * dpr
        );

      canvas.height =
        Math.floor(
          height * dpr
        );

      dimensionsRef.current = {
        width,
        height,
        dpr,
      };

      const targets =
        createFormation(
          width,
          height
        );

      dronesRef.current =
        createInitialDrones(
          width,
          height,
          targets
        );
    }, [createFormation]);

  useEffect(() => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext(
        '2d'
      );

    if (!ctx) return;

    resize();

    const resizeObserver =
      new ResizeObserver(
        resize
      );

    resizeObserver.observe(
      canvas
    );

    const {
      width,
      height,
      dpr,
    } =
      dimensionsRef.current;

    /**
     * Scale canvas coordinate
     * system to CSS pixels.
     */
    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );

    const animate = (
      now: number
    ) => {
      if (
        startTimeRef.current ===
        null
      ) {
        startTimeRef.current =
          now;
      }

      const elapsed =
        now -
        startTimeRef.current;

      const progress =
        clamp(
          elapsed /
            duration,
          0,
          1
        );

      const drones =
        dronesRef.current;

      /**
       * Clear.
       */
      ctx.clearRect(
        0,
        0,
        width,
        height
      );

      /**
       * Dark cinematic atmosphere.
       */
      const background =
        ctx.createRadialGradient(
          width / 2,
          height / 2,
          0,
          width / 2,
          height / 2,
          Math.max(
            width,
            height
          ) * 0.7
        );

      background.addColorStop(
        0,
        'rgba(28,12,26,0.18)'
      );

      background.addColorStop(
        0.5,
        'rgba(7,8,12,0.08)'
      );

      background.addColorStop(
        1,
        'rgba(0,0,0,0)'
      );

      ctx.fillStyle =
        background;

      ctx.fillRect(
        0,
        0,
        width,
        height
      );

      /**
       * Timeline
       *
       * 0.00 - 0.15
       * drones appear
       *
       * 0.15 - 0.58
       * formation
       *
       * 0.58 - 0.78
       * hold
       *
       * 0.78 - 1.00
       * dissolve
       */
      const formationStart =
        0.10;

      const formationEnd =
        0.58;

      const dissolveStart =
        0.78;

      const dissolveEnd =
        0.98;

      for (
        let i = 0;
        i < drones.length;
        i++
      ) {
        const drone =
          drones[i];

        /**
         * INTRO / SWARM ENTRY
         */
        if (
          progress <
          formationStart
        ) {
          const p =
            clamp(
              progress /
                formationStart,
              0,
              1
            );

          const delayed =
            clamp(
              p -
                drone.delay *
                  0.55,
              0,
              1
            );

          const ease =
            easeOutExpo(
              delayed
            );

          drone.x =
            lerp(
              drone.sx,
              width / 2 +
                Math.cos(
                  drone.phase
                ) *
                  width *
                  0.08,
              ease
            );

          drone.y =
            lerp(
              drone.sy,
              height / 2 +
                Math.sin(
                  drone.phase
                ) *
                  height *
                  0.08,
              ease
            );
        }

        /**
         * FORMATION.
         */
        else if (
          progress <
          formationEnd
        ) {
          const p =
            clamp(
              (progress -
                formationStart) /
                (formationEnd -
                  formationStart),
              0,
              1
            );

          const delayed =
            clamp(
              p -
                drone.delay *
                  0.35,
              0,
              1
            );

          const ease =
            easeInOutCubic(
              delayed
            );

          /**
           * Add tiny orbital movement
           * so drones never look frozen.
           */
          const drift =
            Math.sin(
              now *
                0.001 *
                drone.speed +
                drone.phase
            ) * 0.8;

          drone.x =
            lerp(
              drone.x,
              drone.tx,
              ease
            );

          drone.y =
            lerp(
              drone.y,
              drone.ty,
              ease
            );

          drone.x +=
            drift;

          drone.y +=
            Math.cos(
              now *
                0.0008 +
                drone.phase
            ) * 0.5;

          drone.formed =
            p > 0.95;
        }

        /**
         * HOLD.
         */
        else if (
          progress <
          dissolveStart
        ) {
          const pulse =
            Math.sin(
              now * 0.003 +
                drone.phase
            );

          drone.x =
            drone.tx +
            pulse *
              0.45;

          drone.y =
            drone.ty +
            Math.cos(
              now * 0.002 +
                drone.phase
            ) *
              0.35;
        }

        /**
         * DISSOLVE.
         */
        else {
          const p =
            clamp(
              (progress -
                dissolveStart) /
                (dissolveEnd -
                  dissolveStart),
              0,
              1
            );

          const ease =
            easeOutCubic(
              p
            );

          /**
           * Fly outward from
           * the letter.
           */
          const dx =
            drone.tx -
            width / 2;

          const dy =
            drone.ty -
            height / 2;

          const distance =
            Math.sqrt(
              dx * dx +
                dy * dy
            ) || 1;

          const nx =
            dx / distance;

          const ny =
            dy / distance;

          const explosion =
            width *
            0.65 *
            ease;

          drone.x =
            drone.tx +
            nx *
              explosion;

          drone.y =
            drone.ty +
            ny *
              explosion;

          /**
           * Add vertical cinematic
           * randomness.
           */
          drone.y +=
            Math.sin(
              drone.phase +
                p * 12
            ) *
              35 *
              ease;
        }

        /**
         * Opacity.
         */
        let alpha =
          drone.alpha;

        if (
          progress <
          formationStart
        ) {
          alpha *= clamp(
            progress /
              formationStart /
              0.65,
            0,
            1
          );
        }

        if (
          progress >
          dissolveStart
        ) {
          alpha *=
            1 -
            clamp(
              (progress -
                dissolveStart) /
                (dissolveEnd -
                  dissolveStart),
              0,
              1
            );
        }

        /**
         * Soft pulse.
         */
        const pulse =
          0.88 +
          Math.sin(
            now * 0.004 +
              drone.phase
          ) *
            0.12;

        alpha *= pulse;

        /**
         * Draw glow.
         */
        const radius =
          drone.size *
          5.5;

        const glow =
          ctx.createRadialGradient(
            drone.x,
            drone.y,
            0,
            drone.x,
            drone.y,
            radius
          );

        glow.addColorStop(
          0,
          `hsla(${drone.hue}, 100%, 96%, ${alpha})`
        );

        glow.addColorStop(
          0.12,
          `hsla(${drone.hue}, 100%, 85%, ${alpha * 0.8})`
        );

        glow.addColorStop(
          0.35,
          `hsla(${drone.hue}, 100%, 70%, ${alpha * 0.3})`
        );

        glow.addColorStop(
          1,
          `hsla(${drone.hue}, 100%, 60%, 0)`
        );

        ctx.fillStyle =
          glow;

        ctx.beginPath();

        ctx.arc(
          drone.x,
          drone.y,
          radius,
          0,
          Math.PI * 2
        );

        ctx.fill();

        /**
         * Actual drone light.
         */
        ctx.fillStyle =
          `rgba(255,245,250,${alpha})`;

        ctx.beginPath();

        ctx.arc(
          drone.x,
          drone.y,
          drone.size,
          0,
          Math.PI * 2
        );

        ctx.fill();
      }

      /**
       * Cinematic center glow.
       */
      if (
        progress >
          0.35 &&
        progress <
          dissolveEnd
      ) {
        const glowProgress =
          progress <
          dissolveStart
            ? 1
            : 1 -
              clamp(
                (progress -
                  dissolveStart) /
                  0.2,
                0,
                1
              );

        const centerGlow =
          ctx.createRadialGradient(
            width / 2,
            height / 2,
            0,
            width / 2,
            height / 2,
            width * 0.35
          );

        centerGlow.addColorStop(
          0,
          `rgba(236,72,153,${
            0.055 *
            glowProgress
          })`
        );

        centerGlow.addColorStop(
          1,
          'rgba(236,72,153,0)'
        );

        ctx.fillStyle =
          centerGlow;

        ctx.fillRect(
          0,
          0,
          width,
          height
        );
      }

      /**
       * Complete.
       */
      if (
        progress >= 1 &&
        !completedRef.current
      ) {
        completedRef.current =
          true;

        onComplete?.();

        return;
      }

      animationRef.current =
        requestAnimationFrame(
          animate
        );
    };

    animationRef.current =
      requestAnimationFrame(
        animate
      );

    return () => {
      resizeObserver.disconnect();

      if (
        animationRef.current
      ) {
        cancelAnimationFrame(
          animationRef.current
        );
      }

      startTimeRef.current =
        null;
    };
  }, [
    duration,
    onComplete,
    resize,
  ]);

  return (
    <div
      className="
        absolute
        inset-0
        z-[20]
        pointer-events-none
        overflow-hidden
      "
      style={{
        background:
          'radial-gradient(circle at center, rgba(20,8,18,.35), rgba(0,0,0,.92) 72%)',
      }}
    >
      {/* Cinematic vignette */}
      <div
        className="
          absolute
          inset-0
          pointer-events-none
        "
        style={{
          background:
            'radial-gradient(circle, transparent 35%, rgba(0,0,0,.7) 100%)',
        }}
      />

      {/* Main swarm */}
      <canvas
        ref={canvasRef}
        className="
          absolute
          inset-0
          w-full
          h-full
        "
      />

      {/* Letter caption */}
      <div
        className="
          absolute
          left-0
          right-0
          bottom-[12%]
          flex
          justify-center
          pointer-events-none
        "
      >
        <div
          className="
            px-5
            py-2
            rounded-full
            text-[9px]
            tracking-[0.45em]
            uppercase
            text-white/30
          "
          style={{
            background:
              'rgba(255,255,255,.025)',
            border:
              '1px solid rgba(255,255,255,.05)',
            backdropFilter:
              'blur(8px)',
          }}
        >
          Gao Social
        </div>
      </div>
    </div>
  );
}