'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useLocationStore } from '@/stores/locationStore';

export interface SearchResults {
  people: Array<Record<string, unknown>>;
  businesses: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  circles: Array<Record<string, unknown>>;
  places: Array<Record<string, unknown>>;
  tags: Array<Record<string, unknown>>;
}

const EMPTY_RESULTS: SearchResults = { people: [], businesses: [], events: [], circles: [], places: [], tags: [] };

// Simple LRU-ish cache: key → { data, timestamp }
const searchCache = new Map<string, { data: SearchResults; ts: number }>();
const CACHE_TTL = 30_000; // 30s
const CACHE_MAX = 50;

function getCached(key: string): SearchResults | null {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    searchCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: SearchResults) {
  // Evict oldest if over limit
  if (searchCache.size >= CACHE_MAX) {
    const firstKey = searchCache.keys().next().value;
    if (firstKey) searchCache.delete(firstKey);
  }
  searchCache.set(key, { data, ts: Date.now() });
}

export function useSearch() {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('top');
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { lat, lng } = useLocationStore();

  const doSearch = useCallback(async (q: string, t: string) => {
    // Clear previous debounce
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!q.trim() || q.length < 2) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }

    // Build cache key
    const cacheKey = `${q.toLowerCase()}|${t}|${lat?.toFixed(2)}|${lng?.toFixed(2)}`;
    const cached = getCached(cacheKey);
    if (cached) {
      setResults(cached);
      setLoading(false);
      return;
    }

    // Abort previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams({ q, tab: t, limit: '20' });
      if (lat) params.set('lat', String(lat));
      if (lng) params.set('lng', String(lng));

      const res = await fetch(`/api/v1/search?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);

      const data = await res.json();
      const searchData = data.data as SearchResults;

      setResults(searchData);
      // Only cache if at least one result category has entries
      const hasAny = Object.values(searchData).some((a) => Array.isArray(a) && a.length > 0);
      if (hasAny) setCache(cacheKey, searchData);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // expected
      toast.error('Search failed. Please try again.');
      setResults(EMPTY_RESULTS);
    } finally {
      // Only clear loading if this controller wasn't aborted
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [lat, lng]);

  /** Debounced search — call on every input change */
  const handleInput = useCallback((val: string, currentTab?: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim() || val.length < 2) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }
    // Show loading immediately for responsiveness
    setLoading(true);
    timerRef.current = setTimeout(() => doSearch(val, currentTab || tab), 300);
  }, [doSearch, tab]);

  /** Immediate search — call on tab change */
  const handleTabChange = useCallback((t: string, currentQuery?: string) => {
    setTab(t);
    const q = currentQuery ?? query;
    if (q.length >= 2) doSearch(q, t);
  }, [doSearch, query]);

  /** Clear search state */
  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
    setQuery('');
    setResults(EMPTY_RESULTS);
    setLoading(false);
  }, []);

  return { query, setQuery, tab, setTab, results, loading, handleInput, handleTabChange, clear, doSearch };
}
