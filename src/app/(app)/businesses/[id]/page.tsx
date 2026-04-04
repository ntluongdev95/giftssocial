'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Bookmark, ChevronDown, MessageCircle } from 'lucide-react';
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
    <div className="flex h-full flex-col overflow-y-auto pb-24">
      {/* Hero */}
      <div className="relative flex h-[200px] items-center justify-center bg-gradient-to-b from-[#0a0b0f] to-[#111318]">
        <span className="text-6xl">{catIcon}</span>

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute left-4 top-[calc(env(safe-area-inset-top,44px)+4px)] flex h-8 w-8 items-center justify-center rounded-full bg-[#0a0b0f]/60 backdrop-blur"
        >
          <ArrowLeft size={16} className="text-[#f0f4ff]" />
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4 px-4 pt-4">
        {/* Name + status */}
        <div>
          <h1 className="text-2xl font-bold text-[#f0f4ff]">{business.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-full bg-[#111318] px-2 py-0.5 text-[10px] font-medium text-[#4a5068]">
              {business.category}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
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
            <p className="text-xs leading-relaxed text-[#f0f4ff]/70">
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

      {/* Sticky CTA */}
      <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-[#181c24]/20 bg-[#0a0b0f]/95 px-4 py-3 backdrop-blur-xl">
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
