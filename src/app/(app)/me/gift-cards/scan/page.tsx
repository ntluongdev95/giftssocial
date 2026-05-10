'use client';

// Merchant scanner — point camera at a customer's wallet QR (or paste the
// card_id) to redeem their gift card. Two-step flow:
//   1. Scan/enter card_id → POST /redeem/preview → show card details
//   2. Optionally enter amount (stored_value only) → POST /redeem → log

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Camera, Keyboard, Loader2, X, CheckCircle2, AlertTriangle,
  ScanLine,
} from 'lucide-react';
import { toast } from 'sonner';
import { GiftCardPreview, formatValue, TYPE_LABEL } from '@/components/gift-cards/GiftCardPreview';
import { csrfHeaders } from '@/lib/csrf-client';

interface PreviewCard {
  id: string;
  template_id: string;
  business_id: string;
  business_name: string | null;
  customer_name: string | null;
  customer_username: string | null;
  customer_avatar: string | null;
  type: 'voucher' | 'stored_value' | 'service' | 'loyalty';
  name: string;
  description: string;
  face_value: number;
  percent_off: number;
  amount_off: number;
  currency: string;
  gradient_from: string;
  gradient_to: string;
  expires_at: string | null;
  value_remaining: number;
  uses_remaining: number;
  status: 'active' | 'redeemed' | 'expired' | 'revoked';
  eligibility: 'ok' | 'redeemed' | 'expired' | 'revoked' | 'inactive';
}

interface RedeemResult {
  redemption_id: string;
  card_id: string;
  card_name: string;
  business_name: string | null;
  type: PreviewCard['type'];
  currency: string;
  amount_used: number;
  new_status: PreviewCard['status'];
  value_remaining: number;
  uses_remaining: number;
  gradient_from: string;
  gradient_to: string;
}

