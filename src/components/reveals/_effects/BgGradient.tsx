'use client';

// bg-gradient — full-screen animated gradient backdrop.
// Params: { from: string, to: string, angle?: number }

import { motion } from 'framer-motion';
import type { EffectProps } from './_types';
import { resolveString } from './resolve';

interface Props extends EffectProps {
  from?: string;
  to?: string;
  angle?: number;
}

export default function BgGradient({ from = '#1f2937', to = '#000', angle = 135, data }: Props) {
  const fromResolved = resolveString(from, data);
  const toResolved = resolveString(to, data);

  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      style={{ background: `linear-gradient(${angle}deg, ${fromResolved} 0%, ${toResolved} 100%)` }}
    />
  );
}
