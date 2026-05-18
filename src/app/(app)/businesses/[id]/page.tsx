'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Bookmark, ChevronDown, MessageCircle, MapPin, Star } from 'lucide-react';
import TrustLevelPill from '@/components/trust/TrustLevelPill';
import TrustBadgeRow from '@/components/trust/TrustBadgeRow';
import OfferCard from '@/components/cards/OfferCard';
import BookingModal from '@/components/booking/BookingModal';
import type { Business, Signal, Proof } from '@/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Hours Accordion ──────────────────────────────────────────────────────

const DAY_LABELS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_NAMES: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

function HoursAccordion({ hours }: { hours: Record<string, { open?: string; close?: string; closed?: boolean }> }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[#181c24]/20 bg-[#0a0b0f]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[#f0f4ff]"
      >
        Hours
        <ChevronDown
          size={16}
          className={`text-[#4a5068] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="space-y-1 px-4 pb-3">
          {DAY_LABELS.map((day) => {
            const slot = hours[day];
            return (
              <div key={day} className="flex justify-between text-xs">
                <span className="text-[#4a5068]">{DAY_NAMES[day]}</span>
                <span className="text-[#f0f4ff]/80">
                  {slot && !slot.closed ? `${slot.open || ''} – ${slot.close || ''}` : 'Closed'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Proof Item ───────────────────────────────────────────────────────────

function ProofItem({ proof }: { proof: Proof }) {
  return (
    <div className="border-b border-[#181c24]/15 py-3 last:border-0">
      <div className="flex items-center gap-2">
        {proof.rating && (
          <span className="text-sm text-[#EAB308]">
            {'★'.repeat(proof.rating)}
            {'☆'.repeat(5 - proof.rating)}
          </span>
        )}
        <span className="text-[10px] text-[#4a5068]">
          {formatDistanceToNow(new Date(proof.created_at), { addSuffix: true })}
        </span>
      </div>
      {proof.review && (
        <p className="mt-1 text-xs leading-relaxed text-[#f0f4ff]/70">
          {proof.review}
        </p>
      )}
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-[200px] bg-gradient-to-b from-[#0a0b0f] to-[#111318]" />
      <div className="space-y-3 p-4">
        <div className="h-6 w-3/4 rounded bg-[#181c24]/30" />
        <div className="h-4 w-1/2 rounded bg-[#181c24]/20" />
        <div className="h-4 w-2/3 rounded bg-[#181c24]/20" />
        <div className="mt-6 h-10 rounded-xl bg-[#181c24]/20" />
      </div>
    </div>
  );
}

// ─── 404 ──────────────────────────────────────────────────────────────────

function NotFound() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <p className="text-lg font-bold text-[#f0f4ff]">Business not found</p>
      <p className="text-sm text-[#4a5068]">
        This business may have been removed or doesn&apos;t exist.
      </p>
      <button
        onClick={() => router.push('/nearby')}
        className="rounded-xl bg-[#00d4ff] px-6 py-2.5 text-sm font-semibold text-[#0a0b0f]"
      >
        Back to Nearby
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function BusinessDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [showBooking, setShowBooking] = useState(false);

  const { data: bizData, isLoading: bizLoading } = useSWR<{ data: Business }>(
    `/api/v1/businesses/${id}`,
    fetcher
  );

  const { data: signalsData } = useSWR<{ data: Signal[] }>(
    `/api/v1/businesses/${id}/signals`,
    fetcher
  );

  const { data: proofsData } = useSWR<{ data: Proof[] }>(
    `/api/v1/businesses/${id}/proofs`,
    fetcher
  );

  if (bizLoading) return <Skeleton />;

  const business = bizData?.data;
  if (!business) return <NotFound />;

  const signals = signalsData?.data ?? [];
  const proofs = proofsData?.data ?? [];
  const offers = signals.filter((s) => s.type === 'offer');

  // Category icon map
  const categoryIcons: Record<string, string> = {
    beauty: '💅',
    food: '🍔',
    fitness: '💪',
    dental: '🦷',
    health: '🏥',
    retail: '🛍',
    services: '🔧',
    tech: '💻',
  };
  const catIcon = categoryIcons[business.category.toLowerCase()] || '🏢';

  return (
    <div className="flex h-full flex-col overflow-y-auto pb-24 lg:pb-12">
      {/* Mobile back button — overlays the hero on small screens. */}
      <button
        onClick={() => router.back()}
        className="lg:hidden absolute left-4 top-[calc(env(safe-area-inset-top,44px)+4px)] z-30 flex h-9 w-9 items-center justify-center rounded-full bg-[#0a0b0f]/60 backdrop-blur"
      >
        <ArrowLeft size={16} className="text-[#f0f4ff]" />
      </button>

      {/* Desktop back nav — sticky bar so it doesn't fight with the hero. */}
      <div className="hidden lg:block lg:max-w-6xl lg:mx-auto lg:w-full lg:px-8 lg:pt-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-[#a3adc3] hover:text-white cursor-pointer transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      {/* MOBILE-ONLY hero strip — keeps the existing emoji card. */}
      <div className="lg:hidden relative flex h-[200px] items-center justify-center bg-gradient-to-b from-[#0a0b0f] to-[#111318]">
        <span className="text-6xl">{catIcon}</span>
      </div>

      {/* Desktop: 2-column grid. Mobile: stacks under the hero. */}
      <div className="lg:max-w-6xl lg:mx-auto lg:w-full lg:px-8 lg:pt-4 lg:grid lg:grid-cols-[420px_1fr] lg:gap-8">
        {/* ─── LEFT (desktop sticky): hero card + booking sidebar ─── */}
        <aside className="hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-6 lg:self-start">
          <div className="relative flex h-[320px] items-center justify-center rounded-3xl bg-gradient-to-b from-[#0a0b0f] to-[#111318] overflow-hidden border border-[rgba(0,212,255,0.08)]">
            <span className="text-8xl select-none">{catIcon}</span>
          </div>

          {/* Sticky booking card */}
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{
              background: 'rgba(17,19,24,0.6)',
              border: '1px solid rgba(0,212,255,0.1)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white">Book a slot</div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  business.open_now
                    ? 'bg-[#22C55E]/15 text-[#22C55E]'
                    : 'bg-[#EF4444]/15 text-[#EF4444]'
                }`}
              >
                {business.open_now ? 'Open now' : 'Closed'}
              </span>
            </div>
            <button
              onClick={() => setShowBooking(true)}
              className="w-full rounded-xl bg-[#00d4ff] py-3 text-sm font-bold text-[#0a0b0f] hover:bg-[#00d4ff]/90 transition-colors cursor-pointer"
            >
              Book Now
            </button>
            <div className="flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[#181c24] py-2.5 text-sm font-medium text-[#f0f4ff] hover:bg-[#111318] transition-colors cursor-pointer">
                <MessageCircle size={14} /> Chat
              </button>
              <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#181c24] text-[#4a5068] hover:bg-[#111318] transition-colors cursor-pointer">
                <Bookmark size={14} />
              </button>
            </div>

            {/* Quick facts */}
            <div className="pt-3 mt-1 space-y-2 border-t border-white/5">
              {business.address && (
                <div className="flex items-start gap-2 text-xs text-[#a3adc3]">
                  <MapPin size={12} className="text-[#4a5068] mt-0.5 shrink-0" />
                  <span className="leading-snug">{business.address}</span>
                </div>
              )}
              {business.rating_avg && (
                <div className="flex items-center gap-2 text-xs text-[#a3adc3]">
                  <Star size={12} className="text-[#fbbf24]" fill="#fbbf24" />
                  <span>
                    {business.rating_avg} · {business.proof_count} proofs
                  </span>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ─── RIGHT (main content) ─── */}
        <div className="space-y-4 px-4 pt-4 lg:px-0 lg:pt-0">
          {/* Name + status */}
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[#f0f4ff]">{business.name}</h1>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="rounded-full bg-[#111318] px-2 py-0.5 text-[10px] font-medium text-[#4a5068]">
                {business.category}
              </span>
              <span
                className={`lg:hidden rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  business.open_now
                    ? 'bg-[#22C55E]/15 text-[#22C55E]'
                    : 'bg-[#EF4444]/15 text-[#EF4444]'
                }`}
              >
                {business.open_now ? '🟢 Open now' : '🔴 Closed'}
              </span>
            </div>
          </div>

          {/* Trust row */}
          <div className="flex flex-wrap items-center gap-2">
            <TrustLevelPill
              level={business.trust_level}
              score={business.trust_score}
            />
            <TrustBadgeRow badges={business.badges} />
            <span className="text-xs text-[#4a5068]">
              {business.proof_count} proofs
              {business.rating_avg ? ` · ★ ${business.rating_avg}` : ''}
              {business.rating_count > 0
                ? ` · ${Math.round(
                    ((business.rating_count - 0) / business.rating_count) * 100
                  )}% completion`
                : ''}
            </span>
          </div>

          {/* Active offers */}
          {offers.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-[#f0f4ff]">
                Active Offers
              </h2>
              <div className="space-y-2">
                {offers.map((s) => (
                  <OfferCard
                    key={s.id}
                    signal={s}
                    businessName={business.name}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Hours */}
          {business.hours && Object.keys(business.hours).length > 0 && (
            <HoursAccordion hours={business.hours} />
          )}

          {/* Description */}
          {business.description && (
            <div>
              <h2 className="mb-1 text-sm font-semibold text-[#f0f4ff]">
                About
              </h2>
              <p className="text-sm leading-relaxed text-[#f0f4ff]/70">
                {business.description}
              </p>
            </div>
          )}

          {/* Recent Proofs */}
          {proofs.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-[#f0f4ff]">
                Recent Proofs
              </h2>
              <div className="rounded-xl border border-[#181c24]/20 bg-[#0a0b0f] px-4">
                {proofs.slice(0, 5).map((p) => (
                  <ProofItem key={p.id} proof={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE-only sticky bottom CTA. Desktop uses the sidebar card. */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-40 border-t border-[#181c24]/20 bg-[#0a0b0f]/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex gap-2">
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#181c24] py-2.5 text-sm font-medium text-[#f0f4ff] transition-colors hover:bg-[#111318]">
            <MessageCircle size={16} />
            Chat
          </button>
          <button
            onClick={() => setShowBooking(true)}
            className="flex flex-[2] items-center justify-center rounded-xl bg-[#00d4ff] py-2.5 text-sm font-semibold text-[#0a0b0f] transition-colors hover:bg-[#00d4ff]/80"
          >
            Book
          </button>
          <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#181c24] text-[#4a5068] transition-colors hover:bg-[#111318]">
            <Bookmark size={16} />
          </button>
        </div>
      </div>

      {/* Booking Modal */}
      {showBooking && (
        <BookingModal
          businessId={id}
          business={business}
          onClose={() => setShowBooking(false)}
        />
      )}
    </div>
  );
}
