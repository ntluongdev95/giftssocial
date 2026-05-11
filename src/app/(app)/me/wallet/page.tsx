'use client';

// Customer wallet — every gift card the signed-in user has claimed.
// Companion to /me/gift-cards (merchant dashboard). Each card opens a sheet
// with a per-claim QR the merchant scans to redeem.

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { ArrowLeft, Wallet, Loader2, Clock, Sparkles, X, QrCode, Compass, TicketCheck, Send } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';
import QRCodeLib from 'qrcode';
import { GiftCardPreview, formatValue } from '@/components/gift-cards/GiftCardPreview';
import SendGiftModal, { type SendGiftTarget } from '@/components/gift-cards/SendGiftModal';
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
  // Gift sender — present iff this card was sent to me by another user.
  gifter_user_id: string | null;
  gift_message: string | null;
  gifter_display_name: string | null;
  gifter_username: string | null;
  gifter_avatar_url: string | null;
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
  const searchParams = useSearchParams();
  // Deep-link target from notifications: /me/wallet?card=gc_xxx. The
  // effect below picks this up once SWR has loaded the user's cards and
  // opens the detail sheet for that card automatically.
  const focusCardId = searchParams?.get('card') || null;
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
  // Target for the re-gift modal; null when closed.
  const [giftTarget, setGiftTarget] = useState<SendGiftTarget | null>(null);

  // Auto-open the detail sheet when the page is opened from a notification
  // deep-link (?card=gc_xxx). Waits until SWR has the card in its dataset
  // so the sheet doesn't flash empty. Only runs once per focusCardId to
  // avoid re-opening if the user closes the sheet.
  const cards = data || [];
  useEffect(() => {
    if (!focusCardId) return;
    const exists = cards.some((c) => c.id === focusCardId);
    if (exists) setOpenCardId(focusCardId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCardId, data]);

  // Tab filter — click to scope which cards are visible.
  const [filter, setFilter] = useState<'all' | 'active' | 'used' | 'expired'>('all');

  const activeCards = cards.filter((c) => c.status === 'active');
  const usedCards = cards.filter((c) => c.status === 'redeemed');
  const expiredCards = cards.filter((c) => c.status === 'expired' || c.status === 'revoked');
  const inactiveCards = [...usedCards, ...expiredCards];

  const visibleCards =
    filter === 'active' ? activeCards
    : filter === 'used' ? usedCards
    : filter === 'expired' ? expiredCards
    : cards;

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

      <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-10">
        {/* ── HERO with stats ─────────────────────────────────────────── */}
        <WalletHero
          activeCount={activeCards.length}
          inactiveCount={inactiveCards.length}
          totalValue={computeTotalValue(activeCards)}
        />

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
          <EmptyWallet onDiscover={() => router.push('/world')} />
        )}

        {/* Filter tabs — only show when there are any cards */}
        {isAuthed && !isLoading && !error && cards.length > 0 && (
          <>
            <FilterTabs
              filter={filter}
              onChange={setFilter}
              counts={{
                all: cards.length,
                active: activeCards.length,
                used: usedCards.length,
                expired: expiredCards.length,
              }}
            />

            {/* Cards grid — applies opacity to non-active filters */}
            {visibleCards.length === 0 ? (
              <CenteredState
                title={`No ${filter} cards`}
                sub={
                  filter === 'active'
                    ? 'Claim a drop to fill this section.'
                    : filter === 'used'
                    ? 'Cards you redeem at the shop will appear here.'
                    : 'Cards that expire without being used will appear here.'
                }
                icon={<Wallet size={28} />}
              />
            ) : (
              <div
                className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6 ${
                  filter === 'used' || filter === 'expired' ? 'opacity-85' : ''
                }`}
              >
                {visibleCards.map((c) => (
                  <WalletCard
                    key={c.id}
                    card={c}
                    onClick={() => setOpenCardId(c.id)}
                    onGift={() => setGiftTarget({
                      mode: 'card',
                      id: c.id,
                      template_name: c.name,
                      business_name: c.business_name || undefined,
                    })}
                  />
                ))}
                {/* Discover-more CTA only on Active or All when there's space */}
                {(filter === 'all' || filter === 'active') && activeCards.length < 3 && (
                  <DiscoverCard onClick={() => router.push('/world')} />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail sheet — opens when a card is tapped. "Send as gift" lives
          on the grid card itself, so the detail sheet stays focused on
          the redeem QR. */}
      {openCard && (
        <CardDetailSheet
          card={openCard}
          onClose={() => setOpenCardId(null)}
        />
      )}

      {/* Re-gift modal — fires when the user taps "Send as gift" in the
          detail sheet. On success the card moves out of this wallet, so
          we close the detail sheet and refetch /mine. */}
      {giftTarget && (
        <SendGiftModal
          target={giftTarget}
          onClose={() => setGiftTarget(null)}
          onSent={() => {
            setGiftTarget(null);
            setOpenCardId(null);
            mutate('/api/v1/gift-cards/mine');
          }}
        />
      )}
    </div>
  );
}

// ─── Small wallet card ───────────────────────────────────────────────────

function WalletCard({
  card: c,
  onClick,
  onGift,
}: {
  card: MyCard;
  onClick: () => void;
  onGift: () => void;
}) {
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

  const isGift = !!c.gifter_user_id;
  const gifterLabel =
    c.gifter_display_name
    || (c.gifter_username ? `@${c.gifter_username}` : 'Someone');

  return (
    // Outer is a div (not a button) because we nest real buttons inside.
    // The card preview itself is the primary click target; the action row
    // below is split into two side-by-side buttons.
    <div className="flex flex-col gap-2 h-full relative">
      {/* Gift ribbon — only shown for gifts received from another user */}
      {isGift && (
        <div
          className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider backdrop-blur"
          style={{ background: 'rgba(255,111,168,0.92)', color: 'white', boxShadow: '0 4px 10px -4px rgba(196,30,58,0.5)' }}
          title={`Gift from ${gifterLabel}`}
        >
          🎁 Gift
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        className="text-left flex-1 cursor-pointer"
        aria-label={`Open ${c.name}`}
      >
        <GiftCardPreview
          className="h-full"
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
      </button>
      {/* Bottom action row — Show QR + Send as gift for active cards.
          Redeemed/expired cards get a single status label instead. */}
      {c.status === 'active' ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClick}
            className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold cursor-pointer transition-colors"
            style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.18)', color: '#00d4ff' }}
          >
            <QrCode size={12} /> Show QR
          </button>
          <button
            type="button"
            onClick={onGift}
            className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold cursor-pointer transition-colors"
            style={{ background: 'rgba(255,111,168,0.1)', border: '1px solid rgba(255,111,168,0.25)', color: '#ff6fa8' }}
          >
            <Send size={12} /> Send as gift
          </button>
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
    </div>
  );
}

// ─── Detail sheet placeholder ─────────────────────────────────────────────

function CardDetailSheet({
  card: c,
  onClose,
}: {
  card: MyCard;
  onClose: () => void;
}) {
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
            {/* Gift banner — shown when this card was sent by another user.
                Sits above the card preview so the gifter + message are
                the first thing the recipient reads. */}
            {c.gifter_user_id && (
              <div
                className="mb-4 flex items-start gap-3 rounded-2xl px-3 py-3 lg:mb-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,111,168,0.12), rgba(196,30,58,0.08))',
                  border: '1px solid rgba(255,111,168,0.25)',
                }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
                  style={{ background: 'linear-gradient(135deg, #ff6fa8, #c41e3a)' }}
                >
                  🎁
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-[#ff6fa8]/85 font-bold">
                    Gift from
                  </p>
                  <p className="mt-0.5 text-sm font-bold truncate">
                    {c.gifter_display_name
                      || (c.gifter_username ? `@${c.gifter_username}` : 'A Gao Social friend')}
                  </p>
                  {c.gift_message && (
                    <p className="mt-1.5 text-xs text-white/80 italic leading-relaxed">
                      &ldquo;{c.gift_message}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            )}
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

          {/* Right column — redeem QR (gifting lives on the card grid) */}
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

// ─── Hero with stats — top of the wallet ─────────────────────────────────
function WalletHero({
  activeCount,
  inactiveCount,
  totalValue,
}: {
  activeCount: number;
  inactiveCount: number;
  totalValue: { amount: number; currency: string } | null;
}) {
  return (
    <div
      className="mb-6 rounded-2xl p-5 lg:mb-8 lg:p-7 lg:flex lg:items-center lg:justify-between lg:gap-8"
      style={{
        background: 'linear-gradient(135deg, rgba(0,212,255,0.08) 0%, rgba(167,139,250,0.06) 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="lg:max-w-md">
        <h2 className="text-xl font-bold flex items-center gap-2 lg:text-2xl">
          <Wallet size={22} className="text-[#00d4ff] shrink-0" />
          <span>My Wallet</span>
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#a3adc3] lg:text-sm">
          Tap any card to show its QR. The merchant scans it to redeem in-store —
          your wallet updates automatically.
        </p>
      </div>
      {/* Stat tiles */}
      <div className="mt-4 grid grid-cols-3 gap-2 lg:mt-0 lg:gap-3 lg:min-w-[420px]">
        <StatTile
          label="Active"
          value={`${activeCount}`}
          color="#22C55E"
          icon={<Sparkles size={14} />}
        />
        <StatTile
          label={totalValue ? `Value · ${totalValue.currency}` : 'Value'}
          value={totalValue ? formatBigMoney(totalValue.amount) : '—'}
          color="#00d4ff"
          icon={<Wallet size={14} />}
        />
        <StatTile
          label="Used"
          value={`${inactiveCount}`}
          color="#a3adc3"
          icon={<TicketCheck size={14} />}
        />
      </div>
    </div>
  );
}

function StatTile({
  label, value, color, icon,
}: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div
      className="rounded-xl px-3 py-2.5 lg:px-4 lg:py-3"
      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-1.5" style={{ color }}>
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1 text-lg font-black truncate lg:text-xl">{value}</div>
    </div>
  );
}

// Compute the total stored-value remaining across the user's active cards.
// Returns the dominant currency (most cards) and its summed value, or null if
// there are no stored-value cards.
function computeTotalValue(active: MyCard[]): { amount: number; currency: string } | null {
  const sums: Record<string, number> = {};
  for (const c of active) {
    if (c.type === 'stored_value' && c.value_remaining > 0) {
      sums[c.currency] = (sums[c.currency] || 0) + c.value_remaining;
    }
  }
  const entries = Object.entries(sums);
  if (entries.length === 0) return null;
  // Pick the currency with the largest summed amount as primary.
  entries.sort((a, b) => b[1] - a[1]);
  return { currency: entries[0][0], amount: entries[0][1] };
}

const CURRENCY_SYMBOLS_MINI: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', SGD: 'S$',
};

function formatBigMoney(amount: number): string {
  const n = Math.round(amount);
  return n.toLocaleString();
}

// (Symbol ignored in StatTile — currency goes in the label "Value · USD")
void CURRENCY_SYMBOLS_MINI;

// ─── Filter tabs ─────────────────────────────────────────────────────────
function FilterTabs({
  filter,
  onChange,
  counts,
}: {
  filter: 'all' | 'active' | 'used' | 'expired';
  onChange: (f: 'all' | 'active' | 'used' | 'expired') => void;
  counts: { all: number; active: number; used: number; expired: number };
}) {
  const tabs: Array<{
    id: 'all' | 'active' | 'used' | 'expired';
    label: string;
    count: number;
    color: string;
  }> = [
    { id: 'all',     label: 'All',     count: counts.all,     color: '#00d4ff' },
    { id: 'active',  label: 'Active',  count: counts.active,  color: '#22C55E' },
    { id: 'used',    label: 'Used',    count: counts.used,    color: '#a3adc3' },
    { id: 'expired', label: 'Expired', count: counts.expired, color: '#f87171' },
  ];
  return (
    <div className="mb-5 flex gap-1.5 overflow-x-auto rounded-xl p-1 lg:mb-7 lg:gap-2 lg:p-1.5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      {tabs.map((t) => {
        const active = filter === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
            style={{
              background: active ? `${t.color}1f` : 'transparent',
              border: `1px solid ${active ? `${t.color}50` : 'transparent'}`,
              color: active ? t.color : '#a3adc3',
            }}
          >
            {t.label}
            <span
              className="inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-tight"
              style={{
                background: active ? `${t.color}33` : 'rgba(255,255,255,0.06)',
                color: active ? t.color : '#4a5068',
                minWidth: '18px',
                height: '18px',
              }}
            >
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Empty wallet — first-time onboarding ────────────────────────────────
function EmptyWallet({ onDiscover }: { onDiscover: () => void }) {
  return (
    <div
      className="rounded-2xl p-8 text-center lg:p-12"
      style={{
        background: 'linear-gradient(135deg, rgba(0,212,255,0.06), rgba(167,139,250,0.04))',
        border: '1px dashed rgba(255,255,255,0.1)',
      }}
    >
      <div
        className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}
      >
        <Wallet size={26} />
      </div>
      <h3 className="text-lg font-bold lg:text-xl">No cards in your wallet yet</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-[#a3adc3] lg:text-[13px]">
        Scan a merchant&apos;s QR or tap a shared link to claim a gift card. They&apos;ll appear here, ready to use in-store.
      </p>
      <button
        onClick={onDiscover}
        className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold cursor-pointer"
        style={{ background: '#00d4ff', color: '#0a0b0f' }}
      >
        <Compass size={14} /> Discover drops nearby
      </button>
    </div>
  );
}

// ─── Discover card — filler tile in the grid when there's room ───────────
function DiscoverCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-3 rounded-2xl py-10 text-center cursor-pointer transition-colors hover:bg-white/[0.03]"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px dashed rgba(255,255,255,0.1)',
        minHeight: '13rem',
      }}
    >
      <div
        className="inline-flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}
      >
        <Compass size={20} />
      </div>
      <div>
        <p className="text-sm font-semibold">Discover more drops</p>
        <p className="mt-1 text-[11px] text-[#a3adc3]">Find new gift cards on the map</p>
      </div>
    </button>
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
