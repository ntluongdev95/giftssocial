'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ArrowLeft, Search, Filter, Loader2, Tag, Sparkles, Clock, Coins, Store, ChevronDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

type MarketItem = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  tagline: string | null;
  type: 'voucher' | 'stored_value' | 'service' | 'loyalty';
  face_value: number;
  percent_off: number;
  amount_off: number;
  service_name: string | null;
  currency: string;
  cover_image: string | null;
  gradient_from: string;
  gradient_to: string;
  pattern: string;
  icon_emoji: string | null;
  price: number;
  price_currency: string;
  max_claims: number;
  current_claims: number;
  ends_at: string | null;
  expires_in_days: number;
  business_name: string | null;
  business_cover: string | null;
  business_city: string | null;
  business_category: string | null;
  claim_token?: string;
};

type MarketResp = { data: { items: MarketItem[]; next_cursor: string | null } };

const fetcher = (url: string) =>
  fetch(url, { credentials: 'same-origin' }).then(async r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<MarketResp>;
  });

// ─── Filter / sort options ────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'voucher', label: 'Voucher' },
  { value: 'stored_value', label: 'Stored Value' },
  { value: 'service', label: 'Service' },
  { value: 'loyalty', label: 'Loyalty' },
] as const;

const SORT_OPTIONS = [
  { value: 'new', label: 'Newest' },
  { value: 'popular', label: 'Most claimed' },
  { value: 'ending_soon', label: 'Ending soon' },
  { value: 'price_asc', label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────

export default function GiftCardMarketPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [sort, setSort] = useState('new');
  const [showFilter, setShowFilter] = useState(false);

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (type) params.set('type', type);
  params.set('sort', sort);
  params.set('limit', '24');

  const { data, error, isLoading } = useSWR<MarketResp>(
    `/api/v1/gift-cards/market?${params.toString()}`,
    fetcher,
  );

  const items = data?.data.items ?? [];

  return (
    // Parent (app) layout uses `overflow-hidden` on <main>, so this page
    // needs its own h-full + overflow-y-auto wrapper to scroll.
    <div className="h-full overflow-y-auto bg-[#0a0b0f] text-white">
      {/* Sticky header */}
      <header
        className="sticky top-0 z-10"
        style={{
          background: 'rgba(10,11,15,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-[#a3adc3] hover:text-white cursor-pointer transition-colors"
          >
            <ArrowLeft size={18} /> Back
          </button>
          <h1 className="text-base lg:text-lg font-bold ml-auto mr-auto flex items-center gap-1.5">
            <Sparkles size={16} className="text-[#00d4ff]" />
            Gift Card Market
          </h1>
          <div className="w-14" />
        </div>

        {/* Search + filter row */}
        <div className="max-w-6xl mx-auto px-4 lg:px-8 pb-3 flex items-center gap-2">
          <div
            className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <Search size={14} className="text-[#4a5068] shrink-0" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search cards or businesses..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-[#4a5068] outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilter(v => !v)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 cursor-pointer"
            style={{
              background: showFilter ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)',
              border: showFilter ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
              color: showFilter ? '#00d4ff' : '#a3adc3',
            }}
          >
            <Filter size={14} />
            <span className="text-xs font-semibold hidden sm:inline">Filter</span>
          </button>
        </div>

        {/* Expandable filter row */}
        {showFilter && (
          <div className="max-w-6xl mx-auto px-4 lg:px-8 pb-3 flex flex-wrap items-center gap-2">
            {/* Type pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {TYPE_OPTIONS.map(opt => {
                const active = type === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setType(opt.value)}
                    className="text-[11px] px-2.5 py-1 rounded-full cursor-pointer transition-colors"
                    style={
                      active
                        ? { background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }
                        : { background: 'rgba(255,255,255,0.03)', color: '#a3adc3', border: '1px solid rgba(255,255,255,0.05)' }
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {/* Sort dropdown */}
            <div className="relative ml-auto">
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="text-[11px] rounded-full pl-3 pr-8 py-1.5 cursor-pointer appearance-none"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  color: '#a3adc3',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value} style={{ background: '#0a0b0f', color: 'white' }}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4a5068] pointer-events-none" />
            </div>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 lg:px-8 py-4 pb-20">
        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-[#4a5068]">
            <Loader2 className="animate-spin text-[#00d4ff]" size={24} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="rounded-xl p-4 text-sm"
            style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', color: '#fca5a5' }}
          >
            Couldn&apos;t load marketplace. {String(error.message ?? error)}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && items.length === 0 && (
          <div
            className="rounded-2xl p-12 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <Sparkles size={32} className="mx-auto mb-3 text-[#2d3548]" />
            <p className="font-medium text-[#a3adc3] mb-1">No cards available</p>
            <p className="text-xs text-[#4a5068]">
              {q || type ? 'Try clearing your filters.' : 'Businesses haven’t listed cards yet.'}
            </p>
          </div>
        )}

        {/* Grid */}
        {!isLoading && items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(item => (
              <CardTile key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Card tile ────────────────────────────────────────────────────────────

function CardTile({ item }: { item: MarketItem }) {
  const valueLabel = describeValue(item);
  const stockLabel = describeStock(item);
  const endingLabel = describeEnding(item.ends_at);

  // Marketplace tiles deep-link into the existing claim page (`/g/<token>`).
  // The page already handles auth, eligibility, and the actual claim button.
  const href = item.claim_token ? `/g/${item.claim_token}` : `/gift-cards/${item.id}`;

  return (
    <Link
      href={href}
      className="group block rounded-2xl overflow-hidden transition-transform hover:-translate-y-0.5 cursor-pointer"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Visual card preview */}
      <div
        className="relative aspect-16/10 flex flex-col justify-between p-4 text-white"
        style={{
          background: `linear-gradient(135deg, ${item.gradient_from}, ${item.gradient_to})`,
        }}
      >
        {/* Top row: business */}
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-white/80">
          {item.icon_emoji && <span className="text-base leading-none">{item.icon_emoji}</span>}
          <span className="truncate">{item.business_name || 'Gao Business'}</span>
        </div>

        {/* Bottom: name + value */}
        <div>
          <div className="text-base font-bold leading-tight truncate">{item.name}</div>
          {item.tagline && (
            <div className="text-[10px] text-white/80 truncate mt-0.5">{item.tagline}</div>
          )}
          <div className="text-xs font-semibold mt-1.5 text-white/95">{valueLabel}</div>
        </div>

        {/* Type chip */}
        <span
          className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(0,0,0,0.25)', color: 'white' }}
        >
          {item.type === 'stored_value' ? 'card' : item.type}
        </span>
      </div>

      {/* Meta row */}
      <div className="p-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] text-[#4a5068]">
            <Store size={10} />
            <span className="truncate">{item.business_city || item.business_category || '—'}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-[#a3adc3]">
            {stockLabel && (
              <span className="flex items-center gap-1">
                <Tag size={10} /> {stockLabel}
              </span>
            )}
            {endingLabel && (
              <span className="flex items-center gap-1 text-[#fbbf24]">
                <Clock size={10} /> {endingLabel}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          {item.price > 0 ? (
            <div className="text-sm font-bold text-[#00d4ff] flex items-center gap-1">
              <Coins size={12} /> {item.price.toLocaleString()}
              <span className="text-[9px] text-[#4a5068] ml-0.5">{item.price_currency}</span>
            </div>
          ) : (
            <div className="text-sm font-bold text-[#34d399]">Free</div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function describeValue(item: MarketItem): string {
  if (item.type === 'stored_value') {
    return `Worth ${item.face_value.toLocaleString()} ${item.currency}`;
  }
  if (item.type === 'voucher') {
    if (item.percent_off) return `${item.percent_off}% off`;
    if (item.amount_off) return `${item.amount_off.toLocaleString()} ${item.currency} off`;
    return 'Voucher';
  }
  if (item.type === 'service') {
    return item.service_name ? `Free ${item.service_name}` : 'Free service';
  }
  return 'Loyalty';
}

function describeStock(item: MarketItem): string | null {
  if (item.max_claims === 0) return null;
  const left = item.max_claims - item.current_claims;
  if (left <= 0) return 'Sold out';
  return `${left} left`;
}

function describeEnding(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / 86400_000);
  if (days >= 1) return `${days}d left`;
  const hours = Math.max(1, Math.floor(ms / 3600_000));
  return `${hours}h left`;
}
