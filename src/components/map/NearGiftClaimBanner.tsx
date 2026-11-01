'use client';

// Claim UI for a Kiss that carries a real NEAR money gift (near_gift_status
// set — see migration-039 + /api/v1/kisses/[id]/claim). Deliberately
// separate from the open/reveal flow: anyone can still open/view a kiss
// as before (KissReplayOverlay, unchanged); this banner only ever offers
// the CLAIM action, and only to the actual intended receiver.
//
// Wallet: same wallet-selector setup already used for the sender's
// "Attach NEAR" flow (src/lib/near/wallet.ts) — Meteor + Here; see that
// file for why Bitte Wallet isn't one of them (its testnet deployment
// is dead). (NEAR Auth/passkey was investigated and ruled out for now —
// it needs a self-hosted relayer this project doesn't have; MyNearWallet
// was ruled out because NEAR sunset it on 2026-10-31.)
//
// Claim secret: the real access control for claiming (see
// contracts/kiss-chain claim_secret_hash + migration-040) — a guest
// kiss has no account to gate a server lookup with, so its secret can
// only come from `claimSecretFromUrl` (the share link/QR); a
// registered-receiver kiss instead fetches it from the auth-gated
// GET /api/v1/kisses/[id]/claim-secret, so the link itself doesn't
// need to carry it for that case.

import { useState } from 'react';
import { Wallet, Gem, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { getSelector, getModal, getSignedInAccountId } from '@/lib/near/wallet';
import { claimGift, yoctoToNear } from '@/lib/near/kiss-contract';

const ACCENT = '#00ec97';

interface Props {
  kissId: string;
  nearGiftStatus: 'locked' | 'claimed' | 'wilted' | null;
  nearAmountYocto: string | null;
  nearClaimerAccountId: string | null;
  receiverId: string | null;
  claimSecretFromUrl: string | null;
  onClaimed?: () => void;
}

export default function NearGiftClaimBanner({ kissId, nearGiftStatus, nearAmountYocto, nearClaimerAccountId, receiverId, claimSecretFromUrl, onClaimed }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimedLocally, setClaimedLocally] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id);

  if (!nearGiftStatus) return null;

  const amount = nearAmountYocto ? yoctoToNear(nearAmountYocto) : '0';

  if (nearGiftStatus === 'wilted') {
    return (
      <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Clock size={16} className="text-[#4a5068]" />
        <p className="text-[11px] text-[#4a5068]">This NEAR gift wasn&apos;t claimed in time and was returned to the sender.</p>
      </div>
    );
  }

  if (nearGiftStatus === 'claimed' || claimedLocally) {
    return (
      <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'rgba(0,236,151,0.06)', border: '1px solid rgba(0,236,151,0.25)' }}>
        <CheckCircle2 size={16} style={{ color: ACCENT }} />
        <p className="text-[11px] text-white/80">
          {amount} NEAR claimed{nearClaimerAccountId ? <> by <span className="font-bold">{nearClaimerAccountId}</span></> : ''}.
        </p>
      </div>
    );
  }

  // locked — only the intended receiver (if this kiss has one) may claim.
  const loggedIn = typeof document !== 'undefined' && document.cookie.includes('gao_logged_in=1');
  const blockedForWrongUser = !!receiverId && (!loggedIn || currentUserId !== receiverId);

  const handleClaim = async () => {
    setError(null);
    setBusy(true);
    try {
      const existing = await getSignedInAccountId();
      let accountId = existing;
      if (!accountId) {
        const modal = await getModal();
        const selector = await getSelector();
        accountId = await new Promise<string | null>((resolve) => {
          const offSignedIn = selector.on('signedIn', ({ accounts }) => {
            offHide.remove();
            offSignedIn.remove();
            resolve(accounts[0]?.accountId ?? null);
          });
          // Closing the modal without picking a wallet must still resolve
          // this promise — otherwise the button hangs on "Claiming…" forever.
          const offHide = modal.on('onHide', () => {
            offHide.remove();
            offSignedIn.remove();
            resolve(null);
          });
          modal.show();
        });
      }
      if (!accountId) throw new Error('Connect a NEAR wallet to claim this gift');

      let claimSecret = claimSecretFromUrl;
      if (!claimSecret) {
        const secretRes = await fetch(`/api/v1/kisses/${kissId}/claim-secret`);
        const secretData = await secretRes.json();
        if (!secretRes.ok || !secretData.data?.claim_secret) {
          throw new Error(secretData.error?.message || 'Missing claim link — ask the sender to resend it');
        }
        claimSecret = secretData.data.claim_secret;
      }

      const result = await claimGift(kissId, claimSecret as string);
      const txHash = (result as { transaction_outcome?: { id?: string } } | void)?.transaction_outcome?.id;
      if (!txHash) throw new Error('NEAR wallet did not return a transaction hash');

      const res = await fetch(`/api/v1/kisses/${kissId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ near_claim_tx_hash: txHash, near_claimer_account_id: accountId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error?.message || 'Failed to record the claim');

      setClaimedLocally(true);
      onClaimed?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to claim this gift');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(0,236,151,0.05)', border: '1px solid rgba(0,236,151,0.3)' }}>
      <div className="p-3 flex items-center gap-2.5">
        <Gem size={18} style={{ color: ACCENT }} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold text-white">{amount} NEAR gift waiting</div>
          <div className="text-[9px] text-[#4a5068]">Locked on-chain — only you can claim it</div>
        </div>
      </div>
      {blockedForWrongUser ? (
        <div className="px-3 pb-3">
          <p className="text-[10px] text-amber-400">Log in as the intended receiver to claim this gift.</p>
        </div>
      ) : (
        <div className="px-3 pb-3 space-y-1.5">
          <button
            type="button"
            onClick={handleClaim}
            disabled={busy}
            className="w-full rounded-md py-2.5 text-[12px] font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            style={{ background: ACCENT, color: '#0a0b0f' }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
            {busy ? 'Claiming…' : 'Claim with NEAR Wallet'}
          </button>
          {error && <p className="text-[10px] text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
