// 'use client';

// // Good Night · City Bedtime — 4-phase interactive lullaby (Enhanced WOW Edition).
// // ─────────────────────────────────────────────────────────────────────

// import { useMemo, useState, useEffect, useCallback } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import { playMessageChime, playHeartbeat, playCelebration } from '@/lib/kiss-audio';
// import { getKissString, parseKissData } from '../_shared/useTemplateData';
// import type { TemplateProps, TemplateConfig } from '../_types';

// // ─── Palette Neon & Midnight ─────────────────────────────────────────
// const MOON_CORE    = '#FFFBEB';
// const MOON_GLOW    = '#FCD34D';
// const WINDOW_ON    = '#FDE047';    // Bright neon yellow
// const WINDOW_DIM   = '#1E293B';    // Asleep dark slate
// const BUILDING_A   = '#0F172A';
// const BUILDING_B   = '#020617';
// const SPECIAL_WARM = '#F59E0B';
// const HEART        = '#F43F5E';
// const ACCENT_HOT   = '#F472B6';

// const NUM_BUILDINGS = 12;

// type Building = {
//   id: number;
//   x: number;
//   y: number;
//   w: number;
//   h: number;
//   color: string;
//   windowCols: number;
//   windowRows: number;
//   row: 'back' | 'front';
// };

// function buildCity(count: number, isNarrow: boolean): Building[] {
//   const out: Building[] = [];
//   for (let i = 0; i < count; i++) {
//     const s = ((i + 1) * 2654435761) >>> 0;
//     const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
//     const isBack = i % 2 === 0;
//     const row: 'back' | 'front' = isBack ? 'back' : 'front';
//     const halfCount = count / 2;
//     const idxInRow = Math.floor(i / 2);
//     const xBase = ((idxInRow + 0.5) / halfCount) * 100;
//     const x = xBase + (r(1) - 0.5) * 6;
//     const wBase = isNarrow ? 44 : 72;
//     const hBase = isNarrow ? 95 : 150;
//     const w = wBase + r(2) * (isNarrow ? 26 : 40);
//     const h = hBase + r(3) * (isNarrow ? 65 : 100);
//     const y = row === 'front' ? 8 + r(4) * 6 : 20 + r(5) * 8;
//     const color = i % 3 === 0 ? BUILDING_B : BUILDING_A;
//     const windowCols = 3 + Math.floor(r(6) * 2);
//     const windowRows = 4 + Math.floor(r(7) * 4);
//     out.push({ id: i, x, y, w, h, color, windowCols, windowRows, row });
//   }
//   return out;
// }

// // ─────────────────────────────────────────────────────────────────────
// // Tòa nhà thông thường với hiệu ứng tắt đèn & vòng sóng ngủ (Snore Ring)
// // ─────────────────────────────────────────────────────────────────────
// function BuildingCard({
//   b,
//   lit,
//   onSleep,
// }: {
//   b: Building;
//   lit: boolean;
//   onSleep: () => void;
// }) {
//   const [pressed, setPressed] = useState(false);
//   const [snoreOn, setSnoreOn] = useState(false);

//   const handleClick = () => {
//     if (!lit || pressed) return;
//     setPressed(true);
//     setSnoreOn(true);
//     setTimeout(() => setSnoreOn(false), 2200);
//     onSleep();
//   };

//   const cellPad = 4;
//   const cellH = (b.h - cellPad * 2 - 12) / b.windowRows;

//   return (
//     <motion.div
//       className={lit ? 'absolute cursor-pointer group select-none' : 'absolute pointer-events-none select-none'}
//       onClick={handleClick}
//       style={{
//         left: `${b.x}vw`,
//         bottom: `${b.y}vh`,
//         width: b.w,
//         height: b.h,
//         transform: 'translateX(-50%)',
//         transformOrigin: 'bottom center',
//         touchAction: 'manipulation',
//       }}
//       animate={{
//         rotate: lit ? 0 : b.id % 2 === 0 ? -5 : 5,
//         y: lit ? 0 : 6,
//         scale: lit ? 1 : 0.98,
//       }}
//       whileHover={lit ? { scale: 1.04, y: -4 } : {}}
//       transition={{ duration: 0.8, delay: lit ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
//     >
//       {/* Khung tòa nhà + Ánh sáng Glow */}
//       <div
//         style={{
//           position: 'absolute',
//           inset: 0,
//           background: `linear-gradient(180deg, ${b.color} 0%, #030712 100%)`,
//           borderRadius: 6,
//           border: '1px solid rgba(255,255,255,0.08)',
//           boxShadow: lit
//             ? `0 10px 30px rgba(0,0,0,0.8), 0 0 20px ${WINDOW_ON}22`
//             : `0 4px 12px rgba(0,0,0,0.7)`,
//           transition: 'box-shadow 1s ease-out, border 1s ease-out',
//         }}
//       />

