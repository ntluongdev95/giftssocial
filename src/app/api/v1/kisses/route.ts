import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB, genId } from '@/lib/db';
import type { KissRow } from '@/types/d1';
import { resolveUserId } from '@/lib/resolveUser';
import { notify } from '@/lib/notify';
import { isValidSlug, SLUG_MIN, SLUG_MAX } from '@/lib/kiss-slug';
import { verifyNearFunctionCall, sha256Hex } from '@/lib/near/verify-tx';

// ─── GET /api/v1/kisses — List public kisses (for globe) ───────────────

// near_claim_secret (migration-040) must never leave this endpoint —
// it's the real access control for claiming a money gift, and this
// list is read by everyone browsing the globe feed, not just a kiss's
// own sender/receiver. Applied uniformly across every branch below
// rather than selectively, so a future branch can't forget it.
function stripClaimSecrets(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  for (const row of rows) delete row.near_claim_secret;
  return rows;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const mine = searchParams.get('mine') === 'true';
    const sent = searchParams.get('sent') === 'true'; // sent-only (no 24h filter)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const userId = await resolveUserId(req).catch(() => null);

    const db = getDB();

    if (sent && userId) {
      // ONLY sent kisses — full history so user can revisit QR codes.
      // No 24h/opened filter here; QR sharing is a long-lived flow.
      const result = await db.prepare(
        `SELECT k.*,
          COALESCE(r.display_name, k.receiver_name) AS receiver_name, r.avatar_url AS receiver_avatar
         FROM kisses k
         LEFT JOIN users r ON r.id = k.receiver_id
         WHERE k.sender_id = ?
         ORDER BY k.created_at DESC LIMIT ?`
      ).bind(userId, limit).all<Record<string, unknown>>();
      return NextResponse.json({ data: stripClaimSecrets(result.results) });
    } else if (mine && userId) {
      // My kisses (sent + received) — only within 24h or already opened
      const result = await db.prepare(
        `SELECT k.*,
          s.display_name AS sender_name, s.avatar_url AS sender_avatar,
          COALESCE(r.display_name, k.receiver_name) AS receiver_name, r.avatar_url AS receiver_avatar
         FROM kisses k
         LEFT JOIN users s ON s.id = k.sender_id
         LEFT JOIN users r ON r.id = k.receiver_id
         WHERE (k.sender_id = ? OR k.receiver_id = ?)
           AND (k.opened = 1 OR k.created_at > datetime('now', '-1 day'))
         ORDER BY k.created_at DESC LIMIT ?`
      ).bind(userId, userId, limit).all<Record<string, unknown>>();
      return NextResponse.json({ data: stripClaimSecrets(result.results) });
    } else if (userId) {
      // Public kisses + my private kisses — hide expired unopened
      const result = await db.prepare(
        `SELECT k.*,
          s.display_name AS sender_name, s.avatar_url AS sender_avatar,
          COALESCE(r.display_name, k.receiver_name) AS receiver_name, r.avatar_url AS receiver_avatar
         FROM kisses k
         LEFT JOIN users s ON s.id = k.sender_id
         LEFT JOIN users r ON r.id = k.receiver_id
         WHERE k.created_at > datetime('now', '-7 days')
           AND (k.opened = 1 OR k.created_at > datetime('now', '-1 day'))
           AND (k.visibility = 'public' OR k.sender_id = ? OR k.receiver_id = ?)
         ORDER BY k.created_at DESC LIMIT ?`
      ).bind(userId, userId, limit).all<Record<string, unknown>>();
      return NextResponse.json({ data: stripClaimSecrets(result.results) });
    } else {
      // Not logged in — public only, hide expired
      const result = await db.prepare(
        `SELECT k.*,
          s.display_name AS sender_name, s.avatar_url AS sender_avatar,
          COALESCE(r.display_name, k.receiver_name) AS receiver_name, r.avatar_url AS receiver_avatar
         FROM kisses k
         LEFT JOIN users s ON s.id = k.sender_id
         LEFT JOIN users r ON r.id = k.receiver_id
         WHERE k.visibility = 'public'
           AND (k.opened = 1 OR k.created_at > datetime('now', '-1 day'))
           AND k.created_at > datetime('now', '-7 days')
         ORDER BY k.created_at DESC LIMIT ?`
      ).bind(limit).all<Record<string, unknown>>();
      return NextResponse.json({ data: stripClaimSecrets(result.results) });
    }
  } catch (err) {
    console.error('[Kisses GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}

// ─── POST /api/v1/kisses — Send a kiss ──────────────────────────────────

const kissSchema = z.object({
  // Either an existing user (receiver_id) OR a guest recipient identified
  // by name + geocoded address (receiver_name/receiver_lat/receiver_lng) —
  // the business model only requires the SENDER to have an account.
  receiver_id: z.string().min(1).optional(),
  receiver_name: z.string().min(1).max(80).optional(),
  receiver_address: z.string().max(300).optional(),
  message: z.string().max(500).default(''),
  emoji: z.string().max(10).default('💋'),
  visibility: z.enum(['public', 'private']).default('public'),
  kiss_type: z.enum(['kiss', 'declaration']).default('kiss'),
  receiver_lat: z.number().optional(),
  receiver_lng: z.number().optional(),
  // Occasion enrichments (optional): up to 3 photo URLs + 1 music track.
  // Accepts absolute URLs (R2 uploads) or relative paths (bundled audio
  // like /audio/*.mp3) — hence plain `.string()` with a length cap.
  photos: z.array(z.string().max(500)).max(2).default([]),
  music_url: z.string().max(500).optional(),
  music_title: z.string().max(120).optional(),
  // Reveal template plugin ID (from src/components/reveals/_registry.ts)
  template_id: z.string().max(60).optional(),
  // Custom vanity link, e.g. /kiss/anh-yeu-em — already slugified client-side
  // (see slugify() in lib/kiss-slug.ts), re-validated here.
  slug: z.string().max(SLUG_MAX).optional(),
  // Sender's answers to the template's fields_schema (migration 035).
  // Free-form { key: value } object — the renderer substitutes these
  // into effect params at reveal time. Capped at 4KB serialized to
  // prevent abuse.
  template_data: z.record(z.string(), z.unknown()).optional(),
  // ── NEAR-backed money gift (optional — see migration-039) ──────────
  // The sender's wallet already called `lock_gift` on the Kiss Chain
  // contract BEFORE this POST; we verify that transaction on-chain
  // below rather than trusting any amount the client claims. `id` must
  // be the same gao_kiss_id the sender's wallet passed to `lock_gift`
  // (the client generates it up front so the same id can be used for
  // both the on-chain call and this DB row).
  id: z.string().regex(/^kiss_[0-9a-f]{16}$/).optional(),
  near_sender_account_id: z.string().min(2).max(64).optional(),
  near_lock_tx_hash: z.string().min(10).max(128).optional(),
  // The plaintext claim secret (see contracts/kiss-chain/src/lib.rs
  // claim_secret_hash + migration-040) — re-hashed and checked against
  // what the verified on-chain lock_gift call actually recorded before
  // being trusted enough to cache in the DB.
  near_claim_secret: z.string().min(16).max(128).optional(),
}).refine(
  (d) => d.receiver_id || (d.receiver_name && d.receiver_lat != null && d.receiver_lng != null),
  { message: 'Pick a friend, or enter a name and address for someone without an account yet' },
).refine(
  (d) => !d.near_lock_tx_hash || (d.id && d.near_sender_account_id && d.near_claim_secret),
  { message: 'id, near_sender_account_id and near_claim_secret are required alongside near_lock_tx_hash' },
);

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const body = await req.json();
    const parsed = kissSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: { code: 'invalid_request', message: parsed.error.issues[0].message } }, { status: 400 });

    const d = parsed.data;

    if (d.receiver_id === userId) return NextResponse.json({ error: { code: 'invalid_request', message: "Can't send a kiss to yourself" } }, { status: 400 });

    const db = getDB();

    // Get sender location
    const sender = await db.prepare('SELECT display_name, location_lat, location_lng FROM users WHERE id = ?').bind(userId).first<{ display_name: string; location_lat: number | null; location_lng: number | null }>();
    if (!sender?.location_lat) return NextResponse.json({ error: { code: 'no_location', message: 'Please enable location sharing in your profile first' } }, { status: 400 });

    // Receiver is either an existing user, or a guest identified only by
    // name + geocoded address (no account required — see migration 038).
    let receiverHasLocation = false;
    let receiverLocLat: number | null = null;
    let receiverLocLng: number | null = null;

    if (d.receiver_id) {
      const receiver = await db.prepare('SELECT display_name, location_lat, location_lng FROM users WHERE id = ?').bind(d.receiver_id).first<{ display_name: string; location_lat: number | null; location_lng: number | null }>();
      if (!receiver) return NextResponse.json({ error: { code: 'not_found', message: 'User not found' } }, { status: 404 });
      receiverHasLocation = !!receiver.location_lat;
      receiverLocLat = receiver.location_lat;
      receiverLocLng = receiver.location_lng;
    }

    const senderProvidedAddress = !!(d.receiver_lat && d.receiver_lng);
    const hasValidDestination = receiverHasLocation || senderProvidedAddress;

    // If no valid destination, store 0 so frontend knows not to animate
    const recLat = hasValidDestination ? (d.receiver_lat || receiverLocLat) : 0;
    const recLng = hasValidDestination ? (d.receiver_lng || receiverLocLng) : 0;

    // Cap template_data at 4KB to avoid abuse of the free-form column.
    let templateDataJson: string | null = null;
    if (d.template_data && Object.keys(d.template_data).length > 0) {
      const serialized = JSON.stringify(d.template_data);
      if (serialized.length > 4096) {
        return NextResponse.json({ error: { code: 'invalid_request', message: 'template_data too large (max 4KB)' } }, { status: 400 });
      }
      templateDataJson = serialized;
    }

    // Custom vanity link (optional) — must be well-formed and not already taken.
    let slug: string | null = null;
    if (d.slug) {
      if (!isValidSlug(d.slug)) {
        return NextResponse.json({
          error: { code: 'invalid_slug', message: `Custom link must be ${SLUG_MIN}-${SLUG_MAX} characters: lowercase letters, numbers, and hyphens only` },
        }, { status: 400 });
      }
      const taken = await db.prepare('SELECT 1 FROM kisses WHERE slug = ?').bind(d.slug).first();
      if (taken) {
        return NextResponse.json({ error: { code: 'slug_taken', message: 'This link is already taken — try another one' } }, { status: 409 });
      }
      slug = d.slug;
    }

    // NEAR-backed money gift: the sender's wallet already escrowed real
    // NEAR via `lock_gift` before this request — verify that on-chain
    // rather than trusting the client's say-so. Any mismatch (wrong
    // method, wrong gao_kiss_id, wrong signer) rejects the whole send;
    // we never record a "locked" gift the chain doesn't actually back.
    let nearGift: { amountYocto: string; senderAccountId: string; tokenId: string; claimSecret: string } | null = null;
    if (d.near_lock_tx_hash && d.id && d.near_sender_account_id && d.near_claim_secret) {
      let verified;
      try {
        verified = await verifyNearFunctionCall(d.near_lock_tx_hash, d.near_sender_account_id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not verify the NEAR transaction';
        return NextResponse.json({ error: { code: 'near_verify_failed', message: msg } }, { status: 400 });
      }
      if (verified.methodName !== 'lock_gift') {
        return NextResponse.json({ error: { code: 'near_verify_failed', message: `Expected a lock_gift call, got ${verified.methodName}` } }, { status: 400 });
      }
      if (verified.args.gao_kiss_id !== d.id) {
        return NextResponse.json({ error: { code: 'near_verify_failed', message: 'This transaction locked a different gift' } }, { status: 400 });
      }
      if (!(BigInt(verified.depositYocto) > BigInt(0))) {
        return NextResponse.json({ error: { code: 'near_verify_failed', message: 'No NEAR was attached in that transaction' } }, { status: 400 });
      }
      // The claim secret is the real access control for this gift (see
      // contracts/kiss-chain claim_secret_hash) — confirm the plaintext
      // the client just handed us actually hashes to what's on chain
      // before caching it, rather than trusting it blindly.
      const expectedHash = await sha256Hex(d.near_claim_secret);
      if (verified.args.claim_secret_hash !== expectedHash) {
        return NextResponse.json({ error: { code: 'near_verify_failed', message: "Claim secret doesn't match the on-chain lock_gift call" } }, { status: 400 });
      }
      nearGift = {
        amountYocto: verified.depositYocto,
        senderAccountId: verified.signerId,
        tokenId: `gift-${d.id}`,
        claimSecret: d.near_claim_secret,
      };
    }

    const id = nearGift ? (d.id as string) : genId('kiss_');
    const row = await db.prepare(
      `INSERT INTO kisses (id, sender_id, receiver_id, receiver_name, receiver_address, message, emoji, visibility, kiss_type, sender_lat, sender_lng, receiver_lat, receiver_lng, photos, music_url, music_title, template_id, template_data, max_opens, slug, near_amount_yocto, near_gift_status, near_token_id, near_sender_account_id, near_lock_tx_hash, near_locked_at, near_claim_secret)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *`
    ).bind(id, userId, d.receiver_id ?? null, d.receiver_id ? null : (d.receiver_name ?? null), d.receiver_address ?? null,
      d.message, d.emoji, d.visibility, d.kiss_type,
      sender.location_lat, sender.location_lng, recLat, recLng,
      JSON.stringify(d.photos), d.music_url ?? null, d.music_title ?? null,
      d.template_id ?? null, templateDataJson, 20, slug,
      nearGift?.amountYocto ?? null, nearGift ? 'locked' : null, nearGift?.tokenId ?? null,
      nearGift?.senderAccountId ?? null, d.near_lock_tx_hash ?? null,
      nearGift ? new Date().toISOString() : null, nearGift?.claimSecret ?? null).first<Record<string, unknown>>();

    // Notify receiver — only possible when they actually have an account.
    // Guest recipients (no receiver_id) have nowhere to receive a notification.
    const senderName = sender.display_name || 'Someone';
    const isDeclaration = d.kiss_type === 'declaration';
    if (d.receiver_id) {
      if (isDeclaration) {
        notify(d.receiver_id, 'system', `🌍❤️ ${senderName} declared love to you!`, 'The whole world can see it! Open to watch 🌏✨', 'kiss', id);
      } else if (hasValidDestination) {
        notify(d.receiver_id, 'system', `${d.emoji} ${senderName} sent you a kiss!`, 'Open it on the map 🎁✨', 'kiss', id);
      } else {
        notify(d.receiver_id, 'system', `${d.emoji} ${senderName} sent you a kiss!`, 'Tap here to share your location and see it fly to you! 📍✈️', 'kiss', id);
      }
    }

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    console.error('[Kisses POST]', err);
    const msg = err instanceof Error ? err.message : 'Failed to send kiss';
    // Unique index race: two senders claimed the same slug at the same instant.
    if (msg.includes('UNIQUE constraint failed') && msg.includes('slug')) {
      return NextResponse.json({ error: { code: 'slug_taken', message: 'This link is already taken — try another one' } }, { status: 409 });
    }
    return NextResponse.json({ error: { code: 'internal_error', message: msg } }, { status: 500 });
  }
}

