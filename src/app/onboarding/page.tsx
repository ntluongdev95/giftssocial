'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { useLocationStore } from '@/stores/locationStore';
import { useAuthStore } from '@/stores/auth-store';

// ─── Constants ────────────────────────────────────────────────────────────

const INTERESTS = [
  'Local',
  'Food',
  'Beauty',
  'Fitness',
  'Travel',
  'Events',
  'AI',
  'Crypto',
  'Business',
  'Jobs',
];

const USE_CASES = [
  { id: 'explore', icon: '🗺', label: 'Explore nearby' },
  { id: 'events', icon: '🎉', label: 'Find events' },
  { id: 'communities', icon: '👥', label: 'Join communities' },
  { id: 'business', icon: '🏪', label: 'Grow my business' },
  { id: 'services', icon: '💼', label: 'Offer services' },
  { id: 'identity', icon: '🪪', label: 'Build my identity' },
];

const TOTAL_SCREENS = 6;

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
};

// ─── Progress Dots ────────────────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2 rounded-full transition-all ${
            i === current ? 'w-6 bg-[#00d4ff]' : 'w-2 bg-[#181c24]'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { requestLocation, granted } = useLocationStore();
  const { setGuest } = useAuthStore();

  const [screen, setScreen] = useState(0);
  const [direction, setDirection] = useState(1);
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [useCase, setUseCase] = useState<string | null>(null);

  // Skip onboarding if already completed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const done = localStorage.getItem('gao_onboarding_done');
      if (done === 'true') {
        router.replace(granted ? '/nearby' : '/world');
      }
    }
  }, [router, granted]);

  const next = () => {
    setDirection(1);
    setScreen((s) => s + 1);
  };

  const toggleInterest = (i: string) => {
    setInterests((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const handleLocationEnable = async () => {
    await requestLocation();
    next();
  };

  const handleGuest = () => {
    setGuest('guest_token');
    finishOnboarding();
  };

  const handleSignIn = () => {
    finishOnboarding();
    router.push('/auth');
  };

  const handleCreateAccount = () => {
    finishOnboarding();
    router.push('/auth');
  };

  const finishOnboarding = () => {
    // Save preferences
    if (typeof window !== 'undefined') {
      localStorage.setItem('gao_interests', JSON.stringify([...interests]));
      localStorage.setItem('gao_use_case', useCase || '');
      localStorage.setItem('gao_onboarding_done', 'true');
    }
  };

  // Screen 6: auto-navigate
  useEffect(() => {
    if (screen === 5) {
      finishOnboarding();
      const target = granted ? '/nearby' : '/world';
      router.replace(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  return (
    <div className="flex h-full flex-col bg-[#0a0b0f]">
      {screen > 0 && screen < 5 && (
        <ProgressDots current={screen} total={TOTAL_SCREENS} />
      )}

      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          {/* ─── SCREEN 1: Splash ──────────────────── */}
          {screen === 0 && (
            <motion.div
              key="splash"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="flex h-full flex-col items-center justify-center px-8 text-center"
            >
              <div className="mb-8">
                <h1 className="text-4xl font-bold tracking-tight text-[#f0f4ff]">
                  GAO SOCIAL
                </h1>
                <p className="mt-3 text-xl italic text-[#00d4ff]">
                  The world, not the feed.
                </p>
              </div>

              <button
                onClick={next}
                className="absolute bottom-12 left-8 right-8 rounded-xl bg-[#00d4ff] py-3.5 text-sm font-semibold text-[#0a0b0f]"
              >
                Continue
              </button>
            </motion.div>
          )}

          {/* ─── SCREEN 2: Interests ───────────────── */}
          {screen === 1 && (
            <motion.div
              key="interests"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="flex h-full flex-col px-6"
            >
              <h2 className="mt-4 text-2xl font-bold text-[#f0f4ff]">
                What matters to you?
              </h2>
              <p className="mb-6 mt-1 text-sm text-[#4a5068]">
                Pick at least one
              </p>

              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((i) => {
                  const active = interests.has(i);
                  return (
                    <button
                      key={i}
                      onClick={() => toggleInterest(i)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-[#00d4ff] text-white'
                          : 'border border-[#181c24]/40 text-[#4a5068]'
                      }`}
                    >
                      {i}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={next}
                disabled={interests.size === 0}
                className="absolute bottom-12 left-6 right-6 rounded-xl bg-[#00d4ff] py-3.5 text-sm font-semibold text-[#0a0b0f] disabled:opacity-40"
              >
                Continue
              </button>
            </motion.div>
          )}

          {/* ─── SCREEN 3: Use Case ────────────────── */}
          {screen === 2 && (
            <motion.div
              key="usecase"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="flex h-full flex-col px-6"
            >
              <h2 className="mt-4 text-2xl font-bold text-[#f0f4ff]">
                How will you use Gao?
              </h2>
              <p className="mb-6 mt-1 text-sm text-[#4a5068]">
                Pick one to personalize
              </p>

              <div className="grid grid-cols-2 gap-3">
                {USE_CASES.map((uc) => (
                  <button
                    key={uc.id}
                    onClick={() => setUseCase(uc.id)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${
                      useCase === uc.id
                        ? 'border-[#00d4ff] bg-[#00d4ff]/10'
                        : 'border-[#181c24]/30 bg-[#111318]/40'
                    }`}
                  >
                    <span className="text-3xl">{uc.icon}</span>
                    <span className="text-xs font-medium text-[#f0f4ff]">
                      {uc.label}
                    </span>
                  </button>
                ))}
              </div>

              <button
                onClick={next}
                disabled={!useCase}
                className="absolute bottom-12 left-6 right-6 rounded-xl bg-[#00d4ff] py-3.5 text-sm font-semibold text-[#0a0b0f] disabled:opacity-40"
              >
                Continue
              </button>
            </motion.div>
          )}

          {/* ─── SCREEN 4: Location Permission ─────── */}
          {screen === 3 && (
            <motion.div
              key="location"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="flex h-full flex-col items-center justify-center px-8 text-center"
            >
              <div className="mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-[#00d4ff]/10">
                <MapPin size={40} className="text-[#00d4ff]" />
              </div>
              <h2 className="mt-4 text-2xl font-bold text-[#f0f4ff]">
                Enable location
              </h2>
              <p className="mt-2 max-w-xs text-sm text-[#4a5068]">
                Discover trusted people, places, and events around you.
              </p>

              <div className="absolute bottom-12 left-8 right-8 space-y-3">
                <button
                  onClick={handleLocationEnable}
                  className="w-full rounded-xl bg-[#00d4ff] py-3.5 text-sm font-semibold text-[#0a0b0f]"
                >
                  Enable Location
                </button>
                <button
                  onClick={next}
                  className="w-full py-2 text-sm text-[#4a5068]"
                >
                  Not Now
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── SCREEN 5: Identity ────────────────── */}
          {screen === 4 && (
            <motion.div
              key="identity"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="flex h-full flex-col items-center justify-center px-8 text-center"
            >
              <h2 className="text-2xl font-bold text-[#f0f4ff]">
                Who are you?
              </h2>
              <p className="mt-2 text-sm text-[#4a5068]">
                Choose how to get started
              </p>

              <div className="absolute bottom-12 left-8 right-8 space-y-3">
                <button
                  onClick={handleCreateAccount}
                  className="w-full rounded-xl bg-[#00d4ff] py-3.5 text-sm font-semibold text-[#0a0b0f]"
                >
                  Create Account
                </button>
                <button
                  onClick={handleSignIn}
                  className="w-full rounded-xl border border-[#181c24] py-3.5 text-sm font-medium text-[#f0f4ff]"
                >
                  Sign In
                </button>

                <div className="flex items-center gap-3 py-2">
                  <span className="h-px flex-1 bg-[#181c24]/40" />
                  <span className="text-xs text-[#4a5068]">or</span>
                  <span className="h-px flex-1 bg-[#181c24]/40" />
                </div>

                <button
                  onClick={handleGuest}
                  className="w-full rounded-xl border border-[#181c24]/40 py-3.5 text-sm font-medium text-[#4a5068]"
                >
                  Continue as Guest
                </button>

                <p className="pt-1 text-[10px] text-[#4a5068]">
                  Claim your Gao Domain later to unlock full trust features.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
