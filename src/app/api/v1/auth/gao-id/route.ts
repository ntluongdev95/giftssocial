/**
 * POST /api/v1/auth/gao-id — bridge a Gao ID SIWE bearer into a
 * social-web bootstrap session.
 *
 * The caller passes the Gao ID ES256 access token in the
 * `Authorization: Bearer …` header. We verify it by calling the
 * issuer's `GET /v2/auth/me`, find or create a local social-web
 * bootstrap user record, record (or refresh) a row in
 * `gao_id_links`, and mint social-web's HS256 bootstrap session
 * cookies — exactly the shape the existing Google route returns so
 * `useAuthStore` and `AuthHydrator` can hydrate unchanged.
 *
 * Source of truth note:
 *   gao-id-worker is the SOLE authority for `rootId`, canonical Gao
 *   Profile, wallet ownership, .gao domain ownership and trust. This
 *   route never copies canonical Gao Profile fields into
 *   social-web's `users` table. The bridge is a local-only join
 *   between social-web's bootstrap session and the canonical Gao
 *   identity that the issuer just verified for us.
 *
 * Linking semantics (local-only — see migration-006-gao-id-links.sql
 * and docs/social-web-gao-id-auth-plan.md §8):
 *
 *   1. Issuer rejects the bearer → 401 `gao_id_verify_failed`.
 *   2. `gao_id_links` row exists for this rootId, pointing at the
 *      caller's current bootstrap user (if logged in) OR no caller
 *      bootstrap user → load that bootstrap user.
 *   3. No link row, but caller has a valid bootstrap cookie → link
 *      the current bootstrap user to this rootId (Google-first user
 *      attaching their wallet).
 *   4. No link row and no caller bootstrap cookie → create a fresh
 *      bootstrap user keyed only by an internal `users.id`; the
 *      canonical Gao identity stays at the issuer.
 *   5. Link row exists for a DIFFERENT bootstrap user than the
 *      caller is currently signed in as → 409
 *      `local_link_conflict`. The Gao ID itself is still valid;
 *      only the local social-web account associated with it is
 *      taken on this server. The user can sign out of the current
 *      bootstrap account and retry, which lands them in case 2.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDB, genId } from '@/lib/db';
import { signAccessToken, signRefreshToken, verifyToken } from '@/lib/jwt';
import { setAuthCookies } from '@/lib/auth-cookies';
import { setCsrfCookie } from '@/lib/csrf';
import { createSession } from '@/lib/session';
import { checkRateLimit, rateLimitResponse, addRateLimitHeaders } from '@/lib/rate-limit';

const ISSUER = process.env.NEXT_PUBLIC_GAO_ID_API || 'https://id-test.gao.domains';

interface IssuerAuthMe {
  rootId: string;
  walletAddress: string;
  chainId: number;
}

/**
 * Idempotent schema bootstrap. SQLite's `CREATE TABLE IF NOT EXISTS`
 * + `CREATE INDEX IF NOT EXISTS` make this safe to run on every
 * invocation. The dev D1 binding is local to the worker isolate so
 * the round-trip is cheap. Production deploys will swap this out for
 * a tracked migration before the prod tier comes online.
 */
