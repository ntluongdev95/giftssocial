'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  emoji: string;
  label: string;
  caption: string;
  href: string;
}

// One "What do you want Lovi to say?" tile. Hover triggers a tiny
// scripted reaction (icon bounce/tilt + a caption line appearing) —
// phase-1 stand-in for the brief's "Lovi lives inside the tile" idea,
// built with pure CSS/motion rather than a full character animation.
export default function EmotionCard({ emoji, label, caption, href }: Props) {
  const [hover, setHover] = useState(false);

  return (
    <motion.a
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl px-4 py-6 text-center cursor-pointer"
      style={{
        background: hover ? 'rgba(255,111,156,0.1)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${hover ? 'rgba(255,111,156,0.4)' : 'rgba(255,255,255,0.08)'}`,
      }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.2 }}
    >
      <motion.span
        style={{ fontSize: 34, display: 'inline-block' }}
        animate={hover ? { y: [0, -8, 0], rotate: [0, -8, 8, 0] } : { y: 0, rotate: 0 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      >
        {emoji}
      </motion.span>
      <span className="text-sm font-bold text-white">{label}</span>
      <motion.span
        className="text-[11px] text-white/50"
        initial={false}
        animate={{ opacity: hover ? 1 : 0, height: hover ? 'auto' : 0 }}
        transition={{ duration: 0.2 }}
      >
        {caption}
      </motion.span>
    </motion.a>
  );
}
