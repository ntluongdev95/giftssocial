'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Download, Copy, Check, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';

import {
  playIntroSound, playFlyingSound, playHeartbeat, playCelebration,
  playMessageChime, playRomanticBg, playProposalSound, playYesSound,
} from '@/lib/kiss-audio';
import GiftDropIntro, { type VehicleKind } from './GiftDropIntro';
import PasswordLock from './PasswordLock';
import { getTemplate } from '@/components/reveals/_registry';
import AudioPlayer from '@/components/reveals/_shared/AudioPlayer';

// Extract the sender's chosen song URL from template_data. When set,
// AudioPlayer is rendered at the OVERLAY level so the music starts
// with the journey (intro step) and carries through all steps —
// otherwise the sender's song only plays inside the template reveal,
// which arrives many seconds after the flight.
function readSongUrl(kiss: { template_data?: string | null }): string {
  if (!kiss.template_data) return '';
  try {
    const d = JSON.parse(kiss.template_data);
    return typeof d?.song === 'string' ? d.song : '';
  } catch {
    return '';
  }
}

// Extract the sender's password + hint (if set) from template_data JSON.
function readPasscode(kiss: { template_data?: string | null }): { code: string; hint: string } {
  if (!kiss.template_data) return { code: '', hint: '' };
  try {
    const d = JSON.parse(kiss.template_data);
    const raw = typeof d?.password === 'string' || typeof d?.password === 'number' ? String(d.password) : '';
    const hint = typeof d?.password_hint === 'string' ? d.password_hint : '';
    return { code: raw.replace(/\D/g, ''), hint };
  } catch { return { code: '', hint: '' }; }
}

// Great-circle distance in km (Haversine). Used to pick the vehicle in
// the intro so the animation matches what will fly on the map next.
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Dev override: `?force_vehicle=car|dove|plane` forces the intro to
// play that vehicle animation regardless of real distance. Handy for
// testing car / plane reveals without having to send kisses across
// continents. Returns undefined when the param isn't present.
function readForcedVehicle(): VehicleKind | undefined {
  if (typeof window === 'undefined') return undefined;
  const v = new URLSearchParams(window.location.search).get('force_vehicle');
  return v === 'car' || v === 'dove' || v === 'plane' ? v : undefined;
}

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
  // Template hookup — when template_id matches a registered React
  // component (src/components/reveals/[id]/), the reveal auto-plays
  // straight after the vehicle arrives (skips the plain message card).
  template_id?: string | null;
  template_data?: string | null;   // JSON — sender's field answers
  photos?: string | null;
  music_url?: string | null;
  music_title?: string | null;
}

interface Props {
  kiss: Kiss;
  onClose: () => void;
  onFlyStart?: () => void; // callback to trigger map flyTo
}

type Step = 'intro' | 'flying' | 'password' | 'arrive' | 'message' | 'template' | 'share';

