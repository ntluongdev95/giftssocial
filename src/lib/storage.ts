import { getCloudflareContext } from '@opennextjs/cloudflare';

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://cdn.gao.social';

function getR2(): R2Bucket {
  const { env } = (getCloudflareContext as any)() as { env: { R2_BUCKET: R2Bucket } };
  return env.R2_BUCKET;
}

// ─── Upload ──────────────────────────────────────────────────────────────

export async function uploadFile(filename: string, file: ArrayBuffer, contentType: string): Promise<string> {
  const key = `uploads/${filename}`;
  await getR2().put(key, file, { httpMetadata: { contentType } });
  return `${R2_PUBLIC_URL}/${key}`;
}

// ─── Delete ──────────────────────────────────────────────────────────────

export async function deleteFile(fileUrl: string): Promise<void> {
  const key = fileUrl.replace(`${R2_PUBLIC_URL}/`, '');
  await getR2().delete(key);
}
