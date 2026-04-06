'use client';

import { checkAccountApi } from '@/app/api/calls/apiAccounts';
import { getPasskeyNonceApi, passKeyLoginApi, passKeyRegisterApi } from '@/app/api/calls/apiAuth';
import { getMe } from '@/app/api/calls/apiUser';
import { findPasskeyUserByCredentialId, getSavedPasskeyUsers, SavedPasskeyUser, savePasskeyUser, setAccessTokenToLocal } from '@/lib/clients/storage.helper';
import { createPasskeyCredential, getPasskeyCredential, isPasskeyCancelError, isWebAuthnSupported } from '@/lib/passkey';
import { getFCMToken, requestFCMToken } from '@/lib/passkey/fcm';
import { useAccountStore } from '@/stores/account-store';
import { useAuthStore } from '@/stores/auth-store';
import { X, ArrowRight, ShieldCheck, Fingerprint } from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PasskeyOverlay } from './PasskeyOverlay';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: (cb?: (notification: { isNotDisplayed: () => boolean; getNotDisplayedReason: () => string }) => void) => void;
          renderButton: (el: HTMLElement, config: Record<string, unknown>) => void;
          cancel: () => void;
        };
      };
    };
  }
}

interface AuthPopupProps {
  open: boolean;
  onClose: () => void;
}

