'use client';

// Good Night · City Bedtime — 4-phase interactive lullaby.
// ─────────────────────────────────────────────────────────────────────
//
//   Phase 1 · MỞ ĐẦU
//     Bird's-eye 3D view of a lit-up city. A soft narration line fades
//     in at the corner: "Thành phố hôm nay có vẻ ồn ào quá..."
//
//   Phase 2 · DỖ TỪNG TÒA NHÀ
//     Player taps each ordinary building → its windows blink twice,
//     a whispered "shhh…" plays, the lights fade, the whole building
//     tilts slightly (going to sleep), and a soft "snore ring" of
//     light pulses around it for 2 seconds. Progress counter drops.
//
//   Phase 3 · TÒA NHÀ ĐẶC BIỆT
//     One cozy warm building sits apart. Once every other building
//     is asleep, its window lights up warmly + becomes tappable. On
//     tap: sender's photo materializes in the window, a message
//     appears alongside, and a red heart floats up + beats + tan
//     into the night sky.
//
//   Phase 4 · TƯƠNG TÁC NGƯỢC
//     A small "Đã ngủ chưa?" button appears. Tap → a final closing
//     message writes itself, everything fades to darkness leaving
//     only the moon glowing overhead.
//
// ─────────────────────────────────────────────────────────────────────

import { useMemo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playMessageChime, playHeartbeat, playCelebration } from '@/lib/kiss-audio';
import { getKissString, parseKissData } from '../_shared/useTemplateData';
import type { TemplateProps, TemplateConfig } from '../_types';

// ─── Palette ─────────────────────────────────────────────────────────
const SKY_TOP    = '#0b0a1e';    // deep midnight
const SKY_MID    = '#1a1a3a';
const SKY_BASE   = '#050510';
const MOON_CORE  = '#fef3c7';
const MOON_GLOW  = '#fbbf24';
const WINDOW_ON  = '#fef08a';    // bright yellow window
const WINDOW_DIM = '#3a3a4e';    // asleep grey
const BUILDING_A = '#1e293b';
const BUILDING_B = '#0f172a';
const SPECIAL_WARM = '#f59e0b';
const HEART      = '#ef4444';
const ACCENT_HOT = '#f9a8d4';

// ─── Config ─────────────────────────────────────────────────────────
const NUM_BUILDINGS = 12;         // ordinary buildings to lull to sleep

// ─────────────────────────────────────────────────────────────────────
// Building bitmap positions & sizes — deterministic per index so
// hydration doesn't reshuffle. Positioned in the lower half of the
// viewport (city ground) with varied widths + heights + window grid
// densities. Two rows for parallax feel.
// ─────────────────────────────────────────────────────────────────────
type Building = {
  id: number;
  x: number;        // vw (centre)
  y: number;        // vh (bottom edge)
  w: number;        // px
  h: number;        // px
  color: string;
  windowCols: number;
  windowRows: number;
  row: 'back' | 'front';
};

