'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share2, Volume2, X } from 'lucide-react';
import { toast } from 'sonner';
import { getBirthType } from '@/lib/bond-pet';
import { speak, cancelSpeech, isTTSSupported } from '@/lib/pet-speech';

type Milestone = {
  id: string;
  label: string;
  flair?: string | null;
  babies: number;
  species: string | null;
};

type Props = {
  open: boolean;
  milestone: Milestone | null;
  syncedDays: number;
  streakTitle: string;
  /** Streak id — used to fetch a fresh pet milestone speech. */
  streakId?: string;
  /** Optional breed photo — adult portraits use this instead of emoji. */
  breedImageUrl?: string | null;
  breedLabel?: string | null;
  onClose: () => void;
};

// Pre-computed confetti positions — pure so each open doesn't churn DOM.
const CONFETTI = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: (i * 137) % 100,
  delay: (i % 12) * 0.08,
  rotate: ((i * 53) % 360) - 180,
  emoji: ['🎉', '🎊', '💕', '✨', '⭐', '💖'][i % 6],
}));

/** Full-screen celebration when a couple hits a Bond Pet milestone.
 *  Renders confetti, the family snapshot, and a Share button that uses
 *  html2canvas to turn the card into an IG-ready image. */
export function AnniversaryOverlay({
  open,
  milestone,
  syncedDays,
  streakTitle,
  streakId,
  breedImageUrl,
  breedLabel,
  onClose,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [petSpeech, setPetSpeech] = useState<string | null>(null);
  const triedSpeech = useRef(false);

  // Fetch the pet's heartfelt milestone speech once when the overlay
  // opens. Tick endpoint already kicks off a 'milestone' diary gen, so
  // this is a redundant safety net that runs if the AI was slow or the
  // diary doesn't yet have a milestone entry.
  useEffect(() => {
    if (!open || !streakId || !milestone || triedSpeech.current) return;
    triedSpeech.current = true;
    fetch(`/api/v1/streaks/${streakId}/pet-voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        purpose: 'milestone',
        milestone_label: milestone.label,
      }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { data: { line: string } }) => setPetSpeech(j.data.line))
      .catch(() => { /* silent */ });
  }, [open, streakId, milestone]);

  // Reset speech state on close so the next milestone re-fetches.
  useEffect(() => {
    if (!open) {
      triedSpeech.current = false;
      setPetSpeech(null);
      cancelSpeech();
    }
  }, [open]);

  // Auto-speak the milestone line as soon as it lands. Speech persists
  // until the user closes the overlay (cleanup above).
  useEffect(() => {
    if (!open || !petSpeech) return;
    if (!isTTSSupported()) return;
    speak(petSpeech, { speciesEmoji: milestone?.species ?? null });
  }, [open, petSpeech, milestone]);

  // Lock background scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function shareCard() {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      // Dynamic import — html2canvas is heavy and only needed on share.
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
      });
      const dataUrl = canvas.toDataURL('image/png');

      // Try Web Share API first (mobile), else fall back to download.
      if (navigator.share && canvas.toBlob) {
        canvas.toBlob(async blob => {
          if (!blob) return;
          const file = new File([blob], 'gao-bond-milestone.png', { type: 'image/png' });
          try {
            await navigator.share({
              files: [file],
              title: `${syncedDays} days together`,
              text: `${milestone?.label} on Gao Streaks ✨`,
            });
          } catch {
            // user cancelled — fallthrough
          }
        });
      } else {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `gao-bond-${syncedDays}d.png`;
        a.click();
        toast.success('Image downloaded');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Share failed');
    } finally {
      setSharing(false);
    }
  }

  if (!open || !milestone) return null;
  if (typeof document === 'undefined') return null;

  const birthType = getBirthType(milestone.species);
  // Re-label birth/hatch milestones for mammals — "egg" stage is really
  // "newborn" in their narrative.
  const titleOverride = (() => {
    if (birthType !== 'live') return milestone.label;
    if (milestone.id === 'egg') return 'A newborn has arrived';
    if (milestone.id === 'baby') return 'Look at those tiny paws';
    return milestone.label;
  })();
  const species = milestone.species ?? '🥚';

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-400 flex items-center justify-center p-4"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(236,72,153,0.25), transparent 60%), radial-gradient(ellipse at bottom, rgba(168,85,247,0.2), transparent 70%), #05060a',
        }}
      >
        {/* Confetti background — purely cosmetic, sits behind the card */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {CONFETTI.map(c => (
            <motion.div
              key={c.id}
              className="absolute top-0 text-2xl"
              style={{ left: `${c.x}%` }}
              initial={{ y: -50, opacity: 0, rotate: c.rotate }}
              animate={{ y: '110vh', opacity: [0, 1, 1, 0], rotate: c.rotate + 360 }}
              transition={{
                duration: 4.5,
                delay: c.delay,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              {c.emoji}
            </motion.div>
          ))}
        </div>

        {/* Close button — top-right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-9 w-9 rounded-full flex items-center justify-center cursor-pointer z-10 backdrop-blur-md"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <X size={18} className="text-white" />
        </button>

        {/* Shareable card */}
        <motion.div
          ref={cardRef}
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 220 }}
          className="relative rounded-3xl p-8 lg:p-10 w-full max-w-md text-center"
          style={{
            background:
              'linear-gradient(135deg, #1a0b14 0%, #2a0f1f 50%, #1a0a2a 100%)',
            border: '1px solid rgba(236,72,153,0.4)',
            boxShadow:
              '0 30px 80px -20px rgba(236,72,153,0.4), 0 0 0 1px rgba(255,255,255,0.04) inset',
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#ec4899] mb-4 font-bold">
            ✨ Milestone unlocked ✨
          </div>

          {/* Big family display — uses breed portrait for adults if available */}
          <div className="flex items-end justify-center gap-2 mb-6">
            {breedImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={breedImageUrl}
                alt={breedLabel ?? 'pet'}
                className="rounded-full object-cover"
                style={{
                  width: 88,
                  height: 88,
                  border: '3px solid rgba(236,72,153,0.5)',
                  boxShadow: '0 4px 18px -4px rgba(236,72,153,0.4)',
                }}
              />
            ) : (
              <span className="text-7xl">{species}</span>
            )}
            {milestone.flair === '💍' && milestone.babies === 0 ? (
              <span className="text-4xl mb-2">💍</span>
            ) : null}
            {breedImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={breedImageUrl}
                alt={breedLabel ?? 'pet'}
                className="rounded-full object-cover"
                style={{
                  width: 88,
                  height: 88,
                  border: '3px solid rgba(236,72,153,0.5)',
                  boxShadow: '0 4px 18px -4px rgba(236,72,153,0.4)',
                }}
              />
            ) : (
              <span className="text-7xl">{species}</span>
            )}
            {Array.from({ length: milestone.babies }).map((_, i) => (
              <span key={i} className="text-4xl mb-1">{species}</span>
            ))}
            {milestone.flair === '🏠' && <span className="text-4xl mb-1">🏠</span>}
            {milestone.flair === '✨' && <span className="text-4xl mb-1">✨</span>}
          </div>

          <h2 className="text-2xl lg:text-3xl font-bold text-white mb-2">
            {titleOverride}
          </h2>
          <p className="text-sm text-[#a3adc3] mb-1">on &ldquo;{streakTitle}&rdquo;</p>
          {petSpeech && (
            <div
              className="text-sm italic mt-3 px-3 py-2 rounded-xl mx-auto max-w-xs relative"
              style={{
                background: 'rgba(236,72,153,0.06)',
                border: '1px solid rgba(236,72,153,0.2)',
                color: '#fce7f3',
              }}
            >
              <span>&ldquo;{petSpeech}&rdquo;</span>
              <span className="block text-[10px] text-[#a3adc3] not-italic mt-1">
                — {breedLabel ?? milestone.species ?? 'your pet'}
              </span>
              {isTTSSupported() && (
                <button
                  type="button"
                  onClick={() =>
                    speak(petSpeech, { speciesEmoji: milestone.species ?? null })
                  }
                  className="absolute -top-2 -right-2 h-7 w-7 rounded-full flex items-center justify-center cursor-pointer"
                  style={{
                    background: '#ec4899',
                    color: 'white',
                    boxShadow: '0 4px 14px -4px rgba(236,72,153,0.6)',
                  }}
                  title="Replay"
                  aria-label="Replay the pet's speech"
                >
                  <Volume2 size={12} />
                </button>
              )}
            </div>
          )}
          <div className="text-5xl font-black text-transparent bg-clip-text mt-4 mb-1"
            style={{ backgroundImage: 'linear-gradient(135deg, #ec4899, #a855f7, #00d4ff)' }}
          >
            {syncedDays}
          </div>
          <div className="text-xs uppercase tracking-widest text-[#4a5068]">
            days together
          </div>

          <div className="mt-6 text-[10px] text-[#4a5068]">
            via Gao Social
          </div>
        </motion.div>

        {/* Share + Continue buttons */}
        <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-3 px-4">
          <button
            onClick={shareCard}
            disabled={sharing}
            className="flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold cursor-pointer disabled:opacity-40 backdrop-blur-md"
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            {sharing ? <Download size={16} /> : <Share2 size={16} />}
            {sharing ? 'Saving...' : 'Share'}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #ec4899, #a855f7)',
              color: '#0a0b0f',
              boxShadow: '0 8px 25px -8px rgba(236,72,153,0.5)',
            }}
          >
            💕 Continue
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
