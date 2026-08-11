'use client';

import { BookOpen, Volume2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { parseDiary } from '@/lib/pet-voice';
import { speak, isTTSSupported } from '@/lib/pet-speech';

type Props = {
  diaryJson: string | null;
  petName?: string | null;        // breed label or species
  /** Species emoji — drives TTS voice + pitch selection. */
  speciesEmoji?: string | null;
};

/** "Pet's diary" — list of AI-generated entries from the pet's POV.
 *  Shows nothing when the diary is empty (e.g. AI not configured, or
 *  no ticks yet). Otherwise renders a vertical timeline with mood
 *  emojis on the left and the diary line on the right. */
export function PetDiary({ diaryJson, petName, speciesEmoji }: Props) {
  const ttsOk = isTTSSupported();
  const entries = parseDiary(diaryJson);
  if (entries.length === 0) return null;

  // Newest first
  const sorted = [...entries].reverse();

  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-3 flex items-center gap-1.5">
        <BookOpen size={11} className="text-[#ec4899]" />
        {petName ? `${petName}'s diary` : 'Pet diary'}
      </h3>
      <ul className="space-y-2">
        {sorted.map((e, i) => {
          const ago = (() => {
            const [y, m, d] = e.date.split('-').map(Number);
            if (!y || !m || !d) return e.date;
            try {
              return formatDistanceToNow(new Date(y, m - 1, d), { addSuffix: true });
            } catch {
              return e.date;
            }
          })();
          const isMilestone = e.type === 'milestone';
          return (
            <li
              key={`${e.date}-${e.type}-${i}`}
              className="flex items-start gap-3 rounded-2xl p-3"
              style={{
                background: isMilestone
                  ? 'linear-gradient(135deg, rgba(236,72,153,0.08), rgba(168,85,247,0.05))'
                  : 'rgba(17,19,24,0.5)',
                border: isMilestone
                  ? '1px solid rgba(236,72,153,0.25)'
                  : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-lg shrink-0"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                {e.mood}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white italic">&ldquo;{e.line}&rdquo;</p>
                <div className="text-[10px] text-[#4a5068] mt-1 flex items-center gap-1.5">
                  <span>{ago}</span>
                  {isMilestone && (
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider"
                      style={{
                        background: 'rgba(236,72,153,0.12)',
                        color: '#ec4899',
                        border: '1px solid rgba(236,72,153,0.3)',
                      }}
                    >
                      milestone
                    </span>
                  )}
                </div>
              </div>
              {ttsOk && (
                <button
                  type="button"
                  onClick={() => speak(e.line, { speciesEmoji })}
                  className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center cursor-pointer transition-colors"
                  style={{
                    background: isMilestone ? 'rgba(236,72,153,0.18)' : 'rgba(255,255,255,0.05)',
                    color: isMilestone ? '#fce7f3' : '#a3adc3',
                  }}
                  title="Hear the pet read this"
                  aria-label="Hear the pet read this entry"
                >
                  <Volume2 size={13} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
