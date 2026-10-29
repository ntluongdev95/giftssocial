'use client';

// Lovi — the LoveGift mascot. Renders a real illustrated pose image
// when one exists at /public/images/lovi/{pose}.png, and falls back to
// a simple geometric blob built entirely in code when it doesn't (so
// nothing breaks while pose art is still being produced). Drop a PNG
// named after a pose into public/images/lovi/ and it activates
// automatically — no code change needed.
//
// Known poses so far: "idle" (the default, used in the Hero).
// Add more as they're generated (e.g. "sleep", "wave", "happy", "sad")
// and pass them via the `pose` prop from wherever Lovi appears.
//
// The interaction engine (cursor-follow eyes, idle blink, heart
// drift-by, click → jump + emotion burst) is shared by both the image
// and the blob fallback — only the body's visual layer differs.

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const REACT_EMOJI = ['❤️', '🥺', '😂', '😤', '🌙', '🎉'];

export default function LoviCharacter({ pose = 'idle' }: { pose?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pupil, setPupil] = useState({ x: 0, y: 0 });
  const [blinking, setBlinking] = useState(false);
  const [heartVisible, setHeartVisible] = useState(false);
  const [chasing, setChasing] = useState(false);
  const [burst, setBurst] = useState<{ id: number; emoji: string; angle: number }[] | null>(null);
  const [jumping, setJumping] = useState(false);
  // Tracks which pose (if any) failed to load — comparing against the
  // current `pose` (rather than resetting via an effect) means a later
  // pose automatically gets a fresh chance even if an earlier one 404'd.
  const [failedPose, setFailedPose] = useState<string | null>(null);
  const imgFailed = failedPose === pose;

  // Eyes track the pointer, clamped to a small radius so they don't pop
  // out of their sockets.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.42;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const maxOffset = 3.2;
      const scale = Math.min(1, maxOffset / dist) * Math.min(1, dist / 40);
      setPupil({ x: dx * scale * 0.12, y: dy * scale * 0.12 });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Idle blink, on its own random cadence.
  useEffect(() => {
    let t: number;
    const scheduleBlink = () => {
      t = window.setTimeout(() => {
        setBlinking(true);
        window.setTimeout(() => setBlinking(false), 140);
        scheduleBlink();
      }, 2600 + Math.random() * 2800);
    };
    scheduleBlink();
    return () => window.clearTimeout(t);
  }, []);

  // A heart drifts by every so often — Lovi notices it (looks curious,
  // hops a little toward it), then it floats off.
  useEffect(() => {
    let t: number;
    const scheduleHeart = () => {
      t = window.setTimeout(() => {
        setHeartVisible(true);
        window.setTimeout(() => setChasing(true), 700);
        window.setTimeout(() => setChasing(false), 1600);
        window.setTimeout(() => setHeartVisible(false), 2400);
        scheduleHeart();
      }, 5000 + Math.random() * 4000);
    };
    scheduleHeart();
    return () => window.clearTimeout(t);
  }, []);

  const onLoviClick = () => {
    if (jumping) return;
    setJumping(true);
    const seed = Date.now();
    const r = (n: number) => (((seed ^ (n * 0x9e3779b1)) >>> 0) % 10000) / 10000;
    const particles = REACT_EMOJI.map((emoji, i) => ({
      id: seed + i,
      emoji,
      angle: (i / REACT_EMOJI.length) * Math.PI * 2 + r(i) * 0.6,
    }));
    setBurst(particles);
    window.setTimeout(() => setJumping(false), 500);
    window.setTimeout(() => setBurst(null), 1100);
  };

  return (
    <div ref={containerRef} className="relative select-none" style={{ width: 180, height: 200 }}>
      {/* drifting heart */}
      <AnimatePresence>
        {heartVisible && (
          <motion.div
            className="absolute pointer-events-none"
            style={{ fontSize: 26, top: chasing ? '20%' : '8%' }}
            initial={{ x: -60, opacity: 0 }}
            animate={{ x: chasing ? 70 : 220, opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.4, ease: 'easeInOut' }}
          >
            ❤️
          </motion.div>
        )}
      </AnimatePresence>

      {/* emotion burst on click */}
      <AnimatePresence>
        {burst && (
          <div className="absolute inset-0 pointer-events-none">
            {burst.map((p) => (
              <motion.span
                key={p.id}
                className="absolute"
                style={{ left: '50%', top: '38%', fontSize: 20 }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
                animate={{
                  x: Math.cos(p.angle) * 60,
                  y: Math.sin(p.angle) * 60 - 20,
                  opacity: 0,
                  scale: 1.1,
                }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              >
                {p.emoji}
              </motion.span>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Lovi's body */}
      <motion.button
        type="button"
        onClick={onLoviClick}
        aria-label="Lovi"
        className="absolute inset-x-0 bottom-0 mx-auto cursor-pointer"
        style={{ width: 140, height: 130, background: 'none', border: 'none', padding: 0 }}
        animate={
          jumping
            ? { y: [0, -34, 0], scaleY: [1, 1.08, 1], scaleX: [1, 0.94, 1] }
            : chasing
            ? { x: [0, 26, 0], y: [0, -4, 0] }
            : { y: [0, -5, 0] }
        }
        transition={
          jumping
            ? { duration: 0.5, ease: 'easeOut' }
            : chasing
            ? { duration: 0.9, ease: 'easeInOut' }
            : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        {!imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/images/lovi/${pose}.png`}
            alt="Lovi"
            // Deferred a tick: an <img> 404 can fire onError fast enough
            // to race React's hydration check and trip a mismatch
            // warning if the state flip happens synchronously here.
            onError={() => { window.setTimeout(() => setFailedPose(pose), 0); }}
            className="w-full h-full object-contain"
            draggable={false}
            style={{ filter: 'drop-shadow(0 10px 18px rgba(255,111,156,0.35))' }}
          />
        ) : (
          <svg viewBox="0 0 140 130" width="140" height="130">
            <ellipse cx="70" cy="70" rx="62" ry="56" fill="url(#loviBody)" />
            <defs>
              <radialGradient id="loviBody" cx="35%" cy="30%" r="80%">
                <stop offset="0%" stopColor="#ffb4c6" />
                <stop offset="100%" stopColor="#ff6f9c" />
              </radialGradient>
            </defs>
            {/* ears */}
            <ellipse cx="34" cy="24" rx="14" ry="18" fill="#ff6f9c" />
            <ellipse cx="106" cy="24" rx="14" ry="18" fill="#ff6f9c" />
            {/* eyes */}
            <g>
              <ellipse cx="50" cy="62" rx="13" ry={blinking ? 1.5 : 15} fill="#2a0e18" />
              <ellipse cx="90" cy="62" rx="13" ry={blinking ? 1.5 : 15} fill="#2a0e18" />
              {!blinking && (
                <>
                  <circle cx={50 + pupil.x} cy={62 + pupil.y} r="5" fill="#fff" />
                  <circle cx={90 + pupil.x} cy={62 + pupil.y} r="5" fill="#fff" />
                </>
              )}
            </g>
            {/* blush */}
            <ellipse cx="38" cy="80" rx="8" ry="5" fill="#ff9db8" opacity="0.7" />
            <ellipse cx="102" cy="80" rx="8" ry="5" fill="#ff9db8" opacity="0.7" />
            {/* mouth */}
            <path d="M60,92 Q70,100 80,92" stroke="#2a0e18" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
        )}
      </motion.button>
    </div>
  );
}
