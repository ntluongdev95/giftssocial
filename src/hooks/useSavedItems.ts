'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url, {
  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
}).then(r => r.json());

export function useSavedItems() {
  const { data, mutate } = useSWR('/api/v1/saved', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });

  const items = (data?.data || []) as { id: string; item_type: string; item_id: string }[];
  const savedIds = new Set(items.map(i => `${i.item_type}:${i.item_id}`));

  const isSaved = (type: string, id: string) => savedIds.has(`${type}:${id}`);

  const toggleSave = async (type: string, id: string) => {
    const token = localStorage.getItem('access_token');
    if (!token) return false;

    const alreadySaved = isSaved(type, id);

    if (alreadySaved) {
      await fetch('/api/v1/saved', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_type: type, item_id: id }),
      });
    } else {
      await fetch('/api/v1/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_type: type, item_id: id }),
      });
    }

    mutate();
    return !alreadySaved;
  };

  return { isSaved, toggleSave, refresh: mutate };
}
