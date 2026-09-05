'use client';

// Ring Reveal — a couple sits together under a twinkling night sky,
// looking up; tapping the sky opens a ring box in a burst of sparkles,
// then the proposal question appears with a classic dodging "No" button.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { playProposalSound, playYesSound, playHeartbeat } from '@/lib/kiss-audio';
import { getKissString, parseKissData } from '../_shared/useTemplateData';
import type { TemplateProps, TemplateConfig } from '../_types';

// Three.js is heavy — code-split it out of the main bundle, same
// pattern used by BirthdayJourneyFlow. This is the real drone-show
// engine (proven scenes, particle system) instead of a hand-rolled 2D
// canvas approximation.
const JourneyDroneShow = dynamic(
  () => import('../../capsules/journey/JourneyDroneShow').then((m) => m.JourneyDroneShow),
  { ssr: false },
);

const SKY_BLACK   = '#000000';
const SKY_DEEP    = '#050508';
const SKY_MID     = '#0d0d16';
const MOON_CORE   = '#FFF8E1';
const MOON_MID    = '#F6C46A';
const MOON_DEEP   = '#B4761D';
const GOLD        = '#F6C46A';
const HEART       = '#F43F5E';
const HEART_HOT   = '#FDA4AF';

const FONT_HERO    = "'Playfair Display', 'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const FONT_WHISPER = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const FONT_BODY    = "'Inter', system-ui, -apple-system, sans-serif";

// This one template covers more than a marriage proposal — the sender
// picks which final question actually shows via the "question" field.
const QUESTION_TEXT: Record<string, string> = {
  marry: 'Will you marry me? 💍',
  girlfriend: 'em làm bạn gái anh nhé? 💕',
  boyfriend: 'anh làm bạn trai em nhé? 💕',
};

// ─────────────────────────────────────────────────────────────────────
// Ambient night sky — twinkling stars, a soft moon, the occasional
// shooting star. Same "occasional twinkle" language used elsewhere in
// the app's reveals, tuned for this scene.
// ─────────────────────────────────────────────────────────────────────
function useStars(count: number) {
  return useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => {
        const s = (i * 2654435761) >>> 0;
        const r = (n: number) => (((s ^ (n * 0x9e3779b1)) >>> 0) % 10000) / 10000;
        const isBright = r(6) > 0.7;
        return {
          left: r(1) * 100,
          top: r(2) * 62,
          size: isBright ? 1.6 + r(3) * 1.6 : 0.5 + r(3) * 1.2,
          delay: r(4) * 8,
          dur: isBright ? 2 + r(5) * 3 : 3 + r(5) * 4,
          isBright,
        };
      }),
    [count],
  );
}

const SHOOTING_STARS = Array.from({ length: 3 }, (_, i) => {
  const s = (i * 2654435761) >>> 0;
  const r = (n: number) => (((s ^ (n * 0x9e3779b1)) >>> 0) % 10000) / 10000;
  return {
    fromXPct: 15 + r(1) * 55,
    fromYPct: r(2) * 6,
    angleDeg: 74 + r(3) * 12,
    lengthVmin: 10 + r(4) * 5,
    distVmin: 40 + r(5) * 20,
    delay: 1 + r(6) * 6,
    duration: 1.1 + r(7) * 0.4,
    repeatDelay: 5 + r(8) * 7,
  };
});

