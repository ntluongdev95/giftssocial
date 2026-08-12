'use client';

// confetti-burst — colorful rectangles explode from center of screen.
// Params: { colors?: string[], count?: number }

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { EffectProps } from './_types';

interface Props extends EffectProps {
  colors?: string[];
  count?: number;
}

const DEFAULT_COLORS = ['#f43f5e', '#facc15', '#38bdf8', '#a855f7', '#22c55e', '#f97316'];

export default function ConfettiBurst({ colors = DEFAULT_COLORS, count = 120 }: Props) {
  const pieces = useMemo(
    () => Array.from({ length: count }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 200 + Math.random() * 400;
      return {
        id: i,
        color: colors[i % colors.length],
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance - 100, // slight upward bias
        rotate: (Math.random() - 0.5) * 720,
        duration: 1.5 + Math.random() * 1.5,
        size: 6 + Math.random() * 8,
      };
    }),
    [colors, count]
  );

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
      {pieces.map(p => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            width: p.size,
            height: p.size * 1.6,
            background: p.color,
            borderRadius: 1,
          }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: p.dx, y: p.dy + 300, rotate: p.rotate, opacity: [1, 1, 0] }}
          transition={{ duration: p.duration, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}
