'use client';

// Wallet connection for the Kiss Chain NEAR demo. Separate from the
// production gift-sending flow on purpose — this wires a wallet
// straight to the deployed testnet contract for the hackathon demo,
// without touching anything the live app's users depend on.

import { setupWalletSelector, type WalletSelector } from '@near-wallet-selector/core';
import { setupModal, type WalletSelectorModal } from '@near-wallet-selector/modal-ui';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet';

export const CONTRACT_ID = 'kiss-chain-demo-2026.testnet';
export const NETWORK = 'testnet' as const;

let selectorPromise: Promise<WalletSelector> | null = null;

export function getSelector(): Promise<WalletSelector> {
  if (!selectorPromise) {
    selectorPromise = setupWalletSelector({
      network: NETWORK,
      modules: [setupMyNearWallet(), setupMeteorWallet()],
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
