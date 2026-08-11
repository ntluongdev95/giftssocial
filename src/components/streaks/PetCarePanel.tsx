'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Zap, Sparkles } from 'lucide-react';
import { CARE_ACTIONS, type CareAction } from '@/lib/pet-care';
import { speak, cancelSpeech, isTTSSupported } from '@/lib/pet-speech';
import { playPetSFX } from '@/lib/pet-sfx';

type Props = {
  streakId: string;
  speciesEmoji?: string | null;
  initialHappiness: number;
  initialEnergy: number;
  initialBond: number;
  initialLastAt: {
    pet: string | null;
    feed: string | null;
    play: string | null;
    walk: string | null;
  };
  /** Fires after each successful action so the parent can show a
   *  speech-bubble or trigger pet animation. */
  onReaction?: (line: string, mood: string, action: CareAction) => void;
  /** Compact mode renders without the title — used inside fullscreen mode. */
  compact?: boolean;
};

/** Tamagotchi-style care game. Four big tap buttons + live stat bars +
 *  in-flight reaction text. Stats update optimistically and are clamped
 *  by the server on response. */
export function PetCarePanel({
  streakId,
  speciesEmoji,
  initialHappiness,
  initialEnergy,
  initialBond,
  initialLastAt,
  onReaction,
  compact,
}: Props) {
  const [happiness, setHappiness] = useState(initialHappiness);
  const [energy, setEnergy] = useState(initialEnergy);
  const [bond, setBond] = useState(initialBond);
  const [lastAt, setLastAt] = useState(initialLastAt);
  const [running, setRunning] = useState<CareAction | null>(null);
  const [reaction, setReaction] = useState<{ line: string; mood: string; key: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, force] = useState(0);

  const ttsOk = isTTSSupported();

  // Re-render every second so the cooldown countdowns tick live.
  useEffect(() => {
    const t = setInterval(() => force(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Reaction bubble auto-dismisses after 5s.
  useEffect(() => {
    if (!reaction) return;
    const t = setTimeout(() => setReaction(null), 5000);
    return () => clearTimeout(t);
  }, [reaction]);

  // Cleanup speech on unmount.
  useEffect(() => () => cancelSpeech(), []);

  function cooldownLeft(action: CareAction): number {
    const last = lastAt[action];
    if (!last) return 0;
    const spec = CARE_ACTIONS.find(a => a.id === action)!;
    const diff = (Date.now() - new Date(last).getTime()) / 1000;
    return Math.max(0, Math.ceil(spec.cooldown - diff));
  }

  async function trigger(action: CareAction) {
    if (running) return;
    if (cooldownLeft(action) > 0) return;
    setRunning(action);
    setError(null);

    // Immediate SFX so the tap feels responsive even before AI returns.
    playPetSFX(speciesEmoji);

    try {
      const r = await fetch(`/api/v1/streaks/${streakId}/pet-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error?.message ?? `Action failed (${r.status})`);
        return;
      }
      const d = j.data as {
        line: string; mood: string; happiness: number; energy: number; bond: number; at: string;
      };
      setHappiness(d.happiness);
      setEnergy(d.energy);
      setBond(d.bond);
      setLastAt(prev => ({ ...prev, [action]: d.at }));
      setReaction({ line: d.line, mood: d.mood, key: Date.now() });
      if (ttsOk) setTimeout(() => speak(d.line, { speciesEmoji }), 300);
      onReaction?.(d.line, d.mood, action);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setRunning(null);
    }
  }

  return (
    <section
      className={compact ? '' : 'space-y-3'}
    >
      {!compact && (
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] flex items-center gap-1.5">
          <Sparkles size={11} className="text-[#ec4899]" />
          Pet care
        </h3>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <StatBar label="Happy" value={happiness} icon={<Heart size={11} />} color="#ec4899" />
        <StatBar label="Energy" value={energy} icon={<Zap size={11} />} color="#facc15" />
        <StatBar label="Bond" value={bond} icon={<Sparkles size={11} />} color="#a855f7" />
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-4 gap-2">
        {CARE_ACTIONS.map(a => {
          const cd = cooldownLeft(a.id);
          const disabled = running === a.id || cd > 0;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => trigger(a.id)}
              disabled={disabled}
              className="rounded-2xl py-3 px-2 flex flex-col items-center gap-1 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              style={{
                background: 'linear-gradient(180deg, rgba(236,72,153,0.12), rgba(168,85,247,0.08))',
                border: '1px solid rgba(236,72,153,0.25)',
              }}
            >
              <span className="text-2xl" aria-hidden>{a.emoji}</span>
              <span className="text-[10px] font-semibold text-white leading-tight text-center">
                {a.label}
              </span>
              {cd > 0 && (
                <span className="text-[9px] text-[#a3adc3]">
                  {cd}s
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Reaction line — short-lived overlay below the buttons */}
      <AnimatePresence>
        {reaction && (
          <motion.div
            key={reaction.key}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="rounded-xl px-3 py-2 text-sm text-white flex items-center gap-2"
            style={{
              background: 'rgba(236,72,153,0.08)',
              border: '1px solid rgba(236,72,153,0.25)',
            }}
          >
            <span className="text-lg" aria-hidden>{reaction.mood}</span>
            <span className="italic flex-1 min-w-0">&ldquo;{reaction.line}&rdquo;</span>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="text-xs text-rose-400" role="alert">{error}</p>
      )}
    </section>
  );
}

function StatBar({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div
      className="rounded-xl px-2 py-1.5"
      style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="flex items-center justify-between text-[9px] text-[#a3adc3] mb-1">
        <span className="flex items-center gap-1" style={{ color }}>{icon}{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}
