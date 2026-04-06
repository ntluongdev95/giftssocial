import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

// GET /api/v1/messages/counts?room_ids=id1,id2,id3
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const roomIds = searchParams.get('room_ids')?.split(',').filter(Boolean);

    if (!roomIds || roomIds.length === 0) {
      return NextResponse.json({ data: {} });
    }

    const db = getDB();
    const placeholders = roomIds.map(() => '?').join(',');
    const result = await db.prepare(
      `SELECT room_id, COUNT(*) AS count FROM messages WHERE room_id IN (${placeholders}) GROUP BY room_id`
    ).bind(...roomIds).all<{ room_id: string; count: number }>();

    const counts: Record<string, number> = {};
    for (const row of result.results) {
      counts[row.room_id] = row.count;
    }

    return NextResponse.json({ data: counts });
  } catch (err) {
    console.error('[Messages Counts]', err);
    return NextResponse.json({ data: {} });
  }
}
