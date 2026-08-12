'use client';

// /admin/templates/new — two-column create form matching the Gao Gift
// (CoupleCardBuilder) pattern: form on the left, live-updating preview
// on the right. Preview shows how the template card will appear in the
// picker + a hint about the next step (adding effects).

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import { ArrowLeft, ShieldCheck, Sparkles, Wand2, Loader2, ArrowRight, Layers, RefreshCw } from 'lucide-react';
import MeetAndHugScene from '@/components/reveals/_shared/MeetAndHugScene';

interface OccasionRef { id: string; name: string; name_vi?: string | null; emoji: string; theme_color: string; }

const fetcher = (url: string) => fetch(url, { credentials: 'same-origin' }).then(async r => {
  if (r.status === 404) throw new Error('forbidden');
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

// Auto-slug: "Snow Fall" → "snow-fall"
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export default function AdminNewTemplatePage() {
  const router = useRouter();
  const search = useSearchParams();
  const preselectOccasion = search.get('occasion') ?? '';

  const { data, error } = useSWR<{ data: OccasionRef[] }>('/api/v1/admin/occasions', fetcher);
  const occasions = useMemo<OccasionRef[]>(() => data?.data ?? [], [data]);

  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [idTouched, setIdTouched] = useState(false);
  const [emoji, setEmoji] = useState('🎁');
  const [accent, setAccent] = useState('#ec4899');
  const [description, setDescription] = useState('');
  const [occasionIds, setOccasionIds] = useState<string[]>(preselectOccasion ? [preselectOccasion] : []);
  const [saving, setSaving] = useState(false);

  // Loop the meet-and-hug preview so admin sees exactly what plays
  // just before their reveal effects kick in. Scene lasts ~3.4s; give
  // it a 1s breath before restarting.
  const [sceneKey, setSceneKey] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSceneKey(k => k + 1), 4400);
    return () => clearInterval(t);
  }, []);

  // Auto-fill ID from name until user overrides it.
  const handleNameChange = (v: string) => {
    setName(v);
    if (!idTouched) setId(slugify(v));
  };

  const previewGradient = useMemo(
    () => `linear-gradient(135deg, ${accent}55 0%, ${accent} 100%)`,
    [accent]
  );

  const linkedOccasions = useMemo(
    () => occasions.filter(o => occasionIds.includes(o.id)),
    [occasions, occasionIds]
  );

  const canCreate = !!id && !!name.trim() && /^[a-z0-9-]+$/.test(id);

  if (error && (error.message === 'forbidden' || String(error).includes('404'))) {
    return (
      <div className="h-full overflow-y-auto bg-[#05060a] text-white flex flex-col items-center justify-center px-6 text-center">
        <ShieldCheck size={32} className="text-[#4a5068] mb-2" />
        <h1 className="text-lg font-semibold mb-1">Admin only</h1>
      </div>
    );
  }

  const save = async () => {
    if (!canCreate) return toast.error('Name + ID (lowercase, digits, hyphens) required');
    setSaving(true);
    try {
      const res = await fetch('/api/v1/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          id, name, emoji,
          accent_color: accent,
          description: description || undefined,
          component_key: 'data-driven',
          thumbnail_bg: previewGradient,
          occasion_ids: occasionIds,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Create failed');
      toast.success('Template created — now add effects');
      router.push(`/admin/templates/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-white placeholder-white/30 focus:outline-none focus:border-white/25 text-sm transition-colors';
  const labelCls = 'text-[10px] uppercase tracking-wider text-[#7a8299] font-semibold mb-1.5 block';

  return (
    <div className="h-full overflow-y-auto text-white" style={{
      background: 'radial-gradient(ellipse 1000px 600px at 50% -200px, rgba(168,85,247,0.12), transparent 60%), #05060a',
    }}>
      {/* ── Sticky top bar (Gao Gift style) ─────────────────── */}
      <header className="sticky top-0 z-20 backdrop-blur-xl" style={{ background: 'rgba(5,6,10,0.85)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-6xl mx-auto flex items-center gap-3 px-6 py-3">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] hover:text-white cursor-pointer">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-xl">{emoji}</span>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">New template</h2>
              <p className="text-[10px] text-[#7a8299] leading-tight">Fill it in — the preview updates live</p>
            </div>
          </div>
          <div className="flex-1" />
          <button
            onClick={save}
            disabled={!canCreate || saving}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white cursor-pointer transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ background: 'linear-gradient(135deg, #ec4899, #a855f7)', boxShadow: canCreate ? '0 4px 20px rgba(168,85,247,0.35)' : undefined }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {saving ? 'Creating…' : 'Create & design'}
            {!saving && <ArrowRight size={13} />}
          </button>
        </div>
      </header>

      {/* ── Two-column body ─────────────────────────────────── */}
      <main className="max-w-6xl mx-auto p-5 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-6 lg:gap-8">

          {/* ─── LEFT: form ─────────────────────────────────── */}
          <div className="space-y-5 order-2 lg:order-1">
            {/* Identity */}
            <section className="rounded-2xl p-5 space-y-4" style={{ background: 'linear-gradient(180deg, rgba(23,25,32,0.7), rgba(17,19,24,0.5))', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Wand2 size={14} style={{ color: '#c084fc' }} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#c084fc]">Identity</h3>
              </div>

              <label className="block">
                <span className={labelCls}>Name</span>
                <input
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="Snow Fall"
                  className={inputCls}
                  autoFocus
                />
              </label>

              <label className="block">
                <span className={labelCls}>ID (slug)</span>
                <div className="flex items-stretch gap-2">
                  <div className="px-3 py-2 rounded-lg text-[11px] text-[#4a5068] font-mono flex items-center shrink-0" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    /reveals/
                  </div>
                  <input
                    value={id}
                    onChange={e => { setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setIdTouched(true); }}
                    placeholder="snow-fall"
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div className="text-[10px] text-[#4a5068] mt-1">Auto-generated from name. Lowercase, digits, hyphens only.</div>
              </label>

              <div className="grid grid-cols-[110px_1fr] gap-3">
                <label className="block">
                  <span className={labelCls}>Emoji</span>
                  <input
                    value={emoji}
                    onChange={e => setEmoji(e.target.value)}
                    maxLength={10}
                    className={`${inputCls} text-center text-2xl h-[42px] py-0`}
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>Accent color</span>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={accent}
                      onChange={e => setAccent(e.target.value)}
                      className="w-[42px] h-[42px] rounded-lg border border-white/10 bg-transparent cursor-pointer shrink-0"
                    />
                    <input
                      value={accent}
                      onChange={e => setAccent(e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value)}
                      maxLength={7}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                </label>
              </div>

              <label className="block">
                <span className={labelCls}>Description</span>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  maxLength={300}
                  rows={2}
                  placeholder="What kind of reveal does this template play?"
                  className={`${inputCls} resize-none`}
                />
                <div className="text-[10px] text-[#4a5068] mt-1">{description.length}/300</div>
              </label>
            </section>

            {/* Occasions */}
            <section className="rounded-2xl p-5" style={{ background: 'linear-gradient(180deg, rgba(23,25,32,0.7), rgba(17,19,24,0.5))', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Layers size={14} style={{ color: '#c084fc' }} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#c084fc]">Show under these occasions</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {occasions.map(o => {
                  const on = occasionIds.includes(o.id);
                  return (
                    <label
                      key={o.id}
                      className="flex items-center gap-2 rounded-lg p-2.5 cursor-pointer transition-all"
                      style={on
                        ? { background: `${o.theme_color}22`, border: `1px solid ${o.theme_color}`, boxShadow: `0 0 0 2px ${o.theme_color}22` }
                        : { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={e => setOccasionIds(prev => e.target.checked ? [...prev, o.id] : prev.filter(x => x !== o.id))}
                        className="cursor-pointer"
                      />
                      <span className="text-base">{o.emoji}</span>
                      <span className="text-xs truncate flex-1">{o.name}</span>
                    </label>
                  );
                })}
              </div>
              {occasionIds.length === 0 && (
                <div className="text-[10px] text-[#f87171] mt-2">Pick at least one to make it visible in the picker.</div>
              )}
            </section>

            {/* Next-step hint */}
            <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(236,72,153,0.05))', border: '1px solid rgba(168,85,247,0.2)' }}>
              <Sparkles size={16} style={{ color: '#c084fc' }} className="mt-0.5 shrink-0" />
              <div className="text-[11px] text-[#c4b3e0] leading-relaxed">
                After creating, you&apos;ll design the actual reveal — pick effects (particle rain, text flash, confetti…), add fields the sender fills in, and see it play live.
              </div>
            </div>
          </div>

          {/* ─── RIGHT: live preview ────────────────────────── */}
          <aside className="order-1 lg:order-2 lg:sticky lg:top-[76px] lg:self-start space-y-4">
            <div className="text-[10px] uppercase tracking-wider text-[#7a8299] font-semibold flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
              Live preview
            </div>

            {/* Template card exactly as it appears in the picker grid */}
            <div className="rounded-2xl overflow-hidden" style={{
              background: 'rgba(17,19,24,0.6)',
              border: `1px solid ${accent}40`,
              boxShadow: `0 12px 40px ${accent}25`,
            }}>
              {/* Hero band — full accent gradient with big emoji */}
              <div className="relative h-40 flex items-center justify-center overflow-hidden" style={{ background: previewGradient }}>
                <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, transparent 0%, rgba(0,0,0,0.35) 100%)' }} />
                <div className="relative text-7xl" style={{ filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.55))' }}>
                  {emoji}
                </div>
                <div className="absolute top-2.5 right-2.5 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded backdrop-blur" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                  Preview
                </div>
              </div>

              {/* Card body */}
              <div className="p-4">
                <div className="text-base font-bold text-white truncate">
                  {name || <span className="text-[#4a5068] font-normal italic">Untitled template</span>}
                </div>
                <div className="text-[11px] text-[#7a8299] mt-1 min-h-[16px]">
                  {description || 'Description will appear here…'}
                </div>

                {/* Meta strip */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.05]">
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: '#a3adc3' }}>
                    {id || 'no-id'}
                  </span>
                  <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
                    {accent}
                  </div>
                </div>
              </div>
            </div>

            {/* Which occasions it will show under */}
            <div className="rounded-2xl p-4" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-[10px] uppercase tracking-wider text-[#7a8299] font-semibold mb-2">
                Will appear in {linkedOccasions.length} occasion{linkedOccasions.length !== 1 ? 's' : ''}
              </div>
              {linkedOccasions.length === 0 ? (
                <div className="text-[11px] text-[#4a5068]">— none picked yet —</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {linkedOccasions.map(o => (
                    <span key={o.id} className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold" style={{ background: `${o.theme_color}25`, color: '#fff', border: `1px solid ${o.theme_color}44` }}>
                      <span>{o.emoji}</span> {o.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Meet-and-hug loop — this always plays first; the admin's
                future effects run RIGHT AFTER this scene. Looping makes
                the "then your reveal takes over" moment obvious. */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-wider text-[#7a8299] font-semibold">
                  What plays before your reveal
                </div>
                <button
                  type="button"
                  onClick={() => setSceneKey(k => k + 1)}
                  className="flex items-center gap-1 text-[10px] font-semibold text-white/60 hover:text-white cursor-pointer"
                  title="Replay the meet-and-hug scene"
                >
                  <RefreshCw size={10} /> Replay
                </button>
              </div>

              <div className="rounded-2xl relative overflow-hidden" style={{
                aspectRatio: '9 / 16',
                maxHeight: '360px',
                background: 'radial-gradient(ellipse at center, #08091a 0%, #03050e 55%, #000005 100%)',
                border: `1px solid ${accent}30`,
              }}>
                <MeetAndHugScene
                  key={sceneKey}
                  sender={{ name: 'You', avatarUrl: undefined }}
                  receiver={{ name: name || 'Them', avatarUrl: undefined }}
                  senderAccent={accent}
                  receiverAccent="#00d4ff"
                />

                {/* Overlay banner at the bottom telling the admin what
                    happens next — this is where their effects will play. */}
                <div className="absolute inset-x-0 bottom-0 p-3 text-center pointer-events-none" style={{
                  background: `linear-gradient(180deg, transparent, ${accent}dd)`,
                }}>
                  <div className="text-[11px] font-bold text-white flex items-center justify-center gap-1.5">
                    <ArrowRight size={12} className="rotate-90" />
                    Your reveal plays right after
                  </div>
                  <div className="text-[9px] text-white/70 mt-0.5">
                    Add effects on the next page
                  </div>
                </div>
              </div>
            </div>
          </aside>

        </div>
      </main>
    </div>
  );
}
