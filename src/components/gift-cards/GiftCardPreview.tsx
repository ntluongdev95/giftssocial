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

export type GiftCardPattern = 'none' | 'dots' | 'waves' | 'stars' | 'grid';

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
  // ── Visual makeover props (migration-008) ──────────────────────────
  // Background photo overlaid on the gradient at low opacity. Accepts
  // any URL or same-origin /upload path.
  coverImage?: string | null;
  // Decorative pattern stamped on top of the gradient. 'none' keeps the
  // card clean. SVG-based so it scales sharply on any DPR.
  pattern?: GiftCardPattern;
  // Single emoji rendered prominently (replaces the gold chip when set).
  iconEmoji?: string | null;
  // Short marketing line displayed under the value (max ~80 chars).
  tagline?: string | null;
  // ── Text colour (migration-009) ────────────────────────────────────
  // Default hex colour for every text element on the card. Each tone
  // is derived from this base. Defaults to white when null/missing.
  textColor?: string | null;
  // ── Per-element overrides (migration-010) ─────────────────────────
  // Override the base text colour for individual headline elements.
  // When null, falls back to `textColor`. Each override gets its own
  // luminance-aware shadow so dark text on light bg still pops.
  textColorBusiness?: string | null;
  textColorValue?:    string | null;
  textColorName?:     string | null;
}

export function GiftCardPreview({
  type,
  // Rename JSX-facing props to *Label so we can reuse the tone names
  // `name` / `value` for the derived colour tones below.
  name: nameLabel,
  businessName,
  value: valueLabel,
  gradientFrom,
  gradientTo,
  description,
  footerLeft,
  footerRight,
  statusBadge,
  className = '',
  coverImage,
  pattern = 'none',
  iconEmoji,
  tagline,
  textColor,
  textColorBusiness,
  textColorValue,
  textColorName,
}: GiftCardPreviewProps) {
  // Resolve per-element colour with cascade:
  //   element override → default text_color → white
  // Each element gets its OWN opacity tones derived from its hex so the
  // shadows/borders match the colour. This keeps a red value text from
  // looking weirdly tinted by a separate purple name colour.
  const fallback = isHex(textColor) ? textColor : '#ffffff';
  const businessHex = isHex(textColorBusiness) ? textColorBusiness : fallback;
  const valueHex    = isHex(textColorValue)    ? textColorValue    : fallback;
  const nameHex     = isHex(textColorName)     ? textColorName     : fallback;
  const tx       = deriveTones(fallback);    // footer, subtitle, attribution
  const business = deriveTones(businessHex); // business name + status badge
  const value    = deriveTones(valueHex);    // big value + tagline pill
  const name     = deriveTones(nameHex);     // card name + description
  const valueShadow    = shadowFor(valueHex);
  const businessShadow = shadowFor(businessHex);
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

      {/* Background cover image — sits ABOVE the gradient but BELOW the
          dark/light radial overlays so the gradient still bleeds through
          and the text-over-photo contrast stays readable. */}
      {coverImage && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${coverImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.55,
          }}
        />
      )}
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
      {/* Decorative pattern overlay — sits above the radials. Each entry is
          a pure CSS background image so the SVG never bloats the DOM. */}
      {pattern !== 'none' && (
        <div
          className="absolute inset-0 pointer-events-none mix-blend-overlay"
          style={getPatternStyle(pattern)}
        />
      )}
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
              className="block text-[9px] font-bold uppercase tracking-[0.28em] truncate"
              style={{ color: business.strong, textShadow: businessShadow }}
            >
              {businessName || 'Your business'}
            </span>
            <span className="mt-1 block text-[8px] uppercase tracking-[0.3em]" style={{ color: business.faint }}>
              Gao · Giftcard
            </span>
          </div>
          {statusBadge ?? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider"
              style={{
                background: business.fill,
                color: business.primary,
                border: `1px solid ${business.fillBorder}`,
                backdropFilter: 'blur(6px)',
              }}
            >
              {TYPE_LABEL[type]}
            </span>
          )}
        </div>

        {/* Chip OR emoji — emoji takes precedence so merchant can pick
            their own brand mark. Chip stays as the default for cards
            without an emoji. */}
        <div className="mt-3.5">
          {iconEmoji ? (
            <span
              className="inline-flex items-center justify-center text-[34px] leading-none"
              style={{
                filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.35))',
              }}
              aria-hidden
            >
              {iconEmoji}
            </span>
          ) : (
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
          )}
        </div>

        <div className="mt-auto">
          <p
            className="text-[1.85rem] leading-none font-black tracking-tight"
            style={{
              color: value.primary,
              textShadow: valueShadow,
              fontFeatureSettings: '"ss01", "tnum"',
            }}
          >
            {valueLabel}
          </p>
          {tagline && (
            <p
              className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{
                color: value.strong,
                background: value.fill,
                border: `1px solid ${value.fillBorder}`,
                backdropFilter: 'blur(4px)',
              }}
            >
              {tagline}
            </p>
          )}
          <h3 className="mt-1.5 text-[13px] font-semibold truncate" style={{ color: name.body }}>
            {nameLabel || 'Card name'}
          </h3>
          {description && (
            <p className="mt-1 text-[10.5px] line-clamp-1 leading-snug" style={{ color: name.subtle }}>
              {description}
            </p>
          )}
        </div>

        <div
          className="mt-3 pt-2.5 flex items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-[0.18em]"
          style={{ color: tx.footer, borderTop: `1px solid ${tx.line}` }}
        >
          <span className="flex items-center gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="inline-block h-1 w-3 rounded-full"
                style={{ background: tx.dot }}
              />
            ))}
            <span className="ml-1.5 truncate">{footerLeft || TYPE_LABEL[type]}</span>
          </span>
          {footerRight && <span className="truncate">{footerRight}</span>}
        </div>

        <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[8px] font-bold uppercase tracking-[0.4em]" style={{ color: tx.subtle }}>
          <span
            className="inline-flex items-center justify-center h-4 w-4 rounded-full"
            style={{
              background: tx.fill,
              border: `1px solid ${tx.fillBorder}`,
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

// Type guard for our hex-string columns. Cheap regex, no allocs.
function isHex(v: string | null | undefined): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v);
}

