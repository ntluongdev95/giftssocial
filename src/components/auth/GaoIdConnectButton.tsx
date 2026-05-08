/**
 * Gao ID — Connect button.
 *
 * Updated 2026-05-08 to mirror the auto-SIWE pattern used by the working
 * Gao apps:
 *   - gao-systems/gao-explorer @ src/components/HeaderAuth.tsx
 *   - gao-systems/test-gao-domains @
 *       gao-domain-web/src/components/wallet-root/header-auth.tsx
 *
 * State machine (driven by `useGaoIdStore` + wagmi):
 *   1. wallet not connected         → "Connect GaoKey / Wallet"
 *      Click sets `userInitiatedRef = true` and opens the Reown AppKit
 *      modal. Sign is NOT triggered in the click handler.
 *   2. wallet connected, not SIWE   → auto-SIWE useEffect fires
 *      `runSignIn` once per `address|chainId` after a user-initiated
 *      connect. For restored sessions (page reload where wagmi
 *      reconnected without a click in this tab) we render a manual
 *      "Sign in with Gao ID" button that sets `userInitiatedRef` and
 *      calls `runSignIn` explicitly.
 *   3. SIWE verified                → disabled badge with rootId tail.
 *
 * No manual WalletConnect deep-linking. Reown AppKit handles mobile
 * wallet handoff at connect time; firing SIWE in a useEffect immediately
 * after wagmi reports `isConnected` lets the wallet still in the
 * foreground from the connect handoff also handle the `personal_sign`
 * prompt — no second deep-link required, no second user tap required.
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';

import { isGaoIdEnabled } from '@/lib/gao-id/config';
import { gaoIdClient, GaoIdRequestError } from '@/lib/gao-id/client';
import { buildSiweMessage } from '@/lib/gao-id/siwe';
import { useGaoIdStore } from '@/stores/gao-id-store';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Wallets routinely never resolve `signMessageAsync` if the user closes
 * the wallet popup, switches apps mid-prompt, or is on a flaky
 * WalletConnect bridge. Without a hard cap the SIWE flow spins forever.
 * 90 s covers normal mobile-wallet confirm cycles and is short enough
 * to surface real failures.
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

/**
 * Build-time debug switch. When `NEXT_PUBLIC_GAO_ID_DEBUG === 'true'`
 * the SIWE flow emits a non-secret diagnostic toast at start
 * (connector + chainId + truncated address) so a mobile tester can
 * collect reproduction data without DevTools. Off by default; never
 * logs tokens, signatures or full SIWE messages.
 */
const DEBUG = process.env.NEXT_PUBLIC_GAO_ID_DEBUG === 'true';

// ── Pending SIWE intent (sessionStorage) ──────────────────────────────────
//
// social-web mounts this button inside `AuthPopup`, which returns `null`
// when closed. On mobile external Safari/Chrome the WalletConnect connect
// handoff (page → wallet app → page) can collapse the modal — the user
// returns to a fresh popup mount with `userInitiatedRef` reset, so the
// auto-SIWE useEffect skips the sign even though the connect was clearly
// user-initiated.
//
// Reference apps (gao-explorer, test-gao-domains) don't need this because
// their header-mounted HeaderAuth component never unmounts. social-web
// does, hence a tiny session-scoped intent flag.
//
// ONLY a boolean intent + timestamp + reason. Never tokens, signatures,
// or SIWE messages — those stay in memory per the Gao ID auth plan.
const PENDING_SIWE_KEY = 'gao_id_pending_siwe';
const PENDING_SIWE_TTL_MS = 2 * 60 * 1000; // 2 minutes

interface PendingSiweIntent {
  createdAt: number;
  reason: 'wallet_connect' | 'manual_sign';
}

function setPendingSiweIntent(reason: PendingSiweIntent['reason']): void {
  if (typeof window === 'undefined') return;
  try {
    const intent: PendingSiweIntent = { createdAt: Date.now(), reason };
    window.sessionStorage.setItem(PENDING_SIWE_KEY, JSON.stringify(intent));
    console.info('[gao-id] pending intent set', { reason });
  } catch {
    /* sessionStorage may throw on Safari private mode — degrade gracefully */
  }
}

