'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import { useAuthStore } from '@/stores/auth-store';
import { secureFetch } from '@/lib/fetch';
import TrustLevelPill from '@/components/trust/TrustLevelPill';
import GaoIdAccountSection from '@/components/auth/GaoIdAccountSection';
import {
  MapPin, CalendarCheck, Bot, Bookmark, Shield, Settings, LogOut,
  UserCheck, Store, Calendar, Users, Star, ChevronRight, QrCode,
  HelpCircle, Globe, Bell, Wallet, Award, Signal, Eye, EyeOff, RefreshCw, Clock,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, {
  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
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

    // Client-side cleanup
    document.cookie = 'gao_logged_in=; Max-Age=0; path=/';
    document.cookie = 'gao_csrf=; Max-Age=0; path=/';
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
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
  const userPhotos: string[] = meData?.data?.photos || [];
  const locationSharing: string = meData?.data?.location_sharing || 'off';
  const locationSharedUntil: string | null = meData?.data?.location_shared_until || null;
  const locationVisible = locationSharing !== 'off';
  const audience: 'off' | 'everyone' | 'friends' | 'circles' =
    locationSharing === 'friends' ? 'friends'
    : locationSharing === 'circles' ? 'circles'
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
        Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}`,
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
    everyone: 'approximate', friends: 'friends', circles: 'circles', off: 'off',
  };

  const changeAudience = async (next: 'off' | 'everyone' | 'friends' | 'circles') => {
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
          <ActivityRow icon={<Star size={16} />} label="Reviews & Proofs" value="0" href="#" onClick={() => {}} />
          <ActivityRow icon={<Wallet size={16} />} label="Wallet & Rewards" value="0 Gao Points" href="#" onClick={() => {}} last />
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
          <ActivityRow icon={<Calendar size={16} />} label="Create Event" href="/me/events" onClick={() => router.push('/me/events')} />
          <ActivityRow icon={<Bot size={16} />} label="My Agents" href="#" onClick={() => {}} last />
        </div>

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
                <ActivityCard icon={<Star size={18} />} label="Reviews & Proofs" value="0" color="#fbbf24" onClick={() => {}} />
                <ActivityCard icon={<Wallet size={18} />} label="Wallet & Rewards" value="0 Gao Points" color="#a78bfa" onClick={() => {}} />
                <ActivityCard icon={<Award size={18} />} label="Trust & Badges" value="Build reputation" color="#34d399" onClick={() => {}} />
              </div>
            </div>

            <div>
              <SectionTitle>Manage</SectionTitle>
              <div className="grid grid-cols-3 gap-3">
                <ManageCard icon={<UserCheck size={20} />} label="Professional Profile" sub="Edit your CV" href="/me/profile" onClick={() => router.push('/me/profile')} />
                <ManageCard icon={<Store size={20} />} label="My Business" sub="Manage your store" href="/me/business" onClick={() => router.push('/me/business')} />
                <ManageCard icon={<Calendar size={20} />} label="Create Event" sub="Host an event" href="/me/events" onClick={() => router.push('/me/events')} />
              </div>
            </div>

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

type Audience = 'off' | 'everyone' | 'friends' | 'circles';

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
  const audienceLabel = audience === 'friends' ? 'Friends only' : audience === 'circles' ? 'My Circles' : 'Everyone';
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
            ]}
          />
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