//       {/* Mái nhà */}
//       <div
//         style={{
//           position: 'absolute',
//           left: '20%',
//           right: '20%',
//           top: -6,
//           height: 8,
//           background: b.color,
//           borderRadius: '4px 4px 0 0',
//           borderTop: '1px solid rgba(255,255,255,0.15)',
//         }}
//       />

//       {/* Lưới cửa sổ */}
//       <div
//         style={{
//           position: 'absolute',
//           left: cellPad,
//           right: cellPad,
//           top: cellPad + 8,
//           bottom: cellPad,
//           display: 'grid',
//           gridTemplateColumns: `repeat(${b.windowCols}, 1fr)`,
//           gap: 3,
//         }}
//       >
//         {Array.from({ length: b.windowCols * b.windowRows }).map((_, i) => (
//           <motion.div
//             key={i}
//             style={{
//               width: '100%',
//               height: cellH - 2,
//               borderRadius: 2,
//               background: lit ? WINDOW_ON : WINDOW_DIM,
//               boxShadow: lit ? `0 0 8px ${WINDOW_ON}aa` : 'none',
//             }}
//             animate={
//               !lit && pressed
//                 ? {
//                     backgroundColor: [WINDOW_ON, WINDOW_DIM, WINDOW_ON, WINDOW_DIM, WINDOW_DIM],
//                     boxShadow: [
//                       `0 0 10px ${WINDOW_ON}`,
//                       'none',
//                       `0 0 10px ${WINDOW_ON}`,
//                       'none',
//                       'none',
//                     ],
//                   }
//                 : {}
//             }
//             transition={{
//               duration: 0.6,
//               times: [0, 0.25, 0.5, 0.75, 1],
//               delay: (i % 5) * 0.02,
//             }}
//           />
//         ))}
//       </div>

//       {/* Vòng sóng Snore khi ngủ */}
//       <AnimatePresence>
//         {snoreOn && (
//           <motion.div
//             className="absolute pointer-events-none"
//             style={{
//               inset: -14,
//               borderRadius: 12,
//               border: `2px solid ${MOON_GLOW}`,
//               boxShadow: `0 0 20px ${MOON_GLOW}, inset 0 0 15px ${MOON_GLOW}44`,
//             }}
//             initial={{ opacity: 0, scale: 0.85 }}
//             animate={{ opacity: [0, 0.9, 0, 0.9, 0], scale: [0.85, 1.2, 1.05, 1.25, 1.35] }}
//             exit={{ opacity: 0 }}
//             transition={{ duration: 2.0, times: [0, 0.2, 0.4, 0.6, 1] }}
//           />
//         )}
//       </AnimatePresence>
//     </motion.div>
//   );
// }

// // ─────────────────────────────────────────────────────────────────────
// // Tòa nhà Đặc Biệt — Có ảnh người gửi & Trái tim ấm áp
// // ─────────────────────────────────────────────────────────────────────
// function SpecialBuilding({
//   photoUrl,
//   tappable,
//   onTap,
//   revealed,
// }: {
//   photoUrl?: string;
//   tappable: boolean;
//   onTap: () => void;
//   revealed: boolean;
// }) {
//   return (
//     <motion.div
//       className={tappable ? 'absolute cursor-pointer z-20' : 'absolute pointer-events-none z-20'}
//       onClick={tappable ? onTap : undefined}
//       style={{
//         left: '82%',
//         bottom: '12vh',
//         width: 96,
//         height: 150,
//         transform: 'translateX(-50%)',
//         touchAction: 'manipulation',
//       }}
//       animate={tappable && !revealed ? { scale: [1, 1.05, 1] } : { scale: 1 }}
//       transition={
//         tappable && !revealed
//           ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
//           : { duration: 0.5 }
//       }
//     >
//       {/* Vệt hào quang ấm áp bao quanh */}
//       <motion.div
//         className="absolute pointer-events-none"
//         style={{
//           inset: '-60%',
//           borderRadius: '50%',
//           background: `radial-gradient(circle, ${SPECIAL_WARM}88 0%, ${MOON_GLOW}33 45%, transparent 75%)`,
//           filter: 'blur(25px)',
//         }}
//         animate={{ opacity: revealed ? 1 : tappable ? [0.6, 1, 0.6] : 0.3 }}
//         transition={{ duration: 1.5, repeat: tappable && !revealed ? Infinity : 0, ease: 'easeInOut' }}
//       />

