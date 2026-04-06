import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pgPool } from '@/lib/db';
import { signAccessToken, signRefreshToken } from '@/lib/jwt';
import { setAuthCookies } from '@/lib/auth-cookies';
import { setCsrfCookie } from '@/lib/csrf';
import { createSession } from '@/lib/session';

const schema = z.object({
  email: z.string().email(),
  method: z.enum(['email']).default('email'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: parsed.error.issues[0].message } },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // Find user
    const result = await pgPool.query(
      'SELECT id, display_name, email, trust_score, trust_level, status FROM users WHERE email = $1 AND status = $2',
      [email, 'active']
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: { code: 'user_not_found', message: 'No account found with this email' } },
        { status: 404 }
      );
    }

    const user = result.rows[0];

    // Generate tokens
    const accessToken = await signAccessToken(user.id);
    const refreshToken = await signRefreshToken(user.id);

    // Create session in DB (token revocation support)
    await createSession(user.id, refreshToken, req).catch(() => {});

    const response = NextResponse.json({
      user_id: user.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 2592000,
    });

    return setCsrfCookie(setAuthCookies(response, accessToken, refreshToken));
  } catch (err) {
    console.error('[Auth Login]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Login failed' } },
      { status: 500 }
    );
  }
}
