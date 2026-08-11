// Bond pet — pure helpers for the couple streak virtual pet feature.
// Stage + family size + milestone progress are all derived from synced
// days (count of dates where BOTH partners ticked, both confirmed).
//
// No DB, no React — just data. Used by both the API (to compute
// milestone_reached on tick) and the UI (to render the family + progress).

// `birth_type` follows real-world biology so the early stage matches what
// the user expects: mammals (live birth) start as a TINY version of the
// pet; egg-layers (birds, reptiles, mythical egg-layers) start as 🥚.
// Unicorn is a mythical mammal (born live, not from an egg) per most
// folklore so it gets `live`.
export type BirthType = 'live' | 'egg';

export const BOND_SPECIES: ReadonlyArray<{
  emoji: string;
  name: string;
  category: 'cute' | 'gentle' | 'mythical';
  birth_type: BirthType;
}> = [
  { emoji: '🐈',  name: 'Cat',     category: 'cute',     birth_type: 'live' },
  { emoji: '🐕',  name: 'Dog',     category: 'cute',     birth_type: 'live' },
  { emoji: '🐇',  name: 'Rabbit',  category: 'cute',     birth_type: 'live' },
  { emoji: '🦊',  name: 'Fox',     category: 'cute',     birth_type: 'live' },
  { emoji: '🦥',  name: 'Sloth',   category: 'gentle',   birth_type: 'live' },
  { emoji: '🐧',  name: 'Penguin', category: 'gentle',   birth_type: 'egg'  },
  { emoji: '🦦',  name: 'Otter',   category: 'gentle',   birth_type: 'live' },
  { emoji: '🐢',  name: 'Turtle',  category: 'gentle',   birth_type: 'egg'  },
  { emoji: '🦝',  name: 'Raccoon', category: 'gentle',   birth_type: 'live' },
  { emoji: '🐉',  name: 'Dragon',  category: 'mythical', birth_type: 'egg'  },
  { emoji: '🦄',  name: 'Unicorn', category: 'mythical', birth_type: 'live' },
  { emoji: '🦋',  name: 'Phoenix', category: 'mythical', birth_type: 'egg'  },
];

/** Lookup helper — defaults to 'egg' if species not found so older streaks
 *  without a recognised emoji fall back to the original behaviour. */
export function getBirthType(speciesEmoji: string | null | undefined): BirthType {
  if (!speciesEmoji) return 'egg';
  return BOND_SPECIES.find(s => s.emoji === speciesEmoji)?.birth_type ?? 'egg';
}

export type BondStage = {
  /** Days threshold this stage starts at. */
  from: number;
  /** Stable id we can compare against `prevStage` to detect transitions. */
  id: string;
  /** Short label shown under the family. */
  label: string;
  /** True once the pet "marries" — pair shown side by side. */
  adult: boolean;
  /** Number of baby creatures next to the parent pair. */
  babies: number;
  /** Optional flair: small icon shown next to family ('🏠', '✨' etc). */
  flair?: string;
  /** Set true on the 5 big celebration moments. */
  isMilestone?: boolean;
};

/** Stage thresholds. ORDER MATTERS — kept ascending so `getStage` returns
 *  the highest threshold ≤ syncedDays. Labels here are the EGG-LAYER
 *  defaults; mammals get re-labeled via stageLabel() below. */
export const BOND_STAGES: BondStage[] = [
  { from: 0,   id: 'egg',         label: 'A new egg has arrived',     adult: false, babies: 0, isMilestone: true },
  { from: 1,   id: 'hatching',    label: 'Hatching...',                adult: false, babies: 0 },
  { from: 7,   id: 'baby',        label: 'Look at the tiny paws',      adult: false, babies: 0, isMilestone: true },
  { from: 30,  id: 'young',       label: 'Growing up fast',            adult: false, babies: 0, isMilestone: true },
  { from: 100, id: 'adult-pair',  label: 'Married — together forever', adult: true,  babies: 0, isMilestone: true, flair: '💍' },
  { from: 200, id: 'family-3',    label: 'First baby is here',         adult: true,  babies: 1, isMilestone: true },
  { from: 365, id: 'family-4',    label: 'A year strong · two babies', adult: true,  babies: 2, isMilestone: true },
  { from: 500, id: 'family-home', label: 'Settled into your own home', adult: true,  babies: 3, isMilestone: true, flair: '🏠' },
  { from: 730, id: 'legendary',   label: 'Legendary multi-generation', adult: true,  babies: 4, isMilestone: true, flair: '✨' },
];

/** Render-time label override. Mammals (live birth) get different
 *  copy for the first 3 stages — there's no egg in their narrative.
 *  Egg-layers use the BOND_STAGES.label directly. */
export function stageLabel(stage: BondStage, birthType: BirthType): string {
  if (birthType === 'egg') return stage.label;
  // live-birth mammals
  switch (stage.id) {
    case 'egg':      return 'A newborn has arrived';
    case 'hatching': return 'Wobbling on tiny legs';
    case 'baby':     return 'Look at those tiny paws';
    default:         return stage.label;
  }
}

/** Return the current stage given the synced day count. */
export function getStage(syncedDays: number): BondStage {
  let current = BOND_STAGES[0];
  for (const s of BOND_STAGES) {
    if (syncedDays >= s.from) current = s;
    else break;
  }
  return current;
}

/** The next stage to climb toward — null if already legendary. */
export function getNextStage(syncedDays: number): BondStage | null {
  for (const s of BOND_STAGES) {
    if (s.from > syncedDays) return s;
  }
  return null;
}

/** Progress 0..1 from the previous milestone to the next. */
export function progressToNextStage(syncedDays: number): number {
  const cur = getStage(syncedDays);
  const next = getNextStage(syncedDays);
  if (!next) return 1;
  const span = next.from - cur.from;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (syncedDays - cur.from) / span));
}

/** Detect whether the latest tick CROSSED into a new stage. Used by the
 *  API to flag `milestone_reached` so the client can fire the celebration
 *  overlay. */
export function justReachedMilestone(beforeDays: number, afterDays: number): BondStage | null {
  if (afterDays <= beforeDays) return null;
  const beforeId = getStage(beforeDays).id;
  const afterStage = getStage(afterDays);
  if (afterStage.id !== beforeId && afterStage.isMilestone) return afterStage;
  return null;
}

/** Parse the JSON-stored agreement list safely. */
export function parseAgreedBy(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** "Sad" threshold — days since last sync to show the worried face. */
export const PET_LONELY_AFTER_DAYS = 3;
export const PET_SAD_AFTER_DAYS = 7;

export type PetMood = 'happy' | 'lonely' | 'sad';

export function petMood(daysSinceLastSync: number): PetMood {
  if (daysSinceLastSync >= PET_SAD_AFTER_DAYS) return 'sad';
  if (daysSinceLastSync >= PET_LONELY_AFTER_DAYS) return 'lonely';
  return 'happy';
}
