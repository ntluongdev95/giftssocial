'use client';

// PolaroidStack — reusable photo stack styled as tilted polaroid cards.
// Templates use this to render the sender's attached photos so they
// feel like keepsakes tucked inside the letter rather than API thumbnails.

import { motion } from 'framer-motion';

interface Props {
  photos: string[];
  /** Delay in seconds before the stack fades in. */
  delay?: number;
  /** Caption written under each photo — sender's name works well. */
  caption?: string;
}

export default function PolaroidStack({ photos, delay = 2.4, caption }: Props) {
  if (photos.length === 0) return null;

  // Alternating tilt so the stack looks hand-arranged
  const tilts = [-6, 4, -3, 5, -4];

  return (
    <div className="mt-3 flex items-end justify-center gap-3">
      {photos.slice(0, 3).map((p, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20, rotate: 0 }}
          animate={{ opacity: 1, y: 0, rotate: tilts[i] ?? 0 }}
          transition={{ delay: delay + i * 0.12, type: 'spring', damping: 14 }}
          className="bg-white p-2 pb-6 shadow-lg relative"
          style={{
            transformOrigin: 'center bottom',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.25)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p} alt="" className="w-20 h-20 object-cover" style={{ display: 'block' }} />
          {caption && (
            <div className="absolute bottom-1 left-0 right-0 text-center text-[8px] text-slate-700 italic" style={{ fontFamily: '"Bradley Hand", "Segoe Script", cursive' }}>
              {caption}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
