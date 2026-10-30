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
  claim_secret_hash: string | null;
  hop_lat: number;
  hop_lng: number;
}

export interface JourneyHop {
  token_id: string;
  account_id: string;
  lat: number;
  lng: number;
  depth: number;
}

export interface BadgeInfo {
  bloom_count: number;
  level: string;
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

export function mintKiss(receiverId: string, message: string, expiresInHours: number, depositNear: string, lat: number, lng: number) {
  return callWrite(
    'mint_kiss',
    { receiver_id: receiverId, message, expires_in_hours: expiresInHours, lat, lng },
    nearToYocto(depositNear),
  );
}

export function reciprocate(tokenId: string) {
  return callWrite('reciprocate', { token_id: tokenId });
}

export function claim(tokenId: string) {
  return callWrite('claim', { token_id: tokenId });
}

export function relay(tokenId: string, receiverId: string, message: string, expiresInHours: number, depositNear: string, lat: number, lng: number) {
  return callWrite(
    'relay',
    { token_id: tokenId, receiver_id: receiverId, message, expires_in_hours: expiresInHours, lat, lng },
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

// hex(sha256(text)) via Web Crypto — used both to hash the claim secret
// before sending it to `lock_gift` (the plaintext itself only ever
// goes into the share link, never on chain) and, mirrored server-side
// in verify-tx.ts, to confirm a client-reported plaintext secret
// really matches what's on chain before trusting it.
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// A random secret only the share link/QR ever carries — this, not the
// gao_kiss_id, is the real access control for claiming (see
// claim_secret_hash on KissInfo in the contract for why the id alone
// isn't safe to rely on).
export function genClaimSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function lockGift(gaoKissId: string, expiresInHours: number, depositNear: string, claimSecret: string, lat: number, lng: number) {
  const claimSecretHash = await sha256Hex(claimSecret);
  return callWrite(
    'lock_gift',
    { gao_kiss_id: gaoKissId, expires_in_hours: expiresInHours, claim_secret_hash: claimSecretHash, lat, lng },
    nearToYocto(depositNear),
  );
}

export function claimGift(gaoKissId: string, claimSecret: string) {
  return callWrite('claim_gift', { gao_kiss_id: gaoKissId, claim_secret: claimSecret });
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

// This kiss's full relay chain as a route across the globe, root first.
// Free (view call), but still bounded contract-side against a
// pathologically long chain (see MAX_JOURNEY_HOPS in lib.rs).
export function getJourney(tokenId: string) {
  return callView<JourneyHop[]>('get_journey', { token_id: tokenId });
}

// An account's soulbound on-chain reputation (see BadgeInfo/award_bloom
// in lib.rs) — null if they've never had a kiss reciprocated or claimed.
export function getBadge(accountId: string) {
  return callView<BadgeInfo | null>('get_badge', { account_id: accountId });
}

export function nftTokensForOwner(accountId: string) {
  return callView<Array<{ token_id: string }>>('nft_tokens_for_owner', {
    account_id: accountId,
    from_index: '0',
    limit: 50,
  });
}
