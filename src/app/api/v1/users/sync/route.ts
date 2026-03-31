import { NextRequest, NextResponse } from 'next/server';
import { pgPool } from '@/lib/db';
import { USER_API_URL, APP_TYPE_GAO_DOMAINS } from '@/types/constants';

// ─── POST /api/v1/users/sync — Sync external user to local DB ───────────
// Called after passkey login to upsert user info locally

export async function POST(req: NextRequest) {
  try {
    // Get token from request
    const token = req.headers.get('x-auth-token') ||
      req.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Token required' } },
        { status: 401 }
      );
    }

    // Fetch user info from external API
    const extRes = await fetch(`${USER_API_URL}/api/v1/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'App-Type': APP_TYPE_GAO_DOMAINS,
        'Content-Type': 'application/json',
      },
    });

    if (!extRes.ok) {
      return NextResponse.json(
        { error: { code: 'external_api_error', message: 'Failed to fetch user from auth service' } },
        { status: 502 }
      );
    }

    const extData = await extRes.json();
    const u = extData?.data;

    if (!u?.id) {
      return NextResponse.json(
        { error: { code: 'invalid_user', message: 'No user data from auth service' } },
        { status: 400 }
      );
    }

    // Upsert into local users table
    const result = await pgPool.query(
      `INSERT INTO users (id, username, display_name, email, phone, avatar_url, bio, location_lat, location_lng, city, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (id) DO UPDATE SET
         username = COALESCE(EXCLUDED.username, users.username),
         display_name = COALESCE(EXCLUDED.display_name, users.display_name),
         email = COALESCE(EXCLUDED.email, users.email),
         phone = COALESCE(EXCLUDED.phone, users.phone),
         avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
         bio = COALESCE(EXCLUDED.bio, users.bio),
         last_seen_at = NOW(),
         updated_at = NOW()
       RETURNING id, username, display_name, avatar_url, trust_score, trust_level, badges, gao_points, gao_domain,
                 proofs_count, bookings_count, reviews_count, circles_count, followers_count, following_count,
                 created_at`,
      [
        u.id,
        u.username || null,
        u.full_name || u.display_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || null,
        u.email || null,
        u.phone_number || null,
        u.avatar_url || null,
        u.bio || null,
        u.location_lat || null,
        u.location_lng || null,
        u.city || null,
      ]
    );

    const localUser = result.rows[0];

    return NextResponse.json({ data: localUser });
  } catch (err) {
    console.error('[Users Sync]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to sync user' } },
      { status: 500 }
    );
  }
}
