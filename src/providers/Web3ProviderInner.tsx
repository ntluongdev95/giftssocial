/**
 * Gao ID — wagmi + Reown AppKit provider tree.
 *
 * Loaded only when NEXT_PUBLIC_GAO_ID_ENABLED === 'true'. Module-level
 * side effects (createAppKit, WagmiAdapter) execute exactly once when
 * this file is dynamically imported by Web3Provider; the Reown modal
 * singleton lives for the page lifetime.
 *
 * Networks list mirrors the gao-id-worker TEST tier CHAIN_ID_ALLOWLIST
 * so a wallet on any allowed chain can complete /v2/auth/verify.
 */

'use client';

import { useState, type PropsWithChildren } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  bsc,
  bscTestnet,
  mainnet,
  optimism,
  optimismSepolia,
  polygon,
  sepolia,
  type AppKitNetwork,
} from '@reown/appkit/networks';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

if (!projectId) {
  throw new Error('gao-id: NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required when Gao ID is enabled');
}
if (!appUrl) {
  throw new Error('gao-id: NEXT_PUBLIC_APP_URL is required when Gao ID is enabled');
}

const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  mainnet,
  optimism,
  bsc,
  bscTestnet,
  polygon,
  base,
  arbitrum,
  baseSepolia,
  arbitrumSepolia,
  sepolia,
  optimismSepolia,
];

const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  // ssr:true mirrors the proven test-gao-domains and gao-explorer config.
  // Cloudflare Worker output goes through OpenNext SSR, and `ssr:false`
  // can race with hydration on mobile WebKit and let the WC v2 client
  // attempt to resume a parked pairing in parallel with a fresh connect.
  ssr: true,
});

// Declared as a variable (not inline) so TypeScript's excess-property
// check doesn't reject the extra `redirect` key. Reown's public Metadata
// type is the minimal `{ name, description, url, icons }` shape, but its
// underlying WalletConnect UniversalProvider accepts `redirect` at
// runtime and forwards it into the WC v2 `proposer.metadata`. Setting
// `universal` tells mobile wallets the https URL to refocus after
// approving a session request — proven by test-gao-domains as the
// single biggest cause of mobile wallets leaving the user stuck in the
// wallet app after approving on iOS Safari/Chrome.
const appKitMetadata = {
  name: 'Gao Social',
  description: 'Sign in with Gao ID',
  url: appUrl,
  icons: [`${appUrl}/icons/pwa-192.png`],
  redirect: {
    universal: appUrl,
  },
};

if (typeof window !== 'undefined') {
  console.info('[gao-id] AppKit init', {
    projectId,
    metadataUrl: appKitMetadata.url,
    metadataRedirectUniversal: appKitMetadata.redirect.universal,
    currentOrigin: window.location.origin,
  });
  // A drift between metadata.url and the live origin is the most
  // common cause of iOS universal-link return landing on a foreign tab
  // and the SIWE flow deadlocking. Surface it loudly in non-prod so
  // it's caught during deploy smoke-testing.
  if (appKitMetadata.url !== window.location.origin) {
    console.warn(
      '[gao-id] NEXT_PUBLIC_APP_URL does not match window.location.origin — iOS deeplink return will break',
      { appUrl: appKitMetadata.url, origin: window.location.origin },
    );
  }
}

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  defaultNetwork: networks[0],
  projectId,
  metadata: appKitMetadata,
  features: {
    email: false,
    socials: false,
    swaps: false,
    onramp: false,
  },
});

export default function Web3ProviderInner({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
