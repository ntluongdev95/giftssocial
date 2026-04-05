import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, signAccessToken, signRefreshToken } from '@/lib/jwt';
import { setAuthCookies } from '@/lib/auth-cookies';

export async function POST(req: NextRequest) {
  try {
    // Accept refresh token from body OR httpOnly cookie
    let refreshTokenInput: string | undefined;

    try {
      const body = await req.json();
      refreshTokenInput = body.refresh_token;
    } catch { /* no body */ }

    if (!refreshTokenInput) {
      refreshTokenInput = req.cookies.get('gao_refresh')?.value;
    }

    if (!refreshTokenInput) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'refresh_token is required' } },
        { status: 400 }
      );
    }

    const payload = await verifyToken(refreshTokenInput);

    if (!payload || !payload.sub) {
      return NextResponse.json(
        { error: { code: 'invalid_token', message: 'Invalid or expired refresh token' } },
        { status: 401 }
      );
    }

    const accessToken = await signAccessToken(payload.sub);
    const refreshToken = await signRefreshToken(payload.sub);

    const response = NextResponse.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 2592000,
    });

    return setAuthCookies(response, accessToken, refreshToken);
  } catch (err) {
    console.error('[Auth Refresh]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Token refresh failed' } },
      { status: 500 }
    );
  }
}
