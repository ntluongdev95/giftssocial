'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, MapPin, Plus, Loader2 } from 'lucide-react';
import { TripCard, type TripCardData } from '@/components/trips/TripCard';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'same-origin' }).then(r => r.json() as Promise<{ data: TripCardData[] }>);

export default function MyTripsPage() {
  const router = useRouter();
  const { data, isLoading, mutate } = useSWR<{ data: TripCardData[] }>(
    '/api/v1/trips?scope=mine&limit=50',
    fetcher,
  );
  const items = data?.data ?? [];

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
        <button onClick={() => router.push('/me')} className="flex items-center gap-2 text-sm text-[#a3adc3] hover:text-white cursor-pointer">
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-base lg:text-lg font-bold ml-auto mr-auto flex items-center gap-1.5">
          <MapPin size={16} className="text-[#00d4ff]" />
          My Trips
        </h1>
        <button
          onClick={() => router.push('/me/trips/new')}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold cursor-pointer"
          style={{ background: '#00d4ff', color: '#0a0b0f' }}
        >
          <Plus size={12} /> New
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 lg:px-8 py-5 pb-20">
        {isLoading && (
          <div className="flex justify-center py-16 text-[#4a5068]">
            <Loader2 size={20} className="animate-spin text-[#00d4ff]" />
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="rounded-2xl p-12 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <MapPin size={32} className="mx-auto mb-3 text-[#2d3548]" />
            <p className="font-medium text-[#a3adc3] mb-1">No trips yet</p>
            <p className="text-xs text-[#4a5068] mb-3">Share your first itinerary — friends will discover it via search.</p>
            <button
              onClick={() => router.push('/me/trips/new')}
              className="rounded-full px-4 py-2 text-xs font-bold cursor-pointer"
              style={{ background: '#00d4ff', color: '#0a0b0f' }}
            >
              Create my first trip →
            </button>
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(trip => (
              <TripCard
                key={trip.id}
                trip={trip}
                showOwnerActions
                onDeleted={() => mutate()}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
