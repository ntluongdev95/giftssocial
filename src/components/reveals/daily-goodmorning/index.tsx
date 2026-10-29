

'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getKissString, parseKissData } from '../_shared/useTemplateData';
import type { TemplateProps, TemplateConfig } from '../_types';

const rnd = (n: number) => Math.round(n * 10000) / 10000;

const NIGHT_HOLD_MS = 2600;
const DAWN_MS = 6000;
const HORIZON = 56;
const FLOCK_SIZE = 8; // Số lượng chim trong đàn

function ensureDoveCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('gao-dove-marker-css')) return;
  const st = document.createElement('style');
  st.id = 'gao-dove-marker-css';
  st.textContent = `
    @keyframes gaoDoveFlap {
      0%   { transform: scaleY(1)    scaleX(-1)    translateY(0); }
      18%  { transform: scaleY(0.55) scaleX(-1.1)  translateY(-7px) rotate(3deg); }
      50%  { transform: scaleY(0.95) scaleX(-1.02) translateY(-1px) rotate(-2deg); }
      100% { transform: scaleY(1)    scaleX(-1)    translateY(0); }
    }
    @keyframes gaoDoveLetterSway {
      0%   { transform: rotate(-16deg) translateX(-2px); }
      50%  { transform: rotate(16deg)  translateX(2px); }
      100% { transform: rotate(-16deg) translateX(-2px); }
    }
    .gao-dove-flap   { animation: gaoDoveFlap 0.75s ease-in-out infinite; transform-origin: center bottom; display: block; }
    .gao-dove-letter { animation: gaoDoveLetterSway 2.2s ease-in-out infinite; transform-origin: top center; display: block; }
  `;
  document.head.appendChild(st);
}

