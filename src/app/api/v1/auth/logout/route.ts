import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { clearAuthCookies } from '@/lib/auth-cookies';
import { revokeAllSessions } from '@/lib/session';

/**
 * POST /api/v1/auth/logout
 * Revokes all sessions for the user and clears all httpOnly auth cookies.
 */
export async function POST(req: NextRequest) {
  // Try to get user ID to revoke sessions
  const accessToken = req.cookies.get('gao_token')?.value;
  if (accessToken) {
    const payload = await verifyToken(accessToken).catch(() => null);
    if (payload?.sub) {
      await revokeAllSessions(payload.sub).catch(() => {});
    }
  }

  const response = NextResponse.json({ success: true });
  return clearAuthCookies(response);
}
