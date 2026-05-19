'use client';

import { use, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  ArrowLeft, MapPin, Clock, Coins, Eye, Bookmark, Loader2, Route as RouteIcon,
  Pencil, Trash2,
} from 'lucide-react';
import { HashtagText } from '@/components/HashtagText';
import { useAuthStore, selectUserId } from '@/stores/auth-store';

const TripMap = dynamic(() => import('@/components/trips/TripMap'), { ssr: false });

type Stop = {
  id: string;
  position: number;
  place_name: string;
  activity: string;
  cost: number;
  cost_currency: string;
  duration_minutes: number;
  notes: string;
  photos: string[];
  place_lat: number | null;
  place_lng: number | null;
};

type TripDetail = {
  id: string;
  author_id: string;
  title: string;
  cover_image: string | null;
  description: string;
  city: string | null;
  total_cost: number;
  total_currency: string;
  total_minutes: number;
  stop_count: number;
  view_count: number;
  save_count: number;
  visibility: 'public' | 'friends' | 'private';
  created_at: string;
  author_name: string | null;
  author_username: string | null;
  author_avatar: string | null;
  stops: Stop[];
};

const fetcher = (url: string) =>
  fetch(url, { credentials: 'same-origin' }).then(async r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<{ data: TripDetail }>;
  });