function NightSky() {
  const stars = useStars(220);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((st, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${st.left}%`,
            top: `${st.top}%`,
            width: st.size,
            height: st.size,
            background: '#fff',
            boxShadow: `0 0 ${st.size * (st.isBright ? 4 : 2)}px rgba(255,255,255,${st.isBright ? 0.9 : 0.6})`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: st.isBright ? [0.15, 1, 0.15] : [0.2, 0.75, 0.2] }}
          transition={{ duration: st.dur, delay: st.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {SHOOTING_STARS.map((sh, i) => {
        const rad = (sh.angleDeg * Math.PI) / 180;
        const dx = `${Math.cos(rad) * sh.distVmin}vmin`;
        const dy = `${Math.sin(rad) * sh.distVmin}vmin`;
        return (
          <motion.div
            key={`sh-${i}`}
            className="absolute"
            style={{ left: `${sh.fromXPct}%`, top: `${sh.fromYPct}%`, width: 0, height: 0 }}
            initial={{ opacity: 0, x: 0, y: 0 }}
            animate={{ opacity: [0, 1, 1, 0], x: dx, y: dy }}
            transition={{ duration: sh.duration, delay: sh.delay, repeat: Infinity, repeatDelay: sh.repeatDelay, ease: 'easeIn' }}
          >
            <div
              className="absolute rounded-full"
              style={{
                width: `${sh.lengthVmin}vmin`, height: 2,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.95))',
                transform: `rotate(${sh.angleDeg}deg)`, transformOrigin: 'left center', filter: 'blur(0.5px)',
              }}
            />
          </motion.div>
        );
      })}
      <div
        className="absolute right-[12%] top-[8%] rounded-full"
        style={{
          width: 90, height: 90,
          background: `radial-gradient(circle at 35% 30%, ${MOON_CORE}, ${MOON_MID} 55%, ${MOON_DEEP} 100%)`,
          boxShadow: `0 0 40px ${MOON_MID}88, 0 0 120px ${MOON_MID}44`,
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PhotoGlobe — the couple's own uploaded photos arranged on a sphere
// (classic CSS 3D "tag cloud" technique: rotateY(long) rotateX(-lat)
// translateZ(R) orients each tile to face outward from the sphere
// surface) and spun continuously — a grand, photo-covered globe
// instead of a plain silhouette.
// ─────────────────────────────────────────────────────────────────────
const SILH = '#04060d';

/** Two people standing hand in hand, silhouetted — modeled on the
 * reference photo (broad-shouldered figure on the left, flowing-dress
 * figure on the right, arms reaching down to join hands between
 * them), gazing up at the photo globe hovering above them. */
// A low, distant city skyline — silhouetted buildings with a scatter
// of tiny window lights, like the rooftop-shot drone-show reference
// photos. Grounds the scene instead of leaving the drone art floating
// in an empty void.
const SKYLINE_BUILDINGS = [
  { x: 0, w: 34, h: 38 }, { x: 30, w: 22, h: 58 }, { x: 50, w: 28, h: 30 },
  { x: 76, w: 18, h: 70 }, { x: 92, w: 30, h: 44 }, { x: 120, w: 24, h: 60 },
  { x: 142, w: 20, h: 34 }, { x: 160, w: 32, h: 52 }, { x: 190, w: 22, h: 66 },
  { x: 210, w: 26, h: 40 }, { x: 234, w: 18, h: 56 }, { x: 250, w: 30, h: 36 },
];
const SKYLINE_LIGHTS = Array.from({ length: 26 }, (_, i) => {
  const s = (i * 2654435761) >>> 0;
  const r = (n: number) => (((s ^ (n * 0x9e3779b1)) >>> 0) % 10000) / 10000;
  return { left: r(1) * 100, bottom: 2 + r(2) * 16, delay: r(3) * 3, dur: 1.5 + r(4) * 2 };
});

function CitySkyline() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[16%] overflow-hidden">
      <svg viewBox="0 0 280 70" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        <g fill="#0a0a12">
          {SKYLINE_BUILDINGS.map((b, i) => (
            <rect key={i} x={b.x} y={70 - b.h} width={b.w} height={b.h} />
          ))}
        </g>
      </svg>
      {SKYLINE_LIGHTS.map((l, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{ left: `${l.left}%`, bottom: `${l.bottom}%`, width: 2, height: 2, background: MOON_MID }}
          animate={{ opacity: [0.2, 0.85, 0.2] }}
          transition={{ duration: l.dur, delay: l.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

function LookingUpCouple() {
  return (
    <div className="absolute bottom-0 left-1/2 h-[24%] w-auto -translate-x-1/2">
      {/* warm backlight glow — without this, the near-black silhouette
          is invisible against the now-pure-black sky background */}
      <div
        className="pointer-events-none absolute inset-x-[-20%] bottom-0 h-full"
        style={{ background: `radial-gradient(60% 90% at 50% 100%, ${HEART_HOT}33, transparent 70%)` }}
      />
      <svg viewBox="0 0 320 300" className="relative h-full w-auto" aria-hidden>
        <ellipse cx="160" cy="294" rx="110" ry="7" fill={SILH} opacity="0.35" />
        <g fill={SILH} stroke={HEART_HOT} strokeOpacity="0.55" strokeWidth="1.4">
          {/* man — short flat hair, straight-shouldered build, legs
              spaced apart at a natural standing width */}
          <ellipse cx="95" cy="30" rx="16" ry="18" />
          <path d="M87 46 L103 46 L103 56 L87 56 Z" />
          <path d="M68 58 L122 58 L114 148 L76 148 Z" />
          <path d="M76 148 L94 148 L88 290 L70 290 Z" />
          <path d="M100 148 L118 148 L124 290 L106 290 Z" />
          <path d="M68 62 L54 64 L46 150 L60 152 Z" />
          {/* inner arm, bent down to hold hands */}
          <path d="M118 60 C132 78 142 110 148 170 L138 172 C132 112 124 82 112 66 Z" />

          {/* woman — fuller hair silhouette flowing past the shoulders,
              waist-in bodice, A-line dress hiding the legs */}
          <path d="M188 20 C170 22 160 40 162 62 C163 78 172 88 185 90 L235 90 C246 88 253 76 252 60 C251 38 238 20 218 18 C210 16 196 17 188 20 Z" />
          <path d="M200 88 L214 88 L214 98 L200 98 Z" />
          <path d="M180 96 L232 96 L226 118 L186 118 Z" />
          <path d="M186 118 C172 160 164 220 160 290 L252 290 C248 220 240 160 226 118 Z" />
          {/* inner arm, bent down to hold hands */}
          <path d="M184 100 C168 112 156 140 150 172 L160 174 C166 144 176 118 190 104 Z" />

          <circle cx="150" cy="173" r="7" />
        </g>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// FireworksKissScene — the final "Đã nói CÓ!" backdrop: a drawn
// silhouette this time (not a real photo), done as two facing PROFILE
// busts instead of a full-body embrace — the classic "kissing couple"
// icon technique. It's far more forgiving to draw well than full
// bodies: a profile is just forehead → nose → lips → chin → jaw, one
// smooth curve, and the two noses touching at the centre reads
// instantly as a kiss. Backlit by scattered firework bursts, per the
// reference photo.
// ─────────────────────────────────────────────────────────────────────
// Positioned across a 300×550 field (roughly a phone's aspect) rather
// than a 300×300 square, so bursts spread down the full screen height
// instead of bunching into a centered square band.
const KISS_FIREWORKS = [
  { cx: 60, cy: 100, r: 70, rays: 14 },
  { cx: 250, cy: 70, r: 60, rays: 12 },
  { cx: 235, cy: 260, r: 75, rays: 16 },
  { cx: 45, cy: 420, r: 65, rays: 12 },
  { cx: 150, cy: 45, r: 45, rays: 10 },
  { cx: 255, cy: 470, r: 55, rays: 10 },
  { cx: 40, cy: 220, r: 40, rays: 8 },
].map((b, bi) => {
  const s = (bi * 2654435761) >>> 0;
  const r = (n: number) => (((s ^ (n * 0x9e3779b1)) >>> 0) % 10000) / 10000;
  const palette = [GOLD, HEART_HOT, '#ffffff'];
  return {
    ...b,
    color: palette[bi % palette.length],
    rayPoints: Array.from({ length: b.rays }, (_, i) => {
      const angle = (i / b.rays) * Math.PI * 2;
      const len = b.r * (0.6 + r(i + 1) * 0.4);
      return { x2: b.cx + Math.cos(angle) * len, y2: b.cy + Math.sin(angle) * len };
    }),
    delay: r(20) * 1.5,
  };
});

function FireworkBurst({ cx, cy, rayPoints, color, delay }: { cx: number; cy: number; rayPoints: { x2: number; y2: number }[]; color: string; delay: number }) {
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: [0, 1, 0.7, 1], scale: 1 }}
      transition={{ duration: 3.4, delay, repeat: Infinity, repeatDelay: 2.6, ease: 'easeOut' }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    >
      {rayPoints.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.x2} y2={p.y2} stroke={i % 2 === 0 ? color : '#ffffff'} strokeWidth={1.6} strokeLinecap="round" opacity={0.75} />
      ))}
      {rayPoints.map((p, i) => (
        <circle key={i} cx={p.x2} cy={p.y2} r={2} fill={i % 2 === 0 ? color : '#ffffff'} />
      ))}
      <circle cx={cx} cy={cy} r={6} fill="#fff" opacity={0.9} />
    </motion.g>
  );
}

function FireworksKissScene({ names, photo }: { names: string; photo: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* their own photo, full-bleed — sharp, not blurred, since this
          time the photo itself is meant to be the star of the scene.
          A soft dark wash keeps the fireworks/text legible on top of
          whatever brightness the photo happens to have. */}
      {photo && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="absolute inset-0 size-full object-cover" />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, rgba(5,5,10,0.35) 0%, rgba(5,5,10,0.15) 40%, rgba(5,5,10,0.55) 100%)' }}
          />
        </>
      )}
      <svg viewBox="0 0 300 550" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        {KISS_FIREWORKS.map((b, i) => (
          <FireworkBurst key={i} cx={b.cx} cy={b.cy} rayPoints={b.rayPoints} color={b.color} delay={b.delay} />
        ))}
      </svg>
      {/* their names, drone-formed — text is a proven, reliable
          formation (unlike freehanding a couple, which kept missing
          the mark), and personal in a way no stock art can be. */}
      {names && (
        <div className="absolute inset-x-0" style={{ top: '38%', height: 220 }}>
          <JourneyDroneShow
            inline
            loop
            droneColor="gold"
            stages={[
              // single-stage loop holds the formation steady instead
              // of re-tweening/flickering every cycle (same fix as
              // SparkleHeart's drone heart earlier in this file).
              { kind: 'text', value: names.toLocaleUpperCase('vi'), fontPx: 140, durationMs: 2600, colors: ['#ff0000', '#e21414', '#dc2626', '#ff3b3b'] },
            ]}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SparkleHeart — a real 3D drone-formed heart anchored center-screen.
// PhotoRain — the couple's own photos drift down from the top of the
// frame continuously, around the heart.
// ─────────────────────────────────────────────────────────────────────
function SparkleHeart({ initials }: { initials: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {/* the two people's initials, carved into the middle of the heart
          once it's formed (galaxy intro runs first, so delay to match) */}
      {initials && (
        <motion.div
          className="absolute z-10 max-w-70 px-4 text-center"
          style={{
            fontFamily: FONT_HERO,
            // shrink for longer full-name pairs ("Nam & Linh") so the
            // text stays inside the heart instead of overflowing like
            // short initials ("N & L") would at a fixed size.
            fontSize: initials.length > 10 ? 'clamp(20px, 6vw, 30px)' : 44,
            fontWeight: 700,
            color: '#fff',
            textShadow: `0 0 10px #fff, 0 0 22px ${HEART_HOT}, 0 0 44px ${HEART}`,
            letterSpacing: 1.5,
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0, 1, 1, 1], scale: [0.8, 1, 1, 1] }}
          transition={{ duration: 6.8, repeat: Infinity, times: [0, 0.22, 0.92, 1], ease: 'easeOut' }}
        >
          {initials}
        </motion.div>
      )}
      {/* the heart itself — a real 3D drone-formed heart (same Three.js
          engine as the proposal scene), reforming on a loop, standing
          still, in a vivid, brilliant palette. */}
      <div className="absolute" style={{ width: 520, height: 520 }}>
        <JourneyDroneShow
          inline
          loop
          droneColor="pink"
          stages={[
            {
              kind: 'scene',
              sceneKey: 'heart',
              durationMs: 4200,
              // no spin — holds still once formed, doesn't rotate
              // solid red only — no gold/white flecks mixed in, so it
              // reads as a clean, uniform red heart
              colors: ['#ff0000', '#e21414', '#dc2626', '#ff3b3b'],
            },
          ]}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// HackerRain — a standalone "hacker screen" of falling monospace text
