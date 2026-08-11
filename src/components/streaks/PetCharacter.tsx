'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { CartoonDog } from './CartoonDog';
import { BOND_SPECIES } from '@/lib/bond-pet';
import { petSpriteUrl } from '@/lib/pet-sprite';

export type PetActionType = 'tap' | 'pet' | 'feed' | 'play' | 'walk';

type Props = {
  speciesEmoji: string;
  breedImageUrl?: string | null;
  breedLabel?: string | null;
  /** mammals get tilt-and-trot; egg-layers wobble */
  birthType: 'live' | 'egg';
  /** Bump this counter to trigger the action animation. */
  actionTrigger: number;
  /** Which action just fired — drives the matching reaction. */
  lastAction: PetActionType | null;
  /** Diameter in px. Default 220. Use 320+ for fullscreen. */
  size?: number;
  /** Lower mood washes out colors + slows motion. */
  mood?: 'happy' | 'lonely' | 'sad';
  /** When set, the real-photo MP4 (Stable Video Diffusion) renders as
   *  the pet — takes priority over the AI sprite + cartoon fallback. */
  videoUrl?: string | null;
};

type Particle = { id: number; x: number; emoji: string; rotate: number };

const PARTICLE_EMOJI: Record<PetActionType, string[]> = {
  tap:  ['✨', '⭐', '🌟'],
  pet:  ['💗', '💕', '💖', '💞'],
  feed: ['🦴', '🍖', '🥩', '🍪'],
  play: ['🎾', '⚽', '🎈'],
  walk: ['💨', '🍃', '👣'],
};

/** Action-specific keyframe sequences for the pet's body. Multiplied by
 *  `size` factor inside the component so big pets don't over-bounce. */
const ACTION_VARIANTS: Record<PetActionType, Variants> = {
  tap: {
    initial: { y: 0, rotate: 0, scale: 1 },
    animate: {
      y: [0, -22, 0, -8, 0],
      scale: [1, 1.06, 0.97, 1.02, 1],
      transition: { duration: 0.7, times: [0, 0.25, 0.55, 0.78, 1] },
    },
  },
  pet: {
    initial: { y: 0, rotate: 0, scale: 1 },
    animate: {
      y: [0, -6, -4, 0],
      rotate: [0, -4, 4, -2, 0],
      scale: [1, 1.04, 1.05, 1.02, 1],
      transition: { duration: 1.4 },
    },
  },
  feed: {
    initial: { y: 0, scaleY: 1, scaleX: 1 },
    animate: {
      // Chomp — squish vertically + nudge forward
      scaleY: [1, 0.82, 1.06, 0.92, 1.02, 1],
      scaleX: [1, 1.08, 0.97, 1.04, 0.99, 1],
      y: [0, 2, 0, 1, 0],
      transition: { duration: 1.2 },
    },
  },
  play: {
    initial: { y: 0, rotate: 0 },
    animate: {
      y: [0, -38, 0, -28, 0, -16, 0],
      rotate: [0, -6, 6, -3, 3, 0, 0],
      transition: { duration: 1.6 },
    },
  },
  walk: {
    initial: { x: 0, rotate: 0 },
    animate: {
      // Trot left-and-right with a wiggle
      x: [0, 18, -18, 12, -12, 0],
      rotate: [0, 2, -2, 1, -1, 0],
      transition: { duration: 2.0 },
    },
  },
};

const IDLE_VARIANTS: Variants = {
  initial: { scale: 1, y: 0 },
  animate: {
    scale: [1, 1.025, 1],
    y: [0, -1.5, 0],
    transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
  },
};

/** Big, game-style pet hero. Renders the breed photo (when available) at
 *  hero size, anchored on a soft shadow. Idle breathing always loops; an
 *  `actionTrigger` change kicks off the matching action animation + a
 *  particle burst overlay. Falls back to the species emoji at huge size
 *  when no breed photo is attached. */
