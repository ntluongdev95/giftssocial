'use client';

import { useCallback, useRef, useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { MapPin, Navigation, Search, X, Loader2 } from 'lucide-react';
import { useLocationStore } from '@/stores/locationStore';
import { useJoinedCircles } from '@/hooks/useJoinedCircles';

const schema = z.object({
  note: z.string().max(500).optional(),
  duration: z.number().min(1).max(24),
  visibility: z.enum(['public', 'circle', 'private']),
});

export type PresenceData = z.infer<typeof schema>;

interface PresenceFormProps {
  onSubmit: (data: PresenceData) => Promise<void>;
}

const DURATION_OPTIONS = [
  { label: '1h', value: 1 },
  { label: '2h', value: 2 },
  { label: '4h', value: 4 },
];

const VISIBILITY_OPTIONS = ['public', 'circle', 'private'] as const;

export default function PresenceForm({ onSubmit }: PresenceFormProps) {
  const { lat, lng, requestLocation } = useLocationStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [duration, setDuration] = useState(2);
  const [customDuration, setCustomDuration] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'circle' | 'private'>('public');
  const [targetCircleId, setTargetCircleId] = useState<string>('');
  const { myCircles } = useJoinedCircles();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Location: GPS or custom
  const [locationMode, setLocationMode] = useState<'gps' | 'custom'>('gps');
  const [customLat, setCustomLat] = useState<number | null>(null);
  const [customLng, setCustomLng] = useState<number | null>(null);
  const [customAddress, setCustomAddress] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<Array<{ id: string; display_name: string; lat: number; lng: number }>>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveLat = locationMode === 'custom' && customLat !== null ? customLat : lat;
  const effectiveLng = locationMode === 'custom' && customLng !== null ? customLng : lng;
  const locationReady = effectiveLat !== null && effectiveLng !== null;

  const searchAddress = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setAddressResults([]); return; }
    setAddressLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`, { headers: { 'User-Agent': 'GaoSocial/1.0' } });
      const data = await res.json();
      setAddressResults(data.map((r: Record<string, string>) => ({ id: r.place_id, display_name: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) })));
    } catch { setAddressResults([]); }
    finally { setAddressLoading(false); }
  }, []);

  const handleAddressInput = useCallback((val: string) => {
    setAddressQuery(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchAddress(val), 300);
  }, [searchAddress]);

  const handleSelectAddress = useCallback((r: typeof addressResults[0]) => {
    setCustomLat(r.lat);
    setCustomLng(r.lng);
    setCustomAddress(r.display_name);
    setAddressQuery('');
    setAddressResults([]);
    setLocationMode('custom');
  }, []);
  const activeDuration =
    DURATION_OPTIONS.find((d) => d.value === duration) ? duration : 0;

  const handleSubmit = async () => {
    const finalDuration =
      activeDuration > 0 ? activeDuration : Number(customDuration) || 2;

    if (visibility === 'circle' && !targetCircleId) {
      setErrors({ circle: 'Please select a circle' });
      return;
    }

    const result = schema.safeParse({ note, duration: finalDuration, visibility });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((i) => {
        fieldErrors[String(i.path[0])] = i.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    await onSubmit({ ...result.data, title: title || undefined, description: description || undefined, target_circle_id: visibility === 'circle' ? targetCircleId : undefined, location_coords: effectiveLat !== null && effectiveLng !== null ? [effectiveLng, effectiveLat] : undefined } as PresenceData & { title?: string; description?: string; target_circle_id?: string; location_coords?: [number, number] });
    setSubmitting(false);
  };

  return (
    <div className="space-y-5">
      {/* Location */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[#4a5068]">Location</label>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => { setLocationMode('gps'); setCustomLat(null); setCustomLng(null); setCustomAddress(''); }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium cursor-pointer transition-colors"
            style={locationMode === 'gps' ? { background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' } : { background: 'rgba(10,11,15,0.8)', border: '1px solid rgba(255,255,255,0.06)', color: '#4a5068' }}
          >
            <Navigation size={12} /> Current Location
          </button>
          <button
            onClick={() => setLocationMode('custom')}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium cursor-pointer transition-colors"
            style={locationMode === 'custom' ? { background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' } : { background: 'rgba(10,11,15,0.8)', border: '1px solid rgba(255,255,255,0.06)', color: '#4a5068' }}
          >
            <Search size={12} /> Choose Location
          </button>
        </div>

        {/* GPS display */}
        {locationMode === 'gps' && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm" style={{ background: 'rgba(10,11,15,0.8)', border: '1px solid rgba(0,212,255,0.15)' }}>
            <MapPin size={14} className="text-[#00d4ff] shrink-0" />
            {lat !== null && lng !== null ? (
              <span className="text-[#f0f4ff]">Your location ({lat.toFixed(4)}, {lng.toFixed(4)})</span>
            ) : (
              <span className="text-[#4a5068]">Detecting location…</span>
            )}
          </div>
        )}

        {/* Custom search */}
        {locationMode === 'custom' && (
          <div className="relative">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(10,11,15,0.8)', border: customAddress ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
              {addressLoading ? <Loader2 size={14} className="shrink-0 animate-spin text-[#00d4ff]" /> : <Search size={14} className="shrink-0 text-[#4a5068]" />}
              <input
                value={addressQuery || customAddress}
                onChange={(e) => { handleAddressInput(e.target.value); if (customAddress) setCustomAddress(''); }}
                placeholder="Search address, city, place…"
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#2d3548]"
              />
              {(addressQuery || customAddress) && (
                <button onClick={() => { setAddressQuery(''); setCustomAddress(''); setCustomLat(null); setCustomLng(null); setAddressResults([]); }} className="shrink-0 cursor-pointer text-[#4a5068]"><X size={14} /></button>
              )}
            </div>

            {/* Selected address */}
            {customAddress && customLat !== null && (
              <div className="flex items-center gap-2 mt-1.5 px-3 py-2 rounded-lg" style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)' }}>
                <MapPin size={11} className="shrink-0 text-[#00d4ff]" />
                <span className="text-[10px] text-[#a3adc3] truncate flex-1">{customAddress}</span>
                <span className="text-[9px] text-[#4a5068] shrink-0">{customLat.toFixed(4)}, {customLng!.toFixed(4)}</span>
              </div>
            )}

            {/* Results dropdown */}
            {addressResults.length > 0 && !customAddress && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl overflow-hidden" style={{ background: 'rgba(10,11,15,0.98)', border: '1px solid rgba(0,212,255,0.12)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
                {addressResults.map((r) => (
                  <button key={r.id} onClick={() => handleSelectAddress(r)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[rgba(0,212,255,0.06)] cursor-pointer" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <MapPin size={12} className="shrink-0 text-[#00d4ff]" />
                    <span className="text-xs text-[#a3adc3] truncate">{r.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Title */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Coffee meetup at Starbucks"
          maxLength={200}
          className="w-full rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 py-2.5 text-sm text-[#f0f4ff] placeholder-[#4a5068] outline-none focus:border-[#00d4ff]"
        />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tell people more about what's happening…"
          maxLength={2000}
          rows={3}
          className="w-full resize-none rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 py-2.5 text-sm text-[#f0f4ff] placeholder-[#4a5068] outline-none focus:border-[#00d4ff]"
        />
      </div>

      {/* Note */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">
          Note
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What's happening here?"
          maxLength={500}
          rows={3}
          className="w-full resize-none rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 py-2.5 text-sm text-[#f0f4ff] placeholder-[#4a5068] outline-none focus:border-[#00d4ff]"
        />
        <p className="mt-0.5 text-right text-[10px] text-[#4a5068]">
          {note.length}/500
        </p>
        {errors.note && (
          <p className="text-[10px] text-[#EF4444]">{errors.note}</p>
        )}
      </div>

      {/* Duration */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">
          Duration
        </label>
        <div className="flex gap-2">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setDuration(opt.value);
                setCustomDuration('');
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeDuration === opt.value
                  ? 'border border-[#00d4ff] bg-[#00d4ff]/10 text-[#00d4ff]'
                  : 'border border-[#181c24]/30 bg-[#0a0b0f] text-[#4a5068]'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <input
            type="number"
            placeholder="Custom"
            value={customDuration}
            onChange={(e) => {
              setCustomDuration(e.target.value);
              setDuration(0);
            }}
            className="w-20 rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 py-2 text-sm text-[#f0f4ff] placeholder-[#4a5068] outline-none focus:border-[#00d4ff]"
          />
        </div>
      </div>

      {/* Visibility */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">
          Visibility
        </label>
        <div className="flex overflow-hidden rounded-lg border border-[#181c24]/30">
          {VISIBILITY_OPTIONS.map((v) => (
            <button
              key={v}
              onClick={() => { setVisibility(v); if (v !== 'circle') setTargetCircleId(''); }}
              className={`flex-1 py-2 text-xs font-medium capitalize transition-colors cursor-pointer ${
                visibility === v
                  ? 'bg-[#00d4ff]/15 text-[#00d4ff]'
                  : 'bg-[#0a0b0f] text-[#4a5068]'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Circle picker */}
        {visibility === 'circle' && (
          <div className="mt-2">
            {myCircles.length === 0 ? (
              <p className="text-xs text-[#4a5068]">You haven&apos;t joined any circles yet.</p>
            ) : (
              <select
                value={targetCircleId}
                onChange={(e) => { setTargetCircleId(e.target.value); setErrors({}); }}
                className="w-full rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 py-2.5 text-sm text-[#f0f4ff] outline-none focus:border-[#00d4ff] cursor-pointer"
              >
                <option value="">Select a circle…</option>
                {myCircles.map((c) => (
                  <option key={c.id as string} value={c.id as string}>{c.name as string}</option>
                ))}
              </select>
            )}
            {errors.circle && <p className="mt-1 text-[10px] text-[#EF4444]">{errors.circle}</p>}
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={() => {
          if (!locationReady) {
            toast.info('Please allow location access');
            requestLocation();
            return;
          }
          handleSubmit();
        }}
        disabled={submitting}
        className="w-full rounded-xl py-3 text-sm font-bold cursor-pointer disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg, #00d4ff, #22C55E)', color: '#0a0b0f', boxShadow: '0 4px 20px rgba(0,212,255,0.3)' }}
      >
        {submitting ? 'Publishing…' : 'Publish'}
      </button>
    </div>
  );
}
