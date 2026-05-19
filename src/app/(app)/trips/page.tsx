'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, MapPin, Search, Loader2, ChevronDown, Plus } from 'lucide-react';
import { TripCard, type TripCardData } from '@/components/trips/TripCard';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'same-origin' }).then(r => r.json() as Promise<{ data: TripCardData[] }>);

export default function TripsDiscoverPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'new' | 'popular'>('new');

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('sort', sort);
  params.set('limit', '24');

  const { data, isLoading, error } = useSWR<{ data: TripCardData[] }>(
    `/api/v1/trips?${params.toString()}`,
    fetcher,
  );
  const items = data?.data ?? [];

  return (
    <div className="h-full overflow-y-auto bg-[#0a0b0f] text-white">
      <header
        className="sticky top-0 z-10"
        style={{
          background: 'rgba(10,11,15,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] hover:text-white cursor-pointer">
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="text-base lg:text-lg font-bold ml-auto mr-auto flex items-center gap-1.5">
            <MapPin size={16} className="text-[#00d4ff]" />
            Trips
          </h1>
          <button
            onClick={() => router.push('/me/trips/new')}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold cursor-pointer"
            style={{ background: '#00d4ff', color: '#0a0b0f' }}
          >
            <Plus size={12} /> New
          </button>
        </div>

        <div className="max-w-6xl mx-auto px-4 lg:px-8 pb-3 flex items-center gap-2">
          <div
            className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <Search size={14} className="text-[#4a5068]" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search trips or cities..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-[#4a5068] outline-none"
            />
          </div>
          <div className="relative">
            <select
              value={sort}
              onChange={e => setSort(e.target.value as 'new' | 'popular')}
              className="appearance-none rounded-xl pl-3 pr-8 py-2 text-xs cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.04)', color: '#a3adc3', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <option value="new" style={{ background: '#0a0b0f' }}>Newest</option>
              <option value="popular" style={{ background: '#0a0b0f' }}>Popular</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#4a5068] pointer-events-none" />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 lg:px-8 py-4 pb-20">
        {isLoading && (
          <div className="flex justify-center py-16 text-[#4a5068]">
            <Loader2 size={20} className="animate-spin text-[#00d4ff]" />
          </div>
        )}

        {error && (
          <div className="rounded-xl p-4 text-sm" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', color: '#fca5a5' }}>
            Couldn&apos;t load trips. Try again later.
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="rounded-2xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <MapPin size={32} className="mx-auto mb-3 text-[#2d3548]" />
            <p className="font-medium text-[#a3adc3] mb-1">No trips yet</p>
            <p className="text-xs text-[#4a5068] mb-3">Be the first to share your itinerary.</p>
            <button
              onClick={() => router.push('/me/trips/new')}
              className="rounded-full px-4 py-2 text-xs font-bold cursor-pointer"
              style={{ background: '#00d4ff', color: '#0a0b0f' }}
            >
              Create a trip →
            </button>
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(trip => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
