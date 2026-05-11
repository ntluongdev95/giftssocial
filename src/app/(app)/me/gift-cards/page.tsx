'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { ArrowLeft, Plus, Gift, Loader2, Store, Pencil, Trash2, X, QrCode, Copy, Download, ScanLine, Send } from 'lucide-react';
import { toast } from 'sonner';
import QRCodeLib from 'qrcode';
import { GiftCardPreview, TYPE_LABEL, formatValue } from '@/components/gift-cards/GiftCardPreview';
import SendGiftModal, { type SendGiftTarget } from '@/components/gift-cards/SendGiftModal';

interface BusinessRow {
  id: string;
  name: string;
  cover_image?: string;
}

interface TemplateRow {
  id: string;
  business_id: string;
  business_name?: string;
  business_cover?: string;
  name: string;
  description: string;
  type: 'voucher' | 'stored_value' | 'service' | 'loyalty';
  face_value: number;
  percent_off: number;
  amount_off: number;
  service_name?: string;
  currency: string;
  cover_image?: string;
  gradient_from: string;
  gradient_to: string;
  // Visual customization (migration-008)
  pattern?: 'none' | 'dots' | 'waves' | 'stars' | 'grid';
  icon_emoji?: string | null;
  tagline?: string | null;
  claim_token: string;
  max_claims: number;
  current_claims: number;
  one_per_user: number;
  expires_in_days: number;
  status: 'draft' | 'active' | 'paused' | 'archived';
  created_at: string;
}

// Preset themes — one-tap apply to fill gradient/pattern/emoji.
interface Theme {
  id: string;
  name: string;
  gradient_from: string;
  gradient_to: string;
  pattern: 'none' | 'dots' | 'waves' | 'stars' | 'grid';
  icon_emoji?: string;
}
const THEMES: Theme[] = [
  // Generic
  { id: 'default',     name: 'Default',     gradient_from: '#00d4ff', gradient_to: '#a78bfa', pattern: 'none' },
  // ── Spa / Nails / Beauty industry themes ──────────────────────────
  { id: 'nail-salon',  name: 'Nail Salon',  gradient_from: '#ffd1dc', gradient_to: '#ffe4b5', pattern: 'dots',  icon_emoji: '💅' },
  { id: 'spa-zen',     name: 'Spa Zen',     gradient_from: '#c4d8b4', gradient_to: '#f5f0e1', pattern: 'none',  icon_emoji: '🍃' },
  { id: 'glamour',     name: 'Glamour',     gradient_from: '#1a1a2e', gradient_to: '#d4af37', pattern: 'grid',  icon_emoji: '💄' },
  { id: 'rose-gold',   name: 'Rose Gold',   gradient_from: '#e8b4b8', gradient_to: '#f7e7c4', pattern: 'none',  icon_emoji: '🌹' },
  { id: 'bridal',      name: 'Bridal',      gradient_from: '#ffffff', gradient_to: '#fef0f3', pattern: 'dots',  icon_emoji: '💍' },
  { id: 'coquette',    name: 'Coquette',    gradient_from: '#ffc0cb', gradient_to: '#fff8dc', pattern: 'stars', icon_emoji: '🎀' },
  { id: 'botanical',   name: 'Botanical',   gradient_from: '#a8d5ba', gradient_to: '#e8d5a8', pattern: 'waves', icon_emoji: '🌿' },
  { id: 'luxury',      name: 'Luxury',      gradient_from: '#0a0b0f', gradient_to: '#8a6e1f', pattern: 'grid',  icon_emoji: '👑' },
  // Generic crowd-pleasers
  { id: 'festive',     name: 'Festive',     gradient_from: '#ff5e5e', gradient_to: '#c41e3a', pattern: 'stars', icon_emoji: '🎉' },
  { id: 'minimal',     name: 'Minimal',     gradient_from: '#1a1a2e', gradient_to: '#3a3a4e', pattern: 'grid' },
  { id: 'sunset',      name: 'Sunset',      gradient_from: '#ff6f61', gradient_to: '#ffb86c', pattern: 'waves', icon_emoji: '🌅' },
  { id: 'holographic', name: 'Holographic', gradient_from: '#a78bfa', gradient_to: '#00d4ff', pattern: 'dots',  icon_emoji: '✨' },
  { id: 'pastel',      name: 'Pastel',      gradient_from: '#ffd1dc', gradient_to: '#a8e6cf', pattern: 'dots',  icon_emoji: '🌸' },
  { id: 'cyber',       name: 'Cyber',       gradient_from: '#00ffd1', gradient_to: '#7a5cff', pattern: 'grid',  icon_emoji: '⚡' },
];

