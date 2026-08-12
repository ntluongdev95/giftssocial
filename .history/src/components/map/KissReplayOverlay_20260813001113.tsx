'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Download, Copy, Check, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import PixelFormation from './PixelFormation';
import {
  playIntroSound, playFlyingSound, playHeartbeat, playCelebration,
  playMessageChime, playRomanticBg, playProposalSound, playYesSound,
} from '@/lib/kiss-audio';

export interface Kiss {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_name?: string;
  sender_avatar?: string;
  receiver_name?: string;
  receiver_avatar?: string;
  emoji: string;
  message?: string;
  visibility: string;
  sender_lat: number;
  sender_lng: number;
  receiver_lat: number;
  receiver_lng: number;
  kiss_type?: string;
  created_at: string;
}

interface Props {
  kiss: Kiss;
  onClose: () => void;
  onFlyStart?: () => void; // callback to trigger map flyTo
}

type Step = 'intro' | 'flying' | 'arrive' | 'message' | 'share';

const STEP_DURATIONS: Record<Step, number> = {
  intro: 7000, // cinematic intro sequence
  flying: 0, // controlled by map animation callback
  arrive: 6000, // chibi animation: hug ~3.5s, proposal ~4.5s
  message: 3500,
  share: 0, // stays until user dismisses
};

