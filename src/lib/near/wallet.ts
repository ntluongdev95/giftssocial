'use client';

// Wallet connection for Kiss Chain — used both by the standalone
// /near-demo page and the production "Attach NEAR"/claim flow in
// KissGlobe.tsx. MyNearWallet is deliberately NOT included: it was
// sunset by NEAR on 2026-10-31 in favor of near.com (passkey-native),
// which has no wallet-selector module yet as of this writing — see
// the "Attach NEAR" section of CLAUDE.md-adjacent project notes for
// why NEAR Auth/FastAuth (which would need a self-hosted relayer) was
// also ruled out. Meteor + Here both support creating a brand-new
// wallet from inside the connect modal itself, so a receiver with no
// NEAR account yet isn't stuck.

import { setupWalletSelector, type WalletSelector } from '@near-wallet-selector/core';
import { setupModal, type WalletSelectorModal } from '@near-wallet-selector/modal-ui';
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
