'use client';

import { format } from 'date-fns';
import type { Event, TrustLevel } from '@/types';
import TrustLevelPill from '@/components/trust/TrustLevelPill';

interface EventCardProps {
  event: Event;
  distance?: number;
  hostName?: string;
  hostTrustLevel?: TrustLevel;
  hostTrustScore?: number;
}

function formatDistance(meters?: number): string {
  if (!meters) return '';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

export default function EventCard({
  event,
  distance,
  hostName,
  hostTrustLevel,
  hostTrustScore,
}: EventCardProps) {
  const spotsLeft = event.capacity ? event.capacity - event.joined_count : null;
  const capacityPct = event.capacity
    ? Math.min((event.joined_count / event.capacity) * 100, 100)
    : 0;

  return (
    <div className="rounded-xl border border-[#181c24]/30 bg-[#111318]/60 p-4">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EF4444]/20 text-lg text-[#EF4444]">
          ▲
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-[#f0f4ff]">
            {event.title}
          </h3>

          {/* Host */}
          {hostName && (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-xs text-[#4a5068]">Host: {hostName}</span>
              {hostTrustLevel && (
                <TrustLevelPill
                  level={hostTrustLevel}
                  score={hostTrustScore}
                  size="sm"
                />
              )}
            </div>
          )}

          {/* Date / time / distance */}
          <p className="mt-1 text-xs text-[#4a5068]">
            {format(new Date(event.start_time), 'MMM d · h:mm a')}
            {distance ? ` · ${formatDistance(distance)}` : ''}
          </p>

          {/* Joined + capacity */}
          <div className="mt-2">
            <p className="text-xs text-[#4a5068]">
              {event.joined_count} joined
              {spotsLeft !== null && ` · ${spotsLeft} spots left`}
            </p>
            {event.capacity && (
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#0a0b0f]">
                <div
                  className="h-full rounded-full bg-[#EF4444] transition-all"
                  style={{ width: `${capacityPct}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <button className="flex-1 rounded-lg bg-[#00d4ff] py-1.5 text-xs font-medium text-[#0a0b0f] transition-colors hover:bg-[#00d4ff]/80">
          Join
        </button>
        <button className="flex-1 rounded-lg border border-[#181c24] py-1.5 text-xs font-medium text-[#f0f4ff] transition-colors hover:bg-[#111318]">
          Save
        </button>
      </div>
    </div>
  );
}
