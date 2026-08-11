'use client';

import { useMemo } from 'react';
import {
  BOND_SPECIES,
  getStage,
  getNextStage,
  progressToNextStage,
  petMood,
  parseAgreedBy,
  getBirthType,
  stageLabel,
} from '@/lib/bond-pet';

type Props = {
  species: string | null;
  agreedByJson: string;
  participantIds: string[];
  syncedDays: number;
  lastSyncDate: string | null;
  /** YYYY-MM-DD viewer's today, for days-since-last-sync math. */
  todayKey: string;
  /** Optional breed photo — if present, displayed instead of the emoji
   *  for parent figures. Babies stay as the species emoji for simplicity. */
  breedLabel?: string | null;
  breedImageUrl?: string | null;
};

/** Big "Your family" hero shown above the regular hero card on couple
 *  streaks. Renders the pet + family + next milestone progress. If both
 *  partners haven't agreed on the species yet (only the owner so far),
 *  shows a "waiting to hatch" state instead. */
export function BondPetDisplay({
  species,
  agreedByJson,
  participantIds,
  syncedDays,
  lastSyncDate,
  todayKey,
  breedLabel,
  breedImageUrl,
}: Props) {
  const agreed = useMemo(() => parseAgreedBy(agreedByJson), [agreedByJson]);
  const allAgreed = participantIds.every(id => agreed.includes(id));
  const speciesMeta = useMemo(
    () => BOND_SPECIES.find(s => s.emoji === species) ?? null,
    [species],
  );

  const stage = getStage(syncedDays);
  const next = getNextStage(syncedDays);
  const progress = progressToNextStage(syncedDays);
  const birthType = getBirthType(species);
  const label = stageLabel(stage, birthType);

  // Days since last sync — drives the mood overlay
  const daysSinceSync = (() => {
    if (!lastSyncDate) return 0;
    const [y1, m1, d1] = todayKey.split('-').map(Number);
    const [y2, m2, d2] = lastSyncDate.split('-').map(Number);
    const a = new Date(y1, m1 - 1, d1).getTime();
    const b = new Date(y2, m2 - 1, d2).getTime();
    return Math.max(0, Math.round((a - b) / (24 * 3600 * 1000)));
  })();
  const mood = lastSyncDate ? petMood(daysSinceSync) : 'happy';

  // Not yet hatched/born (both partners haven't agreed yet)
  if (!allAgreed) {
    const waitingTitle = birthType === 'egg' ? 'Waiting to hatch' : 'Waiting to be born';
    return (
      <section
        className="rounded-2xl p-6 lg:p-8 text-center"
        style={{
          background:
            'linear-gradient(135deg, rgba(236,72,153,0.06), rgba(168,85,247,0.04))',
          border: '1px solid rgba(236,72,153,0.2)',
        }}
      >
        <div className="text-5xl mb-2">{birthType === 'egg' ? '🥚' : (species ?? '💕')}</div>
        <h3 className="text-base font-bold text-white mb-1">{waitingTitle}</h3>
        <p className="text-xs text-[#a3adc3]">
          {birthType === 'egg'
            ? `Your egg is ready — once your partner accepts the invite, it'll start hatching.`
            : `Your newborn ${species ?? 'pet'} is on the way — once your partner accepts, your family begins.`}
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl p-5 lg:p-6 xl:p-8"
      style={{
        background:
          'linear-gradient(135deg, rgba(236,72,153,0.08), rgba(168,85,247,0.05) 60%, rgba(0,212,255,0.04))',
        border: '1px solid rgba(236,72,153,0.22)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#ec4899] flex items-center gap-1.5">
          <span>💕</span> Your family
        </h3>
        <div className="text-[10px] text-[#4a5068]">
          {syncedDays} day{syncedDays === 1 ? '' : 's'} together
        </div>
      </div>

      {/* Family render — pet sprites at large size + flair */}
      <div className="flex items-center justify-center gap-2 my-5 lg:my-6 select-none">
        <PetFamily
          species={species ?? '🥚'}
          stage={stage}
          mood={mood}
          birthType={birthType}
          breedImageUrl={breedImageUrl ?? null}
          breedLabel={breedLabel ?? null}
        />
      </div>

      {/* Stage label */}
      <div className="text-center mb-4">
        <div className="text-sm lg:text-base font-bold text-white">{label}</div>
        {speciesMeta && (
          <div className="text-[10px] text-[#4a5068] mt-0.5">
            {speciesMeta.name} {stage.flair ?? ''}
          </div>
        )}
        {mood !== 'happy' && (
          <div
            className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{
              background: mood === 'sad' ? 'rgba(248,113,113,0.1)' : 'rgba(251,191,36,0.1)',
              color: mood === 'sad' ? '#fca5a5' : '#fbbf24',
              border: mood === 'sad'
                ? '1px solid rgba(248,113,113,0.3)'
                : '1px solid rgba(251,191,36,0.3)',
            }}
          >
            {mood === 'sad'
              ? `Pet misses you · ${daysSinceSync} days no sync`
              : `Pet feels lonely · ${daysSinceSync} days no sync`}
          </div>
        )}
      </div>

      {/* Next milestone progress bar */}
      {next ? (
        <>
          <div className="flex items-center justify-between text-[10px] mb-1.5">
            <span className="text-[#a3adc3]">
              Next: <span className="text-white font-medium">{next.label}</span>
            </span>
            <span className="text-[#4a5068]">
              {syncedDays} / {next.from}
            </span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.round(progress * 100)}%`,
                background: 'linear-gradient(90deg, #ec4899, #a855f7, #00d4ff)',
              }}
            />
          </div>
        </>
      ) : (
        <div className="text-center text-xs text-[#a855f7] font-medium">
          ✨ Legendary — you&apos;ve reached the highest stage.
        </div>
      )}
    </section>
  );
}

type PortraitSize = 'xs' | 'sm' | 'md' | 'lg';
type LifeMotion = 'sleeping' | 'waking' | 'playful' | 'idle';

/** Circular breed-photo portrait with a pink ring + life-stage motion.
 *  Falls back to the species emoji at a matching font size when no
 *  breed photo is attached.
 *
 *  Motion is GPU-only (transform/filter) so 60fps holds on cheap phones.
 *  - sleeping  : tiny slow breath + nodding head — newborn
 *  - waking    : bigger wobble + shake — hatching/just born
 *  - playful   : energetic bounce + tilt — baby/young
 *  - idle      : settled gentle breath — adult */
function Portrait({
  size,
  species,
  breedImageUrl,
  breedLabel,
  motion = 'idle',
  delayMs = 0,
}: {
  size: PortraitSize;
  species: string;
  breedImageUrl: string | null;
  breedLabel: string | null;
  motion?: LifeMotion;
  delayMs?: number;
}) {
  const px = size === 'lg' ? 96 : size === 'md' ? 80 : size === 'sm' ? 56 : 40;
  const animation = MOTION_CSS[motion];
  const commonStyle = {
    animation,
    animationDelay: `${delayMs}ms`,
    transformOrigin: 'center bottom',
    willChange: 'transform',
  };

  if (breedImageUrl) {
    return (
      <>
        <PetMotionKeyframes />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={breedImageUrl}
          alt={breedLabel ?? 'pet'}
          className="rounded-full object-cover shrink-0 inline-block"
          style={{
            width: px,
            height: px,
            border: '3px solid rgba(236,72,153,0.4)',
            boxShadow: '0 4px 18px -4px rgba(236,72,153,0.4)',
            ...commonStyle,
          }}
        />
      </>
    );
  }
  const cls =
    size === 'lg' ? 'text-7xl lg:text-8xl'
    : size === 'md' ? 'text-6xl lg:text-7xl'
    : size === 'sm' ? 'text-4xl lg:text-5xl'
    : 'text-3xl';
  return (
    <>
      <PetMotionKeyframes />
      <span className={`${cls} inline-block leading-none`} style={commonStyle}>
        {species}
      </span>
    </>
  );
}

const MOTION_CSS: Record<LifeMotion, string> = {
  sleeping: 'bond-breath-slow 4s ease-in-out infinite, bond-nod 6s ease-in-out infinite',
  waking:   'bond-wobble 1.4s ease-in-out infinite, bond-breath 2.4s ease-in-out infinite',
  playful:  'bond-hop 1.6s ease-in-out infinite, bond-tilt 3.2s ease-in-out infinite',
  idle:     'bond-breath 3s ease-in-out infinite',
};

/** Pet motion keyframes. Lives in styled-jsx global so any number of
 *  Portraits in the family lineup share one stylesheet entry. */
function PetMotionKeyframes() {
  return (
    <style jsx global>{`
      @keyframes bond-breath {
        0%, 100% { transform: scale(1); }
        50%      { transform: scale(1.035); }
      }
      @keyframes bond-breath-slow {
        0%, 100% { transform: scale(1); }
        50%      { transform: scale(1.025); }
      }
      @keyframes bond-nod {
        0%, 100% { transform: translateY(0) rotate(-1deg); }
        50%      { transform: translateY(-1.5px) rotate(1.5deg); }
      }
      @keyframes bond-wobble {
        0%, 100% { transform: rotate(-4deg); }
        25%      { transform: rotate(3deg) translateX(1px); }
        50%      { transform: rotate(-2deg); }
        75%      { transform: rotate(4deg) translateX(-1px); }
      }
      @keyframes bond-hop {
        0%, 100% { transform: translateY(0) scaleY(1); }
        40%      { transform: translateY(-4px) scaleY(1.04); }
        70%      { transform: translateY(0) scaleY(0.96); }
      }
      @keyframes bond-tilt {
        0%, 100% { transform: rotate(-3deg); }
        50%      { transform: rotate(3deg); }
      }
      @media (prefers-reduced-motion: reduce) {
        [class*="rounded-full"][style*="bond-"] { animation: none !important; }
      }
    `}</style>
  );
}

/** Pet + parent pair + babies, scaled by stage. Renders the breed PHOTO
 *  for adult parents when a `breedImageUrl` is provided, falling back to
 *  the species emoji for early stages + babies (where the emoji feels
 *  more cute + cartoonish anyway).
 *
 *  Birth type matters in the first two stages: mammals (live birth) show
 *  a tiny version of themselves; egg-layers show an actual 🥚 that
 *  cracks open. Both converge at the `baby` stage onwards. */
function PetFamily({
  species,
  stage,
  mood,
  birthType,
  breedImageUrl,
  breedLabel,
}: {
  species: string;
  stage: ReturnType<typeof getStage>;
  mood: 'happy' | 'lonely' | 'sad';
  birthType: 'live' | 'egg';
  breedImageUrl: string | null;
  breedLabel: string | null;
}) {
  const filter =
    mood === 'sad'
      ? 'grayscale(0.4) saturate(0.7) brightness(0.85)'
      : mood === 'lonely'
        ? 'saturate(0.85) brightness(0.95)'
        : 'none';

  const portraitProps = { species, breedImageUrl, breedLabel };

  // Egg-layers: 🥚 then 🥚 wiggling. Mammals: tiny portrait that grows.
  if (stage.id === 'egg') {
    if (birthType === 'egg') {
      return <span className="text-7xl lg:text-8xl" style={{ filter }}>🥚</span>;
    }
    // Newborn mammal — sleepy breath + tiny head nod
    return (
      <div style={{ filter }}>
        <Portrait size="xs" motion="sleeping" {...portraitProps} />
      </div>
    );
  }
  if (stage.id === 'hatching') {
    if (birthType === 'egg') {
      return (
        <span className="text-7xl lg:text-8xl inline-block animate-bounce" style={{ filter }}>
          🥚
        </span>
      );
    }
    // Just-born mammal — energetic wobble (opening eyes, finding legs)
    return (
      <div style={{ filter }}>
        <Portrait size="sm" motion="waking" {...portraitProps} />
      </div>
    );
  }

  // Baby / young — single portrait at growing size, playful bounce
  if (!stage.adult) {
    return (
      <div style={{ filter }}>
        <Portrait
          size={stage.id === 'baby' ? 'md' : 'lg'}
          motion="playful"
          {...portraitProps}
        />
      </div>
    );
  }

  // Adult pair + babies. Each adult breathes idly on its own rhythm
  // (different stagger delays) so they don't move in lockstep.
  return (
    <div className="flex items-end gap-2 lg:gap-3" style={{ filter }}>
      <Portrait size="md" motion="idle" delayMs={0} {...portraitProps} />
      {stage.flair === '💍' && stage.babies === 0 && (
        <span className="text-3xl lg:text-4xl mb-2">💍</span>
      )}
      <Portrait size="md" motion="idle" delayMs={1100} {...portraitProps} />
      {Array.from({ length: stage.babies }).map((_, i) => (
        <span
          key={i}
          className="text-3xl lg:text-4xl mb-1 inline-block"
          style={{
            animation: 'bond-hop 1.6s ease-in-out infinite',
            animationDelay: `${(i + 1) * 380}ms`,
          }}
        >
          {species}
        </span>
      ))}
      {stage.flair === '🏠' && (
        <span className="text-3xl lg:text-4xl mb-1">🏠</span>
      )}
      {stage.flair === '✨' && (
        <span className="text-3xl lg:text-4xl mb-1">✨</span>
      )}
    </div>
  );
}
