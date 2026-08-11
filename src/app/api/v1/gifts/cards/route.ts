import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { uploadFile } from '@/lib/storage';

// POST /api/v1/gifts/cards
//
// Publish a Gao Gift card publicly. The card becomes viewable at
// /gifts/card/{id} without login — the goal is a shareable link that
// spreads socially, so we intentionally allow guest publish (no auth
// required, but if the caller IS logged in we attach the user id for
// their "my published cards" list).
//
// Body:
//   {
//     kind: 'couple_card',
//     data: { name1, name2, cardId, issueDate, expiryDate, variant,
//             togetherSince, milestones },
//     photoBase64?: string   // data:image/... URL, client-side compressed
//   }

const milestoneSchema = z.object({
  emoji: z.string().max(4),
  date: z.string().max(20),
  label: z.string().max(80),
});

const dataSchema = z.object({
  name1: z.string().max(48),
  name2: z.string().max(48),
  cardId: z.string().max(24),
  issueDate: z.string().max(20),
  expiryDate: z.string().max(20),
  variant: z.enum(['classic', 'noir', 'rose']).optional(),
  togetherSince: z.string().max(20).nullable().optional(),
  milestones: z.array(milestoneSchema).max(6).optional(),
});

const bodySchema = z.object({
  kind: z.literal('couple_card'),
  data: dataSchema,
  photoBase64: z.string().max(2_500_000).optional(),  // ~1.8MB base64 = 1.3MB raw
});

/** Short-ID generator — 10-char base62 alphabet, ~62^10 = 8.4e17 keys.
 *  Uses `crypto.getRandomValues` for uniform distribution. Collisions
 *  are practically impossible at our scale, but we still verify against
 *  the DB before inserting. */
function newShortId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr = new Uint8Array(10);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
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

  // Optional auth — we attach the user id if present so the creator
  // can find their card later, but publishing works for guests too.
  const userId = await resolveUserId(req).catch(() => null);

  // Upload photo if provided. We accept a data URL so the client can
  // compress it before sending (see CoupleCardBuilder). Failures don't
  // block card creation — the card just publishes without a photo.
  let photoUrl: string | null = null;
  if (parsed.data.photoBase64) {
    try {
      const m = parsed.data.photoBase64.match(/^data:(image\/[a-z0-9+.-]+);base64,(.*)$/i);
      if (!m) throw new Error('Photo must be a data URL');
      const contentType = m[1];
      const b64 = m[2];
      const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const ext = contentType === 'image/png' ? 'png'
        : contentType === 'image/webp' ? 'webp'
        : 'jpg';
      const filename = `gift-cards/${newShortId()}.${ext}`;
      photoUrl = await uploadFile(filename, bin.buffer, contentType);
    } catch (e) {
      console.error('[public gift card photo upload]', e);
      // Continue without photo — the card still publishes.
    }
  }

  const db = getDB();

  // Retry a small number of times on the astronomical chance of a
  // collision. Insert-or-ignore + re-check is simpler than SELECT-then-
  // INSERT (avoids TOCTOU) but D1 doesn't support ON CONFLICT DO NOTHING
  // in all versions, so we use a plain INSERT + collision retry.
  const now = new Date().toISOString();
  for (let attempt = 0; attempt < 4; attempt++) {
    const id = newShortId();
    try {
      await db
        .prepare(
          `INSERT INTO public_gift_cards
             (id, kind, data_json, photo_url, creator_id, view_count, created_at)
           VALUES (?, ?, ?, ?, ?, 0, ?)`,
        )
        .bind(
          id,
          parsed.data.kind,
          JSON.stringify(parsed.data.data),
          photoUrl,
          userId,
          now,
        )
        .run();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const origin = new URL(req.url).origin;
      return NextResponse.json({
        data: {
          id,
          url: `${origin}/gifts/card/${id}`,
          photo_url: photoUrl,
        },
      }, { status: 201 });
    } catch (err) {
      // Only retry on unique-constraint collision; other errors bubble.
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < 3 && /UNIQUE|constraint/i.test(msg)) continue;
      console.error('[public gift card create]', err);
      return NextResponse.json(
        { error: { code: 'internal_error', message: 'Could not publish card' } },
        { status: 500 },
      );
    }
  }
  return NextResponse.json(
    { error: { code: 'id_collision', message: 'Retry the publish' } },
    { status: 503 },
  );
}
