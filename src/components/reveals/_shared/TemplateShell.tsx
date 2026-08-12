'use client';

// TemplateShell — wraps every reveal template with a shared fullscreen
// backdrop + close button, then renders the template's custom content
// straight away.
//
// Previously this shell played a "meet-and-hug" opening animation
// before the template took over. That intro was removed: the recipient
// already saw the delivery-vehicle intro (GiftDropIntro) inside the
// KissReplayOverlay, so gating the template behind another 3-second
// hug was redundant. Now the template's chosen visuals play instantly.
//
// Usage inside a template component:
//   <TemplateShell sender={...} receiver={...} accent="#f43f5e" onClose={onClose}>
//     ...your custom reveal content...
//   </TemplateShell>

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface Props {
  sender: { name?: string; avatarUrl?: string };
  receiver: { name?: string; avatarUrl?: string };
  /** Called when the user hits the X close button on the shell. */
  onClose: () => void;
  /** Template's accent color — tints the close button glow. */
  accent?: string;
  /** Kept for backward-compat with existing templates that pass
   *  particle emojis; ignored now that the meet-and-hug intro is gone. */
  particles?: string[];
  /** Fullscreen backdrop. Templates can pass their own gradient. */
  backdrop?: ReactNode;
  /** The template's custom reveal content. */
  children: ReactNode;
}

export default function TemplateShell({
  onClose,
  accent = '#ec4899',
  backdrop,
  children,
}: Props) {
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

      {/* Template content — plays immediately, no intro gating */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>
  );
}
