'use client';

// PasswordLock — a heavy ornate door blocks the reveal. The recipient
// enters the sender's passcode on a keypad set into the door; a right
// answer creaks the door open in perspective + floods warm light out,
// then hands off to the next step.
//
// Visual concept:
//   • Deep night courtyard behind the frame
//   • Wooden door with rose-gold trim + heart-shaped lock plate
//   • Numeric keypad set into the door's center panel
//   • Ambient hearts drifting up around the door
//   • On correct: door swings open (rotateY perspective) + warm bloom
//   • On wrong: door shakes + red rim pulse

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Unlock, Delete, Heart } from 'lucide-react';

interface Props {
  correct: string;
  hint?: string;
  onSuccess: () => void;
  senderName?: string;
  accent?: string;
}

const MAX_LEN = 8;
const WOOD_DARK = '#3a1a1a';
const WOOD_LIGHT = '#5e2a1e';
const WOOD_TRIM = '#8b3a2a';
const GOLD = '#d4a574';
const GOLD_BRIGHT = '#fbbf24';

export default function PasswordLock({
  correct, hint, onSuccess, senderName, accent = '#ec4899',
}: Props) {
  const [entered, setEntered] = useState('');
  const [state, setState] = useState<'idle' | 'wrong' | 'correct'>('idle');
  const [attempts, setAttempts] = useState(0);
  const shakeRef = useRef(0);
  const correctDigits = correct.replace(/\D/g, '');

  const check = (val: string) => {
    if (val === correctDigits) {
      setState('correct');
      // Give the door-open animation time to finish before advancing
      setTimeout(() => onSuccess(), 1800);
    } else {
      setState('wrong');
      shakeRef.current += 1;
      setAttempts(a => a + 1);
      setTimeout(() => { setEntered(''); setState('idle'); }, 900);
    }
  };

  const press = (digit: string) => {
    if (state !== 'idle') return;
    setEntered(prev => {
      const next = (prev + digit).slice(0, MAX_LEN);
      if (next.length === correctDigits.length) setTimeout(() => check(next), 200);
      return next;
    });
  };
  const backspace = () => {
    if (state !== 'idle') return;
    setEntered(prev => prev.slice(0, -1));
  };
  const submit = () => {
    if (state !== 'idle' || entered.length === 0) return;
    check(entered);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (state !== 'idle') return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') backspace();
      else if (e.key === 'Enter') submit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, entered]);

  const dotColor = state === 'correct' ? '#22c55e' : state === 'wrong' ? '#f87171' : accent;
  const rimColor = state === 'wrong' ? '#ef4444' : state === 'correct' ? GOLD_BRIGHT : GOLD;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden pointer-events-auto"
      style={{
        // Deep courtyard night — reddish black stone
        background: 'radial-gradient(ellipse at 50% 40%, #1a0a0e 0%, #0a0306 65%, #000 100%)',
        perspective: '1400px',
      }}
    >
      {/* Ambient hearts drifting up around the door */}
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none select-none"
          style={{
            left: `${(i / 14) * 100 + Math.random() * 6}%`,
            bottom: '-5%',
            fontSize: 16 + Math.random() * 10,
            color: accent,
            opacity: 0.4,
          }}
          animate={{ y: '-105vh', opacity: [0, 0.5, 0.5, 0] }}
          transition={{ duration: 12 + Math.random() * 6, delay: i * 0.8, repeat: Infinity, ease: 'linear' }}
        >
          {['♥', '♡', '✧', '❤'][i % 4]}
        </motion.div>
      ))}

      {/* Warm light halo behind the door — pulses stronger on correct */}
      <motion.div
        className="absolute pointer-events-none rounded-full"
        style={{
          width: 600,
          height: 600,
          background: `radial-gradient(circle, ${accent}55 0%, ${accent}22 40%, transparent 70%)`,
          filter: 'blur(30px)',
        }}
        animate={{
          scale: state === 'correct' ? [1, 2.5] : state === 'wrong' ? [1, 1.2, 1] : [1, 1.05, 1],
          opacity: state === 'correct' ? [0.5, 1, 0] : [0.4, 0.55, 0.4],
        }}
        transition={{
          duration: state === 'correct' ? 1.6 : state === 'wrong' ? 0.4 : 4,
          repeat: state === 'idle' ? Infinity : 0,
          ease: 'easeInOut',
        }}
      />

      {/* ─── DOOR FRAME + DOOR ────────────────────────────────── */}
      <motion.div
        key={'door-' + shakeRef.current}
        className="relative"
        style={{ width: 340, maxWidth: '85vw', transformStyle: 'preserve-3d' }}
        animate={state === 'wrong' ? { x: [-10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Sender + hint text — hovers above the door */}
        <div className="absolute -top-20 inset-x-0 text-center px-4 pointer-events-none">
          <div
            className="text-white/90 font-semibold"
            style={{
              fontFamily: '"Dancing Script", cursive',
              fontSize: 22,
              textShadow: `0 2px 12px rgba(0,0,0,0.8), 0 0 20px ${accent}66`,
            }}
          >
            {senderName ? `${senderName} khoá cửa` : 'Cửa đang khoá'}
          </div>
          <div className="text-[11px] text-white/60 mt-1">
            {state === 'wrong'
              ? `Sai rồi — thử lại nhé (${attempts})`
              : state === 'correct'
              ? '🔓 Cửa đang mở…'
              : 'Nhập mã để mở cửa'}
          </div>
          {hint && state === 'idle' && (
            <div className="text-[11px] italic mt-2 max-w-xs mx-auto" style={{ color: accent }}>
              💡 Gợi ý: {hint}
            </div>
          )}
        </div>

        {/* Door — swings open on correct via rotateY */}
        <motion.div
          className="relative rounded-t-2xl"
          style={{
            aspectRatio: '3 / 5',
            background: `linear-gradient(180deg, ${WOOD_LIGHT} 0%, ${WOOD_DARK} 50%, ${WOOD_LIGHT} 100%)`,
            border: `4px solid ${rimColor}`,
            boxShadow: state === 'wrong'
              ? '0 0 40px #ef4444, inset 0 0 30px rgba(0,0,0,0.5)'
              : `0 20px 60px rgba(0,0,0,0.7), 0 0 40px ${accent}33, inset 0 0 30px rgba(0,0,0,0.5)`,
            transformStyle: 'preserve-3d',
            transformOrigin: 'left center',
            transition: 'box-shadow 0.4s, border-color 0.4s',
          }}
          animate={state === 'correct' ? { rotateY: -85 } : { rotateY: 0 }}
          transition={{ duration: 1.5, ease: [0.5, 0.05, 0.3, 1] }}
        >
          {/* Wood grain — vertical planks */}
          <div
            className="absolute inset-0 rounded-t-xl pointer-events-none opacity-30"
            style={{
              background: 'repeating-linear-gradient(90deg, transparent 0, transparent 30px, rgba(0,0,0,0.3) 30px, rgba(0,0,0,0.3) 31px)',
            }}
          />

          {/* Ornate top panel — carved rectangle with heart */}
          <div className="absolute top-4 left-4 right-4 rounded-lg" style={{
            height: '18%',
            background: `linear-gradient(180deg, ${WOOD_DARK}, ${WOOD_TRIM})`,
            border: `2px solid ${rimColor}`,
            boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.5)',
          }}>
            <div className="w-full h-full flex items-center justify-center">
              <motion.div
                animate={{ scale: state === 'idle' ? [1, 1.1, 1] : 1 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  color: rimColor,
                  filter: `drop-shadow(0 0 8px ${rimColor})`,
                }}
              >
                <Heart size={28} fill={rimColor} />
              </motion.div>
            </div>
          </div>

          {/* ── LOCK PANEL · keypad set into the door ── */}
          <div
            className="absolute left-3 right-3 rounded-xl overflow-hidden"
            style={{
              top: '26%',
              bottom: '10%',
              background: `linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.75))`,
              border: `1.5px solid ${rimColor}`,
              boxShadow: `inset 0 0 20px rgba(0,0,0,0.7), 0 0 12px ${rimColor}44`,
              padding: '14px 12px',
            }}
          >
            {/* Lock icon toggle */}
            <div className="flex justify-center mb-2">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{
                  background: state === 'correct' ? '#22c55e22' : `${accent}22`,
                  border: `1px solid ${state === 'correct' ? '#22c55e' : accent}88`,
                  boxShadow: `0 0 16px ${state === 'correct' ? '#22c55e' : accent}66`,
                }}
              >
                <AnimatePresence mode="wait">
                  {state === 'correct'
                    ? <motion.div key="ok" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
                        <Unlock size={16} style={{ color: '#22c55e' }} />
                      </motion.div>
                    : <motion.div key="lock" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <Lock size={16} style={{ color: accent }} />
                      </motion.div>
                  }
                </AnimatePresence>
              </div>
            </div>

            {/* Passcode dots */}
            <motion.div
              key={'dots-' + shakeRef.current}
              animate={state === 'wrong' ? { x: [-8, 8, -6, 6, 0] } : { x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex justify-center gap-2 mb-3"
            >
              {Array.from({ length: Math.max(correctDigits.length, 4) }).map((_, i) => {
                const filled = i < entered.length;
                return (
                  <div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full transition-all"
                    style={{
                      background: filled ? dotColor : 'transparent',
                      border: `1.5px solid ${filled ? dotColor : 'rgba(255,255,255,0.25)'}`,
                      boxShadow: filled ? `0 0 8px ${dotColor}` : undefined,
                    }}
                  />
                );
              })}
            </motion.div>

            {/* Numeric keypad — 3×4 grid */}
            <div className="grid grid-cols-3 gap-1.5">
              {['1','2','3','4','5','6','7','8','9'].map(d => (
                <button
                  key={d}
                  onClick={(e) => { e.stopPropagation(); press(d); }}
                  disabled={state !== 'idle'}
                  className="h-9 rounded-md text-base font-semibold text-white cursor-pointer transition-all active:scale-95 disabled:opacity-40"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  {d}
                </button>
              ))}
              <button
                onClick={(e) => { e.stopPropagation(); backspace(); }}
                disabled={state !== 'idle' || entered.length === 0}
                className="h-9 rounded-md flex items-center justify-center cursor-pointer transition-all active:scale-95 disabled:opacity-40"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#a3adc3',
                }}
              >
                <Delete size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); press('0'); }}
                disabled={state !== 'idle'}
                className="h-9 rounded-md text-base font-semibold text-white cursor-pointer transition-all active:scale-95 disabled:opacity-40"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                0
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); submit(); }}
                disabled={state !== 'idle' || entered.length === 0}
                className="h-9 rounded-md flex items-center justify-center cursor-pointer transition-all active:scale-95 disabled:opacity-40"
                style={{
                  background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                  color: '#fff',
                  boxShadow: `0 2px 12px ${accent}55`,
                }}
              >
                <Unlock size={14} />
              </button>
            </div>
          </div>

          {/* Door handle — right side, halfway down */}
          <div
            className="absolute rounded-full"
            style={{
              right: 10,
              top: '55%',
              width: 8,
              height: 8,
              background: `radial-gradient(circle at 30% 30%, ${GOLD_BRIGHT}, ${GOLD}, ${WOOD_DARK})`,
              boxShadow: `0 0 10px ${GOLD}88`,
            }}
          />
        </motion.div>

        {/* Warm interior light burst when door opens — flood outward */}
        <AnimatePresence>
          {state === 'correct' && (
            <motion.div
              className="absolute inset-0 rounded-t-2xl pointer-events-none"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${GOLD_BRIGHT} 0%, ${accent} 40%, transparent 70%)`,
                filter: 'blur(20px)',
                transformOrigin: 'left center',
              }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.5, 2.2, 3] }}
              transition={{ duration: 1.8, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
