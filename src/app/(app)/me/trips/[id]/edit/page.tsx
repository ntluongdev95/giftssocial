'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Loader2 } from 'lucide-react';
import { TripForm, type TripFormInitial, type Stop } from '@/components/trips/TripForm';

type RawStop = {
  position: number;
  place_name: string;
  activity: string;
  cost: number;
  cost_currency: string;
  duration_minutes: number;
  notes: string;
  place_lat: number | null;
  place_lng: number | null;
};

type RawTrip = {
  id: string;
  author_id: string;
  title: string;
  cover_image: string | null;
  description: string;
  city: string | null;
  visibility: 'public' | 'friends' | 'private';
  stops: RawStop[];
};

const fetcher = (url: string) =>
  fetch(url, { credentials: 'same-origin' }).then(async r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<{ data: RawTrip }>;
  });

export default function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data, error, isLoading } = useSWR<{ data: RawTrip }>(
    `/api/v1/trips/${id}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0b0f]">
        <Loader2 size={20} className="animate-spin text-[#00d4ff]" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center bg-[#0a0b0f] text-white">
        <p className="text-sm text-[#f87171]">Couldn&apos;t load this trip — it may have been deleted or you don&apos;t have access.</p>
        <button
          onClick={() => router.push('/me/trips')}
          className="rounded-full px-4 py-2 text-xs font-bold cursor-pointer"
          style={{ background: '#00d4ff', color: '#0a0b0f' }}
        >
          Back to My Trips
        </button>
      </div>
    );
  }

  const trip = data.data;
  const initial: TripFormInitial = {
    title: trip.title,
    cover_image: trip.cover_image,
    description: trip.description ?? '',
    city: trip.city,
    visibility: trip.visibility,
    stops: trip.stops.map<Stop>(s => ({
      place_name: s.place_name,
      activity: s.activity ?? '',
      cost: s.cost ?? 0,
      cost_currency: s.cost_currency ?? 'VND',
      duration_minutes: s.duration_minutes ?? 0,
      notes: s.notes ?? '',
      place_lat: s.place_lat,
      place_lng: s.place_lng,
    })),
  };

  return <TripForm mode="edit" tripId={id} initial={initial} />;
}
