/**
 * Gao ID — Web3 provider gate.
 *
 * When NEXT_PUBLIC_GAO_ID_ENABLED is 'false' (current Phase 2c default),
 * `isGaoIdEnabled()` evaluates to a literal `false` at build time.
 * Next.js dead-code-eliminates the dynamic import path, so neither
 * wagmi nor Reown AppKit ends up in the production client bundle.
 *
 * When the flag is later flipped to 'true', the heavy provider tree is
 * loaded asynchronously — children render immediately as a fragment on
 * the first paint, and the wagmi context is added once the chunk is
 * fetched. Components that consume wagmi hooks must short-circuit on
 * `isGaoIdEnabled() === false` to avoid hook-without-context errors.
 */

'use client';

import { useEffect, useState, type ComponentType, type PropsWithChildren } from 'react';

import { isGaoIdEnabled } from '@/lib/gao-id/config';

type InnerProvider = ComponentType<PropsWithChildren>;

export default function Web3Provider({ children }: PropsWithChildren) {
  const [Inner, setInner] = useState<InnerProvider | null>(null);

  useEffect(() => {
    if (!isGaoIdEnabled()) return;
    let cancelled = false;
    void import('./Web3ProviderInner').then((mod) => {
      if (!cancelled) setInner(() => mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isGaoIdEnabled() || Inner === null) {
    return <>{children}</>;
  }
  return <Inner>{children}</Inner>;
}
