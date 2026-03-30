import { NextRequest } from 'next/server';
import { USER_API_URL, APP_TYPE_GAO_DOMAINS } from '@/types/constants';

/**
 * Resolve user ID from request headers.
 * 1. Check x-user-id (set by middleware for local JWT)
 * 2. Call external API with passkey token to get user ID
 */
export async function resolveUserId(req: NextRequest): Promise<string | null> {
  // Local JWT — middleware already verified
  const userId = req.headers.get('x-user-id');
  if (userId) return userId;

  // External token (passkey auth)
  const token = req.headers.get('x-auth-token') ||
    req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  try {
    const res = await fetch(`${USER_API_URL}/api/v1/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'App-Type': APP_TYPE_GAO_DOMAINS,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.id || null;
  } catch {
    return null;
  }
}
