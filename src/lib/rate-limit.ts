import { getKV } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  max: number;
  windowSec: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/v1/auth/login':    { max: 10, windowSec: 60 },
  '/api/v1/auth/register': { max: 5,  windowSec: 60 },
  '/api/v1/auth/google':   { max: 10, windowSec: 60 },
  '/api/v1/auth/refresh':  { max: 20, windowSec: 60 },
  '/api/v1/auth/guest':    { max: 10, windowSec: 60 },
};

const DEFAULT_LIMIT: RateLimitConfig = { max: 100, windowSec: 60 };

function getClientId(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || req.ip
    || 'unknown';
}

/**
 * KV-based rate limiting (fixed window, 1-minute buckets).
 * Replaces Redis sliding-window — acceptable for dev environment.
 * Returns null on KV error (fail-open).
 */
export async function checkRateLimit(
  req: NextRequest
): Promise<{ allowed: boolean; remaining: number; resetIn: number } | null> {
  const pathname = req.nextUrl.pathname;
  const config = RATE_LIMITS[pathname] || DEFAULT_LIMIT;
  const clientId = getClientId(req);

  // Fixed window: bucket changes every windowSec seconds
  const bucket = Math.floor(Date.now() / (config.windowSec * 1000));
  const key = `rl:${pathname}:${clientId}:${bucket}`;

  try {
    const kv = getKV();
    const current = await kv.get(key);
    const count = current ? parseInt(current as string) + 1 : 1;

    // TTL = 2× window so keys auto-expire
    await kv.put(key, String(count), { expirationTtl: config.windowSec * 2 });

    const allowed = count <= config.max;
    const remaining = Math.max(0, config.max - count);
    const resetIn = config.windowSec - (Math.floor(Date.now() / 1000) % config.windowSec);

    return { allowed, remaining, resetIn };
  } catch {
    // KV down — fail open
    return null;
  }
}

export function rateLimitResponse(resetIn: number): NextResponse {
  return NextResponse.json(
    { error: { code: 'rate_limited', message: 'Too many requests. Please try again later.' } },
    {
      status: 429,
      headers: {
        'Retry-After': String(resetIn),
        'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + resetIn),
      },
    }
  );
}

export function addRateLimitHeaders(
  response: NextResponse,
  remaining: number,
  resetIn: number,
  pathname: string
): NextResponse {
  const config = RATE_LIMITS[pathname] || DEFAULT_LIMIT;
  response.headers.set('X-RateLimit-Limit', String(config.max));
  response.headers.set('X-RateLimit-Remaining', String(remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + resetIn));
  return response;
}
