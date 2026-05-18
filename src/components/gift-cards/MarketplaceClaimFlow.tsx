'use client';

/**
 * Multi-step wallet-payment flow that fronts the existing claim endpoint
 * for marketplace-priced gift cards.
 *
 *   1. Connect wallet            (uses Reown AppKit / wagmi)
 *   2. Resolve recipient         (GET /api/v1/marketplace/payment-mapping?gao_domain=…)
 *   3. Pay + claim               (placeholder — real on-chain tx wired when payment API lands)
 *
 * Drop in instead of the plain "Claim this card" button when
 * `template.price > 0`.
 *
 * Two-layer mount: the outer component awaits `loadWeb3Inner()` (the same
 * promise Web3Provider uses) before rendering the inner. Without this gate
 * wagmi's `useAccount` fires before `WagmiProvider` mounts and React throws
 * "useConfig must be used within WagmiProvider".
 */

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import {
  Wallet, Loader2, Coins, ShieldCheck, AlertTriangle, ArrowRight, Globe, CheckCircle2,
} from 'lucide-react';
import { isGaoIdEnabled } from '@/lib/gao-id/config';
import { loadWeb3Inner } from '@/providers/Web3Provider';

type PaymentMapping = {
  gao_domain: string;
  chain: string;
  chain_id: number;
  token: string;
  token_address: string;
  recipient_address: string;
  status: 'active' | 'placeholder';
  note?: string;
};

type Props = {
  price: number;
  priceCurrency: string;
  businessName: string;
  businessGaoDomain: string | null;
  claiming: boolean;
  // The parent `/g/[claim_token]` page owns the actual claim call. We invoke
  // this after the payment step finishes — keeps server-side state machine
  // in one place.
  onConfirmedPaid: () => Promise<void> | void;
};

type Step = 'idle' | 'connecting' | 'resolving' | 'ready' | 'paying' | 'paid' | 'error';

export function MarketplaceClaimFlow(props: Props) {
  // Gate the inner mount on the same dynamic-import promise that
  // Web3Provider awaits. Until WagmiProvider is in the tree, calling
  // `useAccount()` throws — so render a static "Connect wallet to pay"
  // shell that triggers the load when tapped.
  const [web3Ready, setWeb3Ready] = useState(false);

  useEffect(() => {
    if (!isGaoIdEnabled()) return;
    let cancelled = false;
    void loadWeb3Inner().then(() => {
      if (!cancelled) setWeb3Ready(true);
    });
    return () => { cancelled = true; };
  }, []);

  if (!isGaoIdEnabled()) {
    return (
      <div
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}
      >
        <AlertTriangle size={16} className="text-[#fbbf24] shrink-0 mt-0.5" />
        <div className="text-sm text-[#fbbf24]">
          Wallet payment isn&apos;t enabled in this environment. Set{' '}
          <code className="font-mono text-[11px]">NEXT_PUBLIC_GAO_ID_ENABLED=true</code> to turn it on.
        </div>
      </div>
    );
  }

  if (!web3Ready) {
    // Skeleton button that kicks off the dynamic import on first paint via
    // the effect above. Rendering this synchronously keeps layout stable.
    return (
      <button
        disabled
        className="w-full overflow-hidden rounded-2xl py-4 text-base font-bold opacity-70 flex items-center justify-center gap-2"
        style={{ background: '#00d4ff', color: '#0a0b0f' }}
      >
        <Loader2 size={16} className="animate-spin" />
        Loading wallet…
      </button>
    );
  }

  return <MarketplaceClaimFlowInner {...props} />;
}

