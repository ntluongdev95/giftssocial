'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Download, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Kiss {
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
  created_at: string;
}

interface Props {
  kiss: Kiss;
  onClose: () => void;
  onFlyStart?: () => void; // callback to trigger map flyTo
}

type Step = 'intro' | 'flying' | 'arrive' | 'message' | 'share';

const STEP_DURATIONS: Record<Step, number> = {
  intro: 3000,
  flying: 0, // controlled by map animation callback
  arrive: 5000, // chibi hug animation takes ~3.5s + buffer
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

// Generate particles for arrival
function ArrivalParticles({ emoji }: { emoji: string }) {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    emoji: i % 3 === 0 ? emoji : ['✨', '💫', '⭐', '🌟', '💖'][i % 5],
    x: (Math.random() - 0.5) * 300,
    y: (Math.random() - 0.5) * 300,
    delay: Math.random() * 0.5,
    scale: 0.5 + Math.random() * 1.5,
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
  const shareCardRef = useRef<HTMLDivElement>(null);
  const hasFlownRef = useRef(false);

  // Fetch city names
  useEffect(() => {
    getCity(kiss.sender_lat, kiss.sender_lng).then(setSenderCity);
    getCity(kiss.receiver_lat, kiss.receiver_lng).then(setReceiverCity);
  }, [kiss]);

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

  // Listen for flight animation completion
  useEffect(() => {
    if (step !== 'flying') return;

    // Fallback: if flight takes too long, advance after 30s
    const fallback = setTimeout(() => setStep('arrive'), 30000);

    // Listen for gift marker placement (means flight ended)
    const observer = new MutationObserver(() => {
      // Check if a gift marker appeared
      const gifts = document.querySelectorAll('[data-kiss-gift]');
      if (gifts.length > 0) {
        clearTimeout(fallback);
        setTimeout(() => setStep('arrive'), 500);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Also advance if map settles (simpler: just wait based on distance)
    const dist = Math.abs(kiss.sender_lat - kiss.receiver_lat) + Math.abs(kiss.sender_lng - kiss.receiver_lng);
    const flyTime = dist < 0.5 ? 9000 : dist < 5 ? 12000 : 27000;
    const timer = setTimeout(() => setStep('arrive'), flyTime);

    return () => {
      clearTimeout(fallback);
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [step, kiss]);

  const handleShare = useCallback(async (platform: string) => {
    const text = `${kiss.emoji} Got a kiss from ${kiss.sender_name || 'someone'}! ${senderCity} → ${receiverCity} on Gao Social`;
    const url = `${window.location.origin}/world?kiss=${kiss.id}`;

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
    navigator.clipboard.writeText(`${window.location.origin}/world?kiss=${kiss.id}`);
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
        {/* Close button — always visible */}
        <button onClick={onClose} className="absolute top-6 right-6 z-[1000] h-10 w-10 rounded-full flex items-center justify-center text-white/50 hover:text-white cursor-pointer transition-colors" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <X size={18} />
        </button>

        {/* ── Step 1: Intro ── */}
        {step === 'intro' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="flex flex-col items-center gap-5 text-center px-6"
          >
            {/* Sender avatar */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', damping: 15 }}
              className="h-24 w-24 rounded-full flex items-center justify-center text-4xl font-bold overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #ec4899, #f87171)', border: '3px solid rgba(236,72,153,0.4)', boxShadow: '0 0 40px rgba(236,72,153,0.3)' }}
            >
              {kiss.sender_avatar
                ? <img src={kiss.sender_avatar} alt="" className="h-full w-full object-cover" />
                : (kiss.sender_name || '?').charAt(0).toUpperCase()
              }
            </motion.div>

            {/* Emoji */}
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.5, type: 'spring', damping: 12 }}
              className="text-6xl"
            >
              {kiss.emoji}
            </motion.div>

            {/* Text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <p className="text-2xl font-bold text-white">{kiss.sender_name || 'Someone'}</p>
              <p className="text-sm text-[#ec4899] mt-1">sent you a kiss</p>
              {senderCity && (
                <p className="text-xs text-[#4a5068] mt-2">from {senderCity}</p>
              )}
            </motion.div>

            {/* Loading dots */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="flex gap-1.5 mt-4"
            >
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="h-2 w-2 rounded-full bg-[#ec4899]"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
                />
              ))}
            </motion.div>
          </motion.div>
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

            {/* Chibi hug scene */}
            <div className="relative h-48 w-full flex items-end justify-center overflow-hidden">
              {/* Ground line */}
              <div className="absolute bottom-6 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(236,72,153,0.2) 30%, rgba(0,212,255,0.2) 70%, transparent)' }} />

              {/* Quote */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0, 1, 1, 0] }}
                transition={{ duration: 3, times: [0, 0.1, 0.25, 0.75, 1] }}
                className="absolute top-0 left-0 right-0 text-center text-[10px] italic text-[#4a5068]"
              >
                distance means nothing when someone means everything
              </motion.p>

              {/* Sender chibi — runs from left */}
              <motion.div
                initial={{ x: -130 }}
                animate={{ x: [-130, -40, 30, 65] }}
                transition={{ duration: 3, ease: 'easeOut', times: [0, 0.4, 0.8, 1] }}
                className="absolute bottom-6 z-10 flex flex-col items-center"
              >
                <motion.div
                  animate={{ y: [0, -6, 0, -6, 0, -3, 0, 0] }}
                  transition={{ duration: 2.8, times: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1] }}
                  className="flex flex-col items-center"
                >
                  <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold"
                    style={{ background: 'rgba(236,72,153,0.15)', border: '2.5px solid #ec4899', color: '#ec4899', boxShadow: '0 0 15px rgba(236,72,153,0.3)' }}>
                    {kiss.sender_avatar
                      ? <img src={kiss.sender_avatar} alt="" className="w-full h-full object-cover" />
                      : (kiss.sender_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <svg width="32" height="36" viewBox="0 0 32 36" className="-mt-1">
                    <line x1="16" y1="2" x2="16" y2="18" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round"/>
                    <motion.line x1="16" y1="8" x2="6" y2="4" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"
                      animate={{ x2: [6, 4, 6, 4, 2], y2: [4, 12, 4, 12, 2] }}
                      transition={{ duration: 2.8, times: [0, 0.15, 0.3, 0.7, 1] }}/>
                    <motion.line x1="16" y1="8" x2="26" y2="12" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"
                      animate={{ x2: [26, 28, 26, 28, 30], y2: [12, 4, 12, 4, 2] }}
                      transition={{ duration: 2.8, times: [0, 0.15, 0.3, 0.7, 1] }}/>
                    <motion.line x1="16" y1="18" x2="10" y2="34" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"
                      animate={{ x2: [10, 20, 10, 20, 12] }}
                      transition={{ duration: 2.8, times: [0, 0.15, 0.3, 0.7, 1] }}/>
                    <motion.line x1="16" y1="18" x2="22" y2="34" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"
                      animate={{ x2: [22, 12, 22, 12, 20] }}
                      transition={{ duration: 2.8, times: [0, 0.15, 0.3, 0.7, 1] }}/>
                  </svg>
                </motion.div>
                <span className="text-[8px] font-semibold text-[#ec4899]">{kiss.sender_name || 'Sender'}</span>
              </motion.div>

              {/* Receiver chibi — stands still */}
              <motion.div
                initial={{ x: 80, opacity: 0 }}
                animate={{ x: 80, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="absolute bottom-6 z-10 flex flex-col items-center"
              >
                <motion.div
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex flex-col items-center"
                >
                  <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold"
                    style={{ background: 'rgba(0,212,255,0.15)', border: '2.5px solid #00d4ff', color: '#00d4ff', boxShadow: '0 0 15px rgba(0,212,255,0.3)' }}>
                    {kiss.receiver_avatar
                      ? <img src={kiss.receiver_avatar} alt="" className="w-full h-full object-cover" />
                      : (kiss.receiver_name || 'You').charAt(0).toUpperCase()}
                  </div>
                  <svg width="32" height="36" viewBox="0 0 32 36" className="-mt-1" style={{ transform: 'scaleX(-1)' }}>
                    <line x1="16" y1="2" x2="16" y2="18" stroke="#00d4ff" strokeWidth="2.5" strokeLinecap="round"/>
                    <motion.line x1="16" y1="8" x2="6" y2="14" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"
                      animate={{ x2: [6, 6, 6, 2], y2: [14, 14, 14, 3] }}
                      transition={{ duration: 3, times: [0, 0.7, 0.85, 1] }}/>
                    <motion.line x1="16" y1="8" x2="26" y2="14" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"
                      animate={{ x2: [26, 26, 26, 30], y2: [14, 14, 14, 3] }}
                      transition={{ duration: 3, times: [0, 0.7, 0.85, 1] }}/>
                    <line x1="16" y1="18" x2="11" y2="34" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="16" y1="18" x2="21" y2="34" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </motion.div>
                <span className="text-[8px] font-semibold text-[#00d4ff]">{kiss.receiver_name || 'You'}</span>
              </motion.div>

              {/* Glow when they meet */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 0, 0.8, 0.4], scale: [0, 0, 1.5, 2] }}
                transition={{ duration: 3.5, times: [0, 0.7, 0.85, 1] }}
                className="absolute w-24 h-24 rounded-full"
                style={{ bottom: '3rem', right: '20%', background: 'radial-gradient(circle, rgba(236,72,153,0.5), rgba(0,212,255,0.3), transparent 70%)' }}
              />
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.5 }}
              className="text-xs text-[#4a5068]"
            >
              {senderCity} → {receiverCity}
            </motion.p>
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
                  <p className="text-[11px] text-[#ec4899] mt-0.5">sent a kiss to</p>
                  <p className="text-lg font-bold text-white mt-0.5">{kiss.receiver_name || 'You'}</p>
                </div>

                {/* Route */}
                <div className="flex items-center gap-2 text-xs text-[#4a5068]">
                  <span>{senderCity}</span>
                  <span className="text-[#ec4899]">✈️</span>
                  <span>{receiverCity}</span>
                </div>

                {/* Message */}
                {kiss.message && (
                  <p className="text-sm text-[#a3adc3] italic">&ldquo;{kiss.message}&rdquo;</p>
                )}

                {/* Branding */}
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="h-4 w-4 rounded-full" style={{ background: 'linear-gradient(135deg, #00d4ff, #6366f1)' }} />
                  <span className="text-[10px] font-semibold text-[#4a5068]">Gao Social</span>
                </div>
              </div>
            </div>

            {/* Share buttons */}
            <div className="space-y-2">
              {/* Native share (mobile) */}
              {typeof navigator !== 'undefined' && navigator.share && (
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
