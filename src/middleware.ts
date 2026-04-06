import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, signAccessToken, signRefreshToken } from '@/lib/jwt';
import { setAuthCookies } from '@/lib/auth-cookies';
import { validateCsrf } from '@/lib/csrf';

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
    || req.ip
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
  const authHeader = req.headers.get('authorization');
  const cookieToken = req.cookies.get('gao_token')?.value;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

  // No access token — try auto-refresh
  if (!token) {
    const refreshCookie = req.cookies.get('gao_refresh')?.value;
    if (refreshCookie) {
      const refreshPayload = await verifyToken(refreshCookie);
      if (refreshPayload?.sub) {
        const newAccess = await signAccessToken(refreshPayload.sub);
        const newRefresh = await signRefreshToken(refreshPayload.sub);
        const requestHeaders = new Headers(req.headers);
        requestHeaders.set('x-user-id', refreshPayload.sub);
        requestHeaders.set('x-user-role', 'user');
        const response = NextResponse.next({ request: { headers: requestHeaders } });
        return setAuthCookies(response, newAccess, newRefresh);
      }
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
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', payload.sub);
    requestHeaders.set('x-user-role', payload.role);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Expired access token — try refresh
  const refreshCookie = req.cookies.get('gao_refresh')?.value;
  if (refreshCookie) {
    const refreshPayload = await verifyToken(refreshCookie);
    if (refreshPayload?.sub) {
      const newAccess = await signAccessToken(refreshPayload.sub);
      const newRefresh = await signRefreshToken(refreshPayload.sub);
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', refreshPayload.sub);
      requestHeaders.set('x-user-role', 'user');
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      return setAuthCookies(response, newAccess, newRefresh);
    }
  }

  // External token (passkey) — forward
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-auth-token', token);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: '/api/v1/:path*',
};
