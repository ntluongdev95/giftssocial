'use client';

// Wallet connection for Kiss Chain — used both by the standalone
// /near-demo page and the production "Attach NEAR"/claim flow in
// KissGlobe.tsx. MyNearWallet is deliberately NOT included: it was
// sunset by NEAR on 2026-10-31 in favor of near.com (passkey-native),
// which has no wallet-selector module yet as of this writing.
// NEAR Auth/FastAuth was also ruled out (needs a self-hosted relayer
// this project doesn't have).
//
// Bitte Wallet was tried as the primary option (hosted, no install
// step) but REMOVED after finding its testnet deployment is dead:
// `testnet.wallet.bitte.ai` fails to resolve in DNS at all (confirmed
// with `curl -v`, NXDOMAIN — not a sandbox/network restriction, since
// wallet.bitte.ai with no "testnet." prefix and every other domain
// tested resolved fine). @bitte-ai/wallet@0.8.2 (latest, pinned)
// hardcodes that URL for networkId "testnet" with no override — every
// click would fail for every real user, not just here.
//
// Meteor is a browser-extension wallet, but its signIn() has a real,
// working fallback for when the extension isn't installed: it opens a
// web popup at wallet.meteorwallet.app instead (confirmed that domain
// is alive). Here is extension-only with no such fallback observed.
import { setupWalletSelector, type WalletSelector } from '@near-wallet-selector/core';
import { setupModal, type WalletSelectorModal } from '@near-wallet-selector/modal-ui';
// Without this the connect modal renders with zero styling — invisible,
// unclickable, and whatever called getModal()/awaited the 'signedIn'
// event just hangs forever (this exact bug already bit the standalone
// /near-demo page once; importing it here, in the shared module every
// caller goes through, means it can't be forgotten again per call site).
import '@near-wallet-selector/modal-ui/styles.css';
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet';
import { setupHereWallet } from '@near-wallet-selector/here-wallet';
import { CONTRACT_ID, NETWORK } from './constants';

export { CONTRACT_ID, NETWORK };

let selectorPromise: Promise<WalletSelector> | null = null;

export function getSelector(): Promise<WalletSelector> {
  if (!selectorPromise) {
    selectorPromise = setupWalletSelector({
      network: NETWORK,
      modules: [setupMeteorWallet(), setupHereWallet()],
    });
  }
  return selectorPromise;
}

export async function getModal(): Promise<WalletSelectorModal> {
  const selector = await getSelector();
  return setupModal(selector, { contractId: CONTRACT_ID });
}

export async function getSignedInAccountId(): Promise<string | null> {
  const selector = await getSelector();
  const state = selector.store.getState();
  return state.accounts.find((a) => a.active)?.accountId ?? null;
}

export async function signOut(): Promise<void> {
  const selector = await getSelector();
  const wallet = await selector.wallet();
  await wallet.signOut();
}
