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
  ssr: false,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: 'Gao Social',
    description: 'Sign in with Gao ID',
    url: appUrl,
    icons: [`${appUrl}/icons/pwa-192.png`],
  },
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
