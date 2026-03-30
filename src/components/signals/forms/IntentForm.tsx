'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useLocationStore } from '@/stores/locationStore';

const schema = z.object({
  title: z.string().min(1, 'What do you need?').max(120),
  category: z.string().min(1, 'Pick a category'),
  budget: z.string().optional(),
  note: z.string().max(300).optional(),
  duration: z.number().min(1).max(24),
  visibility: z.enum(['public', 'circle', 'private']),
});

export type IntentData = z.infer<typeof schema>;

interface IntentFormProps {
  onSubmit: (data: IntentData) => Promise<void>;
}

const CATEGORIES = ['Food', 'Beauty', 'Fitness', 'Tech', 'Ride', 'Help', 'Shopping', 'Other'];
const DURATIONS = [{ label: '2h', value: 2 }, { label: '4h', value: 4 }, { label: '8h', value: 8 }];

export default function IntentForm({ onSubmit }: IntentFormProps) {
  const { lat, lng } = useLocationStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [budget, setBudget] = useState('');
  const [note, setNote] = useState('');
  const [duration, setDuration] = useState(4);
  const [visibility, setVisibility] = useState<'public' | 'circle' | 'private'>('public');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const result = schema.safeParse({ title, category, budget, note, duration, visibility });
    if (!result.success) {
      const fe: Record<string, string> = {};
      result.error.issues.forEach((i) => { fe[String(i.path[0])] = i.message; });
      setErrors(fe);
      return;
    }
    setErrors({});
    setSubmitting(true);
    await onSubmit(result.data);
    setSubmitting(false);
  };

  const inputCls = 'w-full rounded-xl px-3 py-2.5 text-sm text-[#f0f4ff] placeholder-[#2d3548] outline-none transition-all focus:ring-1 focus:ring-[#00d4ff]/30';
  const inputStyle = { background: 'rgba(10,11,15,0.7)', border: '1px solid rgba(255,255,255,0.06)' };

  return (
    <div className="space-y-5">
      {/* Location */}
      <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm" style={{ ...inputStyle }}>
        <span>📍</span>
        <span className="text-[#a3adc3]">
          {lat !== null ? `${lat.toFixed(4)}, ${lng!.toFixed(4)}` : 'Detecting…'}
        </span>
      </div>

      {/* What do you need? */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[#4a5068]">What do you need?</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder='e.g. "Looking for a nail salon nearby"'
          maxLength={120}
          className={inputCls}
          style={inputStyle}
        />
        {errors.title && <p className="mt-1 text-[10px] text-[#f87171]">{errors.title}</p>}
      </div>

      {/* Category */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[#4a5068]">Category</label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat.toLowerCase())}
              className="rounded-full px-3 py-1 text-[11px] font-medium transition-all"
              style={category === cat.toLowerCase() ? {
                background: 'rgba(255,255,255,0.9)', color: '#0a0b0f', border: '1px solid #00d4ff',
                boxShadow: '0 0 8px rgba(0,212,255,0.3)',
              } : {
                background: 'rgba(10,11,15,0.7)', color: '#4a5068', border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
        {errors.category && <p className="mt-1 text-[10px] text-[#f87171]">{errors.category}</p>}
      </div>

      {/* Budget */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[#4a5068]">Budget <span className="font-normal">(optional)</span></label>
        <input
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder='e.g. "$50" or "free"'
          className={inputCls}
          style={inputStyle}
        />
      </div>

      {/* Note */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[#4a5068]">Details</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Any extra details…"
          maxLength={300}
          rows={3}
          className={`${inputCls} resize-none`}
          style={inputStyle}
        />
        <p className="mt-0.5 text-right text-[10px] text-[#2d3548]">{note.length}/300</p>
      </div>

      {/* Duration */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[#4a5068]">Active for</label>
        <div className="flex gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d.value}
              onClick={() => setDuration(d.value)}
              className="rounded-xl px-4 py-2 text-sm font-medium transition-all"
              style={duration === d.value ? {
                background: 'rgba(255,255,255,0.9)', color: '#0a0b0f',
                boxShadow: '0 0 8px rgba(0,212,255,0.3)',
              } : {
                background: 'rgba(10,11,15,0.7)', border: '1px solid rgba(255,255,255,0.06)', color: '#4a5068',
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
        <div className="flex overflow-hidden rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          {(['public', 'circle', 'private'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVisibility(v)}
              className="flex-1 py-2 text-[11px] font-medium capitalize transition-all"
              style={visibility === v ? { background: 'rgba(0,212,255,0.12)', color: '#00d4ff' } : { background: 'rgba(10,11,15,0.5)', color: '#4a5068' }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || lat === null}
        className="btn-primary w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
      >
        {submitting ? 'Publishing…' : 'Publish Intent'}
      </button>
    </div>
  );
}
