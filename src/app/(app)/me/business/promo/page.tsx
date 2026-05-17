'use client';

// Merchant promo builder — freeform 9:16 canvas that compiles to a
// rich notification + landing page for followers. List view → builder.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import { ArrowLeft, Plus, Megaphone, Loader2, Send, Sparkles, X, Pencil, Trash2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { PromoBuilder, type PromoElement } from '@/components/promo/PromoBuilder';
import { PROMO_PRESETS, type PromoPreset } from '@/lib/promo-presets';

interface BusinessRow { id: string; name: string }
interface PromoRow {
  id: string;
  business_id: string;
  business_name?: string;
  name: string;
  description: string;
  background_color: string;
  background_image?: string | null;
  background_gradient_to?: string | null;
  elements_json: string;
  gift_card_template_id?: string | null;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
}

const fetcher = (url: string) => fetch(url, { credentials: 'same-origin' }).then((r) => r.json());

export default function PromoBuilderPage() {
  const router = useRouter();
  const { data: bizData } = useSWR<{ data: BusinessRow | null }>('/api/v1/businesses/me', fetcher);
  const business = bizData?.data || null;
  const { data: promosData, isLoading } = useSWR<{ data: PromoRow[] }>(
    business ? '/api/v1/promo-templates' : null,
    fetcher,
  );
  const promos = promosData?.data || [];

  // Editing state — null when on the list, otherwise the loaded promo.
  const [editing, setEditing] = useState<PromoRow | null>(null);
  // Template-picker visibility. Shown before a new promo is created so
  // users start from a designed look instead of an empty canvas.
  const [pickerOpen, setPickerOpen] = useState(false);

  // Create a promo from a preset (or blank). Posts to the API with the
  // preset's elements + background + a name derived from the preset.
  const createFromPreset = async (preset: PromoPreset) => {
    if (!business) return;
    setPickerOpen(false);
    try {
      const res = await fetch('/api/v1/promo-templates', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: business.id,
          name: preset.id === 'blank' ? 'Untitled promo' : preset.name,
          background_color: preset.background_color,
          background_gradient_to: preset.background_gradient_to,
          background_image: preset.background_image ?? null,
          elements_json: JSON.stringify(preset.elements),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to create');
      globalMutate('/api/v1/promo-templates');
      setEditing(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  if (!business && bizData) {
    return (
      <CenteredState
        title="You don't have a business yet"
        sub="Promote Template lives on your business page."
        onBack={() => router.push('/me')}
      />
    );
  }
  if (!business) return <FullPageLoader />;

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#0a0b0f', color: '#f0f4ff' }}>
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{ background: 'rgba(10,11,15,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <button
          onClick={() => (editing ? setEditing(null) : router.push('/me'))}
          className="flex h-9 w-9 items-center justify-center rounded-full cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-base font-bold">
          {editing ? editing.name : 'Promote Template'}
        </h1>
      </header>

      {editing ? (
        <EditorScreen
          promo={editing}
          businessName={business.name}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setEditing(updated);
            globalMutate('/api/v1/promo-templates');
          }}
        />
      ) : (
        <ListScreen
          promos={promos}
          isLoading={isLoading}
          onCreate={() => setPickerOpen(true)}
          onOpen={setEditing}
          onDelete={async (p) => {
            // Optimistic — drop the card from the cached list immediately
            // so the UI feels instant. Revert on API failure.
            const prev = promos;
            globalMutate(
              '/api/v1/promo-templates',
              { data: prev.filter((x) => x.id !== p.id) },
              false,
            );
            try {
              const res = await fetch(`/api/v1/promo-templates/${p.id}`, {
                method: 'DELETE',
                credentials: 'same-origin',
              });
              if (!res.ok) throw new Error('Failed to delete');
              globalMutate('/api/v1/promo-templates');
              toast.success(`Deleted “${p.name}”`);
            } catch (err) {
              globalMutate('/api/v1/promo-templates', { data: prev }, false);
              toast.error(err instanceof Error ? err.message : 'Failed to delete');
            }
          }}
        />
      )}

      {pickerOpen && (
        <TemplatePickerModal
          onClose={() => setPickerOpen(false)}
          onPick={createFromPreset}
        />
      )}
    </div>
  );
}

function ListScreen({ promos, isLoading, onCreate, onOpen, onDelete }: {
  promos: PromoRow[];
  isLoading: boolean;
  onCreate: () => void;
  onOpen: (p: PromoRow) => void;
  onDelete: (p: PromoRow) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[#a3adc3]">
          Design eye-catching promo cards your followers can&apos;t scroll past.
        </p>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold cursor-pointer"
          style={{ background: '#00d4ff', color: '#0a0b0f' }}
        >
          <Plus size={14} /> Create
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[#4a5068]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : promos.length === 0 ? (
        <div
          className="rounded-2xl px-6 py-12 text-center"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)' }}
        >
          <Megaphone size={32} className="mx-auto mb-3 text-[#4a5068]" />
          <p className="text-sm font-semibold">No promos yet</p>
          <p className="mt-1 text-xs text-[#a3adc3]">
            Tap “Create” to design your first one.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {promos.map((p) => (
            // Outer wrapper is a div (not a button) so we can nest the
            // edit + delete buttons next to the clickable thumbnail
            // without invalid nested-button DOM.
            <div key={p.id} className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onOpen(p)}
                className="text-left cursor-pointer transition-transform active:scale-[0.98]"
                aria-label={`Open ${p.name}`}
              >
                {/* Thumbnail — render the promo at small size */}
                <div
                  className="relative aspect-[9/16] rounded-2xl overflow-hidden"
                  style={{
                    background: p.background_image
                      ? `url(${p.background_image}) center/cover`
                      : p.background_gradient_to
                        ? `linear-gradient(160deg, ${p.background_color}, ${p.background_gradient_to})`
                        : p.background_color,
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <PromoThumbnail elementsJson={p.elements_json} />
                  <span
                    className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur"
                    style={{
                      background: p.status === 'published' ? 'rgba(34,197,94,0.85)' : 'rgba(255,255,255,0.6)',
                      color: p.status === 'published' ? 'white' : '#1a1a2e',
                    }}
                  >
                    {p.status}
                  </span>
                </div>
              </button>

              {/* Name + date row */}
              <div>
                <p className="text-sm font-semibold truncate">{p.name}</p>
                <p className="text-[11px] text-[#4a5068]">
                  {new Date(p.updated_at).toLocaleDateString()}
                </p>
              </div>

              {/* Action row — edit (primary) + delete */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpen(p)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold cursor-pointer transition-colors"
                  style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.18)', color: '#00d4ff' }}
                >
                  <Pencil size={12} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(p)}
                  aria-label="Delete promo"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold cursor-pointer transition-colors"
                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)', color: '#f87171' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Editor screen ───────────────────────────────────────────────────
function EditorScreen({
  promo, businessName, onClose, onSaved,
}: {
  promo: PromoRow;
  businessName: string;
  onClose: () => void;
  onSaved: (p: PromoRow) => void;
}) {
  const [name, setName] = useState(promo.name);
  const [description, setDescription] = useState(promo.description || '');
  const [bgColor, setBgColor] = useState(promo.background_color);
  const [bgGradTo, setBgGradTo] = useState(promo.background_gradient_to || '');
  const [bgImage, setBgImage] = useState(promo.background_image || '');
  const [bgUploading, setBgUploading] = useState(false);
  const [elements, setElements] = useState<PromoElement[]>(() => {
    try { return JSON.parse(promo.elements_json) as PromoElement[]; } catch { return []; }
  });
  const [sending, setSending] = useState(false);
  const [audience, setAudience] = useState<'all_followers' | 'recent_customers' | 'vip'>('all_followers');

  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed');
      return;
    }
    setBgUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/v1/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Upload failed');
      const url = json.data?.url as string | undefined;
      if (!url) throw new Error('Upload did not return a URL');
      setBgImage(url);
      toast.success('Background image set');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBgUploading(false);
    }
  };

  // Auto-save on element changes (debounced ~800ms).
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/promo-templates/${promo.id}`, {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description,
            background_color: bgColor,
            background_gradient_to: bgGradTo || null,
            background_image: bgImage || null,
            elements_json: JSON.stringify(elements),
          }),
        });
        const json = await res.json();
        if (res.ok) onSaved(json.data);
      } catch {/* drop silently — next change retries */}
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description, bgColor, bgGradTo, bgImage, elements, promo.id]);

  const handleSendNow = async () => {
    setSending(true);
    try {
      // Force-save first so the recipients see the latest layout.
      await fetch(`/api/v1/promo-templates/${promo.id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements_json: JSON.stringify(elements), status: 'published' }),
      });
      const res = await fetch(`/api/v1/promo-templates/${promo.id}/send`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to send');
      toast.success(`📣 Sent to ${json.data.delivered_count} followers`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="px-4 pb-8 pt-2">
      <div className="mx-auto max-w-5xl">
        {/* Top bar */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Promo name"
            className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#f0f4ff' }}
          />
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#a3adc3' }}
          >
            Back to list
          </button>
        </div>

        {/* Background controls */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <label className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <input type="color" value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="h-7 w-7 cursor-pointer rounded"
            />
            <span className="text-[11px] text-[#a3adc3]">BG</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <input type="color" value={bgGradTo || bgColor}
              onChange={(e) => setBgGradTo(e.target.value)}
              className="h-7 w-7 cursor-pointer rounded"
            />
            <span className="text-[11px] text-[#a3adc3]">Gradient</span>
            {bgGradTo && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setBgGradTo(''); }}
                className="ml-1 text-[10px] text-red-300 cursor-pointer"
              >
                clear
              </button>
            )}
          </label>

          {/* Background image — upload + clear. When set, overrides color/gradient
              in PromoBuilder via the backgroundImage prop. */}
          <label
            className={`flex items-center gap-2 rounded-lg px-3 py-2 ${bgUploading ? 'opacity-60' : 'cursor-pointer'}`}
            style={{
              background: bgImage ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${bgImage ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            {bgImage ? (
              <span
                className="h-7 w-7 rounded shrink-0"
                style={{ background: `url(${bgImage}) center/cover`, border: '1px solid rgba(255,255,255,0.15)' }}
              />
            ) : bgUploading ? (
              <Loader2 size={16} className="animate-spin text-[#00d4ff]" />
            ) : (
              <ImagePlus size={16} className="text-[#00d4ff]" />
            )}
            <span className="text-[11px] text-[#a3adc3]">
              {bgImage ? 'Image' : bgUploading ? 'Uploading…' : 'Add image'}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleBgImageUpload}
              disabled={bgUploading}
              className="hidden"
            />
            {bgImage && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setBgImage(''); }}
                className="ml-1 text-[10px] text-red-300 cursor-pointer"
              >
                clear
              </button>
            )}
          </label>
        </div>

        {/* Builder canvas */}
        <div className="h-[70vh] min-h-[480px]">
          <PromoBuilder
            elements={elements}
            onChange={setElements}
            backgroundColor={bgColor}
            backgroundGradientTo={bgGradTo}
            backgroundImage={bgImage || null}
          />
        </div>

        {/* Letter body — the email-style message shown next to the
            template when a follower opens the notification. Written by
            the merchant; auto-saves alongside layout. */}
        <div className="mt-5 rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00d4ff] mb-1">
            Letter to customers
          </p>
          <p className="text-[11px] text-[#a3adc3] mb-3">
            Shown above the template when followers tap the notification. Write it in your own voice — keep it short, warm, and on-brand.
          </p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            placeholder={'Hi! We have something special coming up — a fresh promo with details enclosed below. Drop by to enjoy.'}
            rows={5}
            className="w-full rounded-lg px-3 py-2 text-sm leading-relaxed resize-y"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#f0f4ff',
              fontFamily: 'Georgia, "Times New Roman", serif',
              minHeight: '120px',
            }}
          />
          <p className="text-[10px] text-[#4a5068] mt-1 text-right">{description.length}/500</p>
        </div>

        {/* Send row */}
        <div className="mt-5 rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00d4ff] mb-2">
            Send to followers
          </p>
          <p className="text-[11px] text-[#a3adc3] mb-3">
            From <span className="text-white">{businessName}</span>. Each follower gets a notification + can open the full story.
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            {(['all_followers', 'recent_customers', 'vip'] as const).map((a) => {
              const active = audience === a;
              const label = a === 'all_followers' ? 'All followers' : a === 'recent_customers' ? 'Recent customers' : 'VIPs';
              return (
                <button
                  key={a}
                  onClick={() => setAudience(a)}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer"
                  style={{
                    background: active ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: active ? '#00d4ff' : '#a3adc3',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleSendNow}
            disabled={sending}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold cursor-pointer disabled:opacity-60"
            style={{ background: '#00d4ff', color: '#0a0b0f' }}
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send now
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tiny preview thumbnail used in the list grid ──────────────────
function PromoThumbnail({ elementsJson }: { elementsJson: string }) {
  let els: PromoElement[] = [];
  try { els = JSON.parse(elementsJson) as PromoElement[]; } catch {/**/}
  return (
    <div className="absolute inset-0 pointer-events-none">
      {els.slice(0, 6).map((el) => (
        <div
          key={el.id}
          className="absolute"
          style={{
            left: `${el.x}%`, top: `${el.y}%`,
            width: `${el.w}%`, height: `${el.h}%`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {el.type === 'text' && (
            <span className="text-[8px] font-black truncate text-center w-full"
              style={{ color: el.color || '#1a1a2e' }}
            >
              {el.text?.slice(0, 30)}
            </span>
          )}
          {el.type === 'sticker' && <span className="text-[14px]">{el.emoji}</span>}
          {el.type === 'button' && (
            <div className="text-[7px] rounded-full px-1 truncate text-white"
              style={{ background: el.bgColor || '#c41e3a' }}
            >
              {el.text?.slice(0, 12)}
            </div>
          )}
          {el.type === 'giftcard' && (
            <div className="h-full w-full rounded-md"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #a78bfa)' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Template picker — shown before creating a new promo ─────────────
// Grid of preset thumbnails. Each thumb is a mini render of the preset
// elements over the preset background, so users see what they're picking.
function TemplatePickerModal({
  onClose, onPick,
}: { onClose: () => void; onPick: (preset: PromoPreset) => void }) {
  return (
    <div
      // Full-screen on mobile (full-bleed sheet), centred dialog on sm+.
      // `h-[100dvh]` matches the visible viewport even when the iOS Safari
      // URL bar is showing, so the picker is never taller than the screen.
      className="fixed inset-0 z-60 flex h-[100dvh] items-stretch sm:items-center justify-center sm:px-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-4xl flex flex-col rounded-none sm:rounded-3xl sm:max-h-[92vh] overflow-hidden"
        // touch-action allows native vertical scroll inside the panel
        // (otherwise iOS Safari may swallow scrolls when nested in a
        // fixed backdrop).
        style={{
          background: 'linear-gradient(180deg, #14161f 0%, #0a0b0f 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          touchAction: 'pan-y',
        }}
      >
        {/* Header — fixed at top of the panel; doesn't scroll. */}
        <div
          className="shrink-0 flex items-center justify-between px-5 py-4"
          style={{ background: 'rgba(20,22,31,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#00d4ff]" />
            <h2 className="text-base font-black text-white">Pick a template</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full cursor-pointer hover:bg-white/5"
            aria-label="Close"
          >
            <X size={16} className="text-white/70" />
          </button>
        </div>

        {/* Scroll body — grows to fill panel, scrolls internally on
            mobile where the grid is taller than the viewport. */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-5">
          {PROMO_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              className="flex flex-col gap-2 cursor-pointer text-left transition-transform active:scale-[0.98]"
            >
              <div
                className="relative aspect-[9/16] rounded-2xl overflow-hidden"
                style={{
                  background: p.background_image
                    ? `url(${p.background_image}) center/cover, ${p.background_color}`
                    : p.background_gradient_to
                      ? `linear-gradient(160deg, ${p.background_color}, ${p.background_gradient_to})`
                      : p.background_color,
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 12px 28px -16px rgba(0,0,0,0.7)',
                }}
              >
                <PresetThumbnail elements={p.elements} />
                {p.id === 'blank' && (
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] uppercase tracking-[0.2em] font-bold text-[#1a1a2e]/55">
                    Empty
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-white truncate">{p.name}</p>
                <p className="text-[10px] text-[#a3adc3] truncate">{p.blurb}</p>
              </div>
            </button>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Small thumbnail renderer for the preset picker. Reuses the same %-based
// layout as the runtime canvas, scaled down. Text/sticker/button only —
// no interaction.
function PresetThumbnail({ elements }: { elements: PromoElement[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {elements.map((el) => (
        <div
          key={el.id}
          className="absolute"
          style={{
            left: `${el.x}%`, top: `${el.y}%`,
            width: `${el.w}%`, height: `${el.h}%`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          }}
        >
          {el.type === 'text' && (
            <span
              className="leading-tight text-center w-full select-none truncate"
              style={{
                color: el.color || '#1a1a2e',
                fontSize: `${(el.fontSize || 24) * 0.18}px`,
                fontWeight: el.fontWeight || 700,
                fontFamily: el.fontFamily || undefined,
              }}
            >
              {el.text}
            </span>
          )}
          {el.type === 'sticker' && (
            <span style={{ fontSize: `${(el.fontSize || 60) * 0.18}px` }}>{el.emoji}</span>
          )}
          {el.type === 'button' && (
            <div
              className="rounded-full px-1 py-0.5 truncate"
              style={{
                background: el.bgColor || '#c41e3a',
                color: el.color || 'white',
                fontSize: `${(el.fontSize || 24) * 0.18}px`,
                fontWeight: el.fontWeight || 700,
                fontFamily: el.fontFamily || undefined,
              }}
            >
              {el.text}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CenteredState({ title, sub, onBack }: { title: string; sub: string; onBack: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6"
      style={{ background: '#0a0b0f', color: '#f0f4ff' }}
    >
      <p className="text-base font-bold">{title}</p>
      <p className="mt-2 text-sm text-[#a3adc3] max-w-sm">{sub}</p>
      <button onClick={onBack} className="mt-5 rounded-xl px-5 py-2.5 text-sm font-bold cursor-pointer"
        style={{ background: '#00d4ff', color: '#0a0b0f' }}
      >
        Back
      </button>
    </div>
  );
}

function FullPageLoader() {
  return (
    <div className="h-full flex items-center justify-center" style={{ background: '#0a0b0f' }}>
      <Loader2 size={28} className="animate-spin text-[#00d4ff]" />
    </div>
  );
}