// ─── Curated emoji picker ────────────────────────────────────────────
// Grouped icons that fit common gift-card scenarios. Order matters —
// most relevant for beauty/spa/F&B first since those are the businesses
// most likely to publish drops here. User can still type a custom emoji
// via the input shown beneath the grid.
const EMOJI_GROUPS: { label: string; icons: string[] }[] = [
  { label: 'Beauty', icons: ['💅', '💋', '💄', '🌹', '🌸', '🌺', '✨', '💖', '🎀', '👑', '💎', '🪞'] },
  { label: 'Spa',    icons: ['🧖', '🍃', '🌿', '💆', '🕯️', '🛁', '🪷', '🌙', '☮️', '🧘'] },
  { label: 'Food',   icons: ['🍰', '🍩', '☕', '🍷', '🍦', '🍣', '🍕', '🍔', '🥂', '🍪', '🥐', '🍫'] },
  { label: 'Gift',   icons: ['🎁', '🎉', '🎊', '🎈', '⭐', '🔥', '💝', '💯', '🌟', '⚡', '☀️', '❤️'] },
];

const fetcher = (url: string) => fetch(url, { credentials: 'same-origin' }).then((r) => r.json());

// Card preview + value-formatting helpers live in a shared module so the
// public claim page (/g/[token]) can render the same premium card.

