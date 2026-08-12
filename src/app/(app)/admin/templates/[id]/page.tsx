'use client';

// /admin/templates/[id] — smart design dashboard.
// Sticky glass top bar with status pills (LIVE / Draft), section cards
// with colored icon accents, TemplateLivePreview inside a phone-chrome
// frame on the right. Same state + save/delete logic as before —
// visual redesign only.

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  ArrowLeft, ShieldCheck, Save, Trash2, Wand2, Layers, ImageIcon,
  Type, Zap, Code2, Sparkles, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';
import TemplateLivePreview from '@/components/admin/TemplateLivePreview';
import FieldsBuilder from '@/components/admin/FieldsBuilder';
import EffectsTimeline from '@/components/admin/EffectsTimeline';
import AssetUploader from '@/components/admin/AssetUploader';
import type { EffectSpec } from '@/components/reveals/_effects/_types';
import type { FieldSpec } from '@/components/reveals/fields';
import { EFFECT_META } from '@/components/reveals/_effects/registry';

interface OccasionLink { occasion_id: string; sort_order: number; featured: number; }
interface AdminTemplate {
  id: string;
  component_key: string;
  name: string;
  name_vi: string | null;
  description: string | null;
  emoji: string;
  thumbnail_bg: string | null;
  thumbnail_url: string | null;
  preview_video: string | null;
  accent_color: string | null;
  premium: number;
  coins: number;
  active: number;
  fields_schema: string | null;
  effects: string | null;
  occasions: OccasionLink[];
}

interface OccasionRef { id: string; name: string; emoji: string; theme_color: string; }

