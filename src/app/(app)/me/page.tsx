'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAuthStore } from '@/stores/auth-store';
import TrustLevelPill from '@/components/trust/TrustLevelPill';
import {
  MapPin, CalendarCheck, Bot, Bookmark, Shield, Settings, LogOut,
  UserCheck, Store, Calendar, Users, Star, ChevronRight, QrCode,
  HelpCircle, Globe, Bell, Wallet, Award, Signal,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, {
  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
}).then(r => r.json());

export default function MePage() {
  const router = useRouter();
  const { user, isAuthed, logout } = useAuthStore();

  const handleLogout = () => { logout(); router.push('/world'); };

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
  const { data: meData } = useSWR(isAuthed ? '/api/v1/users/me' : null, fetcher, swrOpts);
  const userPhotos: string[] = meData?.data?.photos || [];
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
          <ActivityRow icon={<Star size={16} />} label="Reviews & Proofs" value="0" href="#" onClick={() => {}} />
          <ActivityRow icon={<Wallet size={16} />} label="Wallet & Rewards" value="0 Gao Points" href="#" onClick={() => {}} last />
        </div>

        {/* Manage */}
        <SectionTitle>Manage</SectionTitle>
        <div className="rounded-2xl overflow-hidden mb-5" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <ActivityRow icon={<UserCheck size={16} />} label="Professional Profile" href="/me/profile" onClick={() => router.push('/me/profile')} />
          <ActivityRow icon={<Store size={16} />} label="My Business" href="/me/business" onClick={() => router.push('/me/business')} />
          <ActivityRow icon={<Calendar size={16} />} label="Create Event" href="/me/events" onClick={() => router.push('/me/events')} />
          <ActivityRow icon={<Bot size={16} />} label="My Agents" href="#" onClick={() => {}} last />
        </div>

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

function ShortcutBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className="flex flex-col items-center gap-1.5 rounded-xl py-3 cursor-pointer transition-colors hover:bg-white/[0.02]" style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}>
      <span className="text-[#4a5068]">{icon}</span>
      <span className="text-[9px] font-medium text-[#a3adc3]">{label}</span>
    </div>
  );
}