//       {/* Thân tòa nhà */}
//       <div
//         style={{
//           position: 'absolute',
//           inset: 0,
//           background: 'linear-gradient(180deg, #451a03 0%, #180e04 100%)',
//           borderRadius: 6,
//           border: `2px solid ${SPECIAL_WARM}`,
//           boxShadow: `0 10px 30px rgba(0,0,0,0.9), 0 0 30px ${SPECIAL_WARM}88`,
//         }}
//       />

//       {/* Mái nhà */}
//       <div
//         style={{
//           position: 'absolute',
//           left: '15%',
//           right: '15%',
//           top: -10,
//           height: 12,
//           background: '#78350f',
//           borderRadius: '6px 6px 0 0',
//           borderTop: `1px solid ${SPECIAL_WARM}`,
//         }}
//       />

//       {/* Cửa sổ hiển thị bức ảnh */}
//       <div
//         style={{
//           position: 'absolute',
//           left: '14%',
//           right: '14%',
//           top: 16,
//           height: 64,
//           background: revealed ? '#fff' : `linear-gradient(180deg, ${WINDOW_ON}, ${SPECIAL_WARM})`,
//           borderRadius: 4,
//           boxShadow: `inset 0 0 6px rgba(0,0,0,0.5), 0 0 16px ${WINDOW_ON}`,
//           overflow: 'hidden',
//           transition: 'background 0.8s ease-in-out',
//         }}
//       >
//         {revealed && photoUrl && (
//           <motion.img
//             src={photoUrl}
//             alt="Warm memory"
//             style={{
//               width: '100%',
//               height: '100%',
//               objectFit: 'cover',
//               display: 'block',
//               pointerEvents: 'none',
//             }}
//             initial={{ opacity: 0, scale: 1.25 }}
//             animate={{ opacity: 1, scale: 1 }}
//             transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
//           />
//         )}
//         {/* Khung ô cửa kính */}
//         <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
//           <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1.5, background: '#451a03', opacity: 0.6 }} />
//           <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1.5, background: '#451a03', opacity: 0.6 }} />
//         </div>
//       </div>

//       {/* Cửa sổ nhỏ phía dưới */}
//       <div
//         style={{
//           position: 'absolute',
//           left: '22%',
//           right: '22%',
//           top: 90,
//           height: 42,
//           display: 'grid',
//           gridTemplateColumns: 'repeat(2, 1fr)',
//           gridTemplateRows: 'repeat(2, 1fr)',
//           gap: 3,
//         }}
//       >
//         {[0, 1, 2, 3].map(i => (
//           <div
//             key={i}
//             style={{
//               background: WINDOW_ON,
//               borderRadius: 2,
//               boxShadow: `0 0 6px ${WINDOW_ON}`,
//             }}
//           />
//         ))}
//       </div>
//     </motion.div>
//   );
// }

// // ─────────────────────────────────────────────────────────────────────
// // Main Component Reveal
// // ─────────────────────────────────────────────────────────────────────
// function DailyGoodnight2Reveal({ kiss, onClose }: TemplateProps) {
//   const rawName = (getKissString(kiss, 'name') || kiss.receiver_name || 'em').trim();
//   const displayName = rawName || 'em';

//   const photoUrl = (() => {
//     const raw = parseKissData(kiss).photos;
//     if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') return raw[0];
//     return getKissString(kiss, 'photo');
//   })();

//   const [isNarrow, setIsNarrow] = useState(false);
//   useEffect(() => {
//     if (typeof window === 'undefined') return;
//     setIsNarrow(window.innerWidth < 720);
//     const on = () => setIsNarrow(window.innerWidth < 720);
//     window.addEventListener('resize', on);
//     return () => window.removeEventListener('resize', on);
//   }, []);

//   const buildings = useMemo(() => buildCity(NUM_BUILDINGS, isNarrow), [isNarrow]);

//   const [asleep, setAsleep] = useState<Set<number>>(new Set());
//   const litCount = buildings.length - asleep.size;
//   const allAsleep = litCount === 0;

//   const [specialRevealed, setSpecialRevealed] = useState(false);
//   const [showSleepBtn, setShowSleepBtn] = useState(false);
//   const [phase4, setPhase4] = useState(false);
//   const [finalFade, setFinalFade] = useState(false);