// (same Matrix-rain technique used elsewhere in the app), its own
// dedicated beat between the countdown and the photo+heart scene,
// instead of being layered underneath other effects.
// ─────────────────────────────────────────────────────────────────────
const FONT_MONO = "'JetBrains Mono', 'Courier New', ui-monospace, monospace";
const HACKER_MS = 11500; // held long enough the receiver can actually read every phrase

function HackerRain({ name, onDone }: { name: string; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phrasesRef = useRef(['CẢM ƠN EM', name.toLocaleUpperCase('vi'), 'I LOVE YOU', 'ĐÃ LUÔN BÊN ANH', 'KHI ANH BUỒN']);
  useEffect(() => {
    phrasesRef.current[1] = name.toLocaleUpperCase('vi');
  }, [name]);

  useEffect(() => {
    const t = setTimeout(onDone, HACKER_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const fontSize = 22;
    const rowFontSize = 34;
    const colWidth = fontSize * 0.95; // denser rain — a real "wall of the matrix" instead of sparse columns
    const colLen = 34;
    let columns: { chars: string[]; y: number; speed: number; hue: 'gold' | 'rose' }[] = [];
    // A handful of whole phrases sliding sideways — mixed in with the
    // vertical rain so the receiver actually gets a horizontal, readable
    // pass of each phrase too, not just scrolling letters.
    let hRows: { y: number; x: number; dir: 1 | -1; speed: number; text: string; hue: 'gold' | 'rose' }[] = [];
    let W = 0;
    let H = 0;

    const pickPhrase = () => {
      const list = phrasesRef.current;
      return (list[Math.floor(Math.random() * list.length)] || 'I LOVE YOU').replace(/\s+/g, ' ').trim();
    };
    const pickChars = () => {
      const phrase = pickPhrase();
      return Array.from({ length: colLen }, (_, k) => phrase[k % phrase.length] || ' ');
    };

    const build = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textAlign = 'center';
      ctx.font = `700 ${fontSize}px ${FONT_MONO}`;

      const count = Math.ceil(W / colWidth);
      columns = Array.from({ length: count }, (_, i) => ({
        chars: pickChars(),
        y: -Math.random() * H,
        speed: 170 + Math.random() * 160,
        hue: i % 3 === 0 ? 'rose' : 'gold',
      }));

      const rowCount = Math.max(5, Math.round(H / 150));
      hRows = Array.from({ length: rowCount }, (_, i) => {
        const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
        return {
          y: (H / (rowCount + 1)) * (i + 1),
          // Row 0 starts just off-frame so "CẢM ƠN EM" enters almost
          // immediately instead of waiting on a random head-start delay.
          x: i === 0 ? -80 : dir === 1 ? -Math.random() * W : W + Math.random() * W,
          dir,
          // Slow, readable pace — this is the pass meant to actually be read.
          speed: 55 + Math.random() * 35,
          // The very first row is always "CẢM ƠN EM" — the thing meant
          // to be read first, not left to chance like the rest.
          text: i === 0 ? 'CẢM ƠN EM' : pickPhrase(),
          hue: i % 2 === 0 ? 'gold' : 'rose',
        };
      });
    };

    build();
    const onResize = () => build();
    window.addEventListener('resize', onResize);

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.fillStyle = 'rgba(2,2,18,0.4)';
      ctx.fillRect(0, 0, W, H);

      ctx.font = `700 ${fontSize}px ${FONT_MONO}`;
      columns.forEach((col, i) => {
        col.y += col.speed * dt;
        if (col.y > H + col.chars.length * fontSize) {
          col.y = -Math.random() * H * 0.6;
          col.chars = pickChars();
          col.hue = Math.random() < 0.3 ? 'rose' : 'gold';
        }
        const x = i * colWidth + colWidth / 2;
        col.chars.forEach((ch, j) => {
          const y = col.y - j * fontSize;
          if (y < -fontSize || y > H + fontSize) return;
          const col2 = col.hue === 'gold' ? '255,244,214' : '255,140,170';
          if (j === 0) {
            // the leading character carries a real glow (canvas shadow,
            // not just alpha) so the whole thing reads brighter/grander
            ctx.shadowColor = `rgba(${col2},0.95)`;
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#ffffff';
          } else {
            ctx.shadowBlur = 0;
            const fade = Math.max(0, 1 - j / col.chars.length);
            ctx.fillStyle = `rgba(${col2},${Math.min(0.75, fade * 0.8)})`;
          }
          ctx.fillText(ch, x, y);
        });
      });
      ctx.shadowBlur = 0;

      const prevAlign = ctx.textAlign;
      ctx.textAlign = 'left';
      ctx.font = `700 ${rowFontSize}px ${FONT_MONO}`;
      hRows.forEach((row) => {
        row.x += row.dir * row.speed * dt;
        const textW = ctx.measureText(row.text).width;
        if (row.dir === 1 && row.x > W) {
          row.x = -textW - Math.random() * W * 0.4;
          row.text = pickPhrase();
        } else if (row.dir === -1 && row.x < -textW) {
          row.x = W + Math.random() * W * 0.4;
          row.text = pickPhrase();
        }
        const col2 = row.hue === 'gold' ? '255,244,214' : '255,140,170';
        // a soft double-pass glow behind the crisp readable text
        ctx.shadowColor = `rgba(${col2},0.9)`;
        ctx.shadowBlur = 28;
        ctx.fillStyle = `rgba(${col2},0.85)`;
        ctx.fillText(row.text, row.x, row.y);
        ctx.shadowBlur = 0;
      });
      ctx.textAlign = prevAlign;
      ctx.font = `700 ${fontSize}px ${FONT_MONO}`;

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-20 cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={onDone}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDone(); }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      aria-label="Chạm để tiếp tục"
    >
      {/* two layered pulsing glows behind the rain — a big soft wash plus
          a tighter hot core — makes the whole screen feel grand and alive
          instead of a flat black backdrop */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: 900, height: 900, marginLeft: -450, marginTop: -450,
          background: `radial-gradient(circle, ${GOLD}22, transparent 72%)`,
        }}
        animate={{ opacity: [0.3, 0.65, 0.3], scale: [0.94, 1.1, 0.94] }}
        transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: 520, height: 520, marginLeft: -260, marginTop: -260,
          background: `radial-gradient(circle, ${HEART}44, transparent 70%)`,
        }}
        animate={{ opacity: [0.4, 0.85, 0.4], scale: [0.9, 1.1, 0.9] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      <canvas ref={canvasRef} className="size-full" aria-hidden />
    </motion.div>
  );
}

