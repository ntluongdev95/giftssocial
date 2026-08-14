'use client';

// HackerCountdown — LOVE-palette digital rain of digits + a big glitchy
// 3-2-1 countdown. Used as the "arrive" step in KissReplayOverlay: the
// map flight hands off to this, then this hands off to the template.
//
// Palette: pinks + reds + magenta (love/passion) instead of the classic
// green Matrix look. Rain columns are individually tinted so the wall
// reads as warm rather than uniform.
//
// Timing (~9s total — countdown numbers hold longer so they feel like
// a savored anticipation moment before the reveal):
//   0.0s  matrix rain starts (fast cascade)
//   2.0s  "3" displayed for 2s
//   4.0s  "2" displayed for 2s
//   6.0s  "1" displayed for 2s
//   8.0s  bright white flash
//   9.0s  fire onComplete()

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  /** Fired once the countdown finishes so parent can advance. */
  onComplete?: () => void;
  /** Optional accent color for the countdown numbers + flash. */
  accent?: string;
}

// Character pool — digits + katakana keep the "digital rain" texture
// but sprinkled with romantic glyphs (♥ ♡ ✧ ✦ +) so the wall reads as
// love-coded rather than pure cyber.
const GLYPHS = [
  '0','1','2','3','4','5','6','7','8','9',
  'ｱ','ｲ','ｳ','ｴ','ｵ','ｶ','ｷ','ｸ','ｹ','ｺ',
  'ﾜ','ﾞ','ﾎ','ﾟ','ﾆ','ｻ','ﾂ','ﾃ','ﾈ','ｷ',
  '♥','♡','♥','✧','✦','+','×','∞','∴','☾',
];

// Love-palette column tints — each column picks one at spawn so the
// wall reads as a warm gradient of pinks/reds/magentas rather than a
// single flat color.
const LOVE_COLORS = [
  '#ec4899',   // hot pink
  '#f472b6',   // soft pink
  '#db2777',   // deep magenta
  '#ef4444',   // red
  '#f43f5e',   // rose
  '#e11d48',   // deep rose
  '#c026d3',   // fuchsia
];

// Rain — each column is an independent falling stream, tinted with a
// love color picked at spawn so the whole wall reads warm.
interface Column {
  x: number;         // px from left
  speed: number;     // px per frame
  chars: string[];   // characters in this column
  y: number;         // current head position
  length: number;    // trail length
  charSize: number;
  color: string;     // love-palette tint
}

