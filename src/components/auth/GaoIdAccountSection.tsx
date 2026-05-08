/**
 * Gao ID — account-area section for `/me`.
 *
 * Shows current Gao ID state next to the user's bootstrap (Google /
 * Apple) account chip and offers an entry point to connect a wallet
 * later. Mirrors the auth state machine exposed by `useGaoIdStore`.
 *
 * Renders `null` when NEXT_PUBLIC_GAO_ID_ENABLED !== 'true' so the
 * `/me` page is byte-identical for users on the bootstrap-only build.
 */

'use client';

import Link from 'next/link';
import { Wallet } from 'lucide-react';

import { isGaoIdEnabled } from '@/lib/gao-id/config';
import { useGaoIdStore } from '@/stores/gao-id-store';
import GaoIdConnectButton from './GaoIdConnectButton';

function shortenAddress(addr: string | null): string {
  if (!addr || addr.length < 10) return addr ?? '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function GaoIdAccountSection() {
  const status = useGaoIdStore((s) => s.status);
  const rootId = useGaoIdStore((s) => s.rootId);
  const walletAddress = useGaoIdStore((s) => s.walletAddress);

  if (!isGaoIdEnabled()) return null;
  if (status === 'disabled') return null;

  const isActive =
    status === 'authenticated' || status === 'profile_missing' || status === 'profile_active';

  return (
    <section className="px-4 mb-3" data-testid="gao-id-account-section">
      <h2 className="text-[10px] uppercase tracking-[0.15em] text-[#4a5068] font-semibold mb-2 px-1">
        Gao ID
      </h2>
      <div
        className="rounded-2xl p-4"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: isActive ? 'rgba(16,185,129,0.12)' : 'rgba(0,212,255,0.12)',
              border: `1px solid ${isActive ? 'rgba(16,185,129,0.25)' : 'rgba(0,212,255,0.25)'}`,
            }}
          >
            <Wallet
              size={16}
              className={isActive ? 'text-emerald-400' : 'text-[#00d4ff]'}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white">
              {isActive ? 'Gao ID active' : 'Gao ID: Not connected'}
            </p>
            {isActive ? (
              <p className="text-[11px] text-[#4a5068] mt-0.5 truncate">
                {rootId ? `${rootId.slice(0, 16)}…` : ''}
                {walletAddress ? ` · ${shortenAddress(walletAddress)}` : ''}
              </p>
            ) : (
              <p className="text-[11px] text-[#4a5068] mt-0.5">
                Connect a wallet to activate canonical profile, .gao domains, and payments.
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {isActive ? (
            <Link
              href="/me/profile"
              className="text-[12px] font-semibold text-[#00d4ff] hover:text-[#33dfff] transition-colors text-center py-2"
            >
              Manage Gao Profile →
            </Link>
          ) : (
            <GaoIdConnectButton variant="modal" />
          )}
        </div>
      </div>
    </section>
  );
}
