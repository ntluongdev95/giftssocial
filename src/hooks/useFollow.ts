'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url, {
  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
}).then(r => r.json());

export function useFollow() {
  const { data, mutate } = useSWR('/api/v1/follows?type=following', fetcher, {
    revalidateOnFocus: true,
    revalidateOnMount: true,
    dedupingInterval: 2000,
  });

  const follows = (data?.data || []) as Record<string, unknown>[];
  const followingUserIds = new Set(follows.filter(f => f.following_user_id).map(f => f.following_user_id as string));
  const followingBizIds = new Set(follows.filter(f => f.following_business_id).map(f => f.following_business_id as string));
  const followingCircleIds = new Set(follows.filter(f => f.following_circle_id).map(f => f.following_circle_id as string));

  const follow = async (target: { user_id?: string; business_id?: string; circle_id?: string }) => {
    const res = await fetch('/api/v1/follows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
      body: JSON.stringify(target),
    });
    if (res.ok) mutate();
    return res.ok;
  };

  const unfollow = async (target: { user_id?: string; business_id?: string; circle_id?: string }) => {
    const res = await fetch('/api/v1/follows', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
      body: JSON.stringify(target),
    });
    if (res.ok) mutate();
    return res.ok;
  };

  // Friends = mutual follows (I follow them AND they follow me)
  const { data: followersData } = useSWR('/api/v1/follows?type=followers', fetcher, {
    revalidateOnFocus: true,
    revalidateOnMount: true,
    dedupingInterval: 2000,
  });
  const followerUserIds = new Set(
    ((followersData?.data || []) as Record<string, unknown>[])
      .filter(f => f.follower_id)
      .map(f => f.follower_id as string)
  );
  const friendIds = new Set([...followingUserIds].filter(id => followerUserIds.has(id)));

  const isFriend = (userId: string) => friendIds.has(userId);

  return { followingUserIds, followerUserIds, friendIds, followingBizIds, followingCircleIds, isFriend, follow, unfollow, refresh: mutate };
}
