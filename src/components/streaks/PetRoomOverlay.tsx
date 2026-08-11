'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { PetStage } from './PetStage';
import { PetCarePanel } from './PetCarePanel';
import { PetCharacter, type PetActionType } from './PetCharacter';
import { cancelSpeech } from '@/lib/pet-speech';

type Props = {
  open: boolean;
  onClose: () => void;
  streakId: string;
  streakTitle: string;
  speciesEmoji?: string | null;
  breedImageUrl?: string | null;
  breedLabel?: string | null;
  birthType: 'live' | 'egg';
  /** Live MP4 (Stable Video Diffusion) — takes priority over photo/cartoon. */
  videoUrl?: string | null;
  petName?: string | null;
  /** Greeting bubble — typically <PetGreeting /> from the parent. */
  greeting?: ReactNode;
  initialHappiness: number;
  initialEnergy: number;
  initialBond: number;
  initialLastAt: {
    pet: string | null;
    feed: string | null;
    play: string | null;
    walk: string | null;
  };
};

/** Fullscreen "pet room" — a calmer, larger version of the inline pet
 *  stage. Designed to feel like opening a Tamagotchi: floor, sky, the
 *  pet front-and-center, with care actions tucked at the bottom. */
export function PetRoomOverlay({
  open,
  onClose,
  streakId,
  streakTitle,
  speciesEmoji,
  breedImageUrl,
  breedLabel,
  birthType,
  videoUrl,
  petName,
  greeting,
  initialHappiness,
  initialEnergy,
  initialBond,
  initialLastAt,
}: Props) {
  // Local action trigger state — overlays have their own scope so taps
  // and care actions inside the room only animate the room's character.
  const [actionTick, setActionTick] = useState(0);
  const [lastAction, setLastAction] = useState<PetActionType | null>(null);
  function fire(action: PetActionType) {
    setLastAction(action);
    setActionTick(n => n + 1);
  }
  // Lock background scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      cancelSpeech();
    };
  }, [open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-300 flex flex-col"
          style={{ background: '#05060a' }}
        >
          {/* Top bar */}
          <header className="flex items-center justify-between px-4 py-3 shrink-0">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-[#4a5068] font-bold">
                Pet room
              </div>
              <h2 className="text-base font-bold text-white truncate">
                {petName ?? speciesEmoji ?? 'Pet'} — {streakTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 rounded-full flex items-center justify-center cursor-pointer backdrop-blur-md shrink-0"
              style={{ background: 'rgba(255,255,255,0.08)' }}
              aria-label="Close pet room"
            >
              <X size={18} className="text-white" />
            </button>
          </header>

          {/* Pet stage — fills the remaining space. Bigger sizing than
              the inline stage so the pet feels properly "in-room". */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            {greeting}
            <PetStage
              speciesEmoji={speciesEmoji}
              insideOverlay
              onTap={() => fire('tap')}
            >
              <div
                className="flex items-end justify-center"
                style={{ paddingTop: 60, paddingBottom: 100 }}
              >
                {speciesEmoji ? (
                  <PetCharacter
                    speciesEmoji={speciesEmoji}
                    breedImageUrl={breedImageUrl ?? null}
                    breedLabel={breedLabel ?? null}
                    birthType={birthType}
                    actionTrigger={actionTick}
                    lastAction={lastAction}
                    size={320}
                    videoUrl={videoUrl ?? null}
                  />
                ) : (
                  <div className="text-9xl">💕</div>
                )}
              </div>
            </PetStage>

            <PetCarePanel
              streakId={streakId}
              speciesEmoji={speciesEmoji}
              initialHappiness={initialHappiness}
              initialEnergy={initialEnergy}
              initialBond={initialBond}
              initialLastAt={initialLastAt}
              onReaction={(_, __, action) => fire(action)}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
