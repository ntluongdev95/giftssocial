'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url, {
  
}).then(r => r.json());

export function useNotifications() {
  const { data, mutate } = useSWR('/api/v1/notifications', fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
    revalidateOnMount: true,
    revalidateOnReconnect: true,
  });

  const notifications = (data?.data || []) as Record<string, unknown>[];
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    await fetch('/api/v1/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    mutate();
  };

  const markRead = async (id: string) => {
    await fetch('/api/v1/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    mutate();
  };

  const clearAll = async () => {
    await fetch('/api/v1/notifications', {
      method: 'DELETE'
    });
    mutate();
  };

  return { notifications, unreadCount, markAllRead, markRead, clearAll, refresh: mutate };
}
