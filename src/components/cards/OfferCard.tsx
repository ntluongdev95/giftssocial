'use client';

import { formatDistanceToNow } from 'date-fns';
import type { Signal } from '@/types';
import SignalConfidenceTag from '@/components/trust/SignalConfidenceTag';

interface OfferCardProps {
  signal: Signal;
  distance?: number;
  businessName?: string;
}

function formatDist(meters?: number): string {
  if (!meters) return '';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

export default function OfferCard({
  signal,
  distance,
  businessName,
}: OfferCardProps) {
  const discount = signal.metadata?.discount_percent
    ? `${signal.metadata.discount_percent}% off`
    : (signal.metadata?.discount as string) || '';

  const expiresLabel = signal.expires_at
    ? `Expires ${formatDistanceToNow(new Date(signal.expires_at), { addSuffix: true })}`
    : '';

  return (
    <div className="rounded-xl border border-[#181c24]/30 bg-[#111318]/60 p-4">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EAB308]/20 text-lg text-[#EAB308]">
          ◆
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-[#f0f4ff]">
            {signal.title}
          </h3>

          <p className="mt-0.5 text-xs text-[#4a5068]">
            {businessName || signal.owner_id}
            {distance ? ` · ${formatDist(distance)}` : ''}
          </p>

          {discount && (
            <p className="mt-1.5 text-sm font-semibold text-[#EAB308]">
              {discount}
            </p>
          )}

          {expiresLabel && (
            <p className="mt-0.5 text-[10px] text-[#4a5068]">{expiresLabel}</p>
          )}

          <div className="mt-2">
            <SignalConfidenceTag signal={signal} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <button className="flex-1 rounded-lg bg-[#00d4ff] py-1.5 text-xs font-medium text-[#0a0b0f] transition-colors hover:bg-[#00d4ff]/80">
          Claim
        </button>
        <button className="flex-1 rounded-lg border border-[#181c24] py-1.5 text-xs font-medium text-[#f0f4ff] transition-colors hover:bg-[#111318]">
          Book
        </button>
      </div>
    </div>
  );
}
