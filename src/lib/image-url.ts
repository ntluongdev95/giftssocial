/**
 * Rewrite legacy cdn.gao.social image URLs to work locally via API proxy.
 * Safe to import from both client and server components.
 */
export function rewriteImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (!url.includes('cdn.gao.social')) return url;
  // Extract key from old URL: https://cdn.gao.social/uploads/xxx → /api/v1/files/uploads/xxx
  const key = url.replace(/^https?:\/\/cdn\.gao\.social\//, '');
  const publicUrl = process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_URL;
  if (publicUrl) return `${publicUrl}/${key}`;
  return `/api/v1/files/${key}`;
}
