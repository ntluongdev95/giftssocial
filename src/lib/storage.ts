import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { writeFile } from 'fs/promises';
import path from 'path';

// ─── Cloudflare R2 (production) ──────────────────────────────────────────

const useR2 = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);

const r2 = useR2
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

const R2_BUCKET = process.env.R2_BUCKET_NAME || 'gao-social-uploads';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

// ─── Upload ──────────────────────────────────────────────────────────────

export async function uploadFile(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  const key = `uploads/${filename}`;

  if (r2 && useR2) {
    // Production: Cloudflare R2
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
    return `${R2_PUBLIC_URL}/${key}`;
  } else {
    // Development: local public/uploads/
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', filename);
    await writeFile(uploadPath, buffer);
    return `/uploads/${filename}`;
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────

export async function deleteFile(fileUrl: string): Promise<void> {
  if (r2 && useR2 && fileUrl.includes(R2_PUBLIC_URL)) {
    const key = fileUrl.replace(`${R2_PUBLIC_URL}/`, '');
    await r2.send(new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    }));
  }
  // Local files: don't delete (dev only)
}

// ─── Info ────────────────────────────────────────────────────────────────

export function getStorageMode(): 'r2' | 'local' {
  return useR2 ? 'r2' : 'local';
}
