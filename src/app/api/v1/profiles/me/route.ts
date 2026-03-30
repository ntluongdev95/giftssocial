import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/profiles/me — Get my own profile ───────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ data: null });
    }

    const result = await pgPool.query('SELECT * FROM profiles WHERE user_id = $1', [userId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ data: null });
    }

    const row = result.rows[0];
    return NextResponse.json({
      data: {
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
        salary_range: row.salary_min != null ? { min: row.salary_min, max: row.salary_max, currency: row.salary_currency } : undefined,
        portfolio_url: row.portfolio_url,
        contact_visible: row.contact_visible,
        trust_score_snapshot: row.trust_score_snapshot,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  } catch (err) {
    console.error('[Profile Me GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch profile' } },
      { status: 500 }
    );
  }
}
