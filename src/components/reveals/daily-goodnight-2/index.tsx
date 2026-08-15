'use client';

// Good Night · Moon Whisper (Option C — refined)
// ─────────────────────────────────────────────────────────────────────
// A deep BLACK night sky. A warm moon hangs high with the sender
// curled up inside like the man-in-the-moon. Photos of the sender fade
// into the sky one by one — each a memory the moon is whispering down
// to lull the receiver to sleep. Elegant serif typography (Playfair
// Display) sets the mood, no cluttered cursive.

import { useMemo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playMessageChime, playHeartbeat, playCelebration } from '@/lib/kiss-audio';
import { getKissString, parseKissData } from '../_shared/useTemplateData';
import type { TemplateProps, TemplateConfig } from '../_types';

// ─── Palette · pure midnight black + warm moon ─────────────────────
const SKY_BLACK  = '#020212';
const MOON_CORE  = '#FFF8E1';
const MOON_MID   = '#F6C46A';
const MOON_DEEP  = '#B4761D';
const HEART      = '#F43F5E';
const ACCENT_HOT = '#F9A8D4';

// ─── Font stack · elegant serif hero, italic serif whisper ─────────
const FONT_HERO    = "'Playfair Display', 'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const FONT_WHISPER = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const FONT_BODY    = "'Inter', system-ui, sans-serif";

const PHOTO_COUNT = 6;
const REVEAL_INTERVAL_MS = 2000;

