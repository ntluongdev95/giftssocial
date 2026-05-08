import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB } from '@/lib/db';
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
    const db = getDB();
    const user = await db.prepare(
      "SELECT id, display_name, email, trust_score, trust_level, status FROM users WHERE email = ? AND status = ?"
    ).bind(email, 'active').first<{ id: string; display_name: string; email: string; trust_score: number; trust_level: string; status: string }>();

    if (!user) {
      return NextResponse.json(
        { error: { code: 'user_not_found', message: 'No account found with this email' } },
        { status: 404 }
      );
    }

    // Create session row first so we can embed its id in the access token —
    // middleware checks the session row on every request for per-device revoke.
    const refreshToken = await signRefreshToken(user.id);
    const sessionId = await createSession(user.id, refreshToken, req).catch(() => null);
    const accessToken = await signAccessToken(user.id, 'user', sessionId ?? undefined);

    const response = NextResponse.json({
      user_id: user.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 1800,
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
