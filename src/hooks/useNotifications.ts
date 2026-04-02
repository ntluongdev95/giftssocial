'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url, {
  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
}).then(r => r.json());

export function useNotifications() {
  const { data, mutate } = useSWR('/api/v1/notifications', fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
  });

  const notifications = (data?.data || []) as Record<string, unknown>[];
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    await fetch('/api/v1/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
      body: JSON.stringify({}),
    });
    mutate();
  };

  const markRead = async (id: string) => {
    await fetch('/api/v1/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
      body: JSON.stringify({ id }),
    });
    mutate();
  };

  return { notifications, unreadCount, markAllRead, markRead, refresh: mutate };
}
