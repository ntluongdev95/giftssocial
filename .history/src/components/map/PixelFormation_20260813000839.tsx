'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';

type FormationVehicle = 'drone' | 'car' | 'plane';

interface Point {
  x: number;
  y: number;
}

interface PixelFormationProps {
  text: string;
  vehicle: FormationVehicle;
  duration?: number;
  onComplete?: () => void;
}

/**
 * Convert text -> pixel/letter points.
 *
 * We use a tiny bitmap font instead of loading a real font.
 * This makes the formation deterministic and lightweight.
 */
const FONT: Record<string, string[]> = {
  A: [
    '01110',
    '10001',
    '10001',
    '11111',
    '10001',
    '10001',
    '10001',
  ],
  B: [
    '11110',
    '10001',
    '10001',
    '11110',
    '10001',
    '10001',
    '11110',
  ],
  C: [
    '01111',
    '10000',
    '10000',
    '10000',
    '10000',
    '10000',
    '01111',
  ],
  D: [
    '11110',
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '11110',
  ],
  E: [
    '11111',
    '10000',
    '10000',
    '11110',
    '10000',
    '10000',
    '11111',
  ],
  F: [
    '11111',
    '10000',
    '10000',
    '11110',
    '10000',
    '10000',
    '10000',
  ],
  G: [
    '01111',
    '10000',
    '10000',
    '10111',
    '10001',
    '10001',
    '01111',
  ],
  H: [
    '10001',
    '10001',
    '10001',
    '11111',
    '10001',
    '10001',
    '10001',
  ],
  I: [
    '11111',
    '00100',
    '00100',
    '00100',
    '00100',
    '00100',
    '11111',
  ],
  J: [
    '00111',
    '00010',
    '00010',
    '00010',
    '00010',
    '10010',
    '01100',
  ],
  K: [
    '10001',
    '10010',
    '10100',
    '11000',
    '10100',
    '10010',
    '10001',
  ],
  L: [
    '10000',
    '10000',
    '10000',
    '10000',
    '10000',
    '10000',
    '11111',
  ],
  M: [
    '10001',
    '11011',
    '10101',
    '10101',
    '10001',
    '10001',
    '10001',
  ],
  N: [
    '10001',
    '11001',
    '10101',
    '10011',
    '10001',
    '10001',
    '10001',
  ],
  O: [
    '01110',
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '01110',
  ],
  P: [
    '11110',
    '10001',
    '10001',
    '11110',
    '10000',
    '10000',
    '10000',
  ],
  Q: [
    '01110',
    '10001',
    '10001',
    '10001',
    '10101',
    '10010',
    '01101',
  ],
  R: [
    '11110',
    '10001',
    '10001',
    '11110',
    '10100',
    '10010',
    '10001',
  ],
  S: [
    '01111',
    '10000',
    '10000',
    '01110',
    '00001',
    '00001',
    '11110',
  ],
  T: [
    '11111',
    '00100',
    '00100',
    '00100',
    '00100',
    '00100',
    '00100',
  ],
  U: [
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '01110',
  ],
  V: [
    '10001',
    '10001',
    '10001',
    '10001',
    '10001',
    '01010',
    '00100',
  ],
  W: [
    '10001',
    '10001',
    '10001',
    '10101',
    '10101',
    '11011',
    '10001',
  ],
  X: [
    '10001',
    '10001',
    '01010',
    '00100',
    '01010',
    '10001',
    '10001',
  ],
  Y: [
    '10001',
    '10001',
    '01010',
    '00100',
    '00100',
    '00100',
    '00100',
  ],
  Z: [
    '11111',
    '00001',
    '00010',
    '00100',
    '01000',
    '10000',
    '11111',
  ],

  ' ': [
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
  ],
};

/**
 * Convert string into points.
 */
function textToPoints(
  text: string,
  pixelSize: number,
  maxWidth: number
): Point[] {
  const normalized = text.toUpperCase();

  const points: Point[] = [];

  let cursorX = 0;

  const charWidth = 5 * pixelSize;
  const charGap = 2 * pixelSize;

  for (const char of normalized) {
    const bitmap = FONT[char] || FONT[' '];

    for (let row = 0; row < bitmap.length; row++) {
      const line = bitmap[row];

      for (let col = 0; col < line.length; col++) {
        if (line[col] === '1') {
          points.push({
            x: cursorX + col * pixelSize,
            y: row * pixelSize,
          });
        }
      }
    }

    cursorX += charWidth + charGap;
  }

  /**
   * Center formation.
   */
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));

  const width = maxX - minX;

  const offsetX = (maxWidth - width) / 2;

  return points.map(point => ({
    x: point.x - minX + offsetX,
    y: point.y,
  }));
}

/**
 * Vehicle icon.
 *
 * Later you can replace these emojis with
 * actual PNG/WebP assets.
 */
