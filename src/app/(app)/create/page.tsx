'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, MapPin, Shield, Clock, User } from 'lucide-react';
import SignalTypeSelector from '@/components/signals/SignalTypeSelector';
import PresenceForm from '@/components/signals/forms/PresenceForm';
import IntentForm from '@/components/signals/forms/IntentForm';
import OfferForm from '@/components/signals/forms/OfferForm';
import EventForm from '@/components/signals/forms/EventForm';
import UpdateForm from '@/components/signals/forms/UpdateForm';
import ProofForm from '@/components/signals/forms/ProofForm';
import { useAuthStore } from '@/stores/auth-store';
import { useLocationStore } from '@/stores/locationStore';
import { SIGNAL_LABELS, SIGNAL_ICONS } from '@/styles/tokens';
import type { SignalType } from '@/types';

// ─── State machine ────────────────────────────────────────────────────────

type Step = 'type_select' | 'form' | 'preview' | 'publishing' | 'success';

const pageVariants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

// ─── Sign-in gate ─────────────────────────────────────────────────────────

function SignInGateSheet() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00d4ff]/10">
        <User size={32} className="text-[#00d4ff]" />
      </div>
      <h2 className="text-lg font-bold text-[#f0f4ff]">Sign in to create</h2>
      <p className="max-w-xs text-sm text-[#4a5068]">
        You need an account to publish signals on the map.
      </p>
      <button
        onClick={() => router.push('/auth')}
        className="rounded-xl bg-[#00d4ff] px-8 py-3 text-sm font-semibold text-[#0a0b0f]"
      >
        Sign In
      </button>
      <button
        onClick={() => router.back()}
        className="text-sm text-[#4a5068]"
      >
        Go back
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function CreateSignalPage() {
  const router = useRouter();
  const { user, isGuest } = useAuthStore();
  const { lat, lng } = useLocationStore();

  const [step, setStep] = useState<Step>('type_select');
  const [signalType, setSignalType] = useState<SignalType | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown> | null>(null);

  // Auth gate
  if (!user && !isGuest) {
    // Not logged in at all — show gate
  }
  const needsAuth = !user;

  if (needsAuth && step !== 'type_select') {
    return (
      <div className="h-full overflow-y-auto px-4 pt-[env(safe-area-inset-top,12px)]">
        <SignInGateSheet />
      </div>
    );
  }

  const handleTypeSelect = (type: SignalType) => {
    setSignalType(type);
    if (needsAuth) {
      // Show gate on next step
    }
    setStep('form');
  };

  const handleFormSubmit = async (data: Record<string, unknown>) => {
    setFormData(data);
    setStep('preview');
  };

  const handlePublish = async () => {
    if (!signalType || !formData) return;

    setStep('publishing');

    try {
      await fetch('/api/v1/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: signalType,
          ...formData,
          location: {
            type: 'Point',
            coordinates: [lng ?? -96.797, lat ?? 32.7767],
          },
        }),
      });
      setStep('success');
    } catch {
      setStep('preview');
    }
  };

  const renderForm = () => {
    switch (signalType) {
      case 'presence':
        return <PresenceForm onSubmit={handleFormSubmit as never} />;
      case 'offer':
        return <OfferForm onSubmit={handleFormSubmit as never} />;
      case 'event':
        return <EventForm onSubmit={handleFormSubmit as never} />;
      case 'proof':
        return <ProofForm onSubmit={handleFormSubmit as never} />;
      case 'intent':
        return <IntentForm onSubmit={handleFormSubmit as never} />;
      case 'update':
        return <UpdateForm onSubmit={handleFormSubmit as never} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto pb-20 relative">
      {/* Aurora */}
      <div className="aurora-gradient absolute inset-x-0 top-0 h-48 pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center gap-3 px-4 lg:px-8 pt-[env(safe-area-inset-top,12px)] lg:pt-6">
        {step !== 'type_select' && step !== 'success' && (
          <button
            onClick={() => {
              if (step === 'form') setStep('type_select');
              else if (step === 'preview') setStep('form');
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#4a5068] transition-colors hover:bg-[#111318]"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <h1 className="text-lg font-bold text-[#f0f4ff]">
          {step === 'type_select' && 'Create Signal'}
          {step === 'form' && signalType && SIGNAL_LABELS[signalType]}
          {step === 'preview' && 'Preview'}
          {step === 'publishing' && 'Publishing…'}
          {step === 'success' && 'Published!'}
        </h1>
      </div>

      {/* Content */}
      <div className="relative flex-1 px-4 lg:px-8 pt-4 max-w-2xl lg:mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* Step 1: Type select */}
          {step === 'type_select' && (
            <motion.div
              key="type_select"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              <p className="mb-4 text-sm text-[#4a5068]">
                What would you like to share?
              </p>
              <SignalTypeSelector onSelect={handleTypeSelect} selected={signalType ?? undefined} />
            </motion.div>
          )}

          {/* Step 2: Form */}
          {step === 'form' && (
            <motion.div
              key="form"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              {renderForm()}
            </motion.div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && signalType && (
            <motion.div
              key="preview"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Preview card */}
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{SIGNAL_ICONS[signalType]}</span>
                  <div>
                    <p className="text-sm font-semibold text-[#f0f4ff]">
                      {(formData?.title as string) || SIGNAL_LABELS[signalType]}
                    </p>
                    <p className="text-xs text-[#4a5068]">
                      {signalType} · {(formData?.category as string) || 'general'}
                    </p>
                  </div>
                </div>
                {typeof formData?.note === 'string' && formData.note && (
                  <p className="mt-2 text-sm text-[#f0f4ff]/80">
                    {formData.note}
                  </p>
                )}
              </div>

              {/* Auto-attach info */}
              <div className="space-y-2 rounded-xl p-4" style={{ background: 'rgba(10,11,15,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <p className="text-xs font-medium text-[#4a5068]">
                  Auto-attached
                </p>
                <div className="flex items-center gap-2 text-xs text-[#f0f4ff]/70">
                  <MapPin size={12} className="text-[#00d4ff]" />
                  Location: {lat?.toFixed(4)}, {lng?.toFixed(4)}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#f0f4ff]/70">
                  <User size={12} className="text-[#00d4ff]" />
                  Identity: {user?.gao_domain || user?.email || 'Guest'}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#f0f4ff]/70">
                  <Shield size={12} className="text-[#00d4ff]" />
                  Trust snapshot: {user?.trust_score ?? 0}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#f0f4ff]/70">
                  <Clock size={12} className="text-[#00d4ff]" />
                  Expires: {(formData?.duration as number) || 2}h
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('form')}
                  className="flex-1 rounded-xl py-3 text-sm font-medium transition-colors"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#a3adc3' }}
                >
                  Edit
                </button>
                <button
                  onClick={handlePublish}
                  className="btn-primary flex-1 rounded-xl py-3 text-sm font-semibold"
                >
                  Publish Signal
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Publishing */}
          {step === 'publishing' && (
            <motion.div
              key="publishing"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="flex flex-col items-center gap-4 py-20"
            >
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#111318] border-t-[#00d4ff]" />
              <p className="text-sm text-[#4a5068]">Publishing your signal…</p>
            </motion.div>
          )}

          {/* Step 5: Success */}
          {step === 'success' && (
            <motion.div
              key="success"
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="flex flex-col items-center gap-4 py-16 text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#22C55E]/15">
                <Check size={32} className="text-[#22C55E]" />
              </div>
              <h2 className="text-xl font-bold text-[#f0f4ff]">
                Signal published!
              </h2>
              <p className="text-sm text-[#4a5068]">
                Your signal is live on the map
              </p>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => router.push('/world')}
                  className="rounded-xl bg-[#00d4ff] px-6 py-3 text-sm font-semibold text-[#0a0b0f]"
                >
                  View on Map
                </button>
                <button
                  onClick={() => {
                    setStep('type_select');
                    setSignalType(null);
                    setFormData(null);
                  }}
                  className="rounded-xl border border-[#181c24] px-6 py-3 text-sm font-medium text-[#f0f4ff]"
                >
                  Create Another
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
