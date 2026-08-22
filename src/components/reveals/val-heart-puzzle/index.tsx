'use client';

// Heart Puzzle — a starry-sky intro line fades in, then a heart-shaped
// jigsaw puzzle appears, pieced together from the sender's photo. Once
// the receiver drags every piece home, the picture completes inside a
// glowing heart and the sender's message follows.

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playMessageChime, playCelebration } from '@/lib/kiss-audio';
import { getKissString, parseKissData } from '../_shared/useTemplateData';
import type { TemplateProps, TemplateConfig } from '../_types';

const SKY_DEEP  = '#0b0620';
const SKY_MID   = '#1b1040';
const HEART     = '#F43F5E';
const HEART_HOT = '#FDA4AF';
const GOLD      = '#F6C46A';

const FONT_HERO    = "'Playfair Display', 'Cormorant Garamond', Georgia, serif";
const FONT_WHISPER = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const FONT_BODY    = "'Inter', system-ui, sans-serif";

const COLS = 3;
const ROWS = 4;
const COUNT = COLS * ROWS;
const INTRO_MS = 3200;

type Piece = { id: number; x: number; y: number; placed: boolean };

// ─────────────────────────────────────────────────────────────────────
// HeartPuzzle — the drag-and-drop jigsaw. Pieces scatter across the
// wrapper, get dragged toward their slot, and snap home once close
// enough to the heart-clipped target.
// ─────────────────────────────────────────────────────────────────────
function HeartPuzzle({ photoUrl, onSolved }: { photoUrl: string; onSolved: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState(240);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [drag, setDrag] = useState<{ id: number; dx: number; dy: number } | null>(null);

  const cw = board / COLS;
  const ch = board / ROWS;

  useEffect(() => {
    const fit = () => {
      const w = wrapRef.current?.clientWidth ?? 320;
      setBoard(Math.max(170, Math.min(300, w * 0.42)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const w = wrapRef.current?.clientWidth ?? 320;
    const h = wrapRef.current?.clientHeight ?? 320;
    setPieces(
      Array.from({ length: COUNT }, (_, id) => ({
        id,
        x: 8 + Math.random() * Math.max(20, w - cw - 16),
        y: 8 + Math.random() * Math.max(20, h - ch - 16),
        placed: false,
      })),
    );
  }, [cw, ch]);

  const slotPos = useCallback(
    (id: number) => {
      const w = wrapRef.current?.clientWidth ?? 320;
      const h = wrapRef.current?.clientHeight ?? 320;
      const ox = (w - board) / 2;
      const oy = (h - board) / 2;
      return { x: ox + (id % COLS) * cw, y: oy + Math.floor(id / COLS) * ch };
    },
    [board, cw, ch],
  );

  const onPointerDown = (e: React.PointerEvent, p: Piece) => {
    if (p.placed) return;
    const rect = wrapRef.current!.getBoundingClientRect();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: p.id, dx: e.clientX - rect.left - p.x, dy: e.clientY - rect.top - p.y });
    setPieces((prev) => [...prev.filter((q) => q.id !== p.id), p]);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const rect = wrapRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left - drag.dx;
    const y = e.clientY - rect.top - drag.dy;
    setPieces((prev) => prev.map((p) => (p.id === drag.id ? { ...p, x, y } : p)));
  };

  const onPointerUp = () => {
    if (!drag) return;
    const target = slotPos(drag.id);
    setPieces((prev) =>
      prev.map((p) => {
        if (p.id !== drag.id) return p;
        const near = Math.hypot(p.x - target.x, p.y - target.y) < Math.min(cw, ch) * 0.7;
        if (near) playMessageChime();
        return near ? { ...p, x: target.x, y: target.y, placed: true } : p;
      }),
    );
    setDrag(null);
  };

  const solved = pieces.length === COUNT && pieces.every((p) => p.placed);
  useEffect(() => {
    if (solved) onSolved();
  }, [solved, onSolved]);

  const heartPath = (b: number) =>
    `path('M${b / 2} ${b * 0.92} C ${b * 0.08} ${b * 0.62}, 0 ${b * 0.33}, ${b * 0.19} ${b * 0.17} C ${b * 0.35} ${b * 0.03}, ${b * 0.49} ${b * 0.12}, ${b / 2} ${b * 0.26} C ${b * 0.51} ${b * 0.12}, ${b * 0.65} ${b * 0.03}, ${b * 0.81} ${b * 0.17} C ${b} ${b * 0.33}, ${b * 0.92} ${b * 0.62}, ${b / 2} ${b * 0.92} Z')`;

  return (
    <div
      ref={wrapRef}
      className="relative size-full touch-none select-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* heart outline guide */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: `calc(50% - ${board / 2}px)`,
          top: `calc(50% - ${board / 2}px)`,
          width: board,
          height: board,
          clipPath: heartPath(board),
          background: 'oklch(0.95 0.06 95 / 0.08)',
        }}
      />

      {/* pieces, clipped to heart when in place */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: `calc(50% - ${board / 2}px)`,
          top: `calc(50% - ${board / 2}px)`,
          width: board,
          height: board,
          clipPath: heartPath(board),
        }}
      >
        {pieces
          .filter((p) => p.placed)
          .map((p) => (
            <div
              key={p.id}
              className="animate-rise absolute"
              style={{
                left: (p.id % COLS) * cw,
                top: Math.floor(p.id / COLS) * ch,
                width: cw,
                height: ch,
                backgroundImage: `url(${photoUrl})`,
                backgroundSize: `${board}px ${board}px`,
                backgroundPosition: `-${(p.id % COLS) * cw}px -${Math.floor(p.id / COLS) * ch}px`,
              }}
            />
          ))}
      </div>

      {/* draggable loose pieces */}
      {pieces
        .filter((p) => !p.placed)
        .map((p) => (
          <div
            key={p.id}
            onPointerDown={(e) => onPointerDown(e, p)}
            className="absolute cursor-grab rounded-[3px] border border-primary/40 shadow-[0_0_18px_oklch(0.95_0.06_95/0.25)] active:cursor-grabbing"
            style={{
              left: p.x,
              top: p.y,
              width: cw,
              height: ch,
              backgroundImage: `url(${photoUrl})`,
              backgroundSize: `${board}px ${board}px`,
              backgroundPosition: `-${(p.id % COLS) * cw}px -${Math.floor(p.id / COLS) * ch}px`,
            }}
          />
        ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main reveal — intro whisper on a starry sky, then the puzzle, then
// the finale message.
// ─────────────────────────────────────────────────────────────────────
function ValHeartPuzzleReveal({ kiss, onClose }: TemplateProps) {
  const rawName = (getKissString(kiss, 'name') || kiss.receiver_name || 'em').trim();
  const displayName = rawName || 'em';

  const photoUrl = (() => {
    const raw = parseKissData(kiss).photos;
    if (Array.isArray(raw)) {
      const first = raw.find((u): u is string => typeof u === 'string' && !!u);
      if (first) return first;
    }
    return getKissString(kiss, 'photo') || kiss.sender_avatar || '';
  })();

  const [phase, setPhase] = useState<'intro' | 'puzzle' | 'solved'>('intro');

  useEffect(() => {
    const t = setTimeout(() => setPhase('puzzle'), INTRO_MS);
    return () => clearTimeout(t);
  }, []);

  const handleSolved = useCallback(() => {
    setPhase((p) => (p === 'solved' ? p : 'solved'));
    playCelebration();
    const t = setTimeout(() => onClose(), 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  const stars = useRef(
    Array.from({ length: 90 }).map((_, i) => {
      const s = (i * 2654435761) >>> 0;
      const r = (n: number) => (((s ^ (n * 0x9e3779b1)) >>> 0) % 10000) / 10000;
      return {
        left: r(1) * 100,
        top: r(2) * 100,
        size: 0.6 + r(3) * 1.6,
        delay: r(4) * 6,
        dur: 3 + r(5) * 4,
      };
    }),
  ).current;

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden select-none"
      style={{
        background: `radial-gradient(ellipse at 50% 20%, ${SKY_MID}, ${SKY_DEEP} 70%)`,
        fontFamily: FONT_BODY,
      }}
    >
      {stars.map((st, i) => (
        <motion.div
          key={`star-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${st.left}%`,
            top: `${st.top}%`,
            width: st.size,
            height: st.size,
            background: '#fff',
            boxShadow: `0 0 ${st.size * 2}px rgba(255,255,255,0.6)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.2, 0.9, 0.2] }}
          transition={{ duration: st.dur, delay: st.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* ── Intro line on the sky ── */}
      <AnimatePresence>
        {phase === 'intro' && (
          <motion.div
            key="intro"
            className="absolute inset-0 flex items-center justify-center px-8 text-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 1 }}
          >
            <div>
              <div
                style={{
                  fontFamily: FONT_WHISPER,
                  fontStyle: 'italic',
                  fontWeight: 500,
                  fontSize: 'clamp(16px, 2.8vw, 26px)',
                  color: 'rgba(255,255,255,0.9)',
                  textShadow: '0 2px 12px rgba(0,0,0,0.7)',
                }}
              >
                Bầu trời đêm nay giữ một mảnh ghép trái tim…
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontFamily: FONT_HERO,
                  fontWeight: 700,
                  fontSize: 'clamp(22px, 4.5vw, 40px)',
                  color: GOLD,
                  textShadow: `0 2px 16px rgba(0,0,0,0.7), 0 0 24px ${GOLD}55`,
                }}
              >
                Ghép lại nó cho {displayName} nhé
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Puzzle ── */}
      <AnimatePresence>
        {phase !== 'intro' && (
          <motion.div
            key="puzzle"
            className="absolute inset-0 flex items-center justify-center px-6"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="relative w-full max-w-sm" style={{ height: '60vh' }}>
              {photoUrl && <HeartPuzzle photoUrl={photoUrl} onSolved={handleSolved} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Finale message ── */}
      <AnimatePresence>
        {phase === 'solved' && (
          <motion.div
            key="final"
            className="absolute inset-x-0 pointer-events-none text-center px-8"
            style={{ bottom: '8%', zIndex: 10 }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
          >
            <div
              style={{
                fontFamily: FONT_HERO,
                fontWeight: 700,
                fontSize: 'clamp(24px, 5vw, 44px)',
                color: '#fff',
                textShadow: `0 4px 18px rgba(0,0,0,0.75), 0 0 24px ${HEART}66`,
              }}
            >
              Trái tim đã trọn vẹn, {displayName} ạ
            </div>
            {kiss.message && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9 }}
                transition={{ duration: 1, delay: 1 }}
                className="mx-auto max-w-md"
                style={{
                  marginTop: 14,
                  fontFamily: FONT_WHISPER,
                  fontStyle: 'italic',
                  fontSize: 'clamp(15px, 2.2vw, 20px)',
                  color: 'rgba(255,240,240,0.95)',
                  textShadow: '0 2px 10px rgba(0,0,0,0.7)',
                }}
              >
                &ldquo;{kiss.message}&rdquo;
              </motion.div>
            )}
            {kiss.sender_name && (
              <div
                style={{
                  marginTop: 10,
                  fontFamily: FONT_BODY,
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: HEART_HOT,
                }}
              >
                — {kiss.sender_name}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ValHeartPuzzleReveal;

export const ValHeartPuzzleConfig: TemplateConfig = {
  id: 'val-heart-puzzle',
  name: 'Ghép Hình Trái Tim',
  occasionIds: ['valentine', 'daily'],
  emoji: '🧩',
  description: 'Một dòng chữ thì thầm hiện lên giữa bầu trời sao, rồi trò chơi xếp hình trái tim xuất hiện — ghép từ chính ảnh của hai người.',
  thumbnailBg: 'linear-gradient(135deg, #0b0620, #F43F5E, #F6C46A)',
  Component: ValHeartPuzzleReveal,
};
