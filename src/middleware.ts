import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, signAccessToken, signRefreshToken } from '@/lib/jwt';
import { setAuthCookies, clearAuthCookies } from '@/lib/auth-cookies';
import { validateCsrf } from '@/lib/csrf';
import { rotateRefreshToken, validateRefreshToken, validateSession } from '@/lib/session';

/**
 * Rate limiting using in-memory Map (per-worker, resets on deploy).
 * For production at scale, move to Redis in API route handlers instead.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const AUTH_RATE_LIMIT = { max: 60, windowSec: 60 };
const API_RATE_LIMIT = { max: 600, windowSec: 60 };

function checkRateLimit(key: string, isAuth: boolean): { allowed: boolean; remaining: number } {
  const config = isAuth ? AUTH_RATE_LIMIT : API_RATE_LIMIT;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + config.windowSec * 1000 });
    return { allowed: true, remaining: config.max - 1 };
  }

  entry.count++;
  const allowed = entry.count <= config.max;
  return { allowed, remaining: Math.max(0, config.max - entry.count) };
}

// Cleanup stale entries every 5 minutes
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  }, 300_000);
}

const PUBLIC_PATHS = ['/api/v1/auth/'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('cf-connecting-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/api/v1/')) {
    return NextResponse.next();
  }

  // ── Rate Limiting ──
  const clientIp = getClientIp(req);
  const isAuth = pathname.startsWith('/api/v1/auth/');
  const rlKey = `${clientIp}:${isAuth ? 'auth' : 'api'}`;
  const rl = checkRateLimit(rlKey, isAuth);

  if (!rl.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Too many requests' } },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  // Skip auth check for auth routes
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // ── CSRF Validation ──
  if (!validateCsrf(req)) {
    return NextResponse.json(
      { error: { code: 'csrf_invalid', message: 'Invalid or missing CSRF token' } },
      { status: 403 }
    );
  }

  // ── Token Extraction ──
  // Tokens come from httpOnly cookies only — Bearer headers and the legacy
  // x-auth-token (passkey) path are gone. Cookies are sent automatically by
  // same-origin fetches, so callers don't need to do anything.
  const token = req.cookies.get('gao_token')?.value ?? null;
  const refreshCookie = req.cookies.get('gao_refresh')?.value ?? null;

  const tryAutoRefresh = async () => {
    if (!refreshCookie) return null;
    const refreshPayload = await verifyToken(refreshCookie);
    if (!refreshPayload?.sub) return null;

    // Only honour refresh tokens that still have a live session row in DB.
    const session = await validateRefreshToken(refreshCookie).catch(() => null);
    if (!session) return null;

    // Rotate: issue new access + refresh, swap the session row atomically.
    const newRefresh = await signRefreshToken(refreshPayload.sub);
    await rotateRefreshToken(refreshCookie, newRefresh, refreshPayload.sub).catch(() => {});

    // The freshly-rotated session_id is needed for the access-token `sid` so
    // future requests can be revoked at the session granularity. Look it up
    // by hash of the brand-new refresh token.
    const newSession = await validateRefreshToken(newRefresh).catch(() => null);
    const sid = newSession?.session_id ?? session.session_id;
    const newAccess = await signAccessToken(refreshPayload.sub, 'user', sid);

    return { userId: refreshPayload.sub, sid, newAccess, newRefresh };
  };

  // No access token — try refresh
  if (!token) {
    const refreshed = await tryAutoRefresh();
    if (refreshed) {
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', refreshed.userId);
      requestHeaders.set('x-user-role', 'user');
      requestHeaders.set('x-session-id', refreshed.sid);
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      return setAuthCookies(response, refreshed.newAccess, refreshed.newRefresh);
    }

    if (req.method === 'GET') return NextResponse.next();
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  // ── Verify Token ──
  const payload = await verifyToken(token);

  if (payload) {
    // Reject access tokens whose backing session has been revoked. Old tokens
    // signed before this change won't have `sid` — for now we let them through
    // (they'll naturally roll over within the access-token TTL).
    if (payload.sid) {
      const sessionAlive = await validateSession(payload.sid).catch(() => false);
      if (!sessionAlive) {
        // Session killed (logout / admin revoke) — clear cookies + 401.
        const response = NextResponse.json(
          { error: { code: 'session_revoked', message: 'Session has been revoked' } },
          { status: 401 }
        );
        return clearAuthCookies(response);
      }
    }
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', payload.sub);
    requestHeaders.set('x-user-role', payload.role);
    if (payload.sid) requestHeaders.set('x-session-id', payload.sid);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Expired access token — try refresh
  const refreshed = await tryAutoRefresh();
  if (refreshed) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', refreshed.userId);
    requestHeaders.set('x-user-role', 'user');
    requestHeaders.set('x-session-id', refreshed.sid);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    return setAuthCookies(response, refreshed.newAccess, refreshed.newRefresh);
  }

  // Refresh failed too — clear cookies and force re-login.
  if (req.method === 'GET') {
    const response = NextResponse.next();
    return clearAuthCookies(response);
  }
  const failResponse = NextResponse.json(
    { error: { code: 'unauthorized', message: 'Authentication required' } },
    { status: 401 }
  );
  return clearAuthCookies(failResponse);
}

export const config = {
  matcher: '/api/v1/:path*',
};
