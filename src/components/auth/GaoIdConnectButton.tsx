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
 * Mobile external wallet (WalletConnect) handoff:
 *   - On `Connect`, AppKit foregrounds the wallet via WC's connect
 *     deep-link.
 *   - Returning to the web tab can leave wagmi `isConnected: true` while
 *     the wallet app is in the background. A subsequent `personal_sign`
 *     dispatch reaches the relay but the wallet shows nothing on screen
 *     because the OS hasn't been told to bring it forward — so the user
 *     experiences an inert "Sign in" button. We dispatch the sign first,
 *     wait ~250ms for the relay to deliver, then deep-link the wallet
 *     using `provider.session.peer.metadata.redirect.{native,universal}`.
 *     If no redirect metadata is present we surface a visible fallback
 *     panel (Open wallet to sign / Retry / Cancel) so the user is never
 *     stuck on a silent spinner.
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
import { loadWeb3Inner } from '@/providers/Web3Provider';
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
 * Delay between dispatching `personal_sign` and attempting to deep-link
 * the wallet to the foreground. The relay needs a moment to deliver the
 * request — if we redirect first the wallet may foreground without a
 * pending request to display.
 */
const FOREGROUND_DELAY_MS = 250;

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

// ── WalletConnect deep-link helpers ───────────────────────────────────────
//
// WalletConnect `personal_sign` is delivered via the relay; the wallet
// app only surfaces a UI prompt to the user if the OS brings it to the
// foreground. On mobile external Safari/Chrome the wallet is in the
// background after the connect handoff returns, so the user doesn't see
// the request and the spinner stays up. The active session's
// `peer.metadata.redirect` carries the wallet's deep-link target — we
// use it to foreground the wallet right after dispatching the sign.

interface WalletConnectRedirect {
  native?: string;
  universal?: string;
}

interface ProviderWithSession {
  session?: {
    peer?: { metadata?: { redirect?: WalletConnectRedirect } };
  };
  signer?: {
    client?: {
      session?: {
        values?: Array<{ peer?: { metadata?: { redirect?: WalletConnectRedirect } } }>;
      };
    };
  };
}

interface ConnectorLike {
  getProvider?: () => Promise<unknown> | unknown;
}

async function getWalletConnectRedirect(
  connector: ConnectorLike | null | undefined,
): Promise<WalletConnectRedirect | null> {
  try {
    const provider = (await connector?.getProvider?.()) as ProviderWithSession | undefined;
    if (!provider) return null;
    const direct = provider.session?.peer?.metadata?.redirect;
    if (direct?.native || direct?.universal) return direct;
    const nested = provider.signer?.client?.session?.values?.[0]?.peer?.metadata?.redirect;
    if (nested?.native || nested?.universal) return nested;
    return null;
  } catch {
    return null;
  }
}

function isMobileUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

interface ForegroundResult {
  visibility: string;
  hasRedirect: boolean;
  redirect: WalletConnectRedirect | null;
}

