'use client';

// /admin/occasions/[id] — smart occasion detail dashboard.
// Aurora bg tinted by the occasion's theme_color. Sticky glass top bar
// with breadcrumb + stat pills + Save. Two-column body: metadata form
// (grouped into Identity + Schedule + Visibility sections) on the left,
// templates grid on the right showing status/featured/premium at a glance.

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  ArrowLeft, ShieldCheck, Save, Plus, Loader2, CheckCircle2, AlertCircle,
  Wand2, Calendar, Eye, Layers, Sparkles, Star, Infinity as InfinityIcon,
  ArrowRight,
} from 'lucide-react';

interface AdminTemplateLite {
  id: string;
  name: string;
  emoji: string;
  component_key: string;
  premium: number;
  active: number;
  occ_sort: number;
  featured: number;
  effects: string | null;
  accent_color?: string | null;
  thumbnail_bg?: string | null;
}

interface AdminOccasionDetail {
  id: string;
  name: string;
  name_vi: string | null;
  emoji: string;
  theme_color: string;
  bg_gradient: string | null;
  description: string | null;
  description_vi: string | null;
  date_month: number | null;
  date_day: number | null;
  is_lunar: number;
  evergreen: number;
  window_days: number;
  sort_order: number;
  active: number;
  templates: AdminTemplateLite[];
}