function Vehicle({
  type,
  size = 18,
}: {
  type: FormationVehicle;
  size?: number;
}) {
  const icon =
    type === 'drone'
      ? '🚁'
      : type === 'car'
        ? '🏎️'
        : '✈️';

  return (
    <span
      style={{
        fontSize: size,
        display: 'block',
        lineHeight: 1,
        filter:
          'drop-shadow(0 0 5px rgba(255,255,255,.45))',
      }}
    >
      {icon}
    </span>
  );
}

export default function PixelFormation({
  text,
  vehicle,
  duration = 5000,
  onComplete,
}: PixelFormationProps) {
  const [phase, setPhase] = useState<
    'forming' | 'holding' | 'breaking'
  >('forming');

  const formation = useMemo(() => {
    /**
     * Automatically reduce pixel size for long text.
     */
    const pixelSize =
      text.length > 16
        ? 7
        : text.length > 12
          ? 8
          : 10;

    return textToPoints(text, pixelSize, 900);
  }, [text]);

  /**
   * Timeline.
   */
  useEffect(() => {
    setPhase('forming');

    const formTimer = setTimeout(() => {
      setPhase('holding');
    }, duration * 0.55);

    const breakTimer = setTimeout(() => {
      setPhase('breaking');
    }, duration * 0.82);

    const completeTimer = setTimeout(() => {
      onComplete?.();
    }, duration);

    return () => {
      clearTimeout(formTimer);
      clearTimeout(breakTimer);
      clearTimeout(completeTimer);
    };
  }, [text, duration, onComplete]);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{
        perspective: '1000px',
      }}
    >
      <div
        className="relative"
        style={{
          width: 'min(900px, 92vw)',
          height: '220px',
        }}
      >
        {/* Ambient glow */}
        <motion.div
          className="absolute left-1/2 top-1/2"
          style={{
            width: 500,
            height: 160,
            transform: 'translate(-50%, -50%)',
            background:
              'radial-gradient(ellipse, rgba(255,255,255,.12), transparent 70%)',
            filter: 'blur(30px)',
          }}
          animate={{
            opacity:
              phase === 'holding' ? 0.8 : 0.3,
            scale:
              phase === 'holding' ? 1.1 : 0.8,
          }}
          transition={{
            duration: 1,
          }}
        />

        <AnimatePresence>
          {formation.map((point, index) => {
            /**
             * Deterministic pseudo-random values.
             *
             * Important:
             * We don't use Math.random() here.
             */
            const angle =
              ((index * 137.5) % 360) *
              (Math.PI / 180);

            const radius =
              250 + ((index * 47) % 350);

            const startX =
              Math.cos(angle) * radius;

            const startY =
              Math.sin(angle) * radius;

            const delay =
              (index % 35) * 0.018;

            const breakX =
              Math.cos(angle + 1.5) *
              (300 + (index % 5) * 80);

            const breakY =
              Math.sin(angle + 1.5) *
              (250 + (index % 7) * 50);

            return (
              <motion.div
                key={`${text}-${index}`}
                className="absolute left-0 top-0"
                initial={{
                  x: startX,
                  y: startY,
                  opacity: 0,
                  scale: 0.4,
                  rotate:
                    (index % 2 === 0 ? 1 : -1) *
                    (10 + (index % 15)),
                }}
                animate={
                  phase === 'forming'
                    ? {
                        x: point.x,
                        y: point.y,
                        opacity: 1,
                        scale: 1,
                        rotate: 0,
                      }
                    : phase === 'holding'
                      ? {
                          x: point.x,
                          y: point.y,
                          opacity: 1,
                          scale: [1, 1.08, 1],
                          rotate: 0,
                        }
                      : {
                          x: point.x + breakX,
                          y: point.y + breakY,
                          opacity: 0,
                          scale: 0.1,
                          rotate:
                            index % 2
                              ? 120
                              : -120,
                        }
                }
                transition={{
                  x: {
                    duration:
                      phase === 'forming'
                        ? 1.8
                        : 1.2,
                    delay,
                    ease: [0.16, 1, 0.3, 1],
                  },
                  y: {
                    duration:
                      phase === 'forming'
                        ? 1.8
                        : 1.2,
                    delay,
                    ease: [0.16, 1, 0.3, 1],
                  },
                  opacity: {
                    duration: 0.6,
                    delay,
                  },
                  scale:
                    phase === 'holding'
                      ? {
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }
                      : {
                          duration: 0.8,
                          delay,
                        },
                  rotate: {
                    duration: 1.2,
                    delay,
                    ease: 'easeOut',
                  },
                }}
                style={{
                  width: 10,
                  height: 10,
                }}
              >
                <Vehicle type={vehicle} size={12} />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Text glow behind formation */}
        {phase === 'holding' && (
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.8,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            className="absolute inset-0 flex items-center justify-center"
            style={{
              pointerEvents: 'none',
            }}
          >
            <div
              className="text-center font-black tracking-[0.35em] uppercase"
              style={{
                color: 'rgba(255,255,255,0.08)',
                fontSize:
                  text.length > 15
                    ? '28px'
                    : '36px',
                filter: 'blur(2px)',
              }}
            >
              {text}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}