import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';

// GET /api/v1/messages/counts?room_ids=id1,id2,id3
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const roomIds = searchParams.get('room_ids')?.split(',').filter(Boolean);

    if (!roomIds || roomIds.length === 0) {
      return NextResponse.json({ data: {} });
    }

    const placeholders = roomIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await pgPool.query(
      `SELECT room_id, COUNT(*)::int AS count FROM messages WHERE room_id IN (${placeholders}) GROUP BY room_id`,
      roomIds
    );

    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.room_id] = row.count;
    }

    return NextResponse.json({ data: counts });
  } catch (err) {
    console.error('[Messages Counts]', err);
    return NextResponse.json({ data: {} });
  }
}
