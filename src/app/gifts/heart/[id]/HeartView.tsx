'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Heart, Share2, Sparkles, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { SkyWatcherSilhouette } from '@/components/gifts/SkyWatcherSilhouette';
import { CinematicVignette } from '@/components/gifts/CinematicVignette';
import { ShootingStars } from '@/components/gifts/ShootingStars';
import { NightSkyBackdrop } from '@/components/gifts/NightSkyBackdrop';

// Reuse the same Three.js drone-show engine that powers the birthday
// capsule reveal. Dynamic-import + ssr:false because it drives WebGL.
const JourneyDroneShow = dynamic(
  () =>
    import('@/components/capsules/journey/JourneyDroneShow').then(
      (m) => m.JourneyDroneShow,
    ),
  { ssr: false },
);

// Per-stage palettes — colours interpolate between adjacent stages so
// the sky's emotional tone flows through the show:
//   scatter/reveal → romantic warm pinks
//   text intros    → warm pinks (introductory)
//   countdown 3-2-1→ gold accent (anticipation)
//   heart + photo  → deep romantic rose
//   shells         → bright white (about to burst)
//   fireworks      → full rainbow (climax)
//   dissolve       → soft pastel fade
//   approach       → sunset amber (reunion beat)
//   hug            → warm rose (finale)
const P_ROMANTIC = ['#ff4488', '#ff77aa', '#ffaacc', '#ff5588', '#ff88bb'];
const P_GOLD_ACCENT = ['#ffd644', '#ffcd00', '#ffe088', '#ff9966'];
const P_HEART_MOMENT = ['#ff3366', '#ff5588', '#ff77aa', '#ffaadd', '#ff88bb'];
const P_SHELLS_BRIGHT = ['#ffffff', '#fff2cc', '#ffe088', '#ffffff'];
const P_FIREWORKS_RAINBOW = [
  '#ff4488', '#ff3344', '#ffaa22',
  '#22ee88', '#22aaff', '#bb66ff', '#ffffff',
];
const P_PASTEL_FADE = ['#ffbbcc', '#ffddaa', '#ccddff', '#e8b3d9'];
const P_SUNSET = ['#ff8844', '#ffbb66', '#ffdd88', '#ff9966'];
const P_BOUQUET = ['#ff2255', '#ff4488', '#ff77aa', '#ffbbdd', '#e83366', '#ffaa88'];
const P_FINALE = ['#ff4488', '#ff6688', '#ffaa99', '#ff5577', '#ffcccc'];

type Props = {
  id: string;
  recipientName: string;
  senderName: string;
  senderRole: 'anh' | 'em';
  heartColor: 'pink' | 'red' | 'gold';
  photoUrls: string[];
  viewCount: number;
  createdAt: string;
};

/** Compute the four narrative text lines from the sender's role.
 *  Kept short (≤15 chars per line) so the ~1200-drone swarm has
 *  enough particles per character to render as readable glyphs
 *  within the mobile-portrait viewport. Each entry is one drone stage
 *  the show holds on before morphing to the next. */
function narrativeLines(role: 'anh' | 'em'): string[] {
  if (role === 'em') {
    return [
      'CHÀO ANH',
      'CẢM ƠN ANH',
      'ĐÃ ĐỒNG HÀNH\nCÙNG EM',
      'MÓN QUÀ NHỎ\nGỬI TẶNG ANH',
    ];
  }
  return [
    'CHÀO EM',
    'CẢM ƠN EM',
    'ĐÃ ĐỒNG HÀNH\nCÙNG ANH',
    'MÓN QUÀ NHỎ\nGỬI TẶNG EM',
  ];
}

// Time (ms) after mount before each cinematic beat lands.
const T_INTRO_TAG_IN =  200;
const T_NAME_START   = 2600;
const T_UI_START     = 5200;

function useTypewriter(text: string, startAtMs: number, cps = 9) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const startAt = performance.now() + startAtMs;
    setShown('');
    const tick = () => {
      if (cancelled) return;
      const now = performance.now();
      if (now < startAt) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const n = Math.min(text.length, Math.floor(((now - startAt) / 1000) * cps));
      setShown(text.slice(0, n));
      if (n < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [text, startAtMs, cps]);
  return shown;
}

function useDelayedBool(delayMs: number): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setOn(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);
  return on;
}