async function foregroundWallet(
  connector: ConnectorLike | null | undefined,
): Promise<ForegroundResult> {
  const redirect = await getWalletConnectRedirect(connector);
  const visibility = typeof document !== 'undefined' ? document.visibilityState : 'unknown';
  const hasRedirect = !!(redirect?.native || redirect?.universal);
  console.info('[gao-id] wallet foreground fallback', { visibility, hasRedirect, redirect });
  if (typeof window === 'undefined' || !hasRedirect) {
    return { visibility, hasRedirect, redirect };
  }
  // Native scheme first — when a wallet is installed, iOS/Android route
  // the request to it without leaving the page. Universal links are the
  // safer fallback for browsers that block custom schemes silently.
  const target = redirect?.native || redirect?.universal;
  try {
    if (target) window.location.href = target;
  } catch {
    /* ignore — visible fallback panel still surfaces an Open wallet CTA */
  }
  return { visibility, hasRedirect, redirect };
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
  // Gate inner mount on the same dynamic-import promise that Web3Provider
  // awaits. Otherwise the inner's `useAccount` / `useSignMessage` fire
  // before `WagmiProvider` is in the tree and React throws
  // "useConfig must be used within WagmiProvider".
  const [web3Ready, setWeb3Ready] = useState(false);
  useEffect(() => {
    if (!isGaoIdEnabled()) return;
    let cancelled = false;
    void loadWeb3Inner().then(() => {
      if (!cancelled) setWeb3Ready(true);
    });
    return () => { cancelled = true; };
  }, []);

  if (!isGaoIdEnabled() || !web3Ready) return null;
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

type SignAbortKind = 'cancel' | 'retry';
type SiweStage = 'nonce' | 'siwe_build' | 'sign' | 'verify' | 'me' | 'bridge' | 'hydrate';

function GaoIdConnectButtonInner({
  variant,
  onAuthSuccess,
}: {
  variant: GaoIdConnectButtonVariant;
  onAuthSuccess?: () => void;
}) {
  const { address, chainId, isConnected, connector } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { open, close: closeAppKit } = useAppKit();

  // WalletConnect bridges the signing prompt to a remote wallet app.
  // We detect it so the persistent toast and the visible fallback panel
  // can include "Open wallet" affordances. AppKit owns the connect-time
  // handoff; we own the sign-time handoff via session redirect metadata.
  const isWalletConnect =
    connector?.id === 'walletConnect' || connector?.type === 'walletConnect';

  const status = useGaoIdStore((s) => s.status);
  const rootId = useGaoIdStore((s) => s.rootId);
  const setFromVerifyResponse = useGaoIdStore((s) => s.setFromVerifyResponse);
  const setCompositeMe = useGaoIdStore((s) => s.setCompositeMe);
  const setError = useGaoIdStore((s) => s.setError);

  const [busy, setBusy] = useState(false);
  // Mobile external WC: rendered while `signMessageAsync` is pending so
  // the user always has Open wallet / Retry / Cancel CTAs even when the
  // wallet did not auto-foreground (no redirect metadata, OS suppressed
  // the deep-link, etc.). `null` = no pending mobile-WC sign.
  const [signPending, setSignPending] = useState<{ hasRedirect: boolean } | null>(null);

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
  // user rejection or while a sign request is already in flight. The
  // explicit Sign in click resets this so a tap is never blocked by a
  // stale attempt key.
  const attemptedRef = useRef<string | null>(null);
  // Always-current connector ref so `runSignIn` can read provider
  // metadata without forcing the `useCallback` to depend on the
  // connector object (which changes identity on every render).
  const connectorRef = useRef(connector);
  connectorRef.current = connector;
  // Set while a sign is racing against timeout/cancel. Calling it
  // rejects the race with `user_cancel` or `user_retry` so the flow
  // unwinds cleanly without waiting for the wallet.
  const cancelSignRef = useRef<((kind: SignAbortKind) => void) | null>(null);

  const runSignIn = useCallback(async (): Promise<void> => {
    if (!address || chainId === undefined) {
      // Defensive — every caller already gates on these but a stale
      // closure could still land us here mid-disconnect.
      return;
    }
    setBusy(true);
    setError(null);
    setSignPending(null);

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
    if (isWalletConnect && isMobileUserAgent()) {
      console.info('[gao-id] mobile external SIWE path', {
        connectorId: connector?.id,
        address: shortAddr,
        chainId,
      });
    }

    // Mobile WalletConnect handoff: log when the user actually switches
    // to the wallet app and back. Helps diagnose stuck sign flows where
    // the wallet never receives the request.
    const onVisibility = () =>
      console.info('[gao-id] document.visibilityState=' + document.visibilityState);
    document.addEventListener('visibilitychange', onVisibility);

    let progressToastId: string | number | null = null;
    let stage: SiweStage = 'nonce';
    try {
      console.info('[gao-id] nonce request start');
      const { nonce } = await gaoIdClient.nonce(address as `0x${string}`, chainId);
      console.info('[gao-id] nonce ok');

      stage = 'siwe_build';
      const message = buildSiweMessage({
        address: address as `0x${string}`,
        chainId,
        nonce,
      });
      console.info('[gao-id] SIWE message built');

      stage = 'sign';
      // Surface a persistent "approve in your wallet" toast for
      // WalletConnect users. The "Open wallet" action deep-links the
      // wallet via session redirect metadata (not just AppKit's account
      // view), so the user always has a real path to the wallet app.
      progressToastId = isWalletConnect
        ? toast.loading('Approve the sign-in in your wallet app', {
            description:
              'Switch to your wallet app to approve. Tap "Open wallet" if it didn\'t open automatically.',
            duration: SIGN_TIMEOUT_MS,
            action: {
              label: 'Open wallet',
              onClick: () => {
                void foregroundWallet(connectorRef.current);
              },
            },
          })
        : null;

      console.info('[gao-id] personal_sign dispatch');
      const signPromise = signMessageAsync({ account: address as `0x${string}`, message });
      console.info('[gao-id] personal_sign pending');

      // Mobile external WalletConnect: deep-link the wallet AFTER the
      // sign promise is dispatched so the relay has a chance to deliver
      // the request first. If the user already left for the wallet
      // (visibility !== 'visible') we skip — they're already there.
      if (isWalletConnect && isMobileUserAgent()) {
        await new Promise<void>((r) => setTimeout(r, FOREGROUND_DELAY_MS));
        let fg: ForegroundResult | null = null;
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          fg = await foregroundWallet(connectorRef.current);
        }
        // Even if we *did* deep-link, the OS may not actually foreground
        // the wallet (no app installed, custom-scheme blocked). Render
        // the visible fallback panel so the user has explicit Open
        // wallet / Retry / Cancel CTAs.
        setSignPending({ hasRedirect: !!fg?.hasRedirect });
      }

      // Race the wallet against (a) hard timeout — WC bridges can leave
      // signMessageAsync pending forever if the wallet prompt is closed;
      // (b) user-driven cancel/retry from the fallback panel.
      let cancelReject: ((e: Error) => void) | null = null;
      const cancelPromise = new Promise<never>((_, reject) => {
        cancelReject = reject;
      });
      cancelSignRef.current = (kind) => cancelReject?.(new Error(`user_${kind}`));

      let signature: `0x${string}`;
      try {
        signature = (await Promise.race([
          signPromise,
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
          cancelPromise,
        ])) as `0x${string}`;
        console.info('[gao-id] signature received');
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        // user_cancel / user_retry are explicit aborts from the fallback
        // panel. Treat both silently — for retry, the click handler
        // schedules a fresh `runSignIn` after this one unwinds.
        if (errMsg === 'user_cancel' || errMsg === 'user_retry') {
          console.info('[gao-id] sign aborted', { reason: errMsg });
          clearPendingSiweIntent();
          if (errMsg === 'user_cancel') {
            toast.message('Sign-in cancelled');
          }
          return;
        }
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
        console.warn('[gao-id] SIWE error', { stage, message: errMsg });
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
                  void foregroundWallet(connectorRef.current);
                },
              }
            : undefined,
        });
        return;
      } finally {
        cancelSignRef.current = null;
        if (progressToastId !== null) {
          toast.dismiss(progressToastId);
          progressToastId = null;
        }
        setSignPending(null);
      }

      stage = 'verify';
      console.info('[gao-id] verify start');
      const verify = await gaoIdClient.verify(message, signature);
      console.info('[gao-id] verify ok');
      setFromVerifyResponse(verify);

      stage = 'me';
      console.info('[gao-id] hydrating /v2/me');
      const me = await gaoIdClient.getCompositeMe();
      setCompositeMe(me);

      // Bridge the Gao ID bearer into a social-web bootstrap session
      // so the rest of the app (which still gates on `useAuthStore` +
      // gao_token cookies) treats the user as signed in. The bootstrap
      // user record is local — canonical identity stays at
      // gao-id-worker.
      stage = 'bridge';
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
      stage = 'hydrate';
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
      // Some users see the AppKit "Open <wallet>" modal lingering after a
      // successful sign-in if the wallet didn't auto-close it. Force-close
      // here so the page is clean by the time we redirect/close popup.
      try { await closeAppKit(); } catch { /* modal may already be closed */ }
      toast.success('Signed in with Gao ID');
      onAuthSuccess?.();
    } catch (e) {
      const msg =
        e instanceof GaoIdRequestError
          ? `${e.code ?? 'error'}: ${e.message}`
          : e instanceof Error
            ? e.message
            : 'unknown error';
      console.error('[gao-id] SIWE error', { stage, message: msg });
      // Final failure (verify / /v2/me / bridge): clear intent so the
      // useEffect doesn't loop the wallet sign request on next render.
      clearPendingSiweIntent();
      setError(msg);
      toast.error(`Gao ID sign-in failed: ${msg}`);
    } finally {
      if (progressToastId !== null) toast.dismiss(progressToastId);
      document.removeEventListener('visibilitychange', onVisibility);
      setBusy(false);
      setSignPending(null);
      cancelSignRef.current = null;
    }
  }, [
    address,
    chainId,
    closeAppKit,
    connector?.id,
    connector?.name,
    connector?.type,
    isWalletConnect,
    onAuthSuccess,
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
      cancelSignRef.current = null;
      setSignPending(null);
      clearPendingSiweIntent();
    }
  }, [isConnected]);

  // Manual "Sign in with Gao ID" tap. Treated as a fresh user action:
  // any expired sessionStorage intent, stale `userInitiatedRef`, stale
  // `attemptedRef` key, or in-flight sign lock is refreshed/cleared so
  // the user is never blocked by leftover state from a prior attempt.
  const handleSignInClick = useCallback(() => {
    console.info('[gao-id] sign in click');
    if (!address || chainId === undefined) {
      console.info('[gao-id] sign in blocked', {
        reason: 'no_account',
        hasAddress: !!address,
        hasChainId: chainId !== undefined,
      });
      return;
    }
    const shortAddr = `${address.slice(0, 6)}…${address.slice(-4)}`;
    if (busy) {
      // A previous sign attempt is still racing. Cancel it (so the race
      // unwinds) and queue a fresh attempt — this is what the user
      // intends when they re-tap Sign in.
      if (cancelSignRef.current) {
        console.info('[gao-id] sign in click accepted', {
          mode: 'cancel_in_flight_and_retry',
          addr: shortAddr,
          chainId,
          connectorId: connector?.id,
        });
        cancelSignRef.current('retry');
        // Yield a tick so the previous run's `finally` clears
        // `busy`/`signPending`/`cancelSignRef`, then start fresh.
        setTimeout(() => {
          userInitiatedRef.current = true;
          setPendingSiweIntent('manual_sign');
          attemptedRef.current = null;
          void runSignIn();
        }, 80);
        return;
      }
      console.info('[gao-id] sign in blocked', { reason: 'busy_no_cancel' });
      return;
    }
    console.info('[gao-id] sign in click accepted', {
      addr: shortAddr,
      chainId,
      connectorId: connector?.id,
    });
    // Refresh every gate so a stale TTL/ref/key cannot suppress the
    // explicit click. The auto-SIWE useEffect will see `attemptedRef`
    // is null on the next render, but `runSignIn` is invoked
    // synchronously here so it always wins the race.
    userInitiatedRef.current = true;
    setPendingSiweIntent('manual_sign');
    attemptedRef.current = null;
    void runSignIn();
  }, [address, busy, chainId, connector?.id, runSignIn]);

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

  // While the SIWE flow is mid-flight, always render a spinner — even
  // after `setFromVerifyResponse` has already flipped status to
  // 'authenticated' and `isVerified` is true. There's still a 200-500ms
  // window for the bridge call + /me hydration before `onAuthSuccess`
  // closes the popup; without this guard the user briefly sees the
  // static "Gao ID: gaoid_…" label, which looks like nothing is
  // happening. Mobile-WC waiting state has its own dedicated panel
  // below and is excluded here.
  if (busy && !signPending) {
    return (
      <button type="button" disabled className={shell} style={shellStyle} aria-live="polite">
        <Loader2 size={iconSize} className="animate-spin text-[#00d4ff]" />
        <span className={labelClass}>
          {isVerified ? 'Welcoming you in…' : 'Signing in…'}
        </span>
      </button>
    );
  }

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

  // Connected + WalletConnect mid-sign on mobile: render the visible
  // fallback panel so the user always has Open wallet / Retry / Cancel
  // CTAs even when the wallet didn't auto-foreground.
  if (busy && signPending) {
    return (
      <div className="flex w-full flex-col gap-2">
        <div
          className={shell}
          style={{ ...shellStyle, cursor: 'default' }}
          aria-live="polite"
        >
          <Loader2 size={iconSize} className="animate-spin text-[#00d4ff]" />
          <span className={labelClass}>Waiting for wallet signature…</span>
        </div>
        {!signPending.hasRedirect && (
          <p className="px-1 text-[10px] text-[#8892a8]">
            Your wallet didn&apos;t open automatically. Open it manually and approve the request,
            or tap Retry to send a fresh sign request.
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            void foregroundWallet(connectorRef.current);
          }}
          className={baseModal}
          style={shellStyle}
        >
          <Wallet size={iconSize} className="text-[#00d4ff]" />
          <span className={labelClass}>Open wallet to sign</span>
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleSignInClick}
            className="flex items-center justify-center gap-2 rounded-2xl py-2.5 cursor-pointer transition-all active:scale-[0.97]"
            style={shellStyle}
          >
            <span className="text-[11px] font-semibold text-white">Retry</span>
          </button>
          <button
            type="button"
            onClick={() => {
              cancelSignRef.current?.('cancel');
            }}
            className="flex items-center justify-center gap-2 rounded-2xl py-2.5 cursor-pointer transition-all active:scale-[0.97]"
            style={shellStyle}
          >
            <span className="text-[11px] font-semibold text-white">Cancel</span>
          </button>
        </div>
      </div>
    );
  }

  // Connected but not yet verified. Two cases:
  //   - busy (non-mobile-WC): auto-SIWE or click in flight — spinner.
  //   - !busy: manual fallback (restored session, or auto-SIWE rejected
  //     and the user wants to retry). `handleSignInClick` refreshes
  //     intent + ref + attempted key and runs SIWE explicitly. No
  //     disconnect/reconnect required.
  return (
    <button
      type="button"
      onClick={handleSignInClick}
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