export default function GiftCardScannerPage() {
  const router = useRouter();

  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  const [manualCode, setManualCode] = useState('');
  const [preview, setPreview] = useState<PreviewCard | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);

  // ─── html5-qrcode scanner ─────────────────────────────────────────────
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const stoppedRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) return;
    stoppedRef.current = true;
    try {
      const state = scannerRef.current.getState();
      // 2 = SCANNING (lib doesn't export the enum cleanly)
      if (state === 2) await scannerRef.current.stop();
      await scannerRef.current.clear();
    } catch {
      // already stopped
    }
    scannerRef.current = null;
  }, []);

  const startScanner = useCallback(async () => {
    if (scannerRef.current || stoppedRef.current) return;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('gc-qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 280 } },
        (decodedText) => {
          // Stop scanning as soon as we have a hit, then preview.
          stopScanner();
          handleDetected(decodedText);
        },
        () => {} // ignore mid-scan errors
      );
    } catch (err) {
      console.warn('[Scanner] camera unavailable:', (err as Error).message);
      toast.error('Camera not available — use manual entry');
      setMode('manual');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mount/unmount the scanner only when in scan mode and no preview/result is up
  useEffect(() => {
    stoppedRef.current = false;
    if (mode === 'scan' && !preview && !result) {
      const t = setTimeout(() => startScanner(), 300);
      return () => {
        clearTimeout(t);
        stopScanner();
      };
    }
    return () => { stopScanner(); };
  }, [mode, preview, result, startScanner, stopScanner]);

  // Extract card_id from a scanned string. Could be a bare ID, a URL like
  // gao.social/wallet/<id>, or any string the QR encodes.
  const extractCardId = (raw: string): string => {
    const s = raw.trim();
    if (s.startsWith('gc_')) return s;
    // try to pull a gc_xxx token out of any string
    const m = s.match(/gc_[a-zA-Z0-9]+/);
    if (m) return m[0];
    return s;
  };

  const handleDetected = async (raw: string) => {
    const cardId = extractCardId(raw);
    if (!cardId) return;
    setPreviewing(true);
    try {
      const res = await fetch('/api/v1/gift-cards/redeem/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        credentials: 'same-origin',
        body: JSON.stringify({ card_id: cardId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message || 'Could not look up card');
        // restart scanner
        if (mode === 'scan') startScanner();
        return;
      }
      setPreview(json.data as PreviewCard);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Network error');
      if (mode === 'scan') startScanner();
    } finally {
      setPreviewing(false);
    }
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    handleDetected(code);
  };

  const cancelPreview = () => {
    setPreview(null);
    setAmountInput('');
    setManualCode('');
    if (mode === 'scan') startScanner();
  };

  const confirmRedeem = async () => {
    if (!preview) return;
    if (preview.eligibility !== 'ok') {
      toast.error(`Card is ${preview.eligibility}`);
      return;
    }
    let amount: number | undefined;
    if (preview.type === 'stored_value') {
      const n = Number(amountInput);
      if (!n || n <= 0) {
        toast.error('Enter the amount to deduct');
        return;
      }
      if (n > preview.value_remaining) {
        toast.error(`Only ${preview.value_remaining} ${preview.currency} left`);
        return;
      }
      amount = n;
    }
    setRedeeming(true);
    try {
      const res = await fetch('/api/v1/gift-cards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        credentials: 'same-origin',
        body: JSON.stringify({ card_id: preview.id, amount }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message || 'Could not redeem');
        return;
      }
      setResult(json.data as RedeemResult);
      setPreview(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Network error');
    } finally {
      setRedeeming(false);
    }
  };

  const scanAgain = () => {
    setResult(null);
    setPreview(null);
    setManualCode('');
    setAmountInput('');
    if (mode === 'scan') startScanner();
  };

  // ──────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto relative" style={{ background: '#0a0b0f', color: '#f0f4ff' }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3"
        style={{ background: 'rgba(10,11,15,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/me/gift-cards')}
            className="flex h-9 w-9 items-center justify-center rounded-full cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-lg font-bold">Redeem a card</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setMode('scan')}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold cursor-pointer"
            style={{
              background: mode === 'scan' ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${mode === 'scan' ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
              color: mode === 'scan' ? '#00d4ff' : '#a3adc3',
            }}
          >
            <Camera size={12} /> Scan
          </button>
          <button
            onClick={() => setMode('manual')}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold cursor-pointer"
            style={{
              background: mode === 'manual' ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${mode === 'manual' ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
              color: mode === 'manual' ? '#00d4ff' : '#a3adc3',
            }}
          >
            <Keyboard size={12} /> Manual
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-5">
        {/* Scanner / manual entry — only when nothing's pending */}
        {!preview && !result && (
          <>
            {mode === 'scan' && (
              <div className="space-y-3">
                <div
                  id="gc-qr-reader"
                  className="relative aspect-square w-full overflow-hidden rounded-2xl"
                  style={{ background: '#000', border: '1px solid rgba(255,255,255,0.06)' }}
                />
                <div className="flex items-center justify-center gap-2 text-xs text-[#a3adc3]">
                  <ScanLine size={14} className="text-[#00d4ff]" />
                  Point camera at the customer's QR
                </div>
                {previewing && (
                  <div className="flex items-center justify-center gap-2 text-xs text-[#00d4ff]">
                    <Loader2 size={14} className="animate-spin" /> Looking up card…
                  </div>
                )}
              </div>
            )}
            {mode === 'manual' && (
              <form onSubmit={submitManual} className="space-y-3">
                <p className="text-sm text-[#a3adc3]">
                  Ask the customer for the card ID shown under their QR, then paste it here.
                </p>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="gc_..."
                  className="w-full rounded-lg px-3 py-3 text-sm font-mono"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#f0f4ff' }}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim() || previewing}
                  className="w-full rounded-xl py-3 text-sm font-bold cursor-pointer disabled:opacity-50"
                  style={{ background: '#00d4ff', color: '#0a0b0f' }}
                >
                  {previewing ? <Loader2 size={14} className="inline animate-spin mr-2" /> : null}
                  Look up card
                </button>
              </form>
            )}
          </>
        )}

        {/* Preview — confirm before redeeming */}
        <AnimatePresence>
          {preview && !result && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <GiftCardPreview
                type={preview.type}
                name={preview.name}
                businessName={preview.business_name}
                value={formatValue(preview)}
                gradientFrom={preview.gradient_from}
                gradientTo={preview.gradient_to}
                description={preview.description}
                footerLeft={`${TYPE_LABEL[preview.type]}`}
                footerRight={
                  preview.type === 'stored_value'
                    ? `${formatValue({ ...preview, face_value: preview.value_remaining })} left`
                    : preview.type === 'loyalty'
                    ? `${preview.uses_remaining} left`
                    : 'Active'
                }
                statusBadge={<EligibilityPill eligibility={preview.eligibility} />}
              />

              {/* Customer + card identifier */}
              <div
                className="rounded-xl px-3.5 py-3 space-y-2.5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-surface flex items-center justify-center overflow-hidden shrink-0" style={{ border: '1px solid rgba(0,212,255,0.25)' }}>
                    {preview.customer_avatar ? (
                      <img src={preview.customer_avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-base">👤</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-[#4a5068]">Claimed by</p>
                    <p className="text-sm font-semibold truncate">
                      {preview.customer_name || preview.customer_username || 'Customer'}
                    </p>
                    {preview.customer_username && preview.customer_name && (
                      <p className="text-[11px] text-[#a3adc3] truncate">@{preview.customer_username}</p>
                    )}
                  </div>
                </div>
                {/* Card ID — proof to the merchant of which card they're acting on */}
                <div
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5"
                  style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <span className="text-[9px] uppercase tracking-wider text-[#4a5068] shrink-0">Card</span>
                  <span className="text-[11px] font-mono text-[#a3adc3] truncate">{preview.id}</span>
                </div>
              </div>

              {/* Amount input (stored_value only) */}
              {preview.type === 'stored_value' && preview.eligibility === 'ok' && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1.5 block">
                    Amount used <span className="text-[10px] text-[#4a5068]">({preview.currency})</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={preview.value_remaining}
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder={`max ${preview.value_remaining}`}
                    className="w-full rounded-lg px-3 py-3 text-base font-semibold"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#f0f4ff' }}
                  />
                </div>
              )}

              {/* Action row */}
              <div className="flex items-center gap-2">
                <button
                  onClick={cancelPreview}
                  className="flex-1 rounded-xl py-3 text-sm font-semibold cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#f0f4ff' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRedeem}
                  disabled={redeeming || preview.eligibility !== 'ok'}
                  className="flex-1 rounded-xl py-3 text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#22C55E', color: '#0a0b0f', boxShadow: '0 14px 40px -16px rgba(34,197,94,0.6)' }}
                >
                  {redeeming ? <Loader2 size={14} className="inline animate-spin mr-2" /> : <CheckCircle2 size={14} className="inline mr-2" />}
                  Confirm redeem
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success */}
        <AnimatePresence>
          {result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div
                className="rounded-2xl p-5 text-center"
                style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                  className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: 'rgba(34,197,94,0.18)', color: '#22C55E' }}
                >
                  <CheckCircle2 size={32} />
                </motion.div>
                <h3 className="text-lg font-black text-[#22C55E]">Redeemed</h3>
                <p className="mt-1 text-sm text-[#a3adc3]">
                  “{result.card_name}” marked{' '}
                  <span className="font-semibold text-white capitalize">{result.new_status}</span>
                </p>
                {result.amount_used > 0 && (
                  <p className="mt-2 text-2xl font-black">
                    -{formatValue({
                      type: 'stored_value',
                      face_value: result.amount_used,
                      currency: result.currency,
                    })}
                  </p>
                )}
              </div>

              <button
                onClick={scanAgain}
                className="w-full rounded-xl py-3 text-sm font-bold cursor-pointer"
                style={{ background: '#00d4ff', color: '#0a0b0f' }}
              >
                Scan another
              </button>
              <button
                onClick={() => router.push('/me/gift-cards')}
                className="w-full rounded-xl py-2.5 text-xs font-semibold cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#a3adc3' }}
              >
                Back to drops
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function EligibilityPill({ eligibility }: { eligibility: PreviewCard['eligibility'] }) {
  const map: Record<PreviewCard['eligibility'], { label: string; color: string; icon: React.ReactNode }> = {
    ok: { label: 'Ready', color: '#22C55E', icon: <CheckCircle2 size={10} /> },
    redeemed: { label: 'Already used', color: '#a3adc3', icon: <X size={10} /> },
    expired: { label: 'Expired', color: '#f87171', icon: <AlertTriangle size={10} /> },
    revoked: { label: 'Revoked', color: '#f87171', icon: <X size={10} /> },
    inactive: { label: 'Inactive', color: '#a3adc3', icon: <X size={10} /> },
  };
  const { label, color, icon } = map[eligibility];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur"
      style={{ background: `${color}33`, color: 'white', border: `1px solid ${color}55` }}
    >
      {icon} {label}
    </span>
  );
}
