import { getCsrfToken } from './csrf-client';

/**
 * Secure fetch wrapper that auto-injects CSRF token for mutations.
 * Drop-in replacement for window.fetch for /api/ calls.
 */
export function secureFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

  if (isMutation) {
    const headers = new Headers(init?.headers);
    const csrf = getCsrfToken();
    if (csrf && !headers.has('x-csrf-token')) {
      headers.set('x-csrf-token', csrf);
    }
    return fetch(input, { ...init, headers });
  }

  return fetch(input, init);
}
