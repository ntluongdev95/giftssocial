'use client';

// useOccasions — fetches occasions + templates from the DB-backed API
// (/api/v1/occasions) with an in-code fallback to src/lib/occasions.ts
// so the picker still works offline or during a network blip.
//
// The API returns snake_case fields; this hook converts to the
// existing Occasion shape used across the frontend so callers don't
// need to change.

import useSWR from 'swr';
import { OCCASIONS as FALLBACK_OCCASIONS } from '@/lib/occasions';
import type { Occasion, OccasionTemplate } from '@/lib/occasions';

interface ApiTemplate {
  id: string;
  component_key: string;
  name: string;
  description?: string | null;
  emoji: string;
  thumbnail_bg?: string | null;
  thumbnail_url?: string | null;
  preview_video?: string | null;
  accent_color?: string | null;
  premium: number; // 0/1
  coins: number;
  featured: number;
  fields_schema?: string | null; // JSON
  effects?: string | null;       // JSON
}

interface ApiOccasion {
  id: string;
  name: string;
  name_vi?: string | null;
  emoji: string;
  theme_color: string;
  bg_gradient?: string | null;
  description?: string | null;
  description_vi?: string | null;
  date: { month: number; day: number } | null;
  is_lunar: boolean;
  evergreen: boolean;
  window_days: number;
  templates: ApiTemplate[];
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function convertTemplate(t: ApiTemplate): OccasionTemplate {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? '',
    emoji: t.emoji,
    thumbnailBg: t.thumbnail_bg ?? 'linear-gradient(135deg, #a3adc3, #4a5068)',
    videoUrl: t.preview_video ?? undefined,
    premium: t.premium === 1,
    coins: t.coins,
    componentKey: t.component_key,
    accentColor: t.accent_color ?? undefined,
    fieldsSchema: safeParseJson(t.fields_schema, []),
    effects: safeParseJson(t.effects, []),
  };
}

function convertOccasion(o: ApiOccasion): Occasion {
  return {
    id: o.id,
    name: o.name,
    emoji: o.emoji,
    themeColor: o.theme_color,
    bgGradient: o.bg_gradient ?? 'linear-gradient(135deg, #17191c, #0a0b0f)',
    description: o.description ?? '',
    // Evergreens have no real date; supply a nominal Jan 1 so daysUntil() sorts them last.
    date: o.date ?? { month: 1, day: 1 },
    isLunar: o.is_lunar,
    evergreen: o.evergreen,
    windowDays: o.window_days,
    gifts: [],   // deprecated in DB — kept for backward compat with the type
    bundles: [], // deprecated
    templates: (o.templates ?? []).map(convertTemplate),
  };
}

interface UseOccasionsResult {
  occasions: Occasion[];
  isLoading: boolean;
  isFallback: boolean; // true when using hardcoded fallback (API failed / still loading)
}

export function useOccasions(): UseOccasionsResult {
  const { data, error, isLoading } = useSWR<{ data: ApiOccasion[] }>(
    '/api/v1/occasions',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 60_000 }
  );

  if (data?.data && !error) {
    return { occasions: data.data.map(convertOccasion), isLoading: false, isFallback: false };
  }
  // Fallback while loading or on error — the hardcoded catalogue keeps
  // the UI functional even if the API is down.
  return { occasions: FALLBACK_OCCASIONS, isLoading, isFallback: true };
}
