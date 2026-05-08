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
import { toast } from 'sonner';

import { isGaoIdEnabled } from '@/lib/gao-id/config';
import { gaoIdClient, GaoIdRequestError } from '@/lib/gao-id/client';
import { buildSiweMessage } from '@/lib/gao-id/siwe';
import { useGaoIdStore } from '@/stores/gao-id-store';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Wallets routinely never resolve `signMessageAsync` if the user closes
 * the wallet popup, switches apps mid-prompt, or is on a flaky
 * WalletConnect bridge. Without a hard cap the SIWE button spins
 * forever. 90 s covers normal WalletConnect QR scan + mobile-wallet
 * confirm cycles and is short enough to surface real failures.
 */
const SIGN_TIMEOUT_MS = 90_000;

/**
 * Heuristic for "user rejected the signature" across viem / wagmi
 * connector errors. Different connectors raise different shapes
 * (`UserRejectedRequestError`, "User rejected", "User denied",
 * "rejected_by_user", etc.) so we match permissively on the message.
 */
const REJECTED_RE = /user.?reject|user.?denied|user.?cancel|reject(ed)?_by_user|denied/i;
const TIMEOUT_RE = /timed?\s*out|did not respond|aborted/i;

export type GaoIdConnectButtonVariant = 'modal' | 'compact';

interface Props {
  variant?: GaoIdConnectButtonVariant;
  /**
   * Optional callback invoked AFTER the bootstrap session has been
   * minted by `/api/v1/auth/gao-id` and `useAuthStore` is hydrated.
   * Used by `AuthPopup` to close the modal; safe to leave undefined
   * elsewhere (e.g. inside `/me` where the user is already in-app).
   */
  onAuthSuccess?: () => void;
}

export default function GaoIdConnectButton({ variant = 'modal', onAuthSuccess }: Props) {
  if (!isGaoIdEnabled()) return null;
  return <GaoIdConnectButtonInner variant={variant} onAuthSuccess={onAuthSuccess} />;
}

interface BridgeResponse {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  is_new_user: boolean;
  gao_root_id: string;
}

function GaoIdConnectButtonInner({
  variant,
  onAuthSuccess,
}: {
  variant: GaoIdConnectButtonVariant;
  onAuthSuccess?: () => void;
}) {
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
        const shortAddr = `${address.slice(0, 6)}…${address.slice(-4)}`;
        console.info('[gao-id] SIWE flow start', { addr: shortAddr, chainId });
        try {
          const { nonce } = await gaoIdClient.nonce(address as `0x${string}`, chainId);
          console.info('[gao-id] nonce ok');

          const message = buildSiweMessage({
            address: address as `0x${string}`,
            chainId,
            nonce,
          });

          console.info('[gao-id] requesting wallet signature…');
          let signature: `0x${string}`;
          try {
            // Race the wallet against a hard timeout. Many wallets (esp.
            // WalletConnect bridges) never resolve when the user closes
            // the prompt, which previously left the spinner spinning.
            signature = (await Promise.race([
              signMessageAsync({ account: address, message }),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error(`Wallet did not respond within ${Math.round(SIGN_TIMEOUT_MS / 1000)}s`)),
                  SIGN_TIMEOUT_MS,
                ),
              ),
            ])) as `0x${string}`;
            console.info('[gao-id] signature received');
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            let userMsg: string;
            if (REJECTED_RE.test(errMsg)) {
              userMsg = 'Signature rejected. Click the button to try again.';
            } else if (TIMEOUT_RE.test(errMsg)) {
              userMsg =
                'Wallet did not respond. If you used WalletConnect, open your mobile wallet and tap confirm. Otherwise reconnect and retry.';
            } else {
              userMsg = `Signature failed: ${errMsg}`;
            }
            console.warn('[gao-id] signature aborted:', errMsg);
            setError(userMsg);
            toast.error(userMsg);
            return;
          }

          console.info('[gao-id] verify…');
          const verify = await gaoIdClient.verify(message, signature);
          console.info('[gao-id] verify ok rootId=' + verify.user.rootId.slice(0, 16) + '…');
          setFromVerifyResponse(verify);

          console.info('[gao-id] hydrating /v2/me');
          const me = await gaoIdClient.getCompositeMe();
          setCompositeMe(me);

          // Bridge the Gao ID bearer into a social-web bootstrap
          // session so the rest of the app (which still gates on
          // `useAuthStore` + `gao_token` cookies) treats the user as
          // signed in. The bootstrap user record is local — canonical
          // identity stays at gao-id-worker.
          console.info('[gao-id] bridging to bootstrap session');
          const bridgeRes = await fetch('/api/v1/auth/gao-id', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { authorization: `Bearer ${verify.accessToken}` },
          });
          if (!bridgeRes.ok) {
            const body = (await bridgeRes.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
            const code = body?.error?.code ?? `http_${bridgeRes.status}`;
            const message = body?.error?.message ?? 'Bootstrap session bridge failed';
            throw new GaoIdRequestError(bridgeRes.status, code, null, message);
          }
          const bridge = (await bridgeRes.json()) as BridgeResponse;

          // Hydrate `useAuthStore` exactly the way the Google flow
          // does: stash tokens in memory, then refetch
          // `/api/v1/auth/session` so the canonical user shape (which
          // the rest of the app reads) lands in the store.
          const auth = useAuthStore.getState();
          auth.setTokens(bridge.access_token, bridge.refresh_token);
          try {
            const sessRes = await fetch('/api/v1/auth/session', { credentials: 'same-origin' });
            if (sessRes.ok) {
              const sessBody = await sessRes.json();
              if (sessBody?.data?.id) auth.hydrateFromMe(sessBody);
            }
          } catch {
            /* hydration is best-effort; the bootstrap cookie is set */
          }

          console.info('[gao-id] flow complete', { newUser: bridge.is_new_user });
          toast.success('Signed in with Gao ID');
          onAuthSuccess?.();
        } catch (e) {
          const msg =
            e instanceof GaoIdRequestError
              ? `${e.code ?? 'error'}: ${e.message}`
              : e instanceof Error
                ? e.message
                : 'unknown error';
          console.error('[gao-id] flow failed:', msg);
          setError(msg);
          toast.error(`Gao ID sign-in failed: ${msg}`);
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
