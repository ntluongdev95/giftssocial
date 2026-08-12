// Vietnamese-calendar occasion catalogue for the Kiss / Gift flow.
// Each occasion carries themed gifts + bundle deals that show up under
// the "Occasions" tab in SendKissModal. The featured occasion is picked
// by proximity to today so the modal always surfaces the most timely one.

export interface OccasionGift {
  emoji: string;
  name: string;
  coins: number;
}

export interface OccasionBundle {
  id: string;
  name: string;
  emoji: string;          // representative emoji sent as the kiss
  items: OccasionGift[];  // what's inside (visual + total price basis)
  discountPct: number;    // % off vs sum of items' coins
  tagline?: string;       // short marketing line
}

// A reveal-style template the sender picks to theme the gift's animation
// (falling roses, confetti, snow, lanterns, etc.). Templates surface as
// thumbnail cards under each occasion; clicking opens a video preview.
export interface OccasionTemplate {
  id: string;
  name: string;
  description: string;
  emoji: string;            // hero emoji shown on the thumbnail card
  thumbnailBg: string;      // CSS background for the thumbnail
  videoUrl?: string;        // preview mp4 URL — placeholder for now
  premium?: boolean;        // paid unlock (future)
  coins?: number;           // cost if premium
  // Data-driven template engine (migration 035). Empty when the template
  // falls back to a hardcoded React component (via component_key).
  componentKey?: string;                            // registry key: 'data-driven' | 'rose-rain' | ...
  accentColor?: string;                             // template's brand color
  fieldsSchema?: import('@/components/reveals/fields').FieldSpec[];
  effects?: import('@/components/reveals/_effects/_types').EffectSpec[];
  // Admin flag from template_occasions.featured — pinned at the top of
  // the picker + shown with a ⭐ badge.
  featured?: boolean;
}

export interface Occasion {
  id: string;
  name: string;           // display name in the UI
  emoji: string;
  themeColor: string;     // hex for tab pill + bundle ribbon
  bgGradient: string;     // CSS background for the occasion card
  date: { month: number; day: number }; // 1-indexed month + day of month
  isLunar?: boolean;      // Lunar New Year / Mid-Autumn use lunar calendar (approx solar for now)
  evergreen?: boolean;    // no calendar date — Birthday / Sorry / Proposal etc.
  windowDays: number;     // ± window in which this occasion is "hot"
  description: string;    // one-liner shown on the occasion card
  gifts: OccasionGift[];
  bundles: OccasionBundle[];
  templates?: OccasionTemplate[]; // reveal-animation templates (desktop grid)
}

// Bundle price after discount, rounded to integer.
export function bundlePrice(bundle: OccasionBundle): number {
  const gross = bundle.items.reduce((s, g) => s + g.coins, 0);
  return Math.round(gross * (1 - bundle.discountPct / 100));
}

