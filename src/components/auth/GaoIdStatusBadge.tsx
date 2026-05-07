/**
 * Gao ID — status badge.
 *
 * Read-only label that mirrors `useGaoIdStore.status`. Does NOT trigger
 * any auth call. Intended for header / profile chip placement once
 * Phase 2c integration is approved.
 */

'use client';

import { isGaoIdEnabled } from '@/lib/gao-id/config';
import { useGaoIdStore } from '@/stores/gao-id-store';

export default function GaoIdStatusBadge() {
  const status = useGaoIdStore((s) => s.status);
  const rootId = useGaoIdStore((s) => s.rootId);

  if (!isGaoIdEnabled()) return null;
  if (status === 'disabled') return null;

  let label: string;
  switch (status) {
    case 'anonymous':
      label = 'Gao ID: Not connected';
      break;
    case 'wallet_connected_not_verified':
      label = 'Gao ID: Sign in to activate';
      break;
    case 'authenticating':
      label = 'Gao ID: Signing in…';
      break;
    case 'authenticated':
      label = 'Gao ID: Active';
      break;
    case 'profile_missing':
      label = 'Gao ID: Finish profile';
      break;
    case 'profile_active':
      label = `Gao ID: ${rootId ? `${rootId.slice(0, 12)}…` : 'Active'}`;
      break;
    case 'error':
      label = 'Gao ID: Error';
      break;
  }

  return (
    <span aria-label={label} className="gao-id-status-badge" data-status={status}>
      {label}
    </span>
  );
}
