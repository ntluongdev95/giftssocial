import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth-cookies';

/**
 * POST /api/v1/auth/logout
 * Clears all httpOnly auth cookies.
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  return clearAuthCookies(response);
}
