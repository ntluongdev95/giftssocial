import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, signAccessToken, signRefreshToken } from '@/lib/jwt';
import { getDB } from '@/lib/db';
import { setAuthCookies, clearAuthCookies } from '@/lib/auth-cookies';
import { validateRefreshToken, rotateRefreshToken } from '@/lib/session';
import { setCsrfCookie } from '@/lib/csrf';

const USER_FIELDS = `id, username, display_name, avatar_url, bio, city, trust_level, trust_score,
            followers_count, following_count, email, status, created_at`;

/**
 * GET /api/v1/auth/session
 *
 * Returns the current user from httpOnly cookies.
 * If access token expired but refresh token is valid (and not revoked), auto-refreshes.
 * Also sets CSRF cookie for mutation protection.
 */
export async function GET(req: NextRequest) {
  try {
    const accessToken = req.cookies.get('gao_token')?.value;
    const refreshTokenCookie = req.cookies.get('gao_refresh')?.value;

    if (!accessToken && !refreshTokenCookie) {
      return NextResponse.json({ data: null });
    }

    // Try access token first
    let userId: string | null = null;
    let needsRefresh = false;

    if (accessToken) {
      const payload = await verifyToken(accessToken);
      if (payload?.sub) {
        userId = payload.sub;
      } else {
        needsRefresh = true;
      }
    } else {
      needsRefresh = true;
    }

    // Access token invalid/expired — try refresh with session DB validation
    if (needsRefresh && refreshTokenCookie) {
      const payload = await verifyToken(refreshTokenCookie);
      if (!payload?.sub) {
        const response = NextResponse.json({ data: null });
        return clearAuthCookies(response);
      }

      // Validate refresh token against session DB (check revocation)
      const session = await validateRefreshToken(refreshTokenCookie).catch(() => null);
      if (!session) {
        const response = NextResponse.json({ data: null });
        return clearAuthCookies(response);
      }

      userId = payload.sub;

      // Issue new tokens + rotate session
      const newAccess = await signAccessToken(userId);
      const newRefresh = await signRefreshToken(userId);
      await rotateRefreshToken(refreshTokenCookie, newRefresh, userId).catch(() => {});

      const db = getDB();
      const row = await db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).bind(userId).first<Record<string, unknown>>();
      if (!row) {
        const response = NextResponse.json({ data: null });
        return clearAuthCookies(response);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let response: NextResponse<any> = NextResponse.json({ data: row, access_token: newAccess, refresh_token: newRefresh });
      response = setAuthCookies(response, newAccess, newRefresh);
      return setCsrfCookie(response);
    }

    if (!userId) {
      const response = NextResponse.json({ data: null });
      return clearAuthCookies(response);
    }

    // Access token valid — fetch user
    const db = getDB();
    const row = await db.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).bind(userId).first<Record<string, unknown>>();
    if (!row) {
      return NextResponse.json({ data: null });
    }

    const response = NextResponse.json({ data: row, access_token: accessToken });
    return setCsrfCookie(response);
  } catch (err) {
    console.error('[Auth Session]', err);
    const response = NextResponse.json({ data: null }, { status: 500 });
    return clearAuthCookies(response);
  }
}
