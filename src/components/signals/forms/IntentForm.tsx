'use client';

import { useState, useRef } from 'react';
import { z } from 'zod';
import { MapPin, Clock, DollarSign, Search, X } from 'lucide-react';
import { useLocationStore } from '@/stores/locationStore';
import { toast } from 'sonner';

const schema = z.object({
  title: z.string().min(1, 'What do you need?').max(120),
  category: z.string().min(1, 'Pick a category'),
  budget: z.string().optional(),
  note: z.string().max(500).optional(),
  duration: z.number().min(1).max(48),
  visibility: z.enum(['public', 'circle', 'private', 'trusted_only']),
  urgency: z.enum(['now', 'today', 'this_week']),
  radius: z.number().min(500).max(50000),
});

export type IntentData = z.infer<typeof schema>;

interface IntentFormProps {
  onSubmit: (data: IntentData) => Promise<void>;
}

const CATEGORIES = [
  { emoji: '💅', label: 'Beauty' },
  { emoji: '🍜', label: 'Food' },
  { emoji: '💪', label: 'Fitness' },
  { emoji: '💻', label: 'Tech' },
  { emoji: '🚗', label: 'Ride' },
  { emoji: '🏥', label: 'Health' },
  { emoji: '🛒', label: 'Shopping' },
  { emoji: '🔧', label: 'Repair' },
  { emoji: '📦', label: 'Other' },
];

const URGENCY = [
  { value: 'now', label: 'Right now', color: '#f87171' },
  { value: 'today', label: 'Today', color: '#fbbf24' },
  { value: 'this_week', label: 'This week', color: '#34d399' },
];

const RADIUS = [
  { value: 1000, label: '1 km' },
  { value: 3000, label: '3 km' },
  { value: 5000, label: '5 km' },
  { value: 10000, label: '10 km' },
  { value: 25000, label: '25 km' },
];

const DURATIONS = [
  { label: '2h', value: 2 },
  { label: '4h', value: 4 },
  { label: '8h', value: 8 },
  { label: '24h', value: 24 },
];

