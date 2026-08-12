'use client';

// photo-hero — displays a user-uploaded image (from a field of type
// "image") as a large photo card at the center of the reveal. Uses
// {placeholder} substitution so the effect can reference any image
// field: { "type":"photo-hero", "src":"{photo}", "tilt":-6 }.
//
// Params: { src: string, tilt?: number, size?: number, frame?: 'polaroid' | 'card' }

import { motion } from 'framer-motion';
import type { EffectProps } from './_types';
import { resolveString } from './resolve';

interface Props extends EffectProps {
  src?: string;
  tilt?: number;
  size?: number;
  frame?: 'polaroid' | 'card';
  caption?: string;
}

export default function PhotoHero({
  src = '',
  tilt = -4,
  size = 260,
  frame = 'polaroid',
  caption = '',
  data,
}: Props) {
  const resolvedSrc = resolveString(src, data);
  const resolvedCaption = resolveString(caption, data);
  if (!resolvedSrc) return null;

  const isPolaroid = frame === 'polaroid';

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6">
      <motion.div
        initial={{ scale: 0.5, opacity: 0, rotate: tilt - 8 }}
        animate={{ scale: 1, opacity: 1, rotate: tilt }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        style={{
          padding: isPolaroid ? 12 : 4,
          paddingBottom: isPolaroid ? (resolvedCaption ? 36 : 48) : 4,
          background: isPolaroid ? '#faf8f5' : '#000',
          borderRadius: isPolaroid ? 4 : 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.15)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedSrc}
          alt=""
          style={{
            width: size,
            height: size,
            objectFit: 'cover',
            borderRadius: isPolaroid ? 2 : 12,
            display: 'block',
          }}
        />
        {isPolaroid && resolvedCaption && (
          <div
            className="text-center text-black/80 mt-2"
            style={{ fontFamily: 'Comic Sans MS, cursive', fontSize: 18 }}
          >
            {resolvedCaption}
          </div>
        )}
      </motion.div>
    </div>
  );
}
