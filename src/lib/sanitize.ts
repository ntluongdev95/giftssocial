/**
 * Escape HTML special characters to prevent XSS in innerHTML.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize a URL to prevent javascript: protocol injection.
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';
  const lower = url.trim().toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:text/html')) return '';
  return url;
}
