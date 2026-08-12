'use client';

// HandwrittenNote — reusable message card in a handwriting-style font.
// Templates use this to render the sender's message so it feels
// personally written rather than typed into a form. Ends with an
// automatic "— Name" signature.

import { motion } from 'framer-motion';

interface Props {
  message: string;
  senderName: string;
  /** Accent color — hex, used for the signature underline + border. */
  accent?: string;
  /** Sign-off phrase before the name ("Yours,", "Love,", "— From "). */
  signOff?: string;
  /** Delay in seconds before the note fades in. */
  delay?: number;
}

export default function HandwrittenNote({
  message,
  senderName,
  accent = '#ec4899',
  signOff = 'Yours',
  delay = 2.1,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6 }}
      className="w-full max-w-sm px-5 py-4 rounded-2xl relative"
      style={{
        background: 'rgba(255,252,240,0.06)',
        border: `1px solid ${accent}33`,
        backdropFilter: 'blur(6px)',
      }}
    >
      {/* Quotation marks decoration */}
      <div className="absolute -top-2 left-3 text-5xl leading-none opacity-30 select-none" style={{ color: accent, fontFamily: 'Georgia, serif' }}>&ldquo;</div>

      <p
        className="text-base leading-relaxed whitespace-pre-wrap text-white/95 pt-2 pl-2"
        style={{
          fontFamily: '"Snell Roundhand", "Segoe Script", "Bradley Hand", "Comic Sans MS", cursive',
          fontStyle: 'italic',
        }}
      >
        {message}
      </p>

      {/* Signature line + name */}
      <div className="mt-4 flex flex-col items-end">
        <div className="w-24 h-px opacity-40 mb-2" style={{ background: `linear-gradient(to right, transparent, ${accent})` }} />
        <div
          className="text-lg text-white leading-tight"
          style={{
            fontFamily: '"Snell Roundhand", "Segoe Script", "Bradley Hand", cursive',
            fontStyle: 'italic',
            color: accent,
          }}
        >
          — {signOff}, {senderName}
        </div>
      </div>
    </motion.div>
  );
}