const fetcher = (url: string) => fetch(url, { credentials: 'same-origin' }).then(async r => {
  if (r.status === 404) throw new Error('forbidden');
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

interface Props { params: Promise<{ id: string }> }

export default function AdminTemplateEditPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<{ data: AdminTemplate }>(`/api/v1/admin/templates/${id}`, fetcher);
  const { data: occData } = useSWR<{ data: OccasionRef[] }>('/api/v1/admin/occasions', fetcher);
  const tpl = data?.data;
  const allOccasions = occData?.data ?? [];

  // Local edit buffers.
  const [form, setForm] = useState<Partial<AdminTemplate> | null>(null);
  const [fieldsText, setFieldsText] = useState<string | null>(null);
  const [effectsText, setEffectsText] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const current = { ...tpl, ...form } as AdminTemplate | undefined;

  const fieldsSchema: FieldSpec[] = useMemo(() => {
    try {
      const raw = fieldsText ?? tpl?.fields_schema ?? '[]';
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [fieldsText, tpl?.fields_schema]);

  const effects: EffectSpec[] = useMemo(() => {
    try {
      const raw = effectsText ?? tpl?.effects ?? '[]';
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [effectsText, tpl?.effects]);

  const fieldsValid = useMemo(() => {
    try { JSON.parse(fieldsText ?? tpl?.fields_schema ?? '[]'); return true; } catch { return false; }
  }, [fieldsText, tpl?.fields_schema]);
  const effectsValid = useMemo(() => {
    try { JSON.parse(effectsText ?? tpl?.effects ?? '[]'); return true; } catch { return false; }
  }, [effectsText, tpl?.effects]);

  const dirty = !!form || fieldsText !== null || effectsText !== null;

  if (error && (error.message === 'forbidden' || String(error).includes('404'))) {
    return (
      <div className="h-full overflow-y-auto bg-[#05060a] text-white flex flex-col items-center justify-center px-6 text-center">
        <ShieldCheck size={32} className="text-[#4a5068] mb-2" />
        <h1 className="text-lg font-semibold mb-1">Admin only</h1>
      </div>
    );
  }
  if (isLoading || !tpl || !current) {
    return <div className="h-full bg-[#05060a] text-white flex items-center justify-center text-sm text-[#4a5068]">Loading…</div>;
  }

  const setField = <K extends keyof AdminTemplate>(key: K, value: AdminTemplate[K]) => {
    setForm(prev => ({ ...(prev ?? {}), [key]: value }));
  };

  const toggleOccasion = (occasionId: string, on: boolean) => {
    const currentLinks: OccasionLink[] = current.occasions ?? [];
    const next: OccasionLink[] = on
      ? (currentLinks.some(l => l.occasion_id === occasionId)
          ? currentLinks
          : [...currentLinks, { occasion_id: occasionId, sort_order: 99, featured: 0 }])
      : currentLinks.filter(l => l.occasion_id !== occasionId);
    setForm(prev => ({ ...(prev ?? {}), occasions: next }));
  };

  const save = async () => {
    if (!fieldsValid || !effectsValid) return toast.error('Fix JSON syntax first');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...(form ?? {}) };
      if (fieldsText !== null) payload.fields_schema = fieldsSchema;
      if (effectsText !== null) payload.effects = effects;
      if ('premium' in payload) payload.premium = !!payload.premium;
      if ('active' in payload) payload.active = !!payload.active;
      if (payload.occasions) {
        payload.occasions = (payload.occasions as OccasionLink[]).map(l => ({
          occasion_id: l.occasion_id, sort_order: l.sort_order, featured: !!l.featured,
        }));
      }
      const res = await fetch(`/api/v1/admin/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Save failed');
      toast.success('Saved');
      setForm(null); setFieldsText(null); setEffectsText(null);
      mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!confirm(`Delete template "${tpl.name}"?  This soft-deletes it (active=0) — you can re-activate it later.`)) return;
    const res = await fetch(`/api/v1/admin/templates/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) { toast.success('Deleted'); router.push('/admin/occasions'); }
    else toast.error('Failed');
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-white placeholder-white/30 focus:outline-none focus:border-white/25 text-sm transition-colors';
  const monoCls = 'w-full px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-white placeholder-white/30 focus:outline-none focus:border-white/25 text-xs font-mono resize-y';
  const labelCls = 'text-[10px] uppercase tracking-wider text-[#7a8299] font-semibold mb-1.5 block';
  const accent = current.accent_color ?? '#ec4899';
  const isLive = effects.length > 0;
  const linkedOccasions = allOccasions.filter(o => current.occasions?.some(l => l.occasion_id === o.id));

  return (
    <div className="h-full overflow-y-auto text-white" style={{
      background: `radial-gradient(ellipse 1000px 600px at 50% -200px, ${accent}18, transparent 60%), #05060a`,
    }}>
      {/* ── Sticky glass top bar ─────────────────────────────── */}
      <header className="sticky top-0 z-20 backdrop-blur-xl" style={{ background: 'rgba(5,6,10,0.85)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto flex items-center gap-3 px-6 py-3">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] hover:text-white cursor-pointer">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-2xl shrink-0">{current.emoji}</div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate flex items-center gap-2">
                {current.name}
                {isLive ? (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: '#22c55e25', color: '#22c55e' }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22c55e' }} /> Live
                  </span>
                ) : (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: '#7a8299' }}>Draft</span>
                )}
              </div>
              <div className="text-[10px] text-[#4a5068] font-mono truncate">{id}</div>
            </div>
          </div>

          <div className="flex-1" />

          {/* Stat pills */}
          <div className="hidden md:flex items-center gap-2 text-[10px] text-[#a3adc3]">
            <span className="flex items-center gap-1"><Type size={11} /> {fieldsSchema.length} field{fieldsSchema.length !== 1 && 's'}</span>
            <span className="w-px h-3 bg-white/10" />
            <span className="flex items-center gap-1"><Zap size={11} /> {effects.length} effect{effects.length !== 1 && 's'}</span>
            <span className="w-px h-3 bg-white/10" />
            <span className="flex items-center gap-1"><Layers size={11} /> {linkedOccasions.length} occasion{linkedOccasions.length !== 1 && 's'}</span>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={del} className="flex items-center gap-1 rounded-lg h-9 px-2.5 text-xs cursor-pointer text-[#f87171] hover:bg-[#f8717115] transition-colors">
              <Trash2 size={13} />
            </button>
            <button
              disabled={!dirty || saving}
              onClick={save}
              className="flex items-center gap-1.5 rounded-lg h-9 px-4 text-xs font-bold cursor-pointer transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ background: dirty ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(255,255,255,0.05)', color: '#fff', boxShadow: dirty ? '0 4px 16px rgba(34,197,94,0.35)' : undefined }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : dirty ? <Save size={13} /> : <CheckCircle2 size={13} />}
              {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Two-column body ─────────────────────────────────── */}
      <main className="max-w-7xl mx-auto p-5 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-6 lg:gap-8">

          {/* ─── LEFT: design form ────────────────────────── */}
          <div className="space-y-5 order-2 lg:order-1">
            <SectionCard icon={<Wand2 size={14} />} title="Identity" color={accent}>
              <div className="grid grid-cols-2 gap-3">
                <label className="block col-span-2">
                  <span className={labelCls}>Name</span>
                  <input value={current.name ?? ''} onChange={e => setField('name', e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <span className={labelCls}>Emoji</span>
                  <input value={current.emoji ?? ''} onChange={e => setField('emoji', e.target.value)} maxLength={10} className={`${inputCls} text-center text-2xl h-[42px] py-0`} />
                </label>
                <label className="block">
                  <span className={labelCls}>Accent color</span>
                  <div className="flex gap-2">
                    <input type="color" value={current.accent_color ?? '#ec4899'} onChange={e => setField('accent_color', e.target.value)} className="w-[42px] h-[42px] rounded-lg border border-white/10 bg-transparent cursor-pointer shrink-0" />
                    <input value={current.accent_color ?? ''} onChange={e => setField('accent_color', e.target.value)} className={`${inputCls} font-mono`} />
                  </div>
                </label>
                <label className="block col-span-2">
                  <span className={labelCls}>Description</span>
                  <textarea value={current.description ?? ''} onChange={e => setField('description', e.target.value)} maxLength={300} rows={2} className={`${inputCls} resize-none`} />
                </label>
                <label className="block col-span-2">
                  <span className={labelCls}>Thumbnail background (CSS)</span>
                  <input value={current.thumbnail_bg ?? ''} onChange={e => setField('thumbnail_bg', e.target.value)} placeholder="linear-gradient(135deg, #a, #b)" className={`${inputCls} font-mono text-xs`} />
                </label>
                <label className="block">
                  <span className={labelCls}>Component key</span>
                  <input value={current.component_key ?? 'data-driven'} onChange={e => setField('component_key', e.target.value)} className={`${inputCls} font-mono`} />
                  <div className="text-[10px] text-[#4a5068] mt-1 leading-relaxed">
                    <b className="text-white/70">data-driven</b> = engine JSON render (default, dùng effects[] bên dưới).<br />
                    Chỉ đổi khi có React component thật + đã register trong <code className="text-[#a3adc3]">_registry.ts</code>.
                    Set sai → reveal rớt về fallback default.
                  </div>
                </label>
                <label className="block">
                  <span className={labelCls}>Coins (if premium)</span>
                  <input type="number" min={0} value={current.coins ?? 0} onChange={e => setField('coins', Number(e.target.value))} className={inputCls} />
                </label>
                <div className="flex gap-4 col-span-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!current.premium} onChange={e => setField('premium', (e.target.checked ? 1 : 0) as number)} className="accent-yellow-500 cursor-pointer" />
                    <span className="text-xs text-white/80">Premium</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!current.active} onChange={e => setField('active', (e.target.checked ? 1 : 0) as number)} className="accent-green-500 cursor-pointer" />
                    <span className="text-xs text-white/80">Active</span>
                  </label>
                </div>
              </div>
            </SectionCard>

            <SectionCard icon={<ImageIcon size={14} />} title="Assets" color="#38bdf8">
              <div className="grid grid-cols-2 gap-3">
                <AssetUploader value={current.thumbnail_url} onChange={url => setField('thumbnail_url', url)} kind="image" label="Thumbnail image" hint="Overrides the emoji card. Recommend 400×400px." accent={accent} aspect="1 / 1" />
                <AssetUploader value={current.preview_video} onChange={url => setField('preview_video', url)} kind="video" label="Preview video" hint="Short MP4 for the picker preview modal." accent={accent} aspect="9 / 16" />
              </div>
            </SectionCard>

            <SectionCard icon={<Layers size={14} />} title="Shown under these occasions" color="#c084fc">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {allOccasions.map(o => {
                  const linked = current.occasions?.some(l => l.occasion_id === o.id);
                  return (
                    <label key={o.id} className="flex items-center gap-2 rounded-lg p-2.5 cursor-pointer transition-all" style={linked
                      ? { background: `${o.theme_color}22`, border: `1px solid ${o.theme_color}`, boxShadow: `0 0 0 2px ${o.theme_color}22` }
                      : { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <input type="checkbox" checked={!!linked} onChange={e => toggleOccasion(o.id, e.target.checked)} className="cursor-pointer" />
                      <span className="text-base">{o.emoji}</span>
                      <span className="text-xs truncate flex-1">{o.name}</span>
                    </label>
                  );
                })}
              </div>
              {linkedOccasions.length === 0 && (
                <div className="text-[10px] text-[#f87171] mt-2 flex items-center gap-1"><AlertCircle size={11} /> Pick at least one so the template appears in the picker.</div>
              )}
            </SectionCard>

            <SectionCard icon={<Type size={14} />} title="Fields the sender fills in" color="#22c55e" hint="Each field becomes an input on the send form and a {placeholder} inside your effects.">
              <FieldsBuilder value={fieldsSchema} onChange={next => setFieldsText(JSON.stringify(next))} accent={accent} />
            </SectionCard>

            <SectionCard icon={<Zap size={14} />} title="Effects timeline" color="#fbbf24" hint="Ordered animations that play after the meet-and-hug intro. Set start delay + duration on each.">
              <EffectsTimeline value={effects} onChange={next => setEffectsText(JSON.stringify(next))} accent={accent} />
            </SectionCard>

            {/* Advanced — raw JSON */}
            <section className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(23,25,32,0.5), rgba(17,19,24,0.3))', border: '1px solid rgba(255,255,255,0.04)' }}>
              <button type="button" onClick={() => setAdvancedOpen(v => !v)} className="w-full flex items-center gap-2 px-4 py-3 cursor-pointer text-left hover:bg-white/[0.02]">
                <Code2 size={13} className="text-[#4a5068]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#7a8299]">Advanced · raw JSON</span>
                <div className="flex-1" />
                <span className="text-[#4a5068] text-xs">{advancedOpen ? '▲' : '▼'}</span>
              </button>
              {advancedOpen && (
                <div className="p-4 pt-0 space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-[#7a8299] uppercase tracking-wider font-semibold">fields_schema</div>
                      {!fieldsValid && <span className="text-[10px] font-bold text-[#f87171]">Invalid JSON</span>}
                    </div>
                    <textarea value={fieldsText ?? tpl.fields_schema ?? ''} onChange={e => setFieldsText(e.target.value)} rows={6} placeholder="[]" className={monoCls} style={{ borderColor: fieldsValid ? undefined : '#f87171' }} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-[#7a8299] uppercase tracking-wider font-semibold">effects</div>
                      {!effectsValid && <span className="text-[10px] font-bold text-[#f87171]">Invalid JSON</span>}
                    </div>
                    <textarea value={effectsText ?? tpl.effects ?? ''} onChange={e => setEffectsText(e.target.value)} rows={10} placeholder="[]" className={monoCls} style={{ borderColor: effectsValid ? undefined : '#f87171' }} />
                  </div>
                  <details className="text-[10px] text-[#4a5068]">
                    <summary className="cursor-pointer hover:text-white/70">Available effect types</summary>
                    <div className="mt-2 space-y-1">
                      {EFFECT_META.map(e => (
                        <div key={e.type} className="flex items-center gap-2">
                          <span>{e.emoji}</span>
                          <code className="text-[#a3adc3]">{e.type}</code>
                          <span>— {e.description}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </section>
          </div>

          {/* ─── RIGHT: live preview in a phone frame ────── */}
          <aside className="order-1 lg:order-2 lg:sticky lg:top-[76px] lg:self-start space-y-3">
            <div className="text-[10px] uppercase tracking-wider text-[#7a8299] font-semibold flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
              Live preview
              <span className="text-[9px] font-normal text-[#4a5068] normal-case tracking-normal ml-1">Plays after meet-and-hug</span>
            </div>

            {/* Preview component owns its device chrome (Mobile/Tablet/Desktop). */}
            <TemplateLivePreview effects={effects} fieldsSchema={fieldsSchema} accent={accent} />

            {/* Quick tip card */}
            <div className="rounded-2xl p-3 flex items-start gap-2" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(236,72,153,0.04))', border: '1px solid rgba(168,85,247,0.15)' }}>
              <Sparkles size={13} style={{ color: '#c084fc' }} className="mt-0.5 shrink-0" />
              <div className="text-[10px] text-[#a3adc3] leading-relaxed">
                Tick <b className="text-white">With intro</b> above to preview the full flow — meet-and-hug then your reveal, exactly like the recipient sees it.
              </div>
            </div>
          </aside>

        </div>
      </main>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────
function SectionCard({ icon, title, color, hint, children }: {
  icon: React.ReactNode; title: string; color: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl p-5 space-y-4" style={{ background: 'linear-gradient(180deg, rgba(23,25,32,0.7), rgba(17,19,24,0.5))', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${color}22`, color }}>
            {icon}
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{title}</h3>
        </div>
        {hint && <p className="text-[11px] text-[#7a8299] ml-8 -mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