const fetcher = (url: string) => fetch(url, { credentials: 'same-origin' }).then(async r => {
  if (r.status === 404) throw new Error('forbidden');
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

function daysUntil(month: number, day: number, from = new Date()): number {
  const year = from.getFullYear();
  let target = new Date(year, month - 1, day, 0, 0, 0, 0);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0);
  if (target < start) target = new Date(year + 1, month - 1, day, 0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Props { params: Promise<{ id: string }> }

export default function AdminOccasionEditPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<{ data: AdminOccasionDetail }>(`/api/v1/admin/occasions/${id}`, fetcher);
  const occ = data?.data;

  const [form, setForm] = useState<Partial<AdminOccasionDetail> | null>(null);
  const current = { ...occ, ...form } as AdminOccasionDetail | undefined;
  const [saving, setSaving] = useState(false);

  // Derived template stats
  const stats = useMemo(() => {
    const templates = occ?.templates ?? [];
    const liveCount = templates.filter(t => {
      if (t.component_key && t.component_key !== 'data-driven') return true;
      try { return t.effects && (JSON.parse(t.effects) as unknown[]).length > 0; } catch { return false; }
    }).length;
    return {
      total:    templates.length,
      live:     liveCount,
      featured: templates.filter(t => t.featured === 1).length,
      premium:  templates.filter(t => t.premium === 1).length,
    };
  }, [occ?.templates]);

  if (error && (error.message === 'forbidden' || String(error).includes('404'))) {
    return (
      <div className="h-full overflow-y-auto bg-[#05060a] text-white flex flex-col items-center justify-center px-6 text-center">
        <ShieldCheck size={32} className="text-[#4a5068] mb-2" />
        <h1 className="text-lg font-semibold mb-1">Admin only</h1>
      </div>
    );
  }
  if (isLoading || !occ || !current) {
    return <div className="h-full bg-[#05060a] text-white flex items-center justify-center text-sm text-[#4a5068]">Loading…</div>;
  }

  const setField = <K extends keyof AdminOccasionDetail>(key: K, value: AdminOccasionDetail[K]) => {
    setForm(prev => ({ ...(prev ?? {}), [key]: value }));
  };

  const save = async () => {
    if (!form) return toast.info('No changes');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      if ('is_lunar' in payload)  payload.is_lunar  = !!payload.is_lunar;
      if ('evergreen' in payload) payload.evergreen = !!payload.evergreen;
      if ('active' in payload)    payload.active    = !!payload.active;

      const res = await fetch(`/api/v1/admin/occasions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Save failed');
      toast.success('Saved');
      setForm(null);
      mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const accent = current.theme_color ?? '#ec4899';
  const dirty = !!form;
  const isEvergreen = current.evergreen === 1;
  const days = (!isEvergreen && current.date_month && current.date_day) ? daysUntil(current.date_month, current.date_day) : null;
  const dateText = isEvergreen
    ? 'Evergreen · always visible'
    : (current.date_month && current.date_day) ? `${MONTH[current.date_month - 1]} ${current.date_day}` : '—';

  const inputCls  = 'w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-white placeholder-white/30 focus:outline-none focus:border-white/25 text-sm transition-colors';
  const labelCls  = 'text-[10px] uppercase tracking-wider text-[#7a8299] font-semibold mb-1.5 block';

  return (
    <div className="h-full overflow-y-auto text-white" style={{
      background: `radial-gradient(ellipse 1000px 600px at 50% -200px, ${accent}22, transparent 60%), #05060a`,
    }}>
      {/* ── Sticky glass top bar ─────────────────────────────── */}
      <header className="sticky top-0 z-20 backdrop-blur-xl" style={{ background: 'rgba(5,6,10,0.85)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto flex items-center gap-3 px-6 py-3">
          <button onClick={() => router.push('/admin/occasions')} className="flex items-center gap-2 text-sm text-[#a3adc3] hover:text-white cursor-pointer">
            <ArrowLeft size={16} /> Occasions
          </button>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-2xl shrink-0">{current.emoji}</div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate flex items-center gap-2">
                {current.name}
                {current.active !== 1 && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: '#f8717125', color: '#f87171' }}>Inactive</span>}
              </div>
              <div className="text-[10px] text-[#4a5068] font-mono truncate">{id}</div>
            </div>
          </div>
          <div className="flex-1" />
          <div className="hidden md:flex items-center gap-2 text-[10px] text-[#a3adc3]">
            <span className="flex items-center gap-1"><Layers size={11} /> {stats.total} templates</span>
            <span className="w-px h-3 bg-white/10" />
            <span className="flex items-center gap-1" style={{ color: stats.live > 0 ? '#22c55e' : undefined }}>
              <Sparkles size={11} /> {stats.live} live
            </span>
          </div>
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
      </header>

      {/* ── Body ─────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto p-5 lg:p-8">
        {/* Hero band */}
        <section className="relative rounded-3xl overflow-hidden mb-6" style={{
          background: current.bg_gradient ?? `linear-gradient(135deg, ${accent}30, ${accent}66)`,
          border: `1px solid ${accent}40`,
          minHeight: 160,
        }}>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 30% 50%, transparent 0%, rgba(0,0,0,0.55) 100%)' }} />
          <div className="relative p-6 flex items-center gap-5">
            <div className="text-7xl md:text-8xl" style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.55))' }}>
              {current.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{current.name}</h1>
              {current.name_vi && <div className="text-[11px] text-white/70 mt-0.5">{current.name_vi}</div>}
              {current.description && <p className="text-sm text-white/80 mt-2 max-w-lg leading-relaxed">{current.description}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded backdrop-blur" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                  {isEvergreen ? <InfinityIcon size={10} /> : <Calendar size={10} />}
                  {dateText}
                </span>
                {days !== null && days <= 60 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded backdrop-blur" style={{ background: 'rgba(0,0,0,0.7)', color: '#fbbf24' }}>
                    in {days} day{days !== 1 && 's'}
                  </span>
                )}
                {current.is_lunar === 1 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded backdrop-blur" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>Lunar</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Metric strip */}
        <section className="grid grid-cols-4 gap-3 mb-6">
          <MetricPill icon={<Layers size={12} />}    label="Templates" value={stats.total}    accent="#c084fc" />
          <MetricPill icon={<Sparkles size={12} />}  label="Live"      value={stats.live}     accent="#22c55e" />
          <MetricPill icon={<Star size={12} />}      label="Featured"  value={stats.featured} accent="#fbbf24" />
          <MetricPill icon={<CheckCircle2 size={12} />} label="Premium" value={stats.premium} accent="#f472b6" />
        </section>

        {/* Two-column: metadata form (left) + templates grid (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-6 lg:gap-8">

          {/* ─── LEFT: form ─────────────────────────────────── */}
          <div className="space-y-5">
            <SectionCard icon={<Wand2 size={14} />} title="Identity" color={accent}>
              <div className="grid grid-cols-2 gap-3">
                <label className="block col-span-2">
                  <span className={labelCls}>Name (EN)</span>
                  <input value={current.name ?? ''} onChange={e => setField('name', e.target.value)} className={inputCls} />
                </label>
                <label className="block col-span-2">
                  <span className={labelCls}>Name (VI)</span>
                  <input value={current.name_vi ?? ''} onChange={e => setField('name_vi', e.target.value || null as unknown as string)} className={inputCls} />
                </label>
                <label className="block">
                  <span className={labelCls}>Emoji</span>
                  <input value={current.emoji ?? ''} onChange={e => setField('emoji', e.target.value)} maxLength={10} className={`${inputCls} text-center text-2xl h-[42px] py-0`} />
                </label>
                <label className="block">
                  <span className={labelCls}>Theme color</span>
                  <div className="flex gap-2">
                    <input type="color" value={current.theme_color ?? '#ec4899'} onChange={e => setField('theme_color', e.target.value)} className="w-[42px] h-[42px] rounded-lg border border-white/10 bg-transparent cursor-pointer shrink-0" />
                    <input value={current.theme_color ?? ''} onChange={e => setField('theme_color', e.target.value)} className={`${inputCls} font-mono`} />
                  </div>
                </label>
                <label className="block col-span-2">
                  <span className={labelCls}>Description (EN)</span>
                  <textarea value={current.description ?? ''} onChange={e => setField('description', e.target.value)} maxLength={200} rows={2} className={`${inputCls} resize-none`} />
                </label>
                <label className="block col-span-2">
                  <span className={labelCls}>Background gradient (CSS)</span>
                  <input value={current.bg_gradient ?? ''} onChange={e => setField('bg_gradient', e.target.value)} placeholder="linear-gradient(135deg, #a, #b)" className={`${inputCls} font-mono text-xs`} />
                </label>
              </div>
            </SectionCard>

            <SectionCard icon={<Calendar size={14} />} title="Schedule" color="#38bdf8" hint="Calendar month + day, or mark evergreen for always-on occasions like Birthday.">
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className={labelCls}>Month</span>
                  <input type="number" min={1} max={12} value={current.date_month ?? ''} onChange={e => setField('date_month', e.target.value ? Number(e.target.value) : null)} disabled={isEvergreen} className={`${inputCls} disabled:opacity-40 disabled:cursor-not-allowed`} />
                </label>
                <label className="block">
                  <span className={labelCls}>Day</span>
                  <input type="number" min={1} max={31} value={current.date_day ?? ''} onChange={e => setField('date_day', e.target.value ? Number(e.target.value) : null)} disabled={isEvergreen} className={`${inputCls} disabled:opacity-40 disabled:cursor-not-allowed`} />
                </label>
                <label className="block">
                  <span className={labelCls}>Window (days)</span>
                  <input type="number" min={0} max={365} value={current.window_days ?? 14} onChange={e => setField('window_days', Number(e.target.value))} className={inputCls} />
                </label>
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isEvergreen} onChange={e => setField('evergreen', (e.target.checked ? 1 : 0) as number)} className="accent-purple-500 cursor-pointer" />
                  <span className="text-xs text-white/80 flex items-center gap-1"><InfinityIcon size={11} /> Evergreen (no date)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!current.is_lunar} onChange={e => setField('is_lunar', (e.target.checked ? 1 : 0) as number)} disabled={isEvergreen} className="accent-purple-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" />
                  <span className="text-xs text-white/80">Lunar calendar</span>
                </label>
              </div>
            </SectionCard>

            <SectionCard icon={<Eye size={14} />} title="Visibility" color="#22c55e" hint="Sort order controls position in the picker grid; higher priority occasions sort first.">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelCls}>Sort order</span>
                  <input type="number" value={current.sort_order ?? 0} onChange={e => setField('sort_order', Number(e.target.value))} className={inputCls} />
                </label>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer h-[42px]">
                    <input type="checkbox" checked={!!current.active} onChange={e => setField('active', (e.target.checked ? 1 : 0) as number)} className="accent-green-500 cursor-pointer" />
                    <span className="text-xs text-white/80">Active (visible in picker)</span>
                  </label>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* ─── RIGHT: templates grid ──────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers size={18} style={{ color: accent }} />
                  Templates
                  <span className="text-xs font-normal text-[#7a8299]">({stats.total})</span>
                </h2>
                <p className="text-[11px] text-[#7a8299] mt-0.5">Each template renders its own React component when the recipient opens.</p>
              </div>
              <button
                onClick={() => router.push(`/admin/templates/new?occasion=${id}`)}
                className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white cursor-pointer transition-all hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${accent}, ${accent}dd)`, boxShadow: `0 4px 16px ${accent}44` }}
              >
                <Plus size={14} /> New template
              </button>
            </div>

            {occ.templates.length === 0 ? (
              <div className="text-center py-16 rounded-2xl" style={{ background: 'rgba(17,19,24,0.4)', border: '1px dashed rgba(255,255,255,0.08)' }}>
                <div className="text-4xl mb-2">✨</div>
                <div className="text-sm font-semibold text-white/70">No templates yet</div>
                <div className="text-xs text-[#4a5068] mt-1">Create the first one for this occasion.</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {occ.templates
                  .slice()
                  .sort((a, b) => (a.occ_sort ?? 0) - (b.occ_sort ?? 0))
                  .map(t => <TemplateCard key={t.id} tpl={t} accent={accent} onClick={() => router.push(`/admin/templates/${t.id}`)} />)}
              </div>
            )}

            {occ.templates.length > 0 && (
              <div className="rounded-2xl p-3 flex items-start gap-2 mt-2" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(236,72,153,0.04))', border: '1px solid rgba(168,85,247,0.15)' }}>
                <Sparkles size={13} style={{ color: '#c084fc' }} className="mt-0.5 shrink-0" />
                <div className="text-[10px] text-[#a3adc3] leading-relaxed">
                  Sort order + featured flags of each template within this occasion are edited on the template&apos;s own page.
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

// ── Metric pill (compact) ─────────────────────────────────────────────
function MetricPill({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl p-3 relative overflow-hidden" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full blur-2xl opacity-30" style={{ background: accent }} />
      <div className="relative flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: accent }}>
        {icon} {label}
      </div>
      <div className="relative text-xl font-bold mt-1 tabular-nums text-white">{value}</div>
    </div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────
function SectionCard({ icon, title, color, hint, children }: { icon: React.ReactNode; title: string; color: string; hint?: string; children: React.ReactNode }) {
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

// ── Template card in the grid ─────────────────────────────────────────
function TemplateCard({ tpl, accent, onClick }: { tpl: AdminTemplateLite; accent: string; onClick: () => void }) {
  const isReact = tpl.component_key && tpl.component_key !== 'data-driven';
  let hasEffects = false;
  try { hasEffects = !!tpl.effects && (JSON.parse(tpl.effects) as unknown[]).length > 0; } catch { /* ignore */ }
  const isLive = isReact || hasEffects;
  const cardAccent = tpl.accent_color || accent;

  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5"
      style={{
        background: 'rgba(17,19,24,0.6)',
        border: `1px solid ${cardAccent}30`,
        opacity: tpl.active === 1 ? 1 : 0.45,
        boxShadow: `0 4px 16px ${cardAccent}00`,
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = `0 8px 24px ${cardAccent}30`}
      onMouseLeave={e => e.currentTarget.style.boxShadow = `0 4px 16px ${cardAccent}00`}
    >
      {/* Hero band */}
      <div
        className="relative h-20 flex items-center justify-center overflow-hidden"
        style={{ background: tpl.thumbnail_bg ?? `linear-gradient(135deg, ${cardAccent}40, ${cardAccent}bb)` }}
      >
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, transparent 0%, rgba(0,0,0,0.35) 100%)' }} />
        <div className="relative text-4xl transition-transform group-hover:scale-110" style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }}>
          {tpl.emoji}
        </div>
        <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 items-end">
          {tpl.featured === 1 && (
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-0.5 backdrop-blur" style={{ background: 'rgba(0,0,0,0.55)', color: '#fbbf24' }}>
              <Star size={8} fill="#fbbf24" /> Feat
            </span>
          )}
          {tpl.premium === 1 && (
            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded backdrop-blur" style={{ background: 'rgba(0,0,0,0.55)', color: '#fbbf24' }}>Pro</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        <div className="text-sm font-bold text-white truncate">{tpl.name}</div>
        <div className="text-[9px] text-[#4a5068] font-mono truncate mt-0.5">{tpl.id}</div>

        <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-white/[0.05]">
          {isLive ? (
            <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: '#22c55e' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
              {isReact ? 'React' : 'Data-driven'}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#7a8299]">
              <AlertCircle size={9} /> Not designed
            </span>
          )}
          <ArrowRight size={12} className="text-[#4a5068] group-hover:text-white transition-colors" />
        </div>
      </div>
    </button>
  );
}
