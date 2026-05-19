'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MapPin, Clock, Coins, Eye, Bookmark, MoreHorizontal, Pencil, Trash2, Loader2 } from 'lucide-react';

export type TripCardData = {
  id: string;
  title: string;
  cover_image: string | null;
  description: string | null;
  city: string | null;
  total_cost: number;
  total_currency: string;
  total_minutes: number;
  stop_count: number;
  view_count: number;
  save_count: number;
  author_name?: string | null;
  author_username?: string | null;
  author_avatar?: string | null;
};

export function TripCard({
  trip,
  showOwnerActions = false,
  onDeleted,
}: {
  trip: TripCardData;
  /** When true, render edit/delete dropdown overlaid on the card. */
  showOwnerActions?: boolean;
  /** Called after a successful delete so the parent list can re-fetch. */
  onDeleted?: (id: string) => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const hours = Math.floor(trip.total_minutes / 60);
  const mins = trip.total_minutes % 60;
  const timeLabel = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;
  const costLabel =
    trip.total_currency === 'mixed'
      ? 'Mixed'
      : trip.total_cost > 0
        ? `${formatCost(trip.total_cost, trip.total_currency)} ${trip.total_currency}`
        : 'Free';

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    if (!confirm(`Delete "${trip.title}"? This can't be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/trips/${trip.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message || 'Delete failed');
      }
      toast.success('Trip deleted');
      onDeleted?.(trip.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  function goEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    router.push(`/me/trips/${trip.id}/edit`);
  }

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group relative block rounded-2xl overflow-hidden transition-transform hover:-translate-y-0.5 cursor-pointer"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Owner actions — only when caller opts in (e.g. /me/trips grid) */}
      {showOwnerActions && (
        <div className="absolute top-2 left-2 z-10">
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); setMenuOpen(v => !v); }}
            disabled={deleting}
            className="h-8 w-8 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-50"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            aria-label="Trip actions"
          >
            {deleting ? <Loader2 size={14} className="animate-spin text-white" /> : <MoreHorizontal size={14} className="text-white" />}
          </button>
          {menuOpen && (
            <div
              className="absolute top-9 left-0 rounded-xl overflow-hidden min-w-35"
              style={{ background: '#1a1d27', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
              onClick={e => e.preventDefault()}
            >
              <button
                onClick={goEdit}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white cursor-pointer hover:bg-white/5"
              >
                <Pencil size={12} className="text-[#00d4ff]" /> Edit
              </button>
              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-white/5"
                style={{ color: '#fca5a5' }}
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>
      )}
      {/* Cover */}
      <div
        className="relative aspect-16/10 bg-[#1a1d27]"
        style={
          trip.cover_image
            ? { background: `url(${trip.cover_image}) center/cover` }
            : { background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(168,85,247,0.1))' }
        }
      >
        {/* Stop count chip */}
        <span
          className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(0,0,0,0.5)', color: 'white', backdropFilter: 'blur(4px)' }}
        >
          {trip.stop_count} stops
        </span>
        {/* Gradient overlay for legibility */}
        <div className="absolute inset-x-0 bottom-0 h-1/2"
          style={{ background: 'linear-gradient(to top, rgba(10,11,15,0.85), transparent)' }} />
        <div className="absolute bottom-3 left-3 right-3">
          <div className="text-base font-bold text-white drop-shadow truncate">{trip.title}</div>
          {trip.city && (
            <div className="flex items-center gap-1 text-[11px] text-white/80 mt-0.5">
              <MapPin size={10} /> {trip.city}
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 px-3 py-2.5 text-[11px] text-[#a3adc3]">
        <span className="flex items-center gap-1">
          <Coins size={11} className="text-[#22c55e]" /> {costLabel}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={11} /> {timeLabel}
        </span>
        <span className="flex items-center gap-1 ml-auto text-[#4a5068]">
          <Eye size={10} /> {trip.view_count}
          <Bookmark size={10} className="ml-1.5" /> {trip.save_count}
        </span>
      </div>

      {/* Author footer */}
      {trip.author_name && (
        <div className="flex items-center gap-2 px-3 pb-3 -mt-1">
          {trip.author_avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={trip.author_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-[#1a1d27] flex items-center justify-center text-[9px] text-[#a3adc3]">
              {trip.author_name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-[10px] text-[#4a5068] truncate">
            by {trip.author_name}
          </span>
        </div>
      )}
    </Link>
  );
}

function formatCost(amount: number, currency: string): string {
  if (currency === 'VND') {
    // 250000 → "250k"
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k`;
    return amount.toFixed(0);
  }
  return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
