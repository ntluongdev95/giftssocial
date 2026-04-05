import { redis } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  /** Max requests allowed in the window */
  max: number;
  /** Window size in seconds */
  windowSec: number;
}

/** Rate limit configs per endpoint pattern */
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Auth endpoints — strict limits
  '/api/v1/auth/login': { max: 10, windowSec: 60 },         // 10 per minute
  '/api/v1/auth/register': { max: 5, windowSec: 60 },       // 5 per minute
  '/api/v1/auth/google': { max: 10, windowSec: 60 },        // 10 per minute
  '/api/v1/auth/refresh': { max: 20, windowSec: 60 },       // 20 per minute
  '/api/v1/auth/guest': { max: 10, windowSec: 60 },         // 10 per minute
};

/** Default rate limit for all other API endpoints */
const DEFAULT_LIMIT: RateLimitConfig = { max: 100, windowSec: 60 }; // 100 per minute

/**
 * Get client identifier for rate limiting.
 * Uses IP address (from proxy headers or connection).
 */
function getClientId(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || req.ip
    || 'unknown';
}

/**
 * Check rate limit using Redis sliding window.
 * Returns { allowed, remaining, resetIn } or null if Redis is down (fail-open).
 */
export async function checkRateLimit(
  req: NextRequest
): Promise<{ allowed: boolean; remaining: number; resetIn: number } | null> {
  const pathname = req.nextUrl.pathname;
  const config = RATE_LIMITS[pathname] || DEFAULT_LIMIT;
  const clientId = getClientId(req);
  const key = `rl:${pathname}:${clientId}`;

  try {
    const now = Date.now();
    const windowMs = config.windowSec * 1000;
    const windowStart = now - windowMs;

    // Use Redis pipeline for atomic sliding window
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart); // Remove old entries
    pipeline.zadd(key, now, `${now}:${Math.random()}`); // Add current request
    pipeline.zcard(key); // Count requests in window
    pipeline.expire(key, config.windowSec + 1); // TTL cleanup

    const results = await pipeline.exec();
    if (!results) return null;

    const count = (results[2]?.[1] as number) || 0;
    const allowed = count <= config.max;
    const remaining = Math.max(0, config.max - count);

    // Find oldest entry to calculate reset time
    const resetIn = config.windowSec;

    return { allowed, remaining, resetIn };
  } catch {
    // Redis down — fail open (allow request)
    return null;
  }
}

/**
 * Create a 429 Too Many Requests response with rate limit headers.
 */
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

/**
 * Add rate limit headers to a successful response.
 */
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
