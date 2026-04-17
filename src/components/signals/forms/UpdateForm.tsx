'use client';

import { useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { useLocationStore } from '@/stores/locationStore';
import { useJoinedCircles } from '@/hooks/useJoinedCircles';
import { Image, Camera } from 'lucide-react';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(120),
  note: z.string().max(500).optional(),
  duration: z.number().min(1).max(48),
  visibility: z.enum(['public', 'circle', 'private']),
});

export type UpdateData = z.infer<typeof schema>;

interface UpdateFormProps {
  onSubmit: (data: UpdateData) => Promise<void>;
}

const DURATIONS = [{ label: '6h', value: 6 }, { label: '12h', value: 12 }, { label: '24h', value: 24 }];

export default function UpdateForm({ onSubmit }: UpdateFormProps) {
  const { lat, lng, requestLocation } = useLocationStore();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [duration, setDuration] = useState(24);
  const [visibility, setVisibility] = useState<'public' | 'circle' | 'private'>('public');
  const [targetCircleId, setTargetCircleId] = useState('');
  const { myCircles } = useJoinedCircles();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (visibility === 'circle' && !targetCircleId) {
      setErrors({ circle: 'Please select a circle' });
      return;
    }
    const result = schema.safeParse({ title, note, duration, visibility });
    if (!result.success) {
      const fe: Record<string, string> = {};
      result.error.issues.forEach((i) => { fe[String(i.path[0])] = i.message; });
      setErrors(fe);
      return;
    }
    setErrors({});
    setSubmitting(true);
    await onSubmit({ ...result.data, target_circle_id: visibility === 'circle' ? targetCircleId : undefined } as UpdateData & { target_circle_id?: string });
    setSubmitting(false);
  };

  const inputCls = 'w-full rounded-xl px-3 py-2.5 text-sm text-[#f0f4ff] placeholder-[#2d3548] outline-none transition-all focus:ring-1 focus:ring-[#00d4ff]/30';
  const inputStyle = { background: 'rgba(10,11,15,0.7)', border: '1px solid rgba(255,255,255,0.06)' };

  return (
    <div className="space-y-5">
      {/* Location */}
      <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm" style={inputStyle}>
        <span>📍</span>
        <span className="text-[#a3adc3]">
          {lat !== null ? `${lat.toFixed(4)}, ${lng!.toFixed(4)}` : 'Detecting…'}
        </span>
      </div>

      {/* Title */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[#4a5068]">What&apos;s the update?</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder='e.g. "New restaurant just opened here!"'
          maxLength={120}
          className={inputCls}
          style={inputStyle}
        />
        {errors.title && <p className="mt-1 text-[10px] text-[#f87171]">{errors.title}</p>}
      </div>

      {/* Note */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[#4a5068]">Details</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Share more details…"
          maxLength={500}
          rows={4}
          className={`${inputCls} resize-none`}
          style={inputStyle}
        />
        <p className="mt-0.5 text-right text-[10px] text-[#2d3548]">{note.length}/500</p>
      </div>

      {/* Photo placeholder */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[#4a5068]">Photo <span className="font-normal">(optional)</span></label>
        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl py-8 text-xs font-medium transition-all hover:border-[#00d4ff]/30"
          style={{ ...inputStyle, borderStyle: 'dashed', color: '#4a5068' }}
        >
          <Camera size={16} />
          Tap to add photo
        </button>
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
              onClick={() => { setVisibility(v); if (v !== 'circle') setTargetCircleId(''); }}
              className="flex-1 py-2 text-[11px] font-medium capitalize transition-all cursor-pointer"
              style={visibility === v ? { background: 'rgba(0,212,255,0.12)', color: '#00d4ff' } : { background: 'rgba(10,11,15,0.5)', color: '#4a5068' }}
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
                className="w-full rounded-xl px-3 py-2.5 text-sm text-[#f0f4ff] outline-none focus:ring-1 focus:ring-[#00d4ff]/30 cursor-pointer"
                style={{ background: 'rgba(10,11,15,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}
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
          if (lat === null) { toast.info('Please allow location access'); requestLocation(); return; }
          handleSubmit();
        }}
        disabled={submitting}
        className="w-full rounded-xl py-3 text-sm font-bold cursor-pointer disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg, #00d4ff, #22C55E)', color: '#0a0b0f', boxShadow: '0 4px 20px rgba(0,212,255,0.3)' }}
      >
        {submitting ? 'Publishing…' : 'Share Update'}
      </button>
    </div>
  );
}
