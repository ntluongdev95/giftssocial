import { z } from 'zod';

// Normalize a string for diacritic-free search (used by trips.title_normalized
// / city_normalized columns and by the search route to normalize the query).
// "Cô Tô 3 ngày" → "co to 3 ngay". Keep this stable — both sides of the LIKE
// comparison rely on identical output.
export function normalizeForSearch(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

export const stopSchema = z.object({
  place_name: z.string().min(1).max(200),
  activity: z.string().max(200).default(''),
  cost: z.number().nonnegative().default(0),
  cost_currency: z.string().min(2).max(8).default('VND'),
  duration_minutes: z.number().int().nonnegative().max(60 * 24 * 7).default(0),
  notes: z.string().max(1000).default(''),
  photos: z.array(z.string().url()).max(10).default([]),
  place_lat: z.number().min(-90).max(90).nullable().optional(),
  place_lng: z.number().min(-180).max(180).nullable().optional(),
});

export const tripCreateSchema = z.object({
  title: z.string().min(1).max(200),
  cover_image: z.string().nullable().optional(),
  description: z.string().max(2000).default(''),
  city: z.string().max(100).nullable().optional(),
  visibility: z.enum(['public', 'friends', 'private']).default('public'),
  stops: z.array(stopSchema).min(1).max(20),
});

export type StopInput = z.infer<typeof stopSchema>;

// Roll up totals from the stops. If currencies differ, mark `total_currency`
// as 'mixed' and zero `total_cost` — the UI shows per-stop costs instead of
// a single sum to avoid fake conversions.
export function rollupTotals(stops: StopInput[]): {
  total_cost: number;
  total_currency: string;
  total_minutes: number;
} {
  const currencies = new Set(stops.filter(s => s.cost > 0).map(s => s.cost_currency));
  const totalMinutes = stops.reduce((acc, s) => acc + (s.duration_minutes ?? 0), 0);
  if (currencies.size === 0) {
    return { total_cost: 0, total_currency: 'VND', total_minutes: totalMinutes };
  }
  if (currencies.size > 1) {
    return { total_cost: 0, total_currency: 'mixed', total_minutes: totalMinutes };
  }
  const currency = currencies.values().next().value as string;
  const cost = stops.reduce((acc, s) => acc + (s.cost ?? 0), 0);
  return { total_cost: cost, total_currency: currency, total_minutes: totalMinutes };
}
