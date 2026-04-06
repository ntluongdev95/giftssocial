import { SignJWT, jwtVerify } from 'jose';

// Deferred — evaluated at runtime, not at build time
function getJwtSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (!raw && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production');
  }
  return new TextEncoder().encode(raw || 'gao-social-dev-only-not-for-production');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';
const REFRESH_EXPIRES_IN = '90d';

export interface TokenPayload {
  sub: string; // user_id
  role: 'user' | 'guest';
  iat: number;
}

export async function signAccessToken(userId: string, role: 'user' | 'guest' = 'user'): Promise<string> {
  return new SignJWT({ sub: userId, role } as unknown as Record<string, unknown>)
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
