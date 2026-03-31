'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, CheckCircle, Bot, ChevronRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocationStore } from '@/stores/locationStore';
import BusinessCard from '@/components/cards/BusinessCard';
import EventCard from '@/components/cards/EventCard';
import type { AskGaoResponse, Business, Event } from '@/types';

const EXAMPLES = [
  'Recommend something to eat nearby',
  'Best nail salon open now',
  'Any tech events tonight?',
  'Find trusted spa near me',
  'Active startup circles nearby',
];

export default function AskGaoPage() {
  const router = useRouter();
  const { lat, lng } = useLocationStore();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskGaoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ query: finalQuery, context: { lat: lat ?? 32.7767, lng: lng ?? -96.797 } }),
      });
      if (!res.ok) throw new Error('Failed');
      const data: AskGaoResponse = await res.json();
      setResult(data);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExample = (ex: string) => { setQuery(ex); handleAsk(ex); };

  return (
    <div className="flex h-full flex-col overflow-y-auto pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top,12px)+24px)] lg:pt-6 pb-4">
        <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#4a5068] hover:bg-[#111318] cursor-pointer">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-[#f0f4ff]">Ask Gao</h1>
      </div>

      {/* ── Hero (before results) ─────────────────────── */}
      {!result && !loading && (
        <div className="flex-1 flex flex-col px-4 lg:px-8 max-w-lg lg:max-w-xl lg:mx-auto">
          {/* Bot illustration */}
          <div className="flex flex-col items-center py-8">
            <div className="relative mb-6">
              {/* Glow */}
              <div className="absolute inset-0 scale-150 rounded-full opacity-30 blur-3xl" style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.3), rgba(167,139,250,0.2), transparent)' }} />
              {/* Bot avatar */}
              <div className="relative h-24 w-24 rounded-3xl flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(167,139,250,0.15))', border: '1px solid rgba(0,212,255,0.15)' }}>
                <Bot size={40} className="text-[#00d4ff]" />
                {/* Verified badge */}
                <div className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full flex items-center justify-center" style={{ background: '#00d4ff' }}>
                  <CheckCircle size={14} className="text-[#0a0b0f]" />
                </div>
              </div>
            </div>

            <h2 className="text-xl font-bold text-white mb-2">Ask Gao</h2>
            <p className="text-sm text-[#a3adc3] text-center leading-relaxed max-w-xs">
              Ask our AI assistant Gao to help with anything nearby.
            </p>
          </div>

          {/* Suggestion chips */}
          <div className="space-y-2 mb-6">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => handleExample(ex)}
                className="flex items-center gap-3 w-full rounded-xl px-4 py-3 text-left transition-colors cursor-pointer"
                style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
              >
                <CheckCircle size={14} className="text-[#00d4ff] shrink-0" />
                <span className="text-sm text-[#a3adc3] flex-1">{ex}</span>
                <ChevronRight size={14} className="text-[#4a5068]" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input (always visible at bottom when no result) ── */}
      {!result && !loading && (
        <div className="px-4 lg:px-8 max-w-lg lg:max-w-xl lg:mx-auto w-full">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-[#4a5068]"
              style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAsk(); } }}
            />
            <button
              onClick={() => handleAsk()}
              disabled={!query.trim()}
              className="rounded-xl px-4 cursor-pointer disabled:opacity-30"
              style={{ background: '#00d4ff', color: '#0a0b0f' }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Loading ───────────────────────────────────── */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles size={32} className="text-[#00d4ff]" />
          </motion.div>
          <p className="text-sm text-[#a3adc3]">Gao is looking for trusted options…</p>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────── */}
      {error && (
        <div className="px-4 py-8">
          <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <p className="text-sm text-[#f87171]">{error}</p>
            <button onClick={() => handleAsk()} className="mt-2 text-xs text-[#00d4ff] cursor-pointer">Try again</button>
          </div>
        </div>
      )}

      {/* ── Results ───────────────────────────────────── */}
      {result && (
        <div className="flex-1 px-4 lg:px-8 max-w-lg lg:max-w-xl lg:mx-auto space-y-4">
          {/* Answer */}
          {result.answer && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(0,212,255,0.15)' }}>
                <Bot size={16} className="text-[#00d4ff]" />
              </div>
              <p className="text-sm text-[#a3adc3] leading-relaxed pt-1">{result.answer}</p>
            </div>
          )}

          {/* Result cards */}
          {result.results.length > 0 && (
            <div className="space-y-3">
              {result.results.slice(0, 5).map((entity) => {
                if ('booking_enabled' in entity) return <BusinessCard key={entity.id} business={entity as Business} />;
                if ('start_time' in entity) return <EventCard key={entity.id} event={entity as Event} />;
                return null;
              })}
            </div>
          )}

          {/* Suggested follow-ups */}
          {result.suggested_actions.length > 0 && (
            <div className="space-y-1.5">
              {result.suggested_actions.map((action) => (
                <button key={action} onClick={() => handleExample(action)} className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-left text-xs text-[#00d4ff] cursor-pointer" style={{ background: 'rgba(0,212,255,0.05)' }}>
                  <ChevronRight size={12} /> {action}
                </button>
              ))}
            </div>
          )}

          {/* Ask again */}
          <div className="flex gap-2 pt-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask follow-up..."
              className="flex-1 rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-[#4a5068]"
              style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAsk(); } }}
            />
            <button onClick={() => handleAsk()} disabled={!query.trim()} className="rounded-xl px-4 cursor-pointer disabled:opacity-30" style={{ background: '#00d4ff', color: '#0a0b0f' }}>
              <Send size={16} />
            </button>
          </div>

          <button onClick={() => { setResult(null); setQuery(''); }} className="text-xs text-[#4a5068] cursor-pointer">
            ← New conversation
          </button>
        </div>
      )}
    </div>
  );
}