// Photos drift down either side of the frame, leaving the 30–70% center
// band clear for the heart — a gentle sine sway instead of a straight
// drop, plus soft depth (far tiles smaller/dimmer/blurred, near tiles
// bigger/crisp) so it reads as a real photo-snow parallax, not a flat
// scatter.
const PHOTO_RAIN = Array.from({ length: 10 }, (_, i) => {
  const s = (i * 2654435761) >>> 0;
  const r = (n: number) => (((s ^ (n * 0x9e3779b1)) >>> 0) % 10000) / 10000;
  const onLeftSide = i % 2 === 0;
  const band = onLeftSide ? r(1) * 26 : 74 + r(1) * 26; // 0–26% or 74–100%, clear of center
  const isNear = r(7) > 0.45;
  return {
    left: band,
    delay: r(2) * 7,
    dur: 12 + r(3) * 7,
    size: isNear ? 68 + r(4) * 22 : 40 + r(4) * 16,
    tilt: (r(5) - 0.5) * 18,
    swayVw: 4 + r(6) * 6,
    isNear,
  };
});

function PhotoRain({ photos }: { photos: string[] }) {
  const pics = photos.length > 0 ? photos : null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {PHOTO_RAIN.map((p, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: `${p.left}%`, top: '-16%', width: p.size, height: p.size, filter: p.isNear ? 'none' : 'blur(0.8px)' }}
          initial={{ y: 0, x: 0, opacity: 0, rotate: p.tilt }}
          animate={{
            y: '130vh',
            x: [0, `${p.swayVw}vw`, 0, `${-p.swayVw}vw`, 0],
            rotate: [p.tilt, p.tilt + 6, p.tilt, p.tilt - 6, p.tilt],
            opacity: p.isNear ? [0, 1, 1, 0] : [0, 0.6, 0.6, 0],
          }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'linear' }}
        >
          <div
            className="size-full overflow-hidden rounded-lg border-2 border-white bg-white p-1"
            style={{ boxShadow: `0 8px 22px rgba(0,0,0,0.55), 0 0 0 1px ${HEART_HOT}22` }}
          >
            <div className="size-full overflow-hidden rounded-[3px]">
              {pics && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pics[i % pics.length]}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// VelvetCurtain — a theater-red velvet curtain drawn shut across the
// screen; tapping it (or the tie-back tassels) sweeps both panels open
// to reveal the night sky, like a stage show about to begin.
// ─────────────────────────────────────────────────────────────────────
function CurtainPanel({ side, opening }: { side: 'left' | 'right'; opening: boolean }) {
  const isLeft = side === 'left';
  return (
    <motion.div
      className={`absolute top-0 h-full w-[54%] ${isLeft ? 'left-0 origin-left' : 'right-0 origin-right'}`}
      style={{
        background: `repeating-linear-gradient(${isLeft ? 90 : -90}deg, #4a0812 0px, #6b0f1f 16px, #8a1626 26px, #6b0f1f 36px)`,
        boxShadow: isLeft ? 'inset -30px 0 60px rgba(0,0,0,0.6)' : 'inset 30px 0 60px rgba(0,0,0,0.6)',
      }}
      animate={opening ? { x: isLeft ? '-96%' : '96%', scaleX: 0.62 } : { x: 0, scaleX: 1 }}
      transition={{ duration: 1.1, ease: [0.7, 0, 0.25, 1] }}
    >
      {/* gold valance along the top edge */}
      <div
        className="absolute inset-x-0 top-0 h-6"
        style={{ background: 'linear-gradient(180deg, #e8c766, #a8781f)', boxShadow: '0 3px 6px rgba(0,0,0,0.5)' }}
      />
      {/* tie-back tassel at the inner edge, only visible once opened */}
      <motion.div
        className={`absolute top-1/2 h-16 w-4 -translate-y-1/2 rounded-full ${isLeft ? 'right-2' : 'left-2'}`}
        style={{ background: 'linear-gradient(180deg, #f0d27a, #a8781f)' }}
        animate={{ opacity: opening ? 1 : 0 }}
        transition={{ duration: 0.4, delay: opening ? 0.8 : 0 }}
      />
    </motion.div>
  );
}

function VelvetCurtain({ onDone }: { onDone: () => void }) {
  const [opening, setOpening] = useState(false);

  const open = useCallback(() => {
    setOpening((o) => {
      if (!o) setTimeout(onDone, 1150);
      return true;
    });
  }, [onDone]);

  // Opens on its own after a beat — tapping just gets there sooner.
  useEffect(() => {
    const t = setTimeout(open, 2400);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') open(); }}
      className="absolute inset-0 z-20 cursor-pointer overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      aria-label="Chạm để mở màn"
    >
      <CurtainPanel side="left" opening={opening} />
      <CurtainPanel side="right" opening={opening} />

      <AnimatePresence>
        {!opening && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ fontSize: 40 }}
            >
              🎭
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Countdown — a cinematic 3‑2‑1, right after the curtain opens. Each
// number flashes in big with a shockwave ring, holds a beat, then
// snaps out for the next.
// ─────────────────────────────────────────────────────────────────────
const COUNTDOWN_NUMS = [3, 2, 1];

function Countdown({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      if (i < COUNTDOWN_NUMS.length - 1) setI((n) => n + 1);
      else onDone();
    }, 1400);
    return () => clearTimeout(t);
  }, [i, onDone]);

  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* the real candlelit-dinner-proposal photo, blurred + darkened
          behind the countdown so the numbers stay readable */}
      <div className="absolute inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/dinner-proposal.jpg"
          alt=""
          className="size-full object-cover"
          style={{ filter: 'blur(6px) brightness(0.55)', transform: 'scale(1.1)' }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(120% 90% at 50% 45%, transparent 30%, rgba(0,0,0,0.55) 100%)' }}
        />
      </div>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={i}
          className="relative z-10 flex items-center justify-center"
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* shockwave ring, one burst per number */}
          <motion.div
            className="absolute rounded-full border-4"
            style={{ width: 160, height: 160, borderColor: `${HEART_HOT}cc` }}
            initial={{ scale: 0.6, opacity: 0.9 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
          <span
            style={{
              fontFamily: FONT_HERO, fontWeight: 700,
              fontSize: 140, color: '#fff', lineHeight: 1,
              textShadow: `0 0 30px ${HEART}, 0 6px 20px rgba(0,0,0,0.6)`,
            }}
          >
            {COUNTDOWN_NUMS[i]}
          </span>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TypewriterMessage — the sender's own message types out letter by
// letter against the night sky. Holds a beat once finished, then hands
// off to the drone proposal.
// ─────────────────────────────────────────────────────────────────────
const TYPE_SPEED_MS = 45;
const TYPE_HOLD_MS = 1800;

function TypewriterMessage({ text, onDone }: { text: string; onDone: () => void }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          window.clearInterval(t);
          return n;
        }
        return n + 1;
      });
    }, TYPE_SPEED_MS);
    return () => window.clearInterval(t);
  }, [text]);

  useEffect(() => {
    if (shown < text.length) return;
    const t = setTimeout(onDone, TYPE_HOLD_MS);
    return () => clearTimeout(t);
  }, [shown, text.length, onDone]);

  const done = shown >= text.length;

  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-center justify-center px-10 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7 }}
    >
      <p
        className="max-w-[85%]"
        style={{
          fontFamily: FONT_WHISPER, fontStyle: 'italic',
          fontSize: 'clamp(18px, 3.6vw, 28px)', color: '#fff', lineHeight: 1.5,
          textShadow: `0 2px 14px rgba(0,0,0,0.8), 0 0 20px ${HEART}55`,
        }}
      >
        {text.slice(0, shown)}
        {!done && <span className="animate-pulse">▍</span>}
      </p>
    </motion.div>
  );
}

