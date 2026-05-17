'use client';

// Email-letter style detail sheet shown when a follower taps a
// "New promo" notification.
//
// Layout
//   • Mobile: stacked vertical — letter body on top, template canvas below.
//   • Desktop (lg+): two columns — letter on the left, template canvas
//     on the right, like a real piece of mail with an enclosed flyer.
//
// The letter copy reads as a proper Vietnamese business notice:
//   "Kính gửi <recipient>,
//    Sắp tới chúng tôi có chương trình <promo name> ...
//    [description]
//    Trân trọng,
//    <business name>"

import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { PromoElement } from './PromoBuilder';

interface PromoData {
  id: string;
  business_id: string;
  business_name?: string | null;
  business_cover?: string | null;
  name: string;
  description?: string;
  background_color: string;
  background_image?: string | null;
  background_gradient_to?: string | null;
  elements_json: string;
  gift_card_template_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Reference canvas width — fontSize values in PromoElement are stored
// against this width and scaled to whatever the runtime canvas measures.
const REF_W = 540;

// Elegant serif stack for the letter body — sets the "real mail" tone
// against the rest of the app's sans-serif UI.
const LETTER_FONT = 'Georgia, "Times New Roman", serif';

export default function PromoDetailSheet({
  promo,
  recipientName,
  onClose,
}: {
  promo: PromoData;
  recipientName?: string | null;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  const elements = useMemo<PromoElement[]>(() => {
    try { return JSON.parse(promo.elements_json) as PromoElement[]; } catch { return []; }
  }, [promo.elements_json]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setScale(el.getBoundingClientRect().width / REF_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const canvasBg = (() => {
    if (promo.background_image) {
      return {
        backgroundImage: `url(${promo.background_image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: promo.background_color,
      };
    }
    if (promo.background_gradient_to) {
      return { background: `linear-gradient(160deg, ${promo.background_color}, ${promo.background_gradient_to})` };
    }
    return { background: promo.background_color };
  })();

  const businessName = promo.business_name || 'Our team';
  const greeting = recipientName ? `Dear ${recipientName},` : 'Dear valued customer,';
  const sentDate = promo.created_at
    ? new Date(promo.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  // The body is whatever the merchant wrote in the editor. If they left
  // it blank, fall back to a neutral default that still references the
  // promo by name so the letter never feels empty.
  const letterBody = promo.description && promo.description.trim()
    ? promo.description
    : `We have something special coming up — “${promo.name}”. Please take a moment to look through the flyer enclosed and we hope to see you soon.`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-stretch lg:items-center justify-center lg:px-6 lg:py-8"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full lg:max-w-6xl xl:max-w-7xl flex flex-col rounded-none lg:rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #14161f 0%, #0a0b0f 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          maxHeight: '100dvh',
        }}
      >
        {/* ── Email-style header — sender + close ─────────────────────────── */}
        <div
          className="shrink-0 flex items-center gap-3 px-4 lg:px-8 py-3 lg:py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          {promo.business_cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={promo.business_cover}
              className="h-10 w-10 rounded-full object-cover shrink-0"
              alt=""
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            />
          ) : (
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center text-lg shrink-0"
              style={{ background: 'rgba(0,212,255,0.1)' }}
              aria-hidden
            >
              🎁
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#00d4ff]">From</p>
            <p className="text-sm font-bold text-white truncate">{businessName}</p>
          </div>
          {sentDate && (
            <p className="hidden sm:block text-[11px] text-[#4a5068] mr-2 whitespace-nowrap">
              {sentDate}
            </p>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-9 w-9 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/5"
          >
            <X size={16} className="text-white/70" />
          </button>
        </div>

        {/* ── Body — letter (left) + template canvas (right) ──────────────
           Single scroll container so mobile stacks naturally and desktop
           gets a paired layout. The inner two-column grid only kicks in
           at lg+ to keep the canvas readable on tablets. */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="px-4 md:px-6 lg:px-10 py-5 lg:py-10 grid gap-6 md:gap-8 lg:gap-12 md:grid-cols-[1fr_auto] md:items-start">
            {/* Letter body */}
            <div className="order-2 md:order-1 max-w-prose md:max-w-none">
              <p
                className="text-[15px] lg:text-[16px] text-[#f0f4ff] mb-4 lg:mb-6"
                style={{ fontFamily: LETTER_FONT }}
              >
                {greeting}
              </p>
              <p
                className="text-[14px] lg:text-[15px] leading-relaxed text-[#d6dbe8] whitespace-pre-wrap"
                style={{ fontFamily: LETTER_FONT }}
              >
                {letterBody}
              </p>

              <div className="mt-6 lg:mt-8 space-y-1" style={{ fontFamily: LETTER_FONT }}>
                <p className="text-[14px] text-[#a3adc3]">Best regards,</p>
                <p className="text-[15px] lg:text-[16px] font-semibold text-white">{businessName}</p>
              </div>
            </div>

            {/* Template canvas (the "enclosed flyer") */}
            <div className="order-1 md:order-2 w-full md:w-[300px] lg:w-[380px] xl:w-[440px] shrink-0">
              <p
                className="hidden md:block text-[10px] font-bold uppercase tracking-[0.18em] text-[#4a5068] mb-2"
              >
                Enclosed flyer
              </p>
              <div
                ref={canvasRef}
                className="relative w-full overflow-hidden mx-auto"
                style={{
                  aspectRatio: '9 / 16',
                  borderRadius: '20px',
                  boxShadow: '0 30px 60px -25px rgba(0,0,0,0.9)',
                  ...canvasBg,
                }}
              >
                {elements.map((el) => (
                  <ReadOnlyElement key={el.id} el={el} scale={scale} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Read-only element renderer — mirrors PromoBuilder.ElementOnCanvas ──
// but strips interaction (no drag, no resize, no outline).
function ReadOnlyElement({ el, scale }: { el: PromoElement; scale: number }) {
  const fontSize = (el.fontSize || 20) * scale;

  let inner: React.ReactNode = null;
  if (el.type === 'text') {
    inner = (
      <span
        className="leading-tight"
        style={{
          color: el.color || '#1a1a2e',
          fontWeight: el.fontWeight || 700,
          fontStyle: el.fontStyle || 'normal',
          fontSize,
          fontFamily: el.fontFamily || 'system-ui, sans-serif',
          textAlign: 'center',
          width: '100%',
          display: 'block',
        }}
      >
        {el.text || 'Text'}
      </span>
    );
  } else if (el.type === 'sticker') {
    inner = <span style={{ fontSize: fontSize * 1.6 }} aria-hidden>{el.emoji || '✨'}</span>;
  } else if (el.type === 'image' && el.src) {
    // eslint-disable-next-line @next/next/no-img-element
    inner = <img src={el.src} alt="" className="h-full w-full object-cover rounded-xl" draggable={false} />;
  } else if (el.type === 'button') {
    inner = (
      <div
        className="h-full w-full rounded-full flex items-center justify-center font-bold select-none px-3 text-center"
        style={{
          background: el.bgColor || '#c41e3a',
          color: el.color || 'white',
          fontWeight: el.fontWeight || 700,
          fontStyle: el.fontStyle || 'normal',
          fontFamily: el.fontFamily || 'system-ui, sans-serif',
          fontSize,
        }}
      >
        {el.text || 'Tap me'}
      </div>
    );
  } else if (el.type === 'giftcard') {
    inner = (
      <div
        className="h-full w-full rounded-2xl flex items-center justify-center text-white text-[12px] font-bold"
        style={{ background: 'linear-gradient(135deg, #00d4ff, #a78bfa)', boxShadow: '0 12px 24px -10px rgba(0,212,255,0.6)' }}
      >
        🎁 Gift card
      </div>
    );
  }

  if (!inner) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${el.x}%`,
        top: `${el.y}%`,
        width: `${el.w}%`,
        height: `${el.h}%`,
        transform: `rotate(${el.rotation || 0}deg)`,
        zIndex: (el.z || 0) + 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {inner}
    </div>
  );
}
