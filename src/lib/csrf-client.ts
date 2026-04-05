/**
 * Client-side CSRF helper.
 * Reads the gao_csrf cookie and returns the token for use in request headers.
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)gao_csrf=([^;]*)/);
  return match?.[1] || null;
}

/**
 * Returns headers object with CSRF token included.
 * Use with fetch() for POST/PUT/DELETE requests.
 */
export function csrfHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getCsrfToken();
  const headers: Record<string, string> = { ...extra };
  if (token) headers['x-csrf-token'] = token;
  return headers;
}
