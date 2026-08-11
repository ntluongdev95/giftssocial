'use client';

import useSWR from 'swr';

export type StoryDTO = {
  id: string;
  author_id: string;
  business_id: string | null;
  event_id: string | null;
  location_lat: number;
  location_lng: number;
  place_name: string | null;
  media_url: string;
  media_type: 'photo' | 'video';
  thumbnail_url: string | null;
  caption: string;
  visibility: 'public' | 'friends' | 'circles';
  posted_at: string;
  expires_at: string;
  view_count: number;
  // Joined fields (rail feed, business stack)
  author_name?: string | null;
  author_username?: string | null;
  author_avatar?: string | null;
  business_display_name?: string | null;
  business_cover?: string | null;
  business_city?: string | null;
  // Per-viewer flag — 1 if the current viewer has already seen this story.
  // Returned by /stories?scope=rail and /stories/business/[id].
  viewed_by_me?: 0 | 1;
  // Optional CTA — story viewer renders as a tappable button when set.
  // Introduced for the Gao Gift card share flow.
  link_url?: string | null;
  link_label?: string | null;
};

export type ViewerDTO = {
  id: string;
  name: string;
  username: string | null;
  avatar: string | null;
  viewed_at: string;
};

type ListResp = { data: StoryDTO[] };
type BizResp = { data: { items: StoryDTO[]; count: number } };
type ViewersResp = { data: { items: ViewerDTO[]; count: number } };

const fetcher = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url, { credentials: 'same-origin' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<T>;
};

/**
 * Rail feed — active stories from friends + public + circles, 1 ring per
 * author. Refresh every 60s while the page is focused.
 */
export function useStoriesRail() {
  const { data, error, isLoading, mutate } = useSWR<ListResp>(
    '/api/v1/stories?scope=rail',
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: true },
  );
  return { stories: data?.data ?? [], error, isLoading, refresh: mutate };
}

/** Stack of active stories at a single business. */
export function useBusinessStories(businessId: string | null | undefined) {
  const key = businessId ? `/api/v1/stories/business/${businessId}` : null;
  const { data, error, isLoading, mutate } = useSWR<BizResp>(key, fetcher);
  return {
    items: data?.data.items ?? [],
    count: data?.data.count ?? 0,
    error,
    isLoading,
    refresh: mutate,
  };
}

/** Viewers of a single story. Author-only; non-authors get 404 and the
 * hook returns an empty list quietly. Pass `null` to skip fetching. */
export function useStoryViewers(storyId: string | null) {
  const key = storyId ? `/api/v1/stories/${storyId}/viewers` : null;
  const { data, error, isLoading, mutate } = useSWR<ViewersResp>(key, fetcher, {
    // Don't keep retrying if a non-author hits this endpoint.
    shouldRetryOnError: false,
  });
  return {
    items: data?.data.items ?? [],
    count: data?.data.count ?? 0,
    error,
    isLoading,
    refresh: mutate,
  };
}
