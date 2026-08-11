'use client';

import { useState } from 'react';
import { BOND_SPECIES } from '@/lib/bond-pet';
import { BondBreedPicker, type Breed } from './BondBreedPicker';

type Props = {
  /** Selected species emoji. */
  value: string | null;
  /** Selected breed id (if any). */
  breedId?: string | null;
  /** Called after the user picks both species AND a breed. */
  onChange: (species: string, breed: Breed | null) => void;
};

const GROUPS: Array<{ category: 'cute' | 'gentle' | 'mythical'; label: string }> = [
  { category: 'cute',     label: 'Cute' },
  { category: 'gentle',   label: 'Gentle' },
  { category: 'mythical', label: 'Mythical' },
];

// Per-species idle animation. Each emoji gets a motion that matches its
// personality — cats flick tails, bunnies hop, dragons drift, etc. Pure
// CSS keyframes (GPU-accelerated transforms only). Selected pet gets
// extra amplitude + a glow halo so the choice feels alive.
const SPECIES_ANIM: Record<string, string> = {
  '🐈':  'pet-cat       2.4s ease-in-out infinite',
  '🐕':  'pet-dog       0.7s ease-in-out infinite',
  '🐇':  'pet-bunny     0.9s ease-in-out infinite',
  '🦊':  'pet-fox       3.2s ease-in-out infinite',
  '🦥':  'pet-sloth     5s   ease-in-out infinite',
  '🐧':  'pet-penguin   1.2s ease-in-out infinite',
  '🦦':  'pet-otter     2s   ease-in-out infinite',
  '🐢':  'pet-turtle    4.2s ease-in-out infinite',
  '🦝':  'pet-raccoon   2.4s ease-in-out infinite',
  '🐉':  'pet-dragon    4s   ease-in-out infinite',
  '🦄':  'pet-unicorn   1s   ease-in-out infinite',
  '🦋':  'pet-phoenix   1.2s ease-in-out infinite',
};

/** Grid of 12 species to adopt. Owner picks at creation time; the partner
 *  confirms by accepting the invite. Visual emphasis on cute/mythical
 *  groupings so picking feels playful. */
export function BondSpeciesPicker({ value, breedId, onChange }: Props) {
  // Which species is the breed picker currently open for?
  const [breedPickerFor, setBreedPickerFor] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <PetKeyframes />
      <BondBreedPicker
        open={breedPickerFor !== null}
        speciesEmoji={breedPickerFor}
        currentBreedId={breedPickerFor === value ? breedId ?? null : null}
        onClose={() => setBreedPickerFor(null)}
        onPick={breed => {
          if (breedPickerFor) onChange(breedPickerFor, breed);
        }}
      />
      {GROUPS.map(g => (
        <div key={g.category}>
          <div className="text-[10px] uppercase tracking-wider text-[#4a5068] mb-1.5 px-1">
            {g.label}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {BOND_SPECIES.filter(s => s.category === g.category).map((s, i) => {
              const selected = value === s.emoji;
              return (
                <button
                  key={s.emoji}
                  onClick={() => setBreedPickerFor(s.emoji)}
                  className="aspect-square rounded-xl flex flex-col items-center justify-center text-2xl cursor-pointer transition-all relative"
                  style={{
                    background: selected ? 'rgba(236,72,153,0.12)' : 'rgba(255,255,255,0.03)',
                    border: selected ? '1px solid rgba(236,72,153,0.5)' : '1px solid rgba(255,255,255,0.05)',
                  }}
                  aria-label={`Adopt ${s.name}`}
                >
                  <span
                    className="text-4xl lg:text-5xl inline-block leading-none"
                    style={{
                      animation: SPECIES_ANIM[s.emoji],
                      // Stagger so the grid feels like a "swarm" of animals
                      // rather than 12 robots marching in lock-step.
                      animationDelay: `${(i * 211) % 1100}ms`,
                      // Selected pet gets a glow + extra scale via the
                      // `data-selected` attribute hook in PetKeyframes.
                      filter: selected
                        ? 'drop-shadow(0 0 10px rgba(236,72,153,0.7))'
                        : undefined,
                      transform: selected ? 'scale(1.08)' : undefined,
                      willChange: 'transform',
                    }}
                  >
                    {s.emoji}
                  </span>
                  <span
                    className="absolute bottom-1 text-[8px] uppercase tracking-wider"
                    style={{ color: selected ? '#ec4899' : '#4a5068' }}
                  >
                    {s.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Per-species CSS keyframes. Each motion is tuned to the animal's vibe:
 *  cats flick, dogs wag, bunnies hop, dragons drift. Transforms only so
 *  the GPU does the work. Respects prefers-reduced-motion. */
function PetKeyframes() {
  return (
    <style jsx global>{`
      /* Cute — small fast-paced motions */
      @keyframes pet-cat {
        0%, 100% { transform: rotate(-3deg); }
        50%      { transform: rotate(3deg); }
      }
      @keyframes pet-dog {
        0%, 100% { transform: rotate(-6deg); }
        50%      { transform: rotate(6deg); }
      }
      @keyframes pet-bunny {
        0%, 100% { transform: translateY(0) scaleY(1); }
        40%      { transform: translateY(-6px) scaleY(1.05); }
        70%      { transform: translateY(0) scaleY(0.95); }
      }
      @keyframes pet-fox {
        0%, 100% { transform: rotate(-2deg) translateX(0); }
        50%      { transform: rotate(2deg) translateX(2px); }
      }

      /* Gentle — slow breathing, waddling, floating */
      @keyframes pet-sloth {
        0%, 100% { transform: rotate(-2deg) translateY(0); }
        50%      { transform: rotate(2deg) translateY(-1px); }
      }
      @keyframes pet-penguin {
        0%, 100% { transform: rotate(-5deg) translateX(-1px); }
        50%      { transform: rotate(5deg) translateX(1px); }
      }
      @keyframes pet-otter {
        0%, 100% { transform: translateY(0) rotate(-2deg); }
        50%      { transform: translateY(-3px) rotate(2deg); }
      }
      @keyframes pet-turtle {
        0%, 100% { transform: translateX(0) rotate(0deg); }
        50%      { transform: translateX(2px) rotate(3deg); }
      }
      @keyframes pet-raccoon {
        0%, 100% { transform: translateY(0) scale(1); }
        50%      { transform: translateY(-2px) scale(1.04); }
      }

      /* Mythical — majestic, slower, more amplitude */
      @keyframes pet-dragon {
        0%, 100% { transform: translateY(0) rotate(-3deg); }
        50%      { transform: translateY(-5px) rotate(3deg); }
      }
      @keyframes pet-unicorn {
        0%, 100% { transform: translateY(0) rotate(-4deg); }
        25%      { transform: translateY(-5px) rotate(-2deg); }
        50%      { transform: translateY(0) rotate(0deg); }
        75%      { transform: translateY(-5px) rotate(2deg); }
      }
      @keyframes pet-phoenix {
        0%, 100% { transform: scaleX(1) scaleY(1) rotate(0deg); }
        25%      { transform: scaleX(0.85) scaleY(1.1) rotate(-3deg); }
        50%      { transform: scaleX(1) scaleY(1) rotate(0deg); }
        75%      { transform: scaleX(0.85) scaleY(1.1) rotate(3deg); }
      }

      @media (prefers-reduced-motion: reduce) {
        button[aria-label^="Adopt"] > span:first-child {
          animation: none !important;
        }
      }
    `}</style>
  );
}
