/**
 * Gao ID — Connect button.
 *
 * Three-state UI driven by `useGaoIdStore`:
 *   1. wallet not connected   → opens the Reown AppKit modal
 *   2. wallet connected, no SIWE yet → triggers the nonce → sign → verify flow
 *   3. SIWE verified          → shows the rootId tail (read-only)
 *
 * Renders `null` when NEXT_PUBLIC_GAO_ID_ENABLED !== 'true' so the
 * component is safe to mount unconditionally; the wagmi/Reown context
 * is only available below `<Web3Provider>` when the flag is on.
 */

'use client';

import { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';

import { isGaoIdEnabled } from '@/lib/gao-id/config';
import { gaoIdClient, GaoIdRequestError } from '@/lib/gao-id/client';
import { buildSiweMessage } from '@/lib/gao-id/siwe';
import { useGaoIdStore } from '@/stores/gao-id-store';

export default function GaoIdConnectButton() {
  if (!isGaoIdEnabled()) return null;
  return <GaoIdConnectButtonInner />;
}

function GaoIdConnectButtonInner() {
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

  if (isVerified) {
    return (
      <button type="button" disabled className="gao-id-connect-button gao-id-active">
        Gao ID: {rootId ? `${rootId.slice(0, 12)}…` : 'active'}
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
        className="gao-id-connect-button gao-id-connect"
      >
        Connect GaoKey / Wallet
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
      className="gao-id-connect-button gao-id-sign"
    >
      {busy ? 'Signing in…' : 'Sign in with Gao ID'}
    </button>
  );
}
