import { NextRequest } from 'next/server';

/**
 * Resolve user ID from request headers. Middleware verifies the JWT (or
 * auto-refreshes) and stamps `x-user-id` — this helper is the single source
 * of truth for "who is the caller". No fallback paths: anything reaching here
 * without `x-user-id` is unauthenticated.
 */
export async function resolveUserId(req: NextRequest): Promise<string | null> {
  return req.headers.get('x-user-id');
}
