'use client';

import { useState } from 'react';
import { z } from 'zod';

const schema = z.object({
  proof_type: z.enum([
    'service_completed',
    'event_attended',
    'booking_fulfilled',
  ]),
  reference_id: z.string().min(1, 'Select a reference'),
  rating: z.number().min(1, 'Rating is required').max(5),
  review: z.string().max(200).optional(),
});

export type ProofData = z.infer<typeof schema>;

interface ProofFormProps {
  onSubmit: (data: ProofData) => Promise<void>;
  recentBookings?: { id: string; label: string }[];
  recentEvents?: { id: string; label: string }[];
}

const PROOF_TYPES = [
  {
    value: 'service_completed' as const,
    label: 'Service Completed',
    desc: 'Rate a service you received',
    icon: '✅',
  },
  {
    value: 'event_attended' as const,
    label: 'Event Attended',
    desc: 'Confirm you attended an event',
    icon: '🎉',
  },
  {
    value: 'booking_fulfilled' as const,
    label: 'Booking Fulfilled',
    desc: 'Confirm a booking was honored',
    icon: '📋',
  },
];

export default function ProofForm({
  onSubmit,
  recentBookings = [],
  recentEvents = [],
}: ProofFormProps) {
  const [proofType, setProofType] = useState<
    'service_completed' | 'event_attended' | 'booking_fulfilled' | ''
  >('');
  const [referenceId, setReferenceId] = useState('');
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const references =
    proofType === 'event_attended' ? recentEvents : recentBookings;

  const handleSubmit = async () => {
    const result = schema.safeParse({
      proof_type: proofType || undefined,
      reference_id: referenceId,
      rating,
      review: review || undefined,
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
    await onSubmit(result.data);
    setSubmitting(false);
  };

  return (
    <div className="space-y-5">
      {/* Proof type */}
      <div>
        <label className="mb-2 block text-xs font-medium text-[#4a5068]">
          What are you proving?
        </label>
        <div className="space-y-2">
          {PROOF_TYPES.map((pt) => (
            <button
              key={pt.value}
              onClick={() => {
                setProofType(pt.value);
                setReferenceId('');
              }}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                proofType === pt.value
                  ? 'border-[#00d4ff] bg-[#00d4ff]/10'
                  : 'border-[#181c24]/30 bg-[#0a0b0f]'
              }`}
            >
              <span className="text-2xl">{pt.icon}</span>
              <div>
                <p className="text-sm font-medium text-[#f0f4ff]">{pt.label}</p>
                <p className="text-[10px] text-[#4a5068]">{pt.desc}</p>
              </div>
            </button>
          ))}
        </div>
        {errors.proof_type && (
          <p className="mt-1 text-[10px] text-[#EF4444]">{errors.proof_type}</p>
        )}
      </div>

      {/* Reference */}
      {proofType && (
        <div>
          <label className="mb-1 block text-xs font-medium text-[#4a5068]">
            Linked reference
          </label>
          {references.length > 0 ? (
            <select
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              className="w-full rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 py-2.5 text-sm text-[#f0f4ff] outline-none focus:border-[#00d4ff]"
            >
              <option value="">Select…</option>
              {references.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="rounded-lg border border-[#181c24]/20 bg-[#0a0b0f] px-3 py-2.5 text-xs text-[#4a5068]">
              No recent {proofType === 'event_attended' ? 'events' : 'bookings'} found
            </p>
          )}
          {errors.reference_id && (
            <p className="mt-0.5 text-[10px] text-[#EF4444]">{errors.reference_id}</p>
          )}
        </div>
      )}

      {/* Rating */}
      <div>
        <label className="mb-2 block text-xs font-medium text-[#4a5068]">
          Rating
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className={`text-3xl transition-transform hover:scale-110 ${
                star <= rating ? 'text-[#EAB308]' : 'text-[#181c24]'
              }`}
            >
              ★
            </button>
          ))}
        </div>
        {errors.rating && (
          <p className="mt-1 text-[10px] text-[#EF4444]">{errors.rating}</p>
        )}
      </div>

      {/* Review */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#4a5068]">
          Review <span className="text-[#4a5068]">(optional)</span>
        </label>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Share your experience…"
          maxLength={200}
          rows={3}
          className="w-full resize-none rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 py-2.5 text-sm text-[#f0f4ff] placeholder-[#4a5068] outline-none focus:border-[#00d4ff]"
        />
        <p className="mt-0.5 text-right text-[10px] text-[#4a5068]">
          {review.length}/200
        </p>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded-xl bg-[#00d4ff] py-3 text-sm font-semibold text-[#0a0b0f] transition-colors hover:bg-[#00d4ff]/80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? 'Adding proof…' : 'Add Proof'}
      </button>
    </div>
  );
}