function DailyGoodmorningReveal({ kiss, onClose }: TemplateProps) {
  useEffect(() => {
    ensureDoveCss();
  }, []);

  const rawName = (getKissString(kiss, 'name') || kiss.receiver_name || '').trim();
  const customMessage = kiss.message || 'Chúc buổi sáng tốt lành';

  // Ảnh người gửi tải lên khi tạo thiệp — sống trong kiss.template_data
  // (điền qua fields_schema "photos"), giống mọi template khác trong
  // app này. KHÔNG có kiss.images / kiss.image_url trên RevealKiss —
  // dùng nhầm hai field đó là nguyên nhân gây lỗi build trước đây.
  const userImages: string[] = useMemo(() => {
    const raw = parseKissData(kiss).photos;
    if (Array.isArray(raw)) {
      const list = raw.filter((u): u is string => typeof u === 'string' && !!u);
      if (list.length > 0) return list;
    }
    const single = getKissString(kiss, 'photo');
    return single ? [single] : [];
  }, [kiss]);

  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const dawning = phase >= 1;
  const isFinalStage = phase === 2;
  // Modal "open" is tracked separately from which photo (if any) is
  // showing inside it — when the sender uploaded no photos, userImages
  // is empty and there's nothing to pass in, but the note should still
  // open on tap.
  const [showNote, setShowNote] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [messageSeen, setMessageSeen] = useState(false);

  const openMessage = (imgUrl?: string) => {
    setSelectedImage(imgUrl ?? null);
    setShowNote(true);
    setMessageSeen(true);
  };

  useEffect(() => {
    const t = window.setTimeout(() => setPhase(1), NIGHT_HOLD_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== 1) return;
    const t = window.setTimeout(() => setPhase(2), DAWN_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (!isFinalStage) return;
    if (kiss.message && !messageSeen) return;
    const t = window.setTimeout(() => onClose?.(), 25000);
    return () => window.clearTimeout(t);
  }, [isFinalStage, kiss.message, messageSeen, onClose]);

  // Tạo quỹ đạo bay lượn lộn xộn sinh động thực tế cho đàn chim.
  // Dùng seeded PRNG (không phải Math.random()) — Math.random() gọi
  // trực tiếp trong render/useMemo là impure, gây lỗi build
  // (react-hooks/purity) và làm quỹ đạo đổi mỗi lần re-render.
  // Không có ảnh nào thì không có gì để chim thả — trả mảng rỗng,
  // phần render bên dưới tự ẩn cả đàn chim.
  const flockData = useMemo(() => {
    if (userImages.length === 0) return [];
    return Array.from({ length: FLOCK_SIZE }).map((_, idx) => {
      const imgUrl = userImages[idx % userImages.length];
      const seed = ((idx + 400) * 2654435761) >>> 0;
      const r = (n: number) => (((seed ^ (n * 0x9e3779b1)) >>> 0) % 10000) / 10000;

      // Biên độ lượn sóng Y lộn xộn cho từng con
      const startY = 10 + r(1) * 22;
      const midY1 = startY + (r(2) * 16 - 8);
      const midY2 = midY1 + (r(3) * 18 - 9);
      const endY = midY2 + (r(4) * 14 - 7);

      // Điểm rơi ảnh tự nhiên rải rác từ trái sang phải
      const dropLeft = 10 + (idx * 78) / (FLOCK_SIZE - 1) + (r(5) * 6 - 3);

      return {
        id: idx,
        imgUrl,
        flightDuration: rnd(13 + r(6) * 6), // Tốc độ khác nhau
        flightDelay: rnd(0.3 + idx * 1.1 + r(7) * 0.8), // Xuất hiện ngẫu nhiên
        yTrajectory: [
          `${rnd(startY)}%`,
          `${rnd(midY1)}%`,
          `${rnd(midY2)}%`,
          `${rnd(endY)}%`,
        ],
        rotations: [
          rnd(r(8) * 6 - 3),
          rnd(r(9) * 12 - 6),
          rnd(r(10) * 10 - 5),
          rnd(r(11) * 8 - 4),
        ],
        dropLeft: rnd(Math.min(88, Math.max(8, dropLeft))),
        dropDelayRatio: rnd(0.3 + r(12) * 0.2), // Tỷ lệ thời điểm thả ảnh ngẫu nhiên
      };
    });
  }, [userImages]);

  // Background stars & water ripples — seeded PRNG, not Math.random()
  // (same purity requirement as flockData above).
  const stars = useMemo(() => Array.from({ length: 50 }).map((_, i) => {
    const seed = ((i + 11) * 2654435761) >>> 0;
    const r = (n: number) => (((seed ^ (n * 0x9e3779b1)) >>> 0) % 10000) / 10000;
    return {
      left: rnd(r(1) * 100), top: rnd(r(2) * (HORIZON - 4)),
      size: rnd(0.8 + r(3) * 1.7), base: rnd(0.35 + r(4) * 0.6),
      dur: rnd(2.4 + r(5) * 3.6), delay: rnd(r(6) * 4),
    };
  }), []);

  const ripples = useMemo(() => Array.from({ length: 45 }).map((_, i) => {
    const seed = ((i + 320) * 2654435761) >>> 0;
    const r = (n: number) => (((seed ^ (n * 0x9e3779b1)) >>> 0) % 10000) / 10000;
    return {
      top: rnd(r(1) * 100), left: rnd(r(2) * 80),
      width: rnd(10 + r(3) * 20), height: rnd(1 + r(4) * 2),
      opacity: rnd(0.08 + r(5) * 0.1), drift: rnd(1 + r(6) * 2),
      dur: rnd(6 + r(7) * 6), blur: rnd(0.8 + r(8) * 1.2),
    };
  }), []);

  const line1Text = `✦ CHÀO BUỔI SÁNG, ${rawName} `;
  const line2Text = `✦ CHÚC CHỊ BUỔI SÁNG TỐT LÀNH `;

  return (
    <div
      className="fixed inset-0 z-200 overflow-hidden select-none"
      style={{ background: '#070a16', fontFamily: "'Playfair Display', Georgia, serif" }}
      onClick={() => {
        if (!isFinalStage) return;
        if (kiss.message && !messageSeen) return;
        onClose?.();
      }}
    >
      {/* ── Bầu trời Ban ngày ── */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: `${HORIZON}%`,
          background: 'linear-gradient(180deg, #1d2b4d 0%, #4a4470 34%, #8d6178 58%, #cf8a7c 80%, #f2b98a 100%)',
        }}
      />
      
      {/* ── Bầu trời Ban đêm ── */}
      <motion.div
        className="absolute inset-x-0 top-0"
        style={{ height: `${HORIZON}%`, background: 'linear-gradient(180deg, #05070f 0%, #0a1024 45%, #131a34 78%, #1b2340 100%)' }}
        animate={{ opacity: dawning ? 0 : 1 }}
        transition={{ duration: DAWN_MS / 1000, ease: 'easeInOut' }}
      />

      {/* ── Sao đêm ── */}
      <motion.div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{ height: `${HORIZON}%`, zIndex: 1 }}
        animate={{ opacity: dawning ? 0 : 1 }}
        transition={{ duration: (DAWN_MS / 1000) * 0.6 }}
      >
        {stars.map((st, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{ left: `${st.left}%`, top: `${st.top}%`, width: st.size, height: st.size }}
            animate={{ opacity: [st.base * 0.35, st.base, st.base * 0.35] }}
            transition={{ duration: st.dur, delay: st.delay, repeat: Infinity }}
          />
        ))}
      </motion.div>

      {/* ── MARQUEE LIỀN MẠCH KHÔNG KHỎANG TRỐNG (CHẠY CHẬM ÊM) ── */}
      <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: `${HORIZON}%`, zIndex: 6 }}>
        <motion.div
          className="absolute inset-x-0 flex flex-col gap-3 pointer-events-none"
          style={{ top: '8%' }}
          initial={{ opacity: 0 }}
          animate={dawning ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 2, delay: 0.5 }}
        >
          {/* Dòng 1: Phải sang Trái */}
          <div className="overflow-hidden whitespace-nowrap flex py-1">
            <motion.div
              className="flex flex-nowrap text-[22px] sm:text-[28px] font-black uppercase tracking-[0.2em]"
              style={{
                color: '#ffffff',
                textShadow: '0 0 10px #6ee7b7, 0 0 20px #3b82f6',
                fontFamily: 'monospace, sans-serif',
              }}
              animate={{ x: ['0%', '-50%'] }}
              transition={{ repeat: Infinity, duration: 32, ease: 'linear' }}
            >
              <span>{line1Text.repeat(4)}</span>
              <span>{line1Text.repeat(4)}</span>
            </motion.div>
          </div>

          {/* Dòng 2: Trái sang Phải */}
          <div className="overflow-hidden whitespace-nowrap flex py-1">
            <motion.div
              className="flex flex-nowrap text-[20px] sm:text-[25px] font-black uppercase tracking-[0.18em]"
              style={{
                color: '#fef08a',
                textShadow: '0 0 10px #f59e0b, 0 0 20px #ef4444',
                fontFamily: 'monospace, sans-serif',
              }}
              animate={{ x: ['-50%', '0%'] }}
              transition={{ repeat: Infinity, duration: 36, ease: 'linear' }}
            >
              <span>{line2Text.repeat(4)}</span>
              <span>{line2Text.repeat(4)}</span>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* ── ĐÀN CHIM BAY LƯỢN CHAO NGHIÊNG & THẢ ẢNH TỰ NHIÊN ── */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 10 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: dawning ? 1 : 0 }}
        transition={{ duration: 1, delay: 1 }}
      >
        {flockData.map((bird) => (
          <div key={bird.id}>
            {/* Con chim bay lượn lộn xộn theo quỹ đạo Bezier uốn lượn */}
            <motion.div
              className="absolute pointer-events-none"
              initial={{ left: '-15vw', top: bird.yTrajectory[0], rotate: 0 }}
              animate={{
                left: '115vw',
                top: bird.yTrajectory,
                rotate: bird.rotations,
              }}
              transition={{
                duration: bird.flightDuration,
                delay: bird.flightDelay,
                ease: 'easeInOut',
              }}
            >
              <div className="gao-dove-flap text-4xl sm:text-5xl select-none filter drop-shadow-[0_6px_12px_rgba(255,255,255,0.75)]">
                🕊️
              </div>
            </motion.div>

            {/* Bức ảnh được chim thả xuống, chao nhẹ qua lại tự do theo lực cản không khí */}
            <motion.div
              className="absolute cursor-pointer pointer-events-auto"
              style={{ width: 72, height: 92 }}
              initial={{
                left: `${bird.dropLeft}%`,
                top: `${bird.yTrajectory[1]}`,
                opacity: 0,
                rotate: -18,
                scale: 0.5,
              }}
              animate={{
                top: [`${bird.yTrajectory[1]}`, '38%', '56%'],
                x: [0, -12, 14, -6],                    // Hiệu ứng lá rơi lượn sóng
                opacity: [0, 1, 0.85, 0],               // Mờ dần và biến mất hẳn
                rotate: [-18, 14, -10, 8],              // Chao nghiêng góc nhìn chân thực
                scale: [0.5, 1, 0.9, 0.6],
              }}
              transition={{
                duration: 8,
                delay: bird.flightDelay + (bird.flightDuration * bird.dropDelayRatio),
                ease: 'easeInOut',
              }}
              onClick={(e) => {
                e.stopPropagation();
                openMessage(bird.imgUrl);
              }}
            >
              <div
                className="gao-dove-letter w-full h-full p-1.5 bg-white/95 rounded-md shadow-2xl backdrop-blur-sm flex flex-col items-center"
                style={{
                  border: '1px solid rgba(255,255,255,0.9)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.45), 0 0 15px rgba(255,228,205,0.5)',
                }}
              >
                <div className="w-full h-[65px] overflow-hidden rounded bg-gray-200">
                  <img src={bird.imgUrl} alt="Dropped Photo" className="w-full h-full object-cover" />
                </div>
                <div className="mt-1 text-[8px] font-bold text-gray-700 tracking-wider uppercase truncate w-full text-center">
                  {rawName}
                </div>
              </div>
            </motion.div>
          </div>
        ))}
      </motion.div>

      {/* ── Mặt Trời ── */}
      <motion.div
        className="absolute pointer-events-none"
        style={{ left: '50%', width: 96, height: 96, marginLeft: -48, zIndex: 2 }}
        initial={{ top: `${HORIZON + 6}%`, opacity: 0 }}
        animate={dawning ? { top: `${HORIZON - 21}%`, opacity: 1 } : { top: `${HORIZON + 6}%`, opacity: 0 }}
        transition={{ duration: DAWN_MS / 1000, ease: [0.35, 0, 0.25, 1] }}
      >
        <div
          className="w-full h-full rounded-full"
          style={{
            background: 'radial-gradient(circle at 50% 45%, #fffdf6 0%, #ffeccf 55%, #ffd9ab 100%)',
            boxShadow: '0 0 30px 10px rgba(255,236,207,0.9), 0 0 120px 55px rgba(255,163,110,0.45)',
          }}
        />
      </motion.div>

      {/* ── Mặt Biển ── */}
      <div className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ top: `${HORIZON}%`, zIndex: 4 }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #8a7488 0%, #4c5372 44%, #1d2440 100%)' }} />
        <motion.div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, #131b33 0%, #0c1226 46%, #060a16 100%)' }}
          animate={{ opacity: dawning ? 0 : 1 }}
          transition={{ duration: DAWN_MS / 1000 }}
        />

        {ripples.map((rp, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${rp.left}%`, width: `${rp.width}%`, top: `${rp.top}%`, height: rp.height,
              background: `rgba(226,220,228,${rp.opacity})`, filter: `blur(${rp.blur}px)`,
            }}
            animate={{ x: [`-${rp.drift}%`, `${rp.drift}%`, `-${rp.drift}%`] }}
            transition={{ duration: rp.dur, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* ── Silhouette trên bờ ── */}
      <div className="absolute pointer-events-none" style={{ left: '50%', bottom: '-2%', marginLeft: 14, zIndex: 7 }}>
        <svg width="156" height="390" viewBox="0 0 120 300">
          <g fill={dawning ? '#120c14' : '#010206'}>
            <path d="M44,30 C33,34 29,50 31,68 C33,84 29,96 22,110 C19,117 27,116 33,107 C42,93 47,74 47,58 C47,46 48,36 44,30 Z" />
            <ellipse cx="60" cy="34" rx="14.5" ry="16.5" />
            <path d="M53,47 L53,58 C57,62 63,62 67,58 L67,47 Z" />
            <path d="M52,55 C43,59 38,70 36,84 C34,98 33,106 34,114 C30,152 27,206 24,258 C42,266 78,266 96,258 C93,206 90,152 86,114 C87,106 86,98 84,84 C82,70 77,59 68,55 C63,52 57,52 52,55 Z" />
          </g>
        </svg>
      </div>

      {/* ── NÚT BẤM TAP TO OPEN ── */}
      {isFinalStage && !showNote && (
        <motion.div
          className="absolute inset-x-0 flex flex-col items-center pointer-events-none"
          style={{ top: '85%', zIndex: 12 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openMessage(userImages[0]);
            }}
            className="pointer-events-auto cursor-pointer flex flex-col items-center"
          >
            <div style={{ position: 'relative', width: 50, height: 50 }}>
              <motion.div
                className="absolute inset-0 rounded-full border border-amber-200/70"
                animate={{ scale: [1, 1.45, 1], opacity: [0.7, 0, 0.7] }}
                transition={{ duration: 1.9, repeat: Infinity }}
              />
              <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-sm border border-amber-100/40">
                <span className="text-xl">🕊️</span>
              </div>
            </div>
            <span className="mt-2 px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-amber-100/30 text-amber-100 text-[10px] uppercase tracking-widest">
              Tap to open
            </span>
          </button>
        </motion.div>
      )}

      {/* ── MODAL LỜI NHẮN & ẢNH ── */}
      <AnimatePresence>
        {showNote && (
          <motion.div
            className="fixed inset-0 z-300 flex items-center justify-center px-6"
            style={{ background: 'rgba(8,10,22,0.93)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowNote(false)}
          >
            <motion.div
              className="w-full max-w-sm rounded-2xl overflow-hidden flex flex-col items-center p-6 text-center"
              style={{
                background: 'linear-gradient(160deg, #3a3554 0%, #171c33 100%)',
                border: '1px solid rgba(255,214,190,0.28)',
                boxShadow: '0 24px 70px rgba(0,0,0,0.55)',
              }}
              initial={{ scale: 0.92, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {selectedImage && (
                <div className="w-36 h-48 overflow-hidden rounded-lg shadow-lg border-2 border-amber-100/30 mb-4">
                  <img src={selectedImage} alt="User Upload" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="text-[11px] font-bold uppercase tracking-[0.25em] mb-2 text-amber-200">
                Good Morning
              </div>

              <p className="text-sm text-gray-100 leading-relaxed">
                &ldquo;{customMessage}&rdquo;
              </p>

              {rawName && (
                <div className="mt-3 text-sm font-semibold text-amber-200">
                  Gửi {rawName}
                </div>
              )}

              {kiss.sender_name && (
                <div className="mt-1 text-xs opacity-70 text-white">
                  — {kiss.sender_name}
                </div>
              )}
              <div className="mt-4 text-[11px] opacity-50 text-white">Tap anywhere to close</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DailyGoodmorningReveal;

export const DailyGoodmorningConfig: TemplateConfig = {
  id: 'daily-goodmorning',
  name: 'Realistic Flying Doves Morning',
  occasionIds: ['daily'],
  emoji: '🕊️',
  description: 'Realistic flock of doves carrying photos with smooth curved flight trajectories.',
  thumbnailBg: 'linear-gradient(135deg, #cf8a7c, #0a1024)',
  Component: DailyGoodmorningReveal,
};