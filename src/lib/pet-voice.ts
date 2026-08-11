// Shared types + prompt builders for the AI pet-voice feature. Pure —
// no SDK calls, no DB. The endpoint at /api/v1/streaks/[id]/pet-voice
// imports these and feeds them to Claude.

export type DiaryEntryType = 'tick' | 'miss' | 'milestone' | 'born';

export type DiaryEntry = {
  /** YYYY-MM-DD of the event. */
  date: string;
  /** 1–2 sentences from the pet's POV. */
  line: string;
  /** Single emoji summarising the entry's vibe. */
  mood: string;
  type: DiaryEntryType;
};

/** Hard-cap on how many diary entries we keep per streak. Older ones get
 *  dropped (LRU-style) when the array exceeds this. 10 is plenty — covers
 *  about a week and a half on a daily habit. */
export const DIARY_MAX = 10;

export type PetContext = {
  speciesName: string;       // 'Dog', 'Cat', 'Dragon'
  speciesEmoji: string;      // '🐕', '🐈', '🐉'
  breedLabel: string | null; // 'Corgi', 'Golden Retriever' or null
  birthType: 'live' | 'egg';
  streakTitle: string;       // 'Drink 2L water'
  ownerName: string;         // 'Minh Anh'
  partnerName: string | null;// 'Bae' or null
  syncedDays: number;
  /** YYYY-MM-DD of the event triggering this voice line. */
  eventDate: string;
  /** 0 if both ticked today, 1+ otherwise. Drives the loneliness tone. */
  daysSinceLastSync: number;
};

// ── Diary prompts ────────────────────────────────────────────────────────

export function diaryPrompt(ctx: PetContext, type: DiaryEntryType, milestoneLabel?: string): string {
  const breed = ctx.breedLabel ? `${ctx.breedLabel} ${ctx.speciesName.toLowerCase()}` : ctx.speciesName.toLowerCase();
  const partners = ctx.partnerName ? `${ctx.ownerName} and ${ctx.partnerName}` : ctx.ownerName;
  const dayCount = ctx.syncedDays > 0
    ? `Day ${ctx.syncedDays} of our journey together.`
    : 'My very first day with my humans.';

  let situation: string;
  switch (type) {
    case 'tick':
      situation = `${partners} just completed their daily habit "${ctx.streakTitle}" together. ${dayCount}`;
      break;
    case 'miss':
      situation = `It has been ${ctx.daysSinceLastSync} days since both of my humans last synced on "${ctx.streakTitle}". I'm starting to feel lonely.`;
      break;
    case 'milestone':
      situation = `Today is a HUGE day — we hit a milestone: ${milestoneLabel ?? 'a major life moment'}! ${dayCount}`;
      break;
    case 'born':
      situation = `My humans ${partners} adopted me today and started our streak "${ctx.streakTitle}". I'm brand new.`;
      break;
  }

  return [
    `You are a ${breed} living with a couple who keep daily habits together.`,
    `Write ONE short diary entry (15-35 words) from YOUR pet POV — first person.`,
    `Be cute, species-appropriate, slice-of-life. Mention small concrete details.`,
    `Avoid corny clichés. Don't address the reader — write to yourself.`,
    ``,
    `Situation: ${situation}`,
    ``,
    `Output ONLY valid JSON: { "line": "the diary entry", "mood": "single emoji" }`,
  ].join('\n');
}

// ── Greeting prompt ──────────────────────────────────────────────────────

export function greetingPrompt(ctx: PetContext, viewerName: string): string {
  const breed = ctx.breedLabel ? `${ctx.breedLabel} ${ctx.speciesName.toLowerCase()}` : ctx.speciesName.toLowerCase();
  const partner = ctx.partnerName ?? 'your partner';
  const vibe =
    ctx.daysSinceLastSync === 0
      ? 'You ticked together yesterday and the pet is overjoyed.'
      : ctx.daysSinceLastSync === 1
        ? 'It has been a day with no sync — the pet missed the user.'
        : ctx.daysSinceLastSync >= 7
          ? `It's been ${ctx.daysSinceLastSync} days without a sync. The pet is genuinely sad and missing both humans.`
          : `It's been ${ctx.daysSinceLastSync} days without a sync — the pet is a little lonely.`;

  return [
    `You are a ${breed} who lives with ${viewerName} and ${partner}.`,
    `${viewerName} just opened the app to check on you.`,
    `${vibe}`,
    ``,
    `Write ONE short greeting (10-20 words) from your POV — speak DIRECTLY to ${viewerName.split(' ')[0] || 'them'}.`,
    `Be in-character for your species. Cute, emotionally resonant, slightly playful.`,
    `Output ONLY valid JSON: { "line": "your greeting", "mood": "single emoji" }`,
  ].join('\n');
}

// ── Milestone speech prompt ──────────────────────────────────────────────

export function milestonePrompt(ctx: PetContext, milestoneLabel: string): string {
  const breed = ctx.breedLabel ? `${ctx.breedLabel} ${ctx.speciesName.toLowerCase()}` : ctx.speciesName.toLowerCase();
  const partners = ctx.partnerName ? `${ctx.ownerName} and ${ctx.partnerName}` : ctx.ownerName;

  return [
    `You are a ${breed} celebrating a HUGE milestone with your humans, ${partners}.`,
    `Today the streak "${ctx.streakTitle}" reached ${ctx.syncedDays} days together.`,
    `Milestone: ${milestoneLabel}.`,
    ``,
    `Write a heartfelt 1-2 sentence speech (max 35 words) from your POV. First person.`,
    `Emotional, in-character, species-appropriate. Address both humans.`,
    `Output ONLY valid JSON: { "line": "the speech", "mood": "single emoji" }`,
  ].join('\n');
}

// ── Diary maintenance ────────────────────────────────────────────────────

/** Append a new entry to a diary array, deduping by (date, type) and
 *  trimming to DIARY_MAX. */
export function appendDiary(prev: DiaryEntry[], next: DiaryEntry): DiaryEntry[] {
  const filtered = prev.filter(e => !(e.date === next.date && e.type === next.type));
  filtered.push(next);
  if (filtered.length > DIARY_MAX) {
    return filtered.slice(filtered.length - DIARY_MAX);
  }
  return filtered;
}

export function parseDiary(json: string | null | undefined): DiaryEntry[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.filter((e): e is DiaryEntry =>
      e && typeof e.line === 'string' && typeof e.date === 'string' && typeof e.mood === 'string',
    );
  } catch {
    return [];
  }
}

/** Greeting is fresh if generated less than this long ago. */
export const GREETING_TTL_MS = 12 * 60 * 60 * 1000;
