import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getDB } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// POST /api/v1/streaks/[id]/insights
//
// Generates two short paragraphs for a streak: benefits of maintaining it,
// risks of missing it. Result is cached in `streaks.insights_*`. If the
// columns are already populated, returns the cache unless `?refresh=1`.
//
// Permission: anyone who can see the streak (owner OR active partner) can
// trigger generation. Insights are not sensitive — they're general health
// info derived only from the streak's title/description.
//
// Body: ignored. Query: `?refresh=1` forces a re-gen.
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

  const refresh = req.nextUrl.searchParams.get('refresh') === '1';

  const db = getDB();
  try {
    const streak = await db
      .prepare(
        `SELECT id, owner_id, title, icon, description,
                insights_benefits, insights_risks, insights_generated_at
         FROM streaks
         WHERE id = ? AND status = 'active'`,
      )
      .bind(id)
      .first<{
        id: string;
        owner_id: string;
        title: string;
        icon: string;
        description: string;
        insights_benefits: string | null;
        insights_risks: string | null;
        insights_generated_at: string | null;
      }>();
    if (!streak) {
      return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
    }

    // Permission — owner OR active partner
    const isOwner = streak.owner_id === userId;
    if (!isOwner) {
      const partner = await db
        .prepare(
          `SELECT 1 AS ok FROM streak_partners
           WHERE streak_id = ? AND partner_id = ? AND status = 'active' LIMIT 1`,
        )
        .bind(id, userId)
        .first<{ ok: number }>();
      if (!partner) {
        return NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 });
      }
    }

    // Cache hit — return existing unless refresh requested
    if (!refresh && streak.insights_benefits && streak.insights_risks) {
      return NextResponse.json({
        data: {
          benefits: streak.insights_benefits,
          risks: streak.insights_risks,
          generated_at: streak.insights_generated_at,
          cached: true,
        },
      });
    }

    // Generate via Anthropic — fail fast with a clean error code if the
    // server isn't configured. The Anthropic SDK throws a vague
    // "Could not resolve authentication method" error when ANTHROPIC_API_KEY
    // is missing; we trade that for a structured response the UI can
    // render as a friendly "AI insights not configured" message.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (getCloudflareContext as any)().env as Record<string, string | undefined>;
    const apiKey = env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          error: {
            code: 'ai_not_configured',
            message: 'AI insights are not configured on this server.',
          },
        },
        { status: 503 },
      );
    }
    const client = new Anthropic({ apiKey });
    const habitDescriptor = streak.description
      ? `${streak.title} — ${streak.description}`
      : streak.title;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system:
        `You are a friendly health-and-wellness coach embedded in a habit-tracking app.
Given a habit, write TWO short paragraphs:
  1. "benefits" — 3-4 concrete things the user gains from doing this habit consistently (e.g. daily). Speak in second person ("You'll...").
  2. "risks"   — 3-4 specific consequences if the user frequently misses it. Speak in second person ("If you skip days, you may...").

Constraints:
- Each paragraph: 40-70 words. Tight, practical, no fluff.
- Grounded in mainstream health knowledge. No medical claims about disease cure/prevention.
- Use plain English (target reading age ~14). Avoid jargon.
- Don't list — write as flowing prose, but pack 3-4 distinct points.
- If the habit isn't clearly health-related, focus on relevant wellbeing benefits (productivity, mental state, social, etc.).

Output ONLY valid JSON in this exact shape:
{ "benefits": "string", "risks": "string" }`,
      messages: [
        {
          role: 'user',
          content: `Habit: "${habitDescriptor}"`,
        },
      ],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const rawText = textBlock ? textBlock.text : '{}';

    let parsed: { benefits: string; risks: string };
    try {
      const cleaned = rawText.trim().replace(/^```json\s*|\s*```$/g, '');
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: { code: 'ai_parse_error', message: 'Could not parse AI response' } },
        { status: 502 },
      );
    }
    if (!parsed.benefits || !parsed.risks) {
      return NextResponse.json(
        { error: { code: 'ai_invalid_response', message: 'AI response missing fields' } },
        { status: 502 },
      );
    }

    const now = new Date().toISOString();
    await db
      .prepare(
        `UPDATE streaks
         SET insights_benefits = ?, insights_risks = ?, insights_generated_at = ?
         WHERE id = ?`,
      )
      .bind(parsed.benefits, parsed.risks, now, id)
      .run();

    return NextResponse.json({
      data: {
        benefits: parsed.benefits,
        risks: parsed.risks,
        generated_at: now,
        cached: false,
      },
    });
  } catch (err) {
    console.error('[Streak insights POST]', err);
    return NextResponse.json(
      {
        error: {
          code: 'internal_error',
          message: err instanceof Error ? err.message : 'Failed to generate insights',
        },
      },
      { status: 500 },
    );
  }
}
