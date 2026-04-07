import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { getDB, getKV } from '@/lib/db';
import { resolveUserId } from '@/lib/resolveUser';

const schema = z.object({
  query: z.string().min(1).max(500),
  context: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Account required to use Ask Gao' } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: parsed.error.issues[0].message } },
        { status: 400 }
      );
    }

    const { query, context } = parsed.data;

    // Rate limit: 30/hour via KV
    try {
      const kv = getKV();
      const countStr = await kv.get(`rate:ai:${userId}`);
      const count = countStr ? parseInt(countStr as string) : 0;
      if (count >= 30) {
        return NextResponse.json(
          { error: { code: 'rate_limited', message: 'Max 30 AI queries per hour' } },
          { status: 429 }
        );
      }
    } catch {
      // KV down — allow through
    }

    const db = getDB();

    // Fetch trusted entities from D1
    const [bizResult, eventResult] = await Promise.all([
      db.prepare(
        `SELECT id, name, category, trust_score, trust_level, rating_avg, booking_enabled,
                location_lat, location_lng,
                (6371000 * acos(
                  cos(radians(?)) * cos(radians(location_lat)) *
                  cos(radians(location_lng) - radians(?)) +
                  sin(radians(?)) * sin(radians(location_lat))
                )) AS distance_meters
         FROM businesses
         WHERE status = 'active' AND trust_score >= 60
           AND location_lat IS NOT NULL
           AND (6371000 * acos(
             cos(radians(?)) * cos(radians(location_lat)) *
             cos(radians(location_lng) - radians(?)) +
             sin(radians(?)) * sin(radians(location_lat))
           )) < 10000
         ORDER BY trust_score DESC
         LIMIT 10`
      ).bind(context.lat, context.lng, context.lat, context.lat, context.lng, context.lat).all<Record<string, unknown>>().catch(() => ({ results: [] })),

      db.prepare(
        `SELECT id, title, host_type, host_id, location_name, start_time, end_time, joined_count, capacity,
                location_lat, location_lng
         FROM events
         WHERE status IN ('scheduled', 'live') AND start_time > datetime('now')
           AND location_lat IS NOT NULL
           AND (6371000 * acos(
             cos(radians(?)) * cos(radians(location_lat)) *
             cos(radians(location_lng) - radians(?)) +
             sin(radians(?)) * sin(radians(location_lat))
           )) < 10000
         ORDER BY start_time ASC
         LIMIT 5`
      ).bind(context.lat, context.lng, context.lat).all<Record<string, unknown>>().catch(() => ({ results: [] })),
    ]);

    const trustedBusinesses = bizResult.results;
    const upcomingEvents = eventResult.results;

    const nearbyContext = JSON.stringify({
      businesses: trustedBusinesses,
      events: upcomingEvents,
    });

    // Call Anthropic API
    const client = new Anthropic();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: `You are Ask Gao, a trusted local discovery assistant for Gao Social.
Only recommend entities with trust_score >= 60 from the provided context.
Return max 3 recommendations.
Respond ONLY with valid JSON in this format:
{ "answer": "brief answer string", "results": [{ "type": "business"|"event", "id": "string", "name": "string", "trust_score": number, "reason": "why recommended" }], "suggested_actions": ["follow-up query 1", "follow-up query 2"] }`,
      messages: [
        {
          role: 'user',
          content: `User query: "${query}"\n\nNearby trusted options:\n${nearbyContext}`,
        },
      ],
    });

    // Parse response
    const textBlock = response.content.find((b) => b.type === 'text');
    const rawText = textBlock ? textBlock.text : '{}';

    let aiResult: { answer: string; results: Array<{ type: string; id: string; name: string; trust_score: number; reason: string }>; suggested_actions: string[] };
    try {
      aiResult = JSON.parse(rawText);
    } catch {
      aiResult = {
        answer: rawText,
        results: [],
        suggested_actions: [],
      };
    }

    // Enrich results with full entity data
    const enrichedResults = [];
    for (const r of aiResult.results.slice(0, 3)) {
      if (r.type === 'business') {
        const biz = trustedBusinesses.find((b: Record<string, unknown>) => b.id === r.id);
        if (biz) enrichedResults.push({ ...biz, _reason: r.reason });
      } else if (r.type === 'event') {
        const evt = upcomingEvents.find((e: Record<string, unknown>) => e.id === r.id);
        if (evt) enrichedResults.push({ ...evt, _reason: r.reason });
      }
    }

    // Increment rate limit in KV
    try {
      const kv = getKV();
      const countStr = await kv.get(`rate:ai:${userId}`);
      const count = countStr ? parseInt(countStr as string) : 0;
      await kv.put(`rate:ai:${userId}`, String(count + 1), { expirationTtl: 3600 });
    } catch {
      // KV down — skip
    }

    return NextResponse.json({
      answer: aiResult.answer,
      results: enrichedResults,
      suggested_actions: aiResult.suggested_actions || [],
    });
  } catch (err) {
    console.error('[Ask Gao]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Ask Gao is temporarily unavailable' } },
      { status: 500 }
    );
  }
}
