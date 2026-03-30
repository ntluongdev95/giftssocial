import { NextResponse } from 'next/server';
import { signAccessToken } from '@/lib/jwt';

export async function POST() {
  try {
    const guestId = `guest_${crypto.randomUUID().replace(/-/g, '')}`;
    const token = await signAccessToken(guestId, 'guest');

    return NextResponse.json({
      guest_token: token,
      expires_in: 86400, // 24h
    });
  } catch (err) {
    console.error('[Auth Guest]', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create guest session' } },
      { status: 500 }
    );
  }
}
