'use client';

import { checkAccountApi } from '@/app/api/calls/apiAccounts';
import { getPasskeyNonceApi, passKeyLoginApi, passKeyRegisterApi } from '@/app/api/calls/apiAuth';
import { getMe } from '@/app/api/calls/apiUser';
import { findPasskeyUserByCredentialId, getSavedPasskeyUsers, SavedPasskeyUser, savePasskeyUser, setAccessTokenToLocal, setOnboardingCompleted, setRefreshTokenToLocal, updatePasskeyUserInfo, updatePasskeyUserLastLogin } from '@/lib/clients/storage.helper';
import { createPasskeyCredential, getPasskeyCredential, isPasskeyCancelError, isWebAuthnSupported } from '@/lib/passkey';
import { getFCMToken, requestFCMToken } from '@/lib/passkey/fcm';
import { useAccountStore } from '@/stores/account-store';
import { useAuthStore } from '@/stores/auth-store';
import { X, ArrowRight, ShieldCheck, Fingerprint } from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PasskeyOverlay } from './PasskeyOverlay';

interface AuthPopupProps {
  open: boolean;
  onClose: () => void;
}

export default function AuthPopup({ open, onClose }: AuthPopupProps) {
  const router = useRouter();
  const [selectedUser, setSelectedUser] = useState<SavedPasskeyUser | null>(null);
  const [showPasskeyOverlay, setShowPasskeyOverlay] = useState(false);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setAccount = useAccountStore((s) => s.setAccount);
  const hydrateFromMe = useAuthStore((s) => s.hydrateFromMe);
  const setAccountLoaded = useAccountStore((s) => s.setLoaded);
  const [savedUsers, setSavedUsers] = useState<SavedPasskeyUser[]>([]);
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const currentUser = savedUsers[currentUserIndex];
  const startX = useRef(0);
  const endX = useRef(0);
  const isSwiping = useRef(false);
  const minSwipeDistance = 50;
  const isMouseDown = useRef(false);

  useEffect(() => {
    const users = getSavedPasskeyUsers();
    setSavedUsers(users);
  }, []);

  if (!open) return null;
  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    endX.current = e.touches[0].clientX;
    isSwiping.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    endX.current = e.touches[0].clientX;
    // Mark as swiping if moved more than threshold
    if (Math.abs(startX.current - endX.current) > minSwipeDistance) {
      isSwiping.current = true;
    }
  };

  const handleTouchEnd = () => {
    if (isSwiping.current) {
      const diff = startX.current - endX.current;
      if (diff > 0 && currentUserIndex < savedUsers.length - 1) {
        setCurrentUserIndex((prev) => prev + 1);
      } else if (diff < 0 && currentUserIndex > 0) {
        setCurrentUserIndex((prev) => prev - 1);
      }
    }
    isSwiping.current = false;
  };

  // Mouse handlers (desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    isMouseDown.current = true;
    startX.current = e.clientX;
    endX.current = e.clientX;
    isSwiping.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current) return;
    endX.current = e.clientX;
    if (Math.abs(startX.current - endX.current) > minSwipeDistance) {
      isSwiping.current = true;
    }
  };

  const handleMouseUp = () => {
    if (!isMouseDown.current) return;
    isMouseDown.current = false;
    if (isSwiping.current) {
      const diff = startX.current - endX.current;
      if (diff > 0 && currentUserIndex < savedUsers.length - 1) {
        setCurrentUserIndex((prev) => prev + 1);
      } else if (diff < 0 && currentUserIndex > 0) {
        setCurrentUserIndex((prev) => prev - 1);
      }
    }
    isSwiping.current = false;
  };

  const handleMouseLeave = () => {
    if (isMouseDown.current) {
      handleMouseUp();
    }
  };

  const handleSignupWithPasskey = async () => {
    if (!isWebAuthnSupported()) {
      toast.error('Passkey is not supported in this browser');
      return;
    }

    // Request FCM permission (Safari requires user gesture)
    await requestFCMToken();

    try {
      // Step 1: Get nonce from server
      const nonceRes = await getPasskeyNonceApi();
      if (!nonceRes?.message || !nonceRes.userId || !nonceRes.username) {
        throw new Error('Failed to get nonce');
      }

      // Step 2: Create passkey credential
      const credential = await createPasskeyCredential(
        nonceRes.message,
        nonceRes.userId,
        nonceRes.username,
        true,
      );

      // Step 3: Get FCM token
      const fcmToken = getFCMToken();

      // Step 4: Register passkey on server
      const registerRes = await passKeyRegisterApi({
        attestationInfo: credential,
        user_id: nonceRes.userId,
        username: nonceRes.username,
        platform: 'web',
        fcmToken: fcmToken || undefined,
      });

      if (!registerRes?.access_token) {
        throw new Error('Registration failed');
      }

      // Step 5: Save tokens
      setAccessTokenToLocal(registerRes.access_token);
      if (registerRes.refresh_token) {
        setRefreshTokenToLocal(registerRes.refresh_token);
      }
      if (registerRes.access_token && registerRes.refresh_token) {
        setTokens(registerRes.access_token, registerRes.refresh_token);
      }
      setOnboardingCompleted(true);

      // Step 6: Save passkey user
      savePasskeyUser({
        credentialId: credential.id,
        rawId: credential.rawId,
        userId: nonceRes.userId,
        username: nonceRes.username,
        passkeyUsername: nonceRes.username,
        displayName: nonceRes.username,
        largeBlobSupported: credential.largeBlobSupported,
      });

      // Step 7: Get user info
      const meRes = await getMe();
      if (meRes) {
        hydrateFromMe(meRes);
      }

      // Step 8: Set account
      setAccount(null);
      setAccountLoaded(true);

      // Step 9: Navigate
      toast.success('Account created successfully!');
      onClose();
      router.push('/');
    } catch (error) {
      if (!isPasskeyCancelError(error)) {
        console.error('Registration error:', error);
        toast.error(error instanceof Error ? error.message : 'Registration failed');
      }
    } finally {
    }
  };

  const handleSelectUser = async (savedUser: SavedPasskeyUser) => {
    if (!isWebAuthnSupported()) {
      toast.error('Passkey is not supported in this browser');
      return;
    }
    // Request FCM permission (Safari requires user gesture)
    await requestFCMToken();
    setSelectedUser(savedUser);
  };
  const handleUserClick = () => {
    if (currentUser) {
      handleSelectUser(currentUser);
    }
  };

  const handlePasskeySuccess = async (
    credential: Awaited<ReturnType<typeof getPasskeyCredential>>,
  ) => {
    try {
      // Get FCM token (if any)
      const fcmToken = getFCMToken();

      const loginRes = await passKeyLoginApi({
        assertionInfo: credential,
        userId: credential.userId || '',
        platform: 'web',
        fcmToken: fcmToken || undefined,
      });

      if (loginRes?.access_token) {
        await handleLoginSuccess(
          loginRes.access_token,
          loginRes.refresh_token,
          credential,
          loginRes.passkey_username,
        );
      } else {
        throw new Error('Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      toast.error(err instanceof Error ? err.message : 'An error occurred');
      setSelectedUser(null);
    }
  };

  const handlePasskeyCancel = () => {
    setSelectedUser(null);
    setShowPasskeyOverlay(false);
  };

  // Error is displayed in PasskeyOverlay, don't close it
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handlePasskeyError = (_error: string) => {
    // Error is shown in overlay, user can tap to retry or cancel
  };

  const handleLoginSuccess = async (
    accessToken: string,
    refreshToken?: string,
    credential?: { id: string; rawId: string; userId?: string; largeBlobData?: string },
    passkeyUsernameFromLogin?: string,
  ) => {
    setAccessTokenToLocal(accessToken);
    if (refreshToken) setRefreshTokenToLocal(refreshToken);
    setTokens(accessToken, refreshToken);

    const user = await getMe();
    if (user) {
      hydrateFromMe(user);
      // Get display name: full_name > first_name + last_name > display_name
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userAny = user as any;
      let displayName = userAny.full_name;
      if (!displayName) {
        const firstName = userAny.first_name || '';
        const lastName = userAny.last_name || '';
        displayName = `${firstName} ${lastName}`.trim() || userAny.display_name;
      }
      // Save or update passkey user info
      if (credential) {
        const existingUser = findPasskeyUserByCredentialId(credential.id);
        console.log('[Login] credential:', credential);
        console.log('[Login] user:', user);
        console.log('[Login] existingUser:', existingUser);
        console.log('[Login] passkeyUsernameFromLogin:', passkeyUsernameFromLogin);
        if (existingUser) {
          // Update existing user info
          updatePasskeyUserInfo(credential.id, {
            username: user.username,
            displayName,
            avatarUrl: user.avatar_url,
          });
        } else {
          // Save new passkey user (first time login with this passkey)
          // Use passkey_username from login response (faster, no extra API call)
          const passkeyUsername = passkeyUsernameFromLogin || user.username || '';
          console.log('[Login] Saving new passkey user, passkeyUsername:', passkeyUsername);
          savePasskeyUser({
            credentialId: credential.id,
            rawId: credential.rawId,
            userId: credential.userId || user.id || '',
            username: user.username || '',
            passkeyUsername: passkeyUsername,
            displayName,
            avatarUrl: user.avatar_url,
          });
        }
        // Update lastLoginAt for sorting recently used
        updatePasskeyUserLastLogin(credential.id);
      }
    } else {
      console.warn('[Login] getMe() returned null');
    }

    // Check KYB status immediately after login
    try {
      const accountRes = await checkAccountApi();
      if (accountRes?.id) {
        setAccount({
          id: accountRes.id,
          name: accountRes.name || '',
          email: accountRes.email || '',
          isVerified: accountRes.is_verified || false,
          kybStatus: accountRes.kyb_status as 'pending' | 'rejected' | 'complete' | undefined,
          status: accountRes.status as 'pending' | 'rejected' | 'complete' | undefined,
        });
      } else {
        setAccount(null);
      }
    } catch {
      setAccount(null);
    } finally {
      setAccountLoaded(true);
    }

    toast.success('Login successful!');
    onClose();
    router.push('/');
  };

  const loginWithOtherPasskey = async () => {
    // Request FCM permission (Safari requires user gesture)
    await requestFCMToken();

    setSelectedUser(null);
    setShowPasskeyOverlay(true);
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-end sm:items-center justify-center px-0 sm:px-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-neutral-50 p-6 max-h-[90dvh] overflow-y-auto animate-[popIn_0.2s_ease-out]"
        style={{
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer z-10">
          <X size={18} />
        </button>

        {!currentUser && (
          <div className="mb-10 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[1.8rem] border border-neutral-100 bg-white shadow-xl shadow-cyan-500/5">
              <Fingerprint size={32} strokeWidth={1.5} className="text-cyan-500" />
            </div>
            <h3 className="text-xl font-black tracking-tight text-neutral-900">
              Passkey Access
            </h3>
            <p className="mt-2 text-xs font-bold tracking-[0.2em] text-neutral-400 uppercase">
              Biometric Identity
            </p>
          </div>
        )}

        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          className="space-y-6"
        >
          {currentUser ? (
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
              <button
                onClick={handleSignupWithPasskey}
                className="group relative w-full cursor-pointer overflow-hidden rounded-2xl bg-white px-8 py-5 text-black shadow-sm transition-all duration-500 hover:shadow-xl active:scale-[0.98]"
              >
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex flex-col items-start text-left">
                    <span className="mb-0.5 text-[8px] font-black tracking-[0.4em] text-black/40 uppercase">
                      Biometric
                    </span>
                    <span className="text-[12px] font-black tracking-[0.1em] uppercase">
                      Sign up with Passkey
                    </span>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white transition-all duration-500 group-hover:bg-cyan-600">
                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </div>
                </div>

                <div className="absolute inset-0 z-0 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-black/[0.02] to-transparent group-hover:animate-[shimmer_2s_infinite]" />
              </button>

              <button
                onClick={loginWithOtherPasskey}
                className="group relative mt-4 w-full cursor-pointer overflow-hidden rounded-2xl bg-white px-8 py-5 text-black shadow-sm transition-all duration-500 hover:shadow-xl active:scale-[0.98]"
              >
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex flex-col items-start text-left">
                    <span className="mb-0.5 text-[8px] font-black tracking-[0.4em] text-black/40 uppercase">
                      Recovery
                    </span>
                    <span className="text-[12px] font-black tracking-[0.1em] uppercase">
                      Restore Account
                    </span>
                  </div>
                  <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-all duration-500 group-hover:border-cyan-500 group-hover:bg-cyan-600">
                    <ArrowRight
                      size={18}
                      className="absolute transition-all duration-500 group-hover:translate-x-10 group-hover:opacity-0"
                    />
                    <ArrowRight
                      size={18}
                      className="absolute -translate-x-10 text-white opacity-0 transition-all duration-500 group-hover:translate-x-0 group-hover:opacity-100"
                    />
                  </div>
                </div>

                <div className="absolute inset-0 z-0 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-black/[0.02] to-transparent group-hover:animate-[shimmer_2s_infinite]" />
              </button>
            </>
          )}
        </div>

        {/* Security badge */}
        <div className="flex flex-col items-center mt-6">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ShieldCheck size={14} className="text-green-500" />
            <span className="text-[10px] font-medium tracking-widest text-neutral-400 uppercase">
              Secure Enclave Active
            </span>
          </div>
          <p className="text-[10px] text-neutral-300">
            No passwords required. On-device authentication only.
          </p>
        </div>

        {/* Guest option */}
        <div className="flex items-center gap-3 mt-5 mb-3">
          <div className="flex-1 h-px bg-neutral-200" />
          <button
            onClick={onClose}
            className="text-[10px] text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
          >
            Continue as Guest
          </button>
          <div className="flex-1 h-px bg-neutral-200" />
        </div>
      </div>
        {(selectedUser || showPasskeyOverlay) && (
          <PasskeyOverlay
            userId={selectedUser?.userId}
            onSuccess={handlePasskeySuccess}
            onCancel={handlePasskeyCancel}
            onError={handlePasskeyError}
          />
        )}
      <style>{`
        @keyframes popIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