// ─────────────────────────────────────────────────────────────────────
// MoonWithSender — big warm moon with the sender silhouette curled
// inside. Optionally pulses as a heart during the finale.
// ─────────────────────────────────────────────────────────────────────
function MoonWithSender({ finalHeart, size }: { finalHeart: boolean; size: number }) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {/* Halo behind moon */}
      <div
        style={{
          position: 'absolute',
          inset: '-40%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${MOON_CORE}44 0%, ${MOON_MID}22 40%, transparent 70%)`,
          filter: 'blur(28px)',
          pointerEvents: 'none',
        }}
      />
      {/* Moon disc */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(circle at 38% 36%, ${MOON_CORE} 0%, ${MOON_MID} 55%, ${MOON_DEEP} 100%)`,
          boxShadow: `0 0 50px ${MOON_CORE}88, 0 0 120px ${MOON_MID}55`,
        }}
      />
      {/* Crater shadows */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `
            radial-gradient(circle at 65% 60%, rgba(0,0,0,0.10) 0%, transparent 20%),
            radial-gradient(circle at 30% 65%, rgba(0,0,0,0.06) 0%, transparent 18%),
            radial-gradient(circle at 55% 30%, rgba(0,0,0,0.07) 0%, transparent 16%)
          `,
        }}
      />
      {/* Sender silhouette curled up inside moon */}
      <svg
        viewBox="0 0 100 100"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <g fill="rgba(40,20,5,0.5)">
          <ellipse cx="52" cy="47" rx="7" ry="7.5" />
          <path d="M 40 66 Q 36 74 42 82 L 62 82 Q 68 74 64 66 Q 60 60 52 60 Q 44 60 40 66 Z" />
          <path d="M 42 82 Q 44 74 52 72 Q 60 74 62 82 L 62 88 L 42 88 Z" />
          <path d="M 38 72 Q 44 78 52 78 Q 60 78 66 72 Q 62 82 52 82 Q 42 82 38 72 Z" />
        </g>
      </svg>

      {/* Finale heart pulse in moon centre */}
      <AnimatePresence>
        {finalHeart && (
          <motion.div
            className="absolute"
            style={{
              left: '50%', top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '32%', height: '32%',
              pointerEvents: 'none',
            }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: [0.9, 1.1, 0.95, 1.1, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
          >
            <svg viewBox="0 0 20 20" width="100%" height="100%" style={{ filter: `drop-shadow(0 0 8px ${HEART}) drop-shadow(0 0 16px ${ACCENT_HOT})` }}>
              <path d="M 10 18 C 4 13, 1 9, 1 6 C 1 3, 3 1, 6 1 C 8 1, 9 2, 10 4 C 11 2, 12 1, 14 1 C 17 1, 19 3, 19 6 C 19 9, 16 13, 10 18 Z" fill={HEART} />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main reveal
// ─────────────────────────────────────────────────────────────────────
function DailyGoodnight2Reveal({ kiss, onClose }: TemplateProps) {
  const rawName = (getKissString(kiss, 'name') || kiss.receiver_name || 'em').trim();
  const displayName = rawName || 'em';

  const photos: string[] = (() => {
    const raw = parseKissData(kiss).photos;
    if (Array.isArray(raw)) {
      return raw.filter((u): u is string => typeof u === 'string' && !!u).slice(0, PHOTO_COUNT);
    }
    const single = getKissString(kiss, 'photo');
    return single ? [single] : [];
  })();

  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsNarrow(window.innerWidth < 720);
    const on = () => setIsNarrow(window.innerWidth < 720);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  const [revealedCount, setRevealedCount] = useState(0);
  const [finalPhase, setFinalPhase] = useState(false);
  const [darkFade, setDarkFade] = useState(false);

  useEffect(() => {
    const startDelay = setTimeout(() => {
      let i = 0;
      const tick = () => {
        i += 1;
        setRevealedCount(i);
        playMessageChime();
        if (i < PHOTO_COUNT) {
          setTimeout(tick, REVEAL_INTERVAL_MS);
        } else {
          setTimeout(() => { setFinalPhase(true); playHeartbeat(); }, 2000);
          setTimeout(() => { setDarkFade(true); playCelebration(); }, 9500);
          setTimeout(() => onClose(), 14_500);
        }
      };
      tick();
    }, 1800);
    return () => clearTimeout(startDelay);
  }, [onClose]);

  const advance = useCallback(() => {
    setRevealedCount(c => Math.min(PHOTO_COUNT, c + 1));
    playMessageChime();
  }, []);

  // Stars — 160 twinkling everywhere on the black sky
  const stars = useMemo(() => (
    Array.from({ length: 160 }).map((_, i) => {
      const s = (i * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      const tier = i % 8 === 0 ? 'bright' : i % 3 === 0 ? 'mid' : 'faint';
      return {
        left: r(1) * 100,
        top:  r(2) * 100,
        size: tier === 'bright' ? 1.6 + r(3) * 1.2 : tier === 'mid' ? 0.9 + r(3) * 0.6 : 0.5 + r(3) * 0.4,
        delay: r(4) * 6,
        dur: 3 + r(5) * 4,
        alpha: tier === 'bright' ? 0.95 : tier === 'mid' ? 0.7 : 0.45,
      };
    })
  ), []);

  // Photo positions — arranged in an ARC below the moon (like moonlight
  // gently spreading downward). Deterministic polar coords per index.
  const moonSize = isNarrow ? 170 : 240;
  const moonTopVh = isNarrow ? 12 : 15;                      // moon TOP edge

  const photoLayout = useMemo(() => {
    // Arc spanning -50° to +50° (measuring from vertical-down)
    // Radius from moon center
    const arcSpan = 100;
    return Array.from({ length: PHOTO_COUNT }).map((_, i) => {
      const t = (i / (PHOTO_COUNT - 1)) - 0.5;               // -0.5 .. 0.5
      const angleDeg = t * arcSpan;
      const angleRad = (angleDeg * Math.PI) / 180;
      // Two radii bands so the arc doesn't look flat
      const band = i % 2 === 0 ? 0 : 40;                     // px extra outward
      const baseR = isNarrow ? 145 : 220;
      const r = baseR + band;
      const dx = r * Math.sin(angleRad);
      const dy = r * Math.cos(angleRad);
      return { angleDeg, dx, dy };
    });
  }, [isNarrow]);

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden select-none cursor-pointer"
      onClick={advance}
      style={{
        background: SKY_BLACK,                               // PURE deep black
        fontFamily: FONT_BODY,
      }}
    >
      {/* ── Stars everywhere ── */}
      {stars.map((st, i) => (
        <motion.div
          key={`star-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${st.left}%`, top: `${st.top}%`,
            width: st.size, height: st.size,
            background: '#fff',
            boxShadow: st.size > 1.4 ? `0 0 ${st.size * 3}px rgba(255,255,255,0.7)` : `0 0 ${st.size * 2}px rgba(255,255,255,0.35)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [st.alpha * 0.35, st.alpha, st.alpha * 0.35] }}
          transition={{ duration: st.dur, delay: st.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* ── MOON top-centre with sender inside ── */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          left: '50%',
          top: `${moonTopVh}vh`,
          transform: 'translateX(-50%)',
          width: moonSize,
          height: moonSize,
          zIndex: 30,
        }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <MoonWithSender finalHeart={finalPhase && !darkFade} size={moonSize} />
      </motion.div>

      {/* ── PHOTOS · arc below the moon, revealed one by one ── */}
      {photos.length > 0 && photoLayout.slice(0, revealedCount).map((pos, idx) => {
        const url = photos[idx % photos.length];
        const size = isNarrow ? 76 : 108;
        return (
          <motion.div
            key={`photo-${idx}`}
            className="absolute pointer-events-none"
            style={{
              left: `calc(50% + ${pos.dx}px)`,
              top:  `calc(${moonTopVh}vh + ${moonSize / 2 + pos.dy}px)`,
              width: size,
              height: size,
              transform: 'translate(-50%, -50%)',
              zIndex: 25,
            }}
            initial={{ opacity: 0, scale: 0.4, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: [0, -5, 0] }}
            transition={{
              opacity: { duration: 1.0, delay: 0.4 },
              scale:   { duration: 1.0, delay: 0.4, ease: [0.16, 1, 0.3, 1] },
              filter:  { duration: 1.0, delay: 0.4 },
              y:       { duration: 5 + (idx % 3), delay: 1.5, repeat: Infinity, ease: 'easeInOut' },
            }}
          >
            <svg viewBox="0 0 100 100" width="100%" height="100%" style={{
              overflow: 'visible',
              filter: `drop-shadow(0 4px 12px rgba(0,0,0,0.6)) drop-shadow(0 0 14px ${MOON_CORE}) drop-shadow(0 0 28px ${MOON_MID}88)`,
            }}>
              <defs>
                <clipPath id={`moon-photo-clip-${idx}`}>
                  <circle cx="50" cy="50" r="48" />
                </clipPath>
              </defs>
              <image
                href={url}
                x="0" y="0" width="100" height="100"
                preserveAspectRatio="xMidYMid slice"
                clipPath={`url(#moon-photo-clip-${idx})`}
              />
              <circle cx="50" cy="50" r="48"
                fill="none" stroke={MOON_CORE} strokeWidth="2.5" />
              <circle cx="50" cy="50" r="48"
                fill="none" stroke={MOON_DEEP} strokeWidth="1" />
            </svg>
          </motion.div>
        );
      })}

      {/* ── Intro whisper · italic serif, top-center ── */}
      <motion.div
        className="absolute inset-x-0 pointer-events-none text-center px-6"
        style={{ top: '3%', zIndex: 40 }}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: [0, 0.85, 0.85, 0], y: 0 }}
        transition={{ duration: 6, times: [0, 0.1, 0.75, 1], delay: 0.6 }}
      >
        <div style={{
          fontFamily: FONT_WHISPER,
          fontStyle: 'italic',
          fontWeight: 500,
          fontSize: 'clamp(16px, 2.6vw, 26px)',
          color: 'rgba(255,255,255,0.85)',
          letterSpacing: '0.02em',
          textShadow: '0 2px 12px rgba(0,0,0,0.7)',
        }}>
          Trăng đêm nay có một người đang ru {displayName} ngủ…
        </div>
      </motion.div>

      {/* ── Progress chip ─ counter of revealed memories ── */}
      {!finalPhase && revealedCount > 0 && (
        <motion.div
          key={revealedCount}
          className="absolute pointer-events-none inset-x-0 text-center"
          style={{ bottom: '8%', zIndex: 40 }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 0.75, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div style={{
            display: 'inline-block',
            padding: '4px 14px',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.55)',
            border: `1px solid ${MOON_CORE}44`,
            fontFamily: FONT_BODY,
            fontSize: 12,
            letterSpacing: 1.5,
            color: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(6px)',
          }}>
            {revealedCount} / {PHOTO_COUNT}
          </div>
        </motion.div>
      )}

      {/* ── FINAL PHASE · elegant serif hero + sender lines ── */}
      <AnimatePresence>
        {finalPhase && (
          <motion.div
            key="final-msg"
            className="absolute inset-x-0 pointer-events-none text-center px-8"
            style={{ bottom: '10%', zIndex: 45 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Whisper (italic serif) */}
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 0.85, y: 0 }}
              transition={{ duration: 0.9, delay: 0.4 }}
              style={{
                fontFamily: FONT_WHISPER,
                fontStyle: 'italic',
                fontWeight: 500,
                fontSize: 'clamp(16px, 2.6vw, 24px)',
                color: 'rgba(255,255,255,0.9)',
                letterSpacing: '0.02em',
                textShadow: `0 2px 12px rgba(0,0,0,0.75), 0 0 18px ${MOON_MID}44`,
              }}
            >
              Anh đang ru em ngủ từ trên trăng
            </motion.div>

            {/* HERO title (Playfair serif) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1.2, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
              style={{
                marginTop: 14,
                fontFamily: FONT_HERO,
                fontWeight: 700,
                fontSize: 'clamp(34px, 6.5vw, 68px)',
                color: '#fff',
                lineHeight: 1.1,
                letterSpacing: '-0.01em',
                textShadow: `0 4px 22px rgba(0,0,0,0.75), 0 0 24px ${MOON_MID}66, 0 0 48px ${MOON_CORE}44`,
              }}
            >
              Ngủ ngon, {displayName}.
            </motion.div>

            {/* Fine gold divider */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 'clamp(120px, 22%, 260px)' }}
              transition={{ duration: 1.4, delay: 2.0, ease: [0.16, 1, 0.3, 1] }}
              style={{
                height: 1.5,
                margin: '18px auto 0',
                background: `linear-gradient(90deg, transparent, ${MOON_MID}, ${MOON_CORE}, ${MOON_MID}, transparent)`,
                filter: `drop-shadow(0 0 8px ${MOON_MID}88)`,
                opacity: 0.75,
              }}
            />

            {/* Sender's message (Cormorant italic) */}
            {kiss.message && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9 }}
                transition={{ duration: 1.0, delay: 2.6 }}
                className="max-w-md mx-auto"
                style={{
                  marginTop: 16,
                  fontFamily: FONT_WHISPER,
                  fontStyle: 'italic',
                  fontSize: 'clamp(15px, 2.2vw, 20px)',
                  color: 'rgba(255,240,240,0.95)',
                  lineHeight: 1.4,
                  textShadow: '0 2px 10px rgba(0,0,0,0.7)',
                }}
              >
                &ldquo;{kiss.message}&rdquo;
              </motion.div>
            )}

            {/* Sender signature (small caps sans) */}
            {kiss.sender_name && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.8 }}
                transition={{ duration: 0.8, delay: 3.4 }}
                style={{
                  marginTop: 8,
                  fontFamily: FONT_BODY,
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: MOON_MID,
                }}
              >
                — {kiss.sender_name}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Dark fade at end — everything but moon dims ── */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: '#000', zIndex: 50 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: darkFade ? 0.7 : 0 }}
        transition={{ duration: 3 }}
      />
    </div>
  );
}

export default DailyGoodnight2Reveal;

export const DailyGoodnight2Config: TemplateConfig = {
  id: 'daily-goodnight-2',
  name: 'Good Night · Ánh Trăng',
  occasionIds: ['daily'],
  emoji: '🌙',
  description: 'Vầng trăng ấm với sender ngồi bên trong. Ảnh của bạn hiện lần lượt trên bầu trời đêm đen tuyền, như những ký ức được trăng thì thầm ru em ngủ.',
  thumbnailBg: 'linear-gradient(135deg, #020212, #F6C46A, #FFF8E1)',
  Component: DailyGoodnight2Reveal,
};