export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const myUserId = useAuthStore(selectUserId);
  const [deleting, setDeleting] = useState(false);

  const { data, error, isLoading } = useSWR<{ data: TripDetail }>(
    `/api/v1/trips/${id}`,
    fetcher,
  );
  const trip = data?.data;
  const isOwner = !!myUserId && !!trip && trip.author_id === myUserId;

  // Stops that have coords → render on map
  const mapStops = (trip?.stops ?? []).filter(
    s => s.place_lat != null && s.place_lng != null,
  );

  async function handleDelete() {
    if (!trip) return;
    if (!confirm(`Delete "${trip.title}"? This can't be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/trips/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error?.message || 'Delete failed');
      toast.success('Trip deleted');
      router.push('/me/trips');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
      setDeleting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#0a0b0f] text-white">
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{
          background: 'rgba(10,11,15,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] hover:text-white cursor-pointer">
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-sm font-bold ml-auto mr-auto truncate max-w-[60%]">
          {trip?.title ?? 'Trip'}
        </h1>
        {/* Owner-only actions */}
        {isOwner ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => router.push(`/me/trips/${id}/edit`)}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer"
              style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.25)' }}
            >
              <Pencil size={12} /> Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
              style={{ background: 'rgba(248,113,113,0.08)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.2)' }}
              aria-label="Delete trip"
            >
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          </div>
        ) : (
          <div className="w-14" />
        )}
      </header>

      {isLoading && (
        <div className="flex justify-center py-16 text-[#4a5068]">
          <Loader2 size={20} className="animate-spin text-[#00d4ff]" />
        </div>
      )}

      {error && (
        <div className="max-w-2xl mx-auto m-4 rounded-xl p-4 text-sm" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', color: '#fca5a5' }}>
          Couldn&apos;t load this trip.
        </div>
      )}

      {trip && (
        <main className="max-w-6xl mx-auto px-4 lg:px-8 py-4 lg:py-8 pb-20">
          {/* Mobile: cover at top. Desktop: lives inside left column below. */}
          <div
            className="lg:hidden aspect-16/10 rounded-2xl overflow-hidden mb-4"
            style={
              trip.cover_image
                ? { background: `url(${trip.cover_image}) center/cover` }
                : { background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(168,85,247,0.1))' }
            }
          />

          <div className="lg:grid lg:grid-cols-[420px_1fr] lg:gap-8">
            {/* ─── LEFT COLUMN (sticky on desktop) ──────────────────── */}
            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
              {/* Desktop cover (square-ish for tighter framing) */}
              <div
                className="hidden lg:block aspect-square rounded-2xl overflow-hidden"
                style={
                  trip.cover_image
                    ? { background: `url(${trip.cover_image}) center/cover` }
                    : { background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(168,85,247,0.1))' }
                }
              />

              {/* Stats 2x2 grid (more readable than 4x1 on a 420px column) */}
              <section className="grid grid-cols-2 gap-2">
                <Stat icon={<Coins size={14} />} label="Cost" value={formatCost(trip.total_cost, trip.total_currency)} color="#22c55e" />
                <Stat icon={<Clock size={14} />} label="Time" value={formatTime(trip.total_minutes)} color="#00d4ff" />
                <Stat icon={<RouteIcon size={14} />} label="Stops" value={String(trip.stop_count)} color="#a855f7" />
                <Stat icon={<Eye size={14} />} label="Views" value={trip.view_count.toLocaleString()} color="#4a5068" />
              </section>

              {/* Map trace */}
              {mapStops.length > 0 && (
                <section className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  <TripMap stops={mapStops} />
                  <div className="text-[10px] text-[#4a5068] px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    {mapStops.length} of {trip.stops.length} stops on map
                  </div>
                </section>
              )}
            </aside>

            {/* ─── RIGHT COLUMN (main content) ───────────────────────── */}
            <div className="space-y-5 mt-4 lg:mt-0">
              {/* Title block */}
              <section className="space-y-2">
                <h1 className="text-2xl lg:text-4xl font-bold text-white leading-tight">{trip.title}</h1>
                {trip.city && (
                  <div className="flex items-center gap-1 text-sm text-[#a3adc3]">
                    <MapPin size={14} /> {trip.city}
                  </div>
                )}
                {/* Author */}
                <Link
                  href={trip.author_username ? `/g/${trip.author_username}` : '#'}
                  className="inline-flex items-center gap-2 mt-2 cursor-pointer hover:opacity-80"
                >
                  {trip.author_avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={trip.author_avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-[#1a1d27] flex items-center justify-center text-xs text-[#a3adc3]">
                      {(trip.author_name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-white">by {trip.author_name || trip.author_username}</div>
                    <div className="text-[10px] text-[#4a5068]">{new Date(trip.created_at).toLocaleDateString()}</div>
                  </div>
                </Link>
              </section>

              {/* Description */}
              {trip.description && (
                <section
                  className="rounded-2xl p-4 lg:p-5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="text-sm lg:text-[15px] text-[#a3adc3] leading-relaxed">
                    <HashtagText
                      text={trip.description}
                      tagClassName="text-[#ec4899] hover:underline cursor-pointer"
                    />
                  </div>
                </section>
              )}

              {/* Stops timeline with a vertical rail */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm lg:text-base font-bold uppercase tracking-wider text-[#a3adc3]">
                    Itinerary
                  </h2>
                  <span className="text-xs text-[#4a5068]">{trip.stops.length} stops</span>
                </div>

                <ol className="relative space-y-3">
                  {/* Connecting rail line on desktop */}
                  <div
                    className="hidden lg:block absolute left-[15px] top-2 bottom-2 w-px"
                    style={{ background: 'linear-gradient(to bottom, rgba(0,212,255,0.3), rgba(168,85,247,0.1))' }}
                  />
                  {trip.stops.map((stop, idx) => (
                    <li
                      key={stop.id}
                      className="relative rounded-2xl p-4 space-y-2 lg:ml-10"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      {/* Desktop: number sits on the rail to the left */}
                      <div
                        className="hidden lg:flex absolute -left-10 top-4 h-8 w-8 rounded-full items-center justify-center text-xs font-bold ring-4 ring-[#0a0b0f]"
                        style={{
                          background: 'linear-gradient(135deg, #00d4ff, #a855f7)',
                          color: 'white',
                        }}
                      >
                        {idx + 1}
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Mobile: number inline */}
                        <div
                          className="lg:hidden h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}
                        >
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm lg:text-base font-bold text-white truncate">{stop.place_name}</div>
                          {stop.activity && (
                            <div className="text-[11px] lg:text-xs text-[#a3adc3]">{stop.activity}</div>
                          )}
                        </div>
                        {stop.place_lat != null && stop.place_lng != null && (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${stop.place_lat},${stop.place_lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-semibold px-2.5 py-1 rounded-full cursor-pointer shrink-0"
                            style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}
                          >
                            Directions
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] lg:text-xs text-[#a3adc3]">
                        {stop.cost > 0 && (
                          <span className="flex items-center gap-1">
                            <Coins size={11} className="text-[#22c55e]" />
                            {formatCost(stop.cost, stop.cost_currency)} {stop.cost_currency}
                          </span>
                        )}
                        {stop.duration_minutes > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock size={11} /> {formatTime(stop.duration_minutes)}
                          </span>
                        )}
                      </div>

                      {stop.notes && (
                        <div className="text-sm text-[#a3adc3] leading-relaxed">
                          <HashtagText text={stop.notes} tagClassName="text-[#ec4899] hover:underline cursor-pointer" />
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </section>

              {/* Save stat at bottom */}
              <div className="text-center text-[10px] text-[#4a5068] pt-4">
                <Bookmark size={10} className="inline mr-1" /> {trip.save_count} saves
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

function Stat({
  icon, label, value, color,
}: {
  icon: React.ReactNode; label: string; value: string; color: string;
}) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div style={{ color }} className="mx-auto mb-1 w-fit">{icon}</div>
      <div className="text-sm font-bold text-white">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-[#4a5068]">{label}</div>
    </div>
  );
}

function formatCost(amount: number, currency: string): string {
  if (currency === 'mixed') return 'Mixed';
  if (amount === 0) return 'Free';
  if (currency === 'VND') {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k`;
    return amount.toFixed(0);
  }
  return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatTime(minutes: number): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
