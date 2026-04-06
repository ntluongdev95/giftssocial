'use client';

import { getCsrfToken } from './csrf-client';

/**
 * Patch global fetch to auto-inject CSRF token on mutations to /api/.
 * Call once in app layout — all fetch() calls automatically protected.
 */
let patched = false;

export function installCsrfInterceptor() {
  if (patched || typeof window === 'undefined') return;
  patched = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = function csrfFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const method = (init?.method || 'GET').toUpperCase();
    const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

    if (!isMutation) return originalFetch(input, init);

    // Only inject for local API calls
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    const isLocalApi = url.startsWith('/api/') || url.includes('/api/v1/');

    if (!isLocalApi) return originalFetch(input, init);

    const csrf = getCsrfToken();
    if (!csrf) return originalFetch(input, init);

    const headers = new Headers(init?.headers);
    if (!headers.has('x-csrf-token')) {
      headers.set('x-csrf-token', csrf);
    }

    return originalFetch(input, { ...init, headers });
  };
}
