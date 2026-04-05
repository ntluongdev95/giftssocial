import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pgPool } from '@/lib/db';
import { signAccessToken, signRefreshToken } from '@/lib/jwt';
import { setAuthCookies } from '@/lib/auth-cookies';
import { createSession } from '@/lib/session';

const schema = z.object({
  email: z.string().email(),
  display_name: z.string().min(1).max(100),
  method: z.enum(['email']).default('email'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: parsed.error.issues[0].message, field: String(parsed.error.issues[0].path[0]) } },
        { status: 400 }
      );
    }

    const { email, display_name } = parsed.data;

    // Check existing
    const existing = await pgPool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: { code: 'email_exists', message: 'Email already registered' } },
        { status: 409 }
      );
    }

    // Insert user
    const userId = `user_${crypto.randomUUID().replace(/-/g, '')}`;
    await pgPool.query(
      `INSERT INTO users (id, email, display_name, trust_score, trust_level, status)
       VALUES ($1, $2, $3, 0, 'new', 'active')`,
      [userId, email, display_name]
    );

    // Generate tokens
    const accessToken = await signAccessToken(userId);
    const refreshToken = await signRefreshToken(userId);
    await createSession(userId, refreshToken, req).catch(() => {});

    const response = NextResponse.json({
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 2592000,
    });

    return setAuthCookies(response, accessToken, refreshToken);
  } catch (err) {
    console.error('[Auth Register]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Registration failed' } },
      { status: 500 }
    );
  }
}
