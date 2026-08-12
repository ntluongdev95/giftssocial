'use client';

// Party Popper — Birthday reveal.
// Confetti bursts from the center, balloons rise from the bottom on a
// warm sunset gradient, and a bouncing "HAPPY BIRTHDAY {name}" title
// wobbles in. Cake emoji rotates in at the end above a wish message.

import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import TemplateShell from '../_shared/TemplateShell';
import type { TemplateProps } from '../_types';

const ACCENT = '#f97316';
const CONFETTI_COLORS = ['#f43f5e', '#facc15', '#38bdf8', '#a855f7', '#22c55e', '#f97316', '#ec4899'];

export default function BdayPartyReveal({ kiss, onClose }: TemplateProps) {
  const [replayKey, setReplayKey] = useState(0);

  // Auto-replay the confetti burst every 4 seconds so the party feels
  // continuous the whole time the reveal is open.
  useEffect(() => {
    const t = setInterval(() => setReplayKey(k => k + 1), 4000);
    return () => clearInterval(t);
  }, []);

  const confetti = useMemo(
    () => Array.from({ length: 160 }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 200 + Math.random() * 500;
      return {
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance - 60, // slight upward bias
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotate: (Math.random() - 0.5) * 900,
        duration: 1.8 + Math.random() * 2,
        w: 5 + Math.random() * 6,
        h: 10 + Math.random() * 14,
      };
    }),
    [replayKey]
  );

  const balloons = useMemo(
    () => Array.from({ length: 18 }).map(() => ({
      left: 3 + Math.random() * 94,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: Math.random() * 3,
      duration: 8 + Math.random() * 5,
      sway: (Math.random() - 0.5) * 50,
      size: 38 + Math.random() * 26,
    })),
    []
  );

  const receiverName = kiss.receiver_name || 'You';

  return (
    <TemplateShell
      sender={{ name: kiss.sender_name, avatarUrl: kiss.sender_avatar }}
      receiver={{ name: kiss.receiver_name, avatarUrl: kiss.receiver_avatar }}
      accent={ACCENT}
      particles={['🎉', '🎊', '🥳']}
      onClose={onClose}
      backdrop={
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, #7c2d12 0%, #b45309 40%, #f97316 80%, #ec4899 100%)',
        }} />
      }
    >
      <div className="absolute inset-0 overflow-hidden">
        {/* Balloons rise from the bottom continuously */}
        {balloons.map((b, i) => (
          <motion.div
            key={`balloon-${i}`}
            className="absolute pointer-events-none"
            style={{ left: `${b.left}%`, bottom: '-20%' }}
            initial={{ y: 0, x: 0, opacity: 0 }}
            animate={{ y: '-140vh', x: [0, b.sway, -b.sway, 0], opacity: [0, 1, 1, 0.6, 0] }}
            transition={{ duration: b.duration, delay: b.delay, repeat: Infinity, ease: 'easeOut' }}
          >
            <div
              style={{
                width: b.size,
                height: b.size * 1.2,
                borderRadius: '50%',
                background: `radial-gradient(circle at 30% 30%, ${b.color}ff, ${b.color}bb 60%, ${b.color}66)`,
                boxShadow: 'inset -4px -6px 8px rgba(0,0,0,0.2)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute', left: '50%', top: '100%',
                  width: 1, height: b.size * 1.4,
                  background: 'rgba(255,255,255,0.4)',
                  transform: 'translateX(-50%)',
                }}
              />
            </div>
          </motion.div>
        ))}

        {/* Confetti burst — reset via key so it fires each replay */}
        <div key={replayKey} className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
          {confetti.map((c, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{ width: c.w, height: c.h, background: c.color, borderRadius: 1 }}
              initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
              animate={{ x: c.dx, y: c.dy + 300, rotate: c.rotate, opacity: [1, 1, 0] }}
              transition={{ duration: c.duration, ease: 'easeOut' }}
            />
          ))}
        </div>

        {/* HAPPY BIRTHDAY title — bounces in, then does a subtle idle wobble */}
        <motion.div
          className="absolute inset-x-0 top-24 flex justify-center pointer-events-none px-6"
          initial={{ opacity: 0, scale: 0, rotate: -12 }}
          animate={{ opacity: 1, scale: [0, 1.3, 0.95, 1.1, 1], rotate: [-12, 8, -4, 2, 0] }}
          transition={{ duration: 1.2, times: [0, 0.4, 0.6, 0.8, 1], ease: 'easeOut' }}
        >
          <div className="text-center">
            <div
              className="text-4xl md:text-6xl font-black tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #fbbf24, #fff, #ec4899)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 6px 24px rgba(0,0,0,0.5))',
              }}
            >
              HAPPY BIRTHDAY
            </div>
            <motion.div
              className="text-white text-2xl md:text-3xl font-bold mt-1"
              style={{ textShadow: '0 3px 12px rgba(0,0,0,0.6)' }}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              {receiverName} 🎂
            </motion.div>
          </div>
        </motion.div>

        {/* Rotating cake emoji + wish message */}
        <motion.div
          className="absolute inset-x-0 bottom-32 flex flex-col items-center pointer-events-none px-8"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className="text-7xl md:text-8xl mb-3"
            style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.5))' }}
            animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 1.6 }}
          >
            🎂
          </motion.div>
          {kiss.message && (
            <div
              className="max-w-md text-center px-5 py-3 rounded-2xl backdrop-blur"
              style={{
                background: 'rgba(0,0,0,0.45)',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              }}
            >
              <div className="text-white/95 text-base leading-relaxed">
                {kiss.message}
              </div>
              {kiss.sender_name && (
                <div className="text-[10px] uppercase tracking-widest mt-2 text-white/70">
                  — with love, {kiss.sender_name}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </TemplateShell>
  );
}
