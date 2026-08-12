'use client';

// Snow Fall — Christmas reveal.
// Full-screen night sky with drifting snowflakes and a warmly-lit
// SVG tree at the bottom. Colored "lights" pulse on the tree.
// "Merry Christmas, {name}" fades in above the tree.

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import TemplateShell from '../_shared/TemplateShell';
import type { TemplateProps } from '../_types';

const ACCENT = '#a5b4fc';
const TREE_GLOW = '#facc15';

export default function XmasSnowReveal({ kiss, onClose }: TemplateProps) {
  // 120 snowflakes with random horizontal drift + fall speed
  const flakes = useMemo(
    () => Array.from({ length: 120 }).map(() => ({
      left: Math.random() * 100,
      size: 4 + Math.random() * 12,
      delay: Math.random() * 8,
      duration: 8 + Math.random() * 10,
      sway: (Math.random() - 0.5) * 60,
      opacity: 0.4 + Math.random() * 0.6,
    })),
    []
  );

  // 6 lights sprinkled across the tree
  const lights = useMemo(
    () => [
      { top: 42, left: 46, color: '#f43f5e' },
      { top: 48, left: 55, color: '#22c55e' },
      { top: 55, left: 42, color: '#facc15' },
      { top: 60, left: 58, color: '#38bdf8' },
      { top: 66, left: 48, color: '#f97316' },
      { top: 72, left: 52, color: '#c084fc' },
    ],
    []
  );

  return (
    <TemplateShell
      sender={{ name: kiss.sender_name, avatarUrl: kiss.sender_avatar }}
      receiver={{ name: kiss.receiver_name, avatarUrl: kiss.receiver_avatar }}
      accent={ACCENT}
      particles={['❄️', '⛄', '✨']}
      onClose={onClose}
      backdrop={
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, #0a0a2e 0%, #1e1b4b 40%, #312e81 100%)',
        }} />
      }
    >
      <div className="absolute inset-0 overflow-hidden">
        {/* Distant stars */}
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={`star-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 40}%`,
              width: 2,
              height: 2,
              background: '#fff',
              opacity: 0.3 + Math.random() * 0.7,
              boxShadow: '0 0 4px #fff',
            }}
          />
        ))}

        {/* Snowflakes */}
        {flakes.map((f, i) => (
          <motion.div
            key={`flake-${i}`}
            className="absolute pointer-events-none"
            style={{ left: `${f.left}%`, top: '-8%', fontSize: f.size, opacity: f.opacity, color: '#fff' }}
            initial={{ y: 0, x: 0 }}
            animate={{ y: '115vh', x: [0, f.sway, -f.sway, 0] }}
            transition={{ duration: f.duration, delay: f.delay, repeat: Infinity, ease: 'linear' }}
          >
            ❄
          </motion.div>
        ))}

        {/* Tree — pure CSS/SVG so it always looks crisp */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pointer-events-none">
          <svg width="320" height="380" viewBox="0 0 320 380" style={{ filter: `drop-shadow(0 0 20px ${TREE_GLOW}66)` }}>
            {/* Trunk */}
            <rect x="145" y="320" width="30" height="60" fill="#7c2d12" />
            {/* Layers (dark green triangles from wide bottom to narrow top) */}
            <polygon points="160,40  90,150  230,150" fill="#166534" />
            <polygon points="160,110 60,240  260,240" fill="#15803d" />
            <polygon points="160,180 40,330  280,330" fill="#16a34a" />
            {/* Star */}
            <text x="160" y="45" fontSize="42" textAnchor="middle" fill={TREE_GLOW} style={{ filter: `drop-shadow(0 0 12px ${TREE_GLOW})` }}>★</text>
          </svg>
        </div>

        {/* Twinkling lights */}
        {lights.map((l, i) => (
          <motion.div
            key={`light-${i}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${l.left}%`,
              top: `${l.top}%`,
              width: 10, height: 10,
              background: l.color,
              boxShadow: `0 0 16px ${l.color}, 0 0 32px ${l.color}88`,
            }}
            animate={{ opacity: [1, 0.3, 1], scale: [1, 1.3, 1] }}
            transition={{ duration: 1.2 + i * 0.2, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}

        {/* "Merry Christmas" title */}
        <motion.div
          className="absolute inset-x-0 top-16 flex justify-center pointer-events-none px-6"
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="text-center">
            <div
              className="text-4xl md:text-5xl font-black tracking-tight"
              style={{
                background: `linear-gradient(135deg, #fff, ${ACCENT}, ${TREE_GLOW})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: `drop-shadow(0 4px 20px ${ACCENT}66)`,
              }}
            >
              Merry Christmas
            </div>
            {kiss.receiver_name && (
              <div className="text-white/80 text-lg mt-1" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
                {kiss.receiver_name}
              </div>
            )}
          </div>
        </motion.div>

        {/* Message card — floats above the tree */}
        {kiss.message && (
          <motion.div
            className="absolute inset-x-0 bottom-96 flex justify-center pointer-events-none px-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 2.0, ease: 'easeOut' }}
          >
            <div
              className="max-w-sm text-center px-5 py-3 rounded-2xl backdrop-blur"
              style={{
                background: 'rgba(30,27,75,0.6)',
                border: `1px solid ${ACCENT}55`,
                boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 30px ${ACCENT}22`,
              }}
            >
              <div className="text-white/95 text-sm italic leading-relaxed">
                &ldquo;{kiss.message}&rdquo;
              </div>
              {kiss.sender_name && (
                <div className="text-[10px] uppercase tracking-widest mt-2" style={{ color: ACCENT }}>
                  — {kiss.sender_name}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </TemplateShell>
  );
}
