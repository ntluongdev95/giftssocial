'use client';

import { motion } from 'framer-motion';
import { X, Sparkles, Heart } from 'lucide-react';
import { useGiftsPopupStore } from '@/stores/giftsPopupStore';
import { SendKissModal } from '@/components/map/KissGlobe';

// Unified Gifts popup — one entry point that houses both flows:
//   • Tab "Kiss" — the SendKissModal form rendered INLINE (no extra
//     backdrop) so users pick a recipient + gift + message and hit
//     Send without ever leaving the popup.
//   • Tab "Templates" — mini cards for the Gao Gifts templates
//     (Trái Tim 3D drone show, Couple ID card). Clicking a template
//     closes the popup and opens the template's own full-screen
//     builder — the builders are too rich to embed inline.
export function GiftsPopup() {
  const isOpen = useGiftsPopupStore((s) => s.isPopupOpen);
  const activeTab = useGiftsPopupStore((s) => s.activeTab);
  const setTab = useGiftsPopupStore((s) => s.setTab);
  const closePopup = useGiftsPopupStore((s) => s.closePopup);
  const openHeartBuilder = useGiftsPopupStore((s) => s.openHeartBuilder);
  const openCoupleBuilder = useGiftsPopupStore((s) => s.openCoupleBuilder);
  const openBirthdayCapsule = useGiftsPopupStore((s) => s.openBirthdayCapsule);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center p-4"
      onClick={closePopup}
    >
      <div className="absolute inset-0 bg-black/70" />
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        className="relative w-full max-w-md rounded-2xl overflow-hidden max-h-[92vh] flex flex-col"
        style={{
          background: 'rgba(10,11,15,0.98)',
          border: '1px solid rgba(236,72,153,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent bar — colour matches the active tab so users
            see visual feedback when switching. */}
        <div
          className="h-1 w-full"
          style={{
            background:
              activeTab === 'kiss'
                ? 'linear-gradient(90deg, #f87171, #ec4899, #f87171)'
                : 'linear-gradient(90deg, #a855f7, #ec4899, #f97316)',
          }}
        />

        {/* Tabs + close button */}
        <div className="flex items-center gap-1 border-b border-white/5 pl-3 pr-2 pt-2 pb-2 shrink-0">
          <TabButton
            active={activeTab === 'kiss'}
            onClick={() => setTab('kiss')}
            icon="💋"
            label="Kiss"
            accent="#ec4899"
          />
          <TabButton
            active={activeTab === 'templates'}
            onClick={() => setTab('templates')}
            icon="🎁"
            label="Templates"
            accent="#a855f7"
          />
          <div className="flex-1" />
          <button
            onClick={closePopup}
            className="p-1.5 rounded-full hover:bg-white/5 cursor-pointer text-[#4a5068]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab content — scrollable inside the popup so the outer
            popup doesn't overflow on small screens. */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'kiss' ? (
            <SendKissModal
              inline
              hideHeader
              onClose={closePopup}
              onSent={closePopup}
            />
          ) : (
            <TemplatesGrid
              onPickHeart={openHeartBuilder}
              onPickCouple={openCoupleBuilder}
              onPickBirthday={openBirthdayCapsule}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold cursor-pointer transition-colors"
      style={{
        background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
        color: active ? '#fff' : '#6a7080',
        borderBottom: active ? `2px solid ${accent}` : '2px solid transparent',
        borderRadius: 0,
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function TemplatesGrid({
  onPickHeart,
  onPickCouple,
  onPickBirthday,
}: {
  onPickHeart: () => void;
  onPickCouple: () => void;
  onPickBirthday: () => void;
}) {
  return (
    <div className="p-5 space-y-4">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-[#a3adc3]">
          Chọn template
        </div>
        <p className="text-[11px] text-[#4a5068] mt-1">
          Template Gao Gifts — mở form full-screen để tùy chỉnh + chia sẻ link.
        </p>
      </div>

      {/* Birthday — time capsule with cinematic drone-show reveal */}
      <button
        onClick={onPickBirthday}
        className="relative w-full text-left rounded-2xl overflow-hidden cursor-pointer transition-transform hover:scale-[1.02] group"
        style={{
          background:
            'linear-gradient(135deg, #fce7f3 0%, #fef3c7 50%, #fed7aa 100%)',
          border: '1px solid rgba(251,146,60,0.35)',
        }}
      >
        {/* HAPPY BIRTHDAY pill — top-right */}
        <div
          className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{
            background: 'rgba(255,255,255,0.9)',
            color: '#f97316',
            border: '1px solid rgba(251,146,60,0.5)',
          }}
        >
          ★ Happy Birthday
        </div>
        <div className="p-4 flex items-center gap-3">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{ background: 'rgba(251,146,60,0.15)' }}
          >
            🎂
          </div>
          <div className="flex-1 min-w-0 pt-4">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="text-sm font-bold text-slate-800 truncate">
                Birthday
              </div>
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0"
                style={{
                  background: 'rgba(34,197,94,0.15)',
                  color: '#16a34a',
                  border: '1px solid rgba(34,197,94,0.3)',
                }}
              >
                Free
              </span>
            </div>
            <p className="text-[11px] text-slate-700 line-clamp-2">
              Điều ước sinh nhật — reveal bằng drone-show cinematic khi
              người nhận mở đúng ngày.
            </p>
          </div>
        </div>
      </button>

      {/* Heart 3D — drone show cinematic gift */}
      <button
        onClick={onPickHeart}
        className="w-full text-left rounded-2xl overflow-hidden cursor-pointer transition-transform hover:scale-[1.02] group"
        style={{
          background: 'radial-gradient(circle at 50% 55%, rgba(255,77,139,0.25), #000 70%)',
          border: '1px solid rgba(255,77,139,0.3)',
        }}
      >
        <div className="p-4 flex items-center gap-3">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{ background: 'rgba(255,77,139,0.15)' }}
          >
            <Heart size={28} className="text-[#ff4d8b] fill-current" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="text-sm font-bold text-white truncate">
                Web Trái Tim 3D
              </div>
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0"
                style={{
                  background: 'rgba(34,197,94,0.15)',
                  color: '#4ade80',
                  border: '1px solid rgba(34,197,94,0.3)',
                }}
              >
                Free
              </span>
            </div>
            <p className="text-[11px] text-[#a3adc3] line-clamp-2">
              Drone particles xếp thành tim + chữ + pháo hoa. Chia sẻ link
              viral.
            </p>
          </div>
        </div>
      </button>

      {/* Couple ID Card */}
      <button
        onClick={onPickCouple}
        className="w-full text-left rounded-2xl overflow-hidden cursor-pointer transition-transform hover:scale-[1.02] group"
        style={{
          background:
            'linear-gradient(135deg, #f5f7fb 0%, #ffffff 50%, #e6ecf5 100%)',
          border: '1px solid rgba(30,58,138,0.15)',
        }}
      >
        <div className="p-4 flex items-center gap-3">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{ background: 'rgba(30,58,138,0.08)' }}
          >
            💑
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="text-sm font-bold text-slate-800 truncate">
                Couple ID Card
              </div>
              <span
                className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0"
                style={{
                  background: 'rgba(34,197,94,0.15)',
                  color: '#16a34a',
                  border: '1px solid rgba(34,197,94,0.3)',
                }}
              >
                Free
              </span>
            </div>
            <p className="text-[11px] text-slate-600 line-clamp-2">
              Thẻ ID cặp đôi — tải PNG hoặc chia sẻ.
            </p>
          </div>
        </div>
      </button>

      <div className="pt-2 flex items-center justify-center gap-1.5 text-[10px] text-[#4a5068]">
        <Sparkles size={11} />
        <span>Nhiều template hơn sắp có</span>
      </div>
    </div>
  );
}
