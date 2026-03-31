'use client';

import { format, isToday, isTomorrow } from 'date-fns';
import { Clock, MapPin, Users, Shield } from 'lucide-react';
import type { Event } from '@/types';

interface EventCardProps {
  event: Event;
  onClick?: () => void;
}

const EVENT_PLACEHOLDER = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=300&fit=crop';

export default function EventCard({ event: e, onClick }: EventCardProps) {
  const startDate = new Date(e.start_time);
  const endDate = new Date(e.end_time);
  const isLive = e.status === 'live';
  const spotsLeft = e.capacity ? e.capacity - e.joined_count : null;

  // Date label
  let dateLabel = '';
  try {
    if (isToday(startDate)) dateLabel = 'Today';
    else if (isTomorrow(startDate)) dateLabel = 'Tomorrow';
    else dateLabel = format(startDate, 'MMM d');
  } catch { dateLabel = ''; }

  // Time label
  let timeLabel = '';
  try {
    timeLabel = `${format(startDate, 'HH:mm')} - ${format(endDate, 'HH:mm')}`;
  } catch { timeLabel = ''; }

  return (
    <div
      onClick={onClick}
      className="rounded-2xl overflow-hidden cursor-pointer transition-transform active:scale-[0.98]"
      style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
    >
      {/* Cover image */}
      <div className="relative h-36 w-full overflow-hidden">
        <img
          src={e.images?.[0] || EVENT_PLACEHOLDER}
          alt={e.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,11,15,0.9) 0%, transparent 60%)' }} />

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
          <h3 className="text-sm font-bold text-white leading-tight">{e.title}</h3>
          <div className="flex items-center gap-2 mt-1.5">
            {dateLabel && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>
                {dateLabel}
              </span>
            )}
            {isLive && (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full animate-pulse" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-[#f87171]" /> Live
              </span>
            )}
            {!isLive && (
              <span className="text-[10px] text-[#a3adc3]">
                {e.visibility === 'public' ? 'Public' : 'Private'}
              </span>
            )}
            {/* Capacity dots */}
            {e.capacity && (
              <div className="flex gap-0.5 ml-auto">
                {Array.from({ length: Math.min(e.capacity, 5) }).map((_, i) => (
                  <div key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i < Math.min(e.joined_count, 5) ? '#00d4ff' : 'rgba(255,255,255,0.15)' }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="px-4 py-3 space-y-2">
        {/* Time */}
        <div className="flex items-center gap-2 text-xs text-[#a3adc3]">
          <Clock size={12} className="text-[#00d4ff] shrink-0" />
          <span>{timeLabel}</span>
        </div>

        {/* Location */}
        {(e.location_name || e.city) && (
          <div className="flex items-center gap-2 text-xs text-[#a3adc3]">
            <MapPin size={12} className="text-[#00d4ff] shrink-0" />
            <span className="truncate">{e.location_name}{e.city ? `, ${e.city}` : ''}</span>
          </div>
        )}

        {/* Bottom row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {e.verified && (
              <span className="flex items-center gap-1 text-[10px] text-[#a3adc3]">
                <Shield size={11} className="text-[#00d4ff]" /> Trusted
              </span>
            )}
            {spotsLeft !== null && (
              <span className="text-[10px] text-[#00d4ff] font-medium">
                <Users size={10} className="inline mr-0.5" /> {spotsLeft} spots left
              </span>
            )}
          </div>
          <button
            onClick={(ev) => { ev.stopPropagation(); }}
            className="rounded-lg px-4 py-1.5 text-[11px] font-semibold cursor-pointer"
            style={{ background: '#00d4ff', color: '#0a0b0f' }}
          >
            Book
          </button>
        </div>
      </div>
    </div>
  );
}
