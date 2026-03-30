'use client';

import type { Business } from '@/types';
import TrustLevelPill from '@/components/trust/TrustLevelPill';
import TrustBadgeRow from '@/components/trust/TrustBadgeRow';

interface BusinessCardProps {
  business: Business;
  distance?: number;
}

function formatDistance(meters?: number): string {
  if (!meters) return '';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

export default function BusinessCard({ business, distance }: BusinessCardProps) {
  return (
    <div className="rounded-xl border border-[#181c24]/30 bg-[#111318]/60 p-4">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#22C55E]/20 text-lg text-[#22C55E]">
          ■
        </span>

        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <h3 className="truncate text-sm font-semibold text-[#f0f4ff]">
              {business.name}
            </h3>
            <span
              className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                business.open_now
                  ? 'bg-[#22C55E]/15 text-[#22C55E]'
                  : 'bg-[#4a5068]/15 text-[#4a5068]'
              }`}
            >
              {business.open_now ? '🟢 Open' : 'Closed'}
            </span>
          </div>

          {/* Subtitle */}
          <p className="mt-0.5 text-xs text-[#4a5068]">
            {business.category}
            {distance ? ` · ${formatDistance(distance)}` : ''}
          </p>

          {/* Trust row */}
          <div className="mt-2 flex items-center gap-2">
            <TrustLevelPill level={business.trust_level} score={business.trust_score} size="sm" />
            <TrustBadgeRow badges={business.badges} maxVisible={2} />
            <span className="ml-auto text-[10px] text-[#4a5068]">
              {business.proof_count} proofs
              {business.rating_avg ? ` · ★ ${business.rating_avg}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <button className="flex-1 rounded-lg border border-[#00d4ff]/40 py-1.5 text-xs font-medium text-[#00d4ff] transition-colors hover:bg-[#00d4ff]/10">
          View
        </button>
        {business.booking_enabled && (
          <button className="flex-1 rounded-lg bg-[#00d4ff] py-1.5 text-xs font-medium text-[#0a0b0f] transition-colors hover:bg-[#00d4ff]/80">
            Book
          </button>
        )}
      </div>
    </div>
  );
}
