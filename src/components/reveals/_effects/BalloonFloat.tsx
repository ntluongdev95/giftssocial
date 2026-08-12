'use client';

// balloon-float — colored balloons rise from bottom, drift lazily.
// Params: { colors?: string[], count?: number }

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { EffectProps } from './_types';

interface Props extends EffectProps {
  colors?: string[];
  count?: number;
}

const DEFAULT_COLORS = ['#f43f5e', '#facc15', '#38bdf8', '#a855f7', '#22c55e'];

export default function BalloonFloat({ colors = DEFAULT_COLORS, count = 18 }: Props) {
  const balloons = useMemo(
    () => Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: 5 + Math.random() * 90,
      color: colors[i % colors.length],
      delay: Math.random() * 3,
      duration: 10 + Math.random() * 6,
      sway: (Math.random() - 0.5) * 40,
      size: 32 + Math.random() * 24,
    })),
    [colors, count]
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {balloons.map(b => (
        <motion.div
          key={b.id}
          className="absolute"
          style={{ left: `${b.left}%`, bottom: '-15%' }}
          initial={{ y: 0, x: 0, opacity: 0 }}
          animate={{ y: '-130vh', x: [0, b.sway, -b.sway, 0], opacity: [0, 1, 1, 0.6, 0] }}
          transition={{ duration: b.duration, delay: b.delay, repeat: Infinity, ease: 'easeOut' }}
        >
          <div
            style={{
              width: b.size,
              height: b.size * 1.2,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${b.color}ff, ${b.color}bb 60%, ${b.color}66)`,
              boxShadow: `inset -4px -6px 8px rgba(0,0,0,0.2)`,
              position: 'relative',
            }}
          >
            {/* string */}
            <div
              style={{
                position: 'absolute',
                left: '50%', top: '100%',
                width: 1, height: b.size * 1.4,
                background: 'rgba(255,255,255,0.4)',
                transform: 'translateX(-50%)',
              }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