export default function GiftCardsAdminPage() {
  const router = useRouter();
  // /api/v1/businesses/me returns { data: <one business> | null }, not an array.
  const { data: bizData, isLoading: loadingBiz } = useSWR<{ data: BusinessRow | null }>('/api/v1/businesses/me', fetcher);
  const { data: templatesData, isLoading } = useSWR<{ data: TemplateRow[] }>('/api/v1/gift-cards/templates', fetcher);

  // Form panel: closed by default, opens for `create` or for editing a row.
  const [panel, setPanel] = useState<{ mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; row: TemplateRow }>({ mode: 'closed' });
  const [pendingDelete, setPendingDelete] = useState<TemplateRow | null>(null);
  const [giftTarget, setGiftTarget] = useState<SendGiftTarget | null>(null);
  const [qrFor, setQrFor] = useState<TemplateRow | null>(null);

  const myBusiness = bizData?.data || null;
  const businesses: BusinessRow[] = myBusiness ? [myBusiness] : [];
  const templates = templatesData?.data || [];

  const closePanel = () => setPanel({ mode: 'closed' });
  const handleSaved = () => {
    mutate('/api/v1/gift-cards/templates');
    closePanel();
  };

  return (
    <div className="h-full overflow-y-auto relative" style={{ background: '#0a0b0f', color: '#f0f4ff' }}>
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{ background: 'rgba(10,11,15,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-lg font-bold">Gift Cards</h1>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Loading state */}
        {loadingBiz && (
          <div className="flex items-center justify-center py-16 text-[#4a5068]">
            <Loader2 size={20} className="animate-spin" />
          </div>
        )}

        {/* No business yet */}
        {!loadingBiz && businesses.length === 0 && (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <Store size={32} className="mx-auto mb-3 text-[#4a5068]" />
            <h2 className="text-base font-semibold">You need a business first</h2>
            <p className="mt-1 text-xs text-[#a3adc3]">
              Gift cards belong to a business profile. Create one to start issuing cards.
            </p>
            <button
              onClick={() => router.push('/me/business')}
              className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer"
              style={{ background: '#00d4ff', color: '#0a0b0f' }}
            >
              <Plus size={14} /> Create business
            </button>
          </div>
        )}

        {businesses.length > 0 && (
          <section>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Gift size={20} className="text-[#00d4ff] shrink-0" />
                  <span>Your gift card drops</span>
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#a3adc3] sm:text-xs">
                  Each drop is a card customers can claim by scanning a QR. They show up in their wallet, and you redeem in-store.
                </p>
              </div>

              {/* Action buttons — Scan + Create grouped together. Stack
                  full-width on mobile, side-by-side on sm+. */}
              <div className="flex flex-col gap-2 shrink-0 sm:flex-row sm:items-center sm:gap-2">
                {templates.length > 0 && (
                  <button
                    onClick={() => router.push('/me/gift-cards/scan')}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold cursor-pointer sm:w-auto"
                    style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22C55E' }}
                  >
                    <ScanLine size={14} /> Scan to redeem
                  </button>
                )}
                <button
                  onClick={() => setPanel({ mode: 'create' })}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold cursor-pointer sm:w-auto"
                  style={{ background: '#00d4ff', color: '#0a0b0f' }}
                >
                  <Plus size={14} /> Create new drop
                </button>
              </div>
            </div>

            {/* Inline panel — opens on Create or Edit */}
            {panel.mode !== 'closed' && (
              <div className="mb-6">
                <div className="mb-2.5 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#a3adc3]">
                    {panel.mode === 'create' ? 'Create new drop' : 'Edit drop'}
                  </h3>
                  <button
                    onClick={closePanel}
                    className="flex h-7 w-7 items-center justify-center rounded-full cursor-pointer text-[#4a5068] hover:text-white"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                    aria-label="Close"
                  >
                    <X size={14} />
                  </button>
                </div>
                <CreateForm
                  businesses={businesses}
                  initial={panel.mode === 'edit' ? panel.row : undefined}
                  onSaved={handleSaved}
                />
              </div>
            )}

            {/* Drops list */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-[#4a5068]">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div
                className="rounded-2xl p-8 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)' }}
              >
                <Gift size={32} className="mx-auto mb-3 text-[#4a5068]" />
                <p className="text-sm font-semibold">No drops yet</p>
                <p className="mt-1 text-xs text-[#a3adc3]">Tap “Create new drop” to publish your first gift card.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onEdit={() => setPanel({ mode: 'edit', row: t })}
                    onDelete={() => setPendingDelete(t)}
                    onShowQr={() => setQrFor(t)}
                    onGift={() => setGiftTarget({
                      mode: 'template',
                      id: t.id,
                      template_name: t.name,
                      business_name: t.business_name,
                    })}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Delete confirmation */}
      {pendingDelete && (
        <ConfirmDelete
          row={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onDeleted={() => {
            setPendingDelete(null);
            mutate('/api/v1/gift-cards/templates');
          }}
        />
      )}

      {/* QR display */}
      {qrFor && <QrShareModal row={qrFor} onClose={() => setQrFor(null)} />}

      {/* Send-as-gift modal */}
      {giftTarget && (
        <SendGiftModal
          target={giftTarget}
          onClose={() => setGiftTarget(null)}
          onSent={() => mutate('/api/v1/gift-cards/templates')}
        />
      )}
    </div>
  );
}

function TemplateCard({
  template: t,
  onEdit,
  onDelete,
  onShowQr,
  onGift,
}: {
  template: TemplateRow;
  onEdit: () => void;
  onDelete: () => void;
  onShowQr: () => void;
  onGift: () => void;
}) {
  const claimsLabel = t.max_claims > 0 ? `${t.current_claims}/${t.max_claims}` : `${t.current_claims} claimed`;
  const statusColor = t.status === 'active' ? '#22C55E' : t.status === 'paused' ? '#fbbf24' : '#4a5068';
  return (
    <div className="flex flex-col gap-2 h-full">
      <GiftCardPreview
        className="flex-1"
        type={t.type}
        name={t.name}
        businessName={t.business_name}
        value={formatValue(t)}
        gradientFrom={t.gradient_from}
        gradientTo={t.gradient_to}
        description={t.description}
        footerLeft={`Valid ${t.expires_in_days}d`}
        footerRight={claimsLabel}
        coverImage={t.cover_image}
        pattern={t.pattern}
        iconEmoji={t.icon_emoji}
        tagline={t.tagline}
        statusBadge={
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur"
            style={{ background: `${statusColor}33`, color: 'white', border: `1px solid ${statusColor}55` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor }} /> {t.status}
          </span>
        }
      />
      {/* Action row */}
      <div className="flex items-center gap-2">
        <button
          onClick={onShowQr}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold cursor-pointer transition-colors"
          style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.18)', color: '#00d4ff' }}
        >
          <QrCode size={12} /> Share QR
        </button>
        <button
          onClick={onGift}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold cursor-pointer transition-colors"
          style={{ background: 'rgba(255,111,168,0.1)', border: '1px solid rgba(255,111,168,0.25)', color: '#ff6fa8' }}
          aria-label="Send as gift"
          title="Send to a user"
        >
          <Send size={12} />
        </button>
        <button
          onClick={onEdit}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold cursor-pointer transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#a3adc3' }}
          aria-label="Edit drop"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold cursor-pointer transition-colors"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)', color: '#f87171' }}
          aria-label="Delete drop"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── QR share modal ────────────────────────────────────────────────────────
function QrShareModal({ row, onClose }: { row: TemplateRow; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string>('');
  // useState initializer runs once on mount; safe with `typeof window` guard
  // and avoids the set-state-in-effect lint that fires when we setOrigin
  // synchronously inside an effect.
  const [origin] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.origin : ''
  );

  const claimUrl = origin ? `${origin}/g/${row.claim_token}` : '';

  useEffect(() => {
    if (!claimUrl) return;
    QRCodeLib.toDataURL(claimUrl, {
      width: 640,
      margin: 2,
      color: { dark: '#0a0b0f', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    })
      .then(setDataUrl)
      .catch((e) => {
        console.error('[QR generate]', e);
        toast.error('Failed to render QR');
      });
  }, [claimUrl]);

  const copy = async () => {
    if (!claimUrl) return;
    // Path 1: modern Clipboard API. Requires HTTPS or localhost + secure context.
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(claimUrl);
        toast.success('Link copied');
        return;
      }
    } catch (e) {
      console.warn('[clipboard.writeText failed, falling back]', e);
    }
    // Path 2: textarea + execCommand fallback (works on older WebViews / non-HTTPS).
    try {
      const ta = document.createElement('textarea');
      ta.value = claimUrl;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (ok) {
        toast.success('Link copied');
      } else {
        toast.error('Long-press the link to copy');
      }
    } catch (e) {
      console.error('[copy fallback failed]', e);
      toast.error('Long-press the link to copy');
    }
  };

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${row.name.replace(/\s+/g, '-').toLowerCase()}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div
      className="fixed inset-0 z-1000 flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl"
        style={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="min-w-0">
            <h3 className="text-base font-bold truncate">Share “{row.name}”</h3>
            <p className="mt-0.5 text-[11px] text-[#a3adc3]">
              Customers scan this to claim the card.
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

        {/* QR */}
        <div className="px-5 pt-5">
          <div
            className="mx-auto flex aspect-square w-full max-w-70 items-center justify-center rounded-2xl p-3"
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #f4f5f7 100%)',
              boxShadow: `0 18px 48px -20px ${row.gradient_from}88, inset 0 0 0 1px rgba(255,255,255,0.6)`,
            }}
          >
            {dataUrl ? (
              <img src={dataUrl} alt="Claim QR" className="h-full w-full object-contain" />
            ) : (
              <Loader2 size={24} className="animate-spin text-[#4a5068]" />
            )}
          </div>
          {/* Card name as a tiny caption under the QR */}
          <p className="mt-3 text-center text-[10px] uppercase tracking-[0.2em] text-[#4a5068]">
            Scan to claim · Gao Social
          </p>
        </div>

        {/* Link row */}
        <div className="px-5 pt-4">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={claimUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 rounded-lg px-3 py-2.5 text-[12px] font-mono cursor-text"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#f0f4ff',
              }}
            />
            <button
              onClick={copy}
              className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-lg cursor-pointer"
              style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}
              aria-label="Copy link"
            >
              <Copy size={14} />
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-[#4a5068]">
            Token: <span className="font-mono">{row.claim_token}</span>
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 py-5">
          <button
            onClick={download}
            disabled={!dataUrl}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#f0f4ff' }}
          >
            <Download size={14} /> Download PNG
          </button>
          <button
            onClick={copy}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold cursor-pointer"
            style={{ background: '#00d4ff', color: '#0a0b0f' }}
          >
            <Copy size={14} /> Copy link
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm-delete sheet ──────────────────────────────────────────────────
function ConfirmDelete({
  row,
  onCancel,
  onDeleted,
}: {
  row: TemplateRow;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/gift-cards/templates/${row.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to delete');
      toast.success(json?.data?.archived ? 'Drop archived (had claims)' : 'Drop deleted');
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-1000 flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5"
        style={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <h3 className="text-base font-bold">Delete this drop?</h3>
        <p className="mt-1 text-xs text-[#a3adc3]">
          “{row.name}” will be removed. If anyone has already claimed this card,
          we&apos;ll archive it instead so existing claims keep working.
        </p>
        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#f0f4ff' }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#f87171', color: '#0a0b0f' }}
          >
            {busy ? <Loader2 size={14} className="inline animate-spin mr-1.5" /> : <Trash2 size={14} className="inline mr-1.5" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline create / edit form ────────────────────────────────────────────
function CreateForm({
  businesses,
  initial,
  onSaved,
}: {
  businesses: BusinessRow[];
  initial?: TemplateRow;          // when present → edit mode (PATCH)
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [businessId, setBusinessId] = useState(initial?.business_id || businesses[0]?.id || '');
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [type, setType] = useState<TemplateRow['type']>(initial?.type || 'voucher');
  const [percentOff, setPercentOff] = useState(initial?.percent_off ?? 20);
  const [amountOff, setAmountOff] = useState(initial?.amount_off ?? 0);
  const [faceValue, setFaceValue] = useState(initial?.face_value ?? 0);
  const [serviceName, setServiceName] = useState(initial?.service_name || '');
  const [currency, setCurrency] = useState(initial?.currency || 'USD');
  const [maxClaims, setMaxClaims] = useState(initial?.max_claims ?? 0);
  const [expiresInDays, setExpiresInDays] = useState(initial?.expires_in_days ?? 30);
  const [gradientFrom, setGradientFrom] = useState(initial?.gradient_from || '#00d4ff');
  const [gradientTo, setGradientTo] = useState(initial?.gradient_to || '#a78bfa');
  // Visual makeover state — feeds through to GiftCardPreview + payload.
  const [coverImage, setCoverImage] = useState<string | null>(initial?.cover_image || null);
  const [pattern, setPattern] = useState<TemplateRow['pattern']>(initial?.pattern || 'none');
  const [iconEmoji, setIconEmoji] = useState(initial?.icon_emoji || '');
  const [tagline, setTagline] = useState(initial?.tagline || '');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Customize popup — keeps the main form short. Opens a sheet with all
  // visual controls + their own live preview so the user never has to
  // scroll past basic fields just to tweak the design.
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // Apply a preset theme in one tap. Doesn't touch business/type/name —
  // only the visual fields. iconEmoji is reset to the theme's emoji
  // (or cleared if the theme has none).
  const applyTheme = (theme: Theme) => {
    setGradientFrom(theme.gradient_from);
    setGradientTo(theme.gradient_to);
    setPattern(theme.pattern);
    setIconEmoji(theme.icon_emoji || '');
  };

  // Cover image upload — pipes through /api/v1/upload which returns a
  // same-origin path the API will accept.
  const handleCoverUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/v1/upload', {
        method: 'POST',
        credentials: 'same-origin',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Upload failed');
      setCoverImage(json.data.url);
      toast.success('Cover uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingCover(false);
    }
  };

  const submit = async () => {
    if (!businessId) { toast.error('Pick a business'); return; }
    if (!name.trim()) { toast.error('Name required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        business_id: businessId,
        name: name.trim(),
        description: description.trim(),
        type,
        face_value: type === 'stored_value' ? faceValue : 0,
        percent_off: type === 'voucher' ? percentOff : 0,
        amount_off: type === 'voucher' && percentOff === 0 ? amountOff : 0,
        service_name: type === 'service' ? serviceName : undefined,
        currency,
        gradient_from: gradientFrom,
        gradient_to: gradientTo,
        // Visual makeover — only send fields that have a value to avoid
        // clearing them server-side via zod's `.nullable()` defaults.
        cover_image: coverImage || undefined,
        pattern,
        icon_emoji: iconEmoji.trim() || undefined,
        tagline: tagline.trim() || undefined,
        max_claims: maxClaims,
        expires_in_days: expiresInDays,
        status: 'active' as const,
      };
      const url = isEdit ? `/api/v1/gift-cards/templates/${initial!.id}` : '/api/v1/gift-cards/templates';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || (isEdit ? 'Failed to update' : 'Failed to create'));
      toast.success(isEdit ? 'Drop updated' : 'Gift card created');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedBusiness = businesses.find((b) => b.id === businessId);

  const valuePreview = formatValue({
    type, percent_off: percentOff, amount_off: amountOff, face_value: faceValue,
    service_name: serviceName, currency,
  });

  return (
    <div
      className="mx-auto max-w-5xl rounded-2xl p-5 lg:p-6"
      style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:gap-8">
        {/* ── LEFT: live preview (sticky on desktop) ─────────────────── */}
        <div>
          <div className="lg:sticky lg:top-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4a5068]">Live preview</p>
            <GiftCardPreview
              type={type}
              name={name}
              businessName={selectedBusiness?.name}
              value={valuePreview}
              gradientFrom={gradientFrom}
              gradientTo={gradientTo}
              description={description}
              footerLeft={`Valid ${expiresInDays}d`}
              footerRight={maxClaims > 0 ? `${maxClaims} max` : 'Unlimited'}
              coverImage={coverImage}
              pattern={pattern}
              iconEmoji={iconEmoji}
              tagline={tagline}
            />
            {/* Color picker tucked under the preview */}
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer" style={inputStyle}>
                <input
                  type="color" value={gradientFrom}
                  onChange={(e) => setGradientFrom(e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded"
                />
                <span className="text-[11px] text-[#a3adc3]">From</span>
              </label>
              <label className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer" style={inputStyle}>
                <input
                  type="color" value={gradientTo}
                  onChange={(e) => setGradientTo(e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded"
                />
                <span className="text-[11px] text-[#a3adc3]">To</span>
              </label>
            </div>

            {/* Customize-look entry — lives in the preview column so it
                sits visually next to what it affects. Opens a popup with
                all visual controls (theme, cover, pattern, emoji, tagline). */}
            <button
              type="button"
              onClick={() => setCustomizeOpen(true)}
              className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 cursor-pointer transition-colors"
              style={{
                background: 'rgba(0,212,255,0.06)',
                border: '1px dashed rgba(0,212,255,0.25)',
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-[14px]"
                  style={{
                    background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {iconEmoji || '✨'}
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[11px] font-bold text-[#00d4ff] leading-tight">Customize look</p>
                  <p className="text-[9px] text-[#a3adc3] truncate leading-tight mt-0.5">
                    {(() => {
                      const parts: string[] = [];
                      const matchedTheme = THEMES.find(
                        (t) =>
                          t.gradient_from === gradientFrom
                          && t.gradient_to === gradientTo
                          && t.pattern === pattern,
                      );
                      if (matchedTheme && matchedTheme.id !== 'default') parts.push(matchedTheme.name);
                      if (coverImage) parts.push('cover');
                      if (pattern && pattern !== 'none' && !matchedTheme) parts.push(pattern);
                      if (tagline) parts.push('tagline');
                      return parts.length ? parts.join(' · ') : 'Theme · cover · pattern · emoji';
                    })()}
                  </p>
                </div>
              </div>
              <span className="text-[#00d4ff] text-base shrink-0">›</span>
            </button>
          </div>
        </div>

        {/* ── RIGHT: form fields ──────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Business + currency */}
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <Field label="Business">
              <select
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#f0f4ff' }}
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id} style={{ background: '#0f1117' }}>{b.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Currency">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#f0f4ff' }}
              >
                {['USD', 'VND', 'EUR', 'GBP', 'JPY', 'SGD'].map((c) => (
                  <option key={c} value={c} style={{ background: '#0f1117' }}>{c}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Type picker */}
          <Field label="Card type">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(['voucher', 'stored_value', 'service', 'loyalty'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className="rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer transition-colors"
                  style={{
                    background: type === t ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${type === t ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    color: type === t ? '#00d4ff' : '#a3adc3',
                  }}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </Field>

          {/* Type-specific value inputs */}
          {type === 'voucher' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="% off" hint="0–100">
                <input
                  type="number" min={0} max={100}
                  value={percentOff}
                  onChange={(e) => setPercentOff(Number(e.target.value))}
                  className="w-full rounded-lg px-3 py-2.5 text-sm" style={inputStyle}
                />
              </Field>
              <Field label="Or amount off" hint={currency}>
                <input
                  type="number" min={0}
                  value={amountOff}
                  onChange={(e) => setAmountOff(Number(e.target.value))}
                  className="w-full rounded-lg px-3 py-2.5 text-sm" style={inputStyle}
                />
              </Field>
            </div>
          )}
          {type === 'stored_value' && (
            <Field label="Face value" hint={currency}>
              <input
                type="number" min={0}
                value={faceValue}
                onChange={(e) => setFaceValue(Number(e.target.value))}
                className="w-full rounded-lg px-3 py-2.5 text-sm" style={inputStyle}
              />
            </Field>
          )}
          {type === 'service' && (
            <Field label="Free service name" hint="e.g. 'Manicure'">
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm" style={inputStyle}
              />
            </Field>
          )}

          {/* Common fields */}
          <Field label="Card name" hint="Shown to customers">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Birthday treat"
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={inputStyle}
            />
          </Field>

          <Field label="Description (optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Show this card on your next visit to claim."
              rows={2}
              className="w-full rounded-lg px-3 py-2.5 text-sm resize-none"
              style={inputStyle}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Max claims" hint="0 = unlimited">
              <input
                type="number" min={0}
                value={maxClaims}
                onChange={(e) => setMaxClaims(Number(e.target.value))}
                className="w-full rounded-lg px-3 py-2.5 text-sm" style={inputStyle}
              />
            </Field>
            <Field label="Valid for (days)" hint="After claim">
              <input
                type="number" min={1}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="w-full rounded-lg px-3 py-2.5 text-sm" style={inputStyle}
              />
            </Field>
          </div>

        </div>
      </div>

      {/* Submit — full-width below both columns */}
      <button
        onClick={submit}
        disabled={submitting}
        className="mt-6 w-full rounded-xl py-3 text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: '#00d4ff', color: '#0a0b0f' }}
      >
        {submitting ? <Loader2 size={14} className="inline animate-spin mr-2" /> : null}
        {isEdit ? 'Save changes' : 'Publish drop'}
      </button>

      {/* Customize-look popup. All visual fields live here so the form
          stays compact. State is owned by CreateForm so closing the
          popup doesn't drop any of the user's edits. */}
      {customizeOpen && (
        <CustomizeLookModal
          previewProps={{
            type,
            name,
            businessName: selectedBusiness?.name,
            value: valuePreview,
            gradientFrom,
            gradientTo,
            description,
            footerLeft: `Valid ${expiresInDays}d`,
            footerRight: maxClaims > 0 ? `${maxClaims} max` : 'Unlimited',
            coverImage,
            pattern,
            iconEmoji,
            tagline,
          }}
          gradientFrom={gradientFrom}
          gradientTo={gradientTo}
          coverImage={coverImage}
          pattern={pattern}
          iconEmoji={iconEmoji}
          tagline={tagline}
          uploadingCover={uploadingCover}
          onApplyTheme={applyTheme}
          onCoverUpload={handleCoverUpload}
          onClearCover={() => setCoverImage(null)}
          onCoverUrl={(v) => v && setCoverImage(v)}
          onPattern={setPattern}
          onEmoji={setIconEmoji}
          onTagline={setTagline}
          onGradientFrom={setGradientFrom}
          onGradientTo={setGradientTo}
          onClose={() => setCustomizeOpen(false)}
        />
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  color: '#f0f4ff',
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068]">{label}</label>
        {hint && <span className="text-[10px] text-[#4a5068]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// Click the chip to open a popover with a curated emoji grid, grouped by
// theme. There's also a free-text input at the bottom for any emoji not
// in the curated set (and to paste pasted emoji clusters).
function EmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 cursor-pointer"
        style={inputStyle}
        aria-label="Pick an emoji"
      >
        <span className="text-[20px] leading-none">{value || '✨'}</span>
        <span className="text-[10px] uppercase tracking-wider text-[#4a5068]">Pick</span>
      </button>
      {open && (
        // Opens UPWARD because the emoji field sits at the bottom of the
        // Customize modal — opening downward would push the grid off
        // the visible area on most screens.
        <div
          className="absolute left-0 bottom-full z-30 mb-1.5 w-[280px] max-h-[320px] overflow-y-auto rounded-xl p-3"
          style={{
            background: '#14161f',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 -18px 40px -16px rgba(0,0,0,0.55)',
          }}
        >
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="mb-2.5 last:mb-0">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#4a5068]">
                {group.label}
              </p>
              <div className="grid grid-cols-6 gap-1">
                {group.icons.map((emoji) => {
                  const isActive = value === emoji;
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onChange(emoji);
                        setOpen(false);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[18px] cursor-pointer transition-colors"
                      style={{
                        background: isActive ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isActive ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.04)'}`,
                      }}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {/* Custom input — for anything not in the grid */}
          <div className="mt-3 border-t border-white/5 pt-3">
            <label className="block text-[9px] font-bold uppercase tracking-[0.18em] text-[#4a5068] mb-1">
              Custom
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value.slice(0, 8))}
                placeholder="Paste any emoji"
                className="flex-1 rounded-lg px-3 py-2 text-sm text-center"
                style={inputStyle}
              />
              {value && (
                <button
                  type="button"
                  onClick={() => { onChange(''); setOpen(false); }}
                  className="rounded-lg px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                  style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Customize-look popup ─────────────────────────────────────────────
// State stays in the parent CreateForm; this component is a controlled
// view over the same setters. Two-column on desktop (preview left, all
// controls right) so the merchant sees the change as they make it,
// without scrolling.
function CustomizeLookModal({
  previewProps,
  gradientFrom,
  gradientTo,
  coverImage,
  pattern,
  iconEmoji,
  tagline,
  uploadingCover,
  onApplyTheme,
  onCoverUpload,
  onClearCover,
  onCoverUrl,
  onPattern,
  onEmoji,
  onTagline,
  onGradientFrom,
  onGradientTo,
  onClose,
}: {
  previewProps: React.ComponentProps<typeof GiftCardPreview>;
  gradientFrom: string;
  gradientTo: string;
  coverImage: string | null;
  pattern: TemplateRow['pattern'];
  iconEmoji: string;
  tagline: string;
  uploadingCover: boolean;
  onApplyTheme: (theme: Theme) => void;
  onCoverUpload: (file: File | null) => void;
  onClearCover: () => void;
  onCoverUrl: (url: string) => void;
  onPattern: (p: NonNullable<TemplateRow['pattern']>) => void;
  onEmoji: (v: string) => void;
  onTagline: (v: string) => void;
  onGradientFrom: (v: string) => void;
  onGradientTo: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-3 sm:px-6"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto"
        style={{
          background: 'linear-gradient(180deg, #14161f 0%, #0a0b0f 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
          style={{ background: 'linear-gradient(180deg, #14161f 0%, rgba(20,22,31,0.92) 100%)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div>
            <h2 className="text-base font-black text-white">✨ Customize look</h2>
            <p className="text-[10px] text-white/55">All optional — changes preview live</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-bold cursor-pointer"
            style={{ background: '#00d4ff', color: '#0a0b0f' }}
          >
            Done
          </button>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-6">
          {/* ── Preview column (sticky on desktop) ──────────────────── */}
          <div>
            <div className="lg:sticky lg:top-20 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4a5068]">
                Live preview
              </p>
              <GiftCardPreview {...previewProps} />
              {/* Quick gradient color pickers — let users tweak the theme
                  without leaving the popup. */}
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer" style={inputStyle}>
                  <input
                    type="color"
                    value={gradientFrom}
                    onChange={(e) => onGradientFrom(e.target.value)}
                    className="h-7 w-7 cursor-pointer rounded"
                  />
                  <span className="text-[11px] text-[#a3adc3]">From</span>
                </label>
                <label className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer" style={inputStyle}>
                  <input
                    type="color"
                    value={gradientTo}
                    onChange={(e) => onGradientTo(e.target.value)}
                    className="h-7 w-7 cursor-pointer rounded"
                  />
                  <span className="text-[11px] text-[#a3adc3]">To</span>
                </label>
              </div>
            </div>
          </div>

          {/* ── Controls column ────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Theme presets */}
            <Field label="Theme" hint="One-tap apply">
              <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                {THEMES.map((th) => {
                  const isActive = gradientFrom === th.gradient_from
                    && gradientTo === th.gradient_to
                    && pattern === th.pattern;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => onApplyTheme(th)}
                      className="shrink-0 flex flex-col items-center gap-1 cursor-pointer"
                      title={th.name}
                    >
                      <div
                        className="relative h-12 w-12 rounded-xl overflow-hidden"
                        style={{
                          background: `linear-gradient(135deg, ${th.gradient_from}, ${th.gradient_to})`,
                          border: isActive ? '2px solid #00d4ff' : '2px solid rgba(255,255,255,0.08)',
                          boxShadow: isActive ? '0 0 0 3px rgba(0,212,255,0.25)' : 'none',
                        }}
                      >
                        {th.icon_emoji && (
                          <span className="absolute inset-0 flex items-center justify-center text-[18px]">
                            {th.icon_emoji}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-[#a3adc3]">{th.name}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* Background image */}
            <Field label="Background image" hint="Photo on the card">
              {coverImage ? (
                <div className="flex items-center gap-3 rounded-lg p-2.5" style={inputStyle}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverImage}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-md object-cover"
                    style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                  <span className="text-[11px] text-[#a3adc3] truncate flex-1">
                    Cover image set
                  </span>
                  <button
                    type="button"
                    onClick={onClearCover}
                    className="rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                    style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label
                    className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold cursor-pointer"
                    style={{ background: 'rgba(0,212,255,0.08)', border: '1px dashed rgba(0,212,255,0.25)', color: '#00d4ff' }}
                  >
                    {uploadingCover ? (
                      <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                    ) : (
                      <>📷 Upload from device</>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingCover}
                      onChange={(e) => onCoverUpload(e.target.files?.[0] || null)}
                    />
                  </label>
                  <input
                    type="url"
                    placeholder="…or paste image URL"
                    onBlur={(e) => onCoverUrl(e.target.value.trim())}
                    className="w-full rounded-lg px-3 py-2 text-xs"
                    style={inputStyle}
                  />
                </div>
              )}
            </Field>

            {/* Pattern picker — horizontal scroll when narrow so chips
                never get squished or clipped. */}
            <Field label="Pattern overlay">
              <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                {(['none', 'dots', 'waves', 'stars', 'grid'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPattern(p)}
                    className="shrink-0 rounded-lg px-4 py-2 text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors"
                    style={{
                      background: pattern === p ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${pattern === p ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      color: pattern === p ? '#00d4ff' : '#a3adc3',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>

            {/* Emoji + tagline */}
            <div className="grid grid-cols-[140px_1fr] gap-3">
              <Field label="Icon emoji" hint="Tap to pick">
                <EmojiPicker value={iconEmoji} onChange={onEmoji} />
              </Field>
              <Field label="Tagline" hint="Short marketing line">
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => onTagline(e.target.value.slice(0, 80))}
                  placeholder="Free dessert · This weekend"
                  className="w-full rounded-lg px-3 py-2.5 text-sm"
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
