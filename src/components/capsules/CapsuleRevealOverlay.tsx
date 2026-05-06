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
  theme?: string;
  role?: 'sender' | 'recipient';
  sender_name?: string;
  sender_username?: string;
  sender_avatar?: string;
}

interface Props {
  capsule: Capsule;
  onClose: () => void;
  onOpened?: (c: Capsule) => void;
}

type Phase = 'approaching' | 'digging' | 'reveal' | 'message' | 'photos' | 'reply';

export default function CapsuleRevealOverlay({ capsule, onClose, onOpened }: Props) {
  const [phase, setPhase] = useState<Phase>('approaching');
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState(!!capsule.opened_at);
  const [photoIdx, setPhotoIdx] = useState(0);
  const photos = Array.isArray(capsule.photos) ? capsule.photos : [];
  const theme = getTheme(capsule.theme);

  // Tokenise message for word-by-word reveal (preserves multi-line)
  const messageTokens = useMemo(() => {
    const tokens: ({ word: string; idx: number } | { br: true })[] = [];
    let wordIdx = 0;
    capsule.message.split('\n').forEach((line, lineIdx, arr) => {
      line.split(/(\s+)/).filter(s => s.length > 0).forEach(w => {
        tokens.push({ word: w, idx: wordIdx++ });
      });
      if (lineIdx < arr.length - 1) tokens.push({ br: true });
    });
    return { tokens, wordCount: wordIdx };
  }, [capsule.message]);
  const messageEndDelay = 0.7 + Math.min(Math.max(0, messageTokens.wordCount - 1) * 0.03, 3);

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
  const unlock = new Date(capsule.unlock_at);
  const yearsBurried = ((Date.now() - burial.getTime()) / (1000 * 60 * 60 * 24 * 365)).toFixed(1);

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

        {/* PHASE: Reveal — capsule opens with light burst */}
        {phase === 'reveal' && (
          <motion.div className="text-center px-6">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.5, 1.3, 1], opacity: 1 }}
              transition={{ duration: 1, times: [0, 0.5, 1] }}
              className="relative mb-6"
            >
              {/* Light burst */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 3, 5], opacity: [0, 1, 0] }}
                transition={{ duration: 2 }}
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.6), rgba(168,85,247,0.3), transparent 70%)' }}
              />
              <div className="text-8xl relative z-10">{theme.scrollEmoji}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
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
            className="w-full max-w-xl px-5 lg:px-6"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="relative rounded-2xl px-6 py-9 lg:px-12 lg:py-14 overflow-hidden"
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
                transition={{ delay: 0.5, type: 'spring', damping: 12, stiffness: 200 }}
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

              {/* Message body — word by word ink reveal */}
              <p className="text-[15px] lg:text-base leading-loose font-serif relative" style={{ color: theme.inkColor }}>
                {messageTokens.tokens.map((tok, i) => {
                  if ('br' in tok) return <br key={`br-${i}`} />;
                  return (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 + Math.min(tok.idx * 0.03, 3), duration: 0.5 }}
                      style={{ display: 'inline-block', whiteSpace: 'pre' }}
                    >
                      {tok.word}
                    </motion.span>
                  );
                })}
              </p>

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
