import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { uploadFile } from '@/lib/storage';

// POST /api/v1/gifts/hearts
//
// Publish a 3D Particle Heart page publicly. Viewable at
// /gifts/heart/{id} with no login — guest publish allowed to
// maximise viral share. Rows land in `public_gift_cards` with
// kind='heart_3d' so the same short-id space + view-count infra
// is reused.
//
// The client sends photos as `photosBase64` data-URL strings. The
// server decodes them, uploads to R2 via uploadFile(), and stores the
// resulting URLs alongside the rest of the heart data in data_json.
// This mirrors POST /api/v1/gifts/cards so guest publish still works
// (the shared /api/v1/upload endpoint requires auth).

const dataSchema = z.object({
  recipientName: z.string().min(1).max(48),
  senderName: z.string().max(48).optional().default(''),
  senderRole: z.enum(['anh', 'em']).optional().default('anh'),
  // `messages` used to power the vortex overlay — removed from the UI
  // in favour of the cleaner drone-only composition. Kept optional so
  // hearts published before the rewrite still deserialise fine.
  messages: z.array(z.string().min(1).max(140)).max(40).optional().default([]),
  heartColor: z.enum(['pink', 'red', 'gold']).optional().default('pink'),
  bgMusic: z.string().url().max(500).nullable().optional(),
});

const bodySchema = z.object({
  data: dataSchema,
  // At most one photo — displayed circle-cropped INSIDE the drone-
  // formed heart. ~1.8MB base64 = ~1.3MB raw, matches
  // CoupleCardBuilder's cap. Existing rows with 2 photos still fetch
  // fine; the viewer just renders the first.
  photosBase64: z.array(z.string().max(2_500_000)).max(1).optional().default([]),
});

function newShortId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr = new Uint8Array(10);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}

/** Decode a data URL and upload to R2. Returns the public URL, or null
 *  on any failure (bad format, R2 rejection). Failures are logged but
 *  the publish flow continues without the failed photo — we'd rather
 *  ship a heart with one photo than block the whole card. */
async function uploadDataUrl(dataUrl: string): Promise<string | null> {
  try {
    const m = dataUrl.match(/^data:(image\/[a-z0-9+.-]+);base64,(.*)$/i);
    if (!m) return null;
    const contentType = m[1];
    const b64 = m[2];
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const ext =
      contentType === 'image/png' ? 'png'
      : contentType === 'image/webp' ? 'webp'
      : 'jpg';
    const filename = `gift-hearts/${newShortId()}.${ext}`;
    return await uploadFile(filename, bin.buffer, contentType);
  } catch (e) {
    console.error('[particle-heart photo upload]', e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: parsed.error.issues[0].message } },
      { status: 400 },
    );
  }

  const userId = await resolveUserId(req).catch(() => null);

  // Upload all provided photos in parallel. Failed uploads become
  // nulls, filtered out before we persist.
  const photoUrls = (
    await Promise.all(
      (parsed.data.photosBase64 || []).map(uploadDataUrl),
    )
  ).filter((u): u is string => !!u);

  // Merge photoUrls into the data payload so a single JSON blob holds
  // everything the viewer needs.
  const dataToStore = {
    ...parsed.data.data,
    photoUrls,
  };

  const db = getDB();
  const now = new Date().toISOString();
  for (let attempt = 0; attempt < 4; attempt++) {
    const id = newShortId();
    try {
      await db
        .prepare(
          `INSERT INTO public_gift_cards
             (id, kind, data_json, photo_url, creator_id, view_count, created_at)
           VALUES (?, 'heart_3d', ?, ?, ?, 0, ?)`,
        )
        .bind(
          id,
          JSON.stringify(dataToStore),
          // Also mirror the first photo into the photo_url column so the
          // marketplace/dashboard row-summary can render a thumbnail
          // without decoding data_json.
          photoUrls[0] ?? null,
          userId,
          now,
        )
        .run();
      const origin = new URL(req.url).origin;
      return NextResponse.json({
        data: {
          id,
          url: `${origin}/gifts/heart/${id}`,
          photoUrls,
        },
      }, { status: 201 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < 3 && /UNIQUE|constraint/i.test(msg)) continue;
      console.error('[particle-heart create]', err);
      return NextResponse.json(
        { error: { code: 'internal_error', message: 'Could not publish heart' } },
        { status: 500 },
      );
    }
  }
  return NextResponse.json(
    { error: { code: 'id_collision', message: 'Retry the publish' } },
    { status: 503 },
  );
}