const STEP_DURATIONS: Record<Step, number> = {
  intro: 7000,     // cinematic intro sequence
  flying: 0,       // controlled by map animation callback
  password: 0,     // PasswordLock fires onSuccess itself
  arrive: 0,       // hacker countdown fires its own onComplete
  message: 3500,
  template: 0,     // template controls its own duration + close
  share: 0,        // stays until user dismisses
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

  // Sender's chosen song URL (if any). When set, we skip the synth
  // playRomanticBg() so the two audio streams don't clash — AudioPlayer
  // handles it end-to-end from the intro step.
  const senderSong = readSongUrl(kiss);

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
      // Only play the synth bg if the sender didn't provide their own
      // song — otherwise AudioPlayer handles the whole journey audio.
      if (!senderSong) {
        stopBgMusicRef.current = playRomanticBg();
      }
    } else if (step === 'flying') {
      playFlyingSound();
    } else if (step === 'template') {
      // Reveal celebration cue — same beats as the old arrive step
      // so declarations still get the proposal + yes sounds.
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
  }, [step, muted, kiss.kiss_type, senderSong]);

  // Cleanup music on unmount
  useEffect(() => {
    return () => { stopBgMusicRef.current?.(); };
  }, []);

  // Registered React template for this kiss (if any). Determines whether
  // 'arrive' hands off to a full-screen template reveal or to the plain
  // message card.
  const registeredTemplate = kiss.template_id ? getTemplate(kiss.template_id) : undefined;

  // Sender's optional numeric passcode. When set, flying → password →
  // arrive; otherwise flying → arrive directly. Hint (if provided)
  // shows under the lock.
  const passcode = readPasscode(kiss);
  const hasPasscode = passcode.code.length > 0;

  // Advance to the reveal — prefer the registered template component
  // when available (auto-plays fullscreen); else fall back to the
  // plain message card; else share directly. Called by:
  //   • password's onSuccess (when a passcode exists)
  //   • flying's onDone      (when no passcode)
  const advanceToReveal = () => {
    if (registeredTemplate) {
      setStep('template');
    } else {
      setStep(kiss.message ? 'message' : 'share');
    }
  };

  // Where flying hands off to — password gate first (if set), otherwise
  // straight to the best available reveal (template > message > share).
  const stepAfterFlying: Step = hasPasscode
    ? 'password'
    : registeredTemplate
    ? 'template'
    : kiss.message ? 'message' : 'share';

  // Step progression
  useEffect(() => {
    if (step === 'share')    return; // stays
    if (step === 'template') return; // template drives its own end
    if (step === 'flying')   return; // controlled externally
    if (step === 'password') return; // PasswordLock fires onSuccess

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
        // If no valid coords, skip flying → straight to password / arrive
        if (!kiss.receiver_lat || !kiss.sender_lat) {
          setTimeout(() => setStep(stepAfterFlying), 1000);
        }
      } else if (step === 'message') {
        setStep('share');
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [step, kiss, onFlyStart, registeredTemplate]);

  // Wait for KissGlobe flight animation to finish, then advance to arrive
  useEffect(() => {
    if (step !== 'flying') return;

    // Estimate flight time based on distance (matches KissGlobe timing)
    const dist = Math.abs(kiss.sender_lat - kiss.receiver_lat) + Math.abs(kiss.sender_lng - kiss.receiver_lng);
    // Same city (<0.5°) → 9s motorbike, medium (<5°) → 15s, far → 27s
    const flyTime = dist < 0.5 ? 9000 : dist < 5 ? 15000 : 27000;

    const timer = setTimeout(() => setStep(stepAfterFlying), flyTime);
    return () => clearTimeout(timer);
  }, [step, kiss, stepAfterFlying]);

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
        style={{
          // Intro + flying let the map show through — the intro now
          // has no backdrop of its own, just the flock + falling gifts
          // over the actual map. Later steps sit on a blurred dark cover.
          background: (step === 'flying' || step === 'intro') ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.85)',
          backdropFilter: (step === 'flying' || step === 'intro') ? 'none' : 'blur(12px)',
          transition: 'background 1s, backdrop-filter 1s',
        }}
      >
        {/* ── Sender's chosen soundtrack · plays across the ENTIRE
             journey (intro → flying → password → template → share)
             instead of only inside the template reveal. AudioPlayer
             renders a floating pill top-left; user taps to start
             (browsers block autoplay without a gesture). Muted state
             hides it so the mute toggle still works. */}
        {senderSong && !muted && (
          <AudioPlayer url={senderSong} accent="#ec4899" />
        )}

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

        {/* ── Step 1: Cinematic Intro — gifts + letters drop, then the
             delivery vehicle appropriate to the sender→receiver distance
             flies / drives in to carry the kiss.
             Dev override: `?force_vehicle=car|dove|plane` in the URL
             forces the vehicle regardless of real distance. */}
        {step === 'intro' && (
          <GiftDropIntro
            distanceKm={haversineKm(kiss.sender_lat, kiss.sender_lng, kiss.receiver_lat, kiss.receiver_lng)}
            vehicle={readForcedVehicle()}
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

        {/* ── Step 2b: Password lock ── only when the sender set a
             numeric passcode via template_data.password. Receiver
             must enter the correct number to advance to the
             countdown. Optional hint from template_data.password_hint. */}
        {step === 'password' && (
          <PasswordLock
            correct={passcode.code}
            hint={passcode.hint}
            senderName={kiss.sender_name}
            accent="#ec4899"
            onSuccess={advanceToReveal}
          />
        )}

        {/* ── Step 4b: Template reveal ── auto-plays after password
             when the kiss's template_id matches a registered React
             component. Full-screen takeover; template's own X advances
             to the share screen so the flow stays continuous. */}
        {step === 'template' && registeredTemplate && (
          <registeredTemplate.Component
            kiss={{
              id: kiss.id,
              sender_id: kiss.sender_id,
              sender_name: kiss.sender_name,
              sender_avatar: kiss.sender_avatar,
              receiver_id: kiss.receiver_id,
              receiver_name: kiss.receiver_name,
              receiver_avatar: kiss.receiver_avatar,
              message: kiss.message ?? '',
              emoji: kiss.emoji,
              photos: kiss.photos ?? null,
              music_url: kiss.music_url ?? null,
              music_title: kiss.music_title ?? null,
              template_id: kiss.template_id ?? null,
              template_data: kiss.template_data ?? null,
              created_at: kiss.created_at,
            }}
            onClose={() => setStep('share')}
          />
        )}

        {/* ── Step 4: Message ── (fallback when no template) */}
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