function PropRingReveal({ kiss, onClose }: TemplateProps) {
  const rawName = (getKissString(kiss, 'name') || kiss.receiver_name || 'em').trim();
  const displayName = rawName || 'em';
  // The heart's carved text: prefer the sender's two typed names
  // ("Nam & Linh"); fall back to the older combined "initials" field
  // for kisses created before name1/name2 existed.
  const name1 = (getKissString(kiss, 'name1') || '').trim();
  const name2 = (getKissString(kiss, 'name2') || '').trim();
  const legacyInitials = (getKissString(kiss, 'initials') || '').trim();
  // If nothing was ever typed in (old kisses without name1/name2/initials),
  // still carve *something* into the heart rather than leaving it blank.
  const initials = name1 && name2 ? `${name1} & ${name2}` : legacyInitials || 'I ❤ U';

  // Same template covers a marriage proposal or a girlfriend/boyfriend
  // ask — the sender picks which final question shows.
  const questionType = (getKissString(kiss, 'question') || 'marry').trim();
  const questionText = QUESTION_TEXT[questionType] ?? QUESTION_TEXT.marry;

  const allPhotos = useMemo(() => {
    const raw = parseKissData(kiss).photos;
    const list = Array.isArray(raw) ? raw.filter((u): u is string => typeof u === 'string' && !!u) : [];
    if (list.length > 0) return list;
    const single = getKissString(kiss, 'photo') || kiss.sender_avatar;
    return single ? [single] : [];
  }, [kiss]);
  const photoUrl = allPhotos[0] ?? '';

  const [phase, setPhase] = useState<'intro' | 'countdown' | 'hacker' | 'sky' | 'message' | 'ring' | 'question' | 'yes'>('intro');
  const [noOffset, setNoOffset] = useState({ x: 0, y: 0 });
  const [dodges, setDodges] = useState(0);

  const openBox = useCallback(() => {
    setPhase((p) => (p === 'sky' ? 'message' : p));
  }, []);

  const startProposal = useCallback(() => {
    setPhase((p) => (p === 'message' ? 'ring' : p));
    playProposalSound();
  }, []);

  const dodgeNo = useCallback(() => {
    setDodges((n) => Math.min(n + 1, 8));
    const dx = (Math.random() - 0.5) * 220;
    const dy = (Math.random() - 0.5) * 90 - 10;
    setNoOffset({ x: dx, y: dy });
  }, []);

  const accept = useCallback(() => {
    setPhase('yes');
    playYesSound();
    playHeartbeat();
    setTimeout(() => onClose(), 9000);
  }, [onClose]);

  const yesScale = 1 + Math.min(dodges, 6) * 0.06;

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden select-none sm:p-6 sm:bg-black" style={{ fontFamily: FONT_BODY }}>
      <div
        className="relative size-full overflow-hidden sm:rounded-[28px] sm:border sm:border-white/10 sm:shadow-[0_0_90px_rgba(0,0,0,0.65)]"
        style={{
          background: `
            radial-gradient(130% 90% at 50% 0%, ${SKY_MID}, transparent 65%),
            radial-gradient(100% 70% at 15% 95%, ${SKY_DEEP}, transparent 65%),
            linear-gradient(to bottom, ${SKY_MID} 0%, ${SKY_DEEP} 40%, ${SKY_BLACK} 100%)
          `,
        }}
      >
        <NightSky />

        <AnimatePresence>
          {phase === 'intro' && (
            <VelvetCurtain key="intro" onDone={() => setPhase((p) => (p === 'intro' ? 'countdown' : p))} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === 'countdown' && (
            <Countdown key="countdown" onDone={() => setPhase((p) => (p === 'countdown' ? 'hacker' : p))} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === 'hacker' && (
            <HackerRain
              key="hacker"
              name={displayName}
              onDone={() => setPhase((p) => (p === 'hacker' ? 'sky' : p))}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === 'sky' && (
            <motion.div
              key="sky"
              role="button"
              tabIndex={0}
              onClick={openBox}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openBox(); }}
              className="absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-end gap-3 pb-[8%]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
              aria-label="Chạm vào bầu trời"
            >
              <LookingUpCouple />
              <PhotoRain photos={allPhotos} />
              <SparkleHeart initials={initials} />
              <motion.p
                initial={{ y: -60, opacity: 0 }}
                animate={{ y: 0, opacity: 0.9 }}
                transition={{ duration: 0.9, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 max-w-[80%] text-center"
                style={{
                  fontFamily: FONT_WHISPER, fontStyle: 'italic',
                  fontSize: 'clamp(14px, 2.6vw, 19px)', color: '#fff',
                  textShadow: '0 2px 10px rgba(0,0,0,0.7)',
                }}
              >
                Đây là những bức hình hai đứa mình chụp cùng nhau
              </motion.p>
              <motion.button
                type="button"
                onClick={openBox}
                className="cursor-pointer"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 1.6, ease: [0.16, 1, 0.3, 1] }}
                aria-label="Chạm vân tay để tiếp tục"
              >
                <motion.div
                  animate={{ scale: [1, 1.12, 1], opacity: [0.75, 1, 0.75] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ filter: `drop-shadow(0 0 14px ${MOON_MID}aa)` }}
                >
                  <svg width="46" height="46" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 3.5c-4.7 0-8.5 3.8-8.5 8.5 0 2.2.4 3.5.9 4.6" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" fill="none" />
                    <path d="M20.5 12c0-4.7-3.8-8.5-8.5-8.5" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" fill="none" />
                    <path d="M6.2 18.5c-1-1.7-1.7-3.8-1.7-6 0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5c0 .9-.1 1.7-.3 2.5" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" fill="none" />
                    <path d="M8.3 20c-.8-1-1.4-2.1-1.8-3.3M9.5 8.6a5 5 0 0 1 7 4.6c0 1.1-.1 1.9-.4 2.7M12 21c-.9-.6-1.7-1.4-2.3-2.3" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" fill="none" />
                    <path d="M12 9.2a3.3 3.3 0 0 1 3.3 3.3c0 2.6-.9 4.7-2.2 6.3M9.6 18.9c1-1.4 1.7-3.6 1.7-6.4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" fill="none" />
                  </svg>
                </motion.div>
              </motion.button>
              {/* the fingerprint icon alone isn't a self-evident tap
                  target — spell it out, same pattern as the curtain's
                  "Chạm để mở màn" hint. */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.5, 0.9, 0.5] }}
                transition={{ duration: 1.8, delay: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-10"
                style={{
                  fontFamily: FONT_WHISPER, fontStyle: 'italic',
                  fontSize: 'clamp(12px, 2.2vw, 15px)', color: '#fff',
                  textShadow: '0 2px 10px rgba(0,0,0,0.7)',
                }}
              >
                Chạm để tiếp tục ✦
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === 'message' && (
            <TypewriterMessage
              key="message"
              text={kiss.message || `${displayName} ơi, anh có điều muốn nói...`}
              onDone={startProposal}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === 'ring' && (
            <motion.div
              key="ring"
              className="absolute inset-0 z-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* a hint of city skyline along the bottom — the drone
                  canvas is transparent when inline, so this reads through
                  it, grounding the scene like a real drone-show video shot
                  from a rooftop instead of floating in a plain void. */}
              <CitySkyline />
              <JourneyDroneShow
                inline
                droneColor="gold"
                stages={[
                  // a grand spinning galaxy first, before the drones
                  // settle into the proposal — a proper "big show" opener
                  // instead of cutting straight to the couple. One clean
                  // full turn, all-white drones throughout.
                  {
                    kind: 'scene', sceneKey: 'galaxy', durationMs: 3200,
                    spin: (2 * Math.PI) / 3.2,
                    colors: ['#ffffff'],
                  },
                  // white drones for the kneeling proposal — held longer
                  // so the moment actually lands instead of rushing by.
                  { kind: 'scene', sceneKey: 'proposal', durationMs: 8500, colors: ['#ffffff'] },
                ]}
                onDone={() => setPhase((p) => (p === 'ring' ? 'question' : p))}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === 'question' && (
            <motion.div
              key="question"
              className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-8 px-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
            >
              {photoUrl && (
                <div
                  className="overflow-hidden rounded-lg border-[3px] border-white bg-white shadow-[0_6px_18px_rgba(0,0,0,0.5)]"
                  style={{ width: 84, height: 84, transform: 'rotate(-3deg)' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              )}
              <div
                style={{
                  fontFamily: FONT_HERO, fontWeight: 700,
                  fontSize: 'clamp(22px, 4.5vw, 38px)', color: '#fff',
                  textShadow: `0 4px 18px rgba(0,0,0,0.75), 0 0 24px ${GOLD}66`,
                }}
              >
                {displayName}, {questionText}
              </div>
              <div className="relative flex items-center justify-center gap-5" style={{ minHeight: 60 }}>
                <motion.button
                  type="button"
                  onClick={accept}
                  animate={{ scale: yesScale }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="cursor-pointer rounded-full px-7 py-3 text-base font-bold text-white shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${HEART_HOT}, ${HEART})` }}
                >
                  Đồng ý 💍
                </motion.button>
                <motion.button
                  type="button"
                  onMouseEnter={dodgeNo}
                  onTouchStart={(e) => { e.preventDefault(); dodgeNo(); }}
                  onClick={(e) => e.preventDefault()}
                  animate={{ x: noOffset.x, y: noOffset.y, scale: Math.max(0.6, 1 - dodges * 0.06) }}
                  transition={{ type: 'spring', stiffness: 320, damping: 14 }}
                  className="cursor-pointer rounded-full border border-white/25 px-7 py-3 text-base font-semibold text-white/70"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  Không
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === 'yes' && (
            <motion.div
              key="yes"
              className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 px-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
            >
              <FireworksKissScene names={initials} photo={allPhotos[0] ?? ''} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default PropRingReveal;

export const PropRingConfig: TemplateConfig = {
  id: 'prop-ring',
  name: 'Ring Reveal',
  occasionIds: ['proposal'],
  emoji: '💍',
  description: 'Hai người ngắm sao đêm cùng nhau, chạm vào bầu trời để mở hộp nhẫn và cầu hôn.',
  thumbnailBg: 'linear-gradient(135deg, #1a0a2e, #f43f5e)',
  Component: PropRingReveal,
};
