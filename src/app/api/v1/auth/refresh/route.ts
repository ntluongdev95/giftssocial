import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken, signAccessToken, signRefreshToken } from '@/lib/jwt';

const schema = z.object({
  refresh_token: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'refresh_token is required' } },
        { status: 400 }
      );
    }

    const payload = await verifyToken(parsed.data.refresh_token);

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
      expires_in: 604800,
    });

    response.cookies.set('gao_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 604800,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('[Auth Refresh]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Token refresh failed' } },
      { status: 500 }
    );
  }
}