export default function IntentForm({ onSubmit }: IntentFormProps) {
  const { lat, lng, city } = useLocationStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [budget, setBudget] = useState('');
  const [note, setNote] = useState('');
  const [duration, setDuration] = useState(4);
  const [visibility, setVisibility] = useState<'public' | 'circle' | 'private' | 'trusted_only'>('public');
  const [urgency, setUrgency] = useState<'now' | 'today' | 'this_week'>('today');
  const [radius, setRadius] = useState(5000);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Location search
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [customLocation, setCustomLocation] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchLocation = (q: string) => {
    setLocationSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 2) { setLocationResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`, { headers: { 'User-Agent': 'GaoSocial/1.0' } });
        const data = await res.json();
        setLocationResults(data.map((r: Record<string, unknown>) => ({ name: r.display_name as string, lat: parseFloat(r.lat as string), lng: parseFloat(r.lon as string) })));
      } catch { setLocationResults([]); }
    }, 300);
  };

  const selectLocation = (loc: { name: string; lat: number; lng: number }) => {
    setCustomLocation(loc);
    setShowLocationSearch(false);
    setLocationSearch('');
    setLocationResults([]);
  };

  const clearCustomLocation = () => { setCustomLocation(null); };

  const activeLat = customLocation?.lat ?? lat;
  const activeLng = customLocation?.lng ?? lng;
  const activeLocationName = customLocation?.name || city || 'Your Location';

  const handleSubmit = async () => {
    const result = schema.safeParse({ title, category, budget, note, duration, visibility, urgency, radius });
    if (!result.success) {
      const fe: Record<string, string> = {};
      result.error.issues.forEach((i) => { fe[String(i.path[0])] = i.message; });
      setErrors(fe);
      toast.error(result.error.issues[0].message);
      return;
    }
    setErrors({});
    setSubmitting(true);
    await onSubmit(result.data);
    setSubmitting(false);
  };

  return (
    <div className="space-y-5">
      {/* Location — default user location, searchable */}
      <div>
        {!showLocationSearch ? (
          <div
            onClick={() => setShowLocationSearch(true)}
            className="rounded-xl px-4 py-3 cursor-pointer"
            style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(0,212,255,0.1)' }}
          >
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-[#00d4ff]" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{activeLocationName}</p>
                {activeLat !== null && <p className="text-[10px] text-[#4a5068]">{activeLat.toFixed(4)}, {activeLng!.toFixed(4)}</p>}
              </div>
              {customLocation ? (
                <button onClick={(e) => { e.stopPropagation(); clearCustomLocation(); }} className="cursor-pointer"><X size={14} className="text-[#4a5068]" /></button>
              ) : (
                <Search size={14} className="text-[#4a5068]" />
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5068]" />
                <input
                  value={locationSearch}
                  onChange={(e) => searchLocation(e.target.value)}
                  placeholder="Search location..."
                  autoFocus
                  className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm text-white outline-none placeholder:text-[#2d3548]"
                  style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(0,212,255,0.2)' }}
                />
              </div>
              <button onClick={() => { setShowLocationSearch(false); setLocationResults([]); }} className="text-xs text-[#4a5068] cursor-pointer px-2">Cancel</button>
            </div>
            {locationResults.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(17,19,24,0.9)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {locationResults.map((r, i) => (
                  <button key={i} onClick={() => selectLocation(r)} className="flex items-center gap-2 w-full px-3 py-2.5 text-left cursor-pointer hover:bg-white/[0.02]" style={{ borderBottom: i < locationResults.length - 1 ? '1px solid rgba(255,255,255,0.03)' : undefined }}>
                    <MapPin size={12} className="text-[#00d4ff] shrink-0" />
                    <span className="text-xs text-[#a3adc3] truncate">{r.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* What do you need? */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[#4a5068]">What do you need? *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder='e.g. "Need a good nail salon nearby"'
          maxLength={120}
          className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#2d3548]"
          style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
        />
        {errors.title && <p className="mt-1 text-[10px] text-[#f87171]">{errors.title}</p>}
      </div>

      {/* Category */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[#4a5068]">Category *</label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(({ emoji, label }) => (
            <button
              key={label}
              onClick={() => setCategory(label.toLowerCase())}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all cursor-pointer"
              style={category === label.toLowerCase() ? {
                background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)',
              } : {
                background: 'rgba(17,19,24,0.8)', color: '#4a5068', border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {emoji} {label}
            </button>
          ))}
        </div>
        {errors.category && <p className="mt-1 text-[10px] text-[#f87171]">{errors.category}</p>}
      </div>

      {/* Urgency */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[#4a5068]">When do you need it?</label>
        <div className="flex gap-2">
          {URGENCY.map(({ value, label, color }) => (
            <button
              key={value}
              onClick={() => setUrgency(value as typeof urgency)}
              className="flex-1 rounded-xl py-2.5 text-[11px] font-semibold transition-all cursor-pointer"
              style={urgency === value ? {
                background: `${color}15`, color, border: `1px solid ${color}40`,
              } : {
                background: 'rgba(17,19,24,0.8)', color: '#4a5068', border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Search radius */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[#4a5068]">Search radius</label>
        <div className="flex gap-1.5 overflow-x-auto">
          {RADIUS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setRadius(value)}
              className="shrink-0 rounded-xl px-3 py-2 text-[11px] font-medium transition-all cursor-pointer"
              style={radius === value ? {
                background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)',
              } : {
                background: 'rgba(17,19,24,0.8)', color: '#4a5068', border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Budget */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[#4a5068]">Budget <span className="font-normal text-[#2d3548]">(optional)</span></label>
        <div className="relative">
          <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5068]" />
          <input
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder='e.g. "50" or "flexible"'
            className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm text-white outline-none placeholder:text-[#2d3548]"
            style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
          />
        </div>
      </div>

      {/* Details */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[#4a5068]">More details</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Describe what you're looking for..."
          maxLength={500}
          rows={3}
          className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none resize-none placeholder:text-[#2d3548]"
          style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
        />
        <p className="mt-0.5 text-right text-[10px] text-[#2d3548]">{note.length}/500</p>
      </div>

      {/* Active for */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[#4a5068]">Active for</label>
        <div className="flex gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d.value}
              onClick={() => setDuration(d.value)}
              className="flex-1 rounded-xl py-2.5 text-xs font-medium transition-all cursor-pointer"
              style={duration === d.value ? {
                background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)',
              } : {
                background: 'rgba(17,19,24,0.8)', color: '#4a5068', border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Visibility */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[#4a5068]">Who can see</label>
        <div className="flex gap-1.5">
          {(['public', 'circle', 'trusted_only'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVisibility(v)}
              className="flex-1 rounded-xl py-2.5 text-[11px] font-medium capitalize transition-all cursor-pointer"
              style={visibility === v ? {
                background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)',
              } : {
                background: 'rgba(17,19,24,0.8)', color: '#4a5068', border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {v.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || activeLat === null}
        className="w-full rounded-xl py-3.5 text-sm font-bold cursor-pointer disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg, #00d4ff, #22C55E)', color: '#0a0b0f', boxShadow: '0 4px 20px rgba(0,212,255,0.3)' }}
      >
        {submitting ? 'Next…' : 'Preview & Publish'}
      </button>
    </div>
  );
}
