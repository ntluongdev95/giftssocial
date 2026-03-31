'use client';

import { useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { useLocationStore } from '@/stores/locationStore';

const schema = z.object({
  note: z.string().max(140).optional(),
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
  const [note, setNote] = useState('');
  const [duration, setDuration] = useState(2);
  const [customDuration, setCustomDuration] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'circle' | 'private'>('public');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const locationReady = lat !== null && lng !== null;
  const activeDuration =
    DURATION_OPTIONS.find((d) => d.value === duration) ? duration : 0;

  const handleSubmit = async () => {
    const finalDuration =
      activeDuration > 0 ? activeDuration : Number(customDuration) || 2;

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
    await onSubmit(result.data);
    setSubmitting(false);
  };

  return (
    <div className="space-y-5">
      {/* Location */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">
          Location
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 py-2.5 text-sm text-[#f0f4ff]">
          <span>📍</span>
          {locationReady ? (
            <span>
              Your current location ({lat!.toFixed(4)}, {lng!.toFixed(4)})
            </span>
          ) : (
            <span className="text-[#4a5068]">Detecting location…</span>
          )}
        </div>
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
          maxLength={140}
          rows={3}
          className="w-full resize-none rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 py-2.5 text-sm text-[#f0f4ff] placeholder-[#4a5068] outline-none focus:border-[#00d4ff]"
        />
        <p className="mt-0.5 text-right text-[10px] text-[#4a5068]">
          {note.length}/140
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
              onClick={() => setVisibility(v)}
              className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                visibility === v
                  ? 'bg-[#00d4ff]/15 text-[#00d4ff]'
                  : 'bg-[#0a0b0f] text-[#4a5068]'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
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
