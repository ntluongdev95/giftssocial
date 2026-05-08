'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, User } from 'lucide-react';
import { format, addMinutes, startOfHour, addHours } from 'date-fns';
import TrustLevelPill from '@/components/trust/TrustLevelPill';
import TrustBadgeRow from '@/components/trust/TrustBadgeRow';
import { useAuthStore } from '@/stores/auth-store';
import type { Business } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────

interface BookingModalProps {
  businessId: string;
  business: Business;
  onClose: () => void;
}

type Step = 'time' | 'confirm' | 'success';

// ─── Generate time slots ──────────────────────────────────────────────────

function generateSlots(): Date[] {
  const now = new Date();
  const start = addHours(startOfHour(now), 1);
  const slots: Date[] = [];
  for (let i = 0; i < 12; i++) {
    slots.push(addMinutes(start, i * 30));
  }
  return slots;
}

// ─── Sign-in gate ─────────────────────────────────────────────────────────

function SignInGate({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#00d4ff]/10">
        <User size={28} className="text-[#00d4ff]" />
      </div>
      <h2 className="text-lg font-bold text-[#f0f4ff]">Sign in to book</h2>
      <p className="max-w-xs text-sm text-[#4a5068]">
        You need an account to make a booking.
      </p>
      <button
        onClick={() => {
          onClose();
          router.push('/auth');
        }}
        className="rounded-xl bg-[#00d4ff] px-8 py-2.5 text-sm font-semibold text-[#0a0b0f]"
      >
        Sign In
      </button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────

export default function BookingModal({
  businessId,
  business,
  onClose,
}: BookingModalProps) {
  const { user } = useAuthStore();
  const router = useRouter();

  const [step, setStep] = useState<Step>('time');
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const slots = generateSlots();

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setSubmitting(true);

    try {
      await fetch('/api/v1/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          timeslot: selectedSlot.toISOString(),
          party_size: partySize,
          notes: notes || undefined,
        }),
      });
      setStep('success');
    } catch {
      // stay on confirm step
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-50 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-[#181c24]/30 bg-[#0a0b0f] backdrop-blur-xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        {/* Handle + close */}
        <div className="flex items-center justify-between px-4 pt-3">
          <div className="h-1 w-10 rounded-full bg-[#181c24]" />
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#4a5068] hover:bg-[#111318]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 pb-8 pt-2">
          {/* Auth gate */}
          {!user ? (
            <SignInGate onClose={onClose} />
          ) : (
            <AnimatePresence mode="wait">
              {/* ─── Step 1: Select Time ──────────────── */}
              {step === 'time' && (
                <motion.div
                  key="time"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                >
                  <h2 className="text-lg font-bold text-[#f0f4ff]">
                    Book at {business.name}
                  </h2>
                  <p className="mb-4 text-xs text-[#4a5068]">
                    Select a time slot
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((slot) => {
                      const active =
                        selectedSlot?.getTime() === slot.getTime();
                      return (
                        <button
                          key={slot.toISOString()}
                          onClick={() => setSelectedSlot(slot)}
                          className={`rounded-lg py-2.5 text-sm font-medium transition-colors ${
                            active
                              ? 'border border-[#00d4ff] bg-[#00d4ff]/15 text-[#00d4ff]'
                              : 'border border-[#181c24]/30 bg-[#111318]/40 text-[#f0f4ff] hover:bg-[#111318]/60'
                          }`}
                        >
                          {format(slot, 'h:mm a')}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setStep('confirm')}
                    disabled={!selectedSlot}
                    className="mt-5 w-full rounded-xl bg-[#00d4ff] py-3 text-sm font-semibold text-[#0a0b0f] transition-colors hover:bg-[#00d4ff]/80 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next →
                  </button>
                </motion.div>
              )}

              {/* ─── Step 2: Confirm Details ─────────── */}
              {step === 'confirm' && selectedSlot && (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  className="space-y-4"
                >
                  <div>
                    <h2 className="text-lg font-bold text-[#f0f4ff]">
                      Confirm Booking
                    </h2>
                    <button
                      onClick={() => setStep('time')}
                      className="text-xs text-[#00d4ff]"
                    >
                      ← Change time
                    </button>
                  </div>

                  {/* Selected time */}
                  <div className="rounded-lg border border-[#181c24]/20 bg-[#0a0b0f] px-3 py-2 text-sm text-[#f0f4ff]">
                    {format(selectedSlot, 'EEEE, MMM d · h:mm a')}
                  </div>

                  {/* Party size */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4a5068]">
                      Party size
                    </label>
                    <div className="flex overflow-hidden rounded-lg border border-[#181c24]/30">
                      {[1, 2, 3, 4].map((n) => (
                        <button
                          key={n}
                          onClick={() => setPartySize(n)}
                          className={`flex-1 py-2 text-sm font-medium transition-colors ${
                            partySize === n
                              ? 'bg-[#00d4ff]/15 text-[#00d4ff]'
                              : 'bg-[#0a0b0f] text-[#4a5068]'
                          }`}
                        >
                          {n === 4 ? '4+' : n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4a5068]">
                      Notes <span className="text-[#4a5068]">(optional)</span>
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any special requests…"
                      rows={2}
                      className="w-full resize-none rounded-lg border border-[#181c24]/30 bg-[#0a0b0f] px-3 py-2 text-sm text-[#f0f4ff] placeholder-[#4a5068] outline-none focus:border-[#00d4ff]"
                    />
                  </div>

                  {/* Summary card */}
                  <div className="rounded-xl border border-[#181c24]/20 bg-[#111318]/40 p-4">
                    <p className="text-sm font-semibold text-[#f0f4ff]">
                      {business.name}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <TrustLevelPill
                        level={business.trust_level}
                        score={business.trust_score}
                        size="sm"
                      />
                      <TrustBadgeRow badges={business.badges} maxVisible={2} />
                    </div>
                    <p className="mt-2 text-xs text-[#4a5068]">
                      {format(selectedSlot, 'EEEE, MMM d · h:mm a')} ·{' '}
                      {partySize} {partySize === 1 ? 'person' : 'people'}
                    </p>
                  </div>

                  {/* Confirm */}
                  <button
                    onClick={handleConfirm}
                    disabled={submitting}
                    className="w-full rounded-xl bg-[#00d4ff] py-3 text-sm font-semibold text-[#0a0b0f] transition-colors hover:bg-[#00d4ff]/80 disabled:opacity-40"
                  >
                    {submitting ? 'Confirming…' : 'Confirm Booking'}
                  </button>
                </motion.div>
              )}

              {/* ─── Step 3: Success ─────────────────── */}
              {step === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-4 py-8 text-center"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00d4ff]/15">
                    <Check size={32} className="text-[#00d4ff]" />
                  </div>
                  <h2 className="text-xl font-bold text-[#f0f4ff]">
                    Booking requested
                  </h2>
                  <p className="text-sm text-[#4a5068]">
                    You&apos;ll be notified when confirmed.
                  </p>

                  <div className="flex w-full flex-col gap-2 pt-4">
                    <button
                      onClick={() => {
                        onClose();
                        router.push('/me');
                      }}
                      className="w-full rounded-xl bg-[#00d4ff] py-2.5 text-sm font-semibold text-[#0a0b0f]"
                    >
                      View Booking
                    </button>
                    <button
                      onClick={onClose}
                      className="w-full rounded-xl border border-[#181c24] py-2.5 text-sm font-medium text-[#f0f4ff]"
                    >
                      Message Business
                    </button>
                    <button
                      onClick={() => {
                        onClose();
                        router.push('/nearby');
                      }}
                      className="text-sm text-[#4a5068]"
                    >
                      Back to Nearby
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </>
  );
}
