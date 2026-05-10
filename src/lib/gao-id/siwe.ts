/**
 * Gao ID — SIWE (EIP-4361) message construction.
 *
 * Builds the exact string the wallet will sign. The issuer
 * (gao-id-worker) re-parses the message inside POST /v2/auth/verify and
 * matches `domain` against SIWE_DOMAIN and `uri` against
 * ALLOWED_ORIGINS. Any mismatch returns 401 invalid_siwe.
 */

import { SiweMessage } from 'siwe';
import { getAddress } from 'viem';

import { getConfig } from './config';

export interface BuildSiweMessageInput {
  /** EIP-55-checksummed address from the connected wallet. */
  address: `0x${string}`;
  /** EVM chainId from the connected wallet. */
  chainId: number;
  /** Nonce from POST /v2/auth/nonce — alphanumeric, 16+ chars per issuer. */
  nonce: string;
  /** Optional issuance time (ISO-8601). Defaults to now. */
  issuedAt?: string;
  /** Optional expirationTime (ISO-8601). */
  expirationTime?: string;
}

export const SIWE_STATEMENT = 'Sign in with Gao ID';

/**
 * Returns the prepared SIWE message string ready for the wallet to
 * sign. `domain` and `uri` come from runtime config so we never drift
 * from the issuer's allowlist.
 */
export function buildSiweMessage(input: BuildSiweMessageInput): string {
  const { siweDomain, appUrl } = getConfig();
  // SIWE requires line 2 (the address) to be EIP-55 checksummed. Mobile
  // WalletConnect connectors sometimes return all-lowercase addresses
  // from `useAccount()`, which trips the `siwe` library's strict parse
  // ("invalid EIP-55 address …"). Normalize defensively here.
  const checksummed = getAddress(input.address) as `0x${string}`;
  const message = new SiweMessage({
    domain: siweDomain,
    address: checksummed,
    statement: SIWE_STATEMENT,
    uri: appUrl,
    version: '1',
    chainId: input.chainId,
    nonce: input.nonce,
    issuedAt: input.issuedAt ?? new Date().toISOString(),
    expirationTime: input.expirationTime,
  });
  return message.prepareMessage();
}