function MarketplaceClaimFlowInner({
  price,
  priceCurrency,
  businessName,
  businessGaoDomain,
  claiming,
  onConfirmedPaid,
}: Props) {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const [step, setStep] = useState<Step>('idle');
  const [mapping, setMapping] = useState<PaymentMapping | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Once a wallet is connected and we have the business domain, fetch the
  // recipient mapping. Triggered automatically — the user only sees one
  // button at a time.
  useEffect(() => {
    if (!isConnected || !businessGaoDomain) return;
    if (step !== 'connecting' && step !== 'idle') return;
    setStep('resolving');
    fetch(`/api/v1/marketplace/payment-mapping?gao_domain=${encodeURIComponent(businessGaoDomain)}`, {
      credentials: 'same-origin',
    })
      .then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message || 'Lookup failed');
        return j.data as PaymentMapping;
      })
      .then(m => {
        setMapping(m);
        setStep('ready');
      })
      .catch(e => {
        setErrorMsg(e instanceof Error ? e.message : 'Failed to resolve payment address');
        setStep('error');
      });
  }, [isConnected, businessGaoDomain, step]);

  async function connect() {
    setErrorMsg(null);
    setStep('connecting');
    try {
      await open();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Connect failed');
      setStep('error');
    }
  }

  async function pay() {
    if (!mapping) return;
    setStep('paying');
    try {
      // Placeholder: real on-chain transfer goes here once payment API lands.
      // For now we just simulate a short delay and call the existing claim
      // endpoint so QA can exercise the full flow.
      await new Promise(r => setTimeout(r, 800));
      await onConfirmedPaid();
      setStep('paid');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Payment failed');
      setStep('error');
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  // Missing biz domain → can't route payment. Hard fail (admin needs to fix).
  if (!businessGaoDomain) {
    return (
      <div
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}
      >
        <AlertTriangle size={16} className="text-[#fca5a5] shrink-0 mt-0.5" />
        <div className="text-sm text-[#fca5a5]">
          This merchant hasn&apos;t registered a payment domain yet — claim is not available right now.
        </div>
      </div>
    );
  }

  if (step === 'idle' || step === 'connecting') {
    return (
      <button
        onClick={connect}
        disabled={step === 'connecting'}
        className="w-full overflow-hidden rounded-2xl py-4 text-base font-bold cursor-pointer disabled:opacity-50"
        style={{
          background: '#00d4ff',
          color: '#0a0b0f',
          boxShadow: '0 14px 40px -16px rgba(0,212,255,0.6)',
        }}
      >
        {step === 'connecting' ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Opening wallet…
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Wallet size={16} /> Connect wallet to pay
            <span className="opacity-70 font-semibold">
              · {price.toLocaleString()} {priceCurrency}
            </span>
          </span>
        )}
      </button>
    );
  }

  if (step === 'resolving') {
    return (
      <div className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.2)' }}>
        <Loader2 size={16} className="animate-spin text-[#00d4ff]" />
        <div className="text-sm text-[#a3adc3]">
          Resolving payment address for <span className="text-[#00d4ff]">{businessGaoDomain}</span>…
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
          <AlertTriangle size={16} className="text-[#fca5a5] shrink-0 mt-0.5" />
          <div className="text-sm text-[#fca5a5]">{errorMsg ?? 'Something went wrong'}</div>
        </div>
        <button
          onClick={() => { setStep('idle'); setErrorMsg(null); }}
          className="w-full rounded-xl py-2.5 text-sm font-semibold cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.05)', color: '#a3adc3', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (step === 'paid') {
    return (
      <div className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
        <CheckCircle2 size={18} className="text-[#34d399]" />
        <div className="text-sm text-[#34d399] font-semibold">Card claimed — opening your wallet…</div>
      </div>
    );
  }

  // step === 'ready' or 'paying'
  return (
    <div className="space-y-3">
      {/* Connected wallet summary */}
      {address && (
        <div className="rounded-xl p-3 flex items-center gap-2"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <Wallet size={14} className="text-[#00d4ff]" />
          <span className="text-xs text-[#a3adc3]">Connected</span>
          <span className="text-xs font-mono text-white ml-auto">
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
        </div>
      )}

      {/* Payment details — what + where */}
      {mapping && (
        <div className="rounded-2xl p-4 space-y-3"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.06), rgba(168,85,247,0.04))',
            border: '1px solid rgba(0,212,255,0.15)',
          }}>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#00d4ff]">
            <ShieldCheck size={12} /> Pay {businessName}
            {mapping.status === 'placeholder' && (
              <span
                className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}
              >
                Placeholder mapping
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-1.5">
            <Coins size={18} className="text-[#00d4ff]" />
            <span className="text-2xl font-bold">{price.toLocaleString()}</span>
            <span className="text-sm text-[#a3adc3]">{priceCurrency}</span>
          </div>

          <div className="space-y-1.5 text-xs">
            <Row label="Chain" value={`${mapping.chain} (id ${mapping.chain_id})`} />
            <Row label="Token" value={`${mapping.token}`} mono />
            <Row label="To" value={mapping.recipient_address} mono truncate />
            <Row label="Resolved from" value={mapping.gao_domain} icon={<Globe size={10} />} />
          </div>
        </div>
      )}

      <button
        onClick={pay}
        disabled={step === 'paying' || claiming}
        className="w-full rounded-2xl py-4 text-base font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: '#00d4ff', color: '#0a0b0f', boxShadow: '0 14px 40px -16px rgba(0,212,255,0.6)' }}
      >
        {step === 'paying' || claiming ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {step === 'paying' ? 'Confirming payment…' : 'Claiming…'}
          </>
        ) : (
          <>
            Pay {price.toLocaleString()} {priceCurrency} <ArrowRight size={16} />
          </>
        )}
      </button>

      <p className="text-[10px] text-[#4a5068] text-center">
        On-chain transfer is paused — payment mapping is a placeholder until the real API lands.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  truncate,
  icon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-[#4a5068] w-20 shrink-0">{label}</span>
      {icon && <span className="text-[#4a5068]">{icon}</span>}
      <span
        className={`min-w-0 flex-1 text-white ${mono ? 'font-mono' : ''} ${truncate ? 'truncate' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}
