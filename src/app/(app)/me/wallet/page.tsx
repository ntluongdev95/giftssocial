'use client';

// Customer wallet — every gift card the signed-in user has claimed.
// Companion to /me/gift-cards (merchant dashboard). Each card opens a sheet
// with a per-claim QR the merchant scans to redeem.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Wallet, Loader2, Clock, Sparkles, X, QrCode } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';
import QRCodeLib from 'qrcode';
import { GiftCardPreview, formatValue } from '@/components/gift-cards/GiftCardPreview';
import { useAuthStore } from '@/stores/auth-store';

interface MyCard {
  id: string;
  template_id: string;
  business_id: string;
  business_name: string | null;
  claimed_at: string;
  expires_at: string | null;
  value_remaining: number;
  uses_remaining: number;
  status: 'active' | 'redeemed' | 'expired' | 'revoked';
  // Template fields (joined)
  name: string;
  description: string;
  type: 'voucher' | 'stored_value' | 'service' | 'loyalty';
  face_value: number;
  percent_off: number;
  amount_off: number;
  service_name: string | null;
  currency: string;
  gradient_from: string;
  gradient_to: string;
  expires_in_days: number;
}

const fetcher = (url: string) =>
  fetch(url, { credentials: 'same-origin' }).then(async (r) => {
    const j = await r.json();
    if (!r.ok) throw j?.error || { code: 'fetch_error' };
    return j.data as MyCard[];
  });

