'use client';

import { checkAccountApi } from '@/app/api/calls/apiAccounts';
import { getPasskeyNonceApi, passKeyLoginApi, passKeyRegisterApi } from '@/app/api/calls/apiAuth';
import { getMe } from '@/app/api/calls/apiUser';
import { findPasskeyUserByCredentialId, getSavedPasskeyUsers, SavedPasskeyUser, savePasskeyUser, setAccessTokenToLocal, setOnboardingCompleted, setRefreshTokenToLocal, updatePasskeyUserInfo, updatePasskeyUserLastLogin } from '@/lib/clients/storage.helper';
import { createPasskeyCredential, getPasskeyCredential, isPasskeyCancelError, isWebAuthnSupported } from '@/lib/passkey';
import { getFCMToken, requestFCMToken } from '@/lib/passkey/fcm';
import { useAccountStore } from '@/stores/account-store';
import { useAuthStore } from '@/stores/auth-store';
import { X, ArrowRight, ShieldCheck, RotateCcw } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

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
    router.push('/');
  };

  const loginWithOtherPasskey = async () => {
    // Request FCM permission (Safari requires user gesture)
    await requestFCMToken();

    setSelectedUser(null);
    setShowPasskeyOverlay(true);
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center px-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm rounded-2xl p-6 animate-[popIn_0.2s_ease-out]"
        style={{
          background: 'rgba(10,11,15,0.97)',
          border: '1px solid rgba(0,212,255,0.1)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(0,212,255,0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute right-4 top-4 text-[#4a5068] hover:text-white transition-colors cursor-pointer">
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <Image src="/images/gao-logo.png" alt="Gao" width={48} height={48} className="mb-3" />
          <h2 className="text-lg font-bold text-white">Passkey Access</h2>
          <p className="mt-1 text-[11px] font-medium tracking-widest uppercase" style={{ color: '#4a5068' }}>
            Biometric Identity
          </p>
        </div>

        {/* Auth buttons */}
        <div className="space-y-3">
          {/* Sign up with Passkey */}
          <button
            onClick={handleSignupWithPasskey}
            className="flex w-full items-center rounded-2xl px-5 py-4 transition-all hover:brightness-110 cursor-pointer"
            style={{
              background: 'rgba(0,212,255,0.04)',
              border: '1px solid rgba(0,212,255,0.12)',
            }}
          >
            <div className="flex-1 text-left">
              <p className="text-[10px] font-medium tracking-widest uppercase mb-1" style={{ color: '#00d4ff' }}>
                Biometric
              </p>
              <p className="text-sm font-bold text-white">Sign up with Passkey</p>
            </div>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full shrink-0"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #6366f1)' }}
            >
              <ArrowRight size={16} className="text-white" />
            </div>
          </button>

          {/* Restore Account */}
          <button
          onClick={loginWithOtherPasskey}
            className="flex w-full items-center rounded-2xl px-5 py-4 transition-all hover:bg-white/2 cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex-1 text-left">
              <p className="text-[10px] font-medium tracking-widest uppercase mb-1" style={{ color: '#4a5068' }}>
                Recovery
              </p>
              <p className="text-sm font-bold text-white">Restore Account</p>
            </div>
            <RotateCcw size={16} style={{ color: '#4a5068' }} className="shrink-0" />
          </button>
        </div>

        {/* Security badge */}
        <div className="flex flex-col items-center mt-6">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ShieldCheck size={14} style={{ color: '#22C55E' }} />
            <span className="text-[10px] font-medium tracking-widest uppercase" style={{ color: '#4a5068' }}>
              Secure Enclave Active
            </span>
          </div>
          <p className="text-[10px]" style={{ color: '#2d3548' }}>
            No passwords required. On-device authentication only.
          </p>
        </div>

        {/* Guest option */}
        <div className="flex items-center gap-3 mt-5 mb-3">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
          <button
            onClick={onClose}
            className="text-[10px] text-[#4a5068] hover:text-[#a3adc3] transition-colors cursor-pointer"
          >
            Continue as Guest
          </button>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
