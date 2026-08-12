import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

// GET /api/v1/occasions
// Returns every active occasion with its templates joined in — one
// round-trip for the whole picker. Ordered by occasions.sort_order,
// templates within each occasion by template_occasions.sort_order.
//
// Shape:
// {
//   data: [
//     {
//       id, name, name_vi, emoji, theme_color, bg_gradient,
//       description, date: { month, day } | null, is_lunar, evergreen,
//       window_days,
//       templates: [
//         { id, component_key, name, description, emoji, thumbnail_bg,
//           thumbnail_url, preview_video, accent_color, premium, coins,
//           featured, has_component (derived at render-time on the client) }
//       ]
//     }
//   ]
// }
export async function GET() {
  try {
    const db = getDB();

    const [occRes, tplRes] = await Promise.all([
      db.prepare(
        `SELECT id, name, name_vi, emoji, theme_color, bg_gradient,
                description, description_vi, date_month, date_day,
                is_lunar, evergreen, window_days, sort_order
         FROM occasions
         WHERE active = 1
         ORDER BY sort_order, name`
      ).all<Record<string, unknown>>(),
      db.prepare(
        `SELECT t.id, t.component_key, t.name, t.name_vi, t.description,
                t.description_vi, t.emoji, t.thumbnail_bg, t.thumbnail_url,
                t.preview_video, t.accent_color, t.premium, t.coins,
                t.uses_count, t.fields_schema, t.effects,
                to_.occasion_id, to_.sort_order AS occ_sort,
                to_.featured
         FROM templates t
         JOIN template_occasions to_ ON to_.template_id = t.id
         WHERE t.active = 1
         ORDER BY to_.occasion_id, to_.sort_order`
      ).all<Record<string, unknown>>(),
    ]);

    // Group templates by occasion_id
    const templatesByOccasion = new Map<string, Record<string, unknown>[]>();
    for (const t of tplRes.results) {
      const occId = t.occasion_id as string;
      const list = templatesByOccasion.get(occId) ?? [];
      list.push(t);
      templatesByOccasion.set(occId, list);
    }

    const occasions = occRes.results.map(o => ({
      id: o.id,
      name: o.name,
      name_vi: o.name_vi,
      emoji: o.emoji,
      theme_color: o.theme_color,
      bg_gradient: o.bg_gradient,
      description: o.description,
      description_vi: o.description_vi,
      date: (o.date_month && o.date_day) ? { month: o.date_month, day: o.date_day } : null,
      is_lunar: o.is_lunar === 1,
      evergreen: o.evergreen === 1,
      window_days: o.window_days,
      templates: templatesByOccasion.get(o.id as string) ?? [],
    }));

    return NextResponse.json({ data: occasions });
  } catch (err) {
    console.error('[Occasions GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch occasions' } }, { status: 500 });
  }
}
