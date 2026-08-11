// Shared types + helpers for the Tamagotchi-style pet care minigame.
// Pure — no DB, no SDK calls. The endpoint at /api/v1/streaks/[id]/pet-action
// imports these to build prompts and update stats.

export type CareAction = 'pet' | 'feed' | 'play' | 'walk';

export const CARE_ACTIONS: ReadonlyArray<{
  id: CareAction;
  label: string;
  emoji: string;
  /** Throttle in seconds — pet ignores spam taps below this. */
  cooldown: number;
  /** Stat deltas applied on success. Clamped to 0–100 by caller. */
  delta: { happiness: number; energy: number; bond: number };
}> = [
  { id: 'pet',  label: 'Pet me',     emoji: '🤚', cooldown: 8,  delta: { happiness: +8,  energy:  0,  bond: +3 } },
  { id: 'feed', label: 'Feed treat', emoji: '🦴', cooldown: 60, delta: { happiness: +6,  energy: +12, bond: +2 } },
  { id: 'play', label: 'Play ball',  emoji: '🎾', cooldown: 30, delta: { happiness: +12, energy:  -8, bond: +4 } },
  { id: 'walk', label: 'Walk',       emoji: '🚶', cooldown: 120, delta: { happiness: +10, energy: -10, bond: +5 } },
];

export const ACTION_LOG_MAX = 30;

export type ActionLogEntry = {
  at: string;        // ISO timestamp
  action: CareAction;
  line: string;      // AI-generated pet reaction
  mood: string;      // single emoji
};

/** Append an entry to the action log, capping length at ACTION_LOG_MAX. */
export function appendActionLog(prev: ActionLogEntry[], next: ActionLogEntry): ActionLogEntry[] {
  const merged = [...prev, next];
  if (merged.length > ACTION_LOG_MAX) return merged.slice(-ACTION_LOG_MAX);
  return merged;
}

export function parseActionLog(json: string | null | undefined): ActionLogEntry[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.filter((e): e is ActionLogEntry =>
      e && typeof e.at === 'string' && typeof e.action === 'string' && typeof e.line === 'string',
    );
  } catch {
    return [];
  }
}

/** Clamp a stat to the 0–100 range. */
export function clampStat(n: number): number {
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

// ── Prompt builders ──────────────────────────────────────────────────────

type ActionPromptCtx = {
  speciesName: string;       // 'Dog', 'Cat'
  breedLabel: string | null; // 'Corgi' or null
  birthType: 'live' | 'egg';
  petName: string | null;    // future: name your pet; currently null
  ownerName: string;
  partnerName: string | null;
  viewerName: string;        // who just clicked the button
  happiness: number;
  energy: number;
  bond: number;
};

const ACTION_DETAIL: Record<CareAction, string> = {
  pet:  'gently petting your head and scratching behind the ears',
  feed: 'offering you a tasty treat (a bone for dogs, fish for cats, leaves for slow lorises, etc — species-appropriate)',
  play: 'playing a quick game of fetch / chase / wiggle',
  walk: 'taking you outside for a short walk in the neighborhood',
};

export function carePrompt(ctx: ActionPromptCtx, action: CareAction): string {
  const breed = ctx.breedLabel
    ? `${ctx.breedLabel} ${ctx.speciesName.toLowerCase()}`
    : ctx.speciesName.toLowerCase();
  return [
    `You are a ${breed} that lives with the couple ${ctx.ownerName}${ctx.partnerName ? ` and ${ctx.partnerName}` : ''}.`,
    `${ctx.viewerName} just performed an in-game action: ${ACTION_DETAIL[action]}.`,
    `Your current vibe: happiness ${ctx.happiness}/100, energy ${ctx.energy}/100, bond ${ctx.bond}/100.`,
    ``,
    `Write ONE short reaction from your pet POV (10-22 words) — first person.`,
    `Be cute, species-appropriate, and address ${ctx.viewerName.split(' ')[0] || 'them'} directly.`,
    `Match the vibe: if happiness is low, sound recovering; if energy is low, sound a little tired.`,
    ``,
    `Output ONLY valid JSON: { "line": "your reaction", "mood": "single emoji" }`,
  ].join('\n');
}

/** Whether `lastAtIso` is older than the action's cooldown — i.e. the
 *  action is allowed right now. Null/missing timestamps mean "yes". */
export function isOffCooldown(lastAtIso: string | null | undefined, cooldownSec: number, nowMs: number): boolean {
  if (!lastAtIso) return true;
  const last = new Date(lastAtIso).getTime();
  if (Number.isNaN(last)) return true;
  return (nowMs - last) / 1000 >= cooldownSec;
}
