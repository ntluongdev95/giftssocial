/**
 * Gao ID — Connect button.
 *
 * Three-state UI driven by `useGaoIdStore`:
 *   1. wallet not connected         → opens the Reown AppKit modal
 *   2. wallet connected, no SIWE    → triggers the nonce → sign → verify flow
 *   3. SIWE verified                → shows the rootId tail (read-only)
 *
 * Renders `null` when NEXT_PUBLIC_GAO_ID_ENABLED !== 'true' so the
 * component is safe to mount unconditionally; the wagmi/Reown context
 * is only available below `<Web3Provider>` when the flag is on.
 *
 * Two visual variants:
 *   - "modal"   — full-width pill matching the auth modal's Google /
 *                 Apple buttons (used inside `AuthPopup`).
 *   - "compact" — smaller right-aligned button (used inside the
 *                 `/me` Gao ID account section).
 */

'use client';

import { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { Wallet } from 'lucide-react';

import { isGaoIdEnabled } from '@/lib/gao-id/config';
import { gaoIdClient, GaoIdRequestError } from '@/lib/gao-id/client';
import { buildSiweMessage } from '@/lib/gao-id/siwe';
import { useGaoIdStore } from '@/stores/gao-id-store';

export type GaoIdConnectButtonVariant = 'modal' | 'compact';

interface Props {
  variant?: GaoIdConnectButtonVariant;
}

export default function GaoIdConnectButton({ variant = 'modal' }: Props) {
  if (!isGaoIdEnabled()) return null;
  return <GaoIdConnectButtonInner variant={variant} />;
}

function GaoIdConnectButtonInner({ variant }: { variant: GaoIdConnectButtonVariant }) {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { open } = useAppKit();

  const status = useGaoIdStore((s) => s.status);
  const rootId = useGaoIdStore((s) => s.rootId);
  const setFromVerifyResponse = useGaoIdStore((s) => s.setFromVerifyResponse);
  const setCompositeMe = useGaoIdStore((s) => s.setCompositeMe);
  const setError = useGaoIdStore((s) => s.setError);

  const [busy, setBusy] = useState(false);

  const isVerified =
    status === 'authenticated' || status === 'profile_missing' || status === 'profile_active';

  // Tailwind shells for the two variants. Both are dark-glass pills with
  // a thin border, matching the existing AuthPopup aesthetic.
  const baseModal =
    'flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 cursor-pointer transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed';
  const baseCompact =
    'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 cursor-pointer transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed';
  const shell = variant === 'modal' ? baseModal : baseCompact;
  const shellStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
  } as const;
  const iconSize = variant === 'modal' ? 16 : 14;
  const labelClass =
    variant === 'modal'
      ? 'text-[12px] font-semibold text-white'
      : 'text-[11px] font-semibold text-white';

  if (isVerified) {
    return (
      <button type="button" disabled className={shell} style={shellStyle}>
        <Wallet size={iconSize} className="text-emerald-400" />
        <span className={labelClass}>
          Gao ID: {rootId ? `${rootId.slice(0, 12)}…` : 'active'}
        </span>
      </button>
    );
  }

  if (!isConnected || !address || chainId === undefined) {
    return (
      <button
        type="button"
        onClick={() => {
          void open();
        }}
        disabled={busy}
        className={shell}
        style={shellStyle}
      >
        <Wallet size={iconSize} className="text-[#00d4ff]" />
        <span className={labelClass}>Connect GaoKey / Wallet</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        setBusy(true);
        setError(null);
        try {
          const { nonce } = await gaoIdClient.nonce(address as `0x${string}`, chainId);
          const message = buildSiweMessage({
            address: address as `0x${string}`,
            chainId,
            nonce,
          });
          const signature = await signMessageAsync({ account: address, message });
          const verify = await gaoIdClient.verify(message, signature as `0x${string}`);
          setFromVerifyResponse(verify);
          const me = await gaoIdClient.getCompositeMe();
          setCompositeMe(me);
        } catch (e) {
          const msg =
            e instanceof GaoIdRequestError
              ? `${e.code ?? 'error'}: ${e.message}`
              : e instanceof Error
                ? e.message
                : 'unknown error';
          setError(msg);
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className={shell}
      style={shellStyle}
    >
      <Wallet size={iconSize} className="text-[#00d4ff]" />
      <span className={labelClass}>
        {busy ? 'Signing in…' : 'Sign in with Gao ID'}
      </span>
    </button>
  );
}
