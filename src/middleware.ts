import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';

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

  // Skip auth routes
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Extract token from header or cookie
  const authHeader = req.headers.get('authorization');
  const cookieToken = req.cookies.get('gao_token')?.value;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

  // No token — allow GET (public read), block writes
  if (!token) {
    if (req.method === 'GET') {
      return NextResponse.next();
    }
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  // Try local JWT verify first
  const payload = await verifyToken(token);

  if (payload) {
    // Local token — attach user info via request headers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', payload.sub);
    requestHeaders.set('x-user-role', payload.role);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // External token (e.g. from passkey auth) — forward token in request headers
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-auth-token', token);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: '/api/v1/:path*',
};
