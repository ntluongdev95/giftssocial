import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import type { EventRow } from '@/types/d1';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDB();
    const row = await db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first<EventRow>();
    if (!row) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Event not found' } }, { status: 404 });
    }
    return NextResponse.json({ data: row });
  } catch (err) {
    console.error('[Event GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch' } }, { status: 500 });
  }
}
