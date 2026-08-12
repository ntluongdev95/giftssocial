'use client';

// RoseRain reveal — Valentine's flagship template.
//
// Uses TemplateShell so the opening moment (sender & receiver meet + hug)
// is shared with every other template. Only the content BELOW is unique:
//   • Dark romantic rose gradient backdrop with 32 falling rose petals
//   • SenderSignature at the top — big heart-framed avatar + wax seal
//   • HandwrittenNote — message in a cursive font, signed "— Yours, [Name]"
//   • PolaroidStack — attached photos as tilted keepsakes

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { TemplateProps } from '../_types';
import TemplateShell from '../_shared/TemplateShell';
import SenderSignature from '../_shared/SenderSignature';
import HandwrittenNote from '../_shared/HandwrittenNote';
import PolaroidStack from '../_shared/PolaroidStack';

const PETAL_COUNT = 32;
const ACCENT = '#f43f5e'; // rose-500

export default function RoseRainReveal({ kiss, currentUserId, onClose, onSendBack }: TemplateProps) {
  const senderName = kiss.sender_name || 'Someone';
  const receiverName = currentUserId === kiss.receiver_id ? 'You' : (kiss.receiver_name || 'Recipient');
  const canSendBack = currentUserId === kiss.receiver_id && !!onSendBack;

  const photos: string[] = useMemo(() => {
    try { return kiss.photos ? JSON.parse(kiss.photos) : []; } catch { return []; }
  }, [kiss.photos]);

  // Stable per-mount seed so petals don't reshuffle every render.
  const petals = useMemo(() => Array.from({ length: PETAL_COUNT }, (_, i) => ({
    left: `${(i * 37 + 11) % 100}%`,
    delay: (i * 0.13) % 3,
    duration: 5 + ((i * 7) % 8) * 0.5,
    drift: ((i * 17) % 200) - 100,
    size: 20 + ((i * 5) % 24),
    rot: ((i * 41) % 720) - 360,
  })), []);

  return (
    <TemplateShell
      sender={{ name: senderName, avatarUrl: kiss.sender_avatar }}
      receiver={{ name: receiverName, avatarUrl: kiss.receiver_avatar }}
      onClose={onClose}
      accent={ACCENT}
      particles={['💕', '🌹', '❤️', '✨']}
      backdrop={
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, #4c0519 0%, #1e0a13 55%, #000 100%)' }} />
      }
    >
      {/* Falling rose petals — full-screen behind the letter */}
      {petals.map((p, i) => (
        <motion.span
          key={i}
          className="absolute pointer-events-none select-none"
          style={{ left: p.left, top: `-${p.size}px`, fontSize: p.size }}
          initial={{ y: 0, x: 0, rotate: 0, opacity: 0 }}
          animate={{ y: '110vh', x: p.drift, rotate: p.rot, opacity: [0, 1, 1, 0.85, 0] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, repeatDelay: 0.3, ease: 'linear' }}
        >
          🌹
        </motion.span>
      ))}

      {/* Music player (top-left, small — right slot reserved for close button) */}
      {kiss.music_url && (
        <div className="absolute top-4 left-4 z-40 rounded-full px-3 py-1.5 flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${ACCENT}55`, backdropFilter: 'blur(8px)' }}>
          <span className="text-sm">🎵</span>
          <span className="text-[10px] font-bold text-white truncate max-w-[160px]">{kiss.music_title || 'Playing'}</span>
          <audio src={kiss.music_url} autoPlay loop className="hidden" />
        </div>
      )}

      {/* Center letter card */}
      <div className="absolute inset-0 flex items-center justify-center px-6 py-12 overflow-y-auto">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, rotateX: -12 }}
          animate={{ scale: 1, opacity: 1, rotateX: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md rounded-2xl overflow-visible pointer-events-auto my-auto"
          style={{
            background: 'linear-gradient(180deg, rgba(30,15,20,0.92) 0%, rgba(15,8,12,0.95) 100%)',
            border: `1px solid ${ACCENT}55`,
            boxShadow: `0 20px 80px ${ACCENT}55, 0 0 40px rgba(244,63,94,0.25)`,
            backdropFilter: 'blur(20px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top accent bar */}
          <div className="h-1 w-full rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${ACCENT}, #ec4899, ${ACCENT})` }} />

          <div className="p-6 flex flex-col items-center text-center">
            {/* SENDER SIGNATURE — big personal branding at the top */}
            <SenderSignature
              name={senderName}
              avatarUrl={kiss.sender_avatar}
              shape="heart"
              accent={ACCENT}
              size={88}
              caption="sent with love 💕"
            />

            {/* Envelope label */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.5 }}
              className="mt-5 text-[9px] uppercase tracking-[0.4em] font-bold"
              style={{ color: ACCENT }}
            >
              — A love letter —
            </motion.div>

            {/* HANDWRITTEN MESSAGE — feels personal, cursive font, signed */}
            {kiss.message && (
              <div className="w-full mt-3">
                <HandwrittenNote
                  message={kiss.message}
                  senderName={senderName}
                  accent={ACCENT}
                  signOff="Yours"
                  delay={1.4}
                />
              </div>
            )}

            {/* POLAROID PHOTOS — sender's photos as keepsakes */}
            <PolaroidStack photos={photos} delay={1.7} caption={senderName} />

            {/* Open counter */}
            {typeof kiss.open_count === 'number' && typeof kiss.max_opens === 'number' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.0, duration: 0.4 }}
                className="mt-4 flex items-center gap-1.5 text-[9px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${ACCENT}25`, color: '#fda4af', border: `1px solid ${ACCENT}55` }}
              >
                <span>💝</span>
                <span>Opened {kiss.open_count} / {kiss.max_opens} times</span>
              </motion.div>
            )}

            {/* CTA row */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.2, duration: 0.5 }}
              className="mt-6 flex items-center gap-2"
            >
              {canSendBack && onSendBack ? (
                <button
                  onClick={() => { onSendBack(kiss.sender_id); onClose(); }}
                  className="rounded-xl px-6 py-3 text-sm font-bold cursor-pointer transition-transform active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${ACCENT}, #ec4899)`, color: '#fff', boxShadow: `0 4px 20px ${ACCENT}66` }}
                >
                  💋 Send Back
                </button>
              ) : (
                <button onClick={onClose} className="rounded-xl px-6 py-3 text-sm font-semibold cursor-pointer" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}>
                  Close
                </button>
              )}
            </motion.div>
          </div>

          {/* Bottom foil — sender's wax mark repeats as a maker's mark */}
          <div className="border-t px-6 py-3 flex items-center justify-between" style={{ borderColor: `${ACCENT}22` }}>
            <div className="text-[8px] uppercase tracking-widest text-white/40">Delivered via Gao</div>
            <div className="text-[9px] italic font-bold" style={{ color: ACCENT, fontFamily: 'Georgia, serif' }}>— {senderName}</div>
          </div>
        </motion.div>
      </div>
    </TemplateShell>
  );
}