export default function CustomerWalletPage() {
  const router = useRouter();
  const isAuthed = useAuthStore((s) => s.isAuthed);

  const { data, error, isLoading } = useSWR<MyCard[]>(
    isAuthed ? '/api/v1/gift-cards/mine' : null,
    fetcher,
    {
      // Refetch on tab focus so a card redeemed on the merchant device
      // updates here automatically. Light poll every 8s while open so the
      // status flips quickly without needing a refresh.
      revalidateOnFocus: true,
      refreshInterval: 8000,
    }
  );

  // Track the OPEN CARD BY ID — re-derive the live row from the latest SWR
  // data on every render so the detail sheet reflects status updates (e.g.
  // when the merchant just redeemed it).
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const cards = data || [];
  const activeCards = cards.filter((c) => c.status === 'active');
  const inactiveCards = cards.filter((c) => c.status !== 'active');
  const openCard = openCardId ? cards.find((c) => c.id === openCardId) || null : null;

  return (
    <div className="h-full overflow-y-auto relative" style={{ background: '#0a0b0f', color: '#f0f4ff' }}>
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{ background: 'rgba(10,11,15,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <button
          onClick={() => router.push('/me')}
          className="flex h-9 w-9 items-center justify-center rounded-full cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-lg font-bold">My Wallet</h1>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Hero */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Wallet size={20} className="text-[#00d4ff] shrink-0" />
              <span>Your gift cards</span>
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[#a3adc3] sm:text-xs">
              Tap a card to show its QR — the merchant scans it to redeem in-store.
            </p>
          </div>
        </div>

        {!isAuthed && (
          <CenteredState
            title="Sign in to see your cards"
            sub="Your wallet only appears when you're signed in."
            action={{ label: 'Sign in', onClick: () => router.push('/') }}
          />
        )}

        {isAuthed && isLoading && (
          <div className="flex items-center justify-center py-16 text-[#4a5068]">
            <Loader2 size={20} className="animate-spin" />
          </div>
        )}

        {isAuthed && error && (
          <CenteredState
            title="Couldn't load your wallet"
            sub="Try refreshing in a moment."
          />
        )}

        {isAuthed && !isLoading && !error && cards.length === 0 && (
          <CenteredState
            title="No cards yet"
            sub="When you claim a gift card, it lands here. Scan a merchant's QR or tap a shared link to claim one."
            icon={<Wallet size={28} />}
          />
        )}

        {/* Active cards */}
        {activeCards.length > 0 && (
          <Section title="Active" count={activeCards.length}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeCards.map((c) => (
                <WalletCard key={c.id} card={c} onClick={() => setOpenCardId(c.id)} />
              ))}
            </div>
          </Section>
        )}

        {/* Past cards (redeemed / expired) */}
        {inactiveCards.length > 0 && (
          <Section title="Past" count={inactiveCards.length} muted>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-70">
              {inactiveCards.map((c) => (
                <WalletCard key={c.id} card={c} onClick={() => setOpenCardId(c.id)} />
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* Detail sheet — placeholder until the redeem QR API is built */}
      {openCard && <CardDetailSheet card={openCard} onClose={() => setOpenCardId(null)} />}
    </div>
  );
}

// ─── Small wallet card ───────────────────────────────────────────────────

function WalletCard({ card: c, onClick }: { card: MyCard; onClick: () => void }) {
  const expiresInLabel =
    c.status === 'expired' ? 'Expired' :
    c.status === 'redeemed' ? 'Used' :
    c.expires_at ? `Expires in ${formatDistanceToNowStrict(new Date(c.expires_at))}` :
    `Valid ${c.expires_in_days}d`;

  const statusColor =
    c.status === 'active' ? '#22C55E' :
    c.status === 'redeemed' ? '#a3adc3' :
    c.status === 'expired' ? '#f87171' :
    '#4a5068';

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left flex flex-col gap-2 h-full cursor-pointer"
    >
      <GiftCardPreview
        className="flex-1"
        type={c.type}
        name={c.name}
        businessName={c.business_name}
        value={formatValue(c)}
        gradientFrom={c.gradient_from || '#00d4ff'}
        gradientTo={c.gradient_to || '#a78bfa'}
        description={c.description}
        footerLeft={expiresInLabel}
        footerRight={c.type === 'stored_value' ? `${formatValue({ ...c, face_value: c.value_remaining })} left` : undefined}
        statusBadge={
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur"
            style={{ background: `${statusColor}33`, color: 'white', border: `1px solid ${statusColor}55` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor }} /> {c.status}
          </span>
        }
      />
      {/* Bottom action — Show QR only for active cards. Redeemed/expired
          cards get a status label instead. */}
      {c.status === 'active' ? (
        <div
          className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold"
          style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.18)', color: '#00d4ff' }}
        >
          <QrCode size={12} /> Show QR
        </div>
      ) : (
        <div
          className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold uppercase tracking-wider"
          style={{
            background: `${statusColor}14`,
            border: `1px solid ${statusColor}30`,
            color: statusColor,
          }}
        >
          {c.status === 'redeemed' ? 'Used' : c.status === 'expired' ? 'Expired' : 'Unavailable'}
        </div>
      )}
    </button>
  );
}

// ─── Detail sheet placeholder ─────────────────────────────────────────────

function CardDetailSheet({ card: c, onClose }: { card: MyCard; onClose: () => void }) {
  const expiresLabel = c.expires_at ? formatDistanceToNowStrict(new Date(c.expires_at)) : `${c.expires_in_days} days`;

  return (
    <div
      className="fixed inset-0 z-1000 flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl lg:max-w-3xl"
        style={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 lg:px-7 lg:py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="min-w-0">
            <h3 className="text-base font-bold truncate lg:text-lg">{c.name}</h3>
            <p className="mt-0.5 text-[11px] text-[#a3adc3] truncate lg:text-xs">
              {c.business_name || 'Gao Social'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full cursor-pointer text-[#4a5068] hover:text-white"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mobile: stacked. Desktop: 2-col with card on the left, QR + meta on the right. */}
        <div className="px-5 py-5 space-y-5 lg:px-7 lg:py-7 lg:space-y-0 lg:grid lg:grid-cols-[1fr_320px] lg:gap-7">
          {/* Left column — card showcase */}
          <div className="lg:flex lg:flex-col lg:gap-5">
            <GiftCardPreview
              type={c.type}
              name={c.name}
              businessName={c.business_name}
              value={formatValue(c)}
              gradientFrom={c.gradient_from || '#00d4ff'}
              gradientTo={c.gradient_to || '#a78bfa'}
              description={c.description}
              footerLeft={c.expires_at ? `Expires in ${expiresLabel}` : `Valid ${c.expires_in_days}d`}
              footerRight={c.status === 'active' ? 'Yours' : c.status}
            />

            {/* Meta strip — desktop only here, lives below the card */}
            <div className="hidden lg:grid grid-cols-3 gap-2 text-center">
              <Meta icon={<Sparkles size={12} />} label="Type" value={c.type.replace('_', ' ')} />
              <Meta icon={<Clock size={12} />} label="Status" value={c.status} />
              <Meta
                icon={<Wallet size={12} />}
                label={c.type === 'stored_value' ? 'Remaining' : 'Uses left'}
                value={
                  c.type === 'stored_value'
                    ? formatValue({ ...c, face_value: c.value_remaining })
                    : `${c.uses_remaining}`
                }
              />
            </div>
          </div>

          {/* Right column — redeem QR */}
          <div className="lg:flex lg:flex-col lg:justify-center">
            {c.status === 'active' ? (
              <RedeemQr cardId={c.id} gradientFrom={c.gradient_from || '#00d4ff'} />
            ) : (
              <div
                className="rounded-2xl p-4 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <p className="text-sm font-semibold capitalize">{c.status}</p>
                <p className="mt-1 text-[11px] text-[#a3adc3]">
                  This card can no longer be used.
                </p>
              </div>
            )}
          </div>

          {/* Meta strip — mobile only (desktop renders inside left column) */}
          <div className="grid grid-cols-3 gap-2 text-center lg:hidden">
            <Meta icon={<Sparkles size={12} />} label="Type" value={c.type.replace('_', ' ')} />
            <Meta icon={<Clock size={12} />} label="Status" value={c.status} />
            <Meta
              icon={<Wallet size={12} />}
              label={c.type === 'stored_value' ? 'Remaining' : 'Uses left'}
              value={
                c.type === 'stored_value'
                  ? formatValue({ ...c, face_value: c.value_remaining })
                  : `${c.uses_remaining}`
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────

// ─── Redeem QR — the per-claim QR the merchant scans in-store ────────────
function RedeemQr({ cardId, gradientFrom }: { cardId: string; gradientFrom: string }) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    QRCodeLib.toDataURL(cardId, {
      width: 720,
      margin: 2,
      color: { dark: '#0a0b0f', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    })
      .then(setDataUrl)
      .catch((e) => {
        console.error('[Wallet QR generate]', e);
        toast.error('Failed to render QR');
      });
  }, [cardId]);

  const copyId = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(cardId);
      } else {
        const ta = document.createElement('textarea');
        ta.value = cardId;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      toast.success('Card ID copied');
    } catch {
      toast.error('Long-press the ID to copy');
    }
  };

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'rgba(0,212,255,0.04)',
        border: '1px solid rgba(0,212,255,0.18)',
      }}
    >
      {/* Big QR centred on a white card with gradient-tinted glow */}
      <div
        className="mx-auto flex aspect-square w-full max-w-64 items-center justify-center rounded-2xl p-3"
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f4f5f7 100%)',
          boxShadow: `0 18px 48px -20px ${gradientFrom}88, inset 0 0 0 1px rgba(255,255,255,0.6)`,
        }}
      >
        {dataUrl ? (
          <img src={dataUrl} alt="Redeem QR" className="h-full w-full object-contain" />
        ) : (
          <Loader2 size={24} className="animate-spin text-[#4a5068]" />
        )}
      </div>
      <p className="mt-3 text-center text-sm font-semibold">Show this QR at the shop</p>
      <p className="mt-1 text-center text-[11px] text-[#a3adc3]">
        The merchant scans this to redeem your card.
      </p>
      {/* Manual fallback — card ID for the merchant to paste if scan fails */}
      <button
        onClick={copyId}
        className="mt-3 w-full rounded-lg py-2 text-[11px] font-mono cursor-pointer truncate"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: '#a3adc3',
        }}
        title="Tap to copy"
      >
        {cardId}
      </button>
    </div>
  );
}

function Section({
  title,
  count,
  muted = false,
  children,
}: {
  title: string;
  count: number;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className={`text-[11px] font-bold uppercase tracking-wider ${muted ? 'text-[#4a5068]' : 'text-[#a3adc3]'}`}>
          {title}
        </h3>
        <span className="text-[11px] text-[#4a5068]">· {count}</span>
      </div>
      {children}
    </section>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center justify-center text-[#00d4ff] mb-1">{icon}</div>
      <div className="text-[10px] uppercase tracking-wider text-[#4a5068]">{label}</div>
      <div className="mt-0.5 text-[12px] font-semibold capitalize truncate">{value}</div>
    </div>
  );
}

function CenteredState({
  title,
  sub,
  icon,
  action,
}: {
  title: string;
  sub: string;
  icon?: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      className="rounded-2xl p-8 text-center"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)' }}
    >
      {icon ? <div className="mx-auto mb-3 text-[#4a5068]">{icon}</div> : null}
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-[#a3adc3]">{sub}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer"
          style={{ background: '#00d4ff', color: '#0a0b0f' }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
