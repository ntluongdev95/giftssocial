'use client';

import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

type FormationType = 'drone' | 'car' | 'plane';

interface Props {
  type?: FormationType;
  text?: string;
  active?: boolean;
  onComplete?: () => void;
}

interface Drone {
  x: number;
  y: number;

  tx: number;
  ty: number;

  vx: number;
  vy: number;

  size: number;

  brightness: number;

  delay: number;

  phase: number;

  trail: {
    x: number;
    y: number;
  }[];

  arrived: boolean;
}

const DPR = Math.min(
  typeof window !== 'undefined'
    ? window.devicePixelRatio || 1
    : 1,
  2
);

const COLORS = {
  cyan: '#8ff7ff',
  blue: '#5ee7ff',
  white: '#ffffff',
  pink: '#ff77b7',
  purple: '#b18cff',
};

const TEXT_SEQUENCE = [
  'ARE',
  'YOU',
  'READY',
];

const FINAL_TEXT = 'TO SEND A KISS';

const DRONES_PER_LETTER = 85;

const TOTAL_DRONES =
  DRONES_PER_LETTER * 12;

function easeInOutCubic(t: number) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 -
        Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(
  a: number,
  b: number,
  t: number
) {
  return a + (b - a) * t;
}

function random(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

/**
 * Convert text into pixel points.
 *
 * The important part of the whole effect:
 *
 *        TEXT
 *          ↓
 *      Canvas pixels
 *          ↓
 *     sample pixels
 *          ↓
 *      drone targets
 */
function createTextFormation(
  text: string,
  width: number,
  height: number,
  maxPoints: number
) {
  const canvas =
    document.createElement('canvas');

  const ctx = canvas.getContext('2d');

  if (!ctx) return [];

  canvas.width = 1000;
  canvas.height = 300;

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  /**
   * Huge bold font.
   *
   * Arial Black is intentionally used
   * because it exists almost everywhere.
   */
  let fontSize = 220;

  ctx.font =
    `900 ${fontSize}px Arial Black, Arial, sans-serif`;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  /**
   * Shrink font until text fits.
   */
  while (
    ctx.measureText(text).width >
      canvas.width * 0.9 &&
    fontSize > 40
  ) {
    fontSize -= 5;

    ctx.font =
      `900 ${fontSize}px Arial Black, Arial, sans-serif`;
  }

  ctx.fillStyle = '#ffffff';

  ctx.fillText(
    text,
    canvas.width / 2,
    canvas.height / 2
  );

  const image = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const rawPoints: {
    x: number;
    y: number;
  }[] = [];

  /**
   * Pixel sampling.
   *
   * Larger step = fewer drones.
   */
  const step = 5;

  for (
    let y = 0;
    y < canvas.height;
    y += step
  ) {
    for (
      let x = 0;
      x < canvas.width;
      x += step
    ) {
      const index =
        (y * canvas.width + x) * 4;

      const alpha =
        image.data[index + 3];

      if (alpha > 150) {
        rawPoints.push({
          x,
          y,
        });
      }
    }
  }

  /**
   * Downsample if necessary.
   */
  let points = rawPoints;

  if (points.length > maxPoints) {
    const ratio =
      points.length / maxPoints;

    points = [];

    for (
      let i = 0;
      i < rawPoints.length;
      i += ratio
    ) {
      points.push(
        rawPoints[Math.floor(i)]
      );
    }
  }

  /**
   * Convert 1000x300 coordinates
   * into screen coordinates.
   */
  return points.map((p) => ({
    x:
      (p.x / 1000) * width,
    y:
      (p.y / 300) * height,
  }));
}

/**
 * Create a large cinematic
 * starting formation.
 */
function createSkyFormation(
  width: number,
  height: number,
  count: number
) {
  const points = [];

  /**
   * Large curved formation.
   *
   * This makes the drones initially
   * look like a real show formation
   * instead of random particles.
   */
  for (let i = 0; i < count; i++) {
    const t =
      i / Math.max(1, count - 1);

    const angle =
      t * Math.PI * 2;

    const radius =
      Math.min(width, height) *
      (0.25 + Math.random() * 0.2);

    const x =
      width / 2 +
      Math.cos(angle) * radius +
      random(-25, 25);

    const y =
      height / 2 +
      Math.sin(angle) *
        radius *
        0.42 +
      random(-20, 20);

    points.push({
      x,
      y,
    });
  }

  return points;
}

function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number
) {
  const gradient =
    ctx.createRadialGradient(
      x,
      y,
      0,
      x,
      y,
      radius
    );

  gradient.addColorStop(
    0,
    color.replace(
      ')',
      `, ${alpha})`
    )
  );

  gradient.addColorStop(
    0.2,
    color.replace(
      ')',
      `, ${alpha * 0.5})`
    )
  );

  gradient.addColorStop(
    1,
    color.replace(
      ')',
      ', 0)'
    )
  );

  ctx.fillStyle = gradient;

  ctx.beginPath();

  ctx.arc(
    x,
    y,
    radius,
    0,
    Math.PI * 2
  );

  ctx.fill();
}

