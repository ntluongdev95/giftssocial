'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BOND_SPECIES } from '@/lib/bond-pet';

export type Breed = {
  id: string;
  label: string;
  image_url: string;
  personality?: string;
};

type Props = {
  open: boolean;
  speciesEmoji: string | null;
  /** Currently-selected breed id (for showing checkmark on re-open). */
  currentBreedId: string | null;
  onClose: () => void;
  onPick: (breed: Breed) => void;
};

/** Opens after the user taps a species. Fetches real breed photos:
 *   • 🐕 → Dog CEO API (via /api/v1/bond-breeds/🐕)
 *   • 🐈 → The Cat API (via /api/v1/bond-breeds/🐈)
 *   • everything else → curated catalog
 *
 *  Photos shown in the grid are EXACTLY what gets saved when the user
 *  picks — no re-randomisation. So the family card shows the same dog
 *  the user fell in love with at adoption time. */
export function BondBreedPicker({
  open,
  speciesEmoji,
  currentBreedId,
  onClose,
  onPick,
}: Props) {
  const [breeds, setBreeds] = useState<Breed[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const speciesName = speciesEmoji
    ? BOND_SPECIES.find(s => s.emoji === speciesEmoji)?.name ?? 'pet'
    : 'pet';

  useEffect(() => {
    if (!open || !speciesEmoji) return;
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    fetch(`/api/v1/bond-breeds/${encodeURIComponent(speciesEmoji)}`, { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { data: Breed[] }) => {
        setBreeds(j.data);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [open, speciesEmoji]);

  if (!open || !speciesEmoji) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-280 flex items-end justify-center lg:items-center lg:p-6"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          onClick={e => e.stopPropagation()}
          className="w-full lg:max-w-2xl lg:min-w-140 max-h-[88vh] overflow-y-auto rounded-t-3xl lg:rounded-3xl flex flex-col"
          style={{
            background: '#0a0b0f',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 60px -10px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-4 sticky top-0 z-10"
            style={{ background: '#0a0b0f', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <button onClick={onClose} className="p-1 rounded-full cursor-pointer hover:bg-white/10">
              <X size={20} className="text-white" />
            </button>
            <div className="flex-1 text-center min-w-0">
              <div className="text-sm font-bold text-white truncate">
                Pick your {speciesName.toLowerCase()} breed
              </div>
              <div className="text-[10px] text-[#4a5068]">
                Tap one to adopt this exact pet
              </div>
            </div>
            <div className="w-7" />
          </div>

          {/* Body */}
          <div className="px-3 lg:px-4 py-4">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-[#ec4899]" />
              </div>
            )}

            {error && !loading && (
              <div
                className="rounded-xl p-4 text-center text-xs"
                style={{
                  background: 'rgba(248,113,113,0.06)',
                  border: '1px solid rgba(248,113,113,0.2)',
                  color: '#fca5a5',
                }}
              >
                Couldn&apos;t load breeds. {error}
              </div>
            )}

            {!loading && !error && breeds?.length === 0 && (
              <div className="text-center text-xs text-[#4a5068] py-8">
                No breeds available for this species yet.
              </div>
            )}

            {!loading && !error && breeds && breeds.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3">
                {breeds.map(b => {
                  const selected = b.id === currentBreedId;
                  return (
                    <button
                      key={b.id}
                      onClick={() => {
                        onPick(b);
                        onClose();
                      }}
                      className="rounded-2xl overflow-hidden cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] text-left"
                      style={{
                        background: 'rgba(17,19,24,0.5)',
                        border: selected
                          ? '2px solid rgba(236,72,153,0.6)'
                          : '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <div
                        className="bg-black flex items-center justify-center overflow-hidden"
                        style={{ aspectRatio: '1 / 1' }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={b.image_url}
                          alt={b.label}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="px-2.5 py-2 lg:px-3 lg:py-2.5 relative">
                        <div className="text-xs lg:text-sm font-bold text-white truncate">
                          {b.label}
                        </div>
                        {b.personality && (
                          <div className="text-[10px] text-[#4a5068] truncate mt-0.5">
                            {b.personality}
                          </div>
                        )}
                        {selected && (
                          <div
                            className="absolute top-1.5 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: 'rgba(236,72,153,0.18)',
                              color: '#ec4899',
                              border: '1px solid rgba(236,72,153,0.4)',
                            }}
                          >
                            ✓
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
