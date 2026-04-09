import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * GET /api/v1/files/uploads/filename.jpg
 * Serves files from R2 bucket — works locally without public R2 URL.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const key = path.join('/');

  try {
    const { env } = (getCloudflareContext as any)() as { env: { R2_BUCKET: R2Bucket } };
    const object = await env.R2_BUCKET.get(key);

    if (!object) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new NextResponse(object.body as ReadableStream, { headers });
  } catch (err) {
    console.error('[Files]', err);
    return NextResponse.json({ error: 'Failed to fetch file' }, { status: 500 });
  }
}
