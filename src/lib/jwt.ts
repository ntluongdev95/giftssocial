import { SignJWT, jwtVerify } from 'jose';

// Deferred — evaluated at runtime, not at build time
function getJwtSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (!raw && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production');
  }
  return new TextEncoder().encode(raw || 'gao-social-dev-only-not-for-production');
}
// Access tokens are now short-lived — auto-refresh in middleware swaps them
// silently. 30 days was a security hole: a leaked token gave attackers a
// month-long window. 7d balances UX (less refresh churn) with leak-window
// containment; refresh still runs transparently when the token expires.
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_EXPIRES_IN = '90d';

export interface TokenPayload {
  sub: string; // user_id
  role: 'user' | 'guest';
  // session_id — lets middleware revoke a single device by flipping the
  // sessions row's is_revoked flag. Optional only for legacy tokens signed
  // before this field existed; new logins always include it.
  sid?: string;
  iat: number;
}

export async function signAccessToken(userId: string, role: 'user' | 'guest' = 'user', sid?: string): Promise<string> {
  const payload: Record<string, unknown> = { sub: userId, role };
  if (sid) payload.sid = sid;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(role === 'guest' ? '24h' : JWT_EXPIRES_IN)
    .sign(getJwtSecret());
}

export async function signRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, type: 'refresh' } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_EXPIRES_IN)
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}
