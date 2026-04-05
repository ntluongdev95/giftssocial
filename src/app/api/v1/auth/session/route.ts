import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, signAccessToken, signRefreshToken } from '@/lib/jwt';
import { pgPool } from '@/lib/db';
import { setAuthCookies, clearAuthCookies } from '@/lib/auth-cookies';

/**
 * GET /api/v1/auth/session
 *
 * Returns the current user from httpOnly cookies.
 * If access token expired but refresh token is valid, auto-refreshes.
 * Used by AuthHydrator on page load — no localStorage needed.
 */
export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('gao_token')?.value;
  const refreshToken = req.cookies.get('gao_refresh')?.value;

  if (!accessToken && !refreshToken) {
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

  // Access token invalid/expired — try refresh
  if (needsRefresh && refreshToken) {
    const payload = await verifyToken(refreshToken);
    if (payload?.sub) {
      userId = payload.sub;

      // Issue new tokens
      const newAccess = await signAccessToken(userId);
      const newRefresh = await signRefreshToken(userId);

      // Fetch user data
      const result = await pgPool.query(
        `SELECT id, username, display_name, avatar_url, bio, city, trust_level, trust_score,
                followers_count, following_count, email, status, created_at
         FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        const response = NextResponse.json({ data: null });
        return clearAuthCookies(response);
      }

      const response = NextResponse.json({ data: result.rows[0] });
      return setAuthCookies(response, newAccess, newRefresh);
    } else {
      // Both tokens invalid — clear cookies
      const response = NextResponse.json({ data: null });
      return clearAuthCookies(response);
    }
  }

  if (!userId) {
    const response = NextResponse.json({ data: null });
    return clearAuthCookies(response);
  }

  // Access token valid — fetch user
  const result = await pgPool.query(
    `SELECT id, username, display_name, avatar_url, bio, city, trust_level, trust_score,
            followers_count, following_count, email, status, created_at
     FROM users WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({ data: result.rows[0] });
}
