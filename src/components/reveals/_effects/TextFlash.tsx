'use client';

// text-flash — text pops in with a bounce, sits center-screen.
// Params: { text: string, color?: string, size?: number, y?: number }

import { motion } from 'framer-motion';
import type { EffectProps } from './_types';
import { resolveString } from './resolve';

interface Props extends EffectProps {
  text?: string;
  color?: string;
  size?: number;
  y?: number;
}

export default function TextFlash({
  text = '',
  color = '#fff',
  size = 48,
  y = 0,
  data,
}: Props) {
  const resolved = resolveString(text, data);
  if (!resolved) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6">
      <motion.div
        initial={{ scale: 0, opacity: 0, rotate: -8 }}
        animate={{ scale: [0, 1.3, 0.95, 1.05, 1], opacity: 1, rotate: 0 }}
        transition={{ duration: 1.1, times: [0, 0.35, 0.55, 0.75, 1], ease: 'easeOut' }}
        className="text-center font-black leading-tight"
        style={{
          color,
          fontSize: size,
          transform: `translateY(${y}px)`,
          textShadow: `0 4px 20px ${color}88, 0 0 40px ${color}44`,
        }}
      >
        {resolved}
      </motion.div>
    </div>
  );
}
