import { NextRequest, NextResponse } from 'next/server';
import { getDB, genId } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// GET /api/v1/events/:id/location-grant — is the current user sharing location with co-attendees?
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });
    const { id: eventId } = await params;

    const db = getDB();
    const row = await db.prepare(
      `SELECT id, expires_at FROM event_location_grants
        WHERE user_id = ? AND event_id = ? AND expires_at > datetime('now')`
    ).bind(userId, eventId).first<{ id: string; expires_at: string }>();

    return NextResponse.json({ data: { granted: !!row, expires_at: row?.expires_at || null } });
  } catch (err) {
    console.error('[Event Location Grant GET]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to fetch grant' } }, { status: 500 });
  }
}

// POST /api/v1/events/:id/location-grant — opt in to share location with other attendees
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });
    const { id: eventId } = await params;

    const db = getDB();

    // Verify user has an active booking for this event
    const booking = await db.prepare(
      `SELECT id FROM bookings WHERE user_id = ? AND event_id = ? AND status IN ('pending', 'confirmed') LIMIT 1`
    ).bind(userId, eventId).first<{ id: string }>();
    if (!booking) {
      return NextResponse.json({ error: { code: 'not_attendee', message: 'You must book the event before sharing location' } }, { status: 403 });
    }

    // Expire at event end_time; fall back to 24h from now if event has no end_time
    const event = await db.prepare(`SELECT end_time, start_time FROM events WHERE id = ?`).bind(eventId).first<{ end_time: string | null; start_time: string }>();
    if (!event) {
      return NextResponse.json({ error: { code: 'not_found', message: 'Event not found' } }, { status: 404 });
    }
    const endMs = event.end_time ? Date.parse(event.end_time) : NaN;
    const fallbackMs = Date.now() + 24 * 3600 * 1000;
    const expiresAt = new Date(Math.max(isNaN(endMs) ? 0 : endMs, fallbackMs)).toISOString();

    // Upsert grant
    const existing = await db.prepare(`SELECT id FROM event_location_grants WHERE user_id = ? AND event_id = ?`).bind(userId, eventId).first<{ id: string }>();
    if (existing) {
      await db.prepare(`UPDATE event_location_grants SET expires_at = ? WHERE id = ?`).bind(expiresAt, existing.id).run();
    } else {
      await db.prepare(
        `INSERT INTO event_location_grants (id, user_id, event_id, expires_at) VALUES (?, ?, ?, ?)`
      ).bind(genId('elg_'), userId, eventId, expiresAt).run();
    }

    return NextResponse.json({ data: { granted: true, expires_at: expiresAt } });
  } catch (err) {
    console.error('[Event Location Grant POST]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to grant' } }, { status: 500 });
  }
}

// DELETE /api/v1/events/:id/location-grant — opt out
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 });
    const { id: eventId } = await params;

    const db = getDB();
    await db.prepare(`DELETE FROM event_location_grants WHERE user_id = ? AND event_id = ?`).bind(userId, eventId).run();
    return NextResponse.json({ data: { granted: false } });
  } catch (err) {
    console.error('[Event Location Grant DELETE]', err);
    return NextResponse.json({ error: { code: 'internal_error', message: 'Failed to revoke' } }, { status: 500 });
  }
}
