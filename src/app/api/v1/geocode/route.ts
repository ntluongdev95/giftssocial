import { NextRequest, NextResponse } from 'next/server';
import { getKV } from '@/lib/db';

// ─── GET /api/v1/geocode?q=... — address search proxy ───────────────────
// Server-side proxy for address autocomplete, backed by MapTiler's
// Geocoding API (same provider + API key already used for the map tiles —
// no new vendor, no separate billing relationship).
//
// Nominatim (OpenStreetMap) was tried first but its domain doesn't
// resolve from this deployment's network at all (DNS NXDOMAIN) — not a
// code bug, just unreachable from here. MapTiler is already a confirmed
// reachable host.
//
// Kept server-side (not called directly from the browser) so results can
// be cached in KV — the same query (popular cities repeat a lot) doesn't
// re-hit the paid MapTiler API every time, keeping usage cheap as it scales.

interface MaptilerContext {
  id: string; // e.g. "region.816", "place.4052112", "country.178"
  text: string;
}

interface MaptilerFeature {
  place_name: string;
  center: [number, number]; // [lon, lat]
  context?: MaptilerContext[];
}

const CACHE_TTL_SEC = 30 * 24 * 60 * 60; // 30 days — addresses/cities don't move

/** Best-effort "city" name from a feature's context chain — mirrors the
 * city → town/place → country fallback the old Nominatim code used. */
function cityFromContext(context: MaptilerContext[] | undefined): string | null {
  if (!context) return null;
  const region = context.find((c) => c.id.startsWith('region.'));
  if (region) return region.text;
  const place = context.find((c) => c.id.startsWith('place.'));
  if (place) return place.text;
  const country = context.find((c) => c.id.startsWith('country.'));
  return country?.text ?? null;
}

export async function GET(req: NextRequest) {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!key) return NextResponse.json({ data: [] });

  const lat = req.nextUrl.searchParams.get('lat');
  const lon = req.nextUrl.searchParams.get('lon');

  // ── Reverse mode: ?lat=&lon= → { city } ──
  if (lat && lon) {
    const cacheKey = `geocode:rev:${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;
    try {
      const kv = getKV();
      const cached = await kv.get(cacheKey);
      if (cached) return NextResponse.json({ city: cached, cached: true });
    } catch { /* KV down — fall through to live lookup */ }

    try {
      const res = await fetch(`https://api.maptiler.com/geocoding/${lon},${lat}.json?key=${key}`);
      if (!res.ok) return NextResponse.json({ city: null });
      const raw = (await res.json()) as { features?: MaptilerFeature[] };
      const city = cityFromContext(raw.features?.[0]?.context) ?? null;

      if (city) {
        try {
          const kv = getKV();
          await kv.put(cacheKey, city, { expirationTtl: CACHE_TTL_SEC });
        } catch { /* KV down — still return the live result */ }
      }
      return NextResponse.json({ city });
    } catch (err) {
      console.error('[Geocode GET reverse]', err);
      return NextResponse.json({ city: null });
    }
  }

  // ── Forward mode: ?q=... → address suggestions ──
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ data: [] });

  const cacheKey = `geocode:${q.toLowerCase()}`;

  try {
    const kv = getKV();
    const cached = await kv.get(cacheKey);
    if (cached) {
      return NextResponse.json({ data: JSON.parse(cached as string), cached: true });
    }
  } catch { /* KV down — fall through to live lookup */ }

  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${key}&limit=5`,
    );
    if (!res.ok) return NextResponse.json({ data: [] });
    const raw = (await res.json()) as { features?: MaptilerFeature[] };
    const data = (raw.features ?? []).map((f) => ({
      display_name: f.place_name,
      lat: String(f.center[1]),
      lon: String(f.center[0]),
    }));

    try {
      const kv = getKV();
      await kv.put(cacheKey, JSON.stringify(data), { expirationTtl: CACHE_TTL_SEC });
    } catch { /* KV down — still return the live result */ }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[Geocode GET]', err);
    return NextResponse.json({ data: [] });
  }
}
