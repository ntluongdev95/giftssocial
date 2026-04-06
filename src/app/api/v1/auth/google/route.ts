import { NextRequest, NextResponse } from 'next/server';
import { getDB, genId } from '@/lib/db';
import { signAccessToken, signRefreshToken } from '@/lib/jwt';
import { setAuthCookies } from '@/lib/auth-cookies';
import { setCsrfCookie } from '@/lib/csrf';
import { createSession } from '@/lib/session';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const ALLOWED_REDIRECT_URIS = [
  process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/google/callback` : null,
  'http://localhost:3000/auth/google/callback',
  'https://gao-social-dev.ceo-349.workers.dev/auth/google/callback',
  'https://app.gao.social/auth/google/callback',
].filter(Boolean) as string[];

/**
 * POST /api/v1/auth/google
 * Accepts either:
 *   - { credential } — id_token from Google One Tap
 *   - { code, redirect_uri } — authorization code from OAuth popup flow
 * Verifies, finds or creates user, returns JWT tokens.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let email: string | null = null;
    let name: string | null = null;
    let avatarUrl: string | null = null;

    if (body.code) {
      // ── Authorization code flow ──
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: body.code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: ALLOWED_REDIRECT_URIS.includes(body.redirect_uri) ? body.redirect_uri : ALLOWED_REDIRECT_URIS[0] || '',
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        console.error('[Auth Google] token exchange error:', err);
        return NextResponse.json({ error: { code: 'token_exchange_failed', message: 'Failed to exchange Google code' } }, { status: 401 });
      }

      const tokens = await tokenRes.json();

      // Get user info from access token
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userInfoRes.ok) {
        return NextResponse.json({ error: { code: 'userinfo_failed', message: 'Failed to get Google user info' } }, { status: 401 });
      }

      const userInfo = await userInfoRes.json();
      email = userInfo.email;
      name = userInfo.name || userInfo.given_name || email?.split('@')[0] || null;
      avatarUrl = userInfo.picture || null;

    } else if (body.credential) {
      // ── ID token flow (One Tap) ──
      const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${body.credential}`);
      if (!googleRes.ok) {
        return NextResponse.json({ error: { code: 'invalid_token', message: 'Invalid Google token' } }, { status: 401 });
      }

      const googleUser = await googleRes.json();
      if (googleUser.aud !== GOOGLE_CLIENT_ID) {
        return NextResponse.json({ error: { code: 'invalid_audience', message: 'Token not issued for this app' } }, { status: 401 });
      }
      if (googleUser.iss !== 'accounts.google.com' && googleUser.iss !== 'https://accounts.google.com') {
        return NextResponse.json({ error: { code: 'invalid_issuer', message: 'Token not issued by Google' } }, { status: 401 });
      }

      email = googleUser.email;
      name = googleUser.name || googleUser.given_name || email?.split('@')[0] || null;
      avatarUrl = googleUser.picture || null;
    } else {
      return NextResponse.json({ error: { code: 'missing_params', message: 'code or credential required' } }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: { code: 'no_email', message: 'Google account has no email' } }, { status: 400 });
    }

    const db = getDB();

    // Find existing user by email
    let userId: string;
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
    const isNewUser = !existing;

    if (existing) {
      userId = existing.id;
      await db.prepare(
        "UPDATE users SET avatar_url = COALESCE(avatar_url, ?), display_name = COALESCE(display_name, ?), status = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(avatarUrl, name, 'active', userId).run();
    } else {
      userId = genId('user_');
      await db.prepare(
        `INSERT INTO users (id, email, display_name, avatar_url, trust_score, trust_level, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, 'new', 'active', datetime('now'), datetime('now'))`
      ).bind(userId, email, name, avatarUrl).run();
    }

    const accessToken = await signAccessToken(userId);
    const refreshToken = await signRefreshToken(userId);
    await createSession(userId, refreshToken, req).catch(() => {});

    const response = NextResponse.json({
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 2592000,
      is_new_user: isNewUser,
    });

    return setCsrfCookie(setAuthCookies(response, accessToken, refreshToken));
  } catch (err) {
    console.error('[Auth Google]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Google login failed' } }, { status: 500 });
  }
}
