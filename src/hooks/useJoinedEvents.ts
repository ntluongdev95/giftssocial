'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url, {
  
}).then(r => r.json());

/**
 * Returns a Set of event IDs that the current user has joined (booked).
 * Revalidates on mutate.
 */
export function useJoinedEvents() {
  const { data, mutate } = useSWR('/api/v1/bookings/me', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });

  const bookings = (data?.data || []) as Record<string, unknown>[];
  const joinedEventIds = new Set<string>(
    bookings
      .filter(b => b.event_id && b.status !== 'canceled')
      .map(b => b.event_id as string)
  );

  return { joinedEventIds, refresh: mutate };
}
