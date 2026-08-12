'use client';

// TemplateShell — wraps every reveal template so all occasions share
// the same opening moment (MeetAndHugScene), then transitions to the
// template's own custom content. This is where "step 2+ is per-
// occasion" lives: everything before is identical, everything after
// is the template's playground.
//
// Usage inside a template component:
//   <TemplateShell sender={...} receiver={...} accent="#f43f5e" onClose={onClose}>
//     ...your custom reveal content...
//   </TemplateShell>

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import MeetAndHugScene from './MeetAndHugScene';

interface Props {
  sender: { name?: string; avatarUrl?: string };
  receiver: { name?: string; avatarUrl?: string };
  /** Called when the user hits the X close button on the shell. */
  onClose: () => void;
  /** Template's accent color — tints the meet scene + close button glow. */
  accent?: string;
  /** Optional custom particle emojis for the meet burst. */
  particles?: string[];
  /** Fullscreen backdrop rendered UNDER both phases. Templates can pass
   *  their own gradient (e.g. dark rose for Valentine). */
  backdrop?: ReactNode;
  /** The template's custom reveal content, shown after the meet scene. */
  children: ReactNode;
}

export default function TemplateShell({
  sender,
  receiver,
  onClose,
  accent = '#ec4899',
  particles,
  backdrop,
  children,
}: Props) {
  const [phase, setPhase] = useState<'meet' | 'reveal'>('meet');

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden" onClick={onClose}>
      {/* Shared backdrop (template can override) */}
      {backdrop ?? (
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, #08091a 0%, #03050e 55%, #000005 100%)' }} />
      )}

      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 z-50 w-9 h-9 rounded-full bg-black/60 backdrop-blur text-white flex items-center justify-center cursor-pointer hover:bg-black/80"
        style={{ boxShadow: `0 0 12px ${accent}55` }}
      >
        <X size={18} />
      </button>

      <AnimatePresence mode="wait">
        {phase === 'meet' ? (
          <motion.div
            key="meet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex items-center justify-center px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-md">
              <MeetAndHugScene
                sender={sender}
                receiver={receiver}
                senderAccent={accent}
                particles={particles}
                onComplete={() => setPhase('reveal')}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
