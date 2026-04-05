'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Calendar, Camera, Check, Globe, Loader2, Lock, LogOut, MapPin, Tag, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { useAuthStore } from '@/stores/auth-store';
import type { Circle, Event, Signal } from '@/types';

const fetcher = (url: string) => fetch(url, {
  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
}).then(r => r.json());

type Member = { user_id: string; display_name: string; username?: string; avatar_url?: string; role: string; status: string; joined_at: string; trust_level?: string; trust_score?: number; bio?: string };

function memberName(m: Member) { return m.display_name || m.username || 'Unknown user'; }

export default function CircleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const myUserId = useAuthStore(s => s.user?.id);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [mobileTab, setMobileTab] = useState<'feed' | 'members' | 'requests'>('feed');

  // ── Data ──
  const { data: circleData, mutate: mutateCircle } = useSWR<{ data: Circle & { my_role: string | null; my_status: string | null } }>(`/api/v1/circles/${id}`, fetcher);
  const circle = circleData?.data;

  const { data: membersData, mutate: mutateMembers } = useSWR<{ data: Member[] }>(`/api/v1/circles/${id}/members?status=active`, fetcher);
  const members = membersData?.data ?? [];

  const { data: pendingData, mutate: mutatePending } = useSWR<{ data: Member[] }>(
    circle?.my_role === 'owner' || circle?.my_role === 'admin' ? `/api/v1/circles/${id}/members?status=pending` : null, fetcher
  );
  const pendingMembers = pendingData?.data ?? [];

  const { data: eventsData } = useSWR<{ data: Event[] }>(`/api/v1/circles/${id}/events`, fetcher);
  const events = eventsData?.data ?? [];

  const { data: offersData } = useSWR<{ data: Signal[] }>(`/api/v1/circles/${id}/offers`, fetcher);
  const offers = offersData?.data ?? [];

  const isOwner = circle?.my_role === 'owner' || circle?.my_role === 'admin';

  // Auto-switch to requests tab on mobile if pending
  useEffect(() => {
    if (pendingMembers.length > 0 && mobileTab === 'feed') setMobileTab('requests');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMembers.length]);

  // ── Handlers ──
  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = localStorage.getItem('access_token');
    if (!token) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', 'circles');
      const uploadRes = await fetch('/api/v1/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error?.message || 'Upload failed');
      const patchRes = await fetch(`/api/v1/circles/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ avatar_url: uploadData.data?.url }) });
      if (patchRes.ok) { toast.success('Avatar updated!'); mutateCircle(); }
    } catch { toast.error('Failed to upload'); }
    finally { setUploading(false); }
  }, [id, mutateCircle]);

  const handleMemberAction = async (memberUserId: string, action: 'approve' | 'reject') => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    setActioningId(memberUserId);
    try {
      const res = await fetch(`/api/v1/circles/${id}/members`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ member_user_id: memberUserId, action }) });
      if (res.ok) { toast.success(action === 'approve' ? 'Approved!' : 'Rejected'); mutatePending(); mutateMembers(); mutateCircle(); }
      else { const d = await res.json(); toast.error(d.error?.message || 'Failed'); }
    } catch { toast.error('Network error'); }
    finally { setActioningId(null); }
  };

  const handleJoin = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) { toast.error('Please login first'); return; }
    try {
      const res = await fetch(`/api/v1/circles/${id}/join`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) { toast.success(d.data?.joined ? 'Joined!' : 'Request sent!'); mutateCircle(); mutateMembers(); }
      else toast.error(d.error?.message || 'Failed');
    } catch { toast.error('Network error'); }
  };

  const handleLeave = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/circles/${id}/leave`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { toast.success('Left circle'); mutateCircle(); mutateMembers(); }
    } catch { toast.error('Network error'); }
  };

  if (!circle) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#00d4ff]" /></div>;

  // ── Shared sub-components ──
  const AvatarBlock = (
    <div className="relative shrink-0">
      <div className="h-20 w-20 lg:h-24 lg:w-24 rounded-2xl flex items-center justify-center text-2xl lg:text-3xl font-bold overflow-hidden" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '2px solid rgba(0,212,255,0.2)' }}>
        {circle.avatar_url ? <img src={circle.avatar_url} alt={circle.name} className="w-full h-full object-cover" /> : circle.name.charAt(0)}
      </div>
      {isOwner && (
        <>
          <button onClick={() => avatarInputRef.current?.click()} className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full flex items-center justify-center cursor-pointer" style={{ background: '#0a0b0f', border: '2px solid rgba(0,212,255,0.3)' }}>
            {uploading ? <Loader2 size={12} className="animate-spin text-[#00d4ff]" /> : <Camera size={12} className="text-[#00d4ff]" />}
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </>
      )}
    </div>
  );

  const ActionButtons = (
    <div className="flex items-center gap-2">
      {circle.my_status === 'active' ? (
        <>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-[#34d399]"><Check size={12} /> Joined</span>
          {circle.my_role !== 'owner' && (
            <button onClick={handleLeave} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-semibold cursor-pointer" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}><LogOut size={10} /> Leave</button>
          )}
        </>
      ) : circle.my_status === 'pending' ? (
        <>
          <span className="text-[11px] font-semibold text-[#EAB308]">Pending</span>
          <button onClick={handleLeave} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-semibold cursor-pointer" style={{ background: 'rgba(234,179,8,0.08)', color: '#EAB308' }}><X size={10} /> Cancel</button>
        </>
      ) : (
        <button onClick={handleJoin} className="flex items-center gap-1 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}><UserPlus size={12} /> Join</button>
      )}
    </div>
  );

  const MemberRow = ({ m, showActions }: { m: Member; showActions?: boolean }) => (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors hover:bg-white/[0.02]" style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.04)' }} onClick={() => setSelectedMember(m)}>
      <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold overflow-hidden" style={{ background: showActions ? 'rgba(234,179,8,0.1)' : 'rgba(0,212,255,0.1)', color: showActions ? '#EAB308' : '#00d4ff' }}>
        {m.avatar_url ? <img src={m.avatar_url} alt={memberName(m)} className="w-full h-full object-cover" /> : memberName(m).charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-white truncate">
          {m.user_id === myUserId ? 'You' : memberName(m)}
        </p>
        <p className="text-[9px] text-[#4a5068]">
          {m.role !== 'member' && <span className="capitalize text-[#00d4ff] mr-1">{m.role}</span>}
          {m.status === 'pending' ? 'Requested' : 'Joined'} {formatDistanceToNow(new Date(m.joined_at), { addSuffix: true })}
        </p>
      </div>
      {m.trust_level && m.trust_level !== 'new' && !showActions && (
        <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full capitalize" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>{m.trust_level}</span>
      )}
      {showActions && (
        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => handleMemberAction(m.user_id, 'approve')} disabled={actioningId === m.user_id} className="rounded-lg px-2 py-1 text-[9px] font-semibold cursor-pointer disabled:opacity-50" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>Accept</button>
          <button onClick={() => handleMemberAction(m.user_id, 'reject')} disabled={actioningId === m.user_id} className="rounded-lg px-2 py-1 text-[9px] font-semibold cursor-pointer disabled:opacity-50" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>Reject</button>
        </div>
      )}
    </div>
  );

  const EventItem = ({ evt }: { evt: Event }) => {
    const isLive = evt.status === 'live';
    const date = new Date(evt.start_time);
    return (
      <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="h-28 relative" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(167,139,250,0.08))' }}>
          {evt.images?.[0] && <img src={evt.images[0]} alt={evt.title} className="w-full h-full object-cover" />}
          <div className="absolute top-2 left-2">
            {isLive ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ background: '#EF4444' }}>LIVE</span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold" style={{ background: 'rgba(10,11,15,0.8)', color: '#f0f4ff' }}>{format(date, 'MMM d')}</span>
            )}
          </div>
        </div>
        <div className="p-3">
          <h4 className="text-sm font-semibold text-white truncate">{evt.title}</h4>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#4a5068]">
            <span className="flex items-center gap-0.5"><Calendar size={9} /> {format(date, 'HH:mm')}</span>
            {evt.location_name && <span className="flex items-center gap-0.5 truncate"><MapPin size={9} /> {evt.location_name}</span>}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[9px] text-[#4a5068]">{evt.joined_count}/{evt.capacity || '∞'} joined</span>
          </div>
        </div>
      </div>
    );
  };

  const OfferItem = ({ offer }: { offer: Signal }) => {
    const discount = (offer.metadata as Record<string, unknown>)?.discount_percent || (offer.metadata as Record<string, unknown>)?.discount;
    return (
      <div className="rounded-xl p-3" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(234,179,8,0.1)' }}>
        <div className="flex items-start gap-2.5">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(234,179,8,0.1)' }}>
            <Tag size={14} style={{ color: '#EAB308' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{offer.title}</p>
            {discount ? <p className="text-[11px] font-bold mt-0.5" style={{ color: '#EAB308' }}>{typeof discount === 'number' ? `${discount}% off` : String(discount)}</p> : null}
            <p className="text-[9px] text-[#4a5068] mt-1">Expires {formatDistanceToNow(new Date(offer.expires_at), { addSuffix: true })}</p>
          </div>
        </div>
      </div>
    );
  };

  const FeedContent = (
    <div className="space-y-6">
      {/* Events */}
      {events.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[#4a5068] uppercase tracking-wider mb-3"><Calendar size={11} className="inline mr-1" /> Upcoming Events</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {events.map(e => <EventItem key={e.id} evt={e} />)}
          </div>
        </div>
      )}
      {/* Offers */}
      {offers.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[#4a5068] uppercase tracking-wider mb-3"><Tag size={11} className="inline mr-1" /> Active Offers</h3>
          <div className="space-y-2">
            {offers.map(o => <OfferItem key={o.id} offer={o} />)}
          </div>
        </div>
      )}
      {events.length === 0 && offers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-[#4a5068]">No events or offers yet</p>
          <p className="text-[10px] text-[#2d3548] mt-1">Circle activity will appear here</p>
        </div>
      )}
    </div>
  );

  const MembersContent = (
    <div className="space-y-1.5">
      {members.length === 0 ? <p className="text-sm text-[#4a5068] text-center py-6">No members</p> : members.map(m => <MemberRow key={m.user_id} m={m} />)}
    </div>
  );

  const RequestsContent = (
    <div className="space-y-1.5">
      {pendingMembers.length === 0 ? <p className="text-sm text-[#4a5068] text-center py-6">No pending requests</p> : pendingMembers.map(m => <MemberRow key={m.user_id} m={m} showActions />)}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 lg:px-8 py-3" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => router.back()} className="text-[#a3adc3] cursor-pointer"><ArrowLeft size={18} /></button>
        <h1 className="text-sm font-bold text-white truncate">{circle.name}</h1>
        <span className="ml-auto text-[10px] text-[#4a5068]">{circle.member_count} members</span>
      </div>

      {/* ── Cover banner ── */}
      <div className="h-32 lg:h-44 relative" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(167,139,250,0.08), rgba(239,68,68,0.06))' }}>
        {circle.cover_image && <img src={circle.cover_image} alt="" className="w-full h-full object-cover" />}
      </div>

      {/* ── Mobile layout ── */}
      <div className="lg:hidden px-4 pb-24">
        {/* Hero */}
        <div className="flex items-end gap-3 -mt-10 mb-4">
          {AvatarBlock}
          <div className="flex-1 min-w-0 pb-1">
            <h2 className="text-lg font-bold text-white truncate">{circle.name}</h2>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>{circle.category}</span>
              {circle.visibility === 'private' ? <Lock size={9} className="text-[#4a5068]" /> : <Globe size={9} className="text-[#4a5068]" />}
              {circle.city && <span className="text-[9px] text-[#4a5068]"><MapPin size={8} className="inline" /> {circle.city}</span>}
            </div>
          </div>
        </div>
        {circle.description && <p className="text-xs text-[#a3adc3] mb-3 line-clamp-3">{circle.description}</p>}
        <div className="mb-4">{ActionButtons}</div>

        {/* Mobile tabs */}
        <div className="flex gap-0.5 mb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {(['feed', 'members', ...(isOwner ? ['requests'] : [])] as const).map(tab => (
            <button key={tab} onClick={() => setMobileTab(tab as typeof mobileTab)} className="px-3 py-2 text-[11px] font-semibold capitalize cursor-pointer" style={mobileTab === tab ? { color: tab === 'requests' ? '#EAB308' : '#00d4ff', borderBottom: `2px solid ${tab === 'requests' ? '#EAB308' : '#00d4ff'}` } : { color: '#4a5068' }}>
              {tab === 'feed' ? 'Feed' : tab === 'members' ? `Members (${members.length})` : `Requests${pendingMembers.length > 0 ? ` (${pendingMembers.length})` : ''}`}
            </button>
          ))}
        </div>
        {mobileTab === 'feed' && FeedContent}
        {mobileTab === 'members' && MembersContent}
        {mobileTab === 'requests' && isOwner && RequestsContent}
      </div>

      {/* ── Desktop layout: 2 columns ── */}
      <div className="hidden lg:block max-w-6xl mx-auto px-8 pb-24">
        {/* Hero row */}
        <div className="flex items-end gap-5 -mt-12 mb-6">
          {AvatarBlock}
          <div className="flex-1 min-w-0 pb-1">
            <h2 className="text-xl font-bold text-white">{circle.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>{circle.category}</span>
              {circle.visibility === 'private' ? <Lock size={10} className="text-[#4a5068]" /> : <Globe size={10} className="text-[#4a5068]" />}
              {circle.city && <span className="flex items-center gap-0.5 text-[10px] text-[#4a5068]"><MapPin size={9} /> {circle.city}</span>}
              <span className="text-[10px] text-[#4a5068]"><Users size={9} className="inline" /> {circle.member_count} members</span>
            </div>
            {circle.description && <p className="text-xs text-[#a3adc3] mt-2 max-w-xl">{circle.description}</p>}
          </div>
          <div className="shrink-0 pb-1">{ActionButtons}</div>
        </div>

        {/* 2-column grid */}
        <div className="grid grid-cols-[1fr_320px] gap-6">
          {/* Left: Feed */}
          <div>{FeedContent}</div>

          {/* Right: Sidebar */}
          <div className="space-y-4">
            {/* Pending requests (if owner) */}
            {isOwner && pendingMembers.length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(234,179,8,0.15)' }}>
                <h3 className="text-xs font-semibold text-[#EAB308] mb-3"><UserPlus size={11} className="inline mr-1" /> Pending Requests ({pendingMembers.length})</h3>
                {RequestsContent}
              </div>
            )}

            {/* Members */}
            <div className="rounded-2xl p-4" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <h3 className="text-xs font-semibold text-[#a3adc3] mb-3"><Users size={11} className="inline mr-1" /> Members ({members.length})</h3>
              {MembersContent}
            </div>
          </div>
        </div>
      </div>

      {/* ── Member Profile Popup ── */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedMember(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'rgba(10,11,15,0.98)', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="h-20" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(167,139,250,0.1))' }} />
            <button onClick={() => setSelectedMember(null)} className="absolute top-3 right-3 h-7 w-7 rounded-full flex items-center justify-center cursor-pointer" style={{ background: 'rgba(0,0,0,0.4)' }}><X size={14} className="text-white" /></button>
            <div className="px-5 pb-5">
              <div className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold overflow-hidden -mt-8 mb-3" style={{ background: '#111318', border: '3px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}>
                {selectedMember.avatar_url ? <img src={selectedMember.avatar_url} alt={memberName(selectedMember)} className="w-full h-full object-cover" /> : memberName(selectedMember).charAt(0).toUpperCase()}
              </div>
              <h3 className="text-lg font-bold text-white">{memberName(selectedMember)}</h3>
              {selectedMember.username && <p className="text-xs text-[#4a5068] mt-0.5">@{selectedMember.username}</p>}
              {selectedMember.bio && <p className="text-xs text-[#a3adc3] mt-2">{selectedMember.bio}</p>}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>{selectedMember.role}</span>
                {selectedMember.trust_level && selectedMember.trust_level !== 'new' && <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>{selectedMember.trust_level}</span>}
                {(selectedMember.trust_score ?? 0) > 0 && <span className="text-[9px] text-[#4a5068]">Trust: {selectedMember.trust_score}</span>}
              </div>
              <p className="text-[10px] text-[#4a5068] mt-2">{selectedMember.status === 'pending' ? 'Requested' : 'Joined'} {formatDistanceToNow(new Date(selectedMember.joined_at), { addSuffix: true })}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
