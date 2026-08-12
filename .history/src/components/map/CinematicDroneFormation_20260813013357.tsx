'use client';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

interface Props {
  text?: string;
  active?: boolean;
  duration?: number;
  onComplete?: () => void;
}

interface Drone {
  x: number;
  y: number;

  tx: number;
  ty: number;

  vx: number;
  vy: number;

  delay: number;
  phase: number;

  size: number;
}

interface Point {
  x: number;
  y: number;
}

const DPR_MAX = 2;

export default function CinematicDroneFormation({
  text = 'ARE YOU READY',
  active = true,
  duration = 11000,
  onComplete,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const dronesRef = useRef<Drone[]>([]);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const [started, setStarted] = useState(false);

  /**
   * ------------------------------------------------------------
   * TEXT → PIXEL POINTS
   * ------------------------------------------------------------
   */

  const createTextPoints = (
    textValue: string,
    width: number,
    height: number,
  ): Point[] => {
    const canvas = document.createElement('canvas');

    const scale = 2;

    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');

    if (!ctx) return [];

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height,
    );

    ctx.fillStyle = '#fff';

    /**
     * Responsive font size.
     */
    let fontSize = Math.min(
      width * 0.12,
      110,
    );

    if (textValue.length > 12) {
      fontSize *= 0.8;
    }

    ctx.font = `
      900 ${fontSize * scale}px
      Arial, Helvetica, sans-serif
    `;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText(
      textValue,
      canvas.width / 2,
      canvas.height / 2,
    );

    const image = ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const points: Point[] = [];

    /**
     * Distance between drones.
     *
     * Smaller = letters more detailed.
     */
    const gap = Math.max(
      5,
      Math.floor(width / 180),
    );

    for (
      let y = 0;
      y < canvas.height;
      y += gap * scale
    ) {
      for (
        let x = 0;
        x < canvas.width;
        x += gap * scale
      ) {
        const index =
          (y * canvas.width + x) * 4;

        const alpha = image.data[index + 3];

        if (alpha > 120) {
          points.push({
            x: x / scale,
            y: y / scale,
          });
        }
      }
    }

    return points;
  };

  /**
   * ------------------------------------------------------------
   * RANDOM SKY POSITIONS
   * ------------------------------------------------------------
   */

  const createSkyPosition = (
    width: number,
    height: number,
  ): Point => {
    return {
      x:
        width * 0.05 +
        Math.random() * width * 0.9,

      y:
        height * 0.05 +
        Math.random() * height * 0.8,
    };
  };

  /**
   * ------------------------------------------------------------
   * CREATE DRONES
   * ------------------------------------------------------------
   */

  const createDrones = (
    width: number,
    height: number,
    targetPoints: Point[],
  ) => {
    const maxDrones = Math.min(
      targetPoints.length,
      width < 600 ? 420 : 850,
    );

    const drones: Drone[] = [];

    for (let i = 0; i < maxDrones; i++) {
      const start =
        createSkyPosition(width, height);

      const target =
        targetPoints[i];

      drones.push({
        x: start.x,
        y: start.y,

        tx: target.x,
        ty: target.y,

        vx: 0,
        vy: 0,

        delay:
          Math.random() * 1200,

        phase:
          Math.random() *
          Math.PI *
          2,

        size:
          2.2 +
          Math.random() * 0.8,
      });
    }

    dronesRef.current = drones;
  };

  /**
   * ------------------------------------------------------------
   * DRAW DRONE
   * ------------------------------------------------------------
   *
   * A drone is NOT just a circle.
   *
   * We draw:
   *
   *       \   /
   *        \ /
   *      ---●---
   *        / \
   *
   * with LED glow.
   */

  const drawDrone = (
    ctx: CanvasRenderingContext2D,
    drone: Drone,
    time: number,
  ) => {
    const {
      x,
      y,
      size,
      phase,
    } = drone;

    const pulse =
      0.8 +
      Math.sin(
        time * 0.004 + phase,
      ) *
        0.2;

    /**
     * Drone glow.
     */
    ctx.save();

    ctx.shadowBlur = 14;

    ctx.shadowColor =
      'rgba(255, 80, 180, 0.9)';

    /**
     * Drone body.
     */
    ctx.fillStyle =
      `rgba(255,255,255,${pulse})`;

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      size * 0.9,
      0,
      Math.PI * 2,
    );

    ctx.fill();

    /**
     * Arms.
     */
    ctx.strokeStyle =
      'rgba(255,255,255,0.9)';

    ctx.lineWidth = 1;

    ctx.beginPath();

    ctx.moveTo(
      x - size * 3,
      y - size * 1.5,
    );

    ctx.lineTo(
      x + size * 3,
      y + size * 1.5,
    );

    ctx.moveTo(
      x + size * 3,
      y - size * 1.5,
    );

    ctx.lineTo(
      x - size * 3,
      y + size * 1.5,
    );

    ctx.stroke();

    /**
     * LED.
     */
    ctx.fillStyle =
      'rgba(255,120,200,1)';

    ctx.shadowBlur = 18;

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      size * 0.45,
      0,
      Math.PI * 2,
    );

    ctx.fill();

    ctx.restore();
  };

  /**
   * ------------------------------------------------------------
   * DRAW SKY
   * ------------------------------------------------------------
   */

  const drawSky = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) => {
    /**
     * Deep cinematic background.
     */
    const gradient =
      ctx.createRadialGradient(
        width / 2,
        height * 0.35,
        0,
        width / 2,
        height * 0.5,
        Math.max(width, height),
      );

    gradient.addColorStop(
      0,
      '#171a2d',
    );

    gradient.addColorStop(
      0.45,
      '#090b16',
    );

    gradient.addColorStop(
      1,
      '#020307',
    );

    ctx.fillStyle = gradient;

    ctx.fillRect(
      0,
      0,
      width,
      height,
    );

    /**
     * Tiny stars.
     */
    const starCount = 100;

    ctx.fillStyle =
      'rgba(255,255,255,0.15)';

    for (
      let i = 0;
      i < starCount;
      i++
    ) {
      const x =
        (i * 137.31) % width;

      const y =
        (i * 71.17) % height;

      const size =
        0.4 +
        ((i * 17) % 10) / 10;

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        size,
        0,
        Math.PI * 2,
      );

      ctx.fill();
    }
  };

  /**
   * ------------------------------------------------------------
   * MAIN ANIMATION
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (!active) return;

    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext('2d');

    if (!ctx) return;

    const resize = () => {
      const width =
        window.innerWidth;

      const height =
        window.innerHeight;

      const dpr = Math.min(
        window.devicePixelRatio || 1,
        DPR_MAX,
      );

      canvas.width =
        width * dpr;

      canvas.height =
        height * dpr;

      canvas.style.width =
        `${width}px`;

      canvas.style.height =
        `${height}px`;

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0,
      );

      const points =
        createTextPoints(
          text,
          width,
          height,
        );

      createDrones(
        width,
        height,
        points,
      );
    };

    resize();

    window.addEventListener(
      'resize',
      resize,
    );

    startTimeRef.current =
      performance.now();

    setStarted(true);

    const animate = (
      now: number,
    ) => {
      const width =
        window.innerWidth;

      const height =
        window.innerHeight;

      const start =
        startTimeRef.current ||
        now;

      const elapsed =
        now - start;

      /**
       * ------------------------------------------------------
       * TIMELINE
       * ------------------------------------------------------
       *
       * 0 - 2.0s
       * drones enter
       *
       * 2 - 6.5s
       * form letters
       *
       * 6.5 - 8.5s
       * hold
       *
       * 8.5 - 11s
       * dissolve
       */

      const formationStart =
        1800;

      const formationDuration =
        4200;

      const formationEnd =
        formationStart +
        formationDuration;

      const dissolveStart =
        7200;

      const drones =
        dronesRef.current;

      /**
       * Clear.
       */
      drawSky(
        ctx,
        width,
        height,
      );

      /**
       * Center formation.
       */
      const centerX =
        width / 2;

      const centerY =
        height / 2;

      /**
       * Small camera-like movement.
       */
      const cinematicX =
        Math.sin(
          elapsed * 0.00025,
        ) * 8;

      const cinematicY =
        Math.cos(
          elapsed * 0.00022,
        ) * 5;

      drones.forEach(
        (drone, index) => {
          let targetX =
            drone.tx;

          let targetY =
            drone.ty;

          /**
           * --------------------------------------------------
           * PHASE 1
           * DRONES ARRIVE FROM SKY
           * --------------------------------------------------
           */

          if (
            elapsed <
            formationStart
          ) {
            const progress =
              Math.max(
                0,
                Math.min(
                  1,
                  (elapsed -
                    drone.delay *
                      0.5) /
                    1800,
                ),
              );

            const eased =
              1 -
              Math.pow(
                1 - progress,
                3,
              );

            targetX =
              drone.x +
              (centerX +
                cinematicX -
                drone.x) *
                eased;

            targetY =
              drone.y +
              (centerY +
                cinematicY -
                drone.y) *
                eased;
          }

          /**
           * --------------------------------------------------
           * PHASE 2
           * FORM TEXT
           * --------------------------------------------------
           */

          else if (
            elapsed <
            formationEnd
          ) {
            const progress =
              Math.max(
                0,
                Math.min(
                  1,
                  (elapsed -
                    formationStart) /
                    formationDuration,
                ),
              );

            const eased =
              progress < 0.5
                ? 2 * progress * progress
                : 1 -
                  Math.pow(
                    -2 *
                      progress +
                      2,
                    2,
                  ) /
                    2;

            targetX =
              drone.tx +
              cinematicX;

            targetY =
              drone.ty +
              cinematicY;

            /**
             * Small stagger.
             *
             * Creates the effect of
             * drones locking into position
             * one after another.
             */
            const stagger =
              Math.max(
                0,
                Math.min(
                  1,
                  (elapsed -
                    formationStart -
                    index * 1.5) /
                    1000,
                ),
              );

            const finalProgress =
              eased *
              stagger;

            drone.x +=
              (targetX -
                drone.x) *
              finalProgress *
              0.08;

            drone.y +=
              (targetY -
                drone.y) *
              finalProgress *
              0.08;
          }

          /**
           * --------------------------------------------------
           * PHASE 3
           * HOLD
           * --------------------------------------------------
           */

          else if (
            elapsed <
            dissolveStart
          ) {
            targetX =
              drone.tx +
              cinematicX +
              Math.sin(
                elapsed * 0.0015 +
                  drone.phase,
              ) *
                0.6;

            targetY =
              drone.ty +
              cinematicY +
              Math.cos(
                elapsed * 0.0012 +
                  drone.phase,
              ) *
                0.6;

            drone.x +=
              (targetX -
                drone.x) *
              0.08;

            drone.y +=
              (targetY -
                drone.y) *
              0.08;
          }

          /**
           * --------------------------------------------------
           * PHASE 4
           * DISSOLVE
           * --------------------------------------------------
           */

          else {
            const progress =
              Math.min(
                1,
                (elapsed -
                  dissolveStart) /
                  2800,
              );

            /**
             * Spiral outward.
             */
            const angle =
              drone.phase +
              progress *
                Math.PI *
                4;

            const radius =
              20 +
              progress *
                Math.max(
                  width,
                  height,
                ) *
                0.45;

            targetX =
              centerX +
              Math.cos(angle) *
                radius;

            targetY =
              centerY +
              Math.sin(angle) *
                radius *
                0.6;

            drone.x +=
              (targetX -
                drone.x) *
              0.035;

            drone.y +=
              (targetY -
                drone.y) *
              0.035;
          }

          /**
           * Draw.
           */
          drawDrone(
            ctx,
            drone,
            now,
          );
        },
      );

      /**
       * Complete.
       */
      if (
        elapsed >= duration
      ) {
        if (animationRef.current) {
          cancelAnimationFrame(
            animationRef.current,
          );
        }

        onComplete?.();

        return;
      }

      animationRef.current =
        requestAnimationFrame(
          animate,
        );
    };

    animationRef.current =
      requestAnimationFrame(
        animate,
      );

    return () => {
      window.removeEventListener(
        'resize',
        resize,
      );

      if (
        animationRef.current
      ) {
        cancelAnimationFrame(
          animationRef.current,
        );
      }
    };
  }, [
    active,
    text,
    duration,
    onComplete,
  ]);

  if (!active) return null;

  return (
    <div
      className="
        fixed
        inset-0
        z-[2000]
        pointer-events-none
        overflow-hidden
      "
      style={{
        background:
          'rgba(2,3,7,0.98)',
      }}
    >
      <canvas
        ref={canvasRef}
        className="
          absolute
          inset-0
          w-full
          h-full
        "
      />

      {/* Cinematic vignette */}
      <div
        className="
          absolute
          inset-0
          pointer-events-none
        "
        style={{
          background:
            `
            radial-gradient(
              ellipse at center,
              transparent 35%,
              rgba(0,0,0,.45) 100%
            )
            `,
        }}
      />

      {/* Subtle horizon glow */}
      <div
        className="
          absolute
          left-1/2
          bottom-[-15%]
          -translate-x-1/2
          w-[80vw]
          h-[40vh]
          pointer-events-none
        "
        style={{
          background:
            'radial-gradient(ellipse, rgba(236,72,153,.08), transparent 70%)',
          filter:
            'blur(40px)',
        }}
      />
    </div>
  );
}