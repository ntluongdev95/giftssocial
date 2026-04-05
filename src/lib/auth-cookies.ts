import { NextResponse } from 'next/server';

const IS_PROD = process.env.NODE_ENV === 'production';
const ACCESS_MAX_AGE = 2592000;  // 30 days
const REFRESH_MAX_AGE = 7776000; // 90 days

/**
 * Set httpOnly auth cookies on a NextResponse.
 * - gao_token: access token (httpOnly)
 * - gao_refresh: refresh token (httpOnly)
 * - gao_logged_in: "1" flag (NOT httpOnly — readable by client JS for instant UI state)
 */
export function setAuthCookies(response: NextResponse, accessToken: string, refreshToken: string) {
  response.cookies.set('gao_token', accessToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: ACCESS_MAX_AGE,
    path: '/',
  });

  response.cookies.set('gao_refresh', refreshToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: REFRESH_MAX_AGE,
    path: '/',
  });

  // Non-httpOnly flag so client JS knows user is logged in (no sensitive data)
  response.cookies.set('gao_logged_in', '1', {
    httpOnly: false,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: ACCESS_MAX_AGE,
    path: '/',
  });

  return response;
}

/**
 * Clear all auth cookies on a NextResponse (logout).
 */
export function clearAuthCookies(response: NextResponse) {
  response.cookies.set('gao_token', '', { maxAge: 0, path: '/' });
  response.cookies.set('gao_refresh', '', { maxAge: 0, path: '/' });
  response.cookies.set('gao_logged_in', '', { maxAge: 0, path: '/' });
  return response;
}
