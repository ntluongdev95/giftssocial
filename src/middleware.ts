import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, signAccessToken, signRefreshToken } from '@/lib/jwt';
import { setAuthCookies } from '@/lib/auth-cookies';
import { validateCsrf } from '@/lib/csrf';
import { checkRateLimit, rateLimitResponse, addRateLimitHeaders } from '@/lib/rate-limit';

const PUBLIC_PATHS = [
  '/api/v1/auth/',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only handle API routes
  if (!pathname.startsWith('/api/v1/')) {
    return NextResponse.next();
  }

  // ── Rate Limiting ──────────────────────────────────────────────────────
  const rateResult = await checkRateLimit(req);
  if (rateResult && !rateResult.allowed) {
    return rateLimitResponse(rateResult.resetIn);
  }

  // Skip auth for auth routes (but rate limit still applies above)
  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
    if (rateResult) addRateLimitHeaders(response, rateResult.remaining, rateResult.resetIn, pathname);
    return response;
  }

  // ── CSRF Validation ────────────────────────────────────────────────────
  if (!validateCsrf(req)) {
    return NextResponse.json(
      { error: { code: 'csrf_invalid', message: 'Invalid or missing CSRF token' } },
      { status: 403 }
    );
  }

  // ── Token Extraction ───────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  const cookieToken = req.cookies.get('gao_token')?.value;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

  // No token — try auto-refresh via gao_refresh cookie
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
        setAuthCookies(response, newAccess, newRefresh);
        if (rateResult) addRateLimitHeaders(response, rateResult.remaining, rateResult.resetIn, pathname);
        return response;
      }
    }

    // No valid tokens
    if (req.method === 'GET') {
      const response = NextResponse.next();
      if (rateResult) addRateLimitHeaders(response, rateResult.remaining, rateResult.resetIn, pathname);
      return response;
    }
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  // ── Verify Token ───────────────────────────────────────────────────────
  const payload = await verifyToken(token);

  if (payload) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', payload.sub);
    requestHeaders.set('x-user-role', payload.role);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    if (rateResult) addRateLimitHeaders(response, rateResult.remaining, rateResult.resetIn, pathname);
    return response;
  }

  // Access token expired — try refresh cookie
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
      setAuthCookies(response, newAccess, newRefresh);
      if (rateResult) addRateLimitHeaders(response, rateResult.remaining, rateResult.resetIn, pathname);
      return response;
    }
  }

  // External token (passkey auth) — forward
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-auth-token', token);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (rateResult) addRateLimitHeaders(response, rateResult.remaining, rateResult.resetIn, pathname);
  return response;
}

export const config = {
  matcher: '/api/v1/:path*',
};
