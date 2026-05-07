'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch(`/api/v1/capsules/${capsule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        // PATCH returns the unmasked capsule (message + photos) — adopt it so
        // the message phase has content to render for first-time openers.
        console.log('[CapsuleRevealOverlay] PATCH response data:', data.data);
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
    const text = `I dug up a time capsule I buried ${yearsBurried} years ago at ${capsule.location_name || 'a special place'} 🪦✨`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Time Capsule', text }); } catch {}
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
        style={{ background: 'radial-gradient(ellipse at center, #1a0b2e 0%, #0a0b0f 100%)' }}
      >
        <button onClick={onClose} className="absolute top-6 right-6 z-[1000] h-10 w-10 rounded-full flex items-center justify-center text-white/50 hover:text-white cursor-pointer" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <X size={18} />
        </button>

        {/* Floating particles bg */}
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: 2 + Math.random() * 3,
              height: 2 + Math.random() * 3,
              background: ['rgba(168,85,247,0.6)', 'rgba(236,72,153,0.6)', 'rgba(255,255,255,0.4)'][i % 3],
            }}
            animate={{ y: [0, -30, 0], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 3 + Math.random() * 3, delay: i * 0.2, repeat: Infinity }}
          />
        ))}

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
            >🪦</motion.div>

            <p className="text-[10px] uppercase tracking-[0.3em] text-[#a855f7] mb-2">
              {capsule.role === 'recipient' ? `From ${capsule.sender_name || capsule.sender_username || 'Someone'}` : 'Time Capsule'}
            </p>
            <h2 className="text-xl font-bold text-white mb-2">{capsule.title}</h2>

            <div className="flex items-center justify-center gap-3 text-[11px] text-[#4a5068] mt-4 mb-6">
              <span className="flex items-center gap-1"><MapPin size={11} />{capsule.location_name || 'Hidden location'}</span>
              <span className="opacity-50">•</span>
              <span className="flex items-center gap-1"><Calendar size={11} />Buried {burial.getFullYear()}</span>
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
              {opening ? <><Loader2 size={16} className="inline animate-spin mr-2" /> Opening...</> : '⚒️ Dig Up Capsule'}
            </motion.button>
          </motion.div>
        )}

        {/* PHASE: Digging animation */}
        {phase === 'digging' && (
          <motion.div className="text-center">
            <motion.div
              animate={{ rotate: [0, -15, 15, -15, 15, 0], y: [0, 5, 0, 5, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-8xl mb-6"
            >⚒️</motion.div>
            <p className="text-sm text-white">Digging...</p>
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
              transition={{ delay: 6 }}
            >
              <p className="text-[10px] uppercase tracking-[0.3em] mb-2" style={{ color: theme.accentColor }}>From {yearsBurried} years ago</p>
              <h2 className="text-2xl font-bold text-white mb-3">{capsule.title}</h2>

              <button
                onClick={() => setPhase('message')}
                className="rounded-xl px-6 py-3 text-sm font-bold cursor-pointer mt-4"
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

// Outline silhouette of a layered birthday cake with 3 candles. 15 cells wide,
// 12 tall. 1 = standard drone, 2 = flame drone (warm color + flicker), 0 = empty.
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
}

// Build a drone with a clustered-launch + arc trajectory toward (tx, ty).
// Three launch pads (left/center/right) chosen by the target's horizontal side
// give the show a natural fan-out look.
function buildDronePoint(tx: number, ty: number, idx: number, kind: DroneKind = 'std'): DronePoint {
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
// into `points`.
function layoutLine(
  line: string,
  lineY: number,
  cellSize: number,
  letterCols: number,
  letterGap: number,
  wordGap: number,
  points: DronePoint[],
) {
  const lineW = measureLineWidth(line, cellSize, letterCols, letterGap, wordGap);
  let cursor = -lineW / 2;
  line.split('').forEach((char, i, arr) => {
    if (char === ' ') {
      cursor += wordGap;
      return;
    }
    const bm = LETTER_BITMAPS[char];
    if (!bm) return; // unknown char (e.g. punctuation) — skip silently
    bm.forEach((row, ry) => {
      row.forEach((cell, cx) => {
        if (cell === 1) {
          points.push(buildDronePoint(cursor + cx * cellSize, lineY + ry * cellSize, points.length));
        }
      });
    });
    cursor += letterCols * cellSize;
    if (i < arr.length - 1 && arr[i + 1] !== ' ') cursor += letterGap;
  });
}

function BirthdayDroneShow({ delay, name }: { delay: number; name: string }) {
  const drones = useMemo<DronePoint[]>(() => {
    // Greeting + optional recipient name on a second line below.
    const greeting = 'HAPPY BIRTHDAY';
    const recipientLine = normalizeNameForDrones(name);
    if (typeof window !== 'undefined') {
      console.log('[BirthdayDroneShow] name input:', JSON.stringify(name), '→ normalized:', JSON.stringify(recipientLine));
    }

    const letterCols = 5;
    const greetingCellsWide = 79; // see measureLineWidth math: 13 letters @5 + 11 gaps + 1 word-gap (3)
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1100;
    const targetWidth = Math.min(vw - 32, 760);
    const cellSize = Math.max(2, Math.min(Math.floor(targetWidth / greetingCellsWide), 7));
    const letterGap = cellSize;
    const wordGap = cellSize * 3;
    const lineHeight = 7 * cellSize;
    // Recipient line uses a slightly smaller cell so the name reads as a subtitle.
    const nameCellSize = Math.max(2, Math.round(cellSize * 0.78));
    const nameLineHeight = 7 * nameCellSize;
    const lineSpacing = cellSize * 2.4;

    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const formationOffsetY = -Math.max(220, Math.min(vh * 0.36, 360));
    // Stack greeting on top, name below; centre the whole stack on formationOffsetY.
    const totalStackHeight = lineHeight + (recipientLine ? lineSpacing + nameLineHeight : 0);
    const stackTop = formationOffsetY - totalStackHeight / 2;
    const greetingY = stackTop;
    const nameY = stackTop + lineHeight + lineSpacing;

    const points: DronePoint[] = [];
    layoutLine(greeting, greetingY, cellSize, letterCols, letterGap, wordGap, points);
    if (recipientLine) {
      layoutLine(recipientLine, nameY, nameCellSize, letterCols, nameCellSize, nameCellSize * 3, points);
    }

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
          points.push(buildDronePoint(cakeStartX + cx * cakeCell, cakeStartY + ry * cakeCell, points.length, kind));
        }
      });
    });
    return points;
  }, [name]);

  return (
    // Use a viewport-anchored fixed wrapper so the formation isn't clipped by
    // the small reveal-phase text container (it was an absolute box ~300x150).
    // Drones paint behind the cake/scroll because they appear first in DOM order.
    <div className="fixed inset-0 pointer-events-none">
      {drones.map(d => {
        // Stagger flight starts in a slow ripple, plus a small per-drone jitter
        // so the launch line isn't perfectly mechanical.
        const dotDelay = delay + d.idx * 0.012 + d.launchJitter;
        const isFlame = d.kind === 'flame';
        // Flame drones flicker harder + larger range. Standard drones do a slow GPS hover.
        const flickerScale = isFlame
          ? [1, 1.45, 0.7, 1.3, 0.85, 1]
          : [1, 0.85, 1];
        const flickerOpacity = isFlame
          ? [1, 0.65, 1, 0.75, 1]
          : [1, 0.55, 1];
        return (
          <motion.div
            key={d.idx}
            initial={{ x: d.launchX, y: d.launchY, scale: 0.2, opacity: 0 }}
            animate={{
              // 4-keyframe arc: launch pad → mid-arc (high & swept) → approach
              // (overshoot near target) → locked. Per-segment ease gives the
              // takeoff weight, smooth travel, and a soft GPS-style settle.
              x: [d.launchX, d.midX, d.approachX, d.x],
              y: [d.launchY, d.midY, d.approachY, d.y],
              scale: [0.2, 0.7, 1.15, 1],
              opacity: [0, 0.45, 0.9, 1],
            }}
            transition={{
              duration: 3.6,
              delay: dotDelay,
              times: [0, 0.42, 0.85, 1],
              ease: ['easeIn', 'easeInOut', [0.16, 1, 0.3, 1]],
            }}
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
                delay: dotDelay + 3.6 + d.pulseDelay,
                duration: d.pulseDur,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={
                isFlame
                  ? {
                      width: 5,
                      height: 5,
                      marginLeft: -2.5,
                      marginTop: -2.5,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #fff4c2 0%, #ffb347 35%, #ff5722 75%, transparent 100%)',
                      boxShadow:
                        '0 0 4px rgba(255,244,194,1), 0 0 10px rgba(255,152,0,0.95), 0 0 18px rgba(255,87,34,0.85), 0 0 28px rgba(220,38,38,0.55)',
                    }
                  : {
                      width: 4,
                      height: 4,
                      marginLeft: -2,
                      marginTop: -2,
                      borderRadius: '50%',
                      background: '#fff7d6',
                      boxShadow:
                        '0 0 4px rgba(255,247,214,0.95), 0 0 10px rgba(251,191,36,0.85), 0 0 18px rgba(236,72,153,0.45)',
                    }
              }
            />
          </motion.div>
        );
      })}
    </div>
  );
}
