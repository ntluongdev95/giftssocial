'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Volume2 } from 'lucide-react';
import { GREETING_TTL_MS } from '@/lib/pet-voice';
import { speak, cancelSpeech, isTTSSupported } from '@/lib/pet-speech';
import { playPetSFX } from '@/lib/pet-sfx';

type Props = {
  streakId: string;
  initialGreeting: string | null;
  initialGreetingAt: string | null;
  /** Species emoji — used to pick a fitting TTS voice + pitch. */
  speciesEmoji?: string | null;
};

/** Speech-bubble that floats above the pet portrait. Auto-fetches a fresh
 *  greeting on mount if the cached one is missing or older than TTL.
 *  Silently no-ops when the server has no AI key (503 ai_not_configured). */
export function PetGreeting({ streakId, initialGreeting, initialGreetingAt, speciesEmoji }: Props) {
  const [line, setLine] = useState<string | null>(initialGreeting);
  const [loading, setLoading] = useState(false);
  const triedRef = useRef(false);
  const autoplayedRef = useRef(false);
  const ttsOk = isTTSSupported();

  useEffect(() => {
    if (triedRef.current) return;
    // Fresh enough? Show what we have.
    const ageMs = initialGreetingAt
      ? Date.now() - new Date(initialGreetingAt).getTime()
      : Infinity;
    if (line && ageMs < GREETING_TTL_MS) return;

    triedRef.current = true;
    setLoading(true);
    fetch(`/api/v1/streaks/${streakId}/pet-voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ purpose: 'greeting' }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { data: { line: string } }) => setLine(j.data.line))
      .catch(() => { /* quietly drop — section just doesn't show */ })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streakId]);

  // Auto-speak the greeting the first time it lands. Many browsers block
  // synth until a user gesture has occurred on the page — that's fine,
  // the tap-to-replay button still works.
  useEffect(() => {
    if (!line || !ttsOk || autoplayedRef.current) return;
    autoplayedRef.current = true;
    // SFX first, speech 350ms after — pet "barks then talks"
    playPetSFX(speciesEmoji);
    setTimeout(() => speak(line, { speciesEmoji }), 350);
    return () => cancelSpeech();
  }, [line, ttsOk, speciesEmoji]);

  if (!line && !loading) return null;

  return (
    <div className="flex justify-center mb-2 lg:mb-3">
      <div
        className="relative max-w-sm rounded-2xl px-4 py-2.5 text-sm text-white flex items-center gap-2"
        style={{
          background: 'rgba(236,72,153,0.08)',
          border: '1px solid rgba(236,72,153,0.25)',
        }}
      >
        {loading && !line ? (
          <div className="flex items-center gap-2 text-[#a3adc3]">
            <Loader2 size={12} className="animate-spin" />
            <span className="text-xs">Pet is finding its words...</span>
          </div>
        ) : (
          <>
            <span className="italic">&ldquo;{line}&rdquo;</span>
            {ttsOk && line && (
              <button
                type="button"
                onClick={() => {
                  playPetSFX(speciesEmoji);
                  setTimeout(() => speak(line, { speciesEmoji }), 350);
                }}
                className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center cursor-pointer transition-colors"
                style={{
                  background: 'rgba(236,72,153,0.2)',
                  color: '#fce7f3',
                }}
                title="Hear the pet speak"
                aria-label="Hear the pet speak"
              >
                <Volume2 size={12} />
              </button>
            )}
          </>
        )}
        {/* Tail pointing down at the portrait below */}
        <div
          className="absolute left-1/2 -bottom-1.5 w-3 h-3 rotate-45 -translate-x-1/2"
          style={{
            background: 'rgba(236,72,153,0.08)',
            borderRight: '1px solid rgba(236,72,153,0.25)',
            borderBottom: '1px solid rgba(236,72,153,0.25)',
          }}
        />
      </div>
    </div>
  );
}
