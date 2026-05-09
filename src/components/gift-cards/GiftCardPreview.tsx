'use client';

// ─── Shared gift-card preview component + value-formatting helpers ────────
// Used by both the merchant dashboard (/me/gift-cards) and the public claim
// page (/g/[token]). Premium card design with mesh gradient, gold chip,
// holographic shimmer, and a Gao Social wordmark.

export interface TemplateLite {
  type: 'voucher' | 'stored_value' | 'service' | 'loyalty';
  name?: string;
  description?: string;
  business_name?: string | null;
  face_value?: number;
  percent_off?: number;
  amount_off?: number;
  service_name?: string | null;
  currency?: string;
  gradient_from?: string;
  gradient_to?: string;
}

export const TYPE_LABEL: Record<TemplateLite['type'], string> = {
  voucher: 'Voucher',
  stored_value: 'Stored value',
  service: 'Service voucher',
  loyalty: 'Loyalty stamp',
};

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', SGD: 'S$',
};

export function formatMoney(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency];
  const n = Math.round(amount).toLocaleString();
  return sym ? `${sym}${n}` : `${currency} ${n}`;
}

export function formatValue(t: TemplateLite): string {
  const currency = t.currency || 'USD';
  if (t.type === 'stored_value') return formatMoney(t.face_value ?? 0, currency);
  if (t.type === 'voucher') {
    if ((t.percent_off ?? 0) > 0) return `${t.percent_off}% off`;
    if ((t.amount_off ?? 0) > 0) return `${formatMoney(t.amount_off ?? 0, currency)} off`;
  }
  if (t.type === 'service') return t.service_name || 'Free service';
  if (t.type === 'loyalty') return 'Loyalty card';
  return '—';
}

export interface GiftCardPreviewProps {
  type: TemplateLite['type'];
  name: string;
  businessName?: string | null;
  value: string;
  gradientFrom: string;
  gradientTo: string;
  description?: string;
  footerLeft?: string;
  footerRight?: string;
  statusBadge?: React.ReactNode;
  className?: string;
}

export function GiftCardPreview({
  type,
  name,
  businessName,
  value,
  gradientFrom,
  gradientTo,
  description,
  footerLeft,
  footerRight,
  statusBadge,
  className = '',
}: GiftCardPreviewProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[20px] group ${className}`}
      style={{
        background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
        boxShadow: `0 24px 60px -24px ${gradientFrom}aa, 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.2)`,
        minHeight: '11.5rem',
      }}
    >
      <style>{`
        @keyframes giftcard-sheen {
          0%   { transform: translateX(-120%) skewX(-20deg); }
          100% { transform: translateX(220%) skewX(-20deg); }
        }
        @keyframes giftcard-orbit {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(at 18% 22%, rgba(255,255,255,0.22), transparent 38%),
            radial-gradient(at 82% 88%, rgba(0,0,0,0.32), transparent 48%),
            radial-gradient(at 70% 12%, rgba(255,255,255,0.14), transparent 32%)
          `,
        }}
      />
      <div
        className="absolute -top-24 -right-24 h-56 w-56 rounded-full pointer-events-none opacity-40 mix-blend-screen"
        style={{
          background: 'conic-gradient(from 220deg, rgba(255,255,255,0.5), transparent 30%, rgba(255,255,255,0.25) 70%, transparent)',
          animation: 'giftcard-orbit 22s linear infinite',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage: 'repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 9px)',
        }}
      />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -inset-y-4 w-1/3"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)',
            animation: 'giftcard-sheen 5.5s ease-in-out infinite',
            animationDelay: '0.8s',
          }}
        />
      </div>

      <div className="relative p-5 flex flex-col h-full min-h-46">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span
              className="block text-[9px] font-bold uppercase tracking-[0.28em] text-white/95 truncate"
              style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
            >
              {businessName || 'Your business'}
            </span>
            <span className="mt-1 block text-[8px] uppercase tracking-[0.3em] text-white/55">
              Gao · Giftcard
            </span>
          </div>
          {statusBadge ?? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider"
              style={{
                background: 'rgba(255,255,255,0.16)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.22)',
                backdropFilter: 'blur(6px)',
              }}
            >
              {TYPE_LABEL[type]}
            </span>
          )}
        </div>

        <div className="mt-3.5">
          <div
            className="relative h-7 w-9 rounded-md overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #f6e6a3 0%, #d4af37 45%, #8a6e1f 100%)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.35)',
            }}
          >
            <div
              className="absolute inset-1"
              style={{
                background: `
                  linear-gradient(0deg,  transparent 47%, rgba(0,0,0,0.35) 47% 53%, transparent 53%),
                  linear-gradient(90deg, transparent 47%, rgba(0,0,0,0.35) 47% 53%, transparent 53%)
                `,
              }}
            />
          </div>
        </div>

        <div className="mt-auto">
          <p
            className="text-[1.85rem] leading-none font-black tracking-tight text-white"
            style={{
              textShadow: '0 2px 14px rgba(0,0,0,0.28)',
              fontFeatureSettings: '"ss01", "tnum"',
            }}
          >
            {value}
          </p>
          <h3 className="mt-1.5 text-[13px] font-semibold text-white/90 truncate">{name || 'Card name'}</h3>
          {description && (
            <p className="mt-1 text-[10.5px] text-white/65 line-clamp-1 leading-snug">{description}</p>
          )}
        </div>

        <div
          className="mt-3 pt-2.5 flex items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-white/75"
          style={{ borderTop: '1px solid rgba(255,255,255,0.22)' }}
        >
          <span className="flex items-center gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="inline-block h-1 w-3 rounded-full"
                style={{ background: 'rgba(255,255,255,0.45)' }}
              />
            ))}
            <span className="ml-1.5 truncate">{footerLeft || TYPE_LABEL[type]}</span>
          </span>
          {footerRight && <span className="truncate">{footerRight}</span>}
        </div>

        <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[8px] font-bold uppercase tracking-[0.4em] text-white/65">
          <span
            className="inline-flex items-center justify-center h-4 w-4 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.25)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <img
              src="/images/gao-logo-v2.png"
              alt=""
              className="h-3 w-3 object-contain"
              style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))' }}
            />
          </span>
          <span>Gao Social</span>
        </div>
      </div>
    </div>
  );
}
