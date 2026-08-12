'use client';

// SenderSignature — reusable identity block for reveal templates.
// Renders the sender's avatar inside a themed frame + a wax seal with
// their initial + the sender's name. Every template should surface this
// so the reveal feels like a piece of the sender, not a generic card.

import { motion } from 'framer-motion';

interface Props {
  name: string;
  avatarUrl?: string;
  /** Frame shape — "heart" for love-themed, "round" for neutral. */
  shape?: 'heart' | 'round';
  /** Accent color — hex, used for the frame stroke + wax seal. */
  accent?: string;
  /** Size in px (avatar diameter). Wax seal scales relative. */
  size?: number;
  /** Optional caption under the name ("Sent with love", occasion label). */
  caption?: string;
}

export default function SenderSignature({
  name,
  avatarUrl,
  shape = 'round',
  accent = '#ec4899',
  size = 72,
  caption,
}: Props) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const sealSize = Math.round(size * 0.42);

  return (
    <motion.div
      initial={{ scale: 0, rotate: -12 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.4 }}
      className="relative flex flex-col items-center"
    >
      {/* Avatar frame */}
      <div className="relative" style={{ width: size, height: size }}>
        {shape === 'heart' ? (
          // Heart-shaped clip
          <svg viewBox="0 0 100 90" className="absolute inset-0 w-full h-full" style={{ filter: `drop-shadow(0 6px 16px ${accent}55)` }}>
            <defs>
              <clipPath id={`heart-clip-${name}`}>
                <path d="M50 20 C 36 4, 8 8, 8 32 C 8 60, 50 85, 50 85 C 50 85, 92 60, 92 32 C 92 8, 64 4, 50 20 Z" />
              </clipPath>
            </defs>
            <path
              d="M50 20 C 36 4, 8 8, 8 32 C 8 60, 50 85, 50 85 C 50 85, 92 60, 92 32 C 92 8, 64 4, 50 20 Z"
              fill={accent}
              stroke="#fff" strokeWidth="2"
            />
            {avatarUrl ? (
              <image href={avatarUrl} x="8" y="8" width="84" height="74" preserveAspectRatio="xMidYMid slice" clipPath={`url(#heart-clip-${name})`} />
            ) : (
              <text x="50" y="52" textAnchor="middle" fill="#fff" fontSize="32" fontWeight="700">{initial}</text>
            )}
          </svg>
        ) : (
          <div
            className="w-full h-full rounded-full overflow-hidden flex items-center justify-center font-bold text-white"
            style={{ background: accent, border: `3px solid #fff`, boxShadow: `0 6px 16px ${accent}55`, fontSize: size * 0.42 }}
          >
            {avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
              : initial}
          </div>
        )}

        {/* Wax seal — sender's initial as a stamp in the corner */}
        <div
          className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center font-bold text-white"
          style={{
            width: sealSize, height: sealSize,
            background: `radial-gradient(circle at 30% 30%, ${accent}dd, ${accent} 60%, ${accent}88)`,
            boxShadow: `0 3px 8px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 3px rgba(255,255,255,0.3)`,
            border: `1.5px solid ${accent}`,
            fontSize: sealSize * 0.5,
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
          }}
        >
          {initial}
        </div>
      </div>

      {/* Sender name — bold, larger */}
      <div className="mt-3 text-center">
        <div className="text-[9px] uppercase tracking-[0.3em] font-bold" style={{ color: `${accent}` }}>From</div>
        <div className="text-lg font-bold text-white mt-0.5" style={{ fontFamily: 'Georgia, serif' }}>{name}</div>
        {caption && <div className="text-[10px] text-white/60 italic mt-0.5">{caption}</div>}
      </div>
    </motion.div>
  );
}
