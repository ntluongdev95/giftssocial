'use client';

// text-fade — text fades in slowly (for wishes, messages, quotes).
// Params: { text: string, color?: string, size?: number, italic?: boolean }

import { motion } from 'framer-motion';
import type { EffectProps } from './_types';
import { resolveString } from './resolve';

interface Props extends EffectProps {
  text?: string;
  color?: string;
  size?: number;
  italic?: boolean;
}

export default function TextFade({
  text = '',
  color = '#fff',
  size = 24,
  italic = false,
  data,
}: Props) {
  const resolved = resolveString(text, data);
  if (!resolved) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 2.4, ease: 'easeOut' }}
        className="text-center max-w-md leading-relaxed"
        style={{
          color,
          fontSize: size,
          fontStyle: italic ? 'italic' : 'normal',
          textShadow: '0 2px 12px rgba(0,0,0,0.6)',
        }}
      >
        {resolved}
      </motion.div>
    </div>
  );
}
