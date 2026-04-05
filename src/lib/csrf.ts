import { NextRequest, NextResponse } from 'next/server';

const CSRF_COOKIE = 'gao_csrf';
const CSRF_HEADER = 'x-csrf-token';
const TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure CSRF token.
 */
function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_LENGTH));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Set CSRF cookie on response (non-httpOnly so JS can read it).
 * Called on session creation and /auth/session.
 */
export function setCsrfCookie(response: NextResponse): NextResponse {
  const token = generateToken();
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false, // JS must read this to send in header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 86400, // 24h, refreshed on each session call
    path: '/',
  });
  return response;
}

/**
 * Validate CSRF token on mutation requests (POST/PUT/DELETE/PATCH).
 * Compares the cookie value with the header value.
 * Returns true if valid, false if mismatch.
 */
export function validateCsrf(req: NextRequest): boolean {
  const method = req.method.toUpperCase();

  // Only validate mutations
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;

  const cookieToken = req.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = req.headers.get(CSRF_HEADER);

  // No CSRF cookie or no header sent — skip (gradual rollout, enforce once frontend sends header)
  if (!cookieToken || !headerToken) return true;

  // Both present — must match
  if (headerToken !== cookieToken) return false;

  return true;
}

/**
 * Get the CSRF cookie name and header name (for client-side usage).
 */
export const CSRF_CONFIG = {
  cookieName: CSRF_COOKIE,
  headerName: CSRF_HEADER,
} as const;
