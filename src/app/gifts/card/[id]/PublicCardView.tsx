'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Copy, Eye, MessageCircle, Share2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { CoupleIdCard, type Milestone } from '@/components/gifts/CoupleIdCard';

/** Inline brand SVG icons — lucide dropped Facebook/Twitter, and inline
 *  gives us pixel-perfect brand shapes anyway. */
const FbIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M13.5 21.95V13.5h2.85l.42-3.32H13.5V8.06c0-.96.27-1.62 1.65-1.62H16.9V3.47c-.31-.04-1.36-.13-2.58-.13-2.55 0-4.3 1.56-4.3 4.42v2.42H7.15v3.32h2.87V22c.98.14 3.5.14 3.48-.05Z"/>
  </svg>
);
const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

type Props = {
  id: string;
  name1: string;
  name2: string;
  cardId: string;
  issueDate: string;
  expiryDate: string;
  variant: 'classic' | 'noir' | 'rose';
  togetherSince: string | null;
  milestones: Milestone[];
  photoUrl: string | null;
  viewCount: number;
  createdAt: string;
};

/** Wrapper that scales the CoupleIdCard down to fit the available width.
 *  CoupleIdCard is fixed at 420px wide (its internal layout assumes a
 *  precise pixel grid) — on narrow phones we scale it via CSS transform
 *  and mirror the reduction on the outer box so the DOM height stays
 *  correct (a scaled-down element still occupies its original box size). */
