'use client';

// particle-rain — emojis fall from the top of the screen.
// Params: { emoji: string, count?: number, speed?: 'slow'|'normal'|'fast', size?: number }

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { EffectProps } from './_types';
import { resolveString } from './resolve';

interface Props extends EffectProps {
  emoji?: string;
  count?: number;
  speed?: 'slow' | 'normal' | 'fast';
  size?: number;
}

const SPEED_MAP = { slow: 12, normal: 8, fast: 5 } as const;

export default function ParticleRain({
  emoji = '🌸',
  count = 60,
  speed = 'normal',
  size = 28,
  data,
}: Props) {
  const emojiResolved = resolveString(emoji, data) || '🌸';
  const durationBase = SPEED_MAP[speed] ?? SPEED_MAP.normal;

  const particles = useMemo(
    () => Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: durationBase + Math.random() * 4,
      rotate: (Math.random() - 0.5) * 720,
      scale: 0.6 + Math.random() * 0.8,
    })),
    [count, durationBase]
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{ left: `${p.left}%`, top: '-10%', fontSize: size * p.scale }}
          initial={{ y: 0, rotate: 0, opacity: 0 }}
          animate={{ y: '115vh', rotate: p.rotate, opacity: [0, 1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' }}
        >
          {emojiResolved}
        </motion.div>
      ))}
    </div>
  );
}
