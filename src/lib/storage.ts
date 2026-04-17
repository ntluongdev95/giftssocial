import { getCloudflareContext } from '@opennextjs/cloudflare';

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

/** Returns the public-facing base URL for uploaded files */
function getFileBaseUrl(): string {
  if (R2_PUBLIC_URL) return R2_PUBLIC_URL;
  // Fallback: serve via API proxy (works locally without R2 public access)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  return `${appUrl}/api/v1/files`;
}

function getR2(): R2Bucket {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { env } = (getCloudflareContext as any)() as { env: { R2_BUCKET: R2Bucket } };
  return env.R2_BUCKET;
}

// ─── Upload ──────────────────────────────────────────────────────────────

export async function uploadFile(filename: string, file: ArrayBuffer, contentType: string): Promise<string> {
  const key = `uploads/${filename}`;
  await getR2().put(key, file, { httpMetadata: { contentType } });
  return `${getFileBaseUrl()}/${key}`;
}

// ─── Delete ──────────────────────────────────────────────────────────────

// ─── Delete ──────────────────────────────────────────────────────────────

export async function deleteFile(fileUrl: string): Promise<void> {
  // Strip either R2 public URL or API proxy prefix
  const base = getFileBaseUrl();
  const key = fileUrl.replace(`${base}/`, '').replace(/^\/api\/v1\/files\//, '');
  await getR2().delete(key);
}
