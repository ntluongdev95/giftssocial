'use client';

import { useState } from 'react';
import { z } from 'zod';

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

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

    setErrors({});
    setSubmitting(true);
    await onSubmit(result.data);
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
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded-xl bg-[#00d4ff] py-3 text-sm font-semibold text-[#0a0b0f] transition-colors hover:bg-[#00d4ff]/80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? 'Publishing…' : 'Publish'}
      </button>
    </div>
  );
}
