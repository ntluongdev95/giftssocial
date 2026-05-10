/**
 * Gao ID — feature gate wrapper.
 *
 * Renders `children` only when the user holds a verified Gao ID Bearer
 * (status ∈ { authenticated, profile_missing, profile_active }).
 * Otherwise renders `fallback` (default: nothing). When the global
 * Gao ID flag is off, the gate also renders `fallback` regardless of
 * any other state — keeping bootstrap-only users out of canonical UI.
 */

'use client';

import type { PropsWithChildren, ReactNode } from 'react';

import { isGaoIdEnabled } from '@/lib/gao-id/config';
import { useGaoIdStore } from '@/stores/gao-id-store';

interface GaoIdGateProps extends PropsWithChildren {
  /** Optional UI to render when Gao ID is not active. Defaults to `null`. */
  fallback?: ReactNode;
}

export default function GaoIdGate({ children, fallback = null }: GaoIdGateProps) {
  const status = useGaoIdStore((s) => s.status);

  if (!isGaoIdEnabled()) return <>{fallback}</>;

  const hasGaoId =
    status === 'authenticated' || status === 'profile_missing' || status === 'profile_active';

  return <>{hasGaoId ? children : fallback}</>;
}