// Reverse geocode city name
async function getCity(lat: number, lng: number): Promise<string> {
  if (!lat || !lng) return 'Unknown';
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`, { headers: { 'User-Agent': 'GaoSocial/1.0' } });
    const data = await res.json();
    return data?.address?.city || data?.address?.town || data?.address?.state || data?.address?.country || 'Unknown';
  } catch { return 'Unknown'; }
}
// Stable particles for cinematic intro
const CINEMATIC_PARTICLES = Array.from({ length: 35 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  top: Math.random() * 100,
  size: 1 + Math.random() * 2,
  duration: 3 + Math.random() * 4,
  delay: Math.random() * 4,
}));
function CinematicParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {CINEMATIC_PARTICLES.map((particle) => (
        <motion.span
          key={particle.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
          }}
          animate={{
            opacity: [0, 0.15, 0.4, 0.15, 0],
            scale: [0.5, 1, 1.2, 1, 0.5],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Precomputed at module level — avoids impure Math.random() calls during render
const ARRIVAL_PARTICLE_OFFSETS = Array.from({ length: 20 }, () => ({
  x: (Math.random() - 0.5) * 300,
  y: (Math.random() - 0.5) * 300,
  delay: Math.random() * 0.5,
  scale: 0.5 + Math.random() * 1.5,
}));

// Generate particles for arrival
function ArrivalParticles({ emoji }: { emoji: string }) {
  const particles = ARRIVAL_PARTICLE_OFFSETS.map((o, i) => ({
    id: i,
    emoji: i % 3 === 0 ? emoji : ['✨', '💫', '⭐', '🌟', '💖'][i % 5],
    ...o,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute left-1/2 top-1/2 text-2xl"
          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
          animate={{ x: p.x, y: p.y, scale: p.scale, opacity: 0 }}
          transition={{ duration: 1.5, delay: p.delay, ease: 'easeOut' }}
        >
          {p.emoji}
        </motion.div>
      ))}
    </div>
  );
}

export default function KissReplayOverlay({ kiss, onClose, onFlyStart }: Props) {
  const [step, setStep] = useState<Step>('intro');
  const [senderCity, setSenderCity] = useState('');
  const [receiverCity, setReceiverCity] = useState('');
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const stopBgMusicRef = useRef<(() => void) | null>(null);
  const hasFlownRef = useRef(false);

  // Fetch city names
  useEffect(() => {
    getCity(kiss.sender_lat, kiss.sender_lng).then(setSenderCity);
    getCity(kiss.receiver_lat, kiss.receiver_lng).then(setReceiverCity);
  }, [kiss]);

  // Sound effects per step
  useEffect(() => {
    if (muted) return;
    if (step === 'intro') {
      playIntroSound();
      stopBgMusicRef.current = playRomanticBg();
    } else if (step === 'flying') {
      playFlyingSound();
    } else if (step === 'arrive') {
      playHeartbeat();
      setTimeout(() => {
        if (muted) return;
        if (kiss.kiss_type === 'declaration') {
          playProposalSound();
          setTimeout(() => !muted && playYesSound(), 2500);
        } else {
          playCelebration();
        }
      }, 500);
    } else if (step === 'message') {
      playMessageChime();
    } else if (step === 'share') {
      // Stop background music
      stopBgMusicRef.current?.();
      stopBgMusicRef.current = null;
    }
  }, [step, muted, kiss.kiss_type]);

  // Cleanup music on unmount
  useEffect(() => {
    return () => { stopBgMusicRef.current?.(); };
  }, []);

  // Step progression
  useEffect(() => {
    if (step === 'share') return; // stays
    if (step === 'flying') return; // controlled externally

    const duration = STEP_DURATIONS[step];
    if (!duration) return;

    const timer = setTimeout(() => {
      if (step === 'intro') {
        setStep('flying');
        // Trigger map flyTo
        if (onFlyStart && !hasFlownRef.current) {
          hasFlownRef.current = true;
          onFlyStart();
        }
        // If no valid coords, skip to arrive
        if (!kiss.receiver_lat || !kiss.sender_lat) {
          setTimeout(() => setStep('arrive'), 1000);
        }
      } else if (step === 'arrive') {
        setStep(kiss.message ? 'message' : 'share');
      } else if (step === 'message') {
        setStep('share');
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [step, kiss, onFlyStart]);

  // Wait for KissGlobe flight animation to finish, then advance to arrive
  useEffect(() => {
    if (step !== 'flying') return;

    // Estimate flight time based on distance (matches KissGlobe timing)
    const dist = Math.abs(kiss.sender_lat - kiss.receiver_lat) + Math.abs(kiss.sender_lng - kiss.receiver_lng);
    // Same city (<0.5°) → 9s motorbike, medium (<5°) → 15s, far → 27s
    const flyTime = dist < 0.5 ? 9000 : dist < 5 ? 15000 : 27000;

    const timer = setTimeout(() => setStep('arrive'), flyTime);
    return () => clearTimeout(timer);
  }, [step, kiss]);

  const handleShare = useCallback(async (platform: string) => {
    const text = kiss.kiss_type === 'declaration'
      ? `🌍❤️ ${kiss.sender_name} declared love to ${kiss.receiver_name || 'someone'}! Watch the journey on Gao Social`
      : `${kiss.emoji} Got a kiss from ${kiss.sender_name || 'someone'}! ${senderCity} → ${receiverCity} on Gao Social`;
    const url = `${window.location.origin}/kiss/${kiss.id}`;

    if (platform === 'native' && navigator.share) {
      try {
        await navigator.share({ title: 'Kiss on Gao Social', text, url });
      } catch { /* user cancelled */ }
      return;
    }

    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(url);

    const links: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    };

    if (links[platform]) window.open(links[platform], '_blank', 'width=600,height=400');
  }, [kiss, senderCity, receiverCity]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(`${window.location.origin}/kiss/${kiss.id}`);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleDownload = useCallback(async () => {
    const card = shareCardRef.current;
    if (!card) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(card, { backgroundColor: '#0a0b0f', scale: 2 });
      const link = document.createElement('a');
      link.download = `kiss-from-${kiss.sender_name || 'gao'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Image saved!');
    } catch {
      toast.error('Could not save image');
    }
  }, [kiss]);

  return (
    <AnimatePresence>
      <motion.div
        key="kiss-replay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999] flex items-center justify-center"
        style={{ background: step === 'flying' ? 'transparent' : 'rgba(0,0,0,0.85)', backdropFilter: step === 'flying' ? 'none' : 'blur(12px)', transition: 'background 1s, backdrop-filter 1s' }}
      >
        {/* Controls — always visible */}
        <div className="absolute top-6 right-6 z-[1000] flex items-center gap-2">
          <button
            onClick={() => { setMuted(!muted); if (!muted) stopBgMusicRef.current?.(); }}
            className="h-10 w-10 rounded-full flex items-center justify-center text-white/50 hover:text-white cursor-pointer transition-colors"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button onClick={onClose} className="h-10 w-10 rounded-full flex items-center justify-center text-white/50 hover:text-white cursor-pointer transition-colors" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <X size={18} />
          </button>
        </div>

        {/* ── Step 1: Cinematic Intro ── */}
        {step === 'intro' && (
          <CinematicIntro
    kiss={kiss}
    senderCity={senderCity}
    receiverCity={receiverCity}
    onComplete={() => {
      setStep('flying');

      if (onFlyStart && !hasFlownRef.current) {
        hasFlownRef.current = true;
        onFlyStart();
      }
    }}
  />
          // <motion.div
          //   initial={{ opacity: 0 }}
          //   animate={{ opacity: 1 }}
          //   exit={{ opacity: 0, scale: 1.1 }}
          //   className="flex flex-col items-center text-center px-6 relative"
          // >
          //   {/* Background particles floating */}
          //   {Array.from({ length: 8 }).map((_, i) => (
          //     <motion.span
          //       key={`bg-${i}`}
          //       className="absolute text-xl pointer-events-none"
          //       style={{ left: `${15 + Math.random() * 70}%`, top: `${10 + Math.random() * 80}%` }}
          //       animate={{ y: [0, -20, 0], opacity: [0, 0.3, 0] }}
          //       transition={{ duration: 3, delay: i * 0.4, repeat: Infinity }}
          //     >
          //       {['✨', '💫', '⭐', '🌟', '💖', kiss.emoji, '🌙', '🪐'][i]}
          //     </motion.span>
          //   ))}

          //   {/* Phase 1: Opening text (0-2s) */}
          //   <motion.p
          //     initial={{ opacity: 0 }}
          //     animate={{ opacity: [0, 1, 1, 0] }}
          //     transition={{ duration: 2.5, times: [0, 0.2, 0.7, 1] }}
          //     className="text-sm tracking-[0.3em] uppercase text-[#4a5068] absolute top-[20%]"
          //   >
          //     {kiss.kiss_type === 'declaration' ? 'A love story for the world...' : `Somewhere in ${senderCity || '...'}`}
          //   </motion.p>

          //   {/* Phase 2: Sender avatar appears (1.5-4s) */}
          //   <motion.div
          //     initial={{ opacity: 0, scale: 0.5, y: 20 }}
          //     animate={{ opacity: [0, 0, 1, 1], scale: [0.5, 0.5, 1, 1], y: [20, 20, 0, 0] }}
          //     transition={{ duration: 4, times: [0, 0.2, 0.35, 1] }}
          //     className="flex flex-col items-center gap-3"
          //   >
          //     {/* Avatar with pulsing ring */}
          //     <div className="relative">
          //       <motion.div
          //         animate={{ scale: [1, 1.15, 1] }}
          //         transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          //         className="absolute inset-0 rounded-full"
          //         style={{ border: '2px solid rgba(236,72,153,0.3)', margin: '-6px' }}
          //       />
          //       <div className="h-24 w-24 rounded-full flex items-center justify-center text-4xl font-bold overflow-hidden"
          //         style={{ background: 'linear-gradient(135deg, #ec4899, #f87171)', border: '3px solid rgba(236,72,153,0.5)', boxShadow: '0 0 50px rgba(236,72,153,0.3)' }}
          //       >
          //         {kiss.sender_avatar
          //           ? <img src={kiss.sender_avatar} alt="" className="h-full w-full object-cover" />
          //           : (kiss.sender_name || '?').charAt(0).toUpperCase()
          //         }
          //       </div>
          //     </div>

          //     {/* Sender name */}
          //     <motion.p
          //       initial={{ opacity: 0 }}
          //       animate={{ opacity: [0, 0, 1] }}
          //       transition={{ duration: 3, times: [0, 0.4, 0.55] }}
          //       className="text-xl font-bold text-white"
          //     >
          //       {kiss.sender_name || 'Someone'}
          //     </motion.p>
          //   </motion.div>

          //   {/* Phase 3: "decided to send something special" (3-5s) */}
          //   <motion.div
          //     initial={{ opacity: 0 }}
          //     animate={{ opacity: [0, 0, 0, 1, 1] }}
          //     transition={{ duration: 5, times: [0, 0.4, 0.55, 0.65, 1] }}
          //     className="flex flex-col items-center gap-3 mt-4"
          //   >
          //     <p className="text-sm text-[#a3adc3]">{kiss.kiss_type === 'declaration' ? 'wants the whole world to know' : 'decided to send something special'}</p>
          //     <motion.div
          //       initial={{ scale: 0, rotate: -30 }}
          //       animate={{ scale: [0, 0, 0, 1.3, 1], rotate: [-30, -30, -30, 5, 0] }}
          //       transition={{ duration: 5, times: [0, 0.4, 0.6, 0.72, 0.8] }}
          //       className="text-5xl"
          //     >
          //       {kiss.emoji}
          //     </motion.div>
          //   </motion.div>

          //   {/* Phase 4: Route card (4.5-7s) */}
          //   <motion.div
          //     initial={{ opacity: 0, y: 20 }}
          //     animate={{ opacity: [0, 0, 0, 0, 1], y: [20, 20, 20, 20, 0] }}
          //     transition={{ duration: 6, times: [0, 0.5, 0.6, 0.72, 0.82] }}
          //     className="mt-5 flex items-center gap-3 px-5 py-3 rounded-2xl"
          //     style={{ background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.12)' }}
          //   >
          //     <div className="text-center">
          //       <p className="text-xs font-semibold text-white">{senderCity || '...'}</p>
          //       <p className="text-[9px] text-[#4a5068]">Origin</p>
          //     </div>
          //     <div className="flex items-center gap-1">
          //       <motion.div className="h-px w-6" style={{ background: 'rgba(236,72,153,0.3)' }} />
          //       <motion.span
          //         animate={{ x: [0, 4, 0] }}
          //         transition={{ duration: 1, repeat: Infinity }}
          //         className="text-sm"
          //       >✈️</motion.span>
          //       <motion.div className="h-px w-6" style={{ background: 'rgba(0,212,255,0.3)' }} />
          //     </div>
          //     <div className="text-center">
          //       <p className="text-xs font-semibold text-white">{receiverCity || '...'}</p>
          //       <p className="text-[9px] text-[#4a5068]">Destination</p>
          //     </div>
          //   </motion.div>

          //   {/* Phase 5: "Preparing for takeoff..." (5.5-7s) */}
          //   <motion.p
          //     initial={{ opacity: 0 }}
          //     animate={{ opacity: [0, 0, 0, 0, 0, 1] }}
          //     transition={{ duration: 6.5, times: [0, 0.5, 0.6, 0.7, 0.82, 0.9] }}
          //     className="text-[11px] text-[#ec4899] mt-4 tracking-wider"
          //   >
          //     {kiss.kiss_type === 'declaration' ? 'Broadcasting to the world...' : 'Preparing for takeoff...'}
          //   </motion.p>
          // </motion.div>
        )}

        {/* ── Step 2: Flying ── */}
        {step === 'flying' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000]"
          >
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl" style={{ background: 'rgba(10,11,15,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(236,72,153,0.2)' }}>
              <span className="text-xl">{kiss.emoji}</span>
              <div>
                <p className="text-xs font-semibold text-white">
                  {senderCity || '...'} → {receiverCity || '...'}
                </p>
                <p className="text-[10px] text-[#ec4899]">Delivering your kiss...</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Step 3: Arrival — chibi characters run & hug ── */}
        {step === 'arrive' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 w-full max-w-sm px-4"
          >
            <ArrivalParticles emoji={kiss.emoji} />

            {/* Main emoji */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1] }}
              transition={{ duration: 0.6 }}
              className="text-6xl"
            >
              {kiss.emoji}
            </motion.div>

            {/* ── Declaration: Proposal scene ── */}
            {kiss.kiss_type === 'declaration' ? (
            <div className="relative h-56 w-full flex items-end justify-center overflow-hidden">
              {/* Spotlight glow */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.6, 0.3] }}
                transition={{ duration: 2, times: [0, 0.5, 1] }}
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-60 h-40"
                style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(236,72,153,0.25), transparent 70%)' }}
              />

              {/* Ground / stage */}
              <div className="absolute bottom-8 left-[15%] right-[15%] h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(236,72,153,0.4) 30%, rgba(168,85,247,0.4) 70%, transparent)' }} />
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.5, duration: 1 }}
                className="absolute bottom-6 left-[20%] right-[20%] h-1 rounded-full origin-center"
                style={{ background: 'linear-gradient(90deg, #ec4899, #a855f7, #ec4899)' }}
              />

              {/* Quote */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0, 1, 1] }}
                transition={{ duration: 4, times: [0, 0.5, 0.65, 1] }}
                className="absolute top-0 left-0 right-0 text-center text-[10px] italic text-[#a855f7]"
              >
                will you be mine forever?
              </motion.p>

              {/* Sender — walks in → kneels → holds up heart */}
              <motion.div
                initial={{ x: -120 }}
                animate={{ x: [-120, -20, 40, 40] }}
                transition={{ duration: 2.5, ease: 'easeOut', times: [0, 0.4, 0.7, 1] }}
                className="absolute bottom-8 z-10 flex flex-col items-center"
              >
                <motion.div className="flex flex-col items-center">
                  {/* Floating heart above head (appears when kneeling) */}
                  <motion.span
                    initial={{ opacity: 0, y: 0, scale: 0 }}
                    animate={{ opacity: [0, 0, 0, 1, 1], y: [0, 0, 0, -8, -12], scale: [0, 0, 0, 1.3, 1] }}
                    transition={{ duration: 3.5, times: [0, 0.5, 0.65, 0.8, 1] }}
                    className="text-2xl absolute -top-8 z-20"
                  >💍</motion.span>

                  {/* Avatar */}
                  <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold"
                    style={{ background: 'rgba(236,72,153,0.15)', border: '2.5px solid #ec4899', color: '#ec4899', boxShadow: '0 0 15px rgba(236,72,153,0.3)' }}>
                    {kiss.sender_avatar
                      ? <img src={kiss.sender_avatar} alt="" className="w-full h-full object-cover" />
                      : (kiss.sender_name || '?').charAt(0).toUpperCase()}
                  </div>

                  {/* Body: running → kneeling */}
                  <svg width="32" height="40" viewBox="0 0 32 40" className="-mt-1">
                    {/* Body — bends down when kneeling */}
                    <motion.line x1="16" y1="2" x2="16" y2="18" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round"
                      animate={{ y2: [18, 18, 18, 14], x2: [16, 16, 16, 20] }}
                      transition={{ duration: 2.5, times: [0, 0.5, 0.7, 1] }} />
                    {/* Left arm — running then holds up ring */}
                    <motion.line x1="16" y1="8" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"
                      animate={{ x2: [6, 4, 8, 8], y2: [4, 12, 0, -4] }}
                      transition={{ duration: 2.5, times: [0, 0.3, 0.7, 1] }} />
                    {/* Right arm — running then support */}
                    <motion.line x1="16" y1="8" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"
                      animate={{ x2: [26, 28, 24, 26], y2: [12, 4, 12, 16] }}
                      transition={{ duration: 2.5, times: [0, 0.3, 0.7, 1] }} />
                    {/* Left leg — running then kneeling (bent) */}
                    <motion.line x1="16" y1="18" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"
                      animate={{ x2: [10, 20, 10, 6], y2: [34, 34, 34, 30] }}
                      transition={{ duration: 2.5, times: [0, 0.3, 0.7, 1] }} />
                    {/* Right leg — kneels on ground */}
                    <motion.line x1="16" y1="18" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"
                      animate={{ x2: [22, 12, 22, 24], y2: [34, 34, 34, 38] }}
                      transition={{ duration: 2.5, times: [0, 0.3, 0.7, 1] }} />
                  </svg>
                </motion.div>
                <span className="text-[8px] font-semibold text-[#ec4899]">{kiss.sender_name}</span>
              </motion.div>

              {/* Receiver — stands, then surprised, then happy */}
              <motion.div
                initial={{ x: 80, opacity: 0 }}
                animate={{ x: 80, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="absolute bottom-8 z-10 flex flex-col items-center"
              >
                <motion.div className="flex flex-col items-center relative">
                  {/* Reaction emoji — surprise then heart eyes */}
                  <motion.span
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 0, 0, 1, 0, 1], scale: [0, 0, 0, 1.2, 0, 1.2] }}
                    transition={{ duration: 4, times: [0, 0.5, 0.6, 0.7, 0.78, 0.85] }}
                    className="text-lg absolute -top-7 -right-2 z-20"
                  >
                    <motion.span
                      animate={{ opacity: [1, 1, 0] }}
                      transition={{ duration: 4, times: [0, 0.75, 0.78] }}
                      className="absolute"
                    >😮</motion.span>
                    <motion.span
                      animate={{ opacity: [0, 0, 1] }}
                      transition={{ duration: 4, times: [0, 0.78, 0.85] }}
                    >🥰</motion.span>
                  </motion.span>

                  {/* Avatar */}
                  <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold"
                    style={{ background: 'rgba(0,212,255,0.15)', border: '2.5px solid #00d4ff', color: '#00d4ff', boxShadow: '0 0 15px rgba(0,212,255,0.3)' }}>
                    {kiss.receiver_avatar
                      ? <img src={kiss.receiver_avatar} alt="" className="w-full h-full object-cover" />
                      : (kiss.receiver_name || 'You').charAt(0).toUpperCase()}
                  </div>

                  {/* Body — standing, hands go to face (surprised) then heart */}
                  <svg width="32" height="36" viewBox="0 0 32 36" className="-mt-1" style={{ transform: 'scaleX(-1)' }}>
                    <line x1="16" y1="2" x2="16" y2="18" stroke="#00d4ff" strokeWidth="2.5" strokeLinecap="round"/>
                    {/* Arms: idle → hands to face (surprised) → open happy */}
                    <motion.line x1="16" y1="8" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"
                      animate={{ x2: [6, 6, 12, 4], y2: [14, 14, 2, 2] }}
                      transition={{ duration: 3.5, times: [0, 0.6, 0.75, 1] }} />
                    <motion.line x1="16" y1="8" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"
                      animate={{ x2: [26, 26, 20, 28], y2: [14, 14, 2, 2] }}
                      transition={{ duration: 3.5, times: [0, 0.6, 0.75, 1] }} />
                    <line x1="16" y1="18" x2="11" y2="34" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="16" y1="18" x2="21" y2="34" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </motion.div>
                <span className="text-[8px] font-semibold text-[#00d4ff]">{kiss.receiver_name || 'You'}</span>
              </motion.div>

              {/* Heart burst when "yes" */}
              {Array.from({ length: 15 }).map((_, i) => {
                const angle = (i / 15) * Math.PI * 2;
                return (
                  <motion.span key={`prop-${i}`}
                    className="absolute text-lg pointer-events-none z-30"
                    style={{ bottom: '6rem', left: '55%' }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 0, 1, 0], x: [0, 0, Math.cos(angle) * 80], y: [0, 0, Math.sin(angle) * 80 - 20], scale: [0, 0, 1.2, 0] }}
                    transition={{ delay: 3, duration: 1.5, times: [0, 0.01, 0.4, 1] }}
                  >{['❤️', '💕', '💖', '✨', '💍', '🌟', '💗', '💝'][i % 8]}</motion.span>
                );
              })}

              {/* Glow when proposal happens */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 0, 0.6, 0.3], scale: [0, 0, 1.5, 2.5] }}
                transition={{ duration: 4, times: [0, 0.65, 0.8, 1] }}
                className="absolute w-32 h-32 rounded-full"
                style={{ bottom: '2rem', left: '45%', background: 'radial-gradient(circle, rgba(168,85,247,0.5), rgba(236,72,153,0.3), transparent 70%)' }}
              />
            </div>
            ) : (
            /* ── Regular kiss: Chibi hug scene ── */
            <div className="relative h-48 w-full flex items-end justify-center overflow-hidden">
              <div className="absolute bottom-6 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(236,72,153,0.2) 30%, rgba(0,212,255,0.2) 70%, transparent)' }} />
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0, 1, 1, 0] }}
                transition={{ duration: 3, times: [0, 0.1, 0.25, 0.75, 1] }}
                className="absolute top-0 left-0 right-0 text-center text-[10px] italic text-[#4a5068]"
              >distance means nothing when someone means everything</motion.p>

              {/* Sender runs from left */}
              <motion.div initial={{ x: -130 }} animate={{ x: [-130, -40, 30, 65] }} transition={{ duration: 3, ease: 'easeOut', times: [0, 0.4, 0.8, 1] }} className="absolute bottom-6 z-10 flex flex-col items-center">
                <motion.div animate={{ y: [0, -6, 0, -6, 0, -3, 0, 0] }} transition={{ duration: 2.8, times: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1] }} className="flex flex-col items-center">
                  <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(236,72,153,0.15)', border: '2.5px solid #ec4899', color: '#ec4899', boxShadow: '0 0 15px rgba(236,72,153,0.3)' }}>
                    {kiss.sender_avatar ? <img src={kiss.sender_avatar} alt="" className="w-full h-full object-cover" /> : (kiss.sender_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <svg width="32" height="36" viewBox="0 0 32 36" className="-mt-1">
                    <line x1="16" y1="2" x2="16" y2="18" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round"/>
                    <motion.line x1="16" y1="8" x2="6" y2="4" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" animate={{ x2: [6,4,6,4,2], y2: [4,12,4,12,2] }} transition={{ duration: 2.8, times: [0,0.15,0.3,0.7,1] }}/>
                    <motion.line x1="16" y1="8" x2="26" y2="12" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" animate={{ x2: [26,28,26,28,30], y2: [12,4,12,4,2] }} transition={{ duration: 2.8, times: [0,0.15,0.3,0.7,1] }}/>
                    <motion.line x1="16" y1="18" x2="10" y2="34" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" animate={{ x2: [10,20,10,20,12] }} transition={{ duration: 2.8, times: [0,0.15,0.3,0.7,1] }}/>
                    <motion.line x1="16" y1="18" x2="22" y2="34" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" animate={{ x2: [22,12,22,12,20] }} transition={{ duration: 2.8, times: [0,0.15,0.3,0.7,1] }}/>
                  </svg>
                </motion.div>
                <span className="text-[8px] font-semibold text-[#ec4899]">{kiss.sender_name || 'Sender'}</span>
              </motion.div>

              {/* Receiver stands */}
              <motion.div initial={{ x: 80, opacity: 0 }} animate={{ x: 80, opacity: 1 }} transition={{ delay: 0.3 }} className="absolute bottom-6 z-10 flex flex-col items-center">
                <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 2, repeat: Infinity }} className="flex flex-col items-center">
                  <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(0,212,255,0.15)', border: '2.5px solid #00d4ff', color: '#00d4ff', boxShadow: '0 0 15px rgba(0,212,255,0.3)' }}>
                    {kiss.receiver_avatar ? <img src={kiss.receiver_avatar} alt="" className="w-full h-full object-cover" /> : (kiss.receiver_name || 'You').charAt(0).toUpperCase()}
                  </div>
                  <svg width="32" height="36" viewBox="0 0 32 36" className="-mt-1" style={{ transform: 'scaleX(-1)' }}>
                    <line x1="16" y1="2" x2="16" y2="18" stroke="#00d4ff" strokeWidth="2.5" strokeLinecap="round"/>
                    <motion.line x1="16" y1="8" x2="6" y2="14" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" animate={{ x2: [6,6,6,2], y2: [14,14,14,3] }} transition={{ duration: 3, times: [0,0.7,0.85,1] }}/>
                    <motion.line x1="16" y1="8" x2="26" y2="14" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" animate={{ x2: [26,26,26,30], y2: [14,14,14,3] }} transition={{ duration: 3, times: [0,0.7,0.85,1] }}/>
                    <line x1="16" y1="18" x2="11" y2="34" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="16" y1="18" x2="21" y2="34" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </motion.div>
                <span className="text-[8px] font-semibold text-[#00d4ff]">{kiss.receiver_name || 'You'}</span>
              </motion.div>

              <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: [0,0,0.8,0.4], scale: [0,0,1.5,2] }} transition={{ duration: 3.5, times: [0,0.7,0.85,1] }} className="absolute w-24 h-24 rounded-full" style={{ bottom: '3rem', right: '20%', background: 'radial-gradient(circle, rgba(236,72,153,0.5), rgba(0,212,255,0.3), transparent 70%)' }} />
            </div>
            )}

            {/* Regular kiss: city route */}
            {kiss.kiss_type !== 'declaration' && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }} className="text-xs text-[#4a5068]">
                {senderCity} → {receiverCity}
              </motion.p>
            )}

            {/* Declaration: Globe with chibis on top */}
            {kiss.kiss_type === 'declaration' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, type: 'spring', damping: 15 }}
                className="flex flex-col items-center gap-3 mt-2"
              >
                {/* Mini globe with characters on top */}
                <div className="relative">
                  {/* Globe */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                    className="relative"
                  >
                    <svg width="160" height="160" viewBox="0 0 160 160">
                      <defs>
                        <radialGradient id="globe-grad" cx="40%" cy="35%">
                          <stop offset="0%" stopColor="#1e3a5f" />
                          <stop offset="50%" stopColor="#0f2340" />
                          <stop offset="100%" stopColor="#0a1628" />
                        </radialGradient>
                        <radialGradient id="globe-shine" cx="30%" cy="25%">
                          <stop offset="0%" stopColor="rgba(0,212,255,0.15)" />
                          <stop offset="100%" stopColor="transparent" />
                        </radialGradient>
                      </defs>
                      {/* Globe sphere */}
                      <circle cx="80" cy="80" r="75" fill="url(#globe-grad)" stroke="rgba(0,212,255,0.2)" strokeWidth="1" />
                      <circle cx="80" cy="80" r="75" fill="url(#globe-shine)" />
                      {/* Continents (simplified) */}
                      <ellipse cx="55" cy="50" rx="22" ry="15" fill="#22c55e" opacity="0.3" />
                      <ellipse cx="100" cy="65" rx="18" ry="20" fill="#22c55e" opacity="0.25" />
                      <ellipse cx="70" cy="95" rx="15" ry="10" fill="#22c55e" opacity="0.2" />
                      <ellipse cx="115" cy="45" rx="12" ry="14" fill="#22c55e" opacity="0.2" />
                      {/* Grid lines */}
                      <ellipse cx="80" cy="80" rx="75" ry="40" fill="none" stroke="rgba(0,212,255,0.06)" strokeWidth="0.5" />
                      <ellipse cx="80" cy="80" rx="75" ry="60" fill="none" stroke="rgba(0,212,255,0.06)" strokeWidth="0.5" />
                      <ellipse cx="80" cy="80" rx="40" ry="75" fill="none" stroke="rgba(0,212,255,0.06)" strokeWidth="0.5" />
                      <line x1="5" y1="80" x2="155" y2="80" stroke="rgba(0,212,255,0.06)" strokeWidth="0.5" />
                    </svg>
                  </motion.div>

                  {/* Heart pin on top of globe */}
                  <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1, type: 'spring', damping: 12 }}
                    className="absolute -top-4 left-1/2 -translate-x-1/2 flex flex-col items-center"
                  >
                    {/* Two avatars side by side */}
                    <div className="flex items-center -space-x-3">
                      <div className="h-11 w-11 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold z-10"
                        style={{ background: 'rgba(236,72,153,0.2)', border: '2.5px solid #ec4899', color: '#ec4899', boxShadow: '0 0 12px rgba(236,72,153,0.4)' }}>
                        {kiss.sender_avatar
                          ? <img src={kiss.sender_avatar} alt="" className="w-full h-full object-cover" />
                          : (kiss.sender_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="text-xl z-20 -mt-3"
                      >❤️</motion.div>
                      <div className="h-11 w-11 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold z-10"
                        style={{ background: 'rgba(0,212,255,0.2)', border: '2.5px solid #00d4ff', color: '#00d4ff', boxShadow: '0 0 12px rgba(0,212,255,0.4)' }}>
                        {kiss.receiver_avatar
                          ? <img src={kiss.receiver_avatar} alt="" className="w-full h-full object-cover" />
                          : (kiss.receiver_name || 'You').charAt(0).toUpperCase()}
                      </div>
                    </div>

                    {/* Names */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[9px] font-bold text-[#ec4899]">{kiss.sender_name}</span>
                      <span className="text-[8px] text-[#4a5068]">&</span>
                      <span className="text-[9px] font-bold text-[#00d4ff]">{kiss.receiver_name || 'You'}</span>
                    </div>
                  </motion.div>

                  {/* Orbiting hearts */}
                  {['❤️', '💕', '💖'].map((h, i) => (
                    <motion.span
                      key={i}
                      className="absolute text-lg pointer-events-none"
                      style={{ left: '50%', top: '50%' }}
                      animate={{
                        x: [Math.cos(i * 2.1) * 100, Math.cos(i * 2.1 + Math.PI) * 100, Math.cos(i * 2.1 + Math.PI * 2) * 100],
                        y: [Math.sin(i * 2.1) * 50, Math.sin(i * 2.1 + Math.PI) * 50, Math.sin(i * 2.1 + Math.PI * 2) * 50],
                        opacity: [0.6, 1, 0.6],
                      }}
                      transition={{ duration: 4 + i, repeat: Infinity, ease: 'linear' }}
                    >{h}</motion.span>
                  ))}
                </div>

                {/* Declaration text */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5 }}
                  className="text-sm font-bold text-[#ec4899] text-center"
                >
                  Told the whole world 🌍
                </motion.p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── Step 4: Message ── */}
        {step === 'message' && kiss.message && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-5 px-8 max-w-md text-center"
          >
            <div className="text-5xl">{kiss.emoji}</div>
            <div className="rounded-2xl px-6 py-4" style={{ background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.15)' }}>
              <p className="text-base text-white leading-relaxed italic">&ldquo;{kiss.message}&rdquo;</p>
            </div>
            <p className="text-xs text-[#4a5068]">— {kiss.sender_name || 'Someone'}</p>
          </motion.div>
        )}

        {/* ── Step 5: Share ── */}
        {step === 'share' && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm mx-4"
          >
            {/* Share card (screenshot-able) */}
            <div
              ref={shareCardRef}
              className="rounded-3xl overflow-hidden mb-4"
              style={{ background: 'linear-gradient(135deg, #0a0b0f 0%, #1a0a1a 50%, #0a0b0f 100%)', border: '1px solid rgba(236,72,153,0.2)' }}
            >
              {/* Card header gradient */}
              <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #ec4899, #f87171, #ec4899)' }} />

              <div className="px-6 py-6 flex flex-col items-center gap-4 text-center">
                {/* Sender avatar + emoji */}
                <div className="relative">
                  <div className="h-16 w-16 rounded-full flex items-center justify-center text-2xl font-bold overflow-hidden" style={{ background: 'linear-gradient(135deg, #ec4899, #f87171)', border: '2px solid rgba(236,72,153,0.4)' }}>
                    {kiss.sender_avatar
                      ? <img src={kiss.sender_avatar} alt="" className="h-full w-full object-cover" />
                      : (kiss.sender_name || '?').charAt(0).toUpperCase()
                    }
                  </div>
                  <span className="absolute -bottom-1 -right-1 text-2xl">{kiss.emoji}</span>
                </div>

                {/* Names + route */}
                <div>
                  <p className="text-lg font-bold text-white">{kiss.sender_name || 'Someone'}</p>
                  <p className="text-[11px] text-[#ec4899] mt-0.5">
                    {kiss.kiss_type === 'declaration' ? 'declared love to' : 'sent a kiss to'}
                  </p>
                  <p className="text-lg font-bold text-white mt-0.5">{kiss.receiver_name || 'You'}</p>
                </div>

                {/* Declaration badge or route */}
                {kiss.kiss_type === 'declaration' ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(168,85,247,0.15))', border: '1px solid rgba(236,72,153,0.2)' }}>
                    <span className="text-xs">🌍</span>
                    <span className="text-[10px] font-semibold text-[#ec4899]">Public Love Declaration</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-[#4a5068]">
                    <span>{senderCity}</span>
                    <span className="text-[#ec4899]">✈️</span>
                    <span>{receiverCity}</span>
                  </div>
                )}

                {/* Message */}
                {kiss.message && (
                  <p className="text-sm text-[#a3adc3] italic">&ldquo;{kiss.message}&rdquo;</p>
                )}

                {/* Branding */}
                <div className="flex items-center gap-1.5 mt-2">
                  <img src="/images/gao-logo-v2.png" alt="Gao" className="h-5 w-5 rounded-full" />
                  <span className="text-[10px] font-semibold text-[#4a5068]">Gao Social</span>
                </div>
              </div>
            </div>

            {/* Share buttons */}
            <div className="space-y-2">
              {/* Native share (mobile) */}
              {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                <button
                  onClick={() => handleShare('native')}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #ec4899, #f87171)', color: 'white' }}
                >
                  <Share2 size={16} /> Share
                </button>
              )}

              {/* Social buttons row */}
              <div className="flex gap-2">
                <button onClick={() => handleShare('twitter')} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-semibold cursor-pointer" style={{ background: 'rgba(29,155,240,0.12)', color: '#1d9bf0', border: '1px solid rgba(29,155,240,0.2)' }}>
                  𝕏 Post
                </button>
                <button onClick={() => handleShare('facebook')} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-semibold cursor-pointer" style={{ background: 'rgba(24,119,242,0.12)', color: '#1877f2', border: '1px solid rgba(24,119,242,0.2)' }}>
                  Facebook
                </button>
                <button onClick={() => handleShare('whatsapp')} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-semibold cursor-pointer" style={{ background: 'rgba(37,211,102,0.12)', color: '#25d366', border: '1px solid rgba(37,211,102,0.2)' }}>
                  WhatsApp
                </button>
              </div>

              {/* Utility row */}
              <div className="flex gap-2">
                <button onClick={handleCopyLink} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-semibold cursor-pointer" style={{ background: 'rgba(255,255,255,0.04)', color: '#a3adc3', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-semibold cursor-pointer" style={{ background: 'rgba(255,255,255,0.04)', color: '#a3adc3', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Download size={13} /> Save Image
                </button>
              </div>

              {/* Close */}
              <button onClick={onClose} className="w-full rounded-xl py-2.5 text-xs text-[#4a5068] cursor-pointer hover:text-white transition-colors">
                Close
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