//   const sleepBuilding = useCallback((id: number) => {
//     setAsleep(prev => {
//       const next = new Set(prev);
//       next.add(id);
//       return next;
//     });
//     playMessageChime();
//   }, []);

//   const tapSpecial = useCallback(() => {
//     if (specialRevealed) return;
//     setSpecialRevealed(true);
//     playHeartbeat();
//     setTimeout(() => setShowSleepBtn(true), 5000);
//   }, [specialRevealed]);

//   const clickSleepBtn = useCallback(() => {
//     setPhase4(true);
//     playCelebration();
//     setTimeout(() => setFinalFade(true), 3500);
//     setTimeout(() => onClose(), 8500);
//   }, [onClose]);

//   // Ngôi sao lấp lánh bầu trời
//   const stars = useMemo(
//     () =>
//       Array.from({ length: 150 }).map((_, i) => {
//         const s = (i * 2654435761) >>> 0;
//         const r = (n: number) => (((s ^ (n * 0x9E3779B1)) >>> 0) % 10000) / 10000;
//         const tier = i % 8 === 0 ? 'bright' : i % 3 === 0 ? 'mid' : 'faint';
//         return {
//           left: r(1) * 100,
//           top: r(2) * 60,
//           size: tier === 'bright' ? 2.0 : tier === 'mid' ? 1.2 : 0.7,
//           delay: r(3) * 5,
//           dur: 3 + r(4) * 4,
//           alpha: tier === 'bright' ? 1 : tier === 'mid' ? 0.75 : 0.4,
//         };
//       }),
//     []
//   );

//   return (
//     <div
//       className="fixed inset-0 z-[200] overflow-hidden select-none"
//       style={{
//         background: 'radial-gradient(ellipse at 50% 10%, #1e1b4b 0%, #0f172a 50%, #020617 100%)',
//       }}
//     >
//       {/* Nền Đen Mờ Cuối Cùng */}
//       <motion.div
//         className="absolute inset-0 pointer-events-none"
//         style={{ background: '#000', zIndex: 40 }}
//         initial={{ opacity: 0 }}
//         animate={{ opacity: finalFade ? 0.92 : 0 }}
//         transition={{ duration: 2.2 }}
//       />

//       {/* Các Ngôi Sao */}
//       {stars.map((st, i) => (
//         <motion.div
//           key={`star-${i}`}
//           className="absolute rounded-full pointer-events-none"
//           style={{
//             left: `${st.left}%`,
//             top: `${st.top}%`,
//             width: st.size,
//             height: st.size,
//             background: '#fff',
//             boxShadow: st.size > 1.5 ? `0 0 10px rgba(255,255,255,0.9)` : 'none',
//           }}
//           initial={{ opacity: 0 }}
//           animate={{ opacity: [st.alpha * 0.3, st.alpha, st.alpha * 0.3] }}
//           transition={{ duration: st.dur, delay: st.delay, repeat: Infinity, ease: 'easeInOut' }}
//         />
//       ))}

//       {/* Mặt Trăng 3D Phát Sáng */}
//       <motion.div
//         className="absolute pointer-events-none z-50"
//         style={{
//           right: '8%',
//           top: '7%',
//           width: 'clamp(80px, 11vw, 130px)',
//           height: 'clamp(80px, 11vw, 130px)',
//           borderRadius: '50%',
//           background: `radial-gradient(circle at 35% 35%, ${MOON_CORE} 0%, ${MOON_GLOW} 100%)`,
//           boxShadow: `0 0 50px ${MOON_CORE}aa, 0 0 100px ${MOON_GLOW}66`,
//         }}
//         initial={{ opacity: 0, scale: 0.6 }}
//         animate={{ opacity: 1, scale: finalFade ? 1.25 : 1 }}
//         transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
//       />

//       {/* Dải bóng chân thành phố */}
//       <div
//         className="absolute inset-x-0 bottom-0 pointer-events-none z-[1]"
//         style={{
//           height: '40%',
//           background: 'linear-gradient(180deg, transparent 0%, rgba(2,6,23,0.8) 60%, #020617 100%)',
//         }}
//       />

//       {/* Các Tòa Nhà Thông Thường */}
//       <div className="absolute inset-0 z-[5]">
//         {buildings.map(b => (
//           <BuildingCard
//             key={b.id}
//             b={b}
//             lit={!asleep.has(b.id)}
//             onSleep={() => sleepBuilding(b.id)}
//           />
//         ))}
//       </div>

//       {/* Tòa Nhà Đặc Biệt */}
//       <div className="absolute inset-0 z-[6]">
//         <SpecialBuilding
//           photoUrl={photoUrl}
//           tappable={allAsleep && !specialRevealed}
//           revealed={specialRevealed}
//           onTap={tapSpecial}
//         />
//       </div>