export function HeartView({
  recipientName,
  senderName,
  senderRole,
  photoUrls,
  viewCount,
}: Props) {
  const [copied, setCopied] = useState(false);
  const introOn = useDelayedBool(T_INTRO_TAG_IN);
  const nameShown = useTypewriter(recipientName, T_NAME_START, 10);
  const uiOn = useDelayedBool(T_UI_START);

  // Build the drone-show stage list. Structure mirrors the birthday
  // capsule flow: scatter opener → text intros → symbolic scenes →
  // photo carousel → looping runners close.
  //
  // Text stages hold 5s each (≈2s morph + 3s hold) — long enough for
  // the eye to read a two-line Vietnamese dedication after the drones
  // finish their easeOutCubic settle.
  const stages = useMemo(() => {
    const [line1, line2, line3, line4] = narrativeLines(senderRole);
    const suffix = senderRole === 'em' ? 'anh' : 'em';
    return [
      { kind: 'scatter' as const, durationMs: 1800, label: 'Bầu trời đêm...', colors: P_ROMANTIC },
      { kind: 'text' as const, value: line1, fontPx: 165, durationMs: 4200, colors: P_ROMANTIC },
      {
        kind: 'text' as const,
        value: line2,
        fontPx: 150,
        durationMs: 4500,
        label: `Cảm ơn ${suffix}...`,
        colors: P_ROMANTIC,
      },
      {
        kind: 'text' as const,
        value: line3,
        fontPx: 118,
        durationMs: 5000,
        label: 'Vì đã ở bên...',
        colors: P_ROMANTIC,
      },
      {
        kind: 'text' as const,
        value: line4,
        fontPx: 112,
        durationMs: 5000,
        label: 'Món quà nhỏ...',
        colors: P_ROMANTIC,
      },
      // 3-2-1 countdown — gold accent for anticipation.
      { kind: 'text' as const, value: '3', fontPx: 240, yShift: 0, fitWidth: 105, durationMs: 1500, colors: P_GOLD_ACCENT },
      { kind: 'text' as const, value: '2', fontPx: 240, yShift: 0, fitWidth: 105, durationMs: 1500, colors: P_GOLD_ACCENT },
      { kind: 'text' as const, value: '1', fontPx: 240, yShift: 0, fitWidth: 105, durationMs: 1500, colors: P_GOLD_ACCENT },
      // Heart holds longer than earlier scenes because the recipient's
      // photo is fading in inside it — deep romantic rose palette.
      {
        kind: 'scene' as const,
        sceneKey: 'heart' as const,
        durationMs: 6500,
        label: 'Trái tim yêu thương',
        colors: P_HEART_MOMENT,
      },
      // Romantic finale — hug → physics explosion → cosmic galaxy →
      // pastel dissolve. Concise arc focused on the emotional peak
      // of embracing followed by a celebratory burst and cosmic
      // finale, no gift-scene interlude.
      {
        kind: 'scene' as const,
        sceneKey: 'hug' as const,
        durationMs: 5000,
        label: `Ôm ${suffix} vào lòng`,
        colors: P_FINALE,
      },
      // Physics-based firework burst — drones fly outward from the
      // hug positions with REAL velocity, gravity, and drag. Each
      // drone tows a LineSegment "trail" from its origin to its
      // current position, so the swarm reads as radiating streaks of
      // light like a real firework photo — not just individual
      // dots moving. Duration extended so viewers see full parabolic
      // arcs (peak → gravity pull → fade).
      {
        kind: 'physics' as const,
        durationMs: 3500,
        label: 'Pháo hoa nổ bừng',
        colors: P_FIREWORKS_RAINBOW,
      },
      // Cosmic love galaxy — 3-arm spiral with heart-core, spins around
      // the "just-hugged" couple. Big rainbow celebration.
      {
        kind: 'scene' as const,
        sceneKey: 'galaxy' as const,
        durationMs: 5500,
        spin: 0.55,
        label: 'Vũ trụ tình yêu',
        colors: P_FIREWORKS_RAINBOW,
      },
      {
        kind: 'dissolve' as const,
        durationMs: 1400,
        label: 'Toả sáng cả trời',
        colors: P_PASTEL_FADE,
      },
    ];
  }, [senderRole, photoUrls]);

  async function share() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: `Gửi ${recipientName}`,
          text: 'Một trái tim 3D — bấm để xem những lời yêu thương bay lên',
          url,
        });
        return;
      } catch {
        // fallthrough
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Đã copy link 🔗');
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Không copy được, thử paste thủ công');
    }
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Night sky — dense CSS starfield (180 twinkling stars). Sits
          BEHIND the drone show so drones/text always stay clearly
          readable while a full starry backdrop shows through the gaps.
          Bypasses the WebGL fog which was making the in-scene stars
          nearly invisible. */}
      <NightSkyBackdrop count={200} />

      {/* Drone-show — Three.js WebGL, red drone lights, fog, stars.
          Inline + loop so it sits under our own UI overlay layers and
          runs forever until the user leaves the page. */}
      <JourneyDroneShow
        stages={stages}
        inline
        loop
        droneColor="multicolor"
        heartPhotoUrl={photoUrls[0] ?? null}
      />

      {/* Shooting-star rain across the sky — pure CSS overlay so it
          doesn't touch the drone canvas. 14 stars on a 7s cycle,
          staggered every 500ms, gives a near-continuous stream with
          2-3 streaks visible at once. */}
      <ShootingStars count={14} cycleMs={7000} />

      {/* Silhouettes anchored to the ground — the couple watching the
          drones from below. Sits above the WebGL canvas but below the
          UI text so foreground reads correctly. */}
      <SkyWatcherSilhouette variant="couple" height={0.26} />

      {/* Vignette — cinema edge fade. Above silhouette so the ground
          also fades into black at the corners. */}
      <div className="absolute inset-0">
        <CinematicVignette intensity={0.65} />
      </div>

      {/* Gao Cinema signature — tiny credit at the top. */}
      <div
        className="absolute top-0 left-0 right-0 flex justify-center pt-4 pointer-events-none"
        style={{
          opacity: introOn ? 1 : 0,
          transition: 'opacity 900ms ease',
        }}
      >
        <div
          className="text-[9px] uppercase font-semibold flex items-center gap-2"
          style={{
            letterSpacing: '0.5em',
            color: 'rgba(255,209,224,0.7)',
            paddingLeft: '0.5em',
          }}
        >
          <span
            style={{
              width: 20,
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(255,209,224,0.7))',
            }}
          />
          Gao Cinema
          <span
            style={{
              width: 20,
              height: 1,
              background: 'linear-gradient(90deg, rgba(255,209,224,0.7), transparent)',
            }}
          />
        </div>
      </div>

      {/* Recipient name — typewriter reveal + breathing glow. */}
      <div
        className="absolute top-0 left-0 right-0 pt-16 pb-16 px-6 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0))',
        }}
      >
        <div className="max-w-md mx-auto text-center">
          <div
            className="text-[10px] uppercase mb-3"
            style={{
              letterSpacing: '0.5em',
              color: 'rgba(255,209,224,0.75)',
              paddingLeft: '0.5em',
              opacity: nameShown.length > 0 ? 1 : 0,
              transition: 'opacity 500ms ease',
            }}
          >
            Gửi tới
          </div>
          <div
            className="text-4xl md:text-6xl font-bold"
            style={{
              fontFamily: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
              color: '#fff',
              minHeight: '1.2em',
              textShadow:
                '0 0 24px rgba(255,80,90,0.75), 0 0 48px rgba(255,80,90,0.45), 0 0 96px rgba(255,80,90,0.22)',
              animation: nameShown.length === recipientName.length
                ? 'gao-name-breath 3.2s ease-in-out infinite'
                : undefined,
            }}
          >
            {nameShown}
            {nameShown.length < recipientName.length && (
              <span style={{ opacity: 0.6, marginLeft: 2 }}>|</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom UI — share + create-your-own + attribution. */}
      <div
        className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-16"
        style={{
          background: 'linear-gradient(0deg, rgba(0,0,0,0.85), rgba(0,0,0,0))',
          opacity: uiOn ? 1 : 0,
          transform: uiOn ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 900ms ease, transform 900ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div className="max-w-md mx-auto flex flex-col gap-3">
          {senderName && (
            <div
              className="text-center"
              style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontStyle: 'italic',
                fontSize: 16,
                color: 'rgba(255,200,205,0.92)',
                textShadow: '0 0 14px rgba(255,80,90,0.55)',
              }}
            >
              — {senderName}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={share}
              className="flex-1 rounded-2xl py-3 text-sm font-bold cursor-pointer flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: 'white',
                boxShadow: '0 12px 30px -8px rgba(239,68,68,0.55)',
              }}
            >
              {copied ? <Check size={16} /> : <Share2 size={16} />}
              {copied ? 'Đã copy link' : 'Chia sẻ trái tim này'}
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                }).catch(() => { /* ignore */ });
              }}
              className="rounded-2xl px-3 py-3 cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
              }}
              aria-label="Copy link"
            >
              <Copy size={16} />
            </button>
          </div>

          <Link
            href="/me/gifts?tab=templates"
            className="rounded-2xl py-2.5 text-xs font-bold cursor-pointer flex items-center justify-center gap-2 no-underline"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            <Sparkles size={12} /> Tạo trái tim của riêng bạn — miễn phí
          </Link>

          <div
            className="text-[10px] text-center flex items-center justify-center gap-1.5"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            <Heart size={10} className="fill-current" />
            <span>{viewCount.toLocaleString('vi-VN')} người đã xem · Made with Gao</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes gao-name-breath {
          0%, 100% {
            text-shadow: 0 0 24px rgba(255,80,90,0.75),
                         0 0 48px rgba(255,80,90,0.45),
                         0 0 96px rgba(255,80,90,0.22);
          }
          50% {
            text-shadow: 0 0 32px rgba(255,80,90,0.95),
                         0 0 64px rgba(255,80,90,0.65),
                         0 0 128px rgba(255,80,90,0.35);
          }
        }
      `}</style>
    </div>
  );
}