export default function HackerCountdown({ onComplete, accent = '#ec4899' }: Props) {
  const [count, setCount] = useState<3 | 2 | 1 | null>(null);
  const [flash, setFlash] = useState(false);
  // Tap ripples — visual feedback so users know their tap registered.
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);

  // Build columns once viewport is known (client-only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const charSize = w < 640 ? 16 : 18;
    const colCount = Math.ceil(w / charSize);
    const cols: Column[] = [];
    for (let i = 0; i < colCount; i++) {
      const length = 8 + Math.floor(Math.random() * 22);
      const chars = Array.from({ length }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);
      cols.push({
        x: i * charSize,
        speed: 8 + Math.random() * 14,     // faster rain — 8-22 px/frame
        chars,
        y: -Math.random() * h,
        length,
        charSize,
        color: LOVE_COLORS[Math.floor(Math.random() * LOVE_COLORS.length)],
      });
    }
    setColumns(cols);
  }, []);

  // Animate the rain via requestAnimationFrame. Each tick advances each
  // column by its speed + occasionally shuffles a character to keep the
  // rain feeling alive rather than a fixed pattern.
  useEffect(() => {
    if (columns.length === 0) return;
    if (typeof window === 'undefined') return;
    const h = window.innerHeight;
    let rafId = 0;
    const tick = () => {
      setColumns(prev => prev.map(c => {
        let y = c.y + c.speed;
        if (y > h + c.length * c.charSize) {
          // Reset to top with fresh glyphs
          y = -c.length * c.charSize;
          for (let i = 0; i < c.chars.length; i++) {
            if (Math.random() < 0.6) c.chars[i] = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          }
        } else if (Math.random() < 0.02) {
          // Randomly shuffle 1 char per tick — subtle glitch
          const idx = Math.floor(Math.random() * c.chars.length);
          c.chars[idx] = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
        return { ...c, y };
      }));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [columns.length]);

  // Countdown schedule — numbers linger 2s each so they read as a
  // deliberate anticipation moment (savored), while the rain behind
  // still races fast for energy. Auto-runs; taps can also accelerate.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setCount(c => c ?? 3), 2000));
    timers.push(setTimeout(() => setCount(c => (c === 3 ? 2 : c)), 4000));
    timers.push(setTimeout(() => setCount(c => (c === 2 ? 1 : c)), 6000));
    timers.push(setTimeout(() => setCount(c => (c === 1 ? null : c)), 8000));
    timers.push(setTimeout(() => setFlash(f => f || true), 8000));
    timers.push(setTimeout(() => onComplete?.(), 9000));
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  // Tap-to-accelerate — each tap advances the countdown state to the
  // next stage. On the last stage a tap triggers the flash + finishes.
  const onTap = (e: React.MouseEvent<HTMLDivElement>) => {
    // Spawn ripple at tap coordinates
    const rect = e.currentTarget.getBoundingClientRect();
    setRipples(prev => [
      ...prev,
      { id: Date.now() + Math.random(), x: e.clientX - rect.left, y: e.clientY - rect.top },
    ]);

    // Advance countdown by one beat
    if (count === null && !flash) setCount(3);
    else if (count === 3)         setCount(2);
    else if (count === 2)         setCount(1);
    else if (count === 1)         { setCount(null); setFlash(true); setTimeout(() => onComplete?.(), 800); }
    else if (flash)               onComplete?.();
  };

  return (
    <div
      className="fixed inset-0 z-40 overflow-hidden cursor-pointer"
      style={{ background: '#000' }}
      onClick={onTap}
    >
      {/* Love-rain — one absolutely-positioned column per screen slot,
          each column carrying its own love-palette tint. */}
      <div className="absolute inset-0" style={{ fontFamily: 'ui-monospace, "SF Mono", "Menlo", monospace' }}>
        {columns.map((c, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: c.x,
              top: c.y,
              fontSize: c.charSize,
              lineHeight: `${c.charSize}px`,
              width: c.charSize,
            }}
          >
            {c.chars.map((ch, j) => {
              // Head of trail is bright white with the column's tint
              // as glow; tail fades from the tint into transparent.
              const isHead = j === c.chars.length - 1;
              const opacity = isHead ? 1 : 0.15 + (j / c.chars.length) * 0.85;
              return (
                <div
                  key={j}
                  style={{
                    opacity,
                    color: isHead ? '#fff' : c.color,
                    textShadow: isHead
                      ? `0 0 8px #fff, 0 0 18px ${c.color}, 0 0 32px ${c.color}88`
                      : `0 0 4px ${c.color}66`,
                  }}
                >
                  {ch}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Scanline overlay — classic CRT hacker vibe */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(0,0,0,0.2) 3px, rgba(0,0,0,0.2) 4px)`,
          mixBlendMode: 'multiply',
        }}
      />

      {/* Dark vignette + faint green haze so countdown pops in center */}
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.75) 90%)`,
      }} />

      {/* Countdown numbers */}
      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {count !== null && (
            <motion.div
              key={count}
              initial={{ scale: 0.4, opacity: 0, filter: 'blur(20px)' }}
              animate={{ scale: [0.4, 1.35, 1.15], opacity: 1, filter: 'blur(0px)' }}
              exit={{ scale: 1.6, opacity: 0, filter: 'blur(12px)' }}
              transition={{ duration: 0.6, times: [0, 0.55, 1], ease: [0.16, 1, 0.3, 1] }}
              className="font-black tabular-nums"
              style={{
                fontSize: 'clamp(200px, 40vw, 480px)',
                lineHeight: 1,
                color: '#fff',
                fontFamily: 'ui-monospace, "SF Mono", monospace',
                textShadow: `
                  0 0 20px ${accent},
                  0 0 40px ${accent},
                  0 0 80px ${accent},
                  4px 0 0 #ef4444,
                  -4px 0 0 #38bdf8
                `,
              }}
            >
              {count}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Final white flash — signals reveal transition */}
      <AnimatePresence>
        {flash && (
          <motion.div
            className="absolute inset-0"
            style={{ background: '#fff' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.9, 0] }}
            transition={{ duration: 1.2, times: [0, 0.15, 0.4, 1], ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>

      {/* Top-left status text — love-terminal vibe */}
      <div
        className="absolute top-4 left-4 font-mono text-[11px] opacity-80 pointer-events-none"
        style={{ color: accent, textShadow: `0 0 6px ${accent}` }}
      >
        <div>{'> '}decrypting a heart…</div>
        <div>{'> '}love channel secured ♥</div>
        <div>{'> '}payload authenticated ✓</div>
      </div>

      {/* Bottom-center hint — tells user they can tap to speed things up */}
      <motion.div
        className="absolute inset-x-0 bottom-8 flex justify-center pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0.5, 0.7] }}
        transition={{ duration: 3, delay: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div
          className="font-mono text-[10px] uppercase tracking-[0.35em]"
          style={{ color: accent, textShadow: `0 0 8px ${accent}` }}
        >
          ♥ tap to accelerate ♥
        </div>
      </motion.div>

      {/* Tap ripples — expanding rings from each click */}
      {ripples.map(r => (
        <motion.div
          key={r.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: r.x - 4,
            top: r.y - 4,
            width: 8,
            height: 8,
            border: `2px solid ${accent}`,
            boxShadow: `0 0 20px ${accent}`,
          }}
          initial={{ opacity: 1, scale: 0.3 }}
          animate={{ opacity: 0, scale: 16 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          onAnimationComplete={() => setRipples(prev => prev.filter(x => x.id !== r.id))}
        />
      ))}
    </div>
  );
}
