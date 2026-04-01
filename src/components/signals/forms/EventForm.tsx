'use client';

import { useState } from 'react';
import { z } from 'zod';
import { useJoinedCircles } from '@/hooks/useJoinedCircles';

const schema = z
  .object({
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().max(1000).optional(),
    location_name: z.string().min(1, 'Location is required'),
    start_time: z.string().min(1, 'Start time is required'),
    end_time: z.string().min(1, 'End time is required'),
    host_type: z.enum(['user', 'circle']),
    capacity: z.number().min(1).optional(),
    visibility: z.enum(['public', 'circle', 'private']),
  })
  .refine(
    (d) => !d.end_time || !d.start_time || new Date(d.end_time) > new Date(d.start_time),
    { message: 'End must be after start', path: ['end_time'] }
  );

export type EventData = z.infer<typeof schema>;

interface EventFormProps {
  onSubmit: (data: EventData) => Promise<void>;
}

export default function EventForm({ onSubmit }: EventFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [hostType, setHostType] = useState<'user' | 'circle'>('user');
  const [capacity, setCapacity] = useState('');
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

    const result = schema.safeParse({
      title,
      description,
      location_name: locationName,
      start_time: startTime,
      end_time: endTime,
      host_type: hostType,
      capacity: capacity ? Number(capacity) : undefined,
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

    setErrors({});
    setSubmitting(true);
    await onSubmit({ ...result.data, target_circle_id: visibility === 'circle' ? targetCircleId : undefined } as EventData & { target_circle_id?: string });
    setSubmitting(false);
  };

  const inputCls =
    'w-full rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 py-2.5 text-sm text-[#f0f4ff] placeholder-[#4a5068] outline-none focus:border-[#00d4ff]';

  return (
    <div className="space-y-5">
      {/* Title */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          maxLength={200}
          className={inputCls}
        />
        {errors.title && <p className="mt-0.5 text-[10px] text-[#EF4444]">{errors.title}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this event about?"
          rows={3}
          maxLength={1000}
          className={`${inputCls} resize-none`}
        />
      </div>

      {/* Location */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">Location</label>
        <div className="flex gap-2">
          <input
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="Venue name or address"
            className={`${inputCls} flex-1`}
          />
          <button className="shrink-0 rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 text-sm text-[#00d4ff]">
            📍
          </button>
        </div>
        {errors.location_name && (
          <p className="mt-0.5 text-[10px] text-[#EF4444]">{errors.location_name}</p>
        )}
      </div>

      {/* Start / End */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#4a5068]">Start</label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={`${inputCls} [color-scheme:dark]`}
          />
          {errors.start_time && (
            <p className="mt-0.5 text-[10px] text-[#EF4444]">{errors.start_time}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#4a5068]">End</label>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={`${inputCls} [color-scheme:dark]`}
          />
          {errors.end_time && (
            <p className="mt-0.5 text-[10px] text-[#EF4444]">{errors.end_time}</p>
          )}
        </div>
      </div>

      {/* Host */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">Host as</label>
        <div className="flex overflow-hidden rounded-lg border border-[#181c24]/30">
          {(['user', 'circle'] as const).map((h) => (
            <button
              key={h}
              onClick={() => setHostType(h)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                hostType === h
                  ? 'bg-[#00d4ff]/15 text-[#00d4ff]'
                  : 'bg-[#0a0b0f] text-[#4a5068]'
              }`}
            >
              {h === 'user' ? 'Me' : 'My Circle'}
            </button>
          ))}
        </div>
      </div>

      {/* Capacity */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">
          Capacity <span className="text-[#4a5068]">(optional)</span>
        </label>
        <input
          type="number"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="Unlimited"
          min={1}
          className={inputCls}
        />
      </div>

      {/* Visibility */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">Visibility</label>
        <div className="flex overflow-hidden rounded-lg border border-[#181c24]/30">
          {(['public', 'circle', 'private'] as const).map((v) => (
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
              <p className="text-xs text-[#4a5068]">You haven't joined any circles yet.</p>
            ) : (
              <select
                value={targetCircleId}
                onChange={(e) => { setTargetCircleId(e.target.value); setErrors({}); }}
                className={`${inputCls} cursor-pointer`}
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
        {submitting ? 'Publishing…' : 'Publish Event'}
      </button>
    </div>
  );
}
