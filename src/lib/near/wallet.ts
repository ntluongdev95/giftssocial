'use client';

// Wallet connection for Kiss Chain — used both by the standalone
// /near-demo page and the production "Attach NEAR"/claim flow in
// KissGlobe.tsx. MyNearWallet is deliberately NOT included: it was
// sunset by NEAR on 2026-10-31 in favor of near.com (passkey-native),
// which has no wallet-selector module yet as of this writing.
// NEAR Auth/FastAuth was also ruled out (needs a self-hosted relayer
// this project doesn't have).
//
// Bitte Wallet is listed FIRST and is the one that should actually be
// used: unlike Meteor/Here (both browser-extension wallets — if the
// extension isn't installed, clicking them does nothing and the
// 'signedIn' wait just hangs forever, confirmed by reading their real
// signIn() source, not assumed), Bitte is a hosted wallet — signIn()
// opens a real popup to wallet.bitte.ai, works for anyone with no
// install step, same UX MyNearWallet used to have. Meteor/Here are
// kept as secondary options for people who do have those installed.
import { setupWalletSelector, type WalletSelector, type WalletModuleFactory } from '@near-wallet-selector/core';
import { setupModal, type WalletSelectorModal } from '@near-wallet-selector/modal-ui';
// Without this the connect modal renders with zero styling — invisible,
// unclickable, and whatever called getModal()/awaited the 'signedIn'
// event just hangs forever (this exact bug already bit the standalone
// /near-demo page once; importing it here, in the shared module every
// caller goes through, means it can't be forgotten again per call site).
import '@near-wallet-selector/modal-ui/styles.css';
import { setupBitteWallet } from '@near-wallet-selector/bitte-wallet';
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet';
import { setupHereWallet } from '@near-wallet-selector/here-wallet';
import { CONTRACT_ID, NETWORK } from './constants';

export { CONTRACT_ID, NETWORK };

let selectorPromise: Promise<WalletSelector> | null = null;

export function getSelector(): Promise<WalletSelector> {
  if (!selectorPromise) {
    selectorPromise = setupWalletSelector({
      network: NETWORK,
      // @bitte-ai/wallet@0.8.2 (latest, pinned) still targets
      // @near-wallet-selector/core@8.x's types — a real, permanent
      // upstream version skew (confirmed via `npm ls`, not a typo),
      // not matching the v10 core this app uses everywhere else. The
      // runtime wallet-module contract (id/type/metadata/init →
      // signIn/signOut/getAccounts/signAndSendTransaction) is stable
      // across that gap, so this cast is safe; a straight type import
      // from the package is not.
      modules: [setupBitteWallet() as unknown as WalletModuleFactory, setupMeteorWallet(), setupHereWallet()],
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