function ResponsiveCardStage({
  hasStory, children,
}: {
  hasStory: boolean;
  children: React.ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const cardW = 420;
  // Rough height estimate — compact = ID-1 ratio, with-story = taller
  const cardH = hasStory ? 344 : Math.round(cardW / 1.586);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const avail = el.offsetWidth;
      const next = Math.min(1, avail / cardW);
      setScale(prev => (Math.abs(prev - next) < 0.005 ? prev : next));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cardW]);

  return (
    <div
      ref={wrapperRef}
      style={{
        width: '100%',
        maxWidth: cardW,
        // Reserve exactly the scaled-down size so surrounding layout doesn't
        // leave a huge empty box below the visible card.
        height: cardH * scale,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: cardW,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function PublicCardView({
  id, name1, name2, cardId, issueDate, expiryDate, variant,
  togetherSince, milestones, photoUrl, viewCount, createdAt,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [pageUrl, setPageUrl] = useState('');

  useEffect(() => {
    setPageUrl(window.location.href);
    setNowMs(Date.now());
  }, []);

  const daysCount = useMemo(() => {
    if (!togetherSince || nowMs == null) return null;
    const [y, m, d] = togetherSince.split('-').map(Number);
    if (!y || !m || !d) return null;
    const start = new Date(y, m - 1, d).getTime();
    return Math.max(0, Math.floor((nowMs - start) / (24 * 3600 * 1000)));
  }, [togetherSince, nowMs]);

  const publishedRel = useMemo(() => {
    if (!createdAt) return '';
    const diff = Date.now() - new Date(createdAt).getTime();
    const days = Math.floor(diff / (24 * 3600 * 1000));
    if (days < 1) return 'today';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  }, [createdAt]);

  const shareText = `${name1 || 'Us'} & ${name2 || 'them'} — our official couple card 💕`;
  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedText = encodeURIComponent(shareText);

  async function copyLink() {
    if (!pageUrl) return;
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Copy failed — long-press the URL bar instead');
    }
  }

  async function nativeShare() {
    if (!pageUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, text: shareText, url: pageUrl });
      } catch { /* cancelled */ }
    } else {
      copyLink();
    }
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 90% 55% at 30% 25%, rgba(212,175,55,0.12), transparent 55%), ' +
          'radial-gradient(ellipse 90% 65% at 75% 80%, rgba(236,72,153,0.10), transparent 60%), ' +
          '#05060a',
      }}
    >
      {/* Ambient floating gold sparks — pure decoration, sits behind. */}
      <AmbientSparks />

      {/* ── Top bar (compact on mobile, roomy on desktop) ─────────────── */}
      <header className="relative z-10 max-w-6xl mx-auto flex items-center justify-between gap-3 px-4 lg:px-8 pt-4 lg:pt-8">
        <Link
          href="/gifts"
          className="flex items-center gap-1.5 text-[10px] lg:text-xs font-bold tracking-[0.22em] lg:tracking-[0.25em] uppercase no-underline shrink-0"
          style={{ color: '#d4af37' }}
        >
          <Sparkles size={13} /> Gao Gifts
        </Link>
        <div
          className="flex items-center gap-1.5 text-[10px] lg:text-xs text-white/50 rounded-full px-2.5 py-1 lg:px-3 lg:py-1.5"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <Eye size={11} />
          <span className="tabular-nums">{viewCount.toLocaleString()}</span>
          <span className="hidden sm:inline">{viewCount === 1 ? 'view' : 'views'}</span>
          <span className="opacity-40 hidden sm:inline">·</span>
          <span className="opacity-70 hidden sm:inline">Published {publishedRel}</span>
        </div>
      </header>

      {/* ── Hero (2-column on desktop, stacked on mobile) ─────────────── */}
      <main
        className="relative z-10 max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-16 grid gap-8 lg:gap-16 items-center"
        style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}
      >
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 lg:gap-16 items-center">
          {/* Card column ------------------------------------------------ */}
          <div className="flex justify-center lg:justify-end order-1 w-full">
            <div className="relative w-full max-w-105">
              {/* Gold glow halo behind the card */}
              <div
                aria-hidden
                className="absolute pointer-events-none"
                style={{
                  inset: '-40px -30px',
                  background:
                    'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(212,175,55,0.28), transparent 60%)',
                  filter: 'blur(30px)',
                  zIndex: 0,
                }}
              />
              <div className="relative z-10">
                <ResponsiveCardStage hasStory={!!togetherSince || milestones.length > 0}>
                  <CoupleIdCard
                    name1={name1}
                    name2={name2}
                    photoUrl={photoUrl}
                    cardId={cardId}
                    issueDate={issueDate}
                    expiryDate={expiryDate}
                    variant={variant}
                    togetherSince={togetherSince}
                    milestones={milestones}
                    daysCount={daysCount}
                  />
                </ResponsiveCardStage>
              </div>
            </div>
          </div>

          {/* Info + Share + CTA column --------------------------------- */}
          <div className="flex flex-col items-start gap-6 lg:gap-10 w-full lg:mx-0 order-2 min-w-0">
            {/* Big couple title + subtitle */}
            <div>
              <div
                className="text-[10px] lg:text-xs font-semibold tracking-[0.28em] lg:tracking-[0.32em] uppercase mb-2 lg:mb-3"
                style={{ color: '#d4af37' }}
              >
                An official gao original
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-5xl font-black leading-[1.05] mb-2 lg:mb-3 text-white wrap-break-word">
                {name1 || 'Someone'}
                <span style={{ color: '#d4af37', fontWeight: 500 }}> & </span>
                {name2 || 'their love'}
              </h1>
              {togetherSince && daysCount != null && (
                <p className="text-sm lg:text-base text-white/70">
                  Together for <span className="font-bold text-white tabular-nums">{daysCount.toLocaleString()}</span> {daysCount === 1 ? 'day' : 'days'} — and counting.
                </p>
              )}
            </div>

            {/* Share block */}
            <section className="w-full">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">
                Share this card
              </div>
              <button
                onClick={nativeShare}
                className="w-full rounded-2xl py-3.5 text-sm font-bold cursor-pointer flex items-center justify-center gap-2 transition-transform active:scale-[0.98] mb-2.5"
                style={{
                  background: 'linear-gradient(135deg, #d4af37 0%, #f2d97a 50%, #d4af37 100%)',
                  color: '#0a0a0a',
                  boxShadow: '0 14px 34px -10px rgba(212,175,55,0.55)',
                }}
              >
                <Share2 size={14} />
                Share the moment
              </button>
              <div className="grid grid-cols-4 gap-1.5 lg:gap-2">
                <ShareTile
                  onClick={copyLink}
                  icon={copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  label={copied ? 'Copied' : 'Copy'}
                  tint="rgba(255,255,255,0.06)"
                  tintBorder="rgba(255,255,255,0.1)"
                  fg="white"
                />
                <ShareTile
                  href={pageUrl ? `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` : '#'}
                  icon={<FbIcon />}
                  label="Facebook"
                  tint="rgba(24,119,242,0.14)"
                  tintBorder="rgba(24,119,242,0.32)"
                  fg="#5aa5ff"
                />
                <ShareTile
                  href={pageUrl ? `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}` : '#'}
                  icon={<XIcon />}
                  label="X"
                  tint="rgba(255,255,255,0.06)"
                  tintBorder="rgba(255,255,255,0.12)"
                  fg="white"
                />
                <ShareTile
                  href={pageUrl ? `https://wa.me/?text=${encodedText}%20${encodedUrl}` : '#'}
                  icon={<MessageCircle size={16} />}
                  label="WhatsApp"
                  labelSm="WA"
                  tint="rgba(37,211,102,0.14)"
                  tintBorder="rgba(37,211,102,0.32)"
                  fg="#4bde86"
                />
              </div>
            </section>

            {/* Divider */}
            <div
              className="w-full h-px"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(212,175,55,0.35), transparent)',
              }}
            />

            {/* Big CTA */}
            <section className="w-full">
              <div
                className="text-[10px] font-bold uppercase tracking-widest mb-2"
                style={{ color: '#d4af37' }}
              >
                Made with Gao Gifts
              </div>
              <h2 className="text-2xl lg:text-3xl font-black text-white mb-2 leading-tight">
                Want yours?
              </h2>
              <p className="text-sm text-white/60 mb-4 lg:mb-5">
                Design your own official couple membership card — takes 30 seconds, free forever.
              </p>
              <Link
                href="/me/gifts?tab=templates"
                className="group w-full rounded-2xl py-3.5 lg:py-4 flex items-center justify-center gap-2 text-sm lg:text-base font-bold cursor-pointer transition-transform active:scale-[0.98] no-underline"
                style={{
                  background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                  color: 'white',
                  boxShadow: '0 14px 34px -10px rgba(168,85,247,0.55)',
                }}
              >
                Make my card
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <p className="text-[10px] text-white/30 mt-3 lg:mt-4 tabular-nums truncate">
                card id: {id}
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* ── Footer band ────────────────────────────────────────────────── */}
      <footer className="relative z-10 mt-6 lg:mt-16 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 flex flex-col lg:flex-row items-center lg:justify-between gap-2 text-[11px] text-white/40">
          <div className="flex items-center gap-1.5">
            <Sparkles size={11} style={{ color: '#d4af37' }} />
            <span>Every card is a keepsake. Every share is a story shared.</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/gifts" className="hover:text-white/70 no-underline text-white/50">
              Browse templates
            </Link>
            <span className="opacity-30">·</span>
            <Link href="/me/gifts" className="hover:text-white/70 no-underline text-white/50">
              My gifts
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function ShareTile({
  onClick, href, icon, label, labelSm, tint, tintBorder, fg,
}: {
  onClick?: () => void;
  href?: string;
  icon: React.ReactNode;
  label: string;
  /** Shorter label shown on very narrow screens where `label` would
   *  overflow (e.g. "WhatsApp" → "WA"). Defaults to `label`. */
  labelSm?: string;
  tint: string;
  tintBorder: string;
  fg: string;
}) {
  const styles: React.CSSProperties = {
    background: tint,
    color: fg,
    border: `1px solid ${tintBorder}`,
  };
  const inner = (
    <span
      className="w-full rounded-xl py-2.5 px-1 lg:py-3 text-[10px] font-semibold cursor-pointer flex flex-col items-center gap-1 lg:gap-1.5 transition-transform active:scale-[0.98] no-underline"
      style={styles}
    >
      {icon}
      <span className="truncate max-w-full">
        <span className="sm:hidden">{labelSm ?? label}</span>
        <span className="hidden sm:inline">{label}</span>
      </span>
    </span>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0"
        style={{ textDecoration: 'none' }}
      >
        {inner}
      </a>
    );
  }
  return (
    <button
      onClick={onClick}
      className="min-w-0"
      style={{ padding: 0, background: 'transparent', border: 'none' }}
    >
      {inner}
    </button>
  );
}

/** Ambient gold sparks floating in the background — pure decoration.
 *  Deterministic positions so SSR + client match without hydration
 *  errors, and they don't churn on every render. */
const AMBIENT_SPARKS = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  left: `${(i * 41) % 100}%`,
  top: `${(i * 73) % 100}%`,
  size: 2 + (i % 4),
  delay: `${(i * 0.37) % 6}s`,
  duration: `${4 + (i % 5)}s`,
}));

function AmbientSparks() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    >
      {AMBIENT_SPARKS.map(s => (
        <span
          key={s.id}
          style={{
            position: 'absolute',
            left: s.left, top: s.top,
            width: s.size, height: s.size,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #d4af37, rgba(212,175,55,0))',
            animation: `gao-public-spark ${s.duration} ease-in-out infinite ${s.delay}`,
            opacity: 0.5,
          }}
        />
      ))}
      <style>{`
        @keyframes gao-public-spark {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.15; }
          50%      { transform: translateY(-6px) scale(1.4); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}
