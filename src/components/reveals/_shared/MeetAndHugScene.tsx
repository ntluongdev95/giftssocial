'use client';

// MeetAndHugScene — the shared "two people meet & hug" scene shown at
// the START of every reveal, before the template's custom content
// takes over. Extracted from the original KissRevealPopup so all
// templates get the same delivery moment.
//
// Sender chibi runs in from the left with avatar + stick figure.
// Receiver chibi waits on the right with idle bob.
// They meet ~3 s in; sparkle burst; onComplete fires when done.

import { motion } from 'framer-motion';
import { useEffect } from 'react';

const DURATION_S = 3.4; // total scene length

interface Props {
  sender: { name?: string; avatarUrl?: string };
  receiver: { name?: string; avatarUrl?: string };
  /** Called when the scene finishes so the parent can advance to the reveal. */
  onComplete?: () => void;
  /** Optional accent color for the sender chibi (default pink). */
  senderAccent?: string;
  /** Optional accent color for the receiver chibi (default cyan). */
  receiverAccent?: string;
  /** Particle emojis used in the meet-burst (default hearts). */
  particles?: string[];
}

export default function MeetAndHugScene({
  sender,
  receiver,
  onComplete,
  senderAccent = '#ec4899',
  receiverAccent = '#00d4ff',
  particles = ['💕', '❤️', '💗', '✨'],
}: Props) {
  const senderInitial = (sender.name || '?').charAt(0).toUpperCase();
  const receiverInitial = (receiver.name || '?').charAt(0).toUpperCase();

  useEffect(() => {
    if (!onComplete) return;
    const t = setTimeout(onComplete, DURATION_S * 1000);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div className="relative w-full h-48 flex items-end justify-center overflow-hidden">
      {/* Ground line */}
      <div className="absolute bottom-6 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${senderAccent}33 30%, ${receiverAccent}33 70%, transparent)` }} />

      {/* Quote flash */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0] }}
        transition={{ duration: 3, times: [0, 0.1, 0.25, 0.75, 1], ease: 'easeInOut' }}
        className="absolute top-0 left-0 right-0 text-center text-[10px] italic text-white/40 pointer-events-none"
      >
        distance means nothing when someone means everything
      </motion.p>

      {/* ── Sender chibi — runs from far left to receiver ── */}
      <motion.div
        initial={{ x: -130 }}
        animate={{ x: [-130, -40, 30, 65] }}
        transition={{ duration: 3, ease: 'easeOut', times: [0, 0.4, 0.8, 1] }}
        className="absolute bottom-6 z-10 flex flex-col items-center"
      >
        <motion.div
          animate={{ y: [0, -6, 0, -6, 0, -3, 0, 0] }}
          transition={{ duration: 2.8, ease: 'easeInOut', times: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1] }}
          className="flex flex-col items-center"
        >
          <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold"
            style={{ background: `${senderAccent}22`, border: `2.5px solid ${senderAccent}`, color: senderAccent, boxShadow: `0 0 15px ${senderAccent}55` }}>
            {sender.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={sender.avatarUrl} alt="" className="w-full h-full object-cover" />
              : senderInitial}
          </div>
          <svg width="32" height="36" viewBox="0 0 32 36" className="-mt-1">
            <line x1="16" y1="2" x2="16" y2="18" stroke={senderAccent} strokeWidth="2.5" strokeLinecap="round" />
            <motion.line x1="16" y1="8" x2="6" y2="4" stroke={senderAccent} strokeWidth="2" strokeLinecap="round"
              animate={{ x2: [6, 4, 6, 4, 2], y2: [4, 12, 4, 12, 2] }}
              transition={{ duration: 2.8, times: [0, 0.15, 0.3, 0.7, 1] }} />
            <motion.line x1="16" y1="8" x2="26" y2="12" stroke={senderAccent} strokeWidth="2" strokeLinecap="round"
              animate={{ x2: [26, 28, 26, 28, 30], y2: [12, 4, 12, 4, 2] }}
              transition={{ duration: 2.8, times: [0, 0.15, 0.3, 0.7, 1] }} />
            <motion.line x1="16" y1="18" x2="10" y2="34" stroke={senderAccent} strokeWidth="2" strokeLinecap="round"
              animate={{ x2: [10, 20, 10, 20, 12] }}
              transition={{ duration: 2.8, times: [0, 0.15, 0.3, 0.7, 1] }} />
            <motion.line x1="16" y1="18" x2="22" y2="34" stroke={senderAccent} strokeWidth="2" strokeLinecap="round"
              animate={{ x2: [22, 12, 22, 12, 20] }}
              transition={{ duration: 2.8, times: [0, 0.15, 0.3, 0.7, 1] }} />
          </svg>
        </motion.div>
        <span className="text-[8px] font-semibold mt-1" style={{ color: senderAccent }}>{sender.name || 'Sender'}</span>
      </motion.div>

      {/* ── Receiver chibi — stands still, waiting ── */}
      <motion.div
        initial={{ x: 80, opacity: 0 }}
        animate={{ x: 80, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="absolute bottom-6 z-10 flex flex-col items-center"
      >
        <motion.div
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="flex flex-col items-center"
        >
          <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold"
            style={{ background: `${receiverAccent}22`, border: `2.5px solid ${receiverAccent}`, color: receiverAccent, boxShadow: `0 0 15px ${receiverAccent}55` }}>
            {receiver.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={receiver.avatarUrl} alt="" className="w-full h-full object-cover" />
              : receiverInitial}
          </div>
          <svg width="32" height="36" viewBox="0 0 32 36" className="-mt-1" style={{ transform: 'scaleX(-1)' }}>
            <line x1="16" y1="2" x2="16" y2="18" stroke={receiverAccent} strokeWidth="2.5" strokeLinecap="round" />
            <motion.line x1="16" y1="8" x2="6" y2="14" stroke={receiverAccent} strokeWidth="2" strokeLinecap="round"
              animate={{ x2: [6, 6, 6, 2], y2: [14, 14, 14, 3] }}
              transition={{ duration: 3, times: [0, 0.7, 0.85, 1], ease: 'easeOut' }} />
            <motion.line x1="16" y1="8" x2="26" y2="14" stroke={receiverAccent} strokeWidth="2" strokeLinecap="round"
              animate={{ x2: [26, 26, 26, 30], y2: [14, 14, 14, 3] }}
              transition={{ duration: 3, times: [0, 0.7, 0.85, 1], ease: 'easeOut' }} />
            <line x1="16" y1="18" x2="11" y2="34" stroke={receiverAccent} strokeWidth="2" strokeLinecap="round" />
            <line x1="16" y1="18" x2="21" y2="34" stroke={receiverAccent} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </motion.div>
        <span className="text-[8px] font-semibold mt-1" style={{ color: receiverAccent }}>{receiver.name || 'You'}</span>
      </motion.div>

      {/* ── Glow when they meet ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0, 0.8, 0.4], scale: [0, 0, 1.5, 2] }}
        transition={{ duration: 3.5, times: [0, 0.7, 0.85, 1], ease: 'easeOut' }}
        className="absolute w-24 h-24 rounded-full"
        style={{ bottom: '3rem', right: '20%', background: `radial-gradient(circle, ${senderAccent}88, ${receiverAccent}55, transparent 70%)` }}
      />

      {/* Particle burst when they meet */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        return (
          <motion.span key={`hug-${i}`}
            className="absolute text-lg pointer-events-none z-30"
            style={{ bottom: '5rem', right: '25%' }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], x: [0, Math.cos(angle) * 80], y: [0, Math.sin(angle) * 80 - 20], scale: [0, 1.2, 0] }}
            transition={{ delay: 2.9 + i * 0.04, duration: 1.2, ease: 'easeOut' }}
          >{particles[i % particles.length]}</motion.span>
        );
      })}
    </div>
  );
}
