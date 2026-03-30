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

  // Only protect API routes
  if (!pathname.startsWith('/api/v1/')) {
    return NextResponse.next();
  }

  // Skip auth routes
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Extract token
  const authHeader = req.headers.get('authorization');
  const cookieToken = req.cookies.get('gao_token')?.value;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

  if (!token) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const payload = await verifyToken(token);

  if (!payload) {
    return NextResponse.json(
      { error: { code: 'invalid_token', message: 'Invalid or expired token' } },
      { status: 401 }
    );
  }

  // Attach user info to headers for downstream routes
  const response = NextResponse.next();
  response.headers.set('x-user-id', payload.sub);
  response.headers.set('x-user-role', payload.role);

  return response;
}

export const config = {
  matcher: '/api/v1/:path*',
};
