'use client';

import { useCallback, useRef, useState } from 'react';
import { z } from 'zod';
import { useJoinedCircles } from '@/hooks/useJoinedCircles';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(120),
  category: z.string().min(1, 'Pick a category'),
  description: z.string().max(300).optional(),
  discount: z.string().min(1, 'Discount or price is required'),
  expires_at: z.string().min(1, 'Expiry is required'),
  visibility: z.enum(['public', 'circle']),
});

export type OfferData = z.infer<typeof schema>;

interface OfferFormProps {
  onSubmit: (data: OfferData) => Promise<void>;
}

const CATEGORIES = [
  'Beauty',
  'Food',
  'Fitness',
  'Dental',
  'Health',
  'Retail',
  'Services',
  'Tech',
  'Other',
];

export default function OfferForm({ onSubmit }: OfferFormProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [discount, setDiscount] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'circle'>('public');
  const [targetCircleId, setTargetCircleId] = useState('');
  const { myCircles } = useJoinedCircles();
  const [shopName, setShopName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationCoords, setLocationCoords] = useState<[number, number] | null>(null);
  const [locationCity, setLocationCity] = useState('');
  const [locationResults, setLocationResults] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const searchLocation = useCallback((q: string) => {
    setLocationName(q);
    setLocationCoords(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 3) { setLocationResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setLocationSearching(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`, { headers: { 'User-Agent': 'GaoSocial/1.0' } });
        const data = await res.json();
        setLocationResults(data.map((r: Record<string, unknown>) => ({
          name: r.display_name as string,
          lat: parseFloat(r.lat as string),
          lng: parseFloat(r.lon as string),
        })));
      } catch { setLocationResults([]); }
      finally { setLocationSearching(false); }
    }, 400);
  }, []);

  const selectLocation = (r: { name: string; lat: number; lng: number }) => {
    setLocationName(r.name.split(',')[0].trim());
    setLocationCity(r.name.split(',').slice(1, 3).join(',').trim());
    setLocationCoords([r.lng, r.lat]);
    setLocationResults([]);
  };

  const handleSubmit = async () => {
    const result = schema.safeParse({
      title,
      category,
      description,
      discount,
      expires_at: expiresAt,
      visibility,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((i) => {
        fieldErrors[String(i.path[0])] = i.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (visibility === 'circle' && !targetCircleId) {
      setErrors({ circle: 'Please select a circle' });
      return;
    }

    setErrors({});
    setSubmitting(true);
    await onSubmit({ ...result.data, target_circle_id: visibility === 'circle' ? targetCircleId : undefined, shop_name: shopName, location_name: locationName, location_coords: locationCoords, city: locationCity } as OfferData & { target_circle_id?: string; shop_name?: string; location_name?: string; location_coords?: [number, number] | null; city?: string });
    setSubmitting(false);
  };

  return (
    <div className="space-y-5">
      {/* Title */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">
          Title
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="20% off nail service today"
          maxLength={120}
          className="w-full rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 py-2.5 text-sm text-[#f0f4ff] placeholder-[#4a5068] outline-none focus:border-[#00d4ff]"
        />
        <div className="mt-0.5 flex justify-between">
          {errors.title && (
            <p className="text-[10px] text-[#EF4444]">{errors.title}</p>
          )}
          <p className="ml-auto text-[10px] text-[#4a5068]">{title.length}/120</p>
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">
          Category
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat.toLowerCase())}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                category === cat.toLowerCase()
                  ? 'border border-[#00d4ff] bg-[#00d4ff]/10 text-[#00d4ff]'
                  : 'border border-[#181c24]/30 bg-[#0a0b0f] text-[#4a5068]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        {errors.category && (
          <p className="mt-1 text-[10px] text-[#EF4444]">{errors.category}</p>
        )}
      </div>

      {/* Shop Name */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">Shop / Business Name</label>
        <input
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          placeholder="e.g. Glow Nail Studio"
          className="w-full rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 py-2.5 text-sm text-[#f0f4ff] placeholder-[#4a5068] outline-none focus:border-[#00d4ff]"
        />
      </div>

      {/* Location */}
      <div className="relative">
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">Address</label>
        <div className="flex gap-2">
          <input
            value={locationName}
            onChange={(e) => searchLocation(e.target.value)}
            onBlur={() => { setTimeout(() => { if (!locationCoords && locationResults.length > 0) selectLocation(locationResults[0]); setLocationResults([]); }, 200); }}
            placeholder="Search address..."
            className="w-full rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 py-2.5 text-sm text-[#f0f4ff] placeholder-[#4a5068] outline-none focus:border-[#00d4ff] flex-1"
          />
          {locationCoords && <span className="shrink-0 flex items-center px-2 text-[10px] text-[#34d399]">✓</span>}
          {locationSearching && <span className="shrink-0 flex items-center px-2 text-[10px] text-[#4a5068]">...</span>}
        </div>
        {locationResults.length > 0 && !locationCoords && (
          <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl overflow-hidden" style={{ background: 'rgba(10,11,15,0.97)', border: '1px solid rgba(0,212,255,0.12)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
            <p className="px-3 py-1.5 text-[10px] text-[#4a5068]">Select a location:</p>
            {locationResults.map((r, i) => (
              <button key={i} onMouseDown={() => selectLocation(r)} className="w-full text-left px-3 py-2.5 text-xs text-[#a3adc3] hover:bg-[rgba(0,212,255,0.06)] cursor-pointer truncate" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                📍 {r.name}
              </button>
            ))}
          </div>
        )}
        {locationCoords && (
          <p className="mt-1 text-[10px] text-[#4a5068]">{locationCity} · {locationCoords[1].toFixed(4)}, {locationCoords[0].toFixed(4)}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Details about your offer…"
          maxLength={300}
          rows={3}
          className="w-full resize-none rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 py-2.5 text-sm text-[#f0f4ff] placeholder-[#4a5068] outline-none focus:border-[#00d4ff]"
        />
        <p className="mt-0.5 text-right text-[10px] text-[#4a5068]">
          {description.length}/300
        </p>
      </div>

      {/* Discount */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">
          Price / Discount
        </label>
        <input
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          placeholder="e.g. 20% off, $45 flat"
          className="w-full rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 py-2.5 text-sm text-[#f0f4ff] placeholder-[#4a5068] outline-none focus:border-[#00d4ff]"
        />
        {errors.discount && (
          <p className="mt-0.5 text-[10px] text-[#EF4444]">{errors.discount}</p>
        )}
      </div>

      {/* Expires */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">
          Expires at
        </label>
        <input
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="w-full rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 py-2.5 text-sm text-[#f0f4ff] outline-none focus:border-[#00d4ff] [color-scheme:dark]"
        />
        {errors.expires_at && (
          <p className="mt-0.5 text-[10px] text-[#EF4444]">{errors.expires_at}</p>
        )}
      </div>

      {/* Visibility */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">
          Visibility
        </label>
        <div className="flex overflow-hidden rounded-lg border border-[#181c24]/30">
          {(['public', 'circle'] as const).map((v) => (
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
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded-xl bg-[#00d4ff] py-3 text-sm font-semibold text-[#0a0b0f] transition-colors hover:bg-[#00d4ff]/80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? 'Publishing…' : 'Publish'}
      </button>
    </div>
  );
}
