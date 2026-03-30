'use client';

import { FIREBASE_CONFIG, FIREBASE_VAPID_KEY } from '@/types/constants';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, Messaging, onMessage } from 'firebase/messaging';

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;
let isRequestingToken = false; // Prevent duplicate requests
let cachedFCMToken: string | null = null; // In-memory cache

// Initialize Firebase
const initializeFirebase = (): FirebaseApp | null => {
  if (typeof window === 'undefined') return null;

  try {
    if (getApps().length === 0) {
      app = initializeApp(FIREBASE_CONFIG);
    } else {
      app = getApps()[0];
    }
    return app;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    return null;
  }
};

// Get messaging instance
const getMessagingInstance = (): Messaging | null => {
  if (typeof window === 'undefined') return null;

  try {
    if (!app) {
      app = initializeFirebase();
    }
    if (app && !messaging) {
      messaging = getMessaging(app);
    }
    return messaging;
  } catch (error) {
    console.error('Failed to get messaging instance:', error);
    return null;
  }
};

// Check if FCM is supported
export const isFCMSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator;
};

// Get cached FCM token (in-memory)
export const getFCMToken = (): string | null => {
  return cachedFCMToken;
};

// Request notification permission and get FCM token
export const requestFCMToken = async (): Promise<string | null> => {
  console.log('[FCM] requestFCMToken called');
  console.log(
    '[FCM] window.Notification:',
    typeof window !== 'undefined' && 'Notification' in window,
  );
  console.log(
    '[FCM] navigator.serviceWorker:',
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  );
  console.log('[FCM] PushManager:', typeof window !== 'undefined' && 'PushManager' in window);

  if (!isFCMSupported()) {
    console.log('[FCM] Not supported');
    return null;
  }

  // Prevent duplicate concurrent requests
  if (isRequestingToken) {
    console.log('[FCM] Already requesting token, skipping');
    return cachedFCMToken;
  }

  isRequestingToken = true;

  try {
    // Check current permission status first
    console.log('[FCM] Current permission:', Notification.permission);

    let permission = Notification.permission;

    // Only request permission if not already granted (Safari requires user gesture)
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
      console.log('[FCM] Permission result:', permission);

      if (permission !== 'granted') {
        console.log('[FCM] Permission denied or dismissed');
        isRequestingToken = false;
        return null;
      }
    }

    // Always use firebase-messaging-sw.js for FCM
    const swPath = '/firebase-messaging-sw.js';

    let registration: ServiceWorkerRegistration;

    // Find or register firebase-messaging-sw.js (don't unregister other SWs like PWA sw.js)
    const allRegistrations = await navigator.serviceWorker.getRegistrations();
    let foundMatchingReg: ServiceWorkerRegistration | null = null;

    for (const reg of allRegistrations) {
      const activeUrl =
        reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL;
      if (activeUrl?.endsWith(swPath)) {
        foundMatchingReg = reg;
        break;
      }
    }

    if (foundMatchingReg) {
      registration = foundMatchingReg;
      console.log('[FCM] Using existing SW:', swPath);
    } else {
      console.log('[FCM] Registering new SW:', swPath);
      registration = await navigator.serviceWorker.register(swPath, {
        updateViaCache: 'none',
      });
    }

    // Force update if there's a waiting service worker
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // Send Firebase config to SW
    const sendConfigToSW = () => {
      const activeWorker = registration.active;
      if (activeWorker) {
        console.log('[FCM] Sending config to SW');
        activeWorker.postMessage({
          type: 'FIREBASE_CONFIG',
          config: FIREBASE_CONFIG,
        });
      }
    };

    // Wait for service worker to be active
    const waitForActive = async (): Promise<void> => {
      // Already active
      if (registration.active) {
        console.log('[FCM] SW already active');
        return;
      }

      // Wait for installing/waiting SW to become active
      const sw = registration.installing || registration.waiting;
      if (sw) {
        console.log('[FCM] Waiting for SW to activate, current state:', sw.state);
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('SW activation timeout'));
          }, 10000); // 10s timeout

          const checkState = () => {
            if (sw.state === 'activated' || registration.active) {
              clearTimeout(timeout);
              console.log('[FCM] SW activated');
              resolve();
            } else if (sw.state === 'redundant') {
              clearTimeout(timeout);
              reject(new Error('SW became redundant'));
            }
          };

          sw.addEventListener('statechange', checkState);
          checkState(); // Check immediately
        });
      } else {
        // Fallback: wait for any SW to be ready
        console.log('[FCM] Waiting for SW ready...');
        await navigator.serviceWorker.ready;
      }
    };

    await waitForActive();
    console.log('[FCM] SW is active, getting token...');

    // Send config to SW after it's active
    sendConfigToSW();

    // Get messaging instance
    const messagingInstance = getMessagingInstance();
    if (!messagingInstance) {
      console.error('Failed to get messaging instance');
      return null;
    }

    // Get FCM token
    const token = await getToken(messagingInstance, {
      vapidKey: FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log('FCM token obtained:', token.substring(0, 20) + '...', token.substring(20));
      cachedFCMToken = token;
      isRequestingToken = false;
      return token;
    }

    isRequestingToken = false;
    return null;
  } catch (error) {
    console.error('Failed to get FCM token:', error);
    isRequestingToken = false;
    return null;
  }
};

// Setup foreground message handler
export const setupForegroundMessageHandler = (
  callback: (payload: { notification?: { title?: string; body?: string }; data?: unknown }) => void,
): (() => void) | null => {
  const messagingInstance = getMessagingInstance();
  if (!messagingInstance) return null;

  return onMessage(messagingInstance, callback);
};

// Check if notification permission is granted
export const isNotificationPermissionGranted = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Notification.permission === 'granted';
};

// Check if notification permission is denied
export const isNotificationPermissionDenied = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Notification.permission === 'denied';
};