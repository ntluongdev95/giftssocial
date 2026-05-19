'use client';

/**
 * Shared trip composer. Used by /me/trips/new (mode='create') and
 * /me/trips/[id]/edit (mode='edit'). Owning POST vs PATCH in one place keeps
 * the UI in lockstep — any new field added to the form lands on both flows.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Trash2, Loader2, Send, MapPin, Coins, Clock, ImageIcon,
} from 'lucide-react';

export type Stop = {
  place_name: string;
  activity: string;
  cost: number;
  cost_currency: string;
  duration_minutes: number;
  notes: string;
  place_lat: number | null;
  place_lng: number | null;
};

export type TripFormInitial = {
  title: string;
  cover_image: string | null;
  description: string;
  city: string | null;
  visibility: 'public' | 'friends' | 'private';
  stops: Stop[];
};

type Props =
  | { mode: 'create'; tripId?: undefined; initial?: undefined }
  | { mode: 'edit'; tripId: string; initial: TripFormInitial };

const CURRENCIES = ['VND', 'USD', 'USDC', 'USDT'] as const;

function emptyStop(): Stop {
  return {
    place_name: '',
    activity: '',
    cost: 0,
    cost_currency: 'VND',
    duration_minutes: 0,
    notes: '',
    place_lat: null,
    place_lng: null,
  };
}

export function TripForm(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === 'edit';

  const [title, setTitle] = useState(props.initial?.title ?? '');
  const [coverUrl, setCoverUrl] = useState<string | null>(props.initial?.cover_image ?? null);
  const [description, setDescription] = useState(props.initial?.description ?? '');
  const [city, setCity] = useState(props.initial?.city ?? '');
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>(
    props.initial?.visibility ?? 'public',
  );
  const [stops, setStops] = useState<Stop[]>(
    props.initial?.stops && props.initial.stops.length > 0 ? props.initial.stops : [emptyStop()],
  );
  const [submitting, setSubmitting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  function setStop(idx: number, patch: Partial<Stop>) {
    setStops(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function addStop() {
    if (stops.length >= 20) {
      toast.error('Max 20 stops');
      return;
    }
    setStops(prev => [...prev, emptyStop()]);
  }
  function removeStop(idx: number) {
    if (stops.length === 1) {
      toast.error('A trip needs at least one stop');
      return;
    }
    setStops(prev => prev.filter((_, i) => i !== idx));
  }
  function moveStop(idx: number, dir: -1 | 1) {
    setStops(prev => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  async function uploadCover(file: File | null) {
    if (!file) return;
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/v1/upload', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message || 'Upload failed');
      setCoverUrl(j.data.url);
      toast.success('Cover uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingCover(false);
    }
  }

  async function submit() {
    if (!title.trim()) {
      toast.error('Title required');
      return;
    }
    if (stops.some(s => !s.place_name.trim())) {
      toast.error('Every stop needs a place name');
      return;
    }
    setSubmitting(true);
    try {
      const url = isEdit ? `/api/v1/trips/${props.tripId}` : '/api/v1/trips';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          title: title.trim(),
          cover_image: coverUrl ?? undefined,
          description: description.trim(),
          city: city.trim() || undefined,
          visibility,
          stops,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message || (isEdit ? 'Failed to save' : 'Failed to publish'));
      toast.success(isEdit ? 'Trip updated' : 'Trip published');
      const targetId = isEdit ? props.tripId : j.data.id;
      router.push(`/trips/${targetId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(17,19,24,0.8)',
    border: '1px solid rgba(255,255,255,0.07)',
    color: 'white',
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0a0b0f] text-white">
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{
          background: 'rgba(10,11,15,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] hover:text-white cursor-pointer">
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-base lg:text-lg font-bold ml-auto mr-auto flex items-center gap-1.5">
          <MapPin size={16} className="text-[#00d4ff]" />
          {isEdit ? 'Edit Trip' : 'New Trip'}
        </h1>
        <button
          onClick={submit}
          disabled={submitting}
          className="px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
          style={{ background: '#00d4ff', color: '#0a0b0f' }}
        >
          {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          {isEdit ? 'Save' : 'Publish'}
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 lg:px-8 py-5 pb-20 space-y-5">
        {/* Basics */}
        <div className="space-y-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value.slice(0, 200))}
            placeholder="Trip title (e.g. Saigon Sunday brunch crawl)"
            className="w-full rounded-xl px-4 py-3 text-lg font-bold"
            style={inputStyle}
          />
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3">
            <label
              className="aspect-video md:aspect-square rounded-xl flex items-center justify-center cursor-pointer overflow-hidden"
              style={{
                background: coverUrl ? `url(${coverUrl}) center/cover` : 'rgba(255,255,255,0.04)',
                border: '1.5px dashed rgba(0,212,255,0.3)',
              }}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => uploadCover(e.target.files?.[0] ?? null)}
              />
              {!coverUrl && (
                <div className="text-center px-3">
                  {uploadingCover ? (
                    <Loader2 size={20} className="mx-auto animate-spin text-[#00d4ff]" />
                  ) : (
                    <>
                      <ImageIcon size={20} className="mx-auto text-[#00d4ff] mb-1" />
                      <div className="text-xs text-[#a3adc3]">Cover image</div>
                    </>
                  )}
                </div>
              )}
            </label>
            <div className="space-y-2">
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value.slice(0, 2000))}
                placeholder="Describe your trip — vibe, who it's for, what to watch out for. Use #hashtags freely."
                rows={4}
                className="w-full rounded-xl px-3 py-2.5 text-sm resize-none"
                style={inputStyle}
              />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={city}
                  onChange={e => setCity(e.target.value.slice(0, 100))}
                  placeholder="City (e.g. Ho Chi Minh City)"
                  className="rounded-xl px-3 py-2 text-xs"
                  style={inputStyle}
                />
                <select
                  value={visibility}
                  onChange={e => setVisibility(e.target.value as typeof visibility)}
                  className="rounded-xl px-3 py-2 text-xs cursor-pointer"
                  style={inputStyle}
                >
                  <option value="public" style={{ background: '#0a0b0f' }}>🌐 Public</option>
                  <option value="friends" style={{ background: '#0a0b0f' }}>👥 Friends</option>
                  <option value="private" style={{ background: '#0a0b0f' }}>🔒 Private</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Stops list */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#a3adc3]">
              Stops ({stops.length}/20)
            </h2>
          </div>

          {stops.map((stop, idx) => (
            <div
              key={idx}
              className="rounded-2xl p-4 space-y-2.5"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveStop(idx, -1)} disabled={idx === 0} className="text-[10px] text-[#4a5068] disabled:opacity-30 cursor-pointer hover:text-white" aria-label="Move up">▲</button>
                  <button onClick={() => moveStop(idx, 1)} disabled={idx === stops.length - 1} className="text-[10px] text-[#4a5068] disabled:opacity-30 cursor-pointer hover:text-white" aria-label="Move down">▼</button>
                </div>
                <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>
                  {idx + 1}
                </div>
                <input
                  value={stop.place_name}
                  onChange={e => setStop(idx, { place_name: e.target.value.slice(0, 200) })}
                  placeholder="Place name (e.g. The Coffee House Q1)"
                  className="flex-1 rounded-lg px-3 py-2 text-sm"
                  style={inputStyle}
                />
                <button onClick={() => removeStop(idx)} className="p-2 rounded-lg cursor-pointer hover:bg-white/5" aria-label="Remove stop">
                  <Trash2 size={14} className="text-[#f87171]" />
                </button>
              </div>

              <input
                value={stop.activity}
                onChange={e => setStop(idx, { activity: e.target.value.slice(0, 200) })}
                placeholder="Activity (e.g. brunch, read, photo)"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <FieldWrap icon={<Coins size={12} />} label="Cost">
                  <input type="number" min={0} step="0.01" value={stop.cost || ''} onChange={e => setStop(idx, { cost: Number(e.target.value) || 0 })} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
                </FieldWrap>
                <FieldWrap label="Currency">
                  <select value={stop.cost_currency} onChange={e => setStop(idx, { cost_currency: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm cursor-pointer" style={inputStyle}>
                    {CURRENCIES.map(c => <option key={c} value={c} style={{ background: '#0a0b0f' }}>{c}</option>)}
                  </select>
                </FieldWrap>
                <FieldWrap icon={<Clock size={12} />} label="Minutes">
                  <input type="number" min={0} value={stop.duration_minutes || ''} onChange={e => setStop(idx, { duration_minutes: Number(e.target.value) || 0 })} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
                </FieldWrap>
                <FieldWrap icon={<MapPin size={12} />} label="lat,lng (opt)">
                  <input
                    placeholder="10.776,106.700"
                    value={stop.place_lat != null && stop.place_lng != null ? `${stop.place_lat},${stop.place_lng}` : ''}
                    onChange={e => {
                      const parts = e.target.value.split(',').map(s => s.trim());
                      const lat = parseFloat(parts[0]);
                      const lng = parseFloat(parts[1]);
                      if (Number.isFinite(lat) && Number.isFinite(lng)) {
                        setStop(idx, { place_lat: lat, place_lng: lng });
                      } else if (!e.target.value) {
                        setStop(idx, { place_lat: null, place_lng: null });
                      }
                    }}
                    className="w-full rounded-lg px-3 py-2 text-xs font-mono"
                    style={inputStyle}
                  />
                </FieldWrap>
              </div>

              <textarea
                value={stop.notes}
                onChange={e => setStop(idx, { notes: e.target.value.slice(0, 1000) })}
                placeholder="Notes — what to order, tips, mistakes to avoid…"
                rows={2}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                style={inputStyle}
              />
            </div>
          ))}

          <button
            onClick={addStop}
            className="w-full rounded-xl py-3 text-sm font-semibold cursor-pointer flex items-center justify-center gap-1.5"
            style={{ background: 'rgba(0,212,255,0.06)', color: '#00d4ff', border: '1.5px dashed rgba(0,212,255,0.3)' }}
          >
            <Plus size={14} /> Add stop
          </button>
        </section>
      </main>
    </div>
  );
}

function FieldWrap({
  icon, label, children,
}: {
  icon?: React.ReactNode; label: string; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center gap-1 mb-1 text-[10px] uppercase tracking-wider text-[#4a5068]">
        {icon}<span>{label}</span>
      </div>
      {children}
    </label>
  );
}