export default function AuthPopup({ open, onClose }: AuthPopupProps) {
  const router = useRouter();
  // PASSKEY: temporarily disabled
  // const [selectedUser, setSelectedUser] = useState<SavedPasskeyUser | null>(null);
  // const [showPasskeyOverlay, setShowPasskeyOverlay] = useState(false);
  const selectedUser = null;
  const showPasskeyOverlay = false;
  const setTokens = useAuthStore((s) => s.setTokens);
  const setAccount = useAccountStore((s) => s.setAccount);
  const hydrateFromMe = useAuthStore((s) => s.hydrateFromMe);
  const setAccountLoaded = useAccountStore((s) => s.setLoaded);
  // PASSKEY: temporarily disabled
  // const [savedUsers, setSavedUsers] = useState<SavedPasskeyUser[]>([]);
  // const [currentUserIndex, setCurrentUserIndex] = useState(0);
  // const currentUser = savedUsers[currentUserIndex];
  // const startX = useRef(0);
  // const endX = useRef(0);
  // const isSwiping = useRef(false);
  // const minSwipeDistance = 50;
  // const isMouseDown = useRef(false);
  const currentUser = null;

  const [googleLoading, setGoogleLoading] = useState(false);

  // Handle OAuth login success (Google/Apple)
  const handleOAuthSuccess = useCallback(async (accessToken: string, refreshToken?: string) => {
    // Store access token in localStorage for external API clients that need Authorization header
    // httpOnly cookies are the primary auth mechanism — this is supplementary
    // NOTE: refresh token NOT stored in localStorage (sensitive — httpOnly cookie only)
    setAccessTokenToLocal(accessToken);
    setTokens(accessToken, refreshToken);

    // Hydrate user from cookie-based session (primary) or token fallback
    try {
      const res = await fetch('/api/v1/auth/session', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (data?.data) {
          hydrateFromMe(data);
          // Save last user for "Welcome back" UX (non-sensitive only)
          try {
            localStorage.setItem('gao_last_user', JSON.stringify({
              display_name: data.data.display_name || data.data.fullName || data.data.username || '',
              avatar_url: data.data.avatar_url || data.data.avatarUrl || '',
            }));
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }

    setAccount(null);
    setAccountLoaded(true);

    toast.success('Login successful!');
    onClose();
  }, [setTokens, hydrateFromMe, setAccount, setAccountLoaded, onClose, router]);

  // Google Sign-In handler
  const handleGoogleCredential = useCallback(async (response: { credential: string }) => {
    setGoogleLoading(true);
    try {
      const res = await fetch('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Google login failed');
      }

      const data = await res.json();
      if (data.is_new_user) {
        toast.success('Welcome to Gao!');
      }
      await handleOAuthSuccess(data.access_token, data.refresh_token);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Google login failed');
    } finally {
      setGoogleLoading(false);
    }
  }, [handleOAuthSuccess]);

  // Google Sign-In via popup OAuth flow (no GSI library needed)
  const handleGoogleClick = useCallback(() => {
    if (googleLoading) return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) { toast.error('Google not configured'); return; }

    const redirectUri = window.location.origin + '/auth/google/callback';
    const scope = 'openid email profile';
    const state = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem('gao_google_state', state);

    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}&prompt=select_account&access_type=offline`;

    // Open popup
    const w = 500, h = 600;
    const left = (screen.width - w) / 2, top = (screen.height - h) / 2;
    const popup = window.open(url, 'google-signin', `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`);

    // Listen for callback message from popup
    const handler = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== 'google-auth') return;
      window.removeEventListener('message', handler);
      popup?.close();

      const { code, error } = e.data;
      if (error || !code) { toast.error('Google sign-in cancelled'); return; }

      setGoogleLoading(true);
      try {
        const res = await fetch('/api/v1/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: redirectUri }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || 'Google login failed');
        }
        const data = await res.json();
        if (data.is_new_user) toast.success('Welcome to Gao!');
        await handleOAuthSuccess(data.access_token, data.refresh_token);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Google login failed');
      } finally {
        setGoogleLoading(false);
      }
    };
    window.addEventListener('message', handler);

    // Cleanup if popup closed without completing
    // try/catch needed: Google sets COOP header that blocks popup.closed access
    const timer = setInterval(() => {
      try {
        if (!popup || popup.closed) { clearInterval(timer); window.removeEventListener('message', handler); setGoogleLoading(false); }
      } catch { clearInterval(timer); window.removeEventListener('message', handler); setGoogleLoading(false); }
    }, 500);
  }, [googleLoading, handleOAuthSuccess]);

  // PASSKEY: temporarily disabled
  // useEffect(() => {
  //   const users = getSavedPasskeyUsers();
  //   setSavedUsers(users);
  // }, []);

  if (!open) return null;

  // ═══════════════════════════════════════════════════════════
  // PASSKEY: temporarily disabled — all handlers commented out
  // To re-enable: uncomment this block and the state variables above
  // ═══════════════════════════════════════════════════════════
  // const handleTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; endX.current = e.touches[0].clientX; isSwiping.current = false; };
  // const handleTouchMove = (e: React.TouchEvent) => { endX.current = e.touches[0].clientX; if (Math.abs(startX.current - endX.current) > minSwipeDistance) { isSwiping.current = true; } };
  // const handleTouchEnd = () => { if (isSwiping.current) { const diff = startX.current - endX.current; if (diff > 0 && currentUserIndex < savedUsers.length - 1) { setCurrentUserIndex((prev) => prev + 1); } else if (diff < 0 && currentUserIndex > 0) { setCurrentUserIndex((prev) => prev - 1); } } isSwiping.current = false; };
  // const handleMouseDown = (e: React.MouseEvent) => { isMouseDown.current = true; startX.current = e.clientX; endX.current = e.clientX; isSwiping.current = false; };
  // const handleMouseMove = (e: React.MouseEvent) => { if (!isMouseDown.current) return; endX.current = e.clientX; if (Math.abs(startX.current - endX.current) > minSwipeDistance) { isSwiping.current = true; } };
  // const handleMouseUp = () => { if (!isMouseDown.current) return; isMouseDown.current = false; if (isSwiping.current) { const diff = startX.current - endX.current; if (diff > 0 && currentUserIndex < savedUsers.length - 1) { setCurrentUserIndex((prev) => prev + 1); } else if (diff < 0 && currentUserIndex > 0) { setCurrentUserIndex((prev) => prev - 1); } } isSwiping.current = false; };
  // const handleMouseLeave = () => { if (isMouseDown.current) { handleMouseUp(); } };
  // const handleSignupWithPasskey = async () => { ... };
  // const handleSelectUser = async (savedUser: SavedPasskeyUser) => { ... };
  // const handleUserClick = () => { if (currentUser) { handleSelectUser(currentUser); } };
  // const handlePasskeySuccess = async (credential) => { ... };
  // const handlePasskeyCancel = () => { setSelectedUser(null); setShowPasskeyOverlay(false); };
  // const handlePasskeyError = (_error: string) => {};
  // const handleLoginSuccess = async (accessToken, refreshToken, credential, passkeyUsernameFromLogin) => { ... };
  // const loginWithOtherPasskey = async () => { await requestFCMToken(); setSelectedUser(null); setShowPasskeyOverlay(true); };
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 z-[9000]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal — absolute center */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-[calc(100%-40px)] max-w-sm rounded-3xl overflow-hidden max-h-[85vh] overflow-y-auto animate-[popIn_0.25s_ease-out]"
        style={{
          background: '#0a0b0f',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute right-4 top-4 h-8 w-8 rounded-full flex items-center justify-center cursor-pointer z-10" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <X size={15} className="text-[#8892a8]" />
        </button>

        {/* Header glow */}
        <div className="absolute inset-x-0 top-0 h-40 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,212,255,0.08) 0%, transparent 70%)' }} />

        <div className="relative px-6 pt-10 pb-8">

        {/* Logo + Title — check for returning user */}
        {!currentUser && (() => {
          let lastUser: { display_name?: string; avatar_url?: string; email?: string } | null = null;
          try { lastUser = JSON.parse(localStorage.getItem('gao_last_user') || 'null'); } catch { /* ignore */ }
          const isReturning = !!lastUser?.display_name;

          return (
            <div className="mb-8 text-center">
              <div className="relative mx-auto mb-5">
                <div className="absolute inset-0 scale-150 rounded-full opacity-30 blur-xl" style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.3), transparent)' }} />
                {isReturning && lastUser?.avatar_url ? (
                  <div className="relative mx-auto h-16 w-16 rounded-full overflow-hidden" style={{ border: '2px solid rgba(0,212,255,0.2)', boxShadow: '0 0 30px rgba(0,212,255,0.1)' }}>
                    <img src={lastUser.avatar_url} alt="" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="relative mx-auto h-14 w-14 rounded-[1.2rem] flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a0b0f, #111318)', border: '1px solid rgba(0,212,255,0.15)', boxShadow: '0 0 30px rgba(0,212,255,0.1)' }}>
                    <Image src="/images/gao-logo.png" alt="Gao" width={36} height={36} />
                  </div>
                )}
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                {isReturning ? `Welcome back, ${lastUser!.display_name!.split(' ')[0]}` : 'Welcome to Gao'}
              </h3>
              <p className="mt-1.5 text-[11px] text-[#4a5068]">
                {isReturning ? 'Tap below to sign in again' : 'Sign in to discover, connect and act'}
              </p>
            </div>
          );
        })()}

        {/* Social login — always visible on top */}
        {!currentUser && (
          <>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <button
                onClick={handleGoogleClick}
                className="flex items-center justify-center gap-2.5 rounded-2xl py-3.5 cursor-pointer transition-all active:scale-[0.97]"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className="text-[12px] font-semibold text-white">{googleLoading ? 'Signing in...' : 'Google'}</span>
              </button>

              <button
                onClick={() => toast.info('Apple Sign-In coming soon')}
                className="flex items-center justify-center gap-2.5 rounded-2xl py-3.5 cursor-pointer transition-all active:scale-[0.97]"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <svg width="14" height="16" viewBox="0 0 17 20" fill="white">
                  <path d="M13.34 10.05c-.01-1.86 1.03-3.24 3.13-4.25-.86-1.24-2.15-1.92-3.84-2.06-1.62-.13-3.39.95-4.04.95-.68 0-2.23-.91-3.42-.91C2.73 3.82 0 5.84 0 10.27c0 1.31.24 2.67.72 4.06.64 1.84 2.95 6.35 5.37 6.27 1.24-.03 2.12-.88 3.41-.88 1.25 0 2.06.88 3.42.85 2.46-.04 4.5-4.07 5.08-5.91-3.22-1.53-3.22-4.5-3.22-4.61h-.24zM10.98 2.26C12.13.89 12.01 0 12.01 0s-1.17.07-2.53 1.34c-1.46 1.37-1.24 2.97-1.21 3.09 1.28.1 2.45-.73 2.71-2.17z"/>
                </svg>
                <span className="text-[12px] font-semibold text-white">Apple</span>
              </button>
            </div>

            {/* Passkey divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <span className="text-[8px] font-bold tracking-[0.2em] text-[#4a5068] uppercase">or passkey</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>
          </>
        )}

        {/* PASSKEY: carousel disabled — only showing passkey buttons */}
        <div className="space-y-4">
          {/* PASSKEY: user carousel commented out — to re-enable, restore currentUser state + handlers */}
          {false ? (
            <>
              {/* USER PROFILE */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-3 pb-2"
              >
                <div className="group relative">
                  <div className="absolute inset-0 scale-150 rounded-full bg-cyan-500/20 opacity-0 blur-xl transition-opacity duration-700 group-hover:opacity-100" />

                  <div className="relative h-20 w-20 overflow-hidden rounded-[2rem] border-2 border-white bg-neutral-100 shadow-2xl">
                    {currentUser.avatarUrl ? (
                      <Image
                        src={currentUser?.avatarUrl}
                        alt={currentUser?.passkeyUsername}
                        width={80}
                        height={80}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#03050a]">
                        <motion.div
                          animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                          className="absolute inset-0 opacity-40"
                          style={{
                            background:
                              'radial-gradient(circle at 20% 30%, #00C2E0 0%, transparent 50%), radial-gradient(circle at 80% 70%, #2D5F8A 0%, transparent 50%)',
                            backgroundSize: '200% 200%',
                          }}
                        />

                        <div
                          className="absolute inset-0 opacity-[0.15]"
                          style={{
                            backgroundImage: `linear-gradient(#fff 0.5px, transparent 0.5px), linear-gradient(90deg, #fff 0.5px, transparent 0.5px)`,
                            backgroundSize: '15px 15px',
                          }}
                        />

                        <motion.div
                          animate={{
                            top: ['-10%', '110%'],
                            opacity: [0, 1, 1, 0],
                          }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            repeatDelay: 1,
                          }}
                          className="absolute inset-x-0 z-20 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_rgba(0,194,224,0.8)]"
                        />

                        <div className="relative z-10 flex flex-col items-center">
                          <div className="relative flex items-center justify-center">
                            <span className="absolute text-5xl font-black text-cyan-500/20 blur-xl">
                              G
                            </span>
                            <span className="relative text-4xl font-black tracking-tighter text-white drop-shadow-2xl">
                              G
                            </span>
                          </div>
                          <div className="mt-[-2px] flex flex-col items-center">
                            <div className="mb-1 h-[1px] w-8 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                            <span className="pl-[0.5em] text-[7px] leading-none font-black tracking-[0.5em] text-cyan-300 uppercase">
                              SOCIAL
                            </span>
                          </div>
                        </div>

                        <motion.div
                          animate={{ left: ['-150%', '200%'] }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            repeatDelay: 5,
                            ease: 'easeInOut',
                          }}
                          className="absolute inset-y-0 w-12 -rotate-[35deg] bg-gradient-to-r from-transparent via-white/10 to-transparent blur-md"
                        />

                        <div className="absolute inset-0 rounded-[2rem] border-[1.5px] border-white/10 shadow-[inset_0_0_15px_rgba(255,255,255,0.05)]" />
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-screen" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-center">
                  <h3 className="text-xl font-black tracking-tight text-neutral-900">
                    {currentUser?.passkeyUsername}
                  </h3>
                  <p className="text-[10px] font-bold tracking-[0.2em] text-neutral-400 uppercase">
                    {'Authorized Identity'}
                  </p>
                </div>
              </motion.div>

              {savedUsers.length > 1 && (
                <div className="flex shrink-0 items-center justify-center gap-2.5 px-6 py-4">
                  {savedUsers.length <= 5 ? (
                    savedUsers.map((_, index) => {
                      const isActive = index === currentUserIndex;
                      return (
                        <button
                          key={index}
                          onClick={() => setCurrentUserIndex(index)}
                          className="relative h-1.5 transition-all duration-500 ease-out focus:outline-none cursor-pointer"
                          style={{ width: isActive ? '24px' : '6px' }}
                        >
                          <div
                            className={`absolute inset-0 rounded-full transition-colors duration-500 ${
                              isActive ? 'bg-cyan-500' : 'bg-neutral-200'
                            }`}
                          />

                          {isActive && (
                            <motion.div
                              layoutId="activeGlow"
                              className="absolute inset-0 rounded-full bg-cyan-400 opacity-50 blur-[4px]"
                            />
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="flex items-center gap-3 rounded-full border border-neutral-100 bg-neutral-50 px-4 py-1.5">
                      <span className="text-[10px] font-black tracking-widest text-cyan-500 uppercase">
                        {String(currentUserIndex + 1).padStart(2, '0')}
                      </span>
                      <div className="h-3 w-[1px] bg-neutral-200" />
                      <span className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase">
                        {String(savedUsers.length).padStart(2, '0')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* LOGIN BUTTON */}
              <div className="space-y-4">
                <button
                  onClick={handleUserClick}
                  className="group relative w-full cursor-pointer overflow-hidden rounded-2xl bg-neutral-950 px-8 py-5 text-white transition-all active:scale-[0.97] disabled:opacity-90"
                >
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex flex-col items-start text-left">
                      <span className="mb-0.5 text-[9px] font-bold tracking-[0.4em] text-white/40 uppercase">
                        Login as{' '}
                      </span>
                      <span className="text-[12px] tracking-[0.2em]">
                        {currentUser?.passkeyUsername?.split(' ')[0]}
                      </span>
                    </div>

                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
                      <ArrowRight size={20} className="text-white/70" />
                    </div>
                  </div>
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleSignupWithPasskey}
                    className="group relative flex cursor-pointer flex-col items-start justify-between rounded-2xl border border-neutral-200 bg-white p-5 transition-all hover:bg-neutral-50 active:scale-[0.96]"
                  >
                    <div className="flex flex-col items-start text-left">
                      <span className="mb-1 text-[8px] font-bold tracking-[0.3em] text-neutral-400 uppercase">
                        New Passkey
                      </span>
                      <span className="text-[11px] leading-tight font-black tracking-[0.1em] text-neutral-900 uppercase">
                        Create
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={loginWithOtherPasskey}
                    className="group relative flex cursor-pointer flex-col items-start justify-between rounded-2xl border border-neutral-200 bg-white p-5 transition-all hover:bg-neutral-50 active:scale-[0.96]"
                  >
                    <div className="flex flex-col items-start text-left">
                      <span className="mb-1 text-[8px] font-bold tracking-[0.3em] text-neutral-400 uppercase">
                        Guard
                      </span>
                      <span className="text-[11px] leading-tight font-black tracking-[0.1em] text-neutral-900 uppercase">
                        Restore
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* PASSKEY: buttons disabled, using toast placeholder */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => toast.info('Passkey coming soon')}
                  className="flex items-center gap-2 rounded-xl px-4 py-3 cursor-pointer transition-all active:scale-[0.97]"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <Fingerprint size={16} className="text-[#00d4ff] shrink-0" />
                  <div className="text-left">
                    <span className="text-[10px] font-semibold text-white block">New Passkey</span>
                    <span className="text-[8px] text-[#4a5068]">Create</span>
                  </div>
                </button>
                <button
                  onClick={() => toast.info('Passkey restore coming soon')}
                  className="flex items-center gap-2 rounded-xl px-4 py-3 cursor-pointer transition-all active:scale-[0.97]"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <ArrowRight size={16} className="text-[#4a5068] shrink-0" />
                  <div className="text-left">
                    <span className="text-[10px] font-semibold text-white block">Restore</span>
                    <span className="text-[8px] text-[#4a5068]">Recovery</span>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Security badge */}
        <div className="flex flex-col items-center mt-6">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ShieldCheck size={13} className="text-emerald-500" />
            <span className="text-[9px] font-semibold tracking-[0.15em] text-[#4a5068] uppercase">
              Secured Authentication
            </span>
          </div>
        </div>

        {/* Guest option */}
        <div className="flex items-center gap-3 mt-5">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
          <button
            onClick={onClose}
            className="text-[10px] text-[#4a5068] hover:text-white transition-colors cursor-pointer"
          >
            Continue as Guest
          </button>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </div>
      </div>
      </div>
        {/* PASSKEY: overlay disabled
        {(selectedUser || showPasskeyOverlay) && (
          <PasskeyOverlay
            userId={selectedUser?.userId}
            onSuccess={handlePasskeySuccess}
            onCancel={handlePasskeyCancel}
            onError={handlePasskeyError}
          />
        )}
        */}
      <style>{`
        @keyframes popIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