export function PetCharacter({
  speciesEmoji,
  breedImageUrl,
  breedLabel,
  birthType,
  actionTrigger,
  lastAction,
  size = 220,
  mood = 'happy',
  videoUrl,
}: Props) {
  const [particles, setParticles] = useState<Particle[]>([]);

  // Spawn 6 particles whenever an action fires.
  useEffect(() => {
    if (actionTrigger === 0 || !lastAction) return;
    const pool = PARTICLE_EMOJI[lastAction];
    const next: Particle[] = Array.from({ length: 6 }, (_, i) => ({
      id: actionTrigger * 100 + i,
      x: (i - 2.5) * 14 + (Math.sin(i) * 8),
      emoji: pool[i % pool.length],
      rotate: (i * 47) % 360 - 180,
    }));
    setParticles(prev => [...prev, ...next]);
    const t = setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id < actionTrigger * 100));
    }, 1600);
    return () => clearTimeout(t);
  }, [actionTrigger, lastAction]);

  const filter =
    mood === 'sad'
      ? 'grayscale(0.4) saturate(0.7) brightness(0.85)'
      : mood === 'lonely'
        ? 'saturate(0.85) brightness(0.95)'
        : 'none';

  // Key on actionTrigger so each press re-runs the variant from initial.
  const actionKey = lastAction ?? 'idle';

  // AI-generated cartoon sprite per breed (Pollinations.ai). Pre-computed
  // memoised URL so the <img> stays stable across re-renders.
  const speciesName = useMemo(
    () => BOND_SPECIES.find(s => s.emoji === speciesEmoji)?.name ?? 'pet',
    [speciesEmoji],
  );
  const spriteUrl = useMemo(
    () => petSpriteUrl(breedLabel, speciesName),
    [breedLabel, speciesName],
  );
  const [spriteLoaded, setSpriteLoaded] = useState(false);
  const [spriteFailed, setSpriteFailed] = useState(false);

  // While the AI sprite is loading, fall back to the rigged SVG dog (for
  // dogs) or the breed photo (for other species). Once the sprite arrives,
  // we crossfade to it and animate it with the existing motion variants.
  const useCartoonFallback = !spriteLoaded && speciesEmoji === '🐕';
  const showAISprite = spriteLoaded && !spriteFailed;

  return (
    <div className="relative flex flex-col items-center select-none" style={{ width: size }}>
      {/* Particle burst overlay — sits above the pet, fades up */}
      <AnimatePresence>
        {particles.map(p => (
          <motion.span
            key={p.id}
            className="absolute pointer-events-none text-2xl"
            style={{ left: '50%', top: '8%' }}
            initial={{ opacity: 0, y: 0, x: p.x, scale: 0.6, rotate: 0 }}
            animate={{ opacity: [0, 1, 1, 0], y: -size * 0.6, scale: 1, rotate: p.rotate }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          >
            {p.emoji}
          </motion.span>
        ))}
      </AnimatePresence>

      {/* Off-screen preloader for the AI sprite. Once it finishes loading
          we crossfade away from the fallback. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={spriteUrl}
        alt=""
        aria-hidden
        className="absolute opacity-0 pointer-events-none"
        style={{ width: 1, height: 1 }}
        onLoad={() => setSpriteLoaded(true)}
        onError={() => setSpriteFailed(true)}
      />

      {/* The pet body. Priority:
          1. Live MP4 (Stable Video Diffusion) — real photo, real motion.
          2. AI cartoon sprite (Pollinations) once loaded — every breed.
          3. Rigged SVG dog for dogs while sprite is loading.
          4. Breed photo / species emoji for everything else as last resort.
          Action animations (jump/squash/walk) still drive the wrapping
          motion.div, so the video element bounces + particles burst on top. */}
      {videoUrl ? (
        <motion.div
          variants={IDLE_VARIANTS}
          initial="initial"
          animate="animate"
          style={{ filter, willChange: 'transform' }}
          className="relative"
        >
          <motion.div
            key={`${actionTrigger}-${actionKey}`}
            variants={lastAction ? ACTION_VARIANTS[lastAction] : undefined}
            initial="initial"
            animate="animate"
            style={{ width: size, height: size }}
          >
            <video
              src={videoUrl}
              autoPlay
              loop
              muted
              playsInline
              style={{
                width: size,
                height: size,
                objectFit: 'cover',
                borderRadius: '50%',
                border: `${Math.max(3, size / 50)}px solid rgba(236,72,153,0.45)`,
                boxShadow:
                  '0 12px 32px -4px rgba(236,72,153,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset',
              }}
            />
          </motion.div>
        </motion.div>
      ) : showAISprite ? (
        <motion.div
          variants={IDLE_VARIANTS}
          initial="initial"
          animate="animate"
          style={{ filter, willChange: 'transform' }}
          className="relative"
        >
          <motion.div
            key={`${actionTrigger}-${actionKey}`}
            variants={lastAction ? ACTION_VARIANTS[lastAction] : undefined}
            initial="initial"
            animate="animate"
            style={{ width: size, height: size }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={spriteUrl}
              alt={breedLabel ?? speciesName}
              style={{
                width: size,
                height: size,
                objectFit: 'contain',
                // Drop shadow gives the impression of a transparent sprite
                // sitting on the floor — works even with white backgrounds.
                filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.35))',
                mixBlendMode: 'multiply',
              }}
              draggable={false}
            />
          </motion.div>
        </motion.div>
      ) : useCartoonFallback ? (
        <div style={{ filter }}>
          <CartoonDog
            size={size}
            actionTrigger={actionTrigger}
            lastAction={lastAction}
            mood={mood}
          />
        </div>
      ) : (
        <motion.div
          variants={IDLE_VARIANTS}
          initial="initial"
          animate="animate"
          style={{ filter, willChange: 'transform' }}
          className="relative"
        >
          <motion.div
            key={`${actionTrigger}-${actionKey}`}
            variants={lastAction ? ACTION_VARIANTS[lastAction] : undefined}
            initial="initial"
            animate="animate"
            style={{ width: size, height: size }}
          >
            {breedImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={breedImageUrl}
                alt={breedLabel ?? 'pet'}
                className="rounded-full object-cover"
                style={{
                  width: size,
                  height: size,
                  border: `${Math.max(3, size / 50)}px solid rgba(236,72,153,0.45)`,
                  boxShadow:
                    '0 10px 28px -4px rgba(236,72,153,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset',
                }}
              />
            ) : (
              <div
                className="flex items-center justify-center w-full h-full"
                style={{ fontSize: size * 0.7, lineHeight: 1 }}
              >
                {birthType === 'egg' ? '🥚' : speciesEmoji}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* Soft floor shadow that pulses with breath. The CartoonDog SVG
          ships its own internal shadow, so we suppress this one only
          while the SVG fallback is showing. */}
      {!useCartoonFallback && (
        <motion.div
          aria-hidden
          className="rounded-full pointer-events-none"
          style={{
            width: size * 0.75,
            height: size * 0.08,
            marginTop: -size * 0.04,
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.55), transparent 70%)',
          }}
          animate={{ scale: [1, 0.92, 1], opacity: [0.55, 0.45, 0.55] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}
