'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type PermState = 'unknown' | 'unsupported' | 'denied' | 'default' | 'granted-subscribed' | 'granted-unsubscribed';

const SW_URL = '/sw-push.js';

// VAPID public key — exposed publicly via NEXT_PUBLIC_ env at build time.
// If empty, Web Push is impossible; we still show in-app reminders work.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Tappable status pill that walks the user through:
 *   browser support → permission grant → SW registration → push subscribe →
 *   POST /api/v1/push-subscriptions. After that it's a toggle to unsubscribe.
 *   Falls back gracefully on unsupported devices / iOS Safari < 16.4.
 */
export function PushPermissionButton({ compact }: { compact?: boolean } = {}) {
  const [state, setState] = useState<PermState>('unknown');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    detect().then(setState);
  }, []);

  async function detect(): Promise<PermState> {
    if (typeof window === 'undefined') return 'unknown';
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return 'unsupported';
    }
    const perm = Notification.permission;
    if (perm === 'denied') return 'denied';
    if (perm === 'default') return 'default';
    // Granted — check if we have an active subscription
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_URL);
      if (!reg) return 'granted-unsubscribed';
      const sub = await reg.pushManager.getSubscription();
      return sub ? 'granted-subscribed' : 'granted-unsubscribed';
    } catch {
      return 'granted-unsubscribed';
    }
  }

  async function enable() {
    if (!VAPID_PUBLIC_KEY) {
      toast.error('Push not configured on this server yet');
      return;
    }
    setBusy(true);
    try {
      // 1. Request permission
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setState(perm === 'denied' ? 'denied' : 'default');
        return;
      }
      // 2. Register service worker
      const reg = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
      // 3. Wait for it to be ready before subscribing
      await navigator.serviceWorker.ready;
      // 4. Subscribe
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast: lib.dom narrowed Uint8Array generics in TS 5.7 — the
        // underlying bytes are correct for PushManager.
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      });
      // 5. POST to server
      const json = sub.toJSON();
      const res = await fetch('/api/v1/push-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          user_agent: navigator.userAgent.slice(0, 400),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message || 'Server rejected subscription');
      }
      toast.success('Push notifications enabled');
      setState('granted-subscribed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to enable push');
      setState(await detect());
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_URL);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch(`/api/v1/push-subscriptions?endpoint=${encodeURIComponent(endpoint)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        }).catch(() => {});
      }
      toast.success('Push notifications disabled');
      setState('granted-unsubscribed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to disable');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'unknown') return null;
  if (state === 'unsupported') {
    return compact ? null : (
      <div className="text-[10px] text-[#4a5068]">
        This browser doesn&apos;t support push notifications. In-app reminders still work.
      </div>
    );
  }
  if (state === 'denied') {
    return (
      <div className="text-[10px] text-[#fca5a5]">
        Notifications blocked in browser settings. Reminders will appear in-app only.
      </div>
    );
  }

  const isOn = state === 'granted-subscribed';
  return (
    <button
      onClick={isOn ? disable : enable}
      disabled={busy}
      className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer disabled:opacity-40"
      style={
        isOn
          ? { background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }
          : { background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.2)' }
      }
    >
      {busy ? (
        <Loader2 size={16} className="animate-spin text-[#a3adc3]" />
      ) : isOn ? (
        <Bell size={16} className="text-[#34d399]" />
      ) : (
        <BellOff size={16} className="text-[#00d4ff]" />
      )}
      <span className="flex-1 text-left text-xs font-medium text-white">
        {isOn ? 'Push notifications on' : 'Enable browser push'}
      </span>
      <span className="text-[10px] text-[#a3adc3]">{isOn ? 'Tap to turn off' : 'Tap to enable'}</span>
    </button>
  );
}
