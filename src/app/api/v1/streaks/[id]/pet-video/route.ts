import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { generateSVD } from '@/lib/replicate-svd';

// POST /api/v1/streaks/[id]/pet-video
//
// Kicks off a Replicate Stable Video Diffusion pass over the streak's
// bond_breed_image_url. Returns the final MP4 URL on success or 504 if
// generation didn't finish in 90s. Caches the URL on the streak so
// repeat callers just get the existing video.
//
// Body: { force?: boolean }
//   When `force` is true, regenerates even if a video already exists.
//
// GET /api/v1/streaks/[id]/pet-video
//   Returns the current video status without triggering generation.

const POLL_TIMEOUT_MS = 90_000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });
  }

  const db = getDB();
  const streak = await db
    .prepare(
      `SELECT bond_breed_video_url, bond_breed_video_status, bond_breed_video_at
       FROM streaks WHERE id = ? AND status != 'archived'`,
    )
    .bind(id)
    .first<{
      bond_breed_video_url: string | null;
      bond_breed_video_status: string | null;
      bond_breed_video_at: string | null;
    }>();
  if (!streak) {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }
  return NextResponse.json({
    data: {
      url: streak.bond_breed_video_url,
      status: streak.bond_breed_video_status ?? 'pending',
      at: streak.bond_breed_video_at,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Login required' } },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { force?: boolean };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (getCloudflareContext as any)().env as Record<string, string | undefined>;
  const token =
    env.REPLICATE_API_TOKEN?.trim() || process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      {
        error: {
          code: 'ai_not_configured',
          message: 'Live pet video unavailable — REPLICATE_API_TOKEN not set.',
        },
      },
      { status: 503 },
    );
  }

  const db = getDB();
  try {
    const streak = await db
      .prepare(
        `SELECT s.id, s.owner_id, s.streak_type, s.bond_breed_image_url,
                s.bond_breed_video_url, s.bond_breed_video_status
         FROM streaks s
         WHERE s.id = ? AND s.status = 'active'`,
      )
      .bind(id)
      .first<{
        id: string;
        owner_id: string;
        streak_type: string;
        bond_breed_image_url: string | null;
        bond_breed_video_url: string | null;
        bond_breed_video_status: string | null;
      }>();
    if (!streak) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }
    if (streak.streak_type !== 'couple') {
      return NextResponse.json(
        { error: { code: 'invalid_streak_type', message: 'Pet video is couple-only.' } },
        { status: 400 },
      );
    }

    // Permission: owner OR active partner.
    const isOwner = streak.owner_id === userId;
    const partnerRow = await db
      .prepare(
        `SELECT 1 AS ok FROM streak_partners
         WHERE streak_id = ? AND partner_id = ? AND status = 'active' LIMIT 1`,
      )
      .bind(id, userId)
      .first<{ ok: number }>();
    if (!isOwner && !partnerRow) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }

    if (!streak.bond_breed_image_url) {
      return NextResponse.json(
        { error: { code: 'no_breed_photo', message: 'Pick a breed photo first.' } },
        { status: 400 },
      );
    }

    // Short-circuit when we already have a clip and the caller didn't ask
    // for a regenerate.
    if (streak.bond_breed_video_url && !body.force) {
      return NextResponse.json({
        data: {
          url: streak.bond_breed_video_url,
          status: 'ready',
          cached: true,
        },
      });
    }

    // Mark in-flight so concurrent callers can see progress.
    const startedAt = new Date().toISOString();
    await db
      .prepare(
        `UPDATE streaks SET bond_breed_video_status = 'generating',
                            bond_breed_video_at = ?
         WHERE id = ?`,
      )
      .bind(startedAt, id)
      .run();

    let videoUrl: string;
    try {
      videoUrl = await generateSVD(token, {
        inputImageUrl: streak.bond_breed_image_url,
        motionBucketId: 140,
        fps: 6,
        pollTimeoutMs: POLL_TIMEOUT_MS,
      });
    } catch (e) {
      await db
        .prepare(
          `UPDATE streaks SET bond_breed_video_status = 'failed',
                              bond_breed_video_at = ?
           WHERE id = ?`,
        )
        .bind(new Date().toISOString(), id)
        .run();
      const msg = e instanceof Error ? e.message : 'Generation failed';
      const isTimeout = msg.toLowerCase().includes('timed out');
      return NextResponse.json(
        { error: { code: isTimeout ? 'timeout' : 'replicate_error', message: msg } },
        { status: isTimeout ? 504 : 502 },
      );
    }

    const readyAt = new Date().toISOString();
    await db
      .prepare(
        `UPDATE streaks SET bond_breed_video_url = ?,
                            bond_breed_video_status = 'ready',
                            bond_breed_video_at = ?
         WHERE id = ?`,
      )
      .bind(videoUrl, readyAt, id)
      .run();

    return NextResponse.json({
      data: { url: videoUrl, status: 'ready', cached: false, at: readyAt },
    });
  } catch (err) {
    console.error('[Pet video POST]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to generate pet video.' } },
      { status: 500 },
    );
  }
}