/**
 * Because CSS hex cannot directly
 * be used with alpha, convert colors.
 */
function hexToRgba(
  hex: string,
  alpha: number
) {
  const clean =
    hex.replace('#', '');

  const r = parseInt(
    clean.substring(0, 2),
    16
  );

  const g = parseInt(
    clean.substring(2, 4),
    16
  );

  const b = parseInt(
    clean.substring(4, 6),
    16
  );

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function CinematicFormation({
  type = 'drone',
  text,
  active = true,
  onComplete,
}: Props) {
  const canvasRef =
    useRef<HTMLCanvasElement | null>(
      null
    );

  const animationRef =
    useRef<number | null>(null);

  const dronesRef =
    useRef<Drone[]>([]);

  const [currentText, setCurrentText] =
    useState('');

  const [phase, setPhase] =
    useState<'intro' | 'forming' | 'hold' | 'final' | 'done'>(
      'intro'
    );

  const completedRef =
    useRef(false);

  useEffect(() => {
    if (!active) return;

    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const parent =
      canvas.parentElement;

    if (!parent) return;

    const ctx =
      canvas.getContext('2d');

    if (!ctx) return;

    let width =
      parent.clientWidth;

    let height =
      parent.clientHeight;

    function resize() {
      width =
        parent!.clientWidth;

      height =
        parent!.clientHeight;

      canvas!.width =
        width * DPR;

      canvas!.height =
        height * DPR;

      canvas!.style.width =
        `${width}px`;

      canvas!.style.height =
        `${height}px`;

      ctx!.setTransform(
        DPR,
        0,
        0,
        DPR,
        0,
        0
      );
    }

    resize();

    const observer =
      new ResizeObserver(resize);

    observer.observe(parent);

    /**
     * Initial drone positions.
     */
    const start =
      createSkyFormation(
        width,
        height,
        TOTAL_DRONES
      );

    dronesRef.current =
      start.map((p, i) => ({
        x:
          p.x +
          random(-30, 30),

        y:
          p.y +
          random(-30, 30),

        tx: p.x,
        ty: p.y,

        vx: 0,
        vy: 0,

        size:
          random(1.2, 2.1),

        brightness:
          random(0.65, 1),

        delay:
          Math.random() * 0.8,

        phase:
          Math.random() *
          Math.PI *
          2,

        trail: [],

        arrived: false,
      }));

    let startTime =
      performance.now();

    let localPhase:
      | 'intro'
      | 'forming'
      | 'hold'
      | 'final'
      | 'done' =
      'intro';

    let sequenceIndex = 0;

    let formationStarted =
      false;

    let formationStartTime =
      0;

    let holdStartTime =
      0;

    let finalStarted =
      false;

    /**
     * Set target formation.
     */
    function setFormation(
      value: string
    ) {
      const targets =
        createTextFormation(
          value,
          width,
          height,
          Math.min(
            TOTAL_DRONES,
            Math.max(
              250,
              value.length *
                DRONES_PER_LETTER
            )
          )
        );

      const drones =
        dronesRef.current;

      /**
       * Important:
       *
       * Sort drones by distance to target
       * so movement looks more organized.
       */
      for (
        let i = 0;
        i < drones.length;
        i++
      ) {
        const target =
          targets[
            i % targets.length
          ];

        drones[i].tx =
          target.x;

        drones[i].ty =
          target.y;

        drones[i].arrived =
          false;

        drones[i].delay =
          Math.random() *
          0.35;
      }
    }

    /**
     * Background stars.
     */
    function drawBackground(
      time: number
    ) {
      ctx.fillStyle =
        'rgba(2, 5, 14, 0.24)';

      ctx.fillRect(
        0,
        0,
        width,
        height
      );

      /**
       * Subtle horizon.
       */
      const horizon =
        ctx.createLinearGradient(
          0,
          height * 0.55,
          0,
          height
        );

      horizon.addColorStop(
        0,
        'rgba(20,35,70,0)'
      );

      horizon.addColorStop(
        1,
        'rgba(5,10,25,0.5)'
      );

      ctx.fillStyle =
        horizon;

      ctx.fillRect(
        0,
        0,
        width,
        height
      );

      /**
       * Stars.
       */
      for (let i = 0; i < 80; i++) {
        const x =
          (i * 137.7) %
          width;

        const y =
          (i * 83.1) %
          (height * 0.75);

        const pulse =
          0.3 +
          Math.sin(
            time * 0.001 +
              i
          ) *
            0.2;

        ctx.fillStyle =
          `rgba(160,190,255,${pulse})`;

        ctx.fillRect(
          x,
          y,
          1,
          1
        );
      }
    }

    /**
     * Draw one realistic-ish drone.
     *
     * We intentionally don't draw an
     * airplane/car emoji.
     *
     * Each drone is a tiny luminous
     * aircraft light.
     */
    function drawDrone(
      drone: Drone,
      time: number
    ) {
      const pulse =
        0.75 +
        Math.sin(
          time * 0.004 +
            drone.phase
        ) *
          0.25;

      /**
       * Trail.
       */
      if (
        drone.trail.length > 1
      ) {
        ctx.beginPath();

        drone.trail.forEach(
          (point, index) => {
            if (index === 0) {
              ctx.moveTo(
                point.x,
                point.y
              );
            } else {
              ctx.lineTo(
                point.x,
                point.y
              );
            }
          }
        );

        ctx.strokeStyle =
          hexToRgba(
            COLORS.cyan,
            0.08
          );

        ctx.lineWidth = 1;

        ctx.stroke();
      }

      /**
       * Main halo.
       */
      const gradient =
        ctx.createRadialGradient(
          drone.x,
          drone.y,
          0,
          drone.x,
          drone.y,
          12
        );

      gradient.addColorStop(
        0,
        `rgba(255,255,255,${0.95 * pulse})`
      );

      gradient.addColorStop(
        0.15,
        `rgba(143,247,255,${0.9 * pulse})`
      );

      gradient.addColorStop(
        0.45,
        `rgba(94,231,255,${0.25 * pulse})`
      );

      gradient.addColorStop(
        1,
        'rgba(94,231,255,0)'
      );

      ctx.fillStyle =
        gradient;

      ctx.beginPath();

      ctx.arc(
        drone.x,
        drone.y,
        12,
        0,
        Math.PI * 2
      );

      ctx.fill();

      /**
       * Core light.
       */
      ctx.fillStyle =
        `rgba(255,255,255,${pulse})`;

      ctx.beginPath();

      ctx.arc(
        drone.x,
        drone.y,
        drone.size,
        0,
        Math.PI * 2
      );

      ctx.fill();

      /**
       * Small cyan ring.
       */
      ctx.strokeStyle =
        `rgba(143,247,255,${0.45 * pulse})`;

      ctx.lineWidth = 0.6;

      ctx.beginPath();

      ctx.arc(
        drone.x,
        drone.y,
        drone.size * 2.4,
        0,
        Math.PI * 2
      );

      ctx.stroke();
    }

    function updateDrone(
      drone: Drone,
      elapsed: number
    ) {
      /**
       * Formation movement.
       */
      if (
        localPhase ===
          'forming' ||
        localPhase === 'final'
      ) {
        const dx =
          drone.tx -
          drone.x;

        const dy =
          drone.ty -
          drone.y;

        const distance =
          Math.sqrt(
            dx * dx +
              dy * dy
          );

        /**
         * Spring physics.
         *
         * This makes drones move
         * naturally instead of simply
         * teleporting/interpolating.
         */
        const spring =
          distance > 50
            ? 0.012
            : 0.025;

        drone.vx +=
          dx * spring;

        drone.vy +=
          dy * spring;

        drone.vx *= 0.88;
        drone.vy *= 0.88;

        drone.x +=
          drone.vx;

        drone.y +=
          drone.vy;

        /**
         * Micro movement when arrived.
         */
        if (distance < 3) {
          drone.arrived =
            true;

          drone.x +=
            Math.sin(
              elapsed * 0.002 +
                drone.phase
            ) *
            0.08;

          drone.y +=
            Math.cos(
              elapsed * 0.002 +
                drone.phase
            ) *
            0.08;
        }
      }

      /**
       * Trail.
       */
      drone.trail.unshift({
        x: drone.x,
        y: drone.y,
      });

      if (
        drone.trail.length >
        4
      ) {
        drone.trail.pop();
      }
    }

    function allArrived() {
      return dronesRef.current.every(
        (d) => d.arrived
      );
    }

    function render(
      now: number
    ) {
      const elapsed =
        now - startTime;

      /**
       * Cinematic fade.
       */
      ctx.clearRect(
        0,
        0,
        width,
        height
      );

      drawBackground(
        now
      );

      /**
       * Sequence:
       *
       * 0s    sky formation
       * 1.5s  ARE
       * 4.2s  YOU
       * 6.9s  READY
       * 10s   final phrase
       */
      if (
        elapsed >
          1200 &&
        !formationStarted
      ) {
        formationStarted =
          true;

        localPhase =
          'forming';

        setCurrentText(
          TEXT_SEQUENCE[0]
        );

        setFormation(
          TEXT_SEQUENCE[0]
        );

        formationStartTime =
          now;
      }

      /**
       * Next words.
       */
      if (
        localPhase ===
          'forming' &&
        allArrived()
      ) {
        if (
          now -
            formationStartTime >
          2200
        ) {
          localPhase =
            'hold';

          holdStartTime =
            now;
        }
      }

      if (
        localPhase ===
          'hold' &&
        now -
            holdStartTime >
          750
      ) {
        sequenceIndex++;

        if (
          sequenceIndex <
          TEXT_SEQUENCE.length
        ) {
          localPhase =
            'forming';

          formationStartTime =
            now;

          setCurrentText(
            TEXT_SEQUENCE[
              sequenceIndex
            ]
          );

          setFormation(
            TEXT_SEQUENCE[
              sequenceIndex
            ]
          );
        } else if (
          !finalStarted
        ) {
          finalStarted =
            true;

          localPhase =
            'final';

          setCurrentText(
            text ||
              FINAL_TEXT
          );

          setFormation(
            text ||
              FINAL_TEXT
          );
        }
      }

      /**
       * Final formation.
       */
      if (
        finalStarted &&
        localPhase ===
          'final' &&
        allArrived()
      ) {
        if (
          now -
            formationStartTime >
          2800 &&
          !completedRef.current
        ) {
          completedRef.current =
            true;

          localPhase =
            'done';

          setPhase(
            'done'
          );

          setTimeout(() => {
            onComplete?.();
          }, 1200);
        }
      }

      /**
       * Draw drones.
       */
      dronesRef.current.forEach(
        (drone) => {
          updateDrone(
            drone,
            elapsed
          );

          drawDrone(
            drone,
            now
          );
        }
      );

      /**
       * Update visible text.
       */
      if (
        localPhase !==
        'intro'
      ) {
        setPhase(
          localPhase ===
            'final'
            ? 'final'
            : localPhase ===
              'hold'
            ? 'hold'
            : 'forming'
        );
      }

      animationRef.current =
        requestAnimationFrame(
          render
        );
    }

    animationRef.current =
      requestAnimationFrame(
        render
      );

    return () => {
      observer.disconnect();

      if (
        animationRef.current
      ) {
        cancelAnimationFrame(
          animationRef.current
        );
      }
    };
  }, [
    active,
    text,
    onComplete,
  ]);

  if (!active) {
    return null;
  }

  return (
    <div
      className="
        absolute
        inset-0
        overflow-hidden
        pointer-events-none
      "
      style={{
        background:
          'radial-gradient(circle at 50% 50%, #111a31 0%, #050914 48%, #02040a 100%)',
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
            'radial-gradient(circle, transparent 35%, rgba(0,0,0,.65) 100%)',
        }}
      />

      {/* Top atmospheric glow */}
      <div
        className="
          absolute
          left-1/2
          -translate-x-1/2
          top-[10%]
          w-[70vw]
          h-[40vh]
          rounded-full
          pointer-events-none
        "
        style={{
          background:
            'radial-gradient(ellipse, rgba(80,170,255,.09), transparent 65%)',
          filter:
            'blur(40px)',
        }}
      />

      <canvas
        ref={canvasRef}
        className="
          absolute
          inset-0
          w-full
          h-full
        "
      />

      {/* Text information */}
      <div
        className="
          absolute
          inset-x-0
          top-[13%]
          flex
          justify-center
          pointer-events-none
        "
      >
        <div
          className="
            text-center
            uppercase
            tracking-[0.55em]
          "
        >
          <div
            className="
              text-[9px]
              md:text-xs
              text-white/30
              mb-4
            "
          >
            GAO SOCIAL PRESENTS
          </div>

          <div
            className="
              text-[10px]
              md:text-xs
              text-cyan-200/40
              tracking-[0.35em]
            "
          >
            A MESSAGE IS ABOUT TO TAKE FLIGHT
          </div>
        </div>
      </div>

      {/* Current formation label */}
      <div
        className="
          absolute
          left-0
          right-0
          bottom-[13%]
          flex
          justify-center
          pointer-events-none
        "
      >
        <div className="text-center">
          <div
            className="
              text-[9px]
              tracking-[0.45em]
              text-white/20
              uppercase
            "
          >
            DRONE LIGHT SHOW
          </div>

          <div
            className="
              mt-3
              text-[10px]
              text-white/25
              tracking-[0.25em]
            "
          >
            {phase === 'final'
              ? 'FINAL FORMATION'
              : 'FORMATION IN PROGRESS'}
          </div>
        </div>
      </div>

      {/* cinematic bottom gradient */}
      <div
        className="
          absolute
          left-0
          right-0
          bottom-0
          h-[25%]
          pointer-events-none
        "
        style={{
          background:
            'linear-gradient(to top, rgba(2,4,10,.8), transparent)',
        }}
      />
    </div>
  );
}