// Returns the opacity-tone palette derived from a single hex. Every
// text element on the card renders against one of these palettes so
// per-element colour overrides keep their borders/shadows in sync.
function deriveTones(hex: string) {
  return {
    primary:    hexToRgba(hex, 1.0),
    strong:     hexToRgba(hex, 0.95),
    body:       hexToRgba(hex, 0.9),
    footer:     hexToRgba(hex, 0.75),
    subtle:     hexToRgba(hex, 0.65),
    faint:      hexToRgba(hex, 0.55),
    line:       hexToRgba(hex, 0.22),
    fill:       hexToRgba(hex, 0.16),
    fillBorder: hexToRgba(hex, 0.22),
    dot:        hexToRgba(hex, 0.45),
  };
}

// Drop-shadow that flips direction based on colour luminance:
//   light text → soft dark shadow (legibility on coloured bg)
//   dark text  → soft white halo (legibility on light bg)
function shadowFor(hex: string): string {
  return isLightColor(hex)
    ? '0 2px 14px rgba(0,0,0,0.28)'
    : '0 0 10px rgba(255,255,255,0.35)';
}

// Convert a hex string to an `rgba()` colour. Used to derive opacity
// tones from the single text_color the merchant picked, so we don't
// need separate columns for every shade on the card.
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Rough luminance check (sRGB-weighted average). Returns true for "light"
// colours so we can flip the text-shadow direction for legibility.
function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6;
}

// CSS-only pattern overlays. Each returns a style object usable on a
// pointer-events-none absolute layer above the gradient. Kept here so
// the preview component and the merchant Theme picker stay in sync.
function getPatternStyle(pattern: GiftCardPattern): React.CSSProperties {
  switch (pattern) {
    case 'dots':
      return {
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.5) 1.2px, transparent 1.6px)',
        backgroundSize: '14px 14px',
        opacity: 0.6,
      };
    case 'waves':
      return {
        backgroundImage:
          'repeating-radial-gradient(circle at 50% 120%, rgba(255,255,255,0.18) 0 1px, transparent 1px 14px)',
        opacity: 0.7,
      };
    case 'stars': {
      // Lightweight SVG of three offset stars, tiled.
      const svg = encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>
          <g fill='rgba(255,255,255,0.65)'>
            <path d='M8 6 L9 9 L12 10 L9 11 L8 14 L7 11 L4 10 L7 9 Z'/>
            <path d='M28 18 L29 20 L31 21 L29 22 L28 24 L27 22 L25 21 L27 20 Z'/>
            <path d='M18 30 L19 32 L21 33 L19 34 L18 36 L17 34 L15 33 L17 32 Z'/>
          </g>
        </svg>`,
      );
      return {
        backgroundImage: `url("data:image/svg+xml,${svg}")`,
        backgroundSize: '60px 60px',
        opacity: 0.85,
      };
    }
    case 'grid':
      return {
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.32) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.32) 1px, transparent 1px)
        `,
        backgroundSize: '22px 22px',
        opacity: 0.4,
      };
    case 'none':
    default:
      return {};
  }
}