// Days from `from` to the next occurrence of `date`. If the date has
// passed this year, roll to next year. Ignores leap-day edge case.
export function daysUntil(date: { month: number; day: number }, from: Date = new Date()): number {
  const year = from.getFullYear();
  let target = new Date(year, date.month - 1, date.day, 0, 0, 0, 0);
  const startOfToday = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0);
  if (target < startOfToday) target = new Date(year + 1, date.month - 1, date.day, 0, 0, 0, 0);
  return Math.round((target.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
}

// Occasion nearest to today (by days-until). Evergreens are ranked
// last so a calendar occasion always wins when they exist.
export function featuredOccasion(from: Date = new Date()): Occasion {
  return [...OCCASIONS].sort((a, b) => {
    if (a.evergreen && !b.evergreen) return 1;
    if (!a.evergreen && b.evergreen) return -1;
    return daysUntil(a.date, from) - daysUntil(b.date, from);
  })[0];
}

// True if today is within `windowDays` of the occasion (before or after).
export function isOccasionActive(o: Occasion, from: Date = new Date()): boolean {
  const days = daysUntil(o.date, from);
  return days <= o.windowDays;
}

export const OCCASIONS: Occasion[] = [
  {
    id: 'valentine',
    name: "Valentine's Day",
    emoji: '💝',
    themeColor: '#ec4899',
    bgGradient: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
    date: { month: 2, day: 14 },
    windowDays: 21,
    description: 'A day for love',
    gifts: [
      { emoji: '🌹', name: 'Red Rose',      coins: 15 },
      { emoji: '💐', name: 'Rose Bouquet',  coins: 60 },
      { emoji: '🍫', name: 'Chocolate Box', coins: 25 },
      { emoji: '💌', name: 'Love Letter',   coins: 10 },
      { emoji: '💍', name: 'Ring',          coins: 200 },
      { emoji: '🥂', name: 'Champagne',     coins: 100 },
    ],
    bundles: [
      {
        id: 'val-classic',
        name: 'Valentine Classic',
        emoji: '💝',
        items: [
          { emoji: '🌹', name: 'Red Rose', coins: 15 },
          { emoji: '🍫', name: 'Chocolate Box', coins: 25 },
          { emoji: '💌', name: 'Love Letter', coins: 10 },
        ],
        discountPct: 30,
        tagline: 'Rose + Chocolate + Love Letter',
      },
      {
        id: 'val-lux',
        name: 'Valentine Luxe',
        emoji: '💎',
        items: [
          { emoji: '💐', name: 'Rose Bouquet', coins: 60 },
          { emoji: '💍', name: 'Ring', coins: 200 },
          { emoji: '🥂', name: 'Champagne', coins: 100 },
        ],
        discountPct: 25,
        tagline: 'Bouquet + Ring + Champagne',
      },
    ],
    templates: [
      { id: 'val-t1', name: 'Rose Rain',      description: 'Petals of red roses cascade across the screen while a soft violin plays.', emoji: '🌹', thumbnailBg: 'linear-gradient(135deg, #fecdd3, #f43f5e)' },
      { id: 'val-t2', name: 'Heart Explosion',description: 'A giant heart bursts open into hundreds of tiny hearts + sparkles.', emoji: '💥',  thumbnailBg: 'linear-gradient(135deg, #fbcfe8, #ec4899)' },
      { id: 'val-t3', name: 'Love Letter',    description: 'An envelope flies in, seals itself with a wax heart, then unfolds your message.', emoji: '💌', thumbnailBg: 'linear-gradient(135deg, #fef3c7, #f472b6)', premium: true, coins: 20 },
      { id: 'val-t4', name: 'Starry Night',   description: 'Two silhouettes under a starry sky — shooting stars spell "I love you".', emoji: '✨', thumbnailBg: 'linear-gradient(135deg, #1e293b, #6366f1)', premium: true, coins: 30 },
    ],
  },
  {
    id: 'womens-day',
    name: "International Women's Day",
    emoji: '🌷',
    themeColor: '#f472b6',
    bgGradient: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)',
    date: { month: 3, day: 8 },
    windowDays: 14,
    description: 'Celebrate the women in your life',
    gifts: [
      { emoji: '🌷', name: 'Tulip',      coins: 15 },
      { emoji: '🌸', name: 'Sakura',     coins: 20 },
      { emoji: '💐', name: 'Bouquet',    coins: 60 },
      { emoji: '💄', name: 'Lipstick',   coins: 40 },
      { emoji: '💝', name: 'Present',    coins: 30 },
      { emoji: '🍰', name: 'Small Cake', coins: 20 },
    ],
    bundles: [
      {
        id: '83-bloom',
        name: '8/3 Bloom Basket',
        emoji: '💐',
        items: [
          { emoji: '🌷', name: 'Tulip', coins: 15 },
          { emoji: '🌸', name: 'Sakura', coins: 20 },
          { emoji: '🍰', name: 'Small Cake', coins: 20 },
        ],
        discountPct: 25,
        tagline: 'Blooms + small cake',
      },
    ],
  },
  {
    id: 'vietnam-womens-day',
    name: 'Vietnam Women’s Day',
    emoji: '🌺',
    themeColor: '#e11d48',
    bgGradient: 'linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)',
    date: { month: 10, day: 20 },
    windowDays: 14,
    description: 'Celebrate Vietnamese women',
    gifts: [
      { emoji: '🌺', name: 'Hibiscus', coins: 15 },
      { emoji: '🌹', name: 'Rose',     coins: 20 },
      { emoji: '💐', name: 'Bouquet',  coins: 60 },
      { emoji: '💍', name: 'Bracelet', coins: 100 },
      { emoji: '🎂', name: 'Cake',     coins: 30 },
    ],
    bundles: [
      {
        id: '2010-classic',
        name: '20/10 Classic',
        emoji: '🌺',
        items: [
          { emoji: '🌹', name: 'Rose', coins: 20 },
          { emoji: '🎂', name: 'Cake', coins: 30 },
          { emoji: '🌺', name: 'Hibiscus', coins: 15 },
        ],
        discountPct: 30,
        tagline: 'Rose + cake + hibiscus',
      },
    ],
  },
  {
    id: 'mid-autumn',
    name: 'Mid-Autumn Festival',
    emoji: '🥮',
    themeColor: '#f97316',
    bgGradient: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
    date: { month: 9, day: 17 }, // approx for lunar 15/8, adjust yearly
    isLunar: true,
    windowDays: 14,
    description: 'Moon cakes & lanterns',
    gifts: [
      { emoji: '🥮', name: 'Moon Cake', coins: 25 },
      { emoji: '🏮', name: 'Lantern',   coins: 15 },
      { emoji: '🌝', name: 'Full Moon', coins: 10 },
      { emoji: '🍵', name: 'Tea',       coins: 8 },
      { emoji: '🎮', name: 'Kids Toy',  coins: 20 },
    ],
    bundles: [
      {
        id: 'ta-family',
        name: 'Mid-Autumn Family Set',
        emoji: '🥮',
        items: [
          { emoji: '🥮', name: 'Moon Cake', coins: 25 },
          { emoji: '🏮', name: 'Lantern', coins: 15 },
          { emoji: '🍵', name: 'Tea', coins: 8 },
        ],
        discountPct: 25,
        tagline: 'Moon cake + lantern + tea',
      },
    ],
  },
  {
    id: 'christmas',
    name: 'Christmas',
    emoji: '🎄',
    themeColor: '#dc2626',
    bgGradient: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 50%, #dcfce7 100%)',
    date: { month: 12, day: 25 },
    windowDays: 30,
    description: 'The season of giving',
    gifts: [
      { emoji: '🎅', name: 'Santa',          coins: 20 },
      { emoji: '🎄', name: 'Christmas Tree', coins: 15 },
      { emoji: '🧊', name: 'Snow',           coins: 5 },
      { emoji: '💝', name: 'Wrapped Gift',   coins: 30 },
      { emoji: '🔔', name: 'Bell',           coins: 8 },
      { emoji: '☃️', name: 'Snowman',        coins: 12 },
      { emoji: '🦌', name: 'Reindeer',       coins: 25 },
    ],
    bundles: [
      {
        id: 'xmas-eve',
        name: 'Christmas Eve Combo',
        emoji: '🎄',
        items: [
          { emoji: '🎅', name: 'Santa', coins: 20 },
          { emoji: '🎄', name: 'Tree', coins: 15 },
          { emoji: '💝', name: 'Wrapped Gift', coins: 30 },
          { emoji: '🔔', name: 'Bell', coins: 8 },
        ],
        discountPct: 30,
        tagline: 'Santa + tree + gift + bell',
      },
      {
        id: 'xmas-cozy',
        name: 'Cozy Christmas',
        emoji: '☃️',
        items: [
          { emoji: '🧊', name: 'Snow', coins: 5 },
          { emoji: '☃️', name: 'Snowman', coins: 12 },
          { emoji: '🦌', name: 'Reindeer', coins: 25 },
        ],
        discountPct: 20,
        tagline: 'Snow + snowman + reindeer',
      },
    ],
    templates: [
      { id: 'xmas-t1', name: 'Snow Fall',     description: 'Soft snowflakes drift down over a warmly lit tree.',   emoji: '❄️', thumbnailBg: 'linear-gradient(135deg, #e0e7ff, #6366f1)' },
      { id: 'xmas-t2', name: 'Santa Delivery',description: 'Santa flies past in his sleigh dropping a wrapped gift.', emoji: '🎅', thumbnailBg: 'linear-gradient(135deg, #dcfce7, #dc2626)' },
      { id: 'xmas-t3', name: 'Fireplace',     description: 'A cozy fireplace with stockings — flames flicker warmly.', emoji: '🔥', thumbnailBg: 'linear-gradient(135deg, #fee2e2, #dc2626)', premium: true, coins: 15 },
    ],
  },
  {
    id: 'tet',
    name: 'Lunar New Year',
    emoji: '🧧',
    themeColor: '#dc2626',
    bgGradient: 'linear-gradient(135deg, #fef2f2 0%, #fca5a5 50%, #fbbf24 100%)',
    date: { month: 1, day: 29 }, // approx Lunar year start, update annually
    isLunar: true,
    windowDays: 30,
    description: 'Ring in the Lunar New Year',
    gifts: [
      { emoji: '🧧', name: 'Red Envelope', coins: 20 },
      { emoji: '🍵', name: 'Tea',           coins: 8 },
      { emoji: '🌵', name: 'Kumquat Tree',  coins: 30 },
      { emoji: '🌸', name: 'Peach Blossom', coins: 20 },
      { emoji: '🎇', name: 'Firecracker',   coins: 15 },
      { emoji: '🍙', name: 'Rice Cake',     coins: 25 },
    ],
    bundles: [
      {
        id: 'tet-family',
        name: 'Tết Family',
        emoji: '🧧',
        items: [
          { emoji: '🧧', name: 'Red Envelope', coins: 20 },
          { emoji: '🌵', name: 'Kumquat', coins: 30 },
          { emoji: '🍙', name: 'Rice Cake', coins: 25 },
        ],
        discountPct: 30,
        tagline: 'Red envelope + kumquat + rice cake',
      },
    ],
  },

  // ─── Evergreen occasions (no fixed date) ───

  {
    id: 'birthday',
    name: 'Birthday',
    emoji: '🎂',
    themeColor: '#f97316',
    bgGradient: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
    date: { month: 1, day: 1 },
    evergreen: true,
    windowDays: 0,
    description: 'Happy birthday wishes',
    gifts: [
      { emoji: '🎂', name: 'Birthday Cake', coins: 30 },
      { emoji: '🕯️', name: 'Candle',        coins: 5 },
      { emoji: '🎈', name: 'Balloon',       coins: 8 },
      { emoji: '🎁', name: 'Gift Box',      coins: 25 },
      { emoji: '🎉', name: 'Party Popper',  coins: 10 },
      { emoji: '🍾', name: 'Champagne',     coins: 60 },
      { emoji: '🥳', name: 'Party Face',    coins: 5 },
    ],
    bundles: [
      {
        id: 'bday-party',
        name: 'Birthday Party',
        emoji: '🎉',
        items: [
          { emoji: '🎂', name: 'Cake', coins: 30 },
          { emoji: '🎈', name: 'Balloon', coins: 8 },
          { emoji: '🎁', name: 'Gift Box', coins: 25 },
        ],
        discountPct: 25,
        tagline: 'Cake + balloon + gift',
      },
    ],
    templates: [
      { id: 'bday-t1', name: 'Party Popper',   description: 'Confetti bursts from every direction, balloons drift up.', emoji: '🎉', thumbnailBg: 'linear-gradient(135deg, #fef3c7, #f97316)' },
      { id: 'bday-t2', name: 'Elegant Candles',description: 'Soft candle glow around a golden cake — quiet birthday wish.', emoji: '🕯️', thumbnailBg: 'linear-gradient(135deg, #fef3c7, #d97706)' },
      { id: 'bday-t3', name: 'Balloon Rain',   description: 'Colorful balloons rain down, dove delivers wrapped gift.', emoji: '🎈', thumbnailBg: 'linear-gradient(135deg, #dbeafe, #ec4899)' },
      { id: 'bday-t4', name: 'Cake Reveal',    description: 'Cinematic cake reveal with slow-mo candle blow-out.', emoji: '🎂', thumbnailBg: 'linear-gradient(135deg, #fce7f3, #db2777)', premium: true, coins: 25 },
    ],
  },
  {
    id: 'sorry',
    name: 'Sorry',
    emoji: '🙏',
    themeColor: '#8b5cf6',
    bgGradient: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
    date: { month: 1, day: 1 },
    evergreen: true,
    windowDays: 0,
    description: 'Say you’re sorry',
    gifts: [
      { emoji: '🙏', name: 'Apology',      coins: 5 },
      { emoji: '🌹', name: 'White Rose',   coins: 15 },
      { emoji: '💐', name: 'Bouquet',      coins: 60 },
      { emoji: '🍫', name: 'Chocolate',    coins: 25 },
      { emoji: '💌', name: 'Sorry Letter', coins: 10 },
      { emoji: '🧸', name: 'Teddy Bear',   coins: 40 },
    ],
    bundles: [
      {
        id: 'sorry-apology',
        name: 'Peace Offering',
        emoji: '🙏',
        items: [
          { emoji: '🌹', name: 'Rose', coins: 15 },
          { emoji: '🍫', name: 'Chocolate', coins: 25 },
          { emoji: '💌', name: 'Letter', coins: 10 },
        ],
        discountPct: 25,
        tagline: 'Rose + chocolate + letter',
      },
    ],
    templates: [
      { id: 'sorry-t1', name: 'White Rose',    description: 'A single white rose drifts down over a subtle apology note.', emoji: '🌹', thumbnailBg: 'linear-gradient(135deg, #f5f3ff, #a78bfa)' },
      { id: 'sorry-t2', name: 'Heartfelt Note',description: 'A handwritten "I\'m sorry" letter unfolds slowly.', emoji: '💌', thumbnailBg: 'linear-gradient(135deg, #ede9fe, #8b5cf6)' },
      { id: 'sorry-t3', name: 'Origami Crane', description: 'A paper crane folds itself with your message inside.', emoji: '🕊️', thumbnailBg: 'linear-gradient(135deg, #f3e8ff, #7c3aed)', premium: true, coins: 20 },
    ],
  },
  {
    id: 'proposal',
    name: 'Proposal',
    emoji: '💍',
    themeColor: '#f43f5e',
    bgGradient: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
    date: { month: 1, day: 1 },
    evergreen: true,
    windowDays: 0,
    description: 'Will you marry me?',
    gifts: [
      { emoji: '💍', name: 'Ring',           coins: 200 },
      { emoji: '💐', name: 'Rose Bouquet',   coins: 60 },
      { emoji: '💎', name: 'Diamond',        coins: 500 },
      { emoji: '🥂', name: 'Champagne',      coins: 100 },
      { emoji: '💌', name: 'Proposal Note',  coins: 10 },
      { emoji: '❤️', name: 'Heart',          coins: 15 },
    ],
    bundles: [
      {
        id: 'proposal-grand',
        name: 'The Big Question',
        emoji: '💍',
        items: [
          { emoji: '💍', name: 'Ring', coins: 200 },
          { emoji: '💐', name: 'Rose Bouquet', coins: 60 },
          { emoji: '🥂', name: 'Champagne', coins: 100 },
        ],
        discountPct: 30,
        tagline: 'Ring + bouquet + champagne',
      },
    ],
    templates: [
      { id: 'prop-t1', name: 'Ring Reveal',      description: 'Ring box slowly opens, diamond sparkles fill the screen.', emoji: '💍', thumbnailBg: 'linear-gradient(135deg, #fff1f2, #f43f5e)' },
      { id: 'prop-t2', name: 'Under the Stars',  description: 'Night sky reveals "Will you marry me?" written in stars.', emoji: '⭐', thumbnailBg: 'linear-gradient(135deg, #1e293b, #f43f5e)', premium: true, coins: 40 },
      { id: 'prop-t3', name: 'Petal Path',       description: 'A trail of rose petals leads to a shining ring at the end.', emoji: '🌹', thumbnailBg: 'linear-gradient(135deg, #ffe4e6, #e11d48)', premium: true, coins: 30 },
    ],
  },
  {
    id: 'anniversary',
    name: 'Anniversary',
    emoji: '💑',
    themeColor: '#ec4899',
    bgGradient: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
    date: { month: 1, day: 1 },
    evergreen: true,
    windowDays: 0,
    description: 'Celebrate your milestones',
    gifts: [
      { emoji: '💑', name: 'Couple',        coins: 15 },
      { emoji: '🥂', name: 'Champagne',     coins: 100 },
      { emoji: '🌹', name: 'Rose',          coins: 15 },
      { emoji: '💝', name: 'Gift Heart',    coins: 50 },
      { emoji: '📸', name: 'Photo Frame',   coins: 30 },
      { emoji: '🍰', name: 'Cake',          coins: 30 },
    ],
    bundles: [
      {
        id: 'anniv-classic',
        name: 'Anniversary Classic',
        emoji: '💑',
        items: [
          { emoji: '🌹', name: 'Rose', coins: 15 },
          { emoji: '🥂', name: 'Champagne', coins: 100 },
          { emoji: '🍰', name: 'Cake', coins: 30 },
        ],
        discountPct: 25,
        tagline: 'Rose + champagne + cake',
      },
    ],
  },
  {
    id: 'congrats',
    name: 'Congrats',
    emoji: '🎉',
    themeColor: '#eab308',
    bgGradient: 'linear-gradient(135deg, #fefce8 0%, #fef08a 100%)',
    date: { month: 1, day: 1 },
    evergreen: true,
    windowDays: 0,
    description: 'Cheers to your win',
    gifts: [
      { emoji: '🎉', name: 'Party Popper',  coins: 10 },
      { emoji: '🥂', name: 'Cheers',        coins: 100 },
      { emoji: '🎊', name: 'Confetti',      coins: 8 },
      { emoji: '🏆', name: 'Trophy',        coins: 50 },
      { emoji: '⭐', name: 'Star',          coins: 25 },
      { emoji: '💐', name: 'Bouquet',       coins: 60 },
    ],
    bundles: [],
  },
  {
    id: 'thank-you',
    name: 'Thank You',
    emoji: '🙌',
    themeColor: '#14b8a6',
    bgGradient: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
    date: { month: 1, day: 1 },
    evergreen: true,
    windowDays: 0,
    description: 'Show your appreciation',
    gifts: [
      { emoji: '🙌', name: 'Gratitude',    coins: 5 },
      { emoji: '☕', name: 'Coffee',        coins: 10 },
      { emoji: '🌻', name: 'Sunflower',    coins: 15 },
      { emoji: '🍰', name: 'Small Cake',   coins: 20 },
      { emoji: '💌', name: 'Thank You Note', coins: 10 },
    ],
    bundles: [],
  },
  {
    id: 'miss-you',
    name: 'Miss You',
    emoji: '💌',
    themeColor: '#a855f7',
    bgGradient: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
    date: { month: 1, day: 1 },
    evergreen: true,
    windowDays: 0,
    description: 'Thinking of you',
    gifts: [
      { emoji: '💌', name: 'Letter',        coins: 10 },
      { emoji: '💜', name: 'Purple Heart',  coins: 8 },
      { emoji: '🌙', name: 'Moon',          coins: 5 },
      { emoji: '⭐', name: 'Star',          coins: 25 },
      { emoji: '🧸', name: 'Teddy',         coins: 40 },
    ],
    bundles: [],
  },
  {
    id: 'get-well',
    name: 'Get Well',
    emoji: '🌸',
    themeColor: '#22c55e',
    bgGradient: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    date: { month: 1, day: 1 },
    evergreen: true,
    windowDays: 0,
    description: 'Wishing a speedy recovery',
    gifts: [
      { emoji: '🌸', name: 'Cherry Blossom', coins: 15 },
      { emoji: '🍵', name: 'Warm Tea',       coins: 8 },
      { emoji: '🍲', name: 'Soup',           coins: 15 },
      { emoji: '💐', name: 'Bouquet',        coins: 60 },
      { emoji: '🩹', name: 'Bandage',        coins: 5 },
    ],
    bundles: [],
  },
];