//       {/* Lời Dẫn Lời Thoại Ban Đầu */}
//       <motion.div
//         className="absolute pointer-events-none px-6 z-10"
//         style={{ top: '6%', left: '5%', maxWidth: '60vw' }}
//         initial={{ opacity: 0, y: -10 }}
//         animate={{ opacity: [0, 1, 1, 0], y: 0 }}
//         transition={{ duration: 8, times: [0, 0.1, 0.85, 1], delay: 0.5 }}
//       >
//         <div
//           style={{
//             fontFamily: '"Dancing Script", cursive',
//             fontStyle: 'italic',
//             fontSize: 'clamp(18px, 2.8vw, 26px)',
//             color: '#F8FAFC',
//             lineHeight: 1.4,
//             textShadow: '0 4px 20px rgba(0,0,0,0.9), 0 0 10px rgba(255,255,255,0.3)',
//           }}
//         >
//           Thành phố hôm nay có vẻ ồn ào quá...<br />
//           Có lẽ họ đang chờ ai đó dỗ họ ngủ...
//         </div>
//       </motion.div>

//       {/* Gợi Ý Chạm Bằng Glassmorphism */}
//       {litCount === buildings.length && (
//         <motion.div
//           className="absolute inset-x-0 pointer-events-none text-center z-10"
//           style={{ top: '48%' }}
//           initial={{ opacity: 0 }}
//           animate={{ opacity: [0, 0.9, 0.4, 0.9] }}
//           transition={{ duration: 2.5, delay: 8.5, repeat: Infinity, ease: 'easeInOut' }}
//         >
//           <div
//             style={{
//               display: 'inline-block',
//               padding: '8px 20px',
//               borderRadius: 999,
//               background: 'rgba(15, 23, 42, 0.65)',
//               border: `1px solid ${WINDOW_ON}66`,
//               fontFamily: '"Dancing Script", cursive',
//               fontSize: 'clamp(15px, 2.2vw, 20px)',
//               color: '#FFF',
//               backdropFilter: 'blur(12px)',
//               boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 15px ${WINDOW_ON}33`,
//             }}
//           >
//             Chạm vào từng tòa nhà để dỗ họ ngủ 💫
//           </div>
//         </motion.div>
//       )}

//       {/* Bảng Đếm Số Tòa Nhà (Neon Counter) */}
//       {!specialRevealed && (
//         <motion.div
//           className="absolute inset-x-0 pointer-events-none text-center z-10"
//           style={{ top: '3%' }}
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           transition={{ duration: 0.8, delay: 7.5 }}
//         >
//           <div
//             style={{
//               display: 'inline-block',
//               padding: '6px 18px',
//               borderRadius: 999,
//               background: 'rgba(2, 6, 23, 0.75)',
//               border: `1px solid ${WINDOW_ON}44`,
//               fontFamily: 'system-ui, -apple-system, sans-serif',
//               fontWeight: 600,
//               fontSize: 14,
//               letterSpacing: 1.2,
//               color: '#FDE047',
//               backdropFilter: 'blur(10px)',
//               boxShadow: `0 4px 15px rgba(0,0,0,0.5), 0 0 12px ${WINDOW_ON}22`,
//             }}
//           >
//             💡 CÒN {litCount} / {buildings.length} TÒA NHÀ ĐANG THỨC
//           </div>
//         </motion.div>
//       )}

