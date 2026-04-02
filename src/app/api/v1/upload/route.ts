import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { resolveUserId } from '@/lib/resolveUser';

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: { code: 'invalid_request', message: 'No file provided' } }, { status: 400 });

    // Validate
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) return NextResponse.json({ error: { code: 'file_too_large', message: 'Max 5MB' } }, { status: 400 });

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) return NextResponse.json({ error: { code: 'invalid_type', message: 'Only JPEG, PNG, WebP, GIF allowed' } }, { status: 400 });

    // Generate filename
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${userId}_${Date.now()}.${ext}`;

    // Save to public/uploads/
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', filename);
    await writeFile(uploadPath, buffer);

    const url = `/uploads/${filename}`;

    return NextResponse.json({ data: { url, filename } }, { status: 201 });
  } catch (err) {
    console.error('[Upload POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to upload' } }, { status: 500 });
  }
}
