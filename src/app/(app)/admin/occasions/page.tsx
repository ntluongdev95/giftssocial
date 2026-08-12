'use client';

// /admin/occasions — dashboard cho toàn bộ catalogue.
// Desktop: hero header + metrics row + filter chips + responsive grid of cards.
// Mobile: cùng cấu trúc nhưng single-column grid.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ShieldCheck, Plus, ArrowLeft, Search, Calendar, Infinity as InfinityIcon,
  Sparkles, Layers, CheckCircle2, EyeOff, TrendingUp,
} from 'lucide-react';

interface AdminOccasion {
  id: string;
  name: string;
  name_vi: string | null;
  emoji: string;
  theme_color: string;
  bg_gradient: string | null;
  description: string | null;
  active: number;
  template_count: number;
  sort_order: number;
  evergreen: number;
  date_month: number | null;
  date_day: number | null;
  is_lunar: number;
  window_days: number;
}

interface AdminTemplateLite {
  id: string;
  active: number;
  premium: number;
  effects: string | null;
  occasion_ids: string | null; // GROUP_CONCAT
}

const fetcher = (url: string) => fetch(url, { credentials: 'same-origin' }).then(async r => {
  if (r.status === 404) throw new Error('forbidden');
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

type FilterKey = 'all' | 'active' | 'calendar' | 'evergreen' | 'inactive';

function daysUntil(month: number, day: number, from = new Date()): number {
  const year = from.getFullYear();
  let target = new Date(year, month - 1, day, 0, 0, 0, 0);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0);
  if (target < start) target = new Date(year + 1, month - 1, day, 0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export default function AdminOccasionsPage() {
  const router = useRouter();
  const { data: occRes, error, isLoading } = useSWR<{ data: AdminOccasion[] }>('/api/v1/admin/occasions', fetcher);
  const { data: tplRes } = useSWR<{ data: AdminTemplateLite[] }>('/api/v1/admin/templates', fetcher);

  const occasions = occRes?.data ?? [];
  const templates = tplRes?.data ?? [];

  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  // ── Metrics ────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalTpls = templates.length;
    const dataDrivenTpls = templates.filter(t => {
      try { return t.effects && (JSON.parse(t.effects) as unknown[]).length > 0; } catch { return false; }
    }).length;
    return {
      total: occasions.length,
      active: occasions.filter(o => o.active === 1).length,
      totalTemplates: totalTpls,
      dataDriven: dataDrivenTpls,
    };
  }, [occasions, templates]);

  // ── Filter + search ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return occasions.filter(o => {
      if (filter === 'active' && o.active !== 1) return false;
      if (filter === 'inactive' && o.active === 1) return false;
      if (filter === 'calendar' && (!o.date_month || o.evergreen === 1)) return false;
      if (filter === 'evergreen' && o.evergreen !== 1) return false;
      if (q && !(o.name.toLowerCase().includes(q) || (o.name_vi ?? '').toLowerCase().includes(q) || o.id.includes(q))) return false;
      return true;
    });
  }, [occasions, filter, search]);

  // ── Access-guarded ────────────────────────────────────────────────
  if (error && (error.message === 'forbidden' || String(error).includes('404'))) {
    return (
      <div className="h-full overflow-y-auto bg-[#05060a] text-white flex flex-col items-center justify-center px-6 text-center">
        <ShieldCheck size={32} className="text-[#4a5068] mb-2" />
        <h1 className="text-lg font-semibold mb-1">Admin only</h1>
        <p className="text-sm text-[#4a5068] mb-4">This area is restricted.</p>
        <button onClick={() => router.push('/me')} className="rounded-xl px-4 py-2 text-sm font-semibold cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          Back to /me
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto text-white" style={{
      background: 'radial-gradient(ellipse 1000px 600px at 50% -200px, rgba(168,85,247,0.12), transparent 60%), #05060a',
    }}>
      {/* ── Sticky top bar ────────────────────────────────────── */}
      <header className="sticky top-0 z-20 backdrop-blur-xl" style={{ background: 'rgba(5,6,10,0.75)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto flex items-center gap-3 px-6 py-3">
          <button onClick={() => router.push('/me')} className="flex items-center gap-2 text-sm text-[#a3adc3] hover:text-white cursor-pointer">
            <ArrowLeft size={16} /> Admin
          </button>
          <div className="w-px h-4 bg-white/10" />
          <span className="text-sm font-semibold text-white">Occasions</span>
          <div className="flex-1" />
          <button
            onClick={() => router.push('/admin/templates/new')}
            className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white cursor-pointer transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #ec4899, #a855f7)', boxShadow: '0 4px 20px rgba(168,85,247,0.35)' }}
          >
            <Plus size={14} /> New template
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-16">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="pt-10 pb-8">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #a855f720, #ec489920)', border: '1px solid rgba(168,85,247,0.3)' }}>
              <Sparkles size={22} style={{ color: '#c084fc' }} />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Occasions</h1>
              <p className="text-sm text-[#7a8299] mt-0.5">Catalogue that powers the Kiss / Gift picker across the app.</p>
            </div>
          </div>
        </section>

        {/* ── Metrics ──────────────────────────────────────────── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <MetricCard icon={<Calendar size={16} />} label="Occasions" value={metrics.total} accent="#c084fc" isLoading={isLoading} />
          <MetricCard icon={<CheckCircle2 size={16} />} label="Active" value={metrics.active} accent="#22c55e" isLoading={isLoading} />
          <MetricCard icon={<Layers size={16} />} label="Templates" value={metrics.totalTemplates} accent="#38bdf8" isLoading={!tplRes} />
          <MetricCard icon={<TrendingUp size={16} />} label="Data-driven" value={metrics.dataDriven} accent="#fbbf24" isLoading={!tplRes} />
        </section>

        {/* ── Filter bar ───────────────────────────────────────── */}
        <section className="flex flex-wrap items-center gap-2 mb-6">
          <FilterChip active={filter === 'all'}       onClick={() => setFilter('all')}       label="All"       count={occasions.length} />
          <FilterChip active={filter === 'active'}    onClick={() => setFilter('active')}    label="Active"    count={metrics.active} />
          <FilterChip active={filter === 'calendar'}  onClick={() => setFilter('calendar')}  label="Calendar"  count={occasions.filter(o => !!o.date_month && !o.evergreen).length} icon={<Calendar size={11} />} />
          <FilterChip active={filter === 'evergreen'} onClick={() => setFilter('evergreen')} label="Evergreen" count={occasions.filter(o => o.evergreen === 1).length} icon={<InfinityIcon size={11} />} />
          <FilterChip active={filter === 'inactive'}  onClick={() => setFilter('inactive')}  label="Inactive"  count={occasions.length - metrics.active} icon={<EyeOff size={11} />} />
          <div className="flex-1" />
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4a5068] pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search occasions…"
              className="pl-8 pr-3 py-1.5 rounded-lg text-xs bg-black/40 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/25 w-56"
            />
          </div>
        </section>

        {/* ── Grid ─────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={{ background: 'rgba(17,19,24,0.4)', border: '1px dashed rgba(255,255,255,0.08)' }}>
            <div className="text-3xl mb-2">✨</div>
            <div className="text-sm font-semibold text-white/70">No occasions match</div>
            <div className="text-xs text-[#4a5068] mt-1">Try clearing the filter or searching a different term.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(o => {
              const templatesInOcc = templates.filter(t => (t.occasion_ids ?? '').split(',').includes(o.id));
              const liveCount = templatesInOcc.filter(t => {
                try { return t.effects && (JSON.parse(t.effects) as unknown[]).length > 0; } catch { return false; }
              }).length;
              return (
                <OccasionCard
                  key={o.id}
                  occasion={o}
                  liveCount={liveCount}
                  onClick={() => router.push(`/admin/occasions/${o.id}`)}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Metric card ─────────────────────────────────────────────────────
function MetricCard({ icon, label, value, accent, isLoading }: { icon: React.ReactNode; label: string; value: number; accent: string; isLoading?: boolean }) {
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-30" style={{ background: accent }} />
      <div className="relative flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>
        {icon} {label}
      </div>
      <div className="relative text-3xl font-bold mt-2 tabular-nums" style={{ color: '#fff' }}>
        {isLoading ? <div className="w-12 h-8 rounded bg-white/5 animate-pulse" /> : value}
      </div>
    </div>
  );
}

// ── Filter chip ─────────────────────────────────────────────────────
function FilterChip({ active, onClick, label, count, icon }: { active: boolean; onClick: () => void; label: string; count: number; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all"
      style={active
        ? { background: 'linear-gradient(135deg, #ec4899, #a855f7)', color: '#fff', boxShadow: '0 2px 12px rgba(168,85,247,0.4)' }
        : { background: 'rgba(17,19,24,0.6)', color: '#a3adc3', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {icon}
      {label}
      <span className="text-[10px] opacity-70 tabular-nums">{count}</span>
    </button>
  );
}

// ── Occasion card ───────────────────────────────────────────────────
function OccasionCard({ occasion: o, liveCount, onClick }: { occasion: AdminOccasion; liveCount: number; onClick: () => void }) {
  const isEvergreen = o.evergreen === 1;
  const days = (!isEvergreen && o.date_month && o.date_day) ? daysUntil(o.date_month, o.date_day) : null;
  const dateText = isEvergreen
    ? 'Evergreen'
    : (o.date_month && o.date_day) ? `${monthName(o.date_month)} ${o.date_day}` : '—';

  return (
    <button
      onClick={onClick}
      className="group relative text-left rounded-2xl overflow-hidden cursor-pointer transition-all hover:-translate-y-1"
      style={{
        background: 'rgba(17,19,24,0.6)',
        border: `1px solid ${o.theme_color}30`,
        boxShadow: `0 4px 24px ${o.theme_color}00`,
        opacity: o.active === 1 ? 1 : 0.55,
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = `0 8px 32px ${o.theme_color}40`}
      onMouseLeave={e => e.currentTarget.style.boxShadow = `0 4px 24px ${o.theme_color}00`}
    >
      {/* Hero band with gradient */}
      <div
        className="relative h-24 flex items-center justify-center overflow-hidden"
        style={{ background: o.bg_gradient ?? `linear-gradient(135deg, ${o.theme_color}30, ${o.theme_color}80)` }}
      >
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, transparent 0%, rgba(0,0,0,0.4) 100%)' }} />
        <div className="relative text-5xl transition-transform group-hover:scale-110 group-hover:rotate-6" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}>
          {o.emoji}
        </div>

        {/* Status pills */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {o.active !== 1 && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded backdrop-blur" style={{ background: 'rgba(0,0,0,0.6)', color: '#f87171' }}>Off</span>
          )}
          {days !== null && days <= 30 && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded backdrop-blur" style={{ background: 'rgba(0,0,0,0.7)', color: '#fbbf24' }}>
              in {days}d
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-3.5">
        <div className="flex items-center gap-1.5 mb-1">
          <h3 className="text-sm font-bold text-white truncate flex-1">{o.name}</h3>
        </div>
        {o.name_vi && <div className="text-[10px] text-[#7a8299] truncate">{o.name_vi}</div>}

        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.05]">
          <div className="flex-1 min-w-0">
            <div className="text-[9px] uppercase tracking-wider text-[#4a5068] font-bold">Templates</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-sm font-bold text-white tabular-nums">{o.template_count}</span>
              {liveCount > 0 && (
                <span className="text-[10px] font-bold" style={{ color: '#22c55e' }}>· {liveCount} live</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider text-[#4a5068] font-bold">
              {isEvergreen ? 'Always on' : 'When'}
            </div>
            <div className="text-[11px] font-semibold text-white/80 mt-0.5 flex items-center gap-1 justify-end">
              {isEvergreen ? <InfinityIcon size={11} /> : <Calendar size={11} />}
              {dateText}{o.is_lunar === 1 && !isEvergreen && <span className="text-[9px] text-[#7a8299]">·lunar</span>}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="h-24 bg-white/[0.03]" />
      <div className="p-3.5 space-y-2">
        <div className="h-3 w-2/3 rounded bg-white/[0.05]" />
        <div className="h-2 w-1/2 rounded bg-white/[0.04]" />
        <div className="pt-3 mt-3 border-t border-white/[0.05] flex justify-between">
          <div className="h-3 w-12 rounded bg-white/[0.05]" />
          <div className="h-3 w-16 rounded bg-white/[0.05]" />
        </div>
      </div>
    </div>
  );
}

function monthName(m: number): string {
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1] ?? '';
}
