import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB, genId } from '@/lib/db';
import { signAccessToken, signRefreshToken } from '@/lib/jwt';
import { setAuthCookies } from '@/lib/auth-cookies';
import { setCsrfCookie } from '@/lib/csrf';
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

    const db = getDB();

    // Check existing
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
    if (existing) {
      return NextResponse.json(
        { error: { code: 'email_exists', message: 'Email already registered' } },
        { status: 409 }
      );
    }

    // Insert user
    const userId = genId('user_');
    await db.prepare(
      `INSERT INTO users (id, email, display_name, trust_score, trust_level, status)
       VALUES (?, ?, ?, 0, 'new', 'active')`
    ).bind(userId, email, display_name).run();

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

    return setCsrfCookie(setAuthCookies(response, accessToken, refreshToken));
  } catch (err) {
    console.error('[Auth Register]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Registration failed' } },
      { status: 500 }
    );
  }
}
