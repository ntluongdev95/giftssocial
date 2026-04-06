import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDB, genId, parseRows } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

// ─── GET /api/v1/profiles — Search profiles by location / industry / skills ──

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radiusKm = Math.min(parseInt(searchParams.get('radius') || '50000'), 200000) / 1000;
    const industry = searchParams.get('industry');
    const skills = searchParams.get('skills')?.split(',').map((s) => s.trim()).filter(Boolean);
    const workType = searchParams.get('work_type');
    const q = searchParams.get('q')?.trim();
    const availableOnly = searchParams.get('available') !== 'false';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const cursor = searchParams.get('cursor');

    const conditions: string[] = ["status = 'active'"];
    const values: unknown[] = [];

    if (q) {
      conditions.push(`(headline LIKE ? OR bio LIKE ? OR city LIKE ? OR industry LIKE ?)`);
      values.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (availableOnly && !q) {
      conditions.push('available = 1');
    }

    if (industry) {
      conditions.push(`industry = ?`);
      values.push(industry);
    }

    if (skills && skills.length > 0) {
      // Simplified text search for each skill
      const skillConditions = skills.map(() => `skills LIKE ?`);
      conditions.push(`(${skillConditions.join(' AND ')})`);
      for (const s of skills) {
        values.push(`%${s}%`);
      }
    }

    if (workType) {
      conditions.push(`work_type = ?`);
      values.push(workType);
    }

    if (cursor) {
      conditions.push(`id > ?`);
      values.push(cursor);
    }

    // Order by distance if location provided, otherwise created_at DESC
    let orderBy = 'created_at DESC';
    if (lat !== 0 || lng !== 0) {
      conditions.push(`
        (6371 * acos(
          cos(radians(?)) * cos(radians(lat)) *
          cos(radians(lng) - radians(?)) +
          sin(radians(?)) * sin(radians(lat))
        )) < ?
      `);
      values.push(lat, lng, lat, radiusKm);
      orderBy = `(6371 * acos(cos(radians(${lat})) * cos(radians(lat)) * cos(radians(lng) - radians(${lng})) + sin(radians(${lat})) * sin(radians(lat))))`;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit + 1);

    const db = getDB();
    const result = await db.prepare(
      `SELECT * FROM profiles ${where} ORDER BY ${orderBy} LIMIT ?`
    ).bind(...values).all<Record<string, unknown>>();

    const rows = result.results;
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    // Parse JSON fields and transform to API format
    const data = parseRows(items).map(profileRowToApi);

    return NextResponse.json({
      data,
      pagination: { cursor: nextCursor, limit, has_more: hasMore },
    });
  } catch (err) {
    console.error('[Profiles GET]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch profiles' } },
      { status: 500 }
    );
  }
}

// ─── POST /api/v1/profiles — Create or update my profile ────────────────

const experienceSchema = z.object({
  title: z.string().min(1).max(100),
  company: z.string().min(1).max(100),
  start_year: z.number().int().min(1950).max(2100),
  end_year: z.number().int().min(1950).max(2100).nullable().optional(),
  description: z.string().max(500).optional(),
});

const educationSchema = z.object({
  degree: z.string().min(1).max(100),
  school: z.string().min(1).max(100),
  year: z.number().int().min(1950).max(2100),
});

const profileSchema = z.object({
  headline: z.string().min(1).max(120),
  bio: z.string().max(1000).optional(),
  industry: z.string().min(1).max(50),
  skills: z.array(z.string().max(30)).max(20).optional(),
  experience: z.array(experienceSchema).max(10).optional(),
  education: z.array(educationSchema).max(5).optional(),
  languages: z.array(z.string().max(30)).max(10).optional(),
  location: z.object({
    type: z.literal('Point').default('Point'),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  city: z.string().max(100).optional(),
  available: z.boolean().optional(),
  work_type: z.enum(['remote', 'onsite', 'hybrid']).optional(),
  salary_range: z
    .object({
      min: z.number().min(0),
      max: z.number().min(0),
      currency: z.string().max(3).default('USD'),
    })
    .optional(),
  portfolio_url: z.string().url().max(500).optional(),
  contact_visible: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);

    if (!userId) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Account required' } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = profileSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: { code: 'invalid_request', message: issue.message, field: String(issue.path.join('.')) } },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const [lng, lat] = data.location.coordinates;
    const db = getDB();

    // SELECT + INSERT/UPDATE pattern (no ON CONFLICT on user_id)
    const existing = await db.prepare('SELECT id FROM profiles WHERE user_id = ?').bind(userId).first<{ id: string }>();

    let row: Record<string, unknown> | null;
    if (existing) {
      row = await db.prepare(
        `UPDATE profiles SET
           headline=?, bio=?, industry=?,
           skills=?, experience=?, education=?,
           languages=?, lat=?, lng=?, city=?,
           available=?, work_type=?,
           salary_min=?, salary_max=?, salary_currency=?,
           portfolio_url=?, contact_visible=?,
           status='active', updated_at=datetime('now')
         WHERE user_id=? RETURNING id, status, updated_at`
      ).bind(
        data.headline, data.bio || '', data.industry,
        JSON.stringify(data.skills || []),
        JSON.stringify(data.experience || []),
        JSON.stringify(data.education || []),
        JSON.stringify(data.languages || []),
        lat, lng, data.city || '',
        data.available ?? true ? 1 : 0,
        data.work_type || 'onsite',
        data.salary_range?.min || null,
        data.salary_range?.max || null,
        data.salary_range?.currency || 'USD',
        data.portfolio_url || null,
        data.contact_visible ?? false ? 1 : 0,
        userId
      ).first<Record<string, unknown>>();
    } else {
      const id = genId('pro_');
      row = await db.prepare(
        `INSERT INTO profiles (id, user_id, headline, bio, industry, skills, experience, education, languages, lat, lng, city, available, work_type, salary_min, salary_max, salary_currency, portfolio_url, contact_visible, status, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',datetime('now'))
         RETURNING id, status, updated_at`
      ).bind(
        id, userId,
        data.headline, data.bio || '', data.industry,
        JSON.stringify(data.skills || []),
        JSON.stringify(data.experience || []),
        JSON.stringify(data.education || []),
        JSON.stringify(data.languages || []),
        lat, lng, data.city || '',
        data.available ?? true ? 1 : 0,
        data.work_type || 'onsite',
        data.salary_range?.min || null,
        data.salary_range?.max || null,
        data.salary_range?.currency || 'USD',
        data.portfolio_url || null,
        data.contact_visible ?? false ? 1 : 0
      ).first<Record<string, unknown>>();
    }

    return NextResponse.json(
      { data: { id: row?.id, status: row?.status, updated_at: row?.updated_at } },
      { status: 201 }
    );
  } catch (err) {
    console.error('[Profiles POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to save profile' } },
      { status: 500 }
    );
  }
}

// ─── Row to API format ──────────────────────────────────────────────────

function profileRowToApi(row: Record<string, unknown>) {
  return {
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
  };
}
