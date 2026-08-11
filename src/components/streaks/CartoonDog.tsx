'use client';

import { useEffect, useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import type { PetActionType } from './PetCharacter';

type Props = {
  size?: number;
  /** Bump to replay an action animation. */
  actionTrigger: number;
  /** Which action just fired. */
  lastAction: PetActionType | null;
  mood?: 'happy' | 'lonely' | 'sad';
  /** Coat colors — defaults to Golden Retriever palette. */
  coat?: { primary: string; secondary: string; dark: string };
};

const DEFAULT_COAT = {
  primary: '#d4a574',   // golden body
  secondary: '#f5e6d3', // belly/snout cream
  dark: '#a87a4a',      // ear darker shade
};

const SHADOW = 'rgba(0,0,0,0.18)';

// ── Idle loops (always playing) ──────────────────────────────────────────

const HEAD_IDLE: Variants = {
  animate: {
    rotate: [0, 1.5, 0, -1.5, 0],
    y: [0, -0.6, 0, -0.4, 0],
    transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
  },
};

const TAIL_IDLE: Variants = {
  animate: {
    rotate: [12, 28, 12, 28, 12],
    transition: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
  },
};

const BLINK_IDLE: Variants = {
  animate: {
    scaleY: [1, 1, 1, 0.05, 1, 1, 1, 1],
    transition: { duration: 5, repeat: Infinity, times: [0, 0.5, 0.55, 0.58, 0.61, 0.66, 0.8, 1] },
  },
};

const BODY_IDLE: Variants = {
  animate: {
    scaleY: [1, 1.025, 1],
    transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
  },
};

// ── Action overlays (one-shot, key-bumped to replay) ─────────────────────

const BODY_ACTION: Record<PetActionType, Variants> = {
  tap: {
    initial: { y: 0, scaleY: 1, scaleX: 1 },
    animate: {
      y: [0, -28, 0, -10, 0],
      scaleY: [1, 1.06, 0.94, 1.02, 1],
      scaleX: [1, 0.95, 1.05, 0.99, 1],
      transition: { duration: 0.7 },
    },
  },
  pet: {
    initial: { y: 0, rotate: 0 },
    animate: {
      y: [0, -4, -3, 0],
      rotate: [0, -3, 3, -1, 0],
      transition: { duration: 1.4 },
    },
  },
  feed: {
    initial: { y: 0, scaleY: 1, scaleX: 1 },
    animate: {
      scaleY: [1, 0.92, 1.04, 0.96, 1.02, 1],
      scaleX: [1, 1.05, 0.97, 1.03, 0.99, 1],
      transition: { duration: 1.4 },
    },
  },
  play: {
    initial: { y: 0, rotate: 0 },
    animate: {
      y: [0, -42, 0, -32, 0, -18, 0],
      rotate: [0, -6, 6, -3, 3, 0, 0],
      transition: { duration: 1.8 },
    },
  },
  walk: {
    initial: { x: 0, rotate: 0 },
    animate: {
      x: [0, 14, -14, 10, -10, 0],
      rotate: [0, 2, -2, 1, -1, 0],
      transition: { duration: 2 },
    },
  },
};

const HEAD_ACTION: Record<PetActionType, Variants> = {
  tap: { animate: { rotate: [0, -8, 8, -4, 0], transition: { duration: 0.7 } } },
  pet: { animate: { rotate: [0, 10, -8, 12, -6, 8, 0], transition: { duration: 1.6 } } },
  feed: { animate: { rotate: [0, -2, 4, -3, 2, 0], y: [0, -1, 1, 0, 0], transition: { duration: 1.4 } } },
  play: { animate: { rotate: [0, -12, 12, -6, 6, 0], transition: { duration: 1.8 } } },
  walk: { animate: { rotate: [0, 4, -4, 2, -2, 0], transition: { duration: 2 } } },
};

const TAIL_ACTION: Record<PetActionType, Variants> = {
  tap: { animate: { rotate: [12, 60, 0, 60, 0, 50, 12], transition: { duration: 0.9 } } },
  pet: { animate: { rotate: [12, 65, 0, 65, 0, 55, 12], transition: { duration: 1.6, repeat: 1 } } },
  feed: { animate: { rotate: [12, 35, 18, 35, 12], transition: { duration: 1.4 } } },
  play: { animate: { rotate: [12, 80, -10, 80, -10, 60, 12], transition: { duration: 1.8 } } },
  walk: { animate: { rotate: [12, 30, 12, 30, 12], transition: { duration: 2 } } },
};

const TONGUE_ACTION: Record<PetActionType, Variants> = {
  tap:  { initial: { scaleY: 0, opacity: 0 }, animate: { scaleY: [0, 1.2, 1, 1, 0], opacity: [0, 1, 1, 1, 0], transition: { duration: 1.2 } } },
  pet:  { initial: { scaleY: 0, opacity: 0 }, animate: { scaleY: [0, 1, 1, 0], opacity: [0, 1, 1, 0], transition: { duration: 1.5 } } },
  feed: { initial: { scaleY: 0, opacity: 0 }, animate: { scaleY: [0, 1.1, 0, 1.1, 0], opacity: [0, 1, 0, 1, 0], transition: { duration: 1.2 } } },
  play: { initial: { scaleY: 0, opacity: 0 }, animate: { scaleY: [0, 1.3, 1, 1.3, 1, 0], opacity: [0, 1, 1, 1, 1, 0], transition: { duration: 1.8 } } },
  walk: { initial: { scaleY: 0, opacity: 0 }, animate: { scaleY: [0, 1, 1, 1, 0], opacity: [0, 1, 1, 1, 0], transition: { duration: 2 } } },
};

// Leg cycle for walk — bigger swing
const FRONT_LEG_WALK: Variants = {
  animate: { rotate: [0, 20, -10, 20, -10, 0], transition: { duration: 2 } },
};
const BACK_LEG_WALK: Variants = {
  animate: { rotate: [0, -10, 20, -10, 20, 0], transition: { duration: 2 } },
};

/** Tamagotchi-style cartoon dog drawn entirely in SVG. Each body part is
 *  an independently-animated motion element. Idle loops (breath, blink,
 *  tail wag, slight head bob) always play; actionTrigger re-mounts the
 *  action variants so each tap replays cleanly. */
export function CartoonDog({
  size = 240,
  actionTrigger,
  lastAction,
  mood = 'happy',
  coat = DEFAULT_COAT,
}: Props) {
  // For walk, we want both front + back legs to cycle in opposite phase.
  const walking = lastAction === 'walk' && actionTrigger > 0;
  const [walkKey, setWalkKey] = useState(0);
  useEffect(() => {
    if (walking) setWalkKey(k => k + 1);
  }, [actionTrigger, walking]);

  const filter =
    mood === 'sad'
      ? 'saturate(0.55) brightness(0.85)'
      : mood === 'lonely'
        ? 'saturate(0.85) brightness(0.95)'
        : 'none';

  const k = `${actionTrigger}-${lastAction ?? 'idle'}`;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 200 220"
        width={size}
        height={size}
        style={{ filter, overflow: 'visible' }}
      >
        {/* ── Shadow ── */}
        <ellipse cx="100" cy="206" rx="62" ry="7" fill={SHADOW} />

        {/* ── Tail (behind body) ── */}
        <motion.g
          style={{ transformOrigin: '128px 138px' }}
          variants={TAIL_IDLE}
          animate="animate"
        >
          <motion.g
            key={`tail-${k}`}
            variants={lastAction ? TAIL_ACTION[lastAction] : undefined}
            initial="initial"
            animate="animate"
            style={{ transformOrigin: '128px 138px' }}
          >
            <path
              d="M128 140 Q150 110 162 90 Q170 78 168 70 Q160 70 155 86 Q140 110 122 130 Z"
              fill={coat.primary}
              stroke={coat.dark}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* tail tip cream */}
            <ellipse cx="166" cy="74" rx="6" ry="8" fill={coat.secondary} />
          </motion.g>
        </motion.g>

        {/* ── Back legs ── */}
        <motion.g
          key={`backleg-${walkKey}`}
          style={{ transformOrigin: '115px 168px' }}
          variants={walking ? BACK_LEG_WALK : undefined}
          animate={walking ? 'animate' : undefined}
        >
          <rect x="108" y="160" width="18" height="36" rx="9" fill={coat.primary} />
          <ellipse cx="117" cy="198" rx="12" ry="6" fill={coat.dark} />
        </motion.g>
        <motion.g
          key={`backleg2-${walkKey}`}
          style={{ transformOrigin: '80px 168px' }}
          variants={walking ? FRONT_LEG_WALK : undefined}
          animate={walking ? 'animate' : undefined}
        >
          <rect x="73" y="160" width="18" height="36" rx="9" fill={coat.primary} />
          <ellipse cx="82" cy="198" rx="12" ry="6" fill={coat.dark} />
        </motion.g>

        {/* ── Body (with idle breath + one-shot action) ── */}
        <motion.g
          style={{ transformOrigin: '100px 175px' }}
          variants={BODY_IDLE}
          animate="animate"
        >
          <motion.g
            key={`body-${k}`}
            variants={lastAction ? BODY_ACTION[lastAction] : undefined}
            initial="initial"
            animate="animate"
            style={{ transformOrigin: '100px 175px' }}
          >
            {/* Front legs (anchor on body for action motion) */}
            <motion.g
              key={`frontleg-${walkKey}`}
              style={{ transformOrigin: '85px 158px' }}
              variants={walking ? FRONT_LEG_WALK : undefined}
              animate={walking ? 'animate' : undefined}
            >
              <rect x="78" y="150" width="14" height="34" rx="7" fill={coat.primary} />
              <ellipse cx="85" cy="186" rx="10" ry="5" fill={coat.dark} />
            </motion.g>
            <motion.g
              key={`frontleg2-${walkKey}`}
              style={{ transformOrigin: '115px 158px' }}
              variants={walking ? BACK_LEG_WALK : undefined}
              animate={walking ? 'animate' : undefined}
            >
              <rect x="108" y="150" width="14" height="34" rx="7" fill={coat.primary} />
              <ellipse cx="115" cy="186" rx="10" ry="5" fill={coat.dark} />
            </motion.g>

            {/* Torso */}
            <ellipse cx="100" cy="148" rx="42" ry="32" fill={coat.primary} />
            {/* Belly */}
            <ellipse cx="100" cy="164" rx="34" ry="20" fill={coat.secondary} />
            {/* Chest spot */}
            <ellipse cx="100" cy="138" rx="14" ry="10" fill={coat.secondary} opacity="0.7" />

            {/* ── Head (sits on body) ── */}
            <motion.g
              style={{ transformOrigin: '100px 100px' }}
              variants={HEAD_IDLE}
              animate="animate"
            >
              <motion.g
                key={`head-${k}`}
                variants={lastAction ? HEAD_ACTION[lastAction] : undefined}
                initial="initial"
                animate="animate"
                style={{ transformOrigin: '100px 100px' }}
              >
                {/* Floppy ears (left + right) — slight stagger via separate g */}
                <motion.g
                  style={{ transformOrigin: '74px 78px' }}
                  animate={{ rotate: [0, 3, -2, 3, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <ellipse cx="72" cy="100" rx="14" ry="28" fill={coat.dark} />
                  <ellipse cx="72" cy="100" rx="9" ry="22" fill={coat.primary} />
                </motion.g>
                <motion.g
                  style={{ transformOrigin: '126px 78px' }}
                  animate={{ rotate: [0, -3, 2, -3, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                >
                  <ellipse cx="128" cy="100" rx="14" ry="28" fill={coat.dark} />
                  <ellipse cx="128" cy="100" rx="9" ry="22" fill={coat.primary} />
                </motion.g>

                {/* Head sphere */}
                <circle cx="100" cy="88" r="38" fill={coat.primary} />
                {/* Forehead lighter blaze */}
                <ellipse cx="100" cy="80" rx="8" ry="20" fill={coat.secondary} opacity="0.6" />

                {/* Cheeks blush — happy mood only */}
                {mood === 'happy' && (
                  <>
                    <ellipse cx="78" cy="100" rx="5" ry="3" fill="#ff9ab0" opacity="0.45" />
                    <ellipse cx="122" cy="100" rx="5" ry="3" fill="#ff9ab0" opacity="0.45" />
                  </>
                )}

                {/* Eyes (blink overlay closes both at once) */}
                <motion.g
                  variants={BLINK_IDLE}
                  animate="animate"
                  style={{ transformOrigin: '100px 86px' }}
                >
                  <circle cx="86" cy="86" r="6" fill="#1a1410" />
                  <circle cx="114" cy="86" r="6" fill="#1a1410" />
                  {/* highlight */}
                  <circle cx="88" cy="83" r="1.8" fill="white" />
                  <circle cx="116" cy="83" r="1.8" fill="white" />
                </motion.g>

                {/* Snout */}
                <ellipse cx="100" cy="104" rx="18" ry="13" fill={coat.secondary} />
                {/* Nose */}
                <ellipse cx="100" cy="99" rx="4.5" ry="3.4" fill="#2a1a14" />
                <ellipse cx="98.5" cy="98" rx="1.2" ry="0.8" fill="white" opacity="0.6" />

                {/* Mouth — small smile */}
                <path
                  d="M93 110 Q100 116 107 110"
                  stroke="#2a1a14"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />

                {/* Tongue — appears on action (initial scaleY=0) */}
                <motion.g
                  key={`tongue-${k}`}
                  style={{ transformOrigin: '100px 112px' }}
                  variants={lastAction ? TONGUE_ACTION[lastAction] : undefined}
                  initial="initial"
                  animate="animate"
                >
                  <ellipse cx="100" cy="118" rx="5" ry="6" fill="#ff8aa0" />
                  <path
                    d="M100 116 L100 122"
                    stroke="#e06880"
                    strokeWidth="1"
                  />
                </motion.g>
              </motion.g>
            </motion.g>
          </motion.g>
        </motion.g>
      </svg>
    </div>
  );
}
