import { NextRequest, NextResponse } from 'next/server';
import { BOND_BREEDS_CATALOG } from '@/lib/bond-breeds-catalog';

// GET /api/v1/bond-breeds/[species]
//
// Returns a list of breed variants for a species. Dogs + cats hit live
// public APIs (Dog CEO, The Cat API). Everything else falls back to the
// hardcoded catalog. Response shape is normalised:
//
//   { id, label, image_url, personality? }[]
//
// `species` is the emoji codepoint as a single-character path segment —
// e.g. /api/v1/bond-breeds/🐕 . URL-encoded by the browser automatically.
//
// Response is cached by the CDN for 24h since breed lists rarely change.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ species: string }> },
) {
  const { species } = await params;
  const decoded = decodeURIComponent(species);

  try {
    let breeds: Array<{ id: string; label: string; image_url: string; personality?: string }> = [];

    if (decoded === '🐕') {
      breeds = await listDogBreeds();
    } else if (decoded === '🐈') {
      breeds = await listCatBreeds();
    } else {
      const fallback = BOND_BREEDS_CATALOG[decoded];
      breeds = fallback ?? [];
    }

    return NextResponse.json(
      { data: breeds },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    );
  } catch (err) {
    console.error('[Bond breeds GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch breeds' } },
      { status: 500 },
    );
  }
}

// ── Dog CEO ─────────────────────────────────────────────────────────────
// Returns { "labrador": [], "spaniel": ["cocker", "irish"], ... }
// We flatten sub-breeds into "spaniel-cocker" style ids, then fetch a
// thumbnail per breed via /breed/{breed}/images/random. We curate to
// the ~20 most popular breeds so the picker isn't a 200-row scroll.

const DOG_FEATURED: ReadonlyArray<{ id: string; label: string; apiPath: string }> = [
  { id: 'corgi',           label: 'Corgi',             apiPath: 'corgi/cardigan' },
  { id: 'golden',          label: 'Golden Retriever',  apiPath: 'retriever/golden' },
  { id: 'husky',           label: 'Husky',             apiPath: 'husky' },
  { id: 'shiba',           label: 'Shiba Inu',         apiPath: 'shiba' },
  { id: 'frenchie',        label: 'French Bulldog',    apiPath: 'bulldog/french' },
  { id: 'pug',             label: 'Pug',               apiPath: 'pug' },
  { id: 'samoyed',         label: 'Samoyed',           apiPath: 'samoyed' },
  { id: 'pomeranian',      label: 'Pomeranian',        apiPath: 'pomeranian' },
  { id: 'dalmatian',       label: 'Dalmatian',         apiPath: 'dalmatian' },
  { id: 'beagle',          label: 'Beagle',            apiPath: 'beagle' },
  { id: 'chihuahua',       label: 'Chihuahua',         apiPath: 'chihuahua' },
  { id: 'doberman',        label: 'Doberman',          apiPath: 'doberman' },
];

async function listDogBreeds() {
  // Fetch a random photo for each curated breed in parallel.
  const results = await Promise.allSettled(
    DOG_FEATURED.map(async b => {
      const r = await fetch(`https://dog.ceo/api/breed/${b.apiPath}/images/random`, {
        next: { revalidate: 86400 },
      });
      if (!r.ok) throw new Error(`${b.id} ${r.status}`);
      const j = (await r.json()) as { message: string; status: string };
      return { id: b.id, label: b.label, image_url: j.message };
    }),
  );
  // Drop any that failed (rare — Dog CEO is reliable but we don't want
  // one slow breed to break the whole picker).
  return results
    .filter((r): r is PromiseFulfilledResult<{ id: string; label: string; image_url: string }> => r.status === 'fulfilled')
    .map(r => r.value);
}

// ── The Cat API ─────────────────────────────────────────────────────────
// `/v1/breeds` returns full list with .image.url included on most rows.
// Free tier works without an API key for low volume. If `CAT_API_KEY` env
// is set, we pass it as `x-api-key` for higher limits.

async function listCatBreeds() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { env } = await import('@opennextjs/cloudflare').then(m => (m as any).getCloudflareContext()) as { env: Record<string, string | undefined> };
  const apiKey = env.CAT_API_KEY?.trim();

  const r = await fetch('https://api.thecatapi.com/v1/breeds?limit=20', {
    headers: apiKey ? { 'x-api-key': apiKey } : undefined,
    next: { revalidate: 86400 },
  });
  if (!r.ok) return [];
  const list = (await r.json()) as Array<{
    id: string;
    name: string;
    image?: { url: string };
    description?: string;
  }>;
  // Filter to breeds that ship an image — without one we'd render an
  // empty card. Cap at 12 for a tidy picker.
  return list
    .filter(b => !!b.image?.url)
    .slice(0, 12)
    .map(b => ({
      id: b.id,
      label: b.name,
      image_url: b.image!.url,
      personality: b.description?.split('.')[0]?.slice(0, 60),
    }));
}
