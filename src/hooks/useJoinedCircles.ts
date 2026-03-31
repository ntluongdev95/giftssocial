'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url, {
  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
}).then(r => r.json());

export function useJoinedCircles() {
  const { data, mutate } = useSWR('/api/v1/circles/me', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });

  const myCircles = (data?.data || []) as Record<string, unknown>[];
  const joinedCircleIds = new Set<string>(myCircles.map(c => c.id as string));

  return { joinedCircleIds, myCircles, refresh: mutate };
}
