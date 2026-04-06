import { NextRequest, NextResponse } from 'next/server';
import { getDB, parseRow } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/profiles/:id ────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDB();

    const raw = await db.prepare('SELECT * FROM profiles WHERE id = ?').bind(id).first<Record<string, unknown>>();

    if (!raw || raw.status === 'suspended') {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Profile not found' } },
        { status: 404 }
      );
    }

    const row = parseRow(raw) as Record<string, unknown>;
    const data: Record<string, unknown> = {
      _id: row.id,
      user_id: row.user_id,
      headline: row.headline,
      bio: row.bio,
      industry: row.industry,
      skills: row.skills,
      experience: row.experience,
      education: row.education,
      languages: row.languages,
      location: { type: 'Point', coordinates: [row.lng, row.lat] },
      city: row.city,
      available: row.available,
      work_type: row.work_type,
      portfolio_url: row.portfolio_url,
      contact_visible: row.contact_visible,
      trust_score_snapshot: row.trust_score_snapshot,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    if (row.contact_visible && row.salary_min != null) {
      data.salary_range = { min: row.salary_min, max: row.salary_max, currency: row.salary_currency };
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[Profile GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch profile' } },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/v1/profiles/:id — Hide my profile ──────────────────────

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Login required' } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const db = getDB();

    const row = await db.prepare('SELECT user_id FROM profiles WHERE id = ?').bind(id).first<{ user_id: string }>();

    if (!row) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Profile not found' } },
        { status: 404 }
      );
    }

    if (row.user_id !== userId) {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'Not your profile' } },
        { status: 403 }
      );
    }

    await db.prepare("UPDATE profiles SET status = 'hidden', updated_at = datetime('now') WHERE id = ?").bind(id).run();

    return NextResponse.json({ data: { id, status: 'hidden' } });
  } catch (err) {
    console.error('[Profile DELETE]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to delete profile' } },
      { status: 500 }
    );
  }
}
