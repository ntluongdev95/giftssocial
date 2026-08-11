'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, type Transition, type TargetAndTransition } from 'framer-motion';
import { X, MapPin, Calendar, Loader2, Share2, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { getTheme } from './themes';

interface Capsule {
  id: string;
  title: string;
  message: string;
  photos: string[];
  location_lat: number;
  location_lng: number;
  location_name?: string;
  buried_at: string;
  unlock_at: string;
  unlock_radius: number;
  opened_at?: string;
  my_opened_at?: string | null;
  theme?: string;
  role?: 'sender' | 'recipient';
  sender_name?: string;
  sender_username?: string;
  sender_avatar?: string;
  recipient_names?: string[];
}

interface Props {
  capsule: Capsule;
  onClose: () => void;
  onOpened?: (c: Capsule) => void;
}

type Phase = 'approaching' | 'digging' | 'reveal' | 'message' | 'photos' | 'reply';

export default function CapsuleRevealOverlay({ capsule: initialCapsule, onClose, onOpened }: Props) {
  // Mirror the prop in local state so we can swap in the full payload (message,
  // photos) returned by the PATCH /open endpoint — the API hides those fields
  // from recipients until they personally open the capsule.
  const [capsule, setCapsule] = useState<Capsule>(initialCapsule);
  const [phase, setPhase] = useState<Phase>('approaching');
  const [opening, setOpening] = useState(false);
  // Gate the reveal animation on the *current viewer's* open state, not the
  // capsule's global opened_at — a sender opening their own capsule must not
  // skip the animation for a recipient who has not yet dug it up.
  const [opened, setOpened] = useState(!!initialCapsule.my_opened_at);
  const [photoIdx, setPhotoIdx] = useState(0);
  const photos = Array.isArray(capsule.photos) ? capsule.photos : [];
  const theme = getTheme(capsule.theme);

  // Group message into paragraphs of word tokens for layout + word-by-word reveal.
  // A paragraph break is a BLANK LINE (\n\n). Single \n inside a paragraph is treated
  // as a soft wrap (collapsed to space) so prose flows naturally with `text-align: justify`.
  const paragraphs = useMemo(() => {
    const paras: { words: { text: string; idx: number }[] }[] = [];
    let wordIdx = 0;
    capsule.message.split(/\n\s*\n+/).forEach(p => {
      // Replace all internal whitespace (including single \n) with single spaces
      const flat = p.replace(/\s+/g, ' ').trim();
      if (!flat) return;
      const words = flat.split(/(\s+)/).filter(s => s.length > 0).map(w => ({ text: w, idx: wordIdx++ }));
      if (words.length > 0) paras.push({ words });
    });
    return { paragraphs: paras, wordCount: wordIdx };
  }, [capsule.message]);
  // Inner reveal starts soon after the letter fades in
  const LETTER_LAND_DELAY = 0.5;
  const messageEndDelay = LETTER_LAND_DELAY + Math.min(Math.max(0, paragraphs.wordCount - 1) * 0.03, 3);

  // Compute when each word "appears" (delay seconds) for syncing photo reveal
  const wordDelay = (idx: number) => LETTER_LAND_DELAY + Math.min(idx * 0.03, 3);

  // Photos interleaved between paragraphs — at most 1 per paragraph; remainder bunched at the end
  const inlinePhotoPerParagraph = paragraphs.paragraphs.map((_, pIdx) => photos[pIdx] || null);
  const trailingPhotos = photos.slice(paragraphs.paragraphs.length);
  // Pre-shuffled rotations so each polaroid feels hand-placed but stable across re-renders
  const rotations = useMemo(() => photos.map((_, i) => ((i * 47) % 7) - 3), [photos]);

  // Already opened — skip to reveal
  useEffect(() => {
    if (opened) setPhase('reveal');
  }, [opened]);

  const handleDig = async () => {
    if (opening) return;

    setOpening(true);
    setPhase('digging');

    try {
      const res = await fetch(`/api/v1/capsules/${capsule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        // PATCH returns the unmasked capsule (message + photos) — adopt it so
        // the message phase has content to render for first-time openers.
        if (data.data) setCapsule(data.data);
        setOpened(true);
        setPhase('reveal');
        onOpened?.(data.data);
      } else {
        toast.error(data.error?.message || 'Cannot open');
        setPhase('approaching');
      }
    } catch {
      toast.error('Network error');
      setPhase('approaching');
    }
    setOpening(false);
  };

  const burial = new Date(capsule.buried_at);
  // Captured via useState initializer — `Date.now()` is impure; running it
  // once on mount avoids drifting the displayed years and the React purity
  // lint rule (which also flags Date.now inside useMemo).
  const [yearsBurried] = useState(
    () => ((Date.now() - new Date(initialCapsule.buried_at).getTime()) / (1000 * 60 * 60 * 24 * 365)).toFixed(1),
  );

  const handleShare = async () => {
    const text = `I just unwrapped a Gao Gift sealed ${yearsBurried} years ago at ${capsule.location_name || 'a special place'} 🎁✨`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Gao Gift', text }); } catch {}
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Copied!');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999] flex items-center justify-center"
        style={{ background: 'radial-gradient(ellipse at center, #08091a 0%, #03050e 55%, #000005 100%)' }}
      >
        <button onClick={onClose} className="absolute top-6 right-6 z-[1000] h-10 w-10 rounded-full flex items-center justify-center text-white/50 hover:text-white cursor-pointer" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <X size={18} />
        </button>

        {/* Night-sky starfield: 120 stars in three brightness tiers + four
            occasional shooting stars vúting across at staggered angles. */}
        {Array.from({ length: 120 }).map((_, i) => {
          const tier = (i * 53) % 100;
          const isBright = tier < 8;
          const isMid = tier >= 8 && tier < 30;
          const size = isBright ? 2.4 + ((i * 7) % 14) / 10 : isMid ? 1.6 + ((i * 11) % 9) / 10 : 1 + ((i * 13) % 7) / 10;
          const colourRoll = (i * 41) % 100;
          const colour = colourRoll < 70 ? '255,255,255'
            : colourRoll < 85 ? '255,220,160'
            : colourRoll < 95 ? '180,200,255'
            : '255,180,220';
          const baseOpacity = 0.3 + ((i * 17) % 55) / 100;
          return (
            <motion.div
              key={`star-${i}`}
              className="absolute rounded-full pointer-events-none"
              style={{
                left: `${(i * 37) % 100}%`,
                top: `${(i * 71) % 100}%`,
                width: size,
                height: size,
                background: `rgba(${colour},${baseOpacity})`,
                boxShadow: isBright
                  ? `0 0 ${size * 2.5}px rgba(${colour},${baseOpacity * 0.55}), 0 0 ${size * 5}px rgba(${colour},0.22)`
                  : undefined,
              }}
              animate={{
                opacity: [baseOpacity, Math.min(1, baseOpacity * 1.6), baseOpacity * 0.4, baseOpacity],
              }}
              transition={{
                duration: 2.5 + ((i * 19) % 50) / 10,
                delay: ((i * 23) % 60) / 10,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          );
        })}
        {/* Shooting stars — 8 streaks crossing the sky from all four
            directions (left↔right and top↔bottom), each at its own altitude
            and slight angle so they never look like a procession. */}
        {[
          // Left → right (slight down tilt)
          { dir: 'lr' as const, cross: 14, jitter: 18, delay: 3, repeatDelay: 12 },
          { dir: 'lr' as const, cross: 52, jitter: 10, delay: 19, repeatDelay: 14 },
          // Right → left
          { dir: 'rl' as const, cross: 28, jitter: 14, delay: 9, repeatDelay: 13 },
          { dir: 'rl' as const, cross: 78, jitter: 22, delay: 25, repeatDelay: 11 },
          // Top → bottom (with sideways drift)
          { dir: 'tb' as const, cross: 35, jitter: 18, delay: 6, repeatDelay: 16 },
          { dir: 'tb' as const, cross: 72, jitter: -14, delay: 22, repeatDelay: 15 },
          // Bottom → top
          { dir: 'bt' as const, cross: 22, jitter: -20, delay: 13, repeatDelay: 17 },
          { dir: 'bt' as const, cross: 80, jitter: 16, delay: 30, repeatDelay: 14 },
        ].map((s, i) => {
          // Direction → wrapper anchor + rotation. CSS rotate is clockwise:
          // 0° = right, 90° = down, 180° = left, 270° = up.
          let startLeft = '-12%';
          let startTop = `${s.cross}%`;
          let rotation = s.jitter;
          let distance = '130vw';
          if (s.dir === 'rl') {
            startLeft = '112%';
            startTop = `${s.cross}%`;
            rotation = 180 - s.jitter; // bias toward "down-left"
            distance = '130vw';
          } else if (s.dir === 'tb') {
            startLeft = `${s.cross}%`;
            startTop = '-12%';
            rotation = 90 + s.jitter;
            distance = '130vh';
          } else if (s.dir === 'bt') {
            startLeft = `${s.cross}%`;
            startTop = '112%';
            rotation = 270 + s.jitter;
            distance = '130vh';
          }
          return (
            <div
              key={`shoot-${i}`}
              className="absolute pointer-events-none"
              style={{
                left: startLeft,
                top: startTop,
                transform: `rotate(${rotation}deg)`,
                transformOrigin: 'left center',
              }}
            >
              <motion.div
                initial={{ x: 0, opacity: 0 }}
                animate={{ x: distance, opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 1.3,
                  delay: s.delay,
                  repeat: Infinity,
                  repeatDelay: s.repeatDelay,
                  times: [0, 0.08, 0.7, 1],
                  ease: 'linear',
                }}
                style={{
                  width: 110,
                  height: 1.6,
                  background:
                    'linear-gradient(to right, transparent, rgba(255,255,255,0.95), rgba(255,255,255,0.55) 60%, transparent)',
                  filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.75))',
                }}
              />
            </div>
          );
        })}

        {/* PHASE: Approaching — show capsule on ground */}
        {phase === 'approaching' && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="text-center px-6 max-w-md"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-7xl mb-4"
            >🎁</motion.div>

            <p className="text-[10px] uppercase tracking-[0.3em] text-[#a855f7] mb-2">
              {capsule.role === 'recipient' ? `From ${capsule.sender_name || capsule.sender_username || 'Someone'}` : 'Gao Gift'}
            </p>
            <h2 className="text-xl font-bold text-white mb-2">{capsule.title}</h2>

            <div className="flex items-center justify-center gap-3 text-[11px] text-[#4a5068] mt-4 mb-6">
              <span className="flex items-center gap-1"><MapPin size={11} />{capsule.location_name || 'Hidden location'}</span>
              <span className="opacity-50">•</span>
              <span className="flex items-center gap-1"><Calendar size={11} />Sealed {burial.getFullYear()}</span>
            </div>

            <motion.button
              onClick={handleDig}
              disabled={opening}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="rounded-2xl px-8 py-4 text-sm font-bold cursor-pointer disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                color: 'white',
                boxShadow: '0 0 40px rgba(168,85,247,0.4)',
              }}
            >
              {opening ? <><Loader2 size={16} className="inline animate-spin mr-2" /> Unwrapping...</> : '🎁 Unwrap Gift'}
            </motion.button>
          </motion.div>
        )}

        {/* PHASE: Digging animation */}
        {phase === 'digging' && (
          <motion.div className="text-center">
            <motion.div
              animate={{ rotate: [0, -8, 8, -6, 6, 0], scale: [1, 1.08, 0.98, 1.06, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-8xl mb-6"
            >🎁</motion.div>
            <p className="text-sm text-white">Unwrapping...</p>
          </motion.div>
        )}

        {/* PHASE: Reveal — carrier dove delivers the letter */}
        {phase === 'reveal' && (
          <motion.div className="text-center px-6 relative">
            {/* Carrier dove glides slowly across the sky — pauses near centre to release the letter */}
            <motion.div
              initial={{ x: '-60vw', y: -130, rotate: -8, opacity: 0 }}
              animate={{
                x: ['-60vw', '-25vw', '0vw', '0vw', '25vw', '60vw'],
                y: [-130, -50, -10, -10, -30, -170],
                rotate: [-8, -2, 1, 1, 9, 22],
                opacity: [0, 1, 1, 1, 1, 0],
              }}
              transition={{ duration: 7, times: [0, 0.28, 0.45, 0.55, 0.75, 1], ease: [0.42, 0, 0.58, 1] }}
              className="absolute pointer-events-none flex flex-col items-center"
              style={{ left: '50%', top: '50%', marginLeft: -40, marginTop: -90, perspective: '600px' }}
            >
              {/* Realistic wing flap — downstroke fast, upstroke slow, then a brief glide pause.
                  Flip horizontally (negative scaleX) so the dove's head points the direction it's flying — emoji default faces left. */}
              <motion.span
                animate={{
                  scaleY: [1, 0.62, 0.95, 1, 1],
                  scaleX: [-1, -1.08, -1.02, -1, -1],
                  y: [0, -6, -1, 0, 0],
                  rotateZ: [0, 2, -1, 0, 0],
                }}
                transition={{
                  duration: 0.85,
                  times: [0, 0.18, 0.5, 0.75, 1],
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="text-7xl block"
                style={{ transformOrigin: 'center bottom', filter: 'drop-shadow(0 6px 10px rgba(168,85,247,0.45))' }}
              >🕊️</motion.span>
              {/* Letter dangling on a string — fades out when bird releases it (~3.5s) */}
              <motion.span
                animate={{
                  rotate: [-14, 14, -14, 14, -14, 14],
                  y: [0, -2, 0, -2, 0, -2],
                  opacity: [1, 1, 1, 0, 0, 0],
                }}
                transition={{ duration: 7, times: [0, 0.2, 0.45, 0.55, 0.75, 1], ease: 'easeInOut' }}
                className="text-3xl block -mt-3"
                style={{ transformOrigin: 'top center' }}
              >💌</motion.span>
            </motion.div>

            {/* The released letter — detaches from the bird at midpoint and tumbles down to centre */}
            <motion.span
              initial={{ opacity: 0, scale: 1, x: -40, y: -55, rotate: 8 }}
              animate={{
                opacity: [0, 1, 1, 1, 0],
                x: [-40, -32, -10, 5, 0],
                y: [-55, -30, 0, 14, 4],
                rotate: [8, -22, 28, -12, 0],
                scale: [1, 1.05, 1.1, 1.05, 0.6],
              }}
              transition={{
                duration: 1.6,
                delay: 3.2,
                times: [0, 0.15, 0.55, 0.85, 1],
                ease: [0.4, 0.05, 0.55, 1],
              }}
              className="absolute text-3xl pointer-events-none"
              style={{ left: '50%', top: '50%', marginLeft: -16, marginTop: -16 }}
            >💌</motion.span>

            {/* Tiny feather trail particles dropped by the bird as it passes */}
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, x: '-30vw', y: -80, scale: 0.6 }}
                animate={{
                  opacity: [0, 0.7, 0],
                  x: [`${-30 + i * 5}vw`, `${-22 + i * 5}vw`],
                  y: [-80 + i * 12, 60 + i * 12],
                  rotate: [0, 200 + i * 30],
                }}
                transition={{ duration: 3.4, delay: 0.7 + i * 0.36, ease: 'easeOut' }}
                className="absolute text-base pointer-events-none"
                style={{ left: '50%', top: '50%' }}
              >✨</motion.span>
            ))}

            {/* Drone light show — only for birthday theme. Drones swarm up from below
                right after the bird drops the letter (~3.5s) and lock into a
                "HAPPY BIRTHDAY" formation in the sky above. The first recipient
                name is rendered as a second drone line below the greeting. */}
            {theme.id === 'birthday' && (
              <BirthdayDroneShow delay={3.5} name={capsule.recipient_names?.[0] || ''} />
            )}

            {/* Centre stage — themed celebration around the scroll emoji (~4.7s onwards) */}
            <CelebrationScene theme={theme} delay={4.7} />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              // Delayed for birthday so the user sees the full show before the
              // button competes for attention: text typed-live → cake → heart
              // morph → couple morph → can-lift+pour scene → back to lock (~23s).
              transition={{ delay: theme.id === 'birthday' ? 23 : 6 }}
            >
              <p className="text-[10px] uppercase tracking-[0.3em] mb-2" style={{ color: theme.accentColor }}>From {yearsBurried} years ago</p>
              {/* For birthday theme the drone formation already says "HAPPY
                  BIRTHDAY <name>", so showing the same title would duplicate.
                  Use a romantic tagline that inks in word-by-word with a soft
                  blur + handwritten rotation jitter, set against a pink glow. */}
              {theme.id === 'birthday' ? (
                <div className="inline-block mb-3" style={{ minWidth: '14em' }}>
                  {/* Row 1: plane track — plane has its own line above the
                      tagline so it never overlaps with the words or caption. */}
                  <div className="relative" style={{ height: '1.8em' }}>
                  <motion.span
                    className="absolute pointer-events-none"
                    style={{ top: '0', fontSize: '1.4em', zIndex: 2 }}
                    initial={{ left: '-22%', opacity: 0 }}
                    animate={{ left: '122%', opacity: [0, 1, 1, 0] }}
                    transition={{
                      delay: 23.1,
                      duration: 3.6,
                      times: [0, 0.06, 0.94, 1],
                      ease: 'linear',
                    }}
                  >
                    ✈️
                  </motion.span>
                  {/* Vapour-trail sparkles riding behind the plane */}
                  {Array.from({ length: 5 }).map((_, k) => (
                    <motion.span
                      key={`trail-${k}`}
                      className="absolute pointer-events-none"
                      style={{ top: '0.45em', fontSize: '0.55em', zIndex: 1, color: 'rgba(255,247,214,0.85)' }}
                      initial={{ left: '-22%', opacity: 0 }}
                      animate={{ left: '122%', opacity: [0, 0.7, 0] }}
                      transition={{
                        delay: 23.1 + 0.08 + k * 0.07,
                        duration: 3.6,
                        times: [0, 0.55, 1],
                        ease: 'linear',
                      }}
                    >
                      ✦
                    </motion.span>
                  ))}
                  </div>

                  {/* Row 2: tagline — words drop from the plane track above. */}
                <h2
                  className="text-2xl italic"
                  style={{
                    fontFamily: 'var(--font-caveat), "Caveat", cursive',
                    fontWeight: 500,
                    letterSpacing: '0.01em',
                    color: '#fff7d6',
                    filter: 'drop-shadow(0 0 14px rgba(236,72,153,0.55)) drop-shadow(0 0 28px rgba(168,85,247,0.3))',
                  }}
                >
                  {'A letter the sky kept just for you'.split(' ').map((word, i, arr) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, y: -36, scale: 0.85, rotate: ((i * 13) % 7) - 3 }}
                      animate={{ opacity: 1, y: 0, scale: 1, rotate: ((i * 7) % 3) - 1 }}
                      transition={(() => {
                        const wordCentreFrac = (i + 0.5) / arr.length;
                        const dropOffset = ((wordCentreFrac + 0.22) / 1.44) * 3.6;
                        return { delay: 23.1 + dropOffset, type: 'spring', damping: 11, stiffness: 180 };
                      })()}
                      style={{ display: 'inline-block', whiteSpace: 'pre' }}
                    >
                      {word}{i < arr.length - 1 ? ' ' : ''}
                    </motion.span>
                  ))}
                </h2>
                </div>
              ) : (
                <h2 className="text-2xl font-bold text-white mb-3">{capsule.title}</h2>
              )}

              <button
                onClick={() => setPhase('message')}
                className="block mx-auto rounded-xl px-6 py-3 text-sm font-bold cursor-pointer mt-16"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                Read the message →
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* PHASE: Message — parchment letter with word-by-word reveal */}
        {phase === 'message' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-2xl lg:max-w-4xl px-4 lg:px-8 max-h-[92vh] overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative rounded-2xl px-6 py-9 lg:px-20 lg:py-20 overflow-hidden"
              style={{
                background: theme.bgGradient,
                boxShadow: `0 25px 70px -15px ${theme.accentColor}55, 0 0 80px ${theme.accentColor}20, inset 0 0 50px ${theme.accentColor}28`,
              }}
            >
              {/* Paper grain */}
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none mix-blend-multiply"
                style={{
                  opacity: theme.paperGrainOpacity,
                  backgroundImage: `repeating-linear-gradient(45deg, transparent 0px, transparent 2px, ${theme.secondaryColor}20 2px, ${theme.secondaryColor}20 3px), repeating-linear-gradient(-45deg, transparent 0px, transparent 2px, ${theme.secondaryColor}18 2px, ${theme.secondaryColor}18 3px)`,
                }}
              />

              {/* Themed stamp */}
              <motion.div
                initial={{ scale: 0, rotate: 0, opacity: 0 }}
                animate={{ scale: 1, rotate: -12, opacity: 0.85 }}
                transition={{ delay: LETTER_LAND_DELAY - 0.1, type: 'spring', damping: 12, stiffness: 200 }}
                className="absolute top-4 right-4 lg:top-5 lg:right-5 px-2 py-0.5 text-[9px] font-bold pointer-events-none"
                style={{
                  color: theme.stampColor,
                  border: `2px solid ${theme.stampColor}`,
                  fontFamily: 'monospace',
                  letterSpacing: '0.18em',
                }}
              >
                {theme.stampText}
              </motion.div>

              {/* Top flourish */}
              <div className="flex items-center justify-center gap-2 mb-5" style={{ color: theme.accentColor }}>
                <span className="text-base">{theme.flourish[0]}</span>
                <span className="h-px w-10 lg:w-14" style={{ background: `linear-gradient(90deg, transparent, ${theme.accentColor})` }} />
                <span className="text-xs">{theme.flourish[1]}</span>
                <span className="h-px w-10 lg:w-14" style={{ background: `linear-gradient(-90deg, transparent, ${theme.accentColor})` }} />
                <span className="text-base">{theme.flourish[2]}</span>
              </div>

              {/* Header — title + postal stamp */}
              <div className="text-center mb-7">
                {capsule.role === 'recipient' ? (
                  <div className="flex items-center justify-center gap-2 mb-2.5">
                    {capsule.sender_avatar
                      ? <img src={capsule.sender_avatar} alt="" className="h-6 w-6 rounded-full object-cover" style={{ border: `1.5px solid ${theme.accentColor}` }} />
                      : <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px]" style={{ background: `${theme.accentColor}20`, border: `1.5px solid ${theme.accentColor}` }}>👤</div>}
                    <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: theme.accentColor }}>From {capsule.sender_name || capsule.sender_username || 'Someone'}</p>
                  </div>
                ) : (
                  <p className="text-[10px] uppercase tracking-[0.35em] mb-2.5" style={{ color: theme.accentColor }}>{theme.headerLabel}</p>
                )}
                <div
                  className="inline-block px-3 py-1 text-[10px] font-mono tracking-wider"
                  style={{
                    border: `1.5px dashed ${theme.accentColor}`,
                    color: theme.secondaryColor,
                    transform: 'rotate(-1.5deg)',
                  }}
                >
                  POSTED · {burial.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}
                </div>
              </div>

              {/* Message body — paragraphs with drop cap + interleaved polaroid photos */}
              <div className="text-[15px] lg:text-[17px] font-serif relative" style={{ color: theme.inkColor }}>
                {paragraphs.paragraphs.map((para, pIdx) => {
                  const isFirst = pIdx === 0;
                  const firstWord = para.words[0];
                  const photoForThisPara = inlinePhotoPerParagraph[pIdx];
                  const lastWordIdx = para.words[para.words.length - 1]?.idx ?? 0;

                  return (
                    <div key={pIdx}>
                      <p
                        className="leading-loose"
                        style={{
                          textAlign: 'justify',
                          hyphens: 'auto',
                          marginBottom: pIdx === paragraphs.paragraphs.length - 1 ? 0 : '1.1em',
                        }}
                      >
                        {isFirst && firstWord && (
                          <>
                            {/* Drop cap — first letter of first word */}
                            <motion.span
                              initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
                              animate={{ opacity: 1, scale: 1, rotate: 0 }}
                              transition={{ delay: LETTER_LAND_DELAY - 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                              className="float-left mr-2 leading-none"
                              style={{
                                fontSize: '3.4em',
                                fontWeight: 700,
                                color: theme.accentColor,
                                paddingTop: '0.05em',
                                fontFamily: 'serif',
                                lineHeight: 0.85,
                              }}
                            >
                              {firstWord.text.charAt(0)}
                            </motion.span>
                            {/* Rest of first word */}
                            <motion.span
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: wordDelay(firstWord.idx), duration: 0.5 }}
                              style={{ display: 'inline-block', whiteSpace: 'pre' }}
                            >
                              {firstWord.text.slice(1)}
                            </motion.span>
                          </>
                        )}
                        {(isFirst ? para.words.slice(1) : para.words).map((tok, wi) => (
                          <motion.span
                            key={wi}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: wordDelay(tok.idx), duration: 0.5 }}
                            style={{ display: 'inline-block', whiteSpace: 'pre' }}
                          >
                            {tok.text}
                          </motion.span>
                        ))}
                      </p>

                      {photoForThisPara && (
                        <PolaroidPhoto
                          src={photoForThisPara}
                          rotation={rotations[pIdx] ?? 0}
                          delay={wordDelay(lastWordIdx) + 0.3}
                          caption={burial.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        />
                      )}
                    </div>
                  );
                })}

                {trailingPhotos.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 mt-6">
                    {trailingPhotos.map((src, i) => (
                      <PolaroidPhoto
                        key={i}
                        src={src}
                        rotation={rotations[paragraphs.paragraphs.length + i] ?? 0}
                        delay={messageEndDelay + 0.2 + i * 0.15}
                        caption={burial.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        compact
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Signature */}
              <motion.p
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: messageEndDelay + 0.4, duration: 0.8 }}
                className="text-right mt-8 text-[15px] italic font-serif"
                style={{ color: theme.secondaryColor }}
              >
                {capsule.role === 'recipient'
                  ? `— ${capsule.sender_name || capsule.sender_username || 'Yours'}, ${burial.getFullYear()}`
                  : `${theme.signaturePrefix}, ${burial.getFullYear()}`}
              </motion.p>

              {/* Bottom flourish */}
              <div className="flex items-center justify-center gap-2 mt-6" style={{ color: theme.accentColor }}>
                <span className="h-px w-10" style={{ background: `linear-gradient(90deg, transparent, ${theme.accentColor})` }} />
                <span className="text-xs">{theme.bottomFlourish}</span>
                <span className="h-px w-10" style={{ background: `linear-gradient(-90deg, transparent, ${theme.accentColor})` }} />
              </div>
            </motion.div>

            <motion.button
              onClick={() => photos.length > 0 ? setPhase('photos') : setPhase('reply')}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: messageEndDelay + 0.9, duration: 0.5 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full rounded-xl py-3 text-sm font-bold cursor-pointer mt-5"
              style={{
                background: theme.buttonGradient,
                color: 'white',
                boxShadow: `0 10px 30px -8px ${theme.accentColor}80`,
              }}
            >{photos.length > 0 ? `View ${photos.length} photo${photos.length > 1 ? 's' : ''} →` : 'Continue →'}</motion.button>
          </motion.div>
        )}

        {/* PHASE: Photos */}
        {phase === 'photos' && photos.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-md px-6 text-center"
          >
            <motion.img
              key={photoIdx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              src={photos[photoIdx]}
              alt=""
              className="w-full rounded-2xl mb-4 max-h-[60vh] object-cover"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            />

            <div className="flex items-center justify-center gap-2 mb-4">
              {photos.map((_, i) => (
                <div key={i} className="h-1.5 rounded-full transition-all" style={{
                  width: i === photoIdx ? 16 : 6,
                  background: i === photoIdx ? '#a855f7' : 'rgba(255,255,255,0.2)',
                }} />
              ))}
            </div>

            <div className="flex gap-2">
              {photoIdx > 0 && (
                <button onClick={() => setPhotoIdx(i => i - 1)} className="rounded-xl px-4 py-2.5 text-xs cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)', color: '#a3adc3' }}>← Prev</button>
              )}
              {photoIdx < photos.length - 1 ? (
                <button onClick={() => setPhotoIdx(i => i + 1)} className="flex-1 rounded-xl py-2.5 text-xs font-bold cursor-pointer" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>Next →</button>
              ) : (
                <button onClick={() => setPhase('reply')} className="flex-1 rounded-xl py-2.5 text-xs font-bold cursor-pointer" style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white' }}>Continue →</button>
              )}
            </div>
          </motion.div>
        )}

        {/* PHASE: Reply / Share */}
        {phase === 'reply' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md px-6 text-center"
          >
            <div className="text-5xl mb-3">💝</div>
            <h2 className="text-xl font-bold text-white mb-2">Memory unlocked</h2>
            <p className="text-xs text-[#4a5068] mb-6">
              Buried {yearsBurried} years ago at {capsule.location_name || 'this spot'}
            </p>

            <div className="space-y-2">
              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white' }}
              >
                <Share2 size={15} /> Share this moment
              </button>
              <button
                onClick={onClose}
                className="w-full rounded-xl py-3 text-sm font-semibold cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#a3adc3' }}
              >
                <Heart size={13} className="inline mr-1.5" /> Keep this memory
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function PolaroidPhoto({ src, rotation, delay, caption, compact }: { src: string; rotation: number; delay: number; caption?: string; compact?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, rotate: 0, y: 12 }}
      animate={{ opacity: 1, scale: 1, rotate: rotation, y: 0 }}
      transition={{ delay, duration: 0.7, type: 'spring', damping: 14, stiffness: 130 }}
      className={`relative ${compact ? '' : 'my-5 mx-auto'} block`}
      style={{
        background: '#fbfaf6',
        padding: compact ? '6px 6px 22px' : '8px 8px 28px',
        boxShadow: '0 12px 32px -8px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.2)',
        maxWidth: compact ? '100%' : '70%',
        width: compact ? 'auto' : 'fit-content',
        clear: 'both',
      }}
    >
      <img src={src} alt="" className="block w-full" style={{ minWidth: compact ? 100 : 180, maxHeight: compact ? 200 : 280, objectFit: 'cover' }} />
      {caption && (
        <p
          className={`absolute left-0 right-0 text-center ${compact ? 'text-[9px]' : 'text-[11px]'}`}
          style={{
            bottom: compact ? 4 : 6,
            color: '#7a6248',
            fontFamily: '"Caveat", "Comic Sans MS", cursive',
            letterSpacing: '0.05em',
          }}
        >
          {caption}
        </p>
      )}
    </motion.div>
  );
}

// Per-theme celebration emoji for the confetti burst around the scroll emoji
const CELEBRATION_EMOJIS: Record<string, string[]> = {
  birthday:    ['🎉', '🎊', '✨', '🎈', '⭐', '🌟', '💫', '🎁'],
  love:        ['❤️', '💕', '💖', '✨', '🌹', '💘', '🌸'],
  child:       ['🌟', '✨', '💫', '🎀', '🌸', '🍼', '⭐'],
  travel:      ['✈️', '⭐', '✨', '☁️', '🌤️', '🗺️', '🧭'],
  milestone:   ['⭐', '🌟', '✨', '🏆', '👑', '💫', '🎊'],
  classic:     ['✨', '⭐', '🌟', '💫', '☄️'],
};

function CelebrationScene({ theme, delay }: { theme: { id: string; scrollEmoji: string; accentColor: string }; delay: number }) {
  const emojis = CELEBRATION_EMOJIS[theme.id] || CELEBRATION_EMOJIS.classic;
  const isBirthday = theme.id === 'birthday';
  const confettiCount = isBirthday ? 18 : 12;

  // Pre-compute starburst positions so the layout is stable across renders
  const confetti = useMemo(() => Array.from({ length: confettiCount }).map((_, i) => {
    const angle = (i / confettiCount) * Math.PI * 2 + (i % 2 === 0 ? 0 : 0.18);
    const distance = 110 + ((i * 37) % 70);
    return {
      tx: Math.cos(angle) * distance,
      ty: Math.sin(angle) * distance - 24,
      rot: (i * 113) % 720 + 360,
      emoji: emojis[i % emojis.length],
      size: 18 + ((i * 7) % 14),
      stagger: (i * 0.04) % 0.5,
    };
  }), [confettiCount, emojis]);

  // Balloons float up only on birthday + milestone
  const showBalloons = isBirthday || theme.id === 'milestone';
  const balloons = useMemo(() => showBalloons ? [
    { x: -120, color: '🎈', delay: 0.0, drift: -10, hue: 0 },
    { x: -50, color: '🎈', delay: 0.25, drift: 14, hue: 60 },
    { x: 60, color: '🎈', delay: 0.45, drift: -8, hue: 200 },
    { x: 130, color: '🎈', delay: 0.65, drift: 18, hue: 280 },
  ] : [], [showBalloons]);

  return (
    <div className="relative mb-6 flex items-center justify-center" style={{ minHeight: 180, minWidth: 180 }}>
      {/* Light burst when letter lands */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 3, 5], opacity: [0, 1, 0] }}
        transition={{ duration: 1.8, delay }}
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.6), rgba(168,85,247,0.3), transparent 70%)' }}
      />

      {/* Confetti starburst — particles fly outward then fade */}
      {confetti.map((c, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            x: [0, c.tx],
            y: [0, c.ty],
            scale: [0, 1.15, 1, 0.6],
            rotate: [0, c.rot],
          }}
          transition={{ duration: 1.6, delay: delay + 0.2 + c.stagger, ease: [0.18, 0.7, 0.4, 1], times: [0, 0.2, 0.65, 1] }}
          className="absolute pointer-events-none"
          style={{ fontSize: c.size, left: '50%', top: '50%', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
        >{c.emoji}</motion.span>
      ))}

      {/* Balloons rising up from below */}
      {balloons.map((b, i) => (
        <motion.span
          key={`b-${i}`}
          initial={{ opacity: 0, x: b.x, y: 220, rotate: -8, scale: 0.85 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [220, 30, -260],
            x: [b.x, b.x + b.drift, b.x + b.drift * 2],
            rotate: [-8, 6, -4],
            scale: [0.85, 1, 1],
          }}
          transition={{ duration: 4.2, delay: delay + 0.4 + b.delay, ease: 'easeOut', times: [0, 0.5, 1] }}
          className="absolute text-4xl pointer-events-none"
          style={{ left: '50%', top: '50%', filter: `hue-rotate(${b.hue}deg) drop-shadow(0 6px 10px rgba(0,0,0,0.35))` }}
        >{b.color}</motion.span>
      ))}

      {/* Sparkle ring orbiting the centre piece */}
      {Array.from({ length: 6 }).map((_, i) => {
        const orbitAngle = (i / 6) * 360;
        return (
          <motion.span
            key={`s-${i}`}
            initial={{ opacity: 0, rotate: orbitAngle }}
            animate={{
              opacity: [0, 0.9, 0.9, 0],
              rotate: [orbitAngle, orbitAngle + 360],
            }}
            transition={{
              opacity: { duration: 4, delay: delay + 0.5, times: [0, 0.15, 0.85, 1] },
              rotate: { duration: 6, delay: delay + 0.5, ease: 'linear', repeat: Infinity },
            }}
            className="absolute pointer-events-none text-sm"
            style={{ left: '50%', top: '50%', transformOrigin: '0 -78px', marginLeft: -4, marginTop: -4 }}
          >✨</motion.span>
        );
      })}

      {/* Centre piece — scroll emoji bursts in then breathes gently. For the
          birthday theme the cake is rendered as a drone formation instead, so
          we skip the emoji centrepiece (the empty box still reserves layout). */}
      {!isBirthday && (
        <motion.div
          initial={{ scale: 0, opacity: 0, rotate: 25 }}
          animate={{ scale: [0, 1.3, 1], opacity: 1, rotate: [25, -8, 0] }}
          transition={{ duration: 1, delay, times: [0, 0.55, 1], ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10"
        >
          <motion.div
            animate={{ y: [0, -5, 0], rotate: [-2, 2, -2] }}
            transition={{ duration: 3.4, delay: delay + 1.2, repeat: Infinity, ease: 'easeInOut' }}
            className="text-8xl"
            style={{ filter: `drop-shadow(0 8px 20px ${theme.accentColor}60)` }}
          >
            {theme.scrollEmoji}
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

// ─── Birthday drone show ────────────────────────────────────────────────────
// 5x7 bitmap font for the letters in "HAPPY BIRTHDAY". Each lit cell becomes
// one drone (a small glowing point of light) in the formation.
const LETTER_BITMAPS: Record<string, number[][]> = {
  H: [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  A: [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  P: [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
  ],
  Y: [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,0,1,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
  ],
  B: [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
  ],
  I: [
    [1,1,1,1,1],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [1,1,1,1,1],
  ],
  R: [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
    [1,1,0,0,0],
    [1,0,1,0,0],
    [1,0,0,1,1],
  ],
  T: [
    [1,1,1,1,1],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
  ],
  D: [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
  ],
  C: [
    [0,1,1,1,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [0,1,1,1,1],
  ],
  E: [
    [1,1,1,1,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,1],
  ],
  F: [
    [1,1,1,1,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
  ],
  G: [
    [0,1,1,1,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,1],
  ],
  J: [
    [0,0,1,1,1],
    [0,0,0,1,0],
    [0,0,0,1,0],
    [0,0,0,1,0],
    [0,0,0,1,0],
    [1,0,0,1,0],
    [0,1,1,0,0],
  ],
  K: [
    [1,0,0,0,1],
    [1,0,0,1,0],
    [1,0,1,0,0],
    [1,1,0,0,0],
    [1,0,1,0,0],
    [1,0,0,1,0],
    [1,0,0,0,1],
  ],
  L: [
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,1],
  ],
  M: [
    [1,0,0,0,1],
    [1,1,0,1,1],
    [1,0,1,0,1],
    [1,0,1,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  N: [
    [1,0,0,0,1],
    [1,1,0,0,1],
    [1,0,1,0,1],
    [1,0,1,0,1],
    [1,0,0,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  O: [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  Q: [
    [0,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,1,0,1],
    [1,0,0,1,0],
    [0,1,1,0,1],
  ],
  S: [
    [0,1,1,1,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [0,1,1,1,0],
    [0,0,0,0,1],
    [0,0,0,0,1],
    [1,1,1,1,0],
  ],
  U: [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,1,1,0],
  ],
  V: [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,0,1,0],
    [0,0,1,0,0],
  ],
  W: [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,1,0,1],
    [1,0,1,0,1],
    [1,1,0,1,1],
    [1,0,0,0,1],
  ],
  X: [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,0,1,0],
    [0,0,1,0,0],
    [0,1,0,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  Z: [
    [1,1,1,1,1],
    [0,0,0,0,1],
    [0,0,0,1,0],
    [0,0,1,0,0],
    [0,1,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,1],
  ],
};

// Goblet/champagne flute silhouette with two-tone liquid inside.
// Cells: 1 = red liquid (top layer), 2 = white glass outline,
// 3 = blue liquid (bottom layer). 10 wide × 17 tall.
const GOBLET_BITMAP: number[][] = [
  [0,2,2,2,2,2,2,2,2,0], // rim (white)
  [2,2,1,1,1,1,1,1,2,2], // upper liquid red
  [2,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,2],
  [2,3,3,3,3,3,3,3,3,2], // lower liquid blue layer
  [0,2,2,3,3,3,3,2,2,0],
  [0,0,2,2,2,2,2,2,0,0], // bowl narrowing
  [0,0,0,2,2,2,2,0,0,0], // bowl bottom
  [0,0,0,0,2,2,0,0,0,0], // stem
  [0,0,0,0,2,2,0,0,0,0],
  [0,0,0,0,2,2,0,0,0,0],
  [0,0,0,0,2,2,0,0,0,0],
  [0,0,0,0,2,2,0,0,0,0],
  [0,0,0,2,2,2,2,0,0,0], // foot widening
  [0,0,2,2,2,2,2,2,0,0],
  [0,2,2,2,2,2,2,2,2,0],
  [2,2,2,2,2,2,2,2,2,2], // base
];

// Cylindrical can silhouette (vertical at design time) — rectangle with
// rounded white lids top + bottom, red body in between. At render the cell
// positions are rotated counter-clockwise so the can leans with its body
// crossing the sky like a tilted soda can. Cells: 1 = red body, 2 = white
// lid edge. 8 wide × 16 tall.
const BOTTLE_BITMAP: number[][] = [
  [0,2,2,2,2,2,2,0], // top lid (rounded)
  [2,2,2,2,2,2,2,2], // top lid full width
  [1,1,1,1,1,1,1,1], // red body
  [1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1],
  [2,2,2,2,2,2,2,2], // bottom lid full width
  [0,2,2,2,2,2,2,0], // bottom lid (rounded)
];

// Romantic couple silhouette — two people standing close, heads slightly apart
// with a small heart hovering between them. 20 wide × 17 tall. Used as the
// second morph after the heart, so the show reads as: text → heart → couple.
const COUPLE_BITMAP: number[][] = [
  [0,0,1,1,1,0,0,0,1,0,1,0,0,0,0,1,1,1,0,0], // heads top + heart top points
  [0,1,1,1,1,1,0,1,1,1,1,0,0,0,1,1,1,1,1,0], // heads wider + heart widest band
  [0,1,1,1,1,1,0,0,1,1,0,0,0,0,1,1,1,1,1,0], // heads + heart middle
  [0,0,1,1,1,0,0,0,0,1,0,0,0,0,0,1,1,1,0,0], // necks + heart bottom point
  [1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,0], // shoulders
  [1,1,1,1,1,1,1,1,0,0,0,1,1,1,1,1,1,1,1,0], // shoulders + arm reach
  [0,1,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,1,0], // torso
  [0,1,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,1,0],
  [0,1,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,1,0],
  [0,1,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,1,0], // waist
  [0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0], // hips
  [0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0],
  [0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0], // legs split
  [0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0],
  [0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0],
  [0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0],
  [0,1,1,0,1,1,0,0,0,0,0,0,0,0,1,1,0,1,1,0], // feet
];

// Filled heart silhouette used for the temporary morph. 17 wide × 14 tall.
// Drones rearrange into this shape mid-show, hold for ~1.5s, then fly back to
// their letter / cake positions. Symmetric around col 8.
const HEART_BITMAP: number[][] = [
  [0,0,1,1,1,0,0,0,0,0,0,0,1,1,1,0,0],
  [0,1,1,1,1,1,1,0,0,0,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
];

// Cake silhouette with 3 candles. 15 wide × 12 tall.
// 1 = standard drone, 2 = flame drone (warm + flicker), 0 = empty.
const CAKE_BITMAP: number[][] = [
  [0,0,0,0,0,2,0,2,0,2,0,0,0,0,0],   // flame tips (3 candles at cols 5, 7, 9)
  [0,0,0,0,0,2,0,2,0,2,0,0,0,0,0],   // flame mids
  [0,0,0,0,0,2,0,2,0,2,0,0,0,0,0],   // flame bases (touching wick)
  [0,0,0,0,0,1,0,1,0,1,0,0,0,0,0],   // wick tops
  [0,0,0,0,0,1,0,1,0,1,0,0,0,0,0],   // candle bodies
  [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],   // frosting top edge
  [0,0,1,0,0,1,0,0,0,1,0,0,1,0,0],   // frosting drips
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0],   // cake top edge (full width)
  [0,1,0,0,0,0,0,0,0,0,0,0,0,1,0],   // cake side
  [0,1,0,0,0,0,0,0,0,0,0,0,0,1,0],   // cake side
  [0,1,0,0,0,0,0,0,0,0,0,0,0,1,0],   // cake side
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0],   // cake bottom
];


type DroneKind = 'std' | 'flame';

interface DronePoint {
  // Final locked position in formation
  x: number;
  y: number;
  // Launch pad position (cluster on the ground)
  launchX: number;
  launchY: number;
  // Mid-arc position (high up, sweeping toward target)
  midX: number;
  midY: number;
  // Approach hover position (just before locking, slight overshoot)
  approachX: number;
  approachY: number;
  // Subtle in-formation wobble — drones GPS-correct around their lock spot
  wobbleX: number;
  wobbleY: number;
  pulseDur: number;
  pulseDelay: number;
  // Tiny per-drone variation so launches don't fire in lockstep
  launchJitter: number;
  idx: number;
  // 'flame' drones use a warm gradient + faster, bigger flicker
  kind: DroneKind;
  // ~15% of std drones are tagged "sparkle" — bigger size, brighter core,
  // dramatic flicker so the formation actually twinkles like a real LED show.
  sparkle: boolean;
  // Logical "letter slot" — drones in the same letter share this. Used to
  // sequence letters so the formation appears typed (H… HA… HAP… …).
  letterIdx: number;
  // Target position when the formation morphs into a heart shape (mid-show
  // surprise). Each drone is assigned a heart cell by index modulo so heart
  // cells with multiple drones simply burn brighter.
  heartX: number;
  heartY: number;
  // Target position for the couple-silhouette morph that follows the heart.
  coupleX: number;
  coupleY: number;
  // Target position for the princess-scene morph (princess + crown-cake) that
  // follows the couple morph.
  princessX: number;
  princessY: number;
  // Colour zone the drone adopts during the princess phase ('gold' | 'blue'
  // | 'white' | 'red'). Outside that phase the drone uses its default gold.
  princessZone?: 'gold' | 'blue' | 'white' | 'red';
  // Liquid-fill delay (seconds) — set only on goblet liquid drones so the
  // glass appears to fill bottom-up as the can pours during princess phase.
  fillDelay?: number;
  // Pre-pour "lift" position for can drones — vertical (un-rotated), lower
  // than the final tilted pose. The drone goes couple → lift → tilted-final
  // so the can looks like it's being picked up and angled to pour.
  liftX?: number;
  liftY?: number;
  // Wish-blow metadata — tells the render layer when to extinguish flames in
  // candle order and which drones belong to the cake (so the cake can fade
  // into a 💝 emoji once the wish is granted).
  isCake: boolean;
  candleOrder?: number;
}

// Build a drone with a clustered-launch + arc trajectory toward (tx, ty).
// Three launch pads (left/center/right) chosen by the target's horizontal side
// give the show a natural fan-out look.
function buildDronePoint(
  tx: number,
  ty: number,
  idx: number,
  kind: DroneKind = 'std',
  letterIdx: number = 0,
  isCake: boolean = false,
  candleOrder?: number,
): DronePoint {
  let padX: number;
  if (tx < -40) padX = -190 + (Math.random() - 0.5) * 70;
  else if (tx > 40) padX = 190 + (Math.random() - 0.5) * 70;
  else padX = (Math.random() - 0.5) * 90;
  const launchY = 380 + Math.random() * 50;

  // Arc midpoint — pulled toward target with horizontal sway and pulled UP so
  // the path rises high before descending into formation (drones don't fly
  // straight; they climb, drift, then settle).
  const midX = (padX + tx) / 2 + (Math.random() - 0.5) * 110;
  const midY = launchY * 0.22 + ty * 0.6 - 40 + (Math.random() - 0.5) * 50;

  // Approach point — close to target with mild overshoot (real drones
  // momentarily overshoot then GPS-correct in).
  const approachX = tx + (Math.random() - 0.5) * 32;
  const approachY = ty + (Math.random() - 0.5) * 24;

  const isFlame = kind === 'flame';
  return {
    x: tx,
    y: ty,
    launchX: padX,
    launchY,
    midX,
    midY,
    approachX,
    approachY,
    // Flames flicker harder than the formation pulse — bigger wobble + faster cycle.
    wobbleX: isFlame ? 1.4 + Math.random() * 1.8 : 0.7 + Math.random() * 1.4,
    wobbleY: isFlame ? 1.2 + Math.random() * 1.6 : 0.5 + Math.random() * 1.1,
    pulseDur: isFlame ? 0.4 + Math.random() * 0.45 : 2.0 + Math.random() * 2.0,
    pulseDelay: Math.random() * (isFlame ? 0.4 : 1.8),
    launchJitter: (Math.random() - 0.5) * 0.18,
    idx,
    kind,
    sparkle: !isFlame && Math.random() < 0.15,
    letterIdx,
    heartX: 0, // heart/couple/princess targets are filled in by post-passes
    heartY: 0,
    coupleX: 0,
    coupleY: 0,
    princessX: 0,
    princessY: 0,
    isCake,
    candleOrder,
  };
}

// Strip diacritics + non-letter chars from a name and uppercase it so the
// bitmap font (ASCII A–Z only) can render Vietnamese names like "Nguyễn" → "NGUYEN".
function normalizeNameForDrones(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 14); // hard cap so very long names don't blow past the formation width
}

// Compute the rendered width (in px) of one bitmap-font line.
function measureLineWidth(line: string, cellSize: number, letterCols: number, letterGap: number, wordGap: number): number {
  return line.split('').reduce((sum, c, i, arr) => {
    const w = c === ' ' ? wordGap : letterCols * cellSize;
    const gap = i === arr.length - 1 ? 0 : (arr[i + 1] === ' ' || c === ' ' ? 0 : letterGap);
    return sum + w + gap;
  }, 0);
}

// Lay drones along a bitmap-font line at vertical offset `lineY`, pushing them
// into `points`. Returns the next available letterIdx so callers can chain
// lines (greeting → recipient name → cake) into one monotonic sequence used
// by the typed-live reveal pacing.
function layoutLine(
  line: string,
  lineY: number,
  cellSize: number,
  letterCols: number,
  letterGap: number,
  wordGap: number,
  points: DronePoint[],
  startLetterIdx: number,
): number {
  const lineW = measureLineWidth(line, cellSize, letterCols, letterGap, wordGap);
  let cursor = -lineW / 2;
  let li = startLetterIdx;
  line.split('').forEach((char, i, arr) => {
    if (char === ' ') {
      cursor += wordGap;
      li += 1; // count space as a slot so the pause reads as deliberate
      return;
    }
    const bm = LETTER_BITMAPS[char];
    if (!bm) {
      li += 1;
      return; // unknown char — still consumes a slot
    }
    bm.forEach((row, ry) => {
      row.forEach((cell, cx) => {
        if (cell === 1) {
          points.push(buildDronePoint(cursor + cx * cellSize, lineY + ry * cellSize, points.length, 'std', li));
        }
      });
    });
    cursor += letterCols * cellSize;
    if (i < arr.length - 1 && arr[i + 1] !== ' ') cursor += letterGap;
    li += 1;
  });
  return li;
}

// Easing functions matching framer-motion's per-segment eases used in the
// drone arc. Trails approximate the same path so the comet tails line up with
// the live drone positions.
const easeInQuad = (x: number) => x * x;
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const cubicOut = (x: number) => 1 - Math.pow(1 - x, 3);

const ARC_STOPS = [0, 0.42, 0.85, 1] as const;
const ARC_EASES: Array<(t: number) => number> = [easeInQuad, easeInOut, cubicOut];
const ARC_DURATION = 3.6;

function getDronePosition(d: DronePoint, progress: number): [number, number] {
  if (progress <= 0) return [d.launchX, d.launchY];
  if (progress >= 1) return [d.x, d.y];
  const xs = [d.launchX, d.midX, d.approachX, d.x];
  const ys = [d.launchY, d.midY, d.approachY, d.y];
  for (let i = 0; i < 3; i++) {
    if (progress <= ARC_STOPS[i + 1]) {
      const span = ARC_STOPS[i + 1] - ARC_STOPS[i];
      const local = ARC_EASES[i]((progress - ARC_STOPS[i]) / span);
      return [xs[i] + (xs[i + 1] - xs[i]) * local, ys[i] + (ys[i + 1] - ys[i]) * local];
    }
  }
  return [d.x, d.y];
}

function BirthdayDroneShow({ delay, name }: { delay: number; name: string }) {
  const sceneData = useMemo<{ points: DronePoint[]; mouthX: number; mouthY: number; rimX: number; rimY: number; cellSize: number }>(() => {
    // Greeting + optional recipient name on a second line below.
    const greeting = 'HAPPY BIRTHDAY';
    const recipientLine = normalizeNameForDrones(name);
    if (typeof window !== 'undefined') {
      console.log('[BirthdayDroneShow] name input:', JSON.stringify(name), '→ normalized:', JSON.stringify(recipientLine));
    }

    const letterCols = 5;
    const greetingCellsWide = 79; // see measureLineWidth math: 13 letters @5 + 11 gaps + 1 word-gap (3)
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1100;
    // On desktop let the line span up to ~1500px with cells up to 16px so
    // HAPPY BIRTHDAY dominates the sky. Mobile/tablet scale down naturally.
    const targetWidth = Math.min(vw - 32, 1500);
    const cellSize = Math.max(2, Math.min(Math.floor(targetWidth / greetingCellsWide), 16));
    const letterGap = cellSize;
    const wordGap = cellSize * 3;
    const lineHeight = 7 * cellSize;
    // Recipient line uses a slightly smaller cell so the name reads as a subtitle.
    const nameCellSize = Math.max(2, Math.round(cellSize * 0.78));
    const nameLineHeight = 7 * nameCellSize;
    const lineSpacing = cellSize * 2.4;

    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    // Pull the formation a touch lower so HAPPY BIRTHDAY isn't kissing the
    // top of the viewport — leaves headroom for shooting stars + the close
    // button. 28% of viewport with 280px cap.
    const formationOffsetY = -Math.max(180, Math.min(vh * 0.28, 280));
    // Stack greeting on top, name below; centre the whole stack on formationOffsetY.
    const totalStackHeight = lineHeight + (recipientLine ? lineSpacing + nameLineHeight : 0);
    const stackTop = formationOffsetY - totalStackHeight / 2;
    const greetingY = stackTop;
    const nameY = stackTop + lineHeight + lineSpacing;

    const points: DronePoint[] = [];
    let nextLetterIdx = 0;
    nextLetterIdx = layoutLine(greeting, greetingY, cellSize, letterCols, letterGap, wordGap, points, nextLetterIdx);
    // Small "breath" between the greeting and the recipient name.
    nextLetterIdx += 2;
    if (recipientLine) {
      nextLetterIdx = layoutLine(recipientLine, nameY, nameCellSize, letterCols, nameCellSize, nameCellSize * 3, points, nextLetterIdx);
    }
    // Cake assembles after the text, all of its drones sharing one letter slot
    // so the cake "pops in" rather than building dot-by-dot.
    const cakeLetterIdx = nextLetterIdx + 1;

    // Cake formation — drones replace the cake emoji. Anchored slightly above
    // the screen centre so the title text "From X years ago" + button below
    // remain readable. Cake cell size is independent of the text cell size so
    // the cake can stay a consistent visual weight across viewports.
    const cakeCols = CAKE_BITMAP[0].length;
    const cakeRows = CAKE_BITMAP.length;
    const cakeCell = Math.max(5, Math.min(Math.floor((vw - 32) / 28), 8));
    const cakeWidth = cakeCols * cakeCell;
    const cakeHeight = cakeRows * cakeCell;
    const cakeOffsetY = -60; // matches where the cake emoji sat
    const cakeStartX = -cakeWidth / 2;
    const cakeStartY = cakeOffsetY - cakeHeight / 2;

    CAKE_BITMAP.forEach((row, ry) => {
      row.forEach((cell, cx) => {
        if (cell === 1 || cell === 2) {
          const kind: DroneKind = cell === 2 ? 'flame' : 'std';
          // Flame drones live above cake cols 5, 7, 9 → candles 0, 1, 2.
          let candleOrder: number | undefined;
          if (kind === 'flame') {
            if (cx === 5) candleOrder = 0;
            else if (cx === 7) candleOrder = 1;
            else if (cx === 9) candleOrder = 2;
          }
          points.push(buildDronePoint(
            cakeStartX + cx * cakeCell,
            cakeStartY + ry * cakeCell,
            points.length,
            kind,
            cakeLetterIdx,
            true,            // isCake — every cake/flame drone is part of the cake group
            candleOrder,
          ));
        }
      });
    });

    // Heart morph target positions — every drone gets one heart cell assigned
    // by index modulo. Cells with multiple drones simply look brighter.
    const heartCols = HEART_BITMAP[0].length;
    const heartRows = HEART_BITMAP.length;
    const heartCellSize = Math.max(4, Math.min(Math.floor(vw / 36), 12));
    const heartW = heartCols * heartCellSize;
    const heartH = heartRows * heartCellSize;
    const heartLeft = -heartW / 2;
    const heartTop = -heartH / 2; // centred at screen middle (y=0)
    const heartCells: Array<[number, number]> = [];
    HEART_BITMAP.forEach((row, ry) => {
      row.forEach((cell, cx) => {
        if (cell === 1) heartCells.push([heartLeft + cx * heartCellSize, heartTop + ry * heartCellSize]);
      });
    });
    if (heartCells.length > 0) {
      // Shuffle drone-to-heart-cell mapping so the morph isn't a perfect
      // top-letter-to-top-heart sweep — looks more like a swarm reorganising.
      points.forEach((p, i) => {
        const cellIdx = (i * 37 + 11) % heartCells.length;
        const [hx, hy] = heartCells[cellIdx];
        p.heartX = hx;
        p.heartY = hy;
      });
    }

    // Couple morph target positions — same modulo trick, different prime so
    // drones take a different path through the swarm than during the heart.
    const coupleCols = COUPLE_BITMAP[0].length;
    const coupleRows = COUPLE_BITMAP.length;
    const coupleCellSize = Math.max(4, Math.min(Math.floor(vw / 36), 12));
    const coupleW = coupleCols * coupleCellSize;
    const coupleH = coupleRows * coupleCellSize;
    const coupleLeft = -coupleW / 2;
    const coupleTop = -coupleH / 2;
    const coupleCells: Array<[number, number]> = [];
    COUPLE_BITMAP.forEach((row, ry) => {
      row.forEach((cell, cx) => {
        if (cell === 1) coupleCells.push([coupleLeft + cx * coupleCellSize, coupleTop + ry * coupleCellSize]);
      });
    });
    if (coupleCells.length > 0) {
      points.forEach((p, i) => {
        const cellIdx = (i * 53 + 7) % coupleCells.length;
        const [cxp, cyp] = coupleCells[cellIdx];
        p.coupleX = cxp;
        p.coupleY = cyp;
      });
    }

    // Champagne-pour scene morph — vertical goblet on the left + tilted bottle
    // on the right (mouth pointed toward the goblet, classic pouring pose).
    // Both share one cell pool so drones distribute across both halves.
    const sceneCellSize = Math.max(4, Math.min(Math.floor(vw / 38), 12));
    const gobletCols = GOBLET_BITMAP[0].length;
    const gobletRows = GOBLET_BITMAP.length;
    const bottleCols = BOTTLE_BITMAP[0].length;
    const bottleRows = BOTTLE_BITMAP.length;

    // Goblet sits to the left of centre, vertically.
    const gobletAnchorX = -sceneCellSize * 8;
    const gobletAnchorY = sceneCellSize * 2;
    const gobletLeft = gobletAnchorX - (gobletCols * sceneCellSize) / 2;
    const gobletTop = gobletAnchorY - (gobletRows * sceneCellSize) / 2;

    // Glass rim screen position — used to anchor the can so its lower-left
    // end (after rotation) hovers far above the rim, leaving room for an
    // animated pour stream between them.
    const gobletRimX = gobletAnchorX;
    const gobletRimY = gobletTop;

    // Can leans 35° counter-clockwise. With that rotation, the bitmap's
    // bottom-row (the "mouth"/pouring lid) ends up at the lower-left of the
    // can. We solve for the can centre so the lower-left lid sits up-and-
    // right of the rim with enough gap for the pour-stream animation.
    const bottleCx = (bottleCols - 1) / 2;
    const bottleCy = (bottleRows - 1) / 2;
    const bottleAngle = Math.PI * (35 / 180); // 35° CCW
    const cosA = Math.cos(bottleAngle);
    const sinA = Math.sin(bottleAngle);
    const lowerEndDx = 0 * cosA - (bottleCy * sceneCellSize) * sinA;
    const lowerEndDy = 0 * sinA + (bottleCy * sceneCellSize) * cosA;
    // Wide gap: 9 cells right and 7 cells above the rim — matches reference.
    const bottleAnchorX = gobletRimX + sceneCellSize * 9 - lowerEndDx;
    const bottleAnchorY = gobletRimY - sceneCellSize * 7 - lowerEndDy;

    type SceneZone = 'gold' | 'blue' | 'white' | 'red';
    // [x, y, zone, optional fill-delay (sec), optional lift-x, optional lift-y]
    type SceneCell = [number, number, SceneZone, number?, number?, number?];
    const sceneCells: SceneCell[] = [];

    // Pre-pour lift position for the can — vertical (un-rotated), placed
    // lower so the can visibly "rises" up before tilting into the final pour.
    const liftAnchorX = bottleAnchorX;
    const liftAnchorY = gobletRimY + sceneCellSize * 6;

    // Liquid spans rows 1..5 of the goblet bitmap. Bottom rows fill first;
    // higher rows wait longer so the drink visually rises in the glass.
    const LIQUID_TOP_ROW = 1;
    const LIQUID_BOTTOM_ROW = 5;
    const FILL_PER_ROW = 0.4; // seconds per row

    // Goblet (vertical placement)
    GOBLET_BITMAP.forEach((row, ry) => {
      row.forEach((cell, cx) => {
        if (cell === 0) return;
        const zone: SceneZone = cell === 1 ? 'red' : cell === 2 ? 'white' : 'blue';
        let fillDelay: number | undefined;
        if ((cell === 1 || cell === 3) && ry >= LIQUID_TOP_ROW && ry <= LIQUID_BOTTOM_ROW) {
          fillDelay = (LIQUID_BOTTOM_ROW - ry) * FILL_PER_ROW;
        }
        sceneCells.push([gobletLeft + cx * sceneCellSize, gobletTop + ry * sceneCellSize, zone, fillDelay]);
      });
    });

    // Bottle (rotated). Each cell also stores its lift target — the same
    // bitmap position rendered un-rotated at the lower anchor — so the can
    // can morph couple → lift (vertical low) → final-tilted (high pouring).
    BOTTLE_BITMAP.forEach((row, ry) => {
      row.forEach((cell, cx) => {
        if (cell === 0) return;
        const zone: SceneZone = cell === 1 ? 'red' : 'white';
        const lx = (cx - bottleCx) * sceneCellSize;
        const ly = (ry - bottleCy) * sceneCellSize;
        const rx = lx * cosA - ly * sinA;
        const ryRot = lx * sinA + ly * cosA;
        const finalX = bottleAnchorX + rx;
        const finalY = bottleAnchorY + ryRot;
        const liftX = liftAnchorX + lx;
        const liftY = liftAnchorY + ly;
        sceneCells.push([finalX, finalY, zone, undefined, liftX, liftY]);
      });
    });

    // Liquid pour stream is rendered separately as an animated layer in JSX
    // (see PourStream below) so it can flow continuously instead of being a
    // static line. Expose the mouth + rim coords needed by that animation.
    const mouthX = bottleAnchorX + lowerEndDx;
    const mouthY = bottleAnchorY + lowerEndDy;

    if (sceneCells.length > 0) {
      points.forEach((p, i) => {
        // Different prime so swarm path differs from heart/couple morphs.
        const cellIdx = (i * 71 + 13) % sceneCells.length;
        const [sx, sy, zone, fd, lx, ly] = sceneCells[cellIdx];
        p.princessX = sx;
        p.princessY = sy;
        p.princessZone = zone;
        p.fillDelay = fd;
        p.liftX = lx;
        p.liftY = ly;
      });
    }

    return { points, mouthX, mouthY, rimX: gobletRimX, rimY: gobletRimY, cellSize: sceneCellSize };
  }, [name]);
  const drones = sceneData.points;

  // ─── Wish-blow interactive ─────────────────────────────────────────────
  // After the heart morph returns to lock, the user can tap the cake to
  // "blow out" the candles. Flames extinguish in candle order, then a sparkle
  // burst fires and the cake drones fade — replaced by a 💝 emoji.
  const [blown, setBlown] = useState(false);
  const [wishConfirmed, setWishConfirmed] = useState(false);
  useEffect(() => {
    if (!blown) return;
    // Confirm the wish after all 3 candles have had time to extinguish
    // (3 candles × 0.35s + 0.5s settle).
    const t = setTimeout(() => setWishConfirmed(true), 1450);
    return () => clearTimeout(t);
  }, [blown]);

  // ─── Morph state machine ─────────────────────────────────────────────
  // 'launch'   → arc into letter/cake formation
  // 'heart'    → drones rearrange into a giant heart, hold briefly
  // 'couple'   → heart melts into two figures standing together, hold briefly
  // 'princess' → couple gives way to a princess + crown-cake celebration scene
  // 'lock'     → drones fly back to the letter/cake formation (final state,
  //              tap-to-blow becomes available here)
  const [morphPhase, setMorphPhase] = useState<'launch' | 'heart' | 'couple' | 'princess' | 'lock'>('launch');
  useEffect(() => {
    if (drones.length === 0) return;
    const maxLetterIdx = drones.reduce((m, d) => Math.max(m, d.letterIdx), 0);
    const lastDotDelay = delay + maxLetterIdx * 0.22 + drones.length * 0.004 + 0.1;
    const allLockedSec = lastDotDelay + ARC_DURATION + 0.3;
    // Holds are the time between phase changes; each starts with a ~0.85s
    // morph tween, so a 1.5s hold means the new formation is visible for
    // roughly 0.65s before the next morph fires.
    const heartInMs = (allLockedSec + 0.7) * 1000;
    const coupleInMs = heartInMs + 1500;     // heart visible ~0.65s after settle
    const princessInMs = coupleInMs + 1700;  // couple visible ~0.85s after settle
    const lockInMs = princessInMs + 4500;    // princess: 1s lift + 0.9s tilt + ~2.6s pour
    const t1 = setTimeout(() => setMorphPhase('heart'), heartInMs);
    const t2 = setTimeout(() => setMorphPhase('couple'), coupleInMs);
    const t3 = setTimeout(() => setMorphPhase('princess'), princessInMs);
    const t4 = setTimeout(() => setMorphPhase('lock'), lockInMs);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [drones, delay]);

  // ─── Canvas trail "comet tails" ─────────────────────────────────────────
  // For each drone we re-derive its position every frame (using the same
  // keyframes/eases as framer-motion) and stamp a soft glow on a canvas. The
  // canvas keeps prior frames but fades them every tick → result is a fading
  // trail behind each drone.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const setSize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    setSize();
    window.addEventListener('resize', setSize);

    const startTime = performance.now();
    let rafId = 0;
    let stopAt = 0; // when to stop drawing — set once everything has locked

    const tick = (now: number) => {
      const elapsedSec = (now - startTime) / 1000;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const cx = w / 2;
      const cy = h / 2;

      // Fade existing pixels — lower alpha = longer tails. destination-out
      // subtracts opacity from what's already on the canvas.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      ctx.fillRect(0, 0, w, h);

      // New stamps additively to bloom the glow on overlap.
      ctx.globalCompositeOperation = 'lighter';
      let anyMoving = false;
      for (const d of drones) {
        const dotDelay = delay + d.letterIdx * 0.22 + d.idx * 0.004 + d.launchJitter;
        const localT = elapsedSec - dotDelay;
        const progress = localT / ARC_DURATION;
        // Skip drones that haven't launched, with a small grace window past 1
        // so the very last frame still stamps.
        if (progress < 0 || progress > 1.02) continue;
        anyMoving = true;
        const [x, y] = getDronePosition(d, progress);
        const isFlame = d.kind === 'flame';
        ctx.beginPath();
        ctx.arc(cx + x, cy + y, isFlame ? 2.6 : 1.9, 0, Math.PI * 2);
        ctx.fillStyle = isFlame ? 'rgba(255,150,60,0.55)' : 'rgba(255,247,214,0.42)';
        ctx.fill();
      }

      // Once all drones have locked, keep fading for ~1.2s to clear residual
      // tails, then stop the loop to free the GPU.
      if (!anyMoving) {
        if (stopAt === 0) stopAt = elapsedSec + 1.2;
        if (elapsedSec >= stopAt) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = 'rgba(0,0,0,1)';
          ctx.fillRect(0, 0, w, h);
          return;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', setSize);
    };
  }, [drones, delay]);

  return (
    // Use a viewport-anchored fixed wrapper so the formation isn't clipped by
    // the small reveal-phase text container (it was an absolute box ~300x150).
    // Drones paint behind the cake/scroll because they appear first in DOM order.
    <div className="fixed inset-0 pointer-events-none">
      {/* Trail canvas paints first → drones render on top of their own tails. */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
      {drones.map(d => {
        // Typed-live pacing: drones in letter N start ~0.22s after letter N-1,
        // plus a tiny within-letter spread so each character builds in a quick
        // ripple instead of popping in instantly.
        const dotDelay = delay + d.letterIdx * 0.22 + d.idx * 0.004 + d.launchJitter;
        const isFlame = d.kind === 'flame';
        const isSparkle = !isFlame && d.sparkle;
        // Flame drones flicker harder. Sparkle drones twinkle dramatically
        // (over-driven scale + bright surge). Standard drones do a slow hover.
        const flickerScale = isFlame
          ? [1, 1.45, 0.7, 1.3, 0.85, 1]
          : isSparkle
          ? [1, 1.55, 0.85, 1.35, 1, 1]
          : [1, 0.85, 1];
        const flickerOpacity = isFlame
          ? [1, 0.65, 1, 0.75, 1]
          : isSparkle
          ? [1, 1, 0.55, 1, 1, 1]
          : [1, 0.55, 1];
        // Wish-blow overrides take priority over morph phase. Flames are
        // extinguished in candle order; cake-body drones fade once the wish
        // is confirmed (after the last candle is out).
        const wishExtinguish = blown && d.kind === 'flame';
        const wishCakeFade = wishConfirmed && d.isCake && d.kind !== 'flame';

        let animateProp: TargetAndTransition;
        let transitionProp: Transition;

        if (wishExtinguish) {
          animateProp = { opacity: 0, scale: 0.15 };
          transitionProp = { duration: 0.5, delay: (d.candleOrder ?? 0) * 0.35, ease: 'easeOut' };
        } else if (wishCakeFade) {
          animateProp = { opacity: 0, scale: 0.4 };
          // Stagger by horizontal position so the cake "deflates" outward.
          const stagger = (Math.abs(d.x) / 80) * 0.25;
          transitionProp = { duration: 0.5, delay: stagger, ease: 'easeIn' };
        } else if (morphPhase === 'launch') {
          animateProp = {
            x: [d.launchX, d.midX, d.approachX, d.x],
            y: [d.launchY, d.midY, d.approachY, d.y],
            scale: [0.2, 0.7, 1.15, 1],
            opacity: [0, 0.45, 0.9, 1],
          };
          transitionProp = {
            duration: ARC_DURATION,
            delay: dotDelay,
            times: [0, 0.42, 0.85, 1],
            ease: ['easeIn', 'easeInOut', [0.16, 1, 0.3, 1]],
          };
        } else if (morphPhase === 'heart') {
          animateProp = { x: d.heartX, y: d.heartY, scale: 1.05, opacity: 1 };
          transitionProp = { duration: 0.85, ease: [0.4, 0, 0.2, 1] };
        } else if (morphPhase === 'couple') {
          animateProp = { x: d.coupleX, y: d.coupleY, scale: 1, opacity: 1 };
          transitionProp = { duration: 0.95, ease: [0.4, 0, 0.2, 1] };
        } else if (morphPhase === 'princess') {
          // Wait for the can to lift+tilt before liquid pours / rises.
          const LIFT_DUR = 1.0;     // couple → lift (vertical low)
          const TILT_DUR = 0.9;     // lift → final tilted (rise + tilt)
          const POUR_START = LIFT_DUR + TILT_DUR; // 1.9s — when pouring begins
          if (d.liftX !== undefined && d.liftY !== undefined) {
            // Can drone — 2-keyframe path so framer interpolates couple →
            // lift, then lift → final-tilted, with a clear pause at lift.
            animateProp = {
              x: [d.liftX, d.princessX],
              y: [d.liftY, d.princessY],
              scale: 1,
              opacity: 1,
            };
            transitionProp = {
              duration: LIFT_DUR + TILT_DUR,
              times: [LIFT_DUR / (LIFT_DUR + TILT_DUR), 1],
              ease: [0.4, 0, 0.2, 1],
            };
          } else if (d.fillDelay !== undefined) {
            // Liquid drone — invisible until the can finishes tilting + the
            // drone's row-based fill delay, then fades in (bottom rows first).
            const fadeDur = 0.3;
            const wait = POUR_START + d.fillDelay;
            const totalDur = wait + fadeDur + 0.05;
            const fadeStartFrac = wait / totalDur;
            const fadeEndFrac = (wait + fadeDur) / totalDur;
            animateProp = {
              x: d.princessX,
              y: d.princessY,
              scale: 1,
              opacity: [0, 0, 1, 1],
            };
            transitionProp = {
              duration: totalDur,
              ease: [0.4, 0, 0.2, 1],
              opacity: {
                duration: totalDur,
                times: [0, fadeStartFrac, fadeEndFrac, 1],
                ease: 'linear',
              },
            };
          } else {
            animateProp = { x: d.princessX, y: d.princessY, scale: 1, opacity: 1 };
            transitionProp = { duration: 0.95, ease: [0.4, 0, 0.2, 1] };
          }
        } else {
          animateProp = { x: d.x, y: d.y, scale: 1, opacity: 1 };
          transitionProp = { duration: 0.85, ease: [0.4, 0, 0.2, 1] };
        }
        return (
          <motion.div
            key={d.idx}
            initial={{ x: d.launchX, y: d.launchY, scale: 0.2, opacity: 0 }}
            animate={animateProp}
            transition={transitionProp}
            className="absolute"
            style={{ left: '50%', top: '50%' }}
          >
            <motion.div
              // Once locked, drones gently GPS-correct around their point and
              // pulse their light. Flames flicker faster + jitter more, like fire.
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: [0, d.wobbleX, -d.wobbleX * 0.7, d.wobbleX * 0.4, 0],
                y: [0, -d.wobbleY, d.wobbleY * 0.5, -d.wobbleY * 0.3, 0],
                opacity: flickerOpacity,
                scale: flickerScale,
              }}
              transition={{
                delay: dotDelay + ARC_DURATION + d.pulseDelay,
                duration: d.pulseDur,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={(() => {
                if (isFlame) return {
                  width: 5,
                  height: 5,
                  marginLeft: -2.5,
                  marginTop: -2.5,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, #fff4c2 0%, #ffb347 35%, #ff5722 75%, transparent 100%)',
                  boxShadow:
                    '0 0 4px rgba(255,244,194,1), 0 0 10px rgba(255,152,0,0.95), 0 0 18px rgba(255,87,34,0.85), 0 0 28px rgba(220,38,38,0.55)',
                };
                // During the princess phase, std drones adopt the colour of
                // the scene cell they're sitting on (beret/ribbon = blue,
                // hair/shoulders = gold, jewelry = white). Other phases use
                // the default warm cream-gold styling.
                const inPrincess = morphPhase === 'princess' && d.princessZone;
                const zone = inPrincess ? d.princessZone : 'gold';
                if (zone === 'blue') return {
                  width: 4,
                  height: 4,
                  marginLeft: -2,
                  marginTop: -2,
                  borderRadius: '50%',
                  background: '#d6ecff',
                  boxShadow:
                    '0 0 4px rgba(214,236,255,1), 0 0 10px rgba(70,150,250,0.95), 0 0 20px rgba(20,100,230,0.7), 0 0 32px rgba(0,80,200,0.45)',
                };
                if (zone === 'red') return {
                  width: 4,
                  height: 4,
                  marginLeft: -2,
                  marginTop: -2,
                  borderRadius: '50%',
                  background: '#ffb0b8',
                  boxShadow:
                    '0 0 4px rgba(255,176,184,1), 0 0 10px rgba(255,60,80,0.95), 0 0 20px rgba(220,20,40,0.75), 0 0 32px rgba(180,10,30,0.5)',
                };
                if (zone === 'white') return {
                  width: 5,
                  height: 5,
                  marginLeft: -2.5,
                  marginTop: -2.5,
                  borderRadius: '50%',
                  background: '#ffffff',
                  boxShadow:
                    '0 0 5px rgba(255,255,255,1), 0 0 14px rgba(230,240,255,0.95), 0 0 26px rgba(180,210,255,0.55)',
                };
                if (isSparkle) return {
                  // Bright accent — bigger dot, white core, 4-layer halo so
                  // every flicker reads as a sparkle, not just a dim pulse.
                  width: 6,
                  height: 6,
                  marginLeft: -3,
                  marginTop: -3,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, #ffffff 0%, #fff7d6 55%, #fde68a 100%)',
                  boxShadow:
                    '0 0 6px rgba(255,255,255,1), 0 0 16px rgba(253,224,138,0.95), 0 0 32px rgba(251,191,36,0.7), 0 0 50px rgba(236,72,153,0.45)',
                };
                return {
                  width: 4,
                  height: 4,
                  marginLeft: -2,
                  marginTop: -2,
                  borderRadius: '50%',
                  background: '#fff7d6',
                  boxShadow:
                    '0 0 4px rgba(255,247,214,0.95), 0 0 10px rgba(251,191,36,0.85), 0 0 18px rgba(236,72,153,0.45)',
                };
              })()}
            />
          </motion.div>
        );
      })}

      {/* Animated pour stream — drones flow continuously from the can mouth
          to the goblet rim during the princess scene phase. The stream waits
          for the can to lift + tilt (~1.9s) before pouring begins. Each drone
          runs on its own infinite loop, staggered so the stream never gaps. */}
      {morphPhase === 'princess' && Array.from({ length: 10 }).map((_, i) => {
        const POUR_START = 1.9; // matches LIFT_DUR + TILT_DUR above
        const cycleDur = 1.4;
        const stagger = POUR_START + (i / 10) * cycleDur;
        const midX = (sceneData.mouthX + sceneData.rimX) / 2;
        // Mid-arc dips slightly under the straight line so the stream curves
        // like a real pour rather than tracing a flat diagonal.
        const midY = (sceneData.mouthY + sceneData.rimY) / 2 + sceneData.cellSize * 0.6;
        return (
          <motion.div
            key={`pour-${i}`}
            className="absolute pointer-events-none"
            style={{ left: '50%', top: '50%' }}
            initial={{ x: sceneData.mouthX, y: sceneData.mouthY, opacity: 0, scale: 0.6 }}
            animate={{
              x: [sceneData.mouthX, midX, sceneData.rimX],
              y: [sceneData.mouthY, midY, sceneData.rimY],
              opacity: [0, 1, 1, 0],
              scale: [0.6, 1, 0.5],
            }}
            transition={{
              duration: cycleDur,
              delay: stagger,
              times: [0, 0.5, 1],
              opacity: { duration: cycleDur, delay: stagger, times: [0, 0.15, 0.85, 1], repeat: Infinity, ease: 'linear' },
              repeat: Infinity,
              ease: 'easeIn', // gravity acceleration toward the glass
            }}
          >
            <div
              style={{
                width: 4,
                height: 4,
                marginLeft: -2,
                marginTop: -2,
                borderRadius: '50%',
                background: '#ffb0b8',
                boxShadow:
                  '0 0 4px rgba(255,176,184,1), 0 0 10px rgba(255,60,80,0.95), 0 0 18px rgba(220,20,40,0.7)',
              }}
            />
          </motion.div>
        );
      })}

      {/* Tap region over the cake — only enabled once heart morph has finished
          settling, so users don't accidentally blow before the show is set. */}
      {morphPhase === 'lock' && !blown && (
        <button
          onClick={() => setBlown(true)}
          aria-label="Blow out the candles"
          className="absolute pointer-events-auto"
          style={{
            left: '50%',
            top: '50%',
            width: 200,
            height: 160,
            marginLeft: -100,
            marginTop: -140, // shifts the hit-region up to the cake (cake centred at y=-60)
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            zIndex: 50,
          }}
        />
      )}

      {/* Sparkle burst — fires the moment the user taps to blow the candles. */}
      {blown && Array.from({ length: 14 }).map((_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        const dist = 70 + (i % 3) * 18;
        return (
          <motion.span
            key={`spark-${i}`}
            className="absolute pointer-events-none text-base"
            style={{ left: '50%', top: '50%', marginTop: -60 }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
            animate={{
              x: [0, Math.cos(angle) * dist],
              y: [0, Math.sin(angle) * dist],
              opacity: [0, 1, 0],
              scale: [0, 1.3, 0.4],
            }}
            transition={{ duration: 1.3, delay: 1.0 + (i % 5) * 0.04, ease: 'easeOut' }}
          >✨</motion.span>
        );
      })}

      {/* 💝 emoji — replaces the cake once the wish is granted. */}
      {wishConfirmed && (
        <motion.div
          className="absolute pointer-events-none"
          style={{
            left: '50%',
            top: '50%',
            marginTop: -60,
            transform: 'translate(-50%, -50%)',
            filter: 'drop-shadow(0 0 24px rgba(255,120,170,0.65))',
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 1], scale: [0, 1.5, 1.05] }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <span style={{ fontSize: 96, lineHeight: 1 }}>💝</span>
        </motion.div>
      )}
    </div>
  );
}
