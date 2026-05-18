import { NextRequest, NextResponse } from 'next/server';

// ─── GET /api/v1/marketplace/payment-mapping ──────────────────────────────
// Stub endpoint. The user will provide the real lookup later — it should
// take a Gao domain and return the recipient wallet:
//
//   GET /api/v1/marketplace/payment-mapping?gao_domain=foo.gao
//   →
//   {
//     "data": {
//       "gao_domain": "foo.gao",
//       "chain": "base-sepolia" | "base" | "ethereum" | "polygon" | ...,
//       "chain_id": 84532,
//       "token": "USDC" | "USDT",
//       "token_address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
//       "recipient_address": "0x1234...",
//       "status": "active"
//     }
//   }
//
// For now this stub returns a fixed sample so the frontend can render the
// connect-wallet + payment flow end-to-end. Wire the real resolver in by
// replacing the body below.
export async function GET(req: NextRequest) {
  const gaoDomain = req.nextUrl.searchParams.get('gao_domain')?.trim();
  if (!gaoDomain) {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: 'gao_domain required' } },
      { status: 400 },
    );
  }

  // TODO(user): replace with real domain → wallet mapping (incoming API).
  // The placeholder address is the Base Sepolia USDC test address paired
  // with a burn-address-style recipient so accidental sends are obvious.
  const stub = {
    gao_domain: gaoDomain,
    chain: 'base-sepolia',
    chain_id: 84532,
    token: 'USDC',
    token_address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    recipient_address: '0x0000000000000000000000000000000000000000',
    status: 'placeholder' as const,
    note: 'Payment routing not yet configured — using placeholder. Provide real mapping API to swap.',
  };

  return NextResponse.json(
    { data: stub },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
