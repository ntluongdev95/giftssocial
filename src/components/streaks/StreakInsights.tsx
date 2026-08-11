'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, TrendingUp, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { parseUTC } from '@/lib/date';

type Props = {
  streakId: string;
  initialBenefits: string | null;
  initialRisks: string | null;
  initialGeneratedAt: string | null;
  /** Called after a fresh generation so the parent can SWR-refetch and
   *  drop the new values into its detail object. */
  onRefresh: () => void;
};

/** Two-card insights panel — "Why it matters" benefits + "If you skip..."
 *  risks. Pulls AI-generated content from `/api/v1/streaks/[id]/insights`,
 *  auto-firing on mount when both fields are empty. The Regenerate button
 *  forces a refresh for habits whose meaning evolved. */
export function StreakInsights({
  streakId,
  initialBenefits,
  initialRisks,
  initialGeneratedAt,
  onRefresh,
}: Props) {
  const [benefits, setBenefits] = useState(initialBenefits);
  const [risks, setRisks] = useState(initialRisks);
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [loading, setLoading] = useState(false);
  const triedAutoFetch = useRef(false);

  const [unavailable, setUnavailable] = useState(false);

  async function fetchInsights(refresh = false) {
    setLoading(true);
    setUnavailable(false);
    try {
      const url = `/api/v1/streaks/${streakId}/insights${refresh ? '?refresh=1' : ''}`;
      const res = await fetch(url, { method: 'POST', credentials: 'same-origin' });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        // 503 + ai_not_configured = server hasn't set ANTHROPIC_API_KEY.
        // Hide the section quietly instead of yelling at every viewer.
        if (res.status === 503 && err?.error?.code === 'ai_not_configured') {
          setUnavailable(true);
          return;
        }
        throw new Error(err?.error?.message || 'Failed to generate');
      }
      const json = (await res.json()) as {
        data: { benefits: string; risks: string; generated_at: string; cached: boolean };
      };
      setBenefits(json.data.benefits);
      setRisks(json.data.risks);
      setGeneratedAt(json.data.generated_at);
      if (refresh) toast.success('Insights regenerated');
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  // Auto-fetch once on mount when we have nothing cached. Guarded by ref so
  // React 18 strict-mode double-invokes don't fire twice.
  useEffect(() => {
    if (!triedAutoFetch.current && !benefits && !risks) {
      triedAutoFetch.current = true;
      fetchInsights(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generatedAgo = (() => {
    if (!generatedAt) return null;
    const d = parseUTC(generatedAt);
    return d ? formatDistanceToNow(d, { addSuffix: true }) : null;
  })();

  // If the server has no AI key configured we just hide the whole panel.
  // Better than showing a dead spinner or yelling at the user.
  if (unavailable) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] flex items-center gap-1.5">
          <Sparkles size={11} className="text-[#a855f7]" />
          Why it matters
        </h3>
        {(benefits || risks) && (
          <button
            onClick={() => fetchInsights(true)}
            disabled={loading}
            className="text-[10px] text-[#4a5068] hover:text-[#a3adc3] cursor-pointer flex items-center gap-1 disabled:opacity-50"
            aria-label="Regenerate insights"
          >
            {loading ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <RefreshCw size={10} />
            )}
            Regenerate
          </button>
        )}
      </div>

      {/* Initial loading state — no content yet */}
      {loading && !benefits && !risks && (
        <div
          className="rounded-2xl p-6 flex items-center gap-3"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(0,212,255,0.04))',
            border: '1px solid rgba(168,85,247,0.18)',
          }}
        >
          <Loader2 size={16} className="animate-spin text-[#a855f7]" />
          <div className="text-xs text-[#a3adc3]">
            Generating personalised insights for this habit...
          </div>
        </div>
      )}

      {/* 2-col grid on lg+ so both benefits + risks sit side-by-side */}
      {(benefits || risks) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
          {/* Benefits */}
          <div
            className="rounded-2xl p-4 lg:p-5"
            style={{
              background:
                'linear-gradient(135deg, rgba(52,211,153,0.06), rgba(0,212,255,0.03))',
              border: '1px solid rgba(52,211,153,0.2)',
            }}
          >
            <div className="flex items-center gap-2 mb-2 lg:mb-3">
              <div
                className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}
              >
                <TrendingUp size={14} className="text-[#34d399]" />
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#34d399]">
                What you gain
              </div>
            </div>
            {benefits ? (
              <p className="text-sm text-[#e5e7eb] leading-relaxed">{benefits}</p>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#4a5068]">
                <Loader2 size={12} className="animate-spin" />
                Loading...
              </div>
            )}
          </div>

          {/* Risks */}
          <div
            className="rounded-2xl p-4 lg:p-5"
            style={{
              background:
                'linear-gradient(135deg, rgba(248,113,113,0.05), rgba(251,191,36,0.03))',
              border: '1px solid rgba(248,113,113,0.2)',
            }}
          >
            <div className="flex items-center gap-2 mb-2 lg:mb-3">
              <div
                className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)' }}
              >
                <AlertTriangle size={14} className="text-[#fca5a5]" />
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#fca5a5]">
                If you skip
              </div>
            </div>
            {risks ? (
              <p className="text-sm text-[#e5e7eb] leading-relaxed">{risks}</p>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#4a5068]">
                <Loader2 size={12} className="animate-spin" />
                Loading...
              </div>
            )}
          </div>
        </div>
      )}

      {generatedAgo && (
        <p className="text-[10px] text-[#2d3548] mt-2 text-right">
          AI-generated · {generatedAgo}
        </p>
      )}
    </section>
  );
}
