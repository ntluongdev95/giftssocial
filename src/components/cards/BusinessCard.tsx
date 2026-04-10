'use client';

import { MapPin, Star, Users, CheckCircle } from 'lucide-react';
import type { Business } from '@/types';

interface BusinessCardProps {
  business: Business;
  distance?: number;
  onClick?: () => void;
}

function formatDistance(km?: number): string {
  if (!km && km !== 0) return '';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)} km`;
}

export default function BusinessCard({ business: b, distance, onClick }: BusinessCardProps) {
  const distKm = distance ?? (b as unknown as Record<string, unknown>).distance_km as number | undefined;
  const services = (b.services || []) as { name: string; price: number; duration: number }[];
  const todayKey = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
  const todayHours = b.hours?.[todayKey];
  const isOpen = b.open_now || (todayHours && !todayHours.closed);

  // Highlight info
  const highlightText = services.length > 0
    ? `${services.length} services today`
    : b.proof_count > 0
      ? `${b.proof_count} people check in today`
      : undefined;

  return (
    <div
      onClick={onClick}
      className="rounded-2xl p-4 transition-colors hover:bg-white/[0.02] cursor-pointer"
      style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
    >
      {/* Top row: avatar + info */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
          style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(0,212,255,0.15))', color: '#00d4ff' }}
        >
          {b.name.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + verified */}
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-[#f0f4ff] truncate">{b.name}</h3>
            {b.license_verified && (
              <CheckCircle size={14} className="shrink-0 text-[#00d4ff]" fill="rgba(34,197,94,0.2)" />
            )}
          </div>

          {/* Rating + reviews + price */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {b.rating_avg && (
              <>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star
                      key={i}
                      size={10}
                      className={i <= Math.round(b.rating_avg!) ? 'text-[#fbbf24]' : 'text-[#2d3548]'}
                      fill={i <= Math.round(b.rating_avg!) ? '#fbbf24' : 'none'}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-[#a3adc3]">{b.rating_avg}</span>
              </>
            )}
            {b.rating_count > 0 && (
              <span className="text-[10px] text-[#00d4ff] font-medium">⬆ {b.rating_count} Reviews</span>
            )}
          </div>

          {/* Distance + category */}
          <div className="flex items-center gap-2 mt-1 text-[10px] text-[#4a5068]">
            {distKm !== undefined && (
              <span className="flex items-center gap-0.5">
                <MapPin size={9} /> {formatDistance(distKm)}
              </span>
            )}
            <span className="capitalize">{Array.isArray(b.subcategories) ? b.subcategories.join(', ') : b.subcategories || b.category}</span>
          </div>
        </div>
      </div>

      {/* Highlight row */}
      {highlightText && (
        <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-[#a3adc3]">
          <Users size={10} className="text-[#00d4ff]" />
          <span>{highlightText}</span>
        </div>
      )}

      {/* Bottom row: status + book */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: isOpen ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: isOpen ? '#00d4ff' : '#f87171',
            }}
          >
            {isOpen ? 'Open' : 'Closed'}
          </span>
          {b.accepts_walkins && (
            <span className="text-[9px] text-[#4a5068]">Walk-ins OK</span>
          )}
        </div>
        {b.booking_enabled && (
          <button className="rounded-lg px-4 py-1.5 text-[11px] font-semibold cursor-pointer transition-colors" style={{ background: '#00d4ff', color: '#0a0b0f' }}>
            Book
          </button>
        )}
      </div>
    </div>
  );
}
