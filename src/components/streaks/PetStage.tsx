'use client';

import { type ReactNode } from 'react';
import { Expand } from 'lucide-react';
import { playPetSFX } from '@/lib/pet-sfx';

type Props = {
  speciesEmoji?: string | null;
  /** The pet portrait — typically <PetCharacter /> rendered by the caller. */
  children: ReactNode;
  /** Fires when the user taps the "expand" button. The parent decides
   *  what to render in fullscreen (typically <PetRoomOverlay />). */
  onExpand?: () => void;
  /** When true, no expand button is shown — used inside the overlay itself. */
  insideOverlay?: boolean;
  /** Fires when the user taps the pet body. Lets the page trigger a
   *  shared action animation on the pet character. */
  onTap?: () => void;
};

/** Stage container that gives the pet a nicer background (gradient sky +
 *  grass floor), an "expand to fullscreen" affordance, and a hidden tap
 *  target that triggers a species SFX + a quick bounce animation. Wraps
 *  whatever pet portrait the caller provides. */
export function PetStage({ speciesEmoji, children, onExpand, insideOverlay, onTap }: Props) {
  function tap() {
    playPetSFX(speciesEmoji);
    onTap?.();
  }

  // Time-of-day tint — local time decides the sky gradient.
  const hour = new Date().getHours();
  const isNight = hour < 6 || hour >= 19;
  const isDawn = hour >= 6 && hour < 9;
  const isDusk = hour >= 17 && hour < 19;
  const sky = isNight
    ? 'linear-gradient(180deg, #0a0a1a 0%, #1a0b2a 60%, #2a0f1f 100%)'
    : isDawn
      ? 'linear-gradient(180deg, #2a1340 0%, #6b2a4d 50%, #d97862 100%)'
      : isDusk
        ? 'linear-gradient(180deg, #1a0d3a 0%, #5b2a6b 50%, #c8557e 100%)'
        : 'linear-gradient(180deg, #1a2a4a 0%, #3a5a8a 50%, #6ba3c8 100%)';

  return (
    <div
      className="relative rounded-3xl overflow-hidden"
      style={{
        background: sky,
        border: '1px solid rgba(236,72,153,0.2)',
        minHeight: insideOverlay ? 360 : 200,
      }}
    >
      {/* Starfield at night */}
      {isNight && (
        <div aria-hidden className="absolute inset-0 pointer-events-none opacity-60">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="absolute w-0.5 h-0.5 rounded-full bg-white"
              style={{
                left: `${(i * 137) % 100}%`,
                top: `${(i * 31) % 60}%`,
                opacity: 0.3 + ((i * 17) % 70) / 100,
              }}
            />
          ))}
        </div>
      )}

      {/* Sun / moon */}
      <div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          right: insideOverlay ? '8%' : '12%',
          top: insideOverlay ? '10%' : '12%',
          width: insideOverlay ? 56 : 32,
          height: insideOverlay ? 56 : 32,
          background: isNight ? '#e8e8f0' : isDawn || isDusk ? '#ffb88a' : '#ffe27a',
          boxShadow: isNight
            ? '0 0 32px rgba(232,232,240,0.5)'
            : '0 0 32px rgba(255,224,138,0.6)',
        }}
      />

      {/* Grass / floor band */}
      <div
        aria-hidden
        className="absolute left-0 right-0 bottom-0 pointer-events-none"
        style={{
          height: insideOverlay ? 80 : 48,
          background: isNight
            ? 'linear-gradient(180deg, rgba(20,40,30,0.6), rgba(10,20,15,0.9))'
            : 'linear-gradient(180deg, rgba(60,140,80,0.4), rgba(40,90,60,0.8))',
        }}
      />

      {/* Expand button */}
      {!insideOverlay && onExpand && (
        <button
          type="button"
          onClick={onExpand}
          className="absolute top-2 right-2 h-8 w-8 rounded-full flex items-center justify-center cursor-pointer backdrop-blur-sm z-10"
          style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
          title="Enter pet room"
          aria-label="Enter fullscreen pet room"
        >
          <Expand size={14} />
        </button>
      )}

      {/* Tap target wraps the pet portrait. The outer button itself is
          a no-op transformer — the inner PetCharacter owns the bounce
          and particle animation via the action trigger pipeline. */}
      <button
        type="button"
        onClick={tap}
        className="relative w-full text-left cursor-pointer focus:outline-none"
        aria-label="Tap the pet"
      >
        {children}
      </button>
    </div>
  );
}
