'use client';

// Heart Explosion — Valentine reveal.
// After meet-and-hug, a giant heart pulses at the center, then bursts
// into hundreds of tiny hearts radiating in every direction, with a
// sparkle field twinkling in the background. Message text fades in
// after the burst.

import { useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import TemplateShell from '../_shared/TemplateShell';
import type { TemplateProps } from '../_types';

const ACCENT = '#ec4899';

export default function HeartBlastReveal({ kiss, onClose }: TemplateProps) {
  const [phase, setPhase] = useState<'pulse' | 'blast'>('pulse');

  // After 1.4s of pulsing, trigger the explosion.
  useEffect(() => {
    const t = setTimeout(() => setPhase('blast'), 1400);
    return () => clearTimeout(t);
  }, []);

  // Pre-compute hearts & sparkles so their random positions stay stable across renders.
  const hearts = useMemo(
    () => Array.from({ length: 140 }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 200 + Math.random() * 500;
      return {
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        emoji: ['❤️', '💕', '💗', '💖', '💘', '♥️'][Math.floor(Math.random() * 6)],
        size: 14 + Math.random() * 22,
        rotate: (Math.random() - 0.5) * 720,
        duration: 1.6 + Math.random() * 1.4,
      };
    }),
    []
  );

  const sparkles = useMemo(
    () => Array.from({ length: 60 }).map(() => ({
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 6 + Math.random() * 14,
      delay: Math.random() * 2,
    })),
    []
  );

  return (
    <TemplateShell
      sender={{ name: kiss.sender_name, avatarUrl: kiss.sender_avatar }}
      receiver={{ name: kiss.receiver_name, avatarUrl: kiss.receiver_avatar }}
      accent={ACCENT}
      onClose={onClose}
      backdrop={
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at center, #4a0e1f 0%, #1a0510 55%, #08020a 100%)',
        }} />
      }
    >
      <div className="absolute inset-0 overflow-hidden">
        {/* Sparkle field (always on) */}
        {sparkles.map((s, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: `${s.left}%`, top: `${s.top}%`, fontSize: s.size, filter: 'drop-shadow(0 0 6px #ff8bcd)' }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
            transition={{ duration: 2.4, delay: s.delay, repeat: Infinity, repeatDelay: Math.random() * 2 }}
          >
            ✨
          </motion.div>
        ))}

        {/* Giant heart — pulses, then vanishes as the blast fires */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={phase === 'pulse'
            ? { scale: [0.4, 1.1, 0.95, 1.15, 1.0], opacity: 1 }
            : { scale: [1, 1.6, 0], opacity: [1, 1, 0] }}
          transition={phase === 'pulse'
            ? { duration: 1.4, times: [0, 0.3, 0.55, 0.8, 1], ease: 'easeOut' }
            : { duration: 0.6, ease: 'easeIn' }}
        >
          <div style={{
            fontSize: 220,
            filter: `drop-shadow(0 0 40px ${ACCENT}) drop-shadow(0 0 80px ${ACCENT}88)`,
          }}>
            ❤️
          </div>
        </motion.div>

        {/* Hearts explosion (only after blast) */}
        {phase === 'blast' && (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
            {hearts.map((h, i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{ fontSize: h.size, filter: `drop-shadow(0 0 6px ${ACCENT}aa)` }}
                initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0 }}
                animate={{ x: h.dx, y: h.dy, rotate: h.rotate, opacity: [1, 1, 0.6, 0], scale: [0, 1.4, 1] }}
                transition={{ duration: h.duration, ease: 'easeOut' }}
              >
                {h.emoji}
              </motion.div>
            ))}
          </div>
        )}

        {/* Message card — fades in after the blast, then floats to rest */}
        {phase === 'blast' && (
          <motion.div
            className="absolute inset-x-0 bottom-24 flex justify-center pointer-events-none px-8"
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 1.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="max-w-md text-center px-6 py-5 rounded-2xl backdrop-blur"
              style={{
                background: 'rgba(0,0,0,0.55)',
                border: `1px solid ${ACCENT}66`,
                boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 40px ${ACCENT}33`,
              }}
            >
              <div className="text-xs uppercase tracking-widest mb-2" style={{ color: ACCENT }}>
                From {kiss.sender_name || 'someone'}
              </div>
              <div className="text-white text-lg leading-relaxed">
                {kiss.message || 'I love you.'}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </TemplateShell>
  );
}
