// Server-side only. Verifies a NEAR transaction hash the client hands us
// actually did what it claims, by reading it back from NEAR's own RPC —
// never trust a client-reported "I locked N NEAR" without checking the
// chain itself. Field shapes below (transaction.actions[0].FunctionCall,
// top-level status.SuccessValue) are taken from a real RPC response
// inspected directly (provider.txStatus against a known testnet tx),
// not from near-api-js's TypeScript types alone.

import { providers } from 'near-api-js';
import { CONTRACT_ID } from './constants';

const RPC_URL = 'https://rpc.testnet.near.org';

export interface VerifiedFunctionCall {
  signerId: string;
  receiverId: string;
  methodName: string;
  args: Record<string, unknown>;
  depositYocto: string;
}

// Throws with a specific, user-safe-ish message on any mismatch —
// callers should catch and turn this into a 400/409, not a 500.
export async function verifyNearFunctionCall(
  txHash: string,
  signerId: string,
): Promise<VerifiedFunctionCall> {
  const provider = new providers.JsonRpcProvider({ url: RPC_URL });
  const outcome = await provider.txStatus(txHash, signerId, 'FINAL');

  const tx = outcome.transaction as unknown as {
    signer_id: string;
    receiver_id: string;
    actions: Array<{ FunctionCall?: { method_name: string; args: string; deposit: string } }>;
  };

  if (tx.signer_id !== signerId) {
    throw new Error(`Transaction signer (${tx.signer_id}) does not match the claimed account (${signerId})`);
  }
  if (tx.receiver_id !== CONTRACT_ID) {
    throw new Error(`Transaction was not sent to the kiss-chain contract (got ${tx.receiver_id})`);
  }

  const fc = tx.actions.find((a) => a.FunctionCall)?.FunctionCall;
  if (!fc) throw new Error('Transaction has no FunctionCall action');

  const status = outcome.status as unknown as { SuccessValue?: string; Failure?: unknown };
  if (typeof status !== 'object' || status === null || !('SuccessValue' in status)) {
    throw new Error('Transaction did not succeed on-chain');
  }

  const args = JSON.parse(Buffer.from(fc.args, 'base64').toString('utf8')) as Record<string, unknown>;

  return {
    signerId: tx.signer_id,
    receiverId: tx.receiver_id,
    methodName: fc.method_name,
    args,
    depositYocto: fc.deposit,
  };
}

// Server-side mirror of src/lib/near/kiss-contract.ts's sha256Hex — Web
// Crypto, not node:crypto, so this runs the same way in the Cloudflare
// Workers runtime this app actually deploys to. Used to confirm a
// client-reported plaintext claim secret really hashes to what's on
// chain before trusting it enough to cache in the DB.
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
