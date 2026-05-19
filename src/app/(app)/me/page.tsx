'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useGaoIdStore } from '@/stores/gao-id-store';
import { secureFetch } from '@/lib/fetch';
import TrustLevelPill from '@/components/trust/TrustLevelPill';
import GaoIdAccountSection from '@/components/auth/GaoIdAccountSection';
import {
  MapPin, CalendarCheck, Bot, Bookmark, Shield, Settings, LogOut,
  UserCheck, Store, Calendar, Users, Star, ChevronRight, QrCode,
  HelpCircle, Globe, Bell, Wallet, Award, Signal, Eye, EyeOff, RefreshCw, Clock, Gift,
  Plus, X as XIcon, Search, Megaphone, ShoppingBag, ShieldCheck,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, {
  
}).then(r => r.json());

export default function MePage() {
  const router = useRouter();
  const { user, isAuthed, logout } = useAuthStore();

  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    // Server-side: revoke sessions + clear httpOnly cookies
    try {
      await Promise.race([
        fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' }),
        new Promise(r => setTimeout(r, 3000)),
      ]);
    } catch { /* proceed with local cleanup */ }

    // Client-side cleanup — cookies, tokens, AND any in-memory auth
    // sub-state. Without resetting `gao_last_user` + the Gao ID store,
    // a re-open of AuthPopup keeps showing "Welcome back, …" with the
    // old Gao ID button, and clicking it does nothing because the store
    // still thinks the user is authenticated. Required: full refresh
    // resets these otherwise.
    document.cookie = 'gao_logged_in=; Max-Age=0; path=/';
    document.cookie = 'gao_csrf=; Max-Age=0; path=/';
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('gao_last_user');
    try { useGaoIdStore.getState().clear(); } catch { /* store may not be init'd */ }
    logout();
    router.push('/world');
  };

  const displayName = user?.fullName || user?.username || 'Welcome';
  const avatarUrl = user?.avatarUrl;
  const username = user?.username;

  // Fetch counts — always revalidate when page mounts
  const swrOpts = { revalidateOnMount: true, revalidateOnFocus: true };
  const { data: signalsData } = useSWR(isAuthed ? '/api/v1/signals/me' : null, fetcher, swrOpts);
  const { data: savedData } = useSWR(isAuthed ? '/api/v1/saved' : null, fetcher, swrOpts);
  const { data: bookingsData } = useSWR(isAuthed ? '/api/v1/bookings/me' : null, fetcher, swrOpts);
  const { data: followsData } = useSWR(isAuthed ? '/api/v1/follows?type=following' : null, fetcher, swrOpts);
  const { data: followersData } = useSWR(isAuthed ? '/api/v1/follows?type=followers' : null, fetcher, swrOpts);
  const { data: circlesData } = useSWR(isAuthed ? '/api/v1/circles/me' : null, fetcher, swrOpts);
  const { data: notifsData } = useSWR(isAuthed ? '/api/v1/notifications?unread=true' : null, fetcher, { ...swrOpts, refreshInterval: 10000 });
  const { data: meData, mutate: mutateMe } = useSWR(isAuthed ? '/api/v1/users/me' : null, fetcher, swrOpts);
  // Whether the caller owns a business — gates the Promote Template link
  // since promo templates require a `business_id` server-side.
  const { data: bizData } = useSWR(isAuthed ? '/api/v1/businesses/me' : null, fetcher, swrOpts);
  const hasBusiness = !!bizData?.data?.id;
  const userPhotos: string[] = meData?.data?.photos || [];
  const locationSharing: string = meData?.data?.location_sharing || 'off';
  const locationSharedUntil: string | null = meData?.data?.location_shared_until || null;
  // is_admin is server-set via migration-018; only flips when staff updates
  // the row manually. Used to gate the Admin Console entry below.
  const isAdmin: boolean = meData?.data?.is_admin === 1;
  const locationVisible = locationSharing !== 'off';
  const audience: 'off' | 'everyone' | 'friends' | 'circles' | 'specific' =
    locationSharing === 'friends' ? 'friends'
    : locationSharing === 'circles' ? 'circles'
    : locationSharing === 'specific' ? 'specific'
    : locationSharing === 'off' ? 'off'
    : 'everyone';
  const [savingLocation, setSavingLocation] = useState(false);
  const [refreshingLocation, setRefreshingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const autoRefreshedRef = useRef(false);

  const DURATION_PRESETS: { value: number; label: string }[] = [
    { value: 900, label: '15 minutes' },
    { value: 3600, label: '1 hour' },
    { value: 14400, label: '4 hours' },
    { value: 86400, label: '24 hours' },
    { value: 0, label: 'Until I turn off' },
  ];
  const currentDurationValue: number = (() => {
    if (!locationSharedUntil) return 0;
    const remaining = Math.floor((new Date(locationSharedUntil).getTime() - Date.now()) / 1000);
    if (remaining <= 0) return 0;
    return DURATION_PRESETS.slice(0, -1).reduce(
      (best, p) => Math.abs(p.value - remaining) < Math.abs(best - remaining) ? p.value : best,
      DURATION_PRESETS[0].value,
    );
  })();

  const patchMe = async (payload: Record<string, unknown>) => {
    const res = await secureFetch('/api/v1/users/me', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message || `Request failed (${res.status})`);
    return json;
  };

  const getBrowserLocation = (): Promise<{ lat: number; lng: number }> =>
    new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error('Geolocation not supported by this browser'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(new Error(err.message || 'Location permission denied')),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });

  const invalidateMapCaches = () => {
    globalMutate(
      (key) => typeof key === 'string' && (
        key.startsWith('/api/v1/users/map') ||
        key.startsWith('/api/v1/nearby') ||
        key.startsWith('/api/v1/profiles') ||
        key.startsWith('/api/v1/search')
      ),
      undefined,
      { revalidate: true },
    );
  };

  const refreshLocation = async (opts: { silent?: boolean } = {}) => {
    if (refreshingLocation) return;
    if (!opts.silent) {
      setRefreshingLocation(true);
      setLocationError(null);
      setLocationNotice(null);
    }
    try {
      const { lat, lng } = await getBrowserLocation();
      const payload = { location_lat: lat, location_lng: lng };
      await patchMe(payload);
      mutateMe();
      invalidateMapCaches();
      if (!opts.silent) setLocationNotice('Location updated');
    } catch (err) {
      if (!opts.silent) setLocationError(err instanceof Error ? err.message : 'Unable to refresh location');
    } finally {
      if (!opts.silent) setRefreshingLocation(false);
    }
  };

  // Silent auto-refresh on mount if toggle is ON and permission already granted
  useEffect(() => {
    if (autoRefreshedRef.current) return;
    if (!isAuthed || !meData?.data) return;
    if (locationSharing === 'off') return;
    if (typeof navigator === 'undefined' || !navigator.permissions) return;
    autoRefreshedRef.current = true;
    navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
      if (result.state === 'granted') refreshLocation({ silent: true });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, meData?.data, locationSharing]);

  const AUDIENCE_TO_SHARING: Record<string, string> = {
    everyone: 'approximate', friends: 'friends', circles: 'circles', specific: 'specific', off: 'off',
  };

  const changeAudience = async (next: 'off' | 'everyone' | 'friends' | 'circles' | 'specific') => {
    if (savingLocation) return;
    setSavingLocation(true);
    setLocationError(null);
    setLocationNotice(null);
    const prevData = meData;

    if (next === 'off') {
      const payload = { location_sharing: 'off', location_lat: null, location_lng: null, location_shared_until: null };
      mutateMe({ ...meData, data: { ...(meData?.data || {}), ...payload } }, false);
      try {
        await patchMe(payload);
        mutateMe();
        invalidateMapCaches();
      } catch (err) {
        mutateMe(prevData, false);
        setLocationError(err instanceof Error ? err.message : 'Failed to hide location');
      } finally {
        setSavingLocation(false);
      }
      return;
    }

    const nextSharing = AUDIENCE_TO_SHARING[next];
    const wasOff = locationSharing === 'off';

    try {
      let payload: Record<string, unknown>;
      if (wasOff) {
        const { lat, lng } = await getBrowserLocation();
        const until = new Date(Date.now() + 86400 * 1000).toISOString();
        payload = { location_sharing: nextSharing, location_lat: lat, location_lng: lng, location_shared_until: until };
      } else {
        payload = { location_sharing: nextSharing };
      }
      mutateMe({ ...meData, data: { ...(meData?.data || {}), ...payload } }, false);
      try {
        await patchMe(payload);
        mutateMe();
        invalidateMapCaches();
      } catch (err) {
        mutateMe(prevData, false);
        setLocationError(err instanceof Error ? err.message : 'Failed to update audience');
      }
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Unable to get your location');
    } finally {
      setSavingLocation(false);
    }
  };

  const changeDuration = async (seconds: number) => {
    if (savingLocation) return;
    setSavingLocation(true);
    setLocationError(null);
    setLocationNotice(null);
    const prevData = meData;
    const until = seconds === 0 ? null : new Date(Date.now() + seconds * 1000).toISOString();
    const payload = { location_shared_until: until };
    mutateMe({ ...meData, data: { ...(meData?.data || {}), ...payload } }, false);
    try {
      await patchMe(payload);
      mutateMe();
      invalidateMapCaches();
    } catch (err) {
      mutateMe(prevData, false);
      setLocationError(err instanceof Error ? err.message : 'Failed to update duration');
    } finally {
      setSavingLocation(false);
    }
  };
  const signalsCount = signalsData?.data?.length || 0;
  const savedCount = savedData?.data?.length || 0;
  const bookingsCount = bookingsData?.data?.length || 0;
  const pendingBookings = (bookingsData?.data || []).filter((b: Record<string, unknown>) => b.status === 'pending' || b.status === 'confirmed').length;
  const upcomingEvents = (bookingsData?.data || []).filter((b: Record<string, unknown>) => b.event_id && (b.status === 'pending' || b.status === 'confirmed') && b.slot_time && new Date(b.slot_time as string) > new Date()).length;
  const followingCount = followsData?.data?.length || 0;
  const followersCount = followersData?.data?.length || 0;
  const circlesCount = circlesData?.data?.length || 0;
  const unreadNotifs = (notifsData?.data || []).filter((n: Record<string, unknown>) => !n.read).length;

  return (
    <div className="h-full overflow-y-auto relative">
      <div className="aurora-gradient absolute inset-x-0 top-0 h-48 pointer-events-none" />

      {/* ══ MOBILE ════════════════════════════════════════ */}
      <div className="lg:hidden relative max-w-lg mx-auto px-4 pt-[calc(env(safe-area-inset-top,44px)+16px)] pb-24">

        {/* Profile header */}
        <div className="flex items-start gap-4 mb-5">
          <div className="h-16 w-16 rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ background: '#111318', border: '2px solid rgba(0,212,255,0.2)' }}>
            {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" /> : <span className="text-2xl text-[#4a5068]">👤</span>}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-lg font-bold text-white truncate">{displayName}</h1>
            {isAuthed && <TrustLevelPill level={user?.role === 'normal' ? 'verified' : 'new'} score={0} size="sm" />}
            {username && <p className="text-[10px] text-[#4a5068] mt-0.5">Gao ID: @{username}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push('/me/profile')} className="h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Settings size={14} className="text-[#4a5068]" />
            </button>
            <button className="h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <QrCode size={14} className="text-[#4a5068]" />
            </button>
          </div>
        </div>

        {/* Edit Profile */}
        <button
          onClick={() => router.push('/me/edit')}
          className="w-full rounded-xl py-2.5 text-xs font-semibold cursor-pointer mb-4"
          style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', color: '#00d4ff' }}
        >
          Edit Profile
        </button>

        {/* Photos */}
        {userPhotos.length > 0 && (
          <div className="mb-4">
            <SectionTitle>Photos</SectionTitle>
            <div className="grid grid-cols-4 gap-1.5 rounded-2xl overflow-hidden">
              {userPhotos.map((url, i) => (
                <div key={i} className="aspect-square overflow-hidden">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trust + Stats */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-[#4a5068]">Trust Level</span>
            <TrustLevelPill level="verified" score={0} size="sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatMini value="0" label="Proofs" />
            <StatMini value={`${bookingsCount}`} label="Bookings" />
            <StatMini value="0" label="Events" />
          </div>
        </div>

        {/* My Network */}
        <SectionTitle>My Network</SectionTitle>
        <div className="grid grid-cols-4 gap-2 mb-5">
          <NetworkMini icon={<Users size={16} />} value={`${followersCount}`} label="Followers" color="#a78bfa" onClick={() => router.push('/me/followers')} />
          <NetworkMini icon={<UserCheck size={16} />} value={`${followingCount}`} label="Following" color="#34d399" onClick={() => router.push('/me/following')} />
          <NetworkMini icon={<Users size={16} />} value={`${circlesCount}`} label="Circles" color="#00d4ff" onClick={() => router.push('/circles')} />
          <NetworkMini icon={<Bookmark size={16} />} value={`${savedCount}`} label="Saved" color="#fbbf24" onClick={() => router.push('/me/saved')} />
        </div>

        {/* My Activities */}
        <SectionTitle>My Activities</SectionTitle>
        <div className="rounded-2xl overflow-hidden mb-5" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <ActivityRow icon={<Calendar size={16} />} label="Upcoming Events" value={`${upcomingEvents}`} href="/me/bookings" onClick={() => router.push('/me/bookings')} />
          <ActivityRow icon={<CalendarCheck size={16} />} label="My Bookings" value={`${pendingBookings} pending`} href="/me/bookings" onClick={() => router.push('/me/bookings')} />
          <ActivityRow icon={<Signal size={16} />} label="My Signals" value={`${signalsCount}`} href="#" onClick={() => router.push('/me/signals')} />
          <ActivityRow icon={<span className="text-base">🪦</span>} label="Time Capsules" value="Bury memories" href="/me/capsules" onClick={() => router.push('/me/capsules')} />
          <ActivityRow icon={<MapPin size={16} />} label="My Trips" value="Share itineraries" href="/me/trips" onClick={() => router.push('/me/trips')} />
          <ActivityRow icon={<MapPin size={16} />} label="Discover Trips" value="Browse what others did" href="/trips" onClick={() => router.push('/trips')} />
          <ActivityRow icon={<Star size={16} />} label="Reviews & Proofs" value="0" href="#" onClick={() => {}} />
          <ActivityRow icon={<Gift size={16} />} label="My Wallet" value="Claimed gift cards" href="/me/wallet" onClick={() => router.push('/me/wallet')} />
          <ActivityRow icon={<ShoppingBag size={16} />} label="Gift Card Market" value="Browse & claim cards" href="/gift-cards/market" onClick={() => router.push('/gift-cards/market')} last />
        </div>

        {/* Gao ID — additive canonical identity layer. Renders null when
            NEXT_PUBLIC_GAO_ID_ENABLED !== 'true' so bootstrap-only users
            see no change. Bootstrap (Google / Apple) login above is
            untouched. */}
        <GaoIdAccountSection />

        {/* Manage */}
        <SectionTitle>Manage</SectionTitle>
        <div className="rounded-2xl overflow-hidden mb-5" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <ActivityRow icon={<UserCheck size={16} />} label="Professional Profile" href="/me/profile" onClick={() => router.push('/me/profile')} />
          <ActivityRow icon={<Store size={16} />} label="My Business" href="/me/business" onClick={() => router.push('/me/business')} />
          <ActivityRow icon={<Gift size={16} />} label="Gift Cards" value="Drops & vouchers" href="/me/gift-cards" onClick={() => router.push('/me/gift-cards')} />
          <ActivityRow icon={<ShieldCheck size={16} />} label="Marketplace Access" value="Apply to list on market" href="/me/marketplace" onClick={() => router.push('/me/marketplace')} />
          <ActivityRow icon={<Calendar size={16} />} label="Create Event" href="/me/events" onClick={() => router.push('/me/events')} />
          <ActivityRow
            icon={<Megaphone size={16} />}
            label="Promote Template"
            value="Drag-drop builder"
            href={hasBusiness ? '/me/business/promo' : '/me/business'}
            onClick={() => {
              if (!hasBusiness) {
                toast.message('Set up your business first', {
                  description: 'Promote Template lives on your business page. Create or claim a business, then come back.',
                });
                router.push('/me/business');
                return;
              }
              router.push('/me/business/promo');
            }}
          />
          <ActivityRow icon={<Bot size={16} />} label="My Agents" href="#" onClick={() => {}} last />
        </div>

        {/* Admin — only rendered when users.is_admin = 1 */}
        {isAdmin && (
          <>
            <SectionTitle>Admin</SectionTitle>
            <div className="rounded-2xl overflow-hidden mb-5" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)' }}>
              <ActivityRow
                icon={<ShieldCheck size={16} />}
                label="Marketplace Applications"
                value="Review pending merchants"
                href="/admin/marketplace"
                onClick={() => router.push('/admin/marketplace')}
                last
              />
            </div>
          </>
        )}

        {/* Privacy */}
        {isAuthed && (
          <>
            <SectionTitle>Privacy</SectionTitle>
            <div className="rounded-2xl overflow-hidden mb-5" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <LocationVisibilityPanel
                audience={audience}
                durationValue={currentDurationValue}
                durationOptions={DURATION_PRESETS}
                saving={savingLocation}
                refreshing={refreshingLocation}
                onChangeAudience={changeAudience}
                onChangeDuration={changeDuration}
                onRefresh={() => refreshLocation({})}
              />
            </div>
            {locationError && <p className="text-[11px] text-[#f87171] mb-4 px-1">{locationError}</p>}
            {locationNotice && !locationError && <p className="text-[11px] text-[#34d399] mb-4 px-1">{locationNotice}</p>}
          </>
        )}

        {/* Shortcuts */}
        <SectionTitle>Shortcuts</SectionTitle>
        <div className="grid grid-cols-4 gap-2 mb-6">
          <ShortcutBtn icon={<Settings size={18} />} label="Settings" />
          <ShortcutBtn icon={<HelpCircle size={18} />} label="Help Center" />
          <ShortcutBtn icon={<Globe size={18} />} label="Gao Domain" />
          <ShortcutBtn icon={<Bell size={18} />} label="Notifications" onClick={() => router.push('/notifications')} />
        </div>

        {/* Logout — mobile only */}
        {isAuthed && (
          <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm text-[#f87171] cursor-pointer mb-6" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)' }}>
            <LogOut size={16} /> Sign Out
          </button>
        )}

      </div>

      {/* ══ DESKTOP ═══════════════════════════════════════ */}
      <div className="hidden lg:block relative max-w-5xl mx-auto px-8 pt-6 pb-24">
        <div className="flex gap-8 mt-2">

          {/* Left: Profile card */}
          <div className="w-[320px] shrink-0 space-y-4">
            <div className="rounded-2xl p-6" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex flex-col items-center text-center mb-5">
                <div className="h-20 w-20 rounded-full flex items-center justify-center overflow-hidden mb-3" style={{ background: '#111318', border: '2.5px solid rgba(0,212,255,0.25)' }}>
                  {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" /> : <span className="text-3xl text-[#4a5068]">👤</span>}
                </div>
                <h1 className="text-lg font-bold text-white">{displayName}</h1>
                {isAuthed && <TrustLevelPill level="verified" score={0} size="sm" />}
                {username && <p className="text-[10px] text-[#4a5068] mt-1">Gao ID: @{username}</p>}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <StatMini value="0" label="Proofs" />
                <StatMini value={`${bookingsCount}`} label="Bookings" />
                <StatMini value="0" label="Events" />
              </div>

              {/* Network */}
              <div className="grid grid-cols-4 gap-2">
                <NetworkMini icon={<Users size={14} />} value={`${followersCount}`} label="Followers" color="#a78bfa" onClick={() => router.push('/me/followers')} />
                <NetworkMini icon={<UserCheck size={14} />} value={`${followingCount}`} label="Following" color="#34d399" onClick={() => router.push('/me/following')} />
                <NetworkMini icon={<Users size={14} />} value={`${circlesCount}`} label="Circles" color="#00d4ff" onClick={() => router.push('/circles')} />
                <NetworkMini icon={<Bookmark size={14} />} value={`${savedCount}`} label="Saved" color="#fbbf24" onClick={() => router.push('/me/saved')} />
              </div>

              {/* Edit Profile */}
              <button
                onClick={() => router.push('/me/edit')}
                className="w-full rounded-xl py-2.5 text-xs font-semibold cursor-pointer mt-3"
                style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', color: '#00d4ff' }}
              >
                Edit Profile
              </button>
            </div>

            {/* Photos */}
            {userPhotos.length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-3">Photos</h3>
                <div className="grid grid-cols-2 gap-2">
                  {userPhotos.map((url, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shortcuts */}
            <div className="rounded-2xl p-4" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-3">Shortcuts</h3>
              <div className="grid grid-cols-2 gap-2">
                <ShortcutBtn icon={<Settings size={16} />} label="Settings" />
                <ShortcutBtn icon={<HelpCircle size={16} />} label="Help" />
                <ShortcutBtn icon={<Globe size={16} />} label="Domain" />
                <ShortcutBtn icon={<Bell size={16} />} label="Alerts" onClick={() => router.push('/notifications')} />
              </div>
            </div>

          </div>

          {/* Right: Activities + Manage */}
          <div className="flex-1 min-w-0 space-y-5">
            <div>
              <SectionTitle>My Activities</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <ActivityCard icon={<Calendar size={18} />} label="Upcoming Events" value={`${upcomingEvents} upcoming`} color="#f87171" onClick={() => router.push('/me/bookings')} />
                <ActivityCard icon={<CalendarCheck size={18} />} label="My Bookings" value={`${pendingBookings} pending`} color="#00d4ff" onClick={() => router.push('/me/bookings')} />
                <ActivityCard icon={<Signal size={18} />} label="My Signals" value={`${signalsCount} active`} color="#3B82F6" onClick={() => router.push('/me/signals')} />
                <ActivityCard icon={<span className="text-lg leading-none">🪦</span>} label="Time Capsules" value="Bury memories" color="#94a3b8" onClick={() => router.push('/me/capsules')} />
                <ActivityCard icon={<MapPin size={18} />} label="My Trips" value="Share itineraries" color="#a855f7" onClick={() => router.push('/me/trips')} />
                <ActivityCard icon={<MapPin size={18} />} label="Discover Trips" value="Browse what others did" color="#a855f7" onClick={() => router.push('/trips')} />
                <ActivityCard icon={<Star size={18} />} label="Reviews & Proofs" value="0" color="#fbbf24" onClick={() => {}} />
                <ActivityCard icon={<Gift size={18} />} label="My Wallet" value="Claimed gift cards" color="#00d4ff" onClick={() => router.push('/me/wallet')} />
                <ActivityCard icon={<ShoppingBag size={18} />} label="Gift Card Market" value="Browse & claim cards" color="#ec4899" onClick={() => router.push('/gift-cards/market')} />
                <ActivityCard icon={<Award size={18} />} label="Trust & Badges" value="Build reputation" color="#34d399" onClick={() => {}} />
              </div>
            </div>

            <div>
              <SectionTitle>Manage</SectionTitle>
              <div className="grid grid-cols-3 gap-3">
                <ManageCard icon={<UserCheck size={20} />} label="Professional Profile" sub="Edit your CV" href="/me/profile" onClick={() => router.push('/me/profile')} />
                <ManageCard icon={<Store size={20} />} label="My Business" sub="Manage your store" href="/me/business" onClick={() => router.push('/me/business')} />
                <ManageCard icon={<Gift size={20} />} label="Gift Cards" sub="Drops & vouchers" href="/me/gift-cards" onClick={() => router.push('/me/gift-cards')} />
                <ManageCard icon={<ShieldCheck size={20} />} label="Marketplace Access" sub="Apply to list on market" href="/me/marketplace" onClick={() => router.push('/me/marketplace')} />
                <ManageCard icon={<Calendar size={20} />} label="Create Event" sub="Host an event" href="/me/events" onClick={() => router.push('/me/events')} />
                <ManageCard
                  icon={<Megaphone size={20} />}
                  label="Promote Template"
                  sub={hasBusiness ? 'Drag-drop campaigns' : 'Needs a business'}
                  href={hasBusiness ? '/me/business/promo' : '/me/business'}
                  onClick={() => {
                    if (!hasBusiness) {
                      toast.message('Set up your business first', {
                        description: 'Promote Template lives on your business page.',
                      });
                      router.push('/me/business');
                      return;
                    }
                    router.push('/me/business/promo');
                  }}
                />
              </div>
            </div>

            {isAdmin && (
              <div>
                <SectionTitle>Admin</SectionTitle>
                <div className="grid grid-cols-3 gap-3">
                  <ManageCard
                    icon={<ShieldCheck size={20} />}
                    label="Marketplace Applications"
                    sub="Review pending merchants"
                    href="/admin/marketplace"
                    onClick={() => router.push('/admin/marketplace')}
                  />
                </div>
              </div>
            )}

            {isAuthed && (
              <div>
                <SectionTitle>Privacy</SectionTitle>
                <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <LocationVisibilityPanel
                    audience={audience}
                    durationValue={currentDurationValue}
                    durationOptions={DURATION_PRESETS}
                    saving={savingLocation}
                    refreshing={refreshingLocation}
                    onChangeAudience={changeAudience}
                    onChangeDuration={changeDuration}
                    onRefresh={() => refreshLocation({})}
                  />
                </div>
                {locationError && <p className="text-[11px] text-[#f87171] mt-2 px-1">{locationError}</p>}
                {locationNotice && !locationError && <p className="text-[11px] text-[#34d399] mt-2 px-1">{locationNotice}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-2">{children}</h2>;
}

function StatMini({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center rounded-xl py-2" style={{ background: 'rgba(10,11,15,0.4)' }}>
      <p className="text-base font-bold text-white">{value}</p>
      <p className="text-[9px] text-[#4a5068]">{label}</p>
    </div>
  );
}

function NetworkMini({ icon, value, label, color, onClick }: { icon: React.ReactNode; value: string; label: string; color: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 rounded-xl py-2.5 cursor-pointer transition-colors hover:bg-white/[0.03] w-full" style={{ background: `${color}08` }}>
      <span style={{ color }}>{icon}</span>
      <p className="text-sm font-bold text-white">{value}</p>
      <p className="text-[9px] text-[#4a5068]">{label}</p>
    </button>
  );
}

function ActivityRow({ icon, label, value, last, onClick }: { icon: React.ReactNode; label: string; value?: string; href: string; last?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors hover:bg-white/[0.02]" style={{ borderBottom: last ? undefined : '1px solid rgba(255,255,255,0.03)' }}>
      <span className="text-[#4a5068]">{icon}</span>
      <span className="flex-1 text-sm text-white">{label}</span>
      {value && <span className="text-[11px] text-[#4a5068]">{value}</span>}
      <ChevronRight size={14} className="text-[#4a5068]" />
    </button>
  );
}

function ActivityCard({ icon, label, value, color, onClick }: { icon: React.ReactNode; label: string; value: string; color: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className="rounded-xl p-4 cursor-pointer transition-colors hover:bg-white/[0.02]" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: `${color}12`, color }}>{icon}</div>
        <p className="text-sm font-semibold text-white">{label}</p>
      </div>
      <p className="text-xs text-[#4a5068]">{value}</p>
    </div>
  );
}

function ManageCard({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; href: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 rounded-xl p-5 text-center cursor-pointer transition-colors hover:bg-white/[0.02]" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>{icon}</div>
      <p className="text-xs font-semibold text-white">{label}</p>
      <p className="text-[10px] text-[#4a5068]">{sub}</p>
    </button>
  );
}

type Audience = 'off' | 'everyone' | 'friends' | 'circles' | 'specific';

function LocationVisibilityPanel({
  audience, durationValue, durationOptions, saving, refreshing,
  onChangeAudience, onChangeDuration, onRefresh,
}: {
  audience: Audience;
  durationValue: number;
  durationOptions: { value: number; label: string }[];
  saving: boolean;
  refreshing: boolean;
  onChangeAudience: (a: Audience) => void;
  onChangeDuration: (s: number) => void;
  onRefresh: () => void;
}) {
  const visible = audience !== 'off';
  const audienceLabel =
    audience === 'friends' ? 'Friends only'
    : audience === 'circles' ? 'My Circles'
    : audience === 'specific' ? 'Specific people'
    : 'Everyone';
  const durationLabel = durationOptions.find(d => d.value === durationValue)?.label || 'Until I turn off';
  const subtitle = saving
    ? (visible ? 'Updating…' : 'Getting your location…')
    : refreshing ? 'Updating your location…'
    : (visible ? `Visible to ${audienceLabel.toLowerCase()} · ${durationLabel.toLowerCase()}` : 'Turn on to share your current location');
  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3">
        <span style={{ color: visible ? '#00d4ff' : '#4a5068' }}>
          {visible ? <Eye size={16} /> : <EyeOff size={16} />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white">Location on map</p>
          <p className="text-[11px] text-[#4a5068] truncate">{subtitle}</p>
        </div>
        {visible && (
          <button
            onClick={onRefresh}
            disabled={saving || refreshing}
            aria-label="Update my location"
            title="Update my location"
            className="h-7 w-7 rounded-full flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-60"
            style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.18)', color: '#00d4ff' }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          </button>
        )}
        <button
          onClick={() => onChangeAudience(visible ? 'off' : 'everyone')}
          disabled={saving || refreshing}
          aria-pressed={visible}
          aria-label="Toggle location visibility"
          className="h-7 w-12 rounded-full transition-colors cursor-pointer shrink-0 flex items-center p-0.5 disabled:opacity-60"
          style={{ background: visible ? '#00d4ff' : 'rgba(255,255,255,0.12)' }}
        >
          <span
            className="h-6 w-6 rounded-full bg-white transition-transform"
            style={{
              transform: visible ? 'translateX(20px)' : 'translateX(0)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          />
        </button>
      </div>
      {visible && (
        <>
          <PanelSelectRow
            icon={<Users size={14} />}
            label="Visible to"
            value={audience}
            disabled={saving || refreshing}
            onChange={(v) => onChangeAudience(v as Audience)}
            options={[
              { value: 'everyone', label: 'Everyone' },
              { value: 'friends', label: 'Friends only' },
              { value: 'circles', label: 'My Circles' },
              { value: 'specific', label: 'Specific people' },
            ]}
          />
          {/* Specific-people manager — only renders when that audience
              is picked. Lets the user hand-pick the recipients. */}
          {audience === 'specific' && <SpecificShareList disabled={saving || refreshing} />}
          <PanelSelectRow
            icon={<Clock size={14} />}
            label="Expires in"
            value={String(durationValue)}
            disabled={saving || refreshing}
            onChange={(v) => onChangeDuration(Number(v))}
            options={durationOptions.map(o => ({ value: String(o.value), label: o.label }))}
          />
        </>
      )}
    </div>
  );
}

// Maps an API error code (or message) coming back from the
// /location-shares endpoints to a friendly toast string. Falls back to
// a generic message so the user always gets feedback.
function friendlyShareError(
  payload: { error?: { code?: string; message?: string } } | undefined,
  action: 'add' | 'remove',
): string {
  const code = payload?.error?.code;
  switch (code) {
    case 'self_share':
      return "You can't share your location with yourself.";
    case 'recipient_not_found':
      return "We couldn't find that user.";
    case 'unauthorized':
      return 'Please sign in again.';
    case 'invalid_request':
      return 'Missing recipient — please pick someone from the list.';
    default:
      return action === 'add'
        ? "Couldn't add that person — please try again."
        : "Couldn't remove that person — please try again.";
  }
}

// Specific-share manager — renders the list of users the caller has
// hand-picked + a search picker to add more. State lives entirely here
// because it's only needed when the "Specific people" audience is
// selected; LocationPanel still owns the audience choice.
interface ShareRow {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

function SpecificShareList({ disabled }: { disabled: boolean }) {
  const { data, mutate } = useSWR<{ data: ShareRow[] }>(
    '/api/v1/users/me/location-shares',
    fetcher,
    { revalidateOnFocus: true },
  );
  const shares = data?.data || [];
  const [pickerOpen, setPickerOpen] = useState(false);

  const removeShare = async (recipientId: string, label: string) => {
    // Optimistic — drop the chip immediately, restore on failure.
    const prev = data?.data || [];
    mutate({ data: prev.filter((s) => s.id !== recipientId) }, false);
    try {
      const res = await fetch(`/api/v1/users/me/location-shares/${encodeURIComponent(recipientId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        mutate({ data: prev }, false);
        toast.error(friendlyShareError(json, 'remove'));
        return;
      }
      toast.success(`Stopped sharing with ${label}`);
      mutate();
    } catch {
      mutate({ data: prev }, false);
      toast.error("Couldn't remove — please check your connection.");
    }
  };

  return (
    <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="text-[#4a5068] mt-1"><Users size={14} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-white mb-2">Shared with</p>
          {shares.length === 0 ? (
            <p className="text-[11px] text-[#4a5068]">No one yet — tap “Add” to pick people.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {shares.map((s) => {
                const label = s.display_name || (s.username ? `@${s.username}` : 'User');
                return (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-1"
                    style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.18)' }}
                  >
                    {s.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.avatar_url} alt="" className="h-4 w-4 rounded-full object-cover" />
                    ) : (
                      <span className="h-4 w-4 rounded-full text-[8px] flex items-center justify-center font-bold"
                        style={{ background: '#5b8def', color: 'white' }}
                      >
                        {label.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="text-[11px] text-white truncate max-w-[120px]">{label}</span>
                    <button
                      onClick={() => removeShare(s.id, label)}
                      disabled={disabled}
                      aria-label={`Remove ${label}`}
                      className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full cursor-pointer disabled:opacity-50"
                      style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
                    >
                      <XIcon size={9} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <button
          onClick={() => setPickerOpen(true)}
          disabled={disabled}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold cursor-pointer disabled:opacity-60"
          style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {pickerOpen && (
        <SpecificSharePicker
          existingIds={new Set(shares.map((s) => s.id))}
          onClose={() => setPickerOpen(false)}
          onAdded={() => mutate()}
        />
      )}
    </div>
  );
}

// User search modal — reuses the unified /api/v1/search?tab=people
// endpoint with debounced typing. Tapping a result POSTs them to
// /me/location-shares and closes the sheet.
function SpecificSharePicker({
  existingIds,
  onClose,
  onAdded,
}: {
  existingIds: Set<string>;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; title: string; subtitle?: string; image?: string | null }>>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}&tab=people&limit=12`, { credentials: 'same-origin' });
        const json = await res.json();
        setResults((json?.data?.people || []) as typeof results);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const addRecipient = async (id: string, label: string) => {
    if (existingIds.has(id) || adding) return;
    setAdding(id);
    try {
      const res = await fetch('/api/v1/users/me/location-shares', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_user_id: id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(friendlyShareError(json, 'add'));
        return;
      }
      toast.success(`Sharing location with ${label}`);
      onAdded();
      onClose();
    } catch {
      toast.error("Couldn't add — please check your connection.");
    } finally {
      setAdding(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center px-3 sm:px-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #14161f 0%, #0a0b0f 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-base font-black text-white">Share location with</h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full cursor-pointer hover:bg-white/5"
            aria-label="Close"
          >
            <XIcon size={16} className="text-white/70" />
          </button>
        </div>
        <div className="px-5 pb-5">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Search size={14} className="text-white/45" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or @username"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
            />
          </div>
          <div className="mt-3 max-h-72 overflow-y-auto rounded-xl"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
          >
            {results.length === 0 && !searching && query.trim() && (
              <p className="px-4 py-6 text-center text-xs text-white/45">No one found.</p>
            )}
            {results.length === 0 && !query.trim() && (
              <p className="px-4 py-6 text-center text-xs text-white/35">Type to find a friend</p>
            )}
            {results.map((p) => {
              const already = existingIds.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => addRecipient(p.id, p.title)}
                  disabled={already || adding === p.id}
                  className="flex w-full items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: '#5b8def', color: 'white' }}
                    >
                      {p.title.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="flex flex-col items-start text-left min-w-0 flex-1">
                    <span className="truncate text-sm font-semibold text-white">{p.title}</span>
                    {p.subtitle && (
                      <span className="truncate text-[11px] text-white/45">{p.subtitle}</span>
                    )}
                  </div>
                  {already && (
                    <span className="text-[10px] uppercase tracking-wider text-[#00d4ff]/80 shrink-0">Added</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelSelectRow({ icon, label, value, options, disabled, onChange }: {
  icon: React.ReactNode; label: string; value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
      <span className="text-[#4a5068]">{icon}</span>
      <span className="text-[13px] text-white flex-1">{label}</span>
      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none rounded-lg py-1.5 pl-3 pr-7 text-[12px] text-white cursor-pointer disabled:opacity-60"
          style={{ background: 'rgba(10,11,15,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {options.map(o => (
            <option key={o.value} value={o.value} className="bg-[#0a0b0f]">{o.label}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#4a5068]">▾</span>
      </div>
    </div>
  );
}

function ShortcutBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className="flex flex-col items-center gap-1.5 rounded-xl py-3 cursor-pointer transition-colors hover:bg-white/[0.02]" style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}>
      <span className="text-[#4a5068]">{icon}</span>
      <span className="text-[9px] font-medium text-[#a3adc3]">{label}</span>
    </div>
  );
}
