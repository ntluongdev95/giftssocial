import { NextRequest, NextResponse } from 'next/server';
import { resolveUserId } from '@/lib/resolveUser';
import { uploadFile } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: { code: 'invalid_request', message: 'No file provided' } }, { status: 400 });

    // Validate size
    const maxSize = 10 * 1024 * 1024; // 10MB (images + short videos)
    if (file.size > maxSize) return NextResponse.json({ error: { code: 'file_too_large', message: 'Max 10MB' } }, { status: 400 });

    // Validate type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) return NextResponse.json({ error: { code: 'invalid_type', message: 'Only images and short videos allowed' } }, { status: 400 });

    // Generate filename
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${userId}_${Date.now()}.${ext}`;

    const url = await uploadFile(filename, await file.arrayBuffer(), file.type);

    return NextResponse.json({ data: { url, filename } }, { status: 201 });
  } catch (err) {
    console.error('[Upload POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to upload' } }, { status: 500 });
  }
}
