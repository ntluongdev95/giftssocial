'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send } from 'lucide-react';
import { useLocationStore } from '@/stores/locationStore';
import BusinessCard from '@/components/cards/BusinessCard';
import EventCard from '@/components/cards/EventCard';
import type { AskGaoResponse, Business, Event } from '@/types';

// ─── Placeholder examples ─────────────────────────────────────────────────

const EXAMPLES = [
  'Find trusted dentist near me tomorrow after 3 PM',
  'Any AI builder events tonight?',
  'Best nail studio open now within 2 miles',
  'Active startup circles nearby',
];

// ─── Page ─────────────────────────────────────────────────────────────────

export default function AskGaoPage() {
  const router = useRouter();
  const { lat, lng } = useLocationStore();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskGaoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const handleAsk = async (q?: string) => {
    const finalQuery = q || query;
    if (!finalQuery.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/v1/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: finalQuery,
          context: {
            lat: lat ?? 32.7767,
            lng: lng ?? -96.797,
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to get response');

      const data: AskGaoResponse = await res.json();
      setResult(data);

      // Add to history (dedup, max 3)
      setHistory((prev) => {
        const next = [finalQuery, ...prev.filter((h) => h !== finalQuery)];
        return next.slice(0, 3);
      });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExample = (example: string) => {
    setQuery(example);
    handleAsk(example);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-[env(safe-area-inset-top,12px)]">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#4a5068] hover:bg-[#111318]"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#A855F7]/20 text-sm text-[#A855F7]">
            ⬡
          </span>
          <div>
            <h1 className="text-lg font-bold text-[#f0f4ff]">Ask Gao</h1>
            <p className="text-[10px] text-[#4a5068]">
              Find trusted services, events, and more nearby
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 px-4 pt-4">
        {/* Input area */}
        <div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to do?"
            rows={3}
            className="w-full resize-none rounded-xl border border-[#181c24]/30 bg-[#0a0b0f] px-4 py-3 text-sm text-[#f0f4ff] placeholder-[#4a5068] outline-none focus:border-[#00d4ff]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
          />
          <button
            onClick={() => handleAsk()}
            disabled={!query.trim() || loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00d4ff] py-3 text-sm font-semibold text-[#0a0b0f] transition-colors hover:bg-[#00d4ff]/80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={14} />
            Ask Gao
          </button>
        </div>

        {/* Examples (show when no result) */}
        {!result && !loading && (
          <div>
            <p className="mb-2 text-xs font-medium text-[#4a5068]">
              Try asking
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => handleExample(ex)}
                  className="rounded-full border border-[#181c24]/30 bg-[#111318]/40 px-3 py-1.5 text-[11px] text-[#f0f4ff]/70 transition-colors hover:bg-[#111318]/60"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent history */}
        {!result && !loading && history.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-[#4a5068]">Recent</p>
            <div className="flex flex-wrap gap-2">
              {history.map((h) => (
                <button
                  key={h}
                  onClick={() => handleExample(h)}
                  className="rounded-full border border-[#A855F7]/20 bg-[#A855F7]/5 px-3 py-1.5 text-[11px] text-[#A855F7]/80"
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <span className="inline-block animate-spin text-3xl text-[#A855F7]">
              ⬡
            </span>
            <p className="text-sm text-[#4a5068]">
              Gao is looking for trusted options…
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/5 px-4 py-3">
            <p className="text-sm text-[#EF4444]">{error}</p>
            <button
              onClick={() => handleAsk()}
              className="mt-2 text-xs text-[#00d4ff]"
            >
              Try again
            </button>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Answer */}
            {result.answer && (
              <p className="text-sm leading-relaxed text-[#4a5068]">
                {result.answer}
              </p>
            )}

            {/* Result cards */}
            {result.results.length > 0 ? (
              <div className="space-y-3">
                {result.results.slice(0, 3).map((entity) => {
                  // Determine entity type
                  if ('booking_enabled' in entity) {
                    return (
                      <div key={entity.id} className="relative">
                        <BusinessCard business={entity as Business} />
                        <button
                          onClick={() =>
                            router.push(`/businesses/${entity.id}`)
                          }
                          className="absolute right-4 top-4 rounded-lg bg-[#00d4ff] px-3 py-1 text-[10px] font-semibold text-[#0a0b0f]"
                        >
                          Select
                        </button>
                      </div>
                    );
                  }
                  if ('start_time' in entity) {
                    return (
                      <div key={entity.id} className="relative">
                        <EventCard event={entity as Event} />
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-[#4a5068]">
                  No trusted results found for your query.
                </p>
                <p className="mt-1 text-xs text-[#4a5068]">
                  Try a different question or expand your area.
                </p>
              </div>
            )}

            {/* Suggested actions */}
            {result.suggested_actions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {result.suggested_actions.map((action) => (
                  <button
                    key={action}
                    onClick={() => handleExample(action)}
                    className="rounded-full border border-[#00d4ff]/30 bg-[#00d4ff]/5 px-3 py-1.5 text-[11px] text-[#00d4ff]"
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}

            {/* Ask again */}
            <button
              onClick={() => {
                setResult(null);
                setQuery('');
              }}
              className="text-xs text-[#4a5068]"
            >
              ← Ask something else
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