//       {/* Thông Điệp Ngọt Ngào & Trái Tim Bay */}
//       <AnimatePresence>
//         {specialRevealed && !phase4 && (
//           <>
//             <motion.div
//               key="special-msg"
//               className="absolute pointer-events-none px-6 z-15"
//               style={{ right: '5%', bottom: '34vh', maxWidth: '58vw' }}
//               initial={{ opacity: 0, x: 25 }}
//               animate={{ opacity: 1, x: 0 }}
//               exit={{ opacity: 0 }}
//               transition={{ duration: 1.4, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
//             >
//               <div
//                 style={{
//                   fontFamily: '"Dancing Script", cursive',
//                   fontStyle: 'italic',
//                   fontSize: 'clamp(18px, 2.8vw, 26px)',
//                   color: '#FFF',
//                   lineHeight: 1.4,
//                   textShadow: `0 4px 20px rgba(0,0,0,0.9), 0 0 20px ${SPECIAL_WARM}aa`,
//                   textAlign: 'right',
//                 }}
//               >
//                 Thành phố đã ngủ rồi.<br />
//                 Chỉ còn mình anh thức để chờ {displayName} ngủ thôi.<br />
//                 Ngủ ngon nhé 💛
//               </div>
//               {kiss.message && (
//                 <motion.div
//                   initial={{ opacity: 0 }}
//                   animate={{ opacity: 0.95 }}
//                   transition={{ duration: 0.8, delay: 2.6 }}
//                   style={{
//                     marginTop: 12,
//                     fontFamily: '"Dancing Script", cursive',
//                     fontSize: 'clamp(14px, 2.2vw, 20px)',
//                     color: ACCENT_HOT,
//                     fontStyle: 'italic',
//                     textAlign: 'right',
//                   }}
//                 >
//                   &ldquo;{kiss.message}&rdquo;
//                 </motion.div>
//               )}
//               {kiss.sender_name && (
//                 <motion.div
//                   initial={{ opacity: 0 }}
//                   animate={{ opacity: 0.9 }}
//                   transition={{ duration: 0.6, delay: 3.2 }}
//                   style={{
//                     marginTop: 6,
//                     fontFamily: '"Dancing Script", cursive',
//                     fontSize: 15,
//                     color: SPECIAL_WARM,
//                     textAlign: 'right',
//                   }}
//                 >
//                   — {kiss.sender_name}
//                 </motion.div>
//               )}
//             </motion.div>

//             {/* Trái tim nổi lên và nhịp đập */}
//             <motion.div
//               key="rise-heart"
//               className="absolute pointer-events-none z-20"
//               style={{ left: '82%', bottom: '28vh', transform: 'translateX(-50%)' }}
//               initial={{ opacity: 0, y: 0, scale: 0.5 }}
//               animate={{
//                 opacity: [0, 1, 1, 1, 0],
//                 y: [0, -70, -200, -300, -400],
//                 scale: [0.5, 1.2, 1.0, 1.2, 0.8],
//               }}
//               transition={{ duration: 4.8, delay: 1.4, times: [0, 0.15, 0.5, 0.8, 1], ease: 'easeOut' }}
//             >
//               <motion.div
//                 animate={{ scale: [1, 1.25, 1, 1.2, 1] }}
//                 transition={{ duration: 0.85, delay: 2.2, repeat: 3, ease: 'easeInOut' }}
//               >
//                 <svg
//                   viewBox="0 0 20 20"
//                   width={48}
//                   height={48}
//                   style={{
//                     filter: `drop-shadow(0 0 15px ${HEART}) drop-shadow(0 0 30px ${ACCENT_HOT})`,
//                   }}
//                 >
//                   <path
//                     d="M 10 18 C 4 13, 1 9, 1 6 C 1 3, 3 1, 6 1 C 8 1, 9 2, 10 4 C 11 2, 12 1, 14 1 C 17 1, 19 3, 19 6 C 19 9, 16 13, 10 18 Z"
//                     fill={HEART}
//                   />
//                 </svg>
//               </motion.div>
//             </motion.div>
//           </>
//         )}
//       </AnimatePresence>

//       {/* Nút Tương Tác Cuối Cùng */}
//       <AnimatePresence>
//         {showSleepBtn && !phase4 && (
//           <motion.button
//             key="sleep-btn"
//             onClick={clickSleepBtn}
//             initial={{ opacity: 0, y: 30, scale: 0.85 }}
//             animate={{ opacity: 1, y: 0, scale: 1 }}
//             exit={{ opacity: 0, y: -10 }}
//             transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
//             className="absolute left-1/2 -translate-x-1/2 cursor-pointer rounded-full px-8 py-3.5 z-30"
//             style={{
//               bottom: '6%',
//               background: `linear-gradient(135deg, ${SPECIAL_WARM}, ${MOON_GLOW})`,
//               border: `1.5px solid ${MOON_CORE}`,
//               color: '#291003',
//               fontFamily: '"Dancing Script", cursive',
//               fontSize: 'clamp(18px, 2.6vw, 24px)',
//               fontWeight: 700,
//               boxShadow: `0 10px 30px rgba(0,0,0,0.8), 0 0 30px ${MOON_GLOW}aa`,
//               touchAction: 'manipulation',
//             }}
//             whileHover={{ scale: 1.06, boxShadow: `0 12px 35px rgba(0,0,0,0.9), 0 0 40px ${MOON_GLOW}` }}
//             whileTap={{ scale: 0.94 }}
//           >
//             Đã ngủ chưa? 💤
//           </motion.button>
//         )}
//       </AnimatePresence>

