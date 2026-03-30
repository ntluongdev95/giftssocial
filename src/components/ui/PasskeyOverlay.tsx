'use client';

import { getPasskeyNonceApi } from '@/app/api/calls/apiAuth';

import { findPasskeyUserByUserId } from '@/lib/clients/storage.helper';
import { getPasskeyCredential, isPasskeyCancelError, isWebAuthnSupported } from '@/lib/passkey';
import { Check, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

interface PasskeyOverlayProps {
  userId?: string; // Optional - if not provided, allow any passkey
  nonce?: string; // Optional - if provided, use this nonce instead of calling getPasskeyNonceApi
  onSuccess: (credential: Awaited<ReturnType<typeof getPasskeyCredential>>) => void;
  onCancel: () => void;
  onError: (error: string) => void;
}

export function PasskeyOverlay({
  userId,
  nonce,
  onSuccess,
  onCancel,
  onError,
}: PasskeyOverlayProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasTriggeredRef = useRef(false);

  // Lock body scroll when overlay is shown
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const triggerPasskey = useCallback(async () => {
    if (isVerifying || hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    if (!isWebAuthnSupported()) {
      const errMsg = 'Passkey is not supported in this browser';
      setError(errMsg);
      onError(errMsg);
      return;
    }

    // If userId is provided, find specific passkey; otherwise allow any passkey
    let credentialId: string | undefined;
    if (userId) {
      const savedPasskeyUser = findPasskeyUserByUserId(userId);
      if (!savedPasskeyUser) {
        const errMsg = 'No passkey found for this account';
        setError(errMsg);
        onError(errMsg);
        return;
      }
      credentialId = savedPasskeyUser.credentialId;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // Use provided nonce or fetch from server
      let nonceMessage = nonce;
      if (!nonceMessage) {
        const nonceRes = await getPasskeyNonceApi();
        if (!nonceRes?.message) {
          throw new Error('Failed to get nonce from server');
        }
        nonceMessage = nonceRes.message;
      }

      const credential = await getPasskeyCredential(nonceMessage, credentialId);

      // Verify passkey belongs to correct user (only when userId is specified)
      if (userId && credential.userId && credential.userId !== userId) {
        throw new Error('Passkey does not match the current account');
      }

      onSuccess(credential);
    } catch (err) {
      if (isPasskeyCancelError(err)) {
        onCancel();
        return;
      }
      console.error('Passkey verification failed:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to verify passkey';
      setError(errMsg);
      setIsVerifying(false);
      hasTriggeredRef.current = false; // Allow retry
    }
  }, [userId, nonce, isVerifying, onSuccess, onError, onCancel]);

  // Auto trigger passkey on mount with small delay to ensure UI is ready
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerPasskey();
    }, 100);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = () => {
    if (!isVerifying) {
      hasTriggeredRef.current = false;
      triggerPasskey();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" onPointerUp={onCancel}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
      />

      <div className="absolute h-64 w-64 rounded-full bg-cyan-500/20 blur-[100px]" />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-full sm:max-w-[320px] overflow-hidden rounded-t-[2rem] sm:rounded-[3rem] border border-white/20 bg-white/70 p-1 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] backdrop-blur-2xl select-none"
        role="button"
        tabIndex={0}
        onPointerUp={(e: React.PointerEvent) => {
          e.stopPropagation();
          handleRetry();
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRetry();
          }
        }}
      >
        <div className="flex flex-col items-center rounded-[2.8rem] border border-neutral-100/50 bg-neutral-50/50 p-8 text-center">
          <div className="relative mb-8 flex h-24 w-24 items-center justify-center overflow-hidden rounded-[2.2rem] bg-[#03050a] shadow-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,#00C2E0_0%,transparent_50%),radial-gradient(circle_at_80%_70%,#2D5F8A_0%,transparent_50%)] opacity-40" />

            <AnimatePresence mode="wait">
              {!error && !isVerifying ? (
                <motion.div key="success" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                  <Check
                    size={40}
                    strokeWidth={3}
                    className="text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                  />
                </motion.div>
              ) : (
                <motion.div key="auth" className="relative flex flex-col items-center">
                  <span className="text-4xl font-black tracking-tighter text-white">G</span>
                  <span className="mt-[-2px] text-[6px] font-black tracking-[0.4em] text-cyan-300 uppercase">
                    DOMAINS
                  </span>

                  {isVerifying && (
                    <motion.div
                      animate={{ top: ['-10%', '110%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute inset-x-0 z-20 h-[2px] bg-cyan-400 shadow-[0_0_15px_#00C2E0]"
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute inset-0 rounded-[2.2rem] border border-white/10 shadow-[inset_0_0_15px_rgba(255,255,255,0.05)]" />
          </div>

          <div className="mb-6 space-y-2">
            <h3 className="text-lg font-black tracking-tight text-neutral-900">
              {isVerifying ? 'Verifying Identity' : error ? 'Face ID Failed' : 'Success'}
            </h3>
            <div className="flex items-center justify-center gap-2">
              <ShieldCheck
                size={14}
                className={!error && !isVerifying ? 'text-emerald-500' : 'text-cyan-500'}
              />
              <span className="text-[10px] font-bold tracking-[0.2em] text-neutral-400 uppercase">
                Secure Enclave
              </span>
            </div>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
              <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-[11px] leading-tight font-bold text-red-500">
                {error}
              </p>
              <span className="mt-3 block text-[10px] font-black tracking-widest text-cyan-500 uppercase">
                Tap to retry
              </span>
            </motion.div>
          )}

          <button
            type="button"
            onPointerUp={(e: React.PointerEvent) => {
              e.stopPropagation();
              onCancel();
            }}
            className="mt-2 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200/50 text-neutral-500 transition-all hover:bg-neutral-200 hover:text-neutral-900"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
      </motion.div>
    </div>
    
  );
}