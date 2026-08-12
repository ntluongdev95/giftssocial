'use client';

// Birthday Journey — birthday reveal reusing the ORIGINAL Time-Sealed
// Gao Gifts BirthdayDroneShow (the DOM-based drone swarm that morphs
// through: HAPPY BIRTHDAY {name} → cake → heart → couple → princess &
// champagne pour → back to lock, ~23s total).
//
// The recipient sees the full drone show then a message card carrying
// the sender's note fades in on top.

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { TemplateProps, TemplateConfig } from '../_types';
import { getKissString } from '../_shared/useTemplateData';

// Heavy — pull it out of the main bundle. ssr:false because the show
// uses `window.innerWidth`, canvas trails, and framer-motion transforms
// that only make sense on the client.
const BirthdayDroneShow = dynamic(
  () => import('@/components/capsules/CapsuleRevealOverlay').then(m => m.BirthdayDroneShow),
  { ssr: false },
);

const ACCENT = '#f97316';
// Total drone-show length (see the morph state machine inside
// BirthdayDroneShow — launch + heart + couple + princess/pour + lock).
const SHOW_DURATION_MS = 23_000;

function BdayJourneyReveal({ kiss, onClose }: TemplateProps) {
  const [phase, setPhase] = useState<'show' | 'message'>('show');

  // Recipient name: sender-filled field wins over the receiver's display_name.
  const recipientName = (getKissString(kiss, 'name') || kiss.receiver_name || '').trim();

  // Auto-advance to the message card once the drone show finishes.
  useEffect(() => {
    if (phase !== 'show') return;
    const t = setTimeout(() => setPhase('message'), SHOW_DURATION_MS);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden" onClick={onClose}>
      {/* Deep night backdrop so the drones read cleanly */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at center, #08091a 0%, #03050e 55%, #000005 100%)',
      }} />

      {/* Close button — always available */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 z-[210] w-9 h-9 rounded-full bg-black/60 backdrop-blur text-white flex items-center justify-center cursor-pointer hover:bg-black/80"
        style={{ boxShadow: `0 0 12px ${ACCENT}66` }}
      >
        <X size={18} />
      </button>

      {/* Skip → jump straight to the message card */}
      {phase === 'show' && (
        <button
          onClick={(e) => { e.stopPropagation(); setPhase('message'); }}
          className="absolute bottom-6 right-6 z-[210] rounded-full px-3.5 py-1.5 text-[11px] font-semibold text-white/70 hover:text-white cursor-pointer backdrop-blur"
          style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          Skip →
        </button>
      )}

      {phase === 'show' && (
        <div onClick={(e) => e.stopPropagation()}>
          {/* delay=0 — the show starts as soon as the reveal opens. */}
          <BirthdayDroneShow delay={0} name={recipientName} />
        </div>
      )}

      <AnimatePresence>
        {phase === 'message' && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="relative max-w-lg text-center px-8 py-8 rounded-3xl backdrop-blur"
              initial={{ scale: 0.85, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                border: `1px solid ${ACCENT}55`,
                boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 60px ${ACCENT}33`,
              }}
            >
              <div className="text-5xl mb-3" style={{ filter: `drop-shadow(0 0 20px ${ACCENT})` }}>🎂</div>
              <div className="text-[10px] uppercase tracking-widest mb-3" style={{ color: ACCENT }}>
                {kiss.sender_name ? `From ${kiss.sender_name}` : 'A birthday message'}
              </div>
              {kiss.message ? (
                <div className="text-white text-lg leading-relaxed whitespace-pre-wrap">
                  {kiss.message}
                </div>
              ) : (
                <div className="text-white/70 text-base italic">
                  Happy birthday{recipientName ? `, ${recipientName}` : ''} — wishing you a beautiful year.
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BdayJourneyReveal;

export const BdayJourneyConfig: TemplateConfig = {
  id: 'bday-journey',
  name: 'Birthday Journey',
  occasionIds: ['birthday'],
  emoji: '✨',
  description: 'The Time-Sealed birthday drone show — HAPPY BIRTHDAY greeting, cake, heart, couple, and the champagne pour — ending in your personal message.',
  thumbnailBg: 'linear-gradient(135deg, #fef3c7, #f97316, #dc2626)',
  Component: BdayJourneyReveal,
};