//       {/* Thông Điệp Chúc Ngủ Ngon Cuối Cùng */}
//       <AnimatePresence>
//         {phase4 && (
//           <motion.div
//             key="final-msg"
//             className="absolute inset-0 flex items-center justify-center pointer-events-none px-8 text-center z-60"
//             initial={{ opacity: 0 }}
//             animate={{ opacity: 1 }}
//             transition={{ duration: 1.8, delay: 0.6 }}
//           >
//             <div>
//               <div
//                 style={{
//                   fontFamily: '"Dancing Script", cursive',
//                   fontStyle: 'italic',
//                   fontSize: 'clamp(22px, 3.8vw, 36px)',
//                   color: '#FFF',
//                   lineHeight: 1.6,
//                   textShadow: `0 4px 20px rgba(0,0,0,0.9), 0 0 30px ${MOON_CORE}66`,
//                   maxWidth: '88vw',
//                 }}
//               >
//                 Cảm ơn {displayName} đã dỗ thành phố ngủ.<br />
//                 <span style={{ color: MOON_CORE }}>{displayName} cũng ngủ đi nhé.</span><br />
//                 <span style={{ color: ACCENT_HOT, fontSize: '0.88em' }}>
//                   Ngày mai mình sẽ đánh thức {displayName} dậy 💛
//                 </span>
//               </div>
//             </div>
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </div>
//   );
// }

// export default DailyGoodnight2Reveal;

// export const DailyGoodnight2Config: TemplateConfig = {
//   id: 'daily-goodnight-2',
//   name: 'Good Night · Thành Phố Ngủ',
//   occasionIds: ['daily'],
//   emoji: '🏙️',
//   description:
//     'Nhìn thành phố từ trên cao rực rỡ đèn — chạm từng tòa nhà để dỗ họ ngủ. Khi tất cả đã im tiếng, một ngôi nhà nhỏ ấm áp còn sáng để chờ bạn.',
//   thumbnailBg: 'linear-gradient(135deg, #0b0a1e, #f59e0b, #fef08a)',
//   Component: DailyGoodnight2Reveal,
// };

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Bạn có thể tùy chỉnh dữ liệu cá nhân hóa ở đây
interface HealingProps {
  receiverName?: string;
  senderName?: string;
  message?: string;
  photoUrl?: string;
  onClose?: () => void;
}