async function ensureSchema(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS gao_id_links (
         id                 TEXT PRIMARY KEY,
         bootstrap_user_id  TEXT NOT NULL,
         gao_root_id        TEXT NOT NULL,
         wallet_address     TEXT,
         chain_id           INTEGER,
         created_at         TEXT NOT NULL DEFAULT (datetime('now')),
         updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
         FOREIGN KEY (bootstrap_user_id) REFERENCES users(id) ON DELETE CASCADE
       )`,
    ),
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_gao_id_links_root ON gao_id_links(gao_root_id)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_gao_id_links_user ON gao_id_links(bootstrap_user_id)`,
    ),
  ]);
}

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(req);
  if (rl && !rl.allowed) return rateLimitResponse(rl.resetIn);

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json(
        { error: { code: 'missing_bearer', message: 'Authorization: Bearer required' } },
        { status: 401 },
      );
    }
    const bearer = authHeader.slice(7).trim();
    if (!bearer) {
      return NextResponse.json(
        { error: { code: 'missing_bearer', message: 'empty bearer' } },
        { status: 401 },
      );
    }

    // 1. Verify the bearer by asking the issuer who it represents.
    //    `/v2/auth/me` is the lightweight identity probe.
    const meRes = await fetch(`${ISSUER}/v2/auth/me`, {
      headers: { authorization: `Bearer ${bearer}` },
    });
    if (!meRes.ok) {
      const body = (await meRes.json().catch(() => ({}))) as { error?: string; message?: string };
      return NextResponse.json(
        {
          error: {
            code: 'gao_id_verify_failed',
            message: 'Gao ID bearer rejected by issuer',
            issuer_status: meRes.status,
            issuer_error: body.error ?? null,
          },
        },
        { status: 401 },
      );
    }
    const me = (await meRes.json()) as IssuerAuthMe;
    if (!me.rootId || !me.walletAddress) {
      return NextResponse.json(
        { error: { code: 'gao_id_invalid_payload', message: 'issuer returned malformed identity' } },
        { status: 502 },
      );
    }

    // 2. Resolve which local bootstrap account is bound to this
    //    canonical Gao identity. The rootId itself is global — this
    //    only checks our local link cache.
    const db = getDB();
    await ensureSchema(db);

    const link = await db
      .prepare(
        'SELECT id, bootstrap_user_id FROM gao_id_links WHERE gao_root_id = ?',
      )
      .bind(me.rootId)
      .first<{ id: string; bootstrap_user_id: string }>();

    let currentUserId: string | null = null;
    const cookieAccess = req.cookies.get('gao_token')?.value;
    if (cookieAccess) {
      const payload = await verifyToken(cookieAccess);
      if (payload?.sub) currentUserId = payload.sub;
    }

    // Case 5 — local link conflict. The canonical rootId is valid;
    // only the social-web bootstrap account currently linked to it
    // differs from the one the caller is signed in as.
    if (link && currentUserId && link.bootstrap_user_id !== currentUserId) {
      return NextResponse.json(
        {
          error: {
            code: 'local_link_conflict',
            message:
              'This Gao ID is already linked to another local social-web bootstrap account. Sign out of the current account and retry, or unlink first. The canonical Gao identity itself is unchanged.',
          },
        },
        { status: 409 },
      );
    }

    let userId: string;
    let isNewUser: boolean;

    if (link) {
      // Case 2 — already linked, possibly from a prior session.
      userId = link.bootstrap_user_id;
      isNewUser = false;
      await db
        .prepare(
          `UPDATE gao_id_links
             SET wallet_address = ?, chain_id = ?, updated_at = datetime('now')
             WHERE id = ?`,
        )
        .bind(me.walletAddress, me.chainId, link.id)
        .run();
    } else if (currentUserId) {
      // Case 3 — Google-first user is now adding their wallet. Link
      // the existing bootstrap user to this rootId. We never create
      // a Gao ID; that already exists at the issuer.
      userId = currentUserId;
      isNewUser = false;
      await db
        .prepare(
          `INSERT INTO gao_id_links
             (id, bootstrap_user_id, gao_root_id, wallet_address, chain_id)
             VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(genId('glnk_'), userId, me.rootId, me.walletAddress, me.chainId)
        .run();
    } else {
      // Case 4 — wallet-first sign-in by a brand-new visitor. Mint a
      // local bootstrap user and bind it to the rootId. Canonical Gao
      // Profile fields are NOT copied; the client reads them from the
      // issuer.
      userId = genId('user_');
      await db.batch([
        db
          .prepare(
            `INSERT INTO users (id, trust_score, trust_level, status, created_at, updated_at)
             VALUES (?, 0, 'new', 'active', datetime('now'), datetime('now'))`,
          )
          .bind(userId),
        db
          .prepare(
            `INSERT INTO gao_id_links
               (id, bootstrap_user_id, gao_root_id, wallet_address, chain_id)
               VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(genId('glnk_'), userId, me.rootId, me.walletAddress, me.chainId),
      ]);
      isNewUser = true;
    }

    // 3. Mint a social-web bootstrap session, identical shape to the
    //    Google flow so the client can swap one in for the other.
    const accessToken = await signAccessToken(userId);
    const refreshToken = await signRefreshToken(userId);
    await createSession(userId, refreshToken, req).catch(() => {
      /* session telemetry; non-fatal */
    });

    const response = NextResponse.json({
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 2592000,
      is_new_user: isNewUser,
      gao_root_id: me.rootId,
    });

    const final = setCsrfCookie(setAuthCookies(response, accessToken, refreshToken));
    return rl ? addRateLimitHeaders(final, rl.remaining, rl.resetIn, req.nextUrl.pathname) : final;
  } catch (err) {
    console.error('[Auth Gao ID]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Gao ID bridge failed' } },
      { status: 500 },
    );
  }
}