// ─── PATCH /api/v1/kisses — Open a kiss ─────────────────────────────────
// Any authenticated user with the kiss ID (from QR scan or notification)
// can open the kiss. Guest kisses (sent to a receiver_name/address, no
// receiver_id) can be opened without logging in at all — there's no
// account to gate against. Each open increments `open_count`; once it
// hits `max_opens` (default 20), further opens are rejected with 429.
// Sender is notified each open + a special notification when exhausted.

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, receiver_lat, receiver_lng } = body;

    const db = getDB();

    // Look up the kiss (anyone with the ID can open — this is a QR-shareable gift).
    const kiss = await db.prepare(
      'SELECT * FROM kisses WHERE id = ?'
    ).bind(id).first<Record<string, unknown>>();

    if (!kiss) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Kiss not found' } }, { status: 404 });
    }

    // Account-bound kisses still require login to open; guest kisses
    // (no receiver_id) are openable by anyone with the link.
    const userId = await resolveUserId(req);
    if (!userId && kiss.receiver_id) {
      return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });
    }

    const openCount = Number(kiss.open_count ?? 0);
    const maxOpens = Number(kiss.max_opens ?? 20);
    const isReceiver = kiss.receiver_id === userId;

    // Check open cap FIRST — exhausted gifts never trigger side effects.
    if (openCount >= maxOpens) {
      return NextResponse.json({
        error: { code: 'exhausted', message: `This gift has already been opened ${maxOpens} times 💝` },
        data: { open_count: openCount, max_opens: maxOpens },
      }, { status: 429 });
    }

    // Check 24h expiry (existing rule)
    const createdAt = new Date(kiss.created_at as string).getTime();
    const hoursElapsed = (Date.now() - createdAt) / (1000 * 60 * 60);
    if (hoursElapsed > 24) {
      return NextResponse.json({ error: { code: 'expired', message: 'This kiss has expired (24h limit)' } }, { status: 410 });
    }

    // Update: increment open_count, set opened=1, stamp opened_at on first open.
    // Only the RECEIVER can update receiver coords (privacy safeguard).
    const updates: string[] = [
      'open_count = open_count + 1',
      'opened = 1',
      "opened_at = COALESCE(opened_at, datetime('now'))",
    ];
    const values: unknown[] = [];

    if (isReceiver && receiver_lat && receiver_lng) {
      updates.push(`receiver_lat = ?`, `receiver_lng = ?`);
      values.push(receiver_lat, receiver_lng);
    }

    values.push(id);
    const row = await db.prepare(
      `UPDATE kisses SET ${updates.join(', ')} WHERE id = ? AND open_count < max_opens RETURNING *`
    ).bind(...values).first<KissRow>();

    // Notify sender of this open — including remaining count / exhausted state.
    if (row) {
      const senderId = row.sender_id as string;
      const emoji = row.emoji as string;
      const newCount = Number(row.open_count ?? 0);
      const remaining = maxOpens - newCount;
      // Only notify if a different user opened it — avoid self-notifications.
      if (senderId && senderId !== userId) {
        if (remaining <= 0) {
          notify(senderId, 'system', `${emoji} Your gift has reached ${maxOpens} opens!`, 'Thanks for sharing 💝', 'kiss', id as string);
        } else {
          notify(senderId, 'system', `${emoji} Someone just opened your gift!`, `${remaining}/${maxOpens} opens remaining.`, 'kiss', id as string);
        }
      }
    }

    return NextResponse.json({ data: row });
  } catch (err) {
    console.error('[Kisses PATCH]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed' } }, { status: 500 });
  }
}