export default function HealingScratchReveal({
  receiverName = 'Em',
  senderName = 'Anh',
  message = 'Cảm ơn em vì đã cố gắng rất nhiều trong ngày hôm nay. Mọi mệt mỏi dừng lại sau màn hình này nhé!',
  photoUrl = 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=1000&auto=format&fit=crop', // Ảnh kỷ niệm mặc định
  onClose,
}: HealingProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCleared, setIsCleared] = useState(false);
  const [scratchedPercent, setScratchedPercent] = useState(0);
  const [hasHugged, setHasHugged] = useState(false);
  const isDrawing = useRef(false);

  // 1. Khởi tạo Canvas phủ lớp mây mù / hơi sương
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Đặt kích thước Canvas theo màn hình
    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Vẽ lớp phủ hơi sương / mây mù màu xám đục
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Thêm hiệu ứng hạt bụi sương
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      for (let i = 0; i < 500; i++) {
        ctx.beginPath();
        ctx.arc(
          Math.random() * canvas.width,
          Math.random() * canvas.height,
          Math.random() * 3 + 1,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // Viết chữ hướng dẫn lên Canvas
      ctx.font = 'italic 20px "Dancing Script", cursive, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(
        'Dùng ngón tay lau sạch đám mây mệt mỏi...',
        canvas.width / 2,
        canvas.height / 2
      );
    };

    setCanvasSize();
  }, []);

  // 2. Tính toán phần trăm diện tích đã cào sạch
  const checkScratchPercentage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || isCleared) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let transparentPixels = 0;

    // Kiểm tra kênh Alpha (độ trong suốt)
    for (let i = 3; i < pixels.length; i += 16) { // Kiểm tra cách 4 pixel để tối ưu hiệu năng
      if (pixels[i] === 0) {
        transparentPixels++;
      }
    }

    const totalCheckPixels = pixels.length / 16;
    const percent = Math.round((transparentPixels / totalCheckPixels) * 100);
    setScratchedPercent(percent);

    // Khi xóa sạch > 45%, tự động làm sạch toàn bộ màn hình
    if (percent > 45) {
      setIsCleared(true);
    }
  }, [isCleared]);

  // 3. Xử lý sự kiện vuốt/cào Canvas (Hỗ trợ cả Touch & Mouse)
  const scratch = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || isCleared) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'destination-out'; // Tạo nét cào trong suốt
    ctx.beginPath();
    ctx.arc(clientX, clientY, 38, 0, Math.PI * 2); // Bán kính nét cào
    ctx.fill();

    // Rung nhẹ điện thoại khi cào (nếu thiết bị hỗ trợ)
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(8);
    }

    checkScratchPercentage();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      scratch(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing.current) return;
    scratch(e.clientX, e.clientY);
  };

  // 4. Xử lý khi nhấn nút "Nhận cái ôm từ xa" (Hiệu ứng nhịp tim)
  const handleHug = () => {
    setHasHugged(true);
    // Rung điện thoại theo nhịp tim: Bập... bập... (200ms rung, 100ms nghỉ, 300ms rung)
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 300]);
    }
    setTimeout(() => setHasHugged(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden select-none bg-slate-950 font-sans">
      {/* ── BACKGROUND KHI DÃ XÓA MÂY (Giao diện chính ấm áp) ── */}
      <div className="absolute inset-0 flex flex-col items-center justify-between p-6 bg-radial from-slate-900 via-indigo-950 to-slate-950 text-white">
        
        {/* Tiêu đề & Ánh sao */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mt-6"
        >
          <span className="text-xs tracking-widest text-amber-300/80 uppercase">
            Liệu trình chữa lành đêm nay
          </span>
          <h1 className="text-2xl font-bold text-amber-100 mt-1">
            Ngủ ngon nhé, {receiverName} 🌙
          </h1>
        </motion.div>

        {/* Khung Ảnh & Dòng Thư Cảm Xúc */}
        <motion.div 
          className="w-full max-w-sm bg-slate-900/80 border border-amber-500/20 backdrop-blur-md rounded-2xl p-5 text-center shadow-2xl shadow-indigo-950/50"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: isCleared ? 1 : 0.9, opacity: isCleared ? 1 : 0.5 }}
          transition={{ duration: 0.8 }}
        >
          {/* Ảnh cá nhân */}
          <div className="relative w-full h-48 rounded-xl overflow-hidden mb-4 border border-white/10">
            <img 
              src={photoUrl} 
              alt="Memory" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
          </div>

          {/* Lời nhắn chân thành */}
          <p className="text-slate-200 text-sm leading-relaxed italic font-serif">
            "{message}"
          </p>

          {/* Tên người gửi */}
          <div className="mt-4 text-right text-xs font-semibold text-amber-400">
            — {senderName} 💛
          </div>
        </motion.div>

        {/* Nút bấm "Nhận cái ôm từ xa" */}
        <div className="w-full max-w-sm mb-6 text-center">
          <motion.button
            onClick={handleHug}
            whileTap={{ scale: 0.92 }}
            className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-bold text-base shadow-lg shadow-rose-500/25 border border-amber-300/30 flex items-center justify-center gap-2"
          >
            {hasHugged ? '🫂 Đang ôm em thật chặt...' : '🫂 Nhận một cái ôm từ xa'}
          </motion.button>
          
          {onClose && (
            <button 
              onClick={onClose}
              className="mt-3 text-xs text-slate-400 underline hover:text-white transition-colors"
            >
              Khép lại đêm nay
            </button>
          )}
        </div>
      </div>

      {/* ── LỚP CANVAS XÓA MỆT MỎI (Phủ lên trên cùng) ── */}
      <AnimatePresence>
        {!isCleared && (
          <motion.canvas
            ref={canvasRef}
            exit={{ opacity: 0, transition: { duration: 1.2 } }}
            className="absolute inset-0 z-50 touch-none cursor-pointer"
            onTouchStart={() => (isDrawing.current = true)}
            onTouchEnd={() => (isDrawing.current = false)}
            onTouchMove={handleTouchMove}
            onMouseDown={(e) => {
              isDrawing.current = true;
              scratch(e.clientX, e.clientY);
            }}
            onMouseUp={() => (isDrawing.current = false)}
            onMouseMove={handleMouseMove}
          />
        )}
      </AnimatePresence>

      {/* Thanh tiến trình cào nhỏ gọn góc trên màn hình */}
      {!isCleared && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none bg-slate-900/80 px-4 py-1.5 rounded-full border border-white/10 backdrop-blur-sm text-xs text-slate-300">
          Đã xóa: <span className="text-amber-400 font-bold">{scratchedPercent}%</span> muộn phiền
        </div>
      )}
    </div>
  );
}