function buildCity(count: number, isNarrow: boolean): Building[] {
  const out: Building[] = [];
  for (let i = 0; i < count; i++) {
    const s = ((i + 1) * 2654435761) >>> 0;
    const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
    const isBack = i % 2 === 0;
    // Two rows: back sits higher (further away), front sits at the
    // shore edge with bigger buildings
    const row: 'back' | 'front' = isBack ? 'back' : 'front';
    const halfCount = count / 2;
    // Alternate arrangement across viewport width
    const idxInRow = Math.floor(i / 2);
    const perRow = halfCount;
    const xBase = (idxInRow + 0.5) / perRow * 100;
    const x = xBase + (r(1) - 0.5) * 5;               // small jitter
    const wBase = isNarrow ? 42 : 68;
    const hBase = isNarrow ? 90 : 140;
    const w = wBase + r(2) * (isNarrow ? 24 : 36);
    const h = hBase + r(3) * (isNarrow ? 60 : 90);
    const y = row === 'front' ? 10 + r(4) * 6 : 22 + r(5) * 8;
    const color = i % 3 === 0 ? BUILDING_B : BUILDING_A;
    const windowCols = 3 + Math.floor(r(6) * 2);      // 3-4
    const windowRows = 4 + Math.floor(r(7) * 4);      // 4-7
    out.push({ id: i, x, y, w, h, color, windowCols, windowRows, row });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Building component — a rectangle with a grid of window "dots".
// When `lit=false` the windows blink 2× (hesitate), fade to WINDOW_DIM,
// and the whole building tilts ~6°. A pulsing snore ring appears briefly.
// ─────────────────────────────────────────────────────────────────────
function BuildingCard({
  b, lit, onSleep,
}: {
  b: Building;
  lit: boolean;
  onSleep: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const [snoreOn, setSnoreOn] = useState(false);

  const handleClick = () => {
    if (!lit || pressed) return;
    setPressed(true);
    setSnoreOn(true);
    setTimeout(() => setSnoreOn(false), 2200);
    onSleep();
  };

  const cellPad = 4;
  const cellW = (b.w - cellPad * 2) / b.windowCols;
  const cellH = (b.h - cellPad * 2 - 12) / b.windowRows;   // -12 for roof

  return (
    <motion.div
      className={lit ? 'absolute cursor-pointer' : 'absolute pointer-events-none'}
      onClick={handleClick}
      style={{
        left: `${b.x}vw`,
        bottom: `${b.y}vh`,
        width: b.w,
        height: b.h,
        transform: 'translateX(-50%)',
        transformOrigin: 'bottom center',
        touchAction: 'manipulation',
      }}
      animate={{
        rotate: lit ? 0 : b.id % 2 === 0 ? -6 : 6,
        y: lit ? 0 : 4,
      }}
      transition={{ duration: 0.9, delay: lit ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Building body */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: b.color,
          borderRadius: 3,
          boxShadow: lit
            ? `0 6px 20px rgba(0,0,0,0.75), 0 0 24px rgba(254,240,138,0.15)`
            : `0 4px 12px rgba(0,0,0,0.6)`,
          transition: 'box-shadow 1.2s',
        }}
      />
      {/* Roof cap */}
      <div
        style={{
          position: 'absolute',
          left: '20%',
          right: '20%',
          top: -6,
          height: 8,
          background: b.color,
          borderRadius: '4px 4px 0 0',
          opacity: 0.9,
        }}
      />
      {/* Windows grid */}
      <div
        style={{
          position: 'absolute',
          left: cellPad,
          right: cellPad,
          top: cellPad + 8,
          bottom: cellPad,
          display: 'grid',
          gridTemplateColumns: `repeat(${b.windowCols}, 1fr)`,
          gap: 2,
        }}
      >
        {Array.from({ length: b.windowCols * b.windowRows }).map((_, i) => (
          <motion.div
            key={i}
            style={{
              width: '100%',
              height: cellH - 2,
              borderRadius: 1,
              background: lit ? WINDOW_ON : WINDOW_DIM,
              boxShadow: lit ? `0 0 4px ${WINDOW_ON}, inset 0 0 2px rgba(255,255,255,0.5)` : 'none',
            }}
            animate={
              !lit && pressed
                ? {
                    // Blink twice → fade to dim
                    backgroundColor: [WINDOW_ON, WINDOW_DIM, WINDOW_ON, WINDOW_DIM, WINDOW_DIM],
                    boxShadow: [
                      `0 0 4px ${WINDOW_ON}`,
                      'none',
                      `0 0 4px ${WINDOW_ON}`,
                      'none',
                      'none',
                    ],
                  }
                : {}
            }
            transition={{
              duration: 0.55,
              times: [0, 0.2, 0.4, 0.6, 1],
              delay: (i % 5) * 0.02,
            }}
          />
        ))}
      </div>
      {/* Snore ring — pulses around the building briefly on sleep */}
      <AnimatePresence>
        {snoreOn && (
          <motion.div
            className="absolute pointer-events-none"
            style={{
              inset: -10,
              borderRadius: 8,
              border: `2px solid ${MOON_CORE}`,
              boxShadow: `0 0 12px ${MOON_CORE}, 0 0 24px ${MOON_GLOW}88`,
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: [0, 0.85, 0, 0.85, 0], scale: [0.9, 1.15, 1.05, 1.2, 1.3] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.0, times: [0, 0.15, 0.4, 0.55, 1] }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Special building — the cozy warm one apart from the crowd. When
// tapped after all others sleep, the window lights up with the
// sender's photo and a floating heart rises.
// ─────────────────────────────────────────────────────────────────────
function SpecialBuilding({
  photoUrl, tappable, onTap, revealed,
}: {
  photoUrl?: string;
  tappable: boolean;
  onTap: () => void;
  revealed: boolean;
}) {
  return (
    <motion.div
      className={tappable ? 'absolute cursor-pointer' : 'absolute pointer-events-none'}
      onClick={tappable ? onTap : undefined}
      style={{
        left: '82%',
        bottom: '14vh',
        width: 90,
        height: 140,
        transform: 'translateX(-50%)',
        touchAction: 'manipulation',
      }}
      animate={
        tappable && !revealed
          ? { scale: [1, 1.06, 1] }
          : { scale: 1 }
      }
      transition={
        tappable && !revealed
          ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0.5 }
      }
    >
      {/* Halo glow — grows big when tappable, huge when revealed */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          inset: '-45%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${SPECIAL_WARM}66 0%, ${MOON_GLOW}33 40%, transparent 70%)`,
          filter: 'blur(20px)',
        }}
        animate={{ opacity: revealed ? 1 : tappable ? [0.6, 0.9, 0.6] : 0.25 }}
        transition={{
          duration: 1.6,
          repeat: tappable && !revealed ? Infinity : 0,
          ease: 'easeInOut',
        }}
      />
      {/* Building body */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#3a1e0a',
          borderRadius: 3,
          border: `1.5px solid ${SPECIAL_WARM}`,
          boxShadow: `0 8px 24px rgba(0,0,0,0.8), 0 0 24px ${SPECIAL_WARM}66`,
        }}
      />
      {/* Roof */}
      <div
        style={{
          position: 'absolute',
          left: '18%',
          right: '18%',
          top: -8,
          height: 10,
          background: '#5a2e0e',
          borderRadius: '4px 4px 0 0',
        }}
      />
      {/* Big warm WINDOW at top — reveals photo when tapped */}
      <div
        style={{
          position: 'absolute',
          left: '18%',
          right: '18%',
          top: 14,
          height: 58,
          background: revealed ? '#fff' : `linear-gradient(180deg, ${WINDOW_ON}, ${SPECIAL_WARM})`,
          borderRadius: 2,
          boxShadow: `inset 0 0 4px rgba(0,0,0,0.4), 0 0 12px ${WINDOW_ON}`,
          overflow: 'hidden',
          transition: 'background 0.6s',
        }}
      >
        {revealed && photoUrl && (
          <motion.img
            src={photoUrl}
            alt=""
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover', display: 'block',
              pointerEvents: 'none',
            }}
            initial={{ opacity: 0, scale: 1.3 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
        {/* Window cross bars */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1.5, background: '#3a1e0a', opacity: 0.55 }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1.5, background: '#3a1e0a', opacity: 0.55 }} />
        </div>
      </div>
      {/* Smaller warm windows below */}
      <div
        style={{
          position: 'absolute',
          left: '25%', right: '25%',
          top: 80, height: 40,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
          gap: 2,
        }}
      >
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              background: WINDOW_ON,
              borderRadius: 1,
              boxShadow: `0 0 3px ${WINDOW_ON}`,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main reveal
// ─────────────────────────────────────────────────────────────────────
function DailyGoodnight2Reveal({ kiss, onClose }: TemplateProps) {
  const rawName = (getKissString(kiss, 'name') || kiss.receiver_name || 'em').trim();
  const displayName = rawName || 'em';

  // Take the first photo from photos[] or fall back to `photo`.
  const photoUrl = (() => {
    const raw = parseKissData(kiss).photos;
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') return raw[0];
    return getKissString(kiss, 'photo');
  })();

  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsNarrow(window.innerWidth < 720);
    const on = () => setIsNarrow(window.innerWidth < 720);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  const buildings = useMemo(() => buildCity(NUM_BUILDINGS, isNarrow), [isNarrow]);

  // Ids of buildings that have been lulled to sleep
  const [asleep, setAsleep] = useState<Set<number>>(new Set());
  const litCount = buildings.length - asleep.size;
  const allAsleep = litCount === 0;

  // Special building states
  const [specialRevealed, setSpecialRevealed] = useState(false);
  const [showSleepBtn, setShowSleepBtn] = useState(false);
  const [phase4, setPhase4] = useState(false);
  const [finalFade, setFinalFade] = useState(false);

  const sleepBuilding = useCallback((id: number) => {
    setAsleep(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    playMessageChime();
  }, []);

  const tapSpecial = useCallback(() => {
    if (specialRevealed) return;
    setSpecialRevealed(true);
    playHeartbeat();
    // Show "Đã ngủ chưa?" button after the heart has floated + settled
    setTimeout(() => setShowSleepBtn(true), 5500);
  }, [specialRevealed]);

  const clickSleepBtn = useCallback(() => {
    setPhase4(true);
    playCelebration();
    // Full fade to darkness, then auto-close
    setTimeout(() => setFinalFade(true), 3800);
    setTimeout(() => onClose(), 8500);
  }, [onClose]);

  // Stars — 140 twinkling in upper half
  const stars = useMemo(() => (
    Array.from({ length: 140 }).map((_, i) => {
      const s = (i * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
      const tier = i % 8 === 0 ? 'bright' : i % 3 === 0 ? 'mid' : 'faint';
      return {
        left: r(1) * 100,
        top:  r(2) * 55,
        size: tier === 'bright' ? 1.6 + r(3) * 1.2 : tier === 'mid' ? 0.9 + r(3) * 0.6 : 0.5 + r(3) * 0.4,
        delay: r(4) * 6,
        dur: 3 + r(5) * 4,
        alpha: tier === 'bright' ? 0.95 : tier === 'mid' ? 0.7 : 0.45,
      };
    })
  ), []);

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden select-none" style={{
      background: `linear-gradient(180deg, ${SKY_TOP} 0%, ${SKY_MID} 55%, ${SKY_BASE} 100%)`,
    }}>
      {/* ── Final fade overlay — covers everything except the moon ── */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: '#000', zIndex: 40 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: finalFade ? 0.85 : 0 }}
        transition={{ duration: 2 }}
      />

      {/* ── Stars ── */}
      {stars.map((st, i) => (
        <motion.div
          key={`star-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${st.left}%`, top: `${st.top}%`,
            width: st.size, height: st.size,
            background: '#fff',
            boxShadow: st.size > 1.4 ? `0 0 ${st.size * 3}px rgba(255,255,255,0.75)` : `0 0 ${st.size * 2}px rgba(255,255,255,0.4)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [st.alpha * 0.35, st.alpha, st.alpha * 0.35] }}
          transition={{ duration: st.dur, delay: st.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* ── MOON top-right, always visible + on final fade stays lit ── */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          right: '8%',
          top: '8%',
          width: 'clamp(70px, 10vw, 120px)',
          height: 'clamp(70px, 10vw, 120px)',
          borderRadius: '50%',
          background: `radial-gradient(circle at 40% 40%, ${MOON_CORE} 0%, ${MOON_GLOW} 100%)`,
          boxShadow: `0 0 40px ${MOON_CORE}88, 0 0 80px ${MOON_GLOW}55`,
          zIndex: 50,
        }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{
          opacity: 1,
          scale: finalFade ? 1.2 : 1,
        }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* ── City ground line ── */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: '35%',
          background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.9) 100%)',
          zIndex: 1,
        }}
      />

      {/* ── Buildings ── */}
      <div className="absolute inset-0" style={{ zIndex: 5 }}>
        {buildings.map(b => (
          <BuildingCard
            key={b.id}
            b={b}
            lit={!asleep.has(b.id)}
            onSleep={() => sleepBuilding(b.id)}
          />
        ))}
      </div>

      {/* ── Special building ── */}
      <div className="absolute inset-0" style={{ zIndex: 6 }}>
        <SpecialBuilding
          photoUrl={photoUrl}
          tappable={allAsleep && !specialRevealed}
          revealed={specialRevealed}
          onTap={tapSpecial}
        />
      </div>

      {/* ── Phase 1 intro narration ── */}
      <motion.div
        className="absolute pointer-events-none px-6"
        style={{ top: '6%', left: '5%', maxWidth: '55vw', zIndex: 10 }}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: [0, 0.9, 0.9, 0], y: 0 }}
        transition={{ duration: 8, times: [0, 0.08, 0.85, 1], delay: 0.6 }}
      >
        <div
          style={{
            fontFamily: '"Dancing Script", cursive',
            fontStyle: 'italic',
            fontSize: 'clamp(15px, 2.4vw, 22px)',
            color: 'rgba(255,255,255,0.9)',
            lineHeight: 1.4,
            textShadow: '0 2px 12px rgba(0,0,0,0.7)',
          }}
        >
          Thành phố hôm nay có vẻ ồn ào quá.<br/>
          Có lẽ họ đang chờ ai đó dỗ họ ngủ...
        </div>
      </motion.div>

      {/* ── Phase 2 hint · appears after intro fades if user hasn't tapped ── */}
      {litCount === buildings.length && (
        <motion.div
          className="absolute inset-x-0 pointer-events-none text-center"
          style={{ top: '48%', zIndex: 10 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.75, 0.75, 0.4, 0.75] }}
          transition={{ duration: 3, delay: 9, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div style={{
            display: 'inline-block',
            padding: '6px 14px',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.5)',
            border: `1px solid ${WINDOW_ON}44`,
            fontFamily: '"Dancing Script", cursive',
            fontSize: 'clamp(14px, 2vw, 18px)',
            color: '#fff',
            backdropFilter: 'blur(6px)',
          }}>
            Chạm vào từng tòa nhà để dỗ họ ngủ 💫
          </div>
        </motion.div>
      )}

      {/* ── Progress counter top-center ── */}
      {!specialRevealed && (
        <motion.div
          className="absolute inset-x-0 pointer-events-none text-center"
          style={{ top: '3%', zIndex: 10 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 8 }}
        >
          <div style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.5)',
            border: `1px solid ${WINDOW_ON}44`,
            fontFamily: '"Bebas Neue", Impact, sans-serif',
            fontSize: 16,
            letterSpacing: 1.5,
            color: '#fff',
            backdropFilter: 'blur(6px)',
          }}>
            💡 {litCount} / {buildings.length} tòa còn thức
          </div>
        </motion.div>
      )}

      {/* ── Special building reveal · message + floating heart ── */}
      <AnimatePresence>
        {specialRevealed && !phase4 && (
          <>
            {/* Sender message — appears next to special building */}
            <motion.div
              key="special-msg"
              className="absolute pointer-events-none px-6"
              style={{ right: '4%', bottom: '35vh', maxWidth: '55vw', zIndex: 15 }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                style={{
                  fontFamily: '"Dancing Script", cursive',
                  fontStyle: 'italic',
                  fontSize: 'clamp(16px, 2.6vw, 24px)',
                  color: '#fff',
                  lineHeight: 1.35,
                  textShadow: `0 2px 12px rgba(0,0,0,0.8), 0 0 18px ${SPECIAL_WARM}66`,
                  textAlign: 'right',
                }}
              >
                Thành phố đã ngủ rồi.<br/>
                Chỉ còn mình anh thức để chờ {displayName} ngủ thôi.<br/>
                Ngủ ngon nhé 💛
              </div>
              {kiss.message && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.9 }}
                  transition={{ duration: 0.8, delay: 2.8 }}
                  style={{
                    marginTop: 10,
                    fontFamily: '"Dancing Script", cursive',
                    fontSize: 'clamp(13px, 2vw, 18px)',
                    color: ACCENT_HOT,
                    fontStyle: 'italic',
                    textAlign: 'right',
                  }}
                >
                  &ldquo;{kiss.message}&rdquo;
                </motion.div>
              )}
              {kiss.sender_name && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.85 }}
                  transition={{ duration: 0.6, delay: 3.4 }}
                  style={{
                    marginTop: 4,
                    fontFamily: '"Dancing Script", cursive',
                    fontSize: 14,
                    color: SPECIAL_WARM,
                    textAlign: 'right',
                  }}
                >
                  — {kiss.sender_name}
                </motion.div>
              )}
            </motion.div>

            {/* Rising heart · floats from special building up + beats + fades */}
            <motion.div
              key="rise-heart"
              className="absolute pointer-events-none"
              style={{ left: '82%', bottom: '30vh', transform: 'translateX(-50%)', zIndex: 20 }}
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={{
                opacity: [0, 1, 1, 1, 0],
                y: [0, -60, -180, -280, -380],
                scale: [0.6, 1.1, 1.0, 1.1, 0.7],
              }}
              transition={{ duration: 4.5, delay: 1.6, times: [0, 0.15, 0.5, 0.8, 1], ease: 'easeOut' }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1, 1.15, 1] }}
                transition={{ duration: 0.9, delay: 2.4, repeat: 3, ease: 'easeInOut' }}
              >
                <svg viewBox="0 0 20 20" width={44} height={44} style={{ filter: `drop-shadow(0 0 10px ${HEART}) drop-shadow(0 0 22px ${ACCENT_HOT})` }}>
                  <path
                    d="M 10 18 C 4 13, 1 9, 1 6 C 1 3, 3 1, 6 1 C 8 1, 9 2, 10 4 C 11 2, 12 1, 14 1 C 17 1, 19 3, 19 6 C 19 9, 16 13, 10 18 Z"
                    fill={HEART}
                  />
                </svg>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Phase 4 button ── */}
      <AnimatePresence>
        {showSleepBtn && !phase4 && (
          <motion.button
            key="sleep-btn"
            onClick={clickSleepBtn}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-1/2 -translate-x-1/2 cursor-pointer rounded-full px-6 py-3"
            style={{
              bottom: '5%',
              background: `linear-gradient(135deg, ${SPECIAL_WARM}, ${MOON_GLOW})`,
              border: `1.5px solid ${MOON_CORE}`,
              color: '#3a1e0a',
              fontFamily: '"Dancing Script", cursive',
              fontSize: 'clamp(16px, 2.4vw, 22px)',
              fontWeight: 700,
              boxShadow: `0 8px 24px rgba(0,0,0,0.7), 0 0 24px ${MOON_GLOW}88`,
              zIndex: 30,
              touchAction: 'manipulation',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Đã ngủ chưa? 💤
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Phase 4 final message ── */}
      <AnimatePresence>
        {phase4 && (
          <motion.div
            key="final-msg"
            className="absolute inset-0 flex items-center justify-center pointer-events-none px-8 text-center"
            style={{ zIndex: 60 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.6, delay: 0.5 }}
          >
            <div>
              <div
                style={{
                  fontFamily: '"Dancing Script", cursive',
                  fontStyle: 'italic',
                  fontSize: 'clamp(20px, 3.5vw, 34px)',
                  color: '#fff',
                  lineHeight: 1.5,
                  textShadow: `0 2px 14px rgba(0,0,0,0.8), 0 0 22px ${MOON_CORE}55`,
                  maxWidth: '90vw',
                }}
              >
                Cảm ơn {displayName} đã dỗ thành phố ngủ.<br/>
                <span style={{ color: MOON_CORE }}>{displayName} cũng ngủ đi nhé.</span><br/>
                <span style={{ color: ACCENT_HOT, fontSize: '0.85em' }}>
                  Ngày mai mình sẽ đánh thức {displayName} dậy 💛
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DailyGoodnight2Reveal;

export const DailyGoodnight2Config: TemplateConfig = {
  id: 'daily-goodnight-2',
  name: 'Good Night · Thành Phố Ngủ',
  occasionIds: ['daily'],
  emoji: '🏙️',
  description: 'Nhìn thành phố từ trên cao rực rỡ đèn — chạm từng tòa nhà để dỗ họ ngủ. Khi tất cả đã im tiếng, một ngôi nhà nhỏ ấm áp còn sáng để chờ bạn.',
  thumbnailBg: 'linear-gradient(135deg, #0b0a1e, #f59e0b, #fef08a)',
  Component: DailyGoodnight2Reveal,
};
