'use client';

// PlaceholderReveal — starter reveal used by every scaffolded template
// that hasn't been custom-designed yet. It gives each template a
// distinct look (accent color, hero emoji, particle emojis, tagline)
// while the developer decides what to build for it.
//
// Usage inside a template's index.tsx:
//
//   function MyReveal(props: TemplateProps) {
//     return <PlaceholderReveal {...props}
//       accent="#ec4899"
//       heroEmoji="💌"
//       title="Love Letter"
//       tagline="A letter sealed with care..."
//       particleEmojis={['💕', '💌', '✨']}
//       bgGradient="linear-gradient(180deg, #4a0e2f, #b45387)"
//     />;
//   }
//
// To fully custom-design a template, replace this call with a hand-
// written animation using TemplateShell + framer-motion directly (see
// val-heart-blast, xmas-snow, bday-party for examples).

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import TemplateShell from './TemplateShell';
import type { TemplateProps } from '../_types';
import { parseKissData } from './useTemplateData';

interface Props extends TemplateProps {
  accent: string;
  heroEmoji: string;
  title: string;
  tagline?: string;
  particleEmojis?: string[];
  particleCount?: number;
  bgGradient?: string;
  /** Field key on kiss.template_data holding an uploaded image URL.
   *  If present + non-empty, renders a polaroid instead of the emoji hero. */
  photoKey?: string;
}

export default function PlaceholderReveal({
  kiss, onClose,
  accent,
  heroEmoji,
  title,
  tagline,
  particleEmojis = ['✨'],
  particleCount = 60,
  bgGradient,
  photoKey = 'photo',
}: Props) {
  // Read the sender's uploaded photo (if any) from template_data.
  const data = parseKissData(kiss);
  const photoUrl = typeof data[photoKey] === 'string' ? (data[photoKey] as string) : '';
  const receiverName = typeof data.name === 'string' && data.name
    ? (data.name as string)
    : kiss.receiver_name;
  const particles = useMemo(
    () => Array.from({ length: particleCount }).map(() => ({
      left: Math.random() * 100,
      size: 16 + Math.random() * 20,
      delay: Math.random() * 5,
      duration: 8 + Math.random() * 6,
      emoji: particleEmojis[Math.floor(Math.random() * particleEmojis.length)],
      sway: (Math.random() - 0.5) * 40,
      rotate: (Math.random() - 0.5) * 720,
    })),
    [particleCount, particleEmojis]
  );

  return (
    <TemplateShell
      sender={{ name: kiss.sender_name, avatarUrl: kiss.sender_avatar }}
      receiver={{ name: kiss.receiver_name, avatarUrl: kiss.receiver_avatar }}
      accent={accent}
      particles={particleEmojis}
      onClose={onClose}
      backdrop={
        <div className="absolute inset-0" style={{
          background: bgGradient ?? `radial-gradient(ellipse at center, ${accent}44 0%, #0a0a12 60%, #05050a 100%)`,
        }} />
      }
    >
      <div className="absolute inset-0 overflow-hidden">
        {/* Particle rain */}
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute pointer-events-none"
            style={{ left: `${p.left}%`, top: '-10%', fontSize: p.size }}
            initial={{ y: 0, x: 0, rotate: 0, opacity: 0 }}
            animate={{ y: '115vh', x: [0, p.sway, -p.sway, 0], rotate: p.rotate, opacity: [0, 1, 1, 0] }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' }}
          >
            {p.emoji}
          </motion.div>
        ))}

        {/* Hero — sender's uploaded photo (polaroid) if provided,
             otherwise the template's default emoji. */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.15, 1], opacity: 1 }}
          transition={{ duration: 1.2, times: [0, 0.6, 1], ease: 'easeOut' }}
        >
          {photoUrl ? (
            <motion.div
              style={{
                padding: 14,
                paddingBottom: 46,
                background: '#faf8f5',
                borderRadius: 4,
                boxShadow: `0 30px 60px rgba(0,0,0,0.55), 0 0 40px ${accent}44`,
                transform: 'rotate(-4deg)',
              }}
              animate={{ rotate: [-4, -2, -6, -3, -4] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt=""
                style={{
                  width: 260, height: 260, objectFit: 'cover',
                  borderRadius: 2, display: 'block',
                }}
              />
              <div className="text-center mt-2 text-black/80" style={{ fontFamily: 'cursive', fontSize: 18 }}>
                {receiverName || 'For you'} {heroEmoji}
              </div>
            </motion.div>
          ) : (
            <motion.div
              style={{
                fontSize: 180,
                filter: `drop-shadow(0 0 30px ${accent}) drop-shadow(0 0 60px ${accent}66)`,
              }}
              animate={{ scale: [1, 1.08, 1], rotate: [0, -3, 3, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              {heroEmoji}
            </motion.div>
          )}
        </motion.div>

        {/* Title + tagline */}
        <motion.div
          className="absolute inset-x-0 top-20 flex justify-center pointer-events-none px-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="text-center">
            <div
              className="text-3xl md:text-4xl font-black tracking-tight"
              style={{
                color: '#fff',
                textShadow: `0 4px 20px ${accent}88, 0 0 40px ${accent}44`,
              }}
            >
              {title}
            </div>
            {tagline && (
              <div className="text-white/70 text-sm mt-1" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                {tagline}
              </div>
            )}
          </div>
        </motion.div>

        {/* Message + sender card */}
        {(kiss.message || kiss.sender_name) && (
          <motion.div
            className="absolute inset-x-0 bottom-24 flex justify-center pointer-events-none px-8"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="max-w-md text-center px-6 py-5 rounded-2xl backdrop-blur"
              style={{
                background: 'rgba(0,0,0,0.55)',
                border: `1px solid ${accent}66`,
                boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 40px ${accent}25`,
              }}
            >
              {kiss.sender_name && (
                <div className="text-xs uppercase tracking-widest mb-2" style={{ color: accent }}>
                  From {kiss.sender_name}
                </div>
              )}
              {kiss.message && (
                <div className="text-white text-base leading-relaxed">
                  {kiss.message}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </TemplateShell>
  );
}
