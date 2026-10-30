'use client';

// Thin wrapper around calling the deployed kiss-chain contract —
// writes (mint_kiss/reciprocate/claim/relay) go through the connected
// wallet so the user signs them; reads (get_kiss) go through a plain
// RPC view call, no wallet/signature needed.

import { providers } from 'near-api-js';
import { internalActionToNaj } from '@near-wallet-selector/core';
import { getSelector, CONTRACT_ID } from './wallet';

const RPC_URL = 'https://rpc.testnet.near.org';
const YOCTO_PER_NEAR = BigInt('1000000000000000000000000');

export function nearToYocto(near: string): string {
  const [whole, frac = ''] = near.split('.');
  const fracPadded = (frac + '0'.repeat(24)).slice(0, 24);
  return (BigInt(whole || '0') * YOCTO_PER_NEAR + BigInt(fracPadded || '0')).toString();
}

export function yoctoToNear(yocto: string): string {
  const v = BigInt(yocto);
  const whole = v / YOCTO_PER_NEAR;
  const frac = v % YOCTO_PER_NEAR;
  const fracStr = frac.toString().padStart(24, '0').replace(/0+$/, '') || '0';
  return `${whole}.${fracStr}`;
}

// Pulls a FunctionCall's own JSON return value (e.g. the new TokenId
// mint_kiss/relay hand back) out of a signed transaction's result.
// near-api-js types this loosely (receipts_outcome: unknown[]), so
// this reaches in defensively rather than trusting a strict shape —
// the first receipt whose outcome carries a non-empty SuccessValue
// (base64) is the one we want for these single-hop, no-cross-contract-
// call methods.
export function extractReturnValue<T>(outcome: unknown): T | null {
  const o = outcome as { receipts_outcome?: Array<{ outcome?: { status?: { SuccessValue?: string } } }> } | null;
  const receipts = o?.receipts_outcome ?? [];
  for (const r of receipts) {
    const b64 = r.outcome?.status?.SuccessValue;
    if (b64) {
      try {
        const text = typeof window === 'undefined'
          ? Buffer.from(b64, 'base64').toString('utf8')
          : atob(b64);
        return JSON.parse(text) as T;
      } catch {
        // Not JSON (or empty) — keep looking, some wallets emit more
        // than one receipt with a SuccessValue (e.g. gas refunds).
      }
    }
  }
  return null;
}

export type KissStatus = 'Pending' | 'Bloomed' | 'Wilted';

export interface KissInfo {
  sender_id: string;
  status: KissStatus;
  locked_amount: string;
  royalty_amount: string;
  expires_at: string;
  parent_token_id: string | null;
  root_sender_id: string;
  depth: number;
  relay_slots_remaining: number;
}

async function callWrite(methodName: string, args: Record<string, unknown>, depositYocto = '0', gas = '30000000000000') {
  const selector = await getSelector();
  const wallet = await selector.wallet();
  return wallet.signAndSendTransaction({
    receiverId: CONTRACT_ID,
    actions: [
      internalActionToNaj({
        type: 'FunctionCall',
        params: { methodName, args, gas, deposit: depositYocto },
      }),
    ],
  });
}

async function callView<T>(methodName: string, args: Record<string, unknown>): Promise<T> {
  const provider = new providers.JsonRpcProvider({ url: RPC_URL });
  const argsBase64 = Buffer.from(JSON.stringify(args)).toString('base64');
  const result = await provider.query({
    request_type: 'call_function',
    account_id: CONTRACT_ID,
    method_name: methodName,
    args_base64: argsBase64,
    finality: 'optimistic',
  });
  // near-api-js types this as a generic query result; the actual shape
  // for call_function always includes `result` as a byte array.
  const bytes = (result as unknown as { result: number[] }).result;
  const text = Buffer.from(bytes).toString('utf8');
  return text ? JSON.parse(text) : (null as T);
}

export function mintKiss(receiverId: string, message: string, expiresInHours: number, depositNear: string) {
  return callWrite(
    'mint_kiss',
    { receiver_id: receiverId, message, expires_in_hours: expiresInHours },
    nearToYocto(depositNear),
  );
}

export function reciprocate(tokenId: string) {
  return callWrite('reciprocate', { token_id: tokenId });
}

export function claim(tokenId: string) {
  return callWrite('claim', { token_id: tokenId });
}

export function relay(tokenId: string, receiverId: string, message: string, expiresInHours: number, depositNear: string) {
  return callWrite(
    'relay',
    { token_id: tokenId, receiver_id: receiverId, message, expires_in_hours: expiresInHours },
    nearToYocto(depositNear),
  );
}

export function reclaimIfWilted(tokenId: string) {
  return callWrite('reclaim_if_wilted', { token_id: tokenId });
}

export function getKiss(tokenId: string) {
  return callView<KissInfo | null>('get_kiss', { token_id: tokenId });
}

// ── App-integrated money gift (lock at send time, mint at claim time) ──
// See contracts/kiss-chain/src/lib.rs `lock_gift`/`claim_gift` and
// migration-039 — these back the "Attach NEAR" option on a real Kiss
// sent from the production app, not the standalone /near-demo page.

export function lockGift(gaoKissId: string, expiresInHours: number, depositNear: string) {
  return callWrite(
    'lock_gift',
    { gao_kiss_id: gaoKissId, expires_in_hours: expiresInHours },
    nearToYocto(depositNear),
  );
}

export function claimGift(gaoKissId: string) {
  return callWrite('claim_gift', { gao_kiss_id: gaoKissId });
}

export function getGift(gaoKissId: string) {
  return callView<KissInfo | null>('get_kiss', { token_id: `gift-${gaoKissId}` });
}

// Matches the server's genId('kiss_') scheme exactly (src/lib/db.ts) and
// the POST /api/v1/kisses zod regex (^kiss_[0-9a-f]{16}$) — generated
// client-side so the same id can be used both for the on-chain
// `lock_gift` call and the DB row created right after it.
export function genGaoKissId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `kiss_${hex}`;
}

export function nftTokensForOwner(accountId: string) {
  return callView<Array<{ token_id: string }>>('nft_tokens_for_owner', {
    account_id: accountId,
    from_index: '0',
    limit: 50,
  });
}