function readPendingSiweIntent(): PendingSiweIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_SIWE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingSiweIntent>;
    if (
      typeof parsed?.createdAt !== 'number' ||
      (parsed.reason !== 'wallet_connect' && parsed.reason !== 'manual_sign')
    ) {
      return null;
    }
    return { createdAt: parsed.createdAt, reason: parsed.reason };
  } catch {
    return null;
  }
}

function hasFreshPendingSiweIntent(): boolean {
  const intent = readPendingSiweIntent();
  if (!intent) return false;
  const age = Date.now() - intent.createdAt;
  if (age > PENDING_SIWE_TTL_MS) {
    console.info('[gao-id] pending intent expired', { ageMs: age });
    clearPendingSiweIntent();
    return false;
  }
  return true;
}

function clearPendingSiweIntent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_SIWE_KEY);
  } catch {
    /* ignore */
  }
}

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
  const { address, chainId, isConnected, connector } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { open } = useAppKit();

  // WalletConnect bridges the signing prompt to a remote wallet app.
  // We still detect it so the persistent toast can include an "Open
  // wallet" affordance for mobile users who switched away from the
  // wallet app mid-prompt. NO manual deep-linking from this component
  // — AppKit owns the connect-time handoff.
  const isWalletConnect =
    connector?.id === 'walletConnect' || connector?.type === 'walletConnect';

  const status = useGaoIdStore((s) => s.status);
  const rootId = useGaoIdStore((s) => s.rootId);
  const setFromVerifyResponse = useGaoIdStore((s) => s.setFromVerifyResponse);
  const setCompositeMe = useGaoIdStore((s) => s.setCompositeMe);
  const setError = useGaoIdStore((s) => s.setError);

  const [busy, setBusy] = useState(false);

  const isVerified =
    status === 'authenticated' || status === 'profile_missing' || status === 'profile_active';

  // userInitiatedRef: flips true once the user actively clicks our
  // connect or sign button in this tab. Auto-SIWE only fires when this
  // is set, so wagmi reconnects from a page reload do NOT silently pop
  // a wallet signing prompt for a user who never asked to sign in.
  // Mirrors gao-explorer/src/components/HeaderAuth.tsx:103-104.
  const userInitiatedRef = useRef(false);
  // attemptedRef: lower-case `address|chainId` of the most recent SIWE
  // attempt. Prevents the auto-SIWE useEffect from re-entering after a
  // user rejection or while a sign request is already in flight.
  const attemptedRef = useRef<string | null>(null);

  const runSignIn = useCallback(async (): Promise<void> => {
    if (!address || chainId === undefined) {
      // Defensive — every caller already gates on these but a stale
      // closure could still land us here mid-disconnect.
      return;
    }
    setBusy(true);
    setError(null);

    const shortAddr = `${address.slice(0, 6)}…${address.slice(-4)}`;
    console.info('[gao-id] SIWE flow start', {
      addr: shortAddr,
      chainId,
      connectorId: connector?.id,
      connectorName: connector?.name,
      connectorType: connector?.type,
      isWalletConnect,
    });
    if (DEBUG) {
      toast.message('[gao-id debug] flow start', {
        duration: 30000,
        description:
          `connector=${connector?.id ?? '?'}/${connector?.type ?? '?'} ` +
          `chainId=${chainId} addr=${shortAddr}`,
      });
    }

    // Mobile WalletConnect handoff: log when the user actually switches
    // to the wallet app and back. Helps diagnose stuck sign flows where
    // the wallet never receives the request.
    const onVisibility = () =>
      console.info('[gao-id] document.visibilityState=' + document.visibilityState);
    document.addEventListener('visibilitychange', onVisibility);

    let progressToastId: string | number | null = null;
    try {
      const { nonce } = await gaoIdClient.nonce(address as `0x${string}`, chainId);
      console.info('[gao-id] nonce ok');

      const message = buildSiweMessage({
        address: address as `0x${string}`,
        chainId,
        nonce,
      });

      console.info('[gao-id] requesting wallet signature…');

      // Surface a persistent "approve in your wallet" toast for
      // WalletConnect users (mostly mobile external browsers). Sonner's
      // toast.loading returns an id we can dismiss later, so the user
      // always gets a clear terminal state — never just a silent
      // spinner. The "Open wallet" action lets the user re-foreground
      // the wallet via AppKit's account view if they accidentally
      // dismissed it.
      progressToastId = isWalletConnect
        ? toast.loading('Approve the sign-in in your wallet app', {
            description:
              'Switch to your wallet app to approve. Tap "Open wallet" if it didn\'t open automatically.',
            duration: SIGN_TIMEOUT_MS,
            action: {
              label: 'Open wallet',
              onClick: () => {
                void open({ view: 'Account' });
              },
            },
          })
        : null;

      let signature: `0x${string}`;
      try {
        // Race the wallet against a hard timeout. WalletConnect bridges
        // can leave signMessageAsync pending forever if the user closes
        // the wallet prompt; without a cap the spinner never resolves.
        signature = (await Promise.race([
          signMessageAsync({ account: address as `0x${string}`, message }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    `Wallet did not respond within ${Math.round(SIGN_TIMEOUT_MS / 1000)}s`,
                  ),
                ),
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
          userMsg = isWalletConnect
            ? "Wallet didn't respond. Open your wallet app, find the pending Gao Social request, and approve — or click Sign in again."
            : 'Wallet did not respond. Reconnect and retry.';
        } else {
          userMsg = `Signature failed: ${errMsg}`;
        }
        console.warn('[gao-id] signature aborted:', errMsg);
        // User rejection / wallet timeout: clear the intent. The user
        // must click again to retry, which sets a fresh intent. Without
        // this, the useEffect could re-attempt as soon as the next
        // render landed (e.g. wagmi reports a chain change).
        clearPendingSiweIntent();
        setError(userMsg);
        toast.error(userMsg, {
          action: isWalletConnect
            ? {
                label: 'Open wallet',
                onClick: () => {
                  void open({ view: 'Account' });
                },
              }
            : undefined,
        });
        return;
      } finally {
        if (progressToastId !== null) {
          toast.dismiss(progressToastId);
          progressToastId = null;
        }
      }

      console.info('[gao-id] verify…');
      const verify = await gaoIdClient.verify(message, signature);
      console.info('[gao-id] verify ok rootId=' + verify.user.rootId.slice(0, 16) + '…');
      setFromVerifyResponse(verify);

      console.info('[gao-id] hydrating /v2/me');
      const me = await gaoIdClient.getCompositeMe();
      setCompositeMe(me);

      // Bridge the Gao ID bearer into a social-web bootstrap session
      // so the rest of the app (which still gates on `useAuthStore` +
      // gao_token cookies) treats the user as signed in. The bootstrap
      // user record is local — canonical identity stays at
      // gao-id-worker.
      console.info('[gao-id] bridging to bootstrap session');
      const bridgeRes = await fetch('/api/v1/auth/gao-id', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { authorization: `Bearer ${verify.accessToken}` },
      });
      if (!bridgeRes.ok) {
        const body = (await bridgeRes.json().catch(() => ({}))) as {
          error?: { code?: string; message?: string };
        };
        const code = body?.error?.code ?? `http_${bridgeRes.status}`;
        const errorMessage = body?.error?.message ?? 'Bootstrap session bridge failed';
        throw new GaoIdRequestError(bridgeRes.status, code, null, errorMessage);
      }
      const bridge = (await bridgeRes.json()) as BridgeResponse;

      // Hydrate `useAuthStore` exactly the way the Google flow does:
      // stash tokens in memory, then refetch `/api/v1/auth/session` so
      // the canonical user shape (which the rest of the app reads)
      // lands in the store.
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
      // Success: intent has done its job. Clear before close so a future
      // sign-out/sign-in cycle starts clean.
      clearPendingSiweIntent();
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
      // Final failure (verify / /v2/me / bridge): clear intent so the
      // useEffect doesn't loop the wallet sign request on next render.
      clearPendingSiweIntent();
      setError(msg);
      toast.error(`Gao ID sign-in failed: ${msg}`);
    } finally {
      if (progressToastId !== null) toast.dismiss(progressToastId);
      document.removeEventListener('visibilitychange', onVisibility);
      setBusy(false);
    }
  }, [
    address,
    chainId,
    connector?.id,
    connector?.name,
    connector?.type,
    isWalletConnect,
    onAuthSuccess,
    open,
    setCompositeMe,
    setError,
    setFromVerifyResponse,
    signMessageAsync,
  ]);

  // Auto-SIWE after a user-initiated connect. Mirrors:
  //   gao-explorer/src/components/HeaderAuth.tsx:172-198
  //   test-gao-domains/.../wallet-root/header-auth.tsx:244-261
  //
  // The effect runs when wagmi reports the wallet is connected with an
  // address and a resolved chainId. Triggers if EITHER:
  //   (a) `userInitiatedRef` is true — same-mount click → connect
  //       → return to a still-mounted button (PC, in-wallet browser,
  //       desktop).
  //   (b) `hasFreshPendingSiweIntent()` is true — sessionStorage
  //       intent set on click before AppKit opened. Survives the
  //       AuthPopup remount that mobile external Safari/Chrome
  //       triggers when the page returns from the wallet app.
  //
  // The intent is only set on a real Connect / Sign click, so passive
  // wagmi reconnects after the TTL window do NOT auto-pop a wallet
  // signing prompt for a user who didn't ask for it.
  useEffect(() => {
    if (!isConnected || !address || chainId === undefined) return;
    if (isVerified) return;
    if (busy) return;
    const key = `${address.toLowerCase()}|${chainId}`;
    if (attemptedRef.current === key) return;

    const refOk = userInitiatedRef.current;
    const intentOk = hasFreshPendingSiweIntent();
    if (!refOk && !intentOk) return;

    // Restore the in-memory ref from the surviving intent so subsequent
    // renders within this mount don't have to re-read sessionStorage.
    if (intentOk && !refOk) userInitiatedRef.current = true;

    attemptedRef.current = key;
    console.info('[gao-id] auto SIWE trigger', {
      reason: refOk ? 'ref' : 'sessionStorage',
      addr: `${address.slice(0, 6)}…${address.slice(-4)}`,
      chainId,
    });
    void runSignIn();
  }, [isConnected, address, chainId, isVerified, busy, runSignIn]);

  // Reset gates on disconnect so the next connect starts clean. Also
  // clear any stale pending intent — if the user disconnected mid-flow
  // they're no longer asking to sign in.
  useEffect(() => {
    if (!isConnected) {
      userInitiatedRef.current = false;
      attemptedRef.current = null;
      clearPendingSiweIntent();
    }
  }, [isConnected]);

  // Tailwind shells (unchanged from prior versions).
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
    // Disconnected → mark this tap as user-initiated and open AppKit.
    // The auto-SIWE useEffect fires once wagmi reports `isConnected`.
    //
    // Set the sessionStorage intent BEFORE opening AppKit. On mobile
    // external Safari/Chrome the page may collapse this `AuthPopup`
    // mount during the wallet handoff; the surviving intent is what
    // resurrects the auto-SIWE on the next mount.
    return (
      <button
        type="button"
        onClick={() => {
          userInitiatedRef.current = true;
          setPendingSiweIntent('wallet_connect');
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

  // Connected but not yet verified. Two cases:
  //   - busy: auto-SIWE (or a manual click) is in flight — show spinner.
  //   - !busy: manual fallback (restored session, or auto-SIWE rejected
  //     and the user wants to retry). Tapping this button sets the
  //     sessionStorage intent + ref + attempt key and runs SIWE
  //     explicitly. No disconnect/reconnect required.
  return (
    <button
      type="button"
      onClick={() => {
        if (busy) return;
        userInitiatedRef.current = true;
        setPendingSiweIntent('manual_sign');
        attemptedRef.current = `${address.toLowerCase()}|${chainId}`;
        void runSignIn();
      }}
      disabled={busy}
      className={shell}
      style={shellStyle}
    >
      {busy ? (
        <Loader2 size={iconSize} className="animate-spin text-[#00d4ff]" />
      ) : (
        <Wallet size={iconSize} className="text-[#00d4ff]" />
      )}
      <span className={labelClass}>{busy ? 'Signing in…' : 'Sign in with Gao ID'}</span>
    </button>
  );
}
