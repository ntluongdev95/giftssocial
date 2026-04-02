'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Camera, Check, Loader2, LogOut, MapPin, Settings, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { Circle } from '@/types';

const fetcher = (url: string) => fetch(url, {
  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
}).then(r => r.json());

type Member = { user_id: string; display_name: string; username?: string; avatar_url?: string; role: string; status: string; joined_at: string; trust_level?: string; trust_score?: number; bio?: string };

function memberName(m: Member) {
  return m.display_name || m.username || 'Unknown user';
}

export default function CircleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'members' | 'requests'>('members');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Fetch circle
  const { data: circleData, mutate: mutateCircle } = useSWR<{ data: Circle & { my_role: string | null; my_status: string | null } }>(
    `/api/v1/circles/${id}`,
    fetcher
  );
  const circle = circleData?.data;

  // Fetch active members
  const { data: membersData, mutate: mutateMembers } = useSWR<{ data: Member[] }>(
    `/api/v1/circles/${id}/members?status=active`,
    fetcher
  );
  const members = membersData?.data ?? [];

  // Fetch pending members (only if owner/admin)
  const { data: pendingData, mutate: mutatePending } = useSWR<{ data: Member[] }>(
    circle?.my_role === 'owner' || circle?.my_role === 'admin'
      ? `/api/v1/circles/${id}/members?status=pending`
      : null,
    fetcher
  );
  const pendingMembers = pendingData?.data ?? [];

  // Auto-switch to requests tab if there are pending members
  useEffect(() => {
    if (pendingMembers.length > 0 && activeTab === 'members') {
      setActiveTab('requests');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMembers.length]);

  const isOwner = circle?.my_role === 'owner' || circle?.my_role === 'admin';

  // ── Avatar upload ──
  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = localStorage.getItem('access_token');
    if (!token) return;

    setUploading(true);
    try {
      // Upload file
      const form = new FormData();
      form.append('file', file);
      form.append('folder', 'circles');
      const uploadRes = await fetch('/api/v1/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error?.message || 'Upload failed');

      // Update circle
      const patchRes = await fetch(`/api/v1/circles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatar_url: uploadData.url }),
      });
      if (patchRes.ok) {
        toast.success('Avatar updated!');
        mutateCircle();
      }
    } catch (err) { toast.error('Failed to upload avatar'); }
    finally { setUploading(false); }
  }, [id, mutateCircle]);

  // ── Member actions ──
  const handleMemberAction = async (memberUserId: string, action: 'approve' | 'reject') => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    setActioningId(memberUserId);
    try {
      const res = await fetch(`/api/v1/circles/${id}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ member_user_id: memberUserId, action }),
      });
      if (res.ok) {
        toast.success(action === 'approve' ? 'Member approved!' : 'Request rejected');
        mutatePending();
        mutateMembers();
        mutateCircle();
      } else {
        const d = await res.json();
        toast.error(d.error?.message || 'Failed');
      }
    } catch { toast.error('Network error'); }
    finally { setActioningId(null); }
  };

  // ── Join / Leave ──
  const handleJoin = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) { toast.error('Please login first'); return; }
    try {
      const res = await fetch(`/api/v1/circles/${id}/join`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(d.data?.joined ? 'Joined!' : 'Request sent!');
        mutateCircle();
        mutateMembers();
      } else { toast.error(d.error?.message || 'Failed'); }
    } catch { toast.error('Network error'); }
  };

  const handleLeave = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/circles/${id}/leave`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { toast.success('Left circle'); mutateCircle(); mutateMembers(); }
    } catch { toast.error('Network error'); }
  };

  if (!circle) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#00d4ff]" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 lg:px-8 py-3" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer"><ArrowLeft size={18} /></button>
        <h1 className="text-sm font-bold text-white truncate">{circle.name}</h1>
        <span className="ml-auto text-[10px] text-[#4a5068]">{circle.member_count} members</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 lg:px-8 py-6 pb-24">
        {/* ── Circle Hero ── */}
        <div className="flex items-center gap-4 mb-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="h-20 w-20 rounded-2xl flex items-center justify-center text-2xl font-bold overflow-hidden" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '2px solid rgba(0,212,255,0.2)' }}>
              {circle.avatar_url ? (
                <img src={circle.avatar_url as string} alt={circle.name} className="w-full h-full object-cover" />
              ) : (
                circle.name.charAt(0)
              )}
            </div>
            {isOwner && (
              <>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full flex items-center justify-center cursor-pointer"
                  style={{ background: '#0a0b0f', border: '2px solid rgba(0,212,255,0.3)' }}
                >
                  {uploading ? <Loader2 size={12} className="animate-spin text-[#00d4ff]" /> : <Camera size={12} className="text-[#00d4ff]" />}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{circle.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>{circle.category}</span>
              <span className="text-[10px] text-[#4a5068] capitalize">{circle.visibility}</span>
              {circle.city && (
                <span className="flex items-center gap-0.5 text-[10px] text-[#4a5068]">
                  <MapPin size={9} /> {circle.city}
                </span>
              )}
            </div>
            {circle.description && (
              <p className="text-xs text-[#a3adc3] mt-2 line-clamp-3">{circle.description}</p>
            )}
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex items-center gap-2 mb-6">
          {circle.my_status === 'active' ? (
            <>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-[#34d399]"><Check size={12} /> Joined</span>
              {circle.my_role !== 'owner' && (
                <button onClick={handleLeave} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-semibold cursor-pointer" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>
                  <LogOut size={10} /> Leave
                </button>
              )}
            </>
          ) : circle.my_status === 'pending' ? (
            <>
              <span className="text-[11px] font-semibold text-[#EAB308]">Pending approval</span>
              <button onClick={handleLeave} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-semibold cursor-pointer" style={{ background: 'rgba(234,179,8,0.08)', color: '#EAB308' }}>
                <X size={10} /> Cancel
              </button>
            </>
          ) : (
            <button onClick={handleJoin} className="flex items-center gap-1 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>
              <UserPlus size={12} /> Join Circle
            </button>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => setActiveTab('members')}
            className="px-4 py-2.5 text-xs font-semibold cursor-pointer transition-colors"
            style={activeTab === 'members' ? { color: '#00d4ff', borderBottom: '2px solid #00d4ff' } : { color: '#4a5068' }}
          >
            <Users size={12} className="inline mr-1" /> Members ({members.length})
          </button>
          {isOwner && (
            <button
              onClick={() => setActiveTab('requests')}
              className="px-4 py-2.5 text-xs font-semibold cursor-pointer transition-colors"
              style={activeTab === 'requests' ? { color: '#EAB308', borderBottom: '2px solid #EAB308' } : { color: '#4a5068' }}
            >
              <UserPlus size={12} className="inline mr-1" /> Requests
              {pendingMembers.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: 'rgba(234,179,8,0.2)', color: '#EAB308' }}>
                  {pendingMembers.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* ── Members list ── */}
        {activeTab === 'members' && (
          <div className="space-y-2">
            {members.length === 0 ? (
              <p className="text-sm text-[#4a5068] text-center py-8">No members yet</p>
            ) : (
              members.map((m) => (
                <div key={m.user_id} onClick={() => setSelectedMember(m)} className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition-colors hover:bg-white/[0.02]" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold overflow-hidden" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt={memberName(m)} className="w-full h-full object-cover" />
                    ) : (
                      memberName(m).charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{memberName(m)}</p>
                    <p className="text-[10px] text-[#4a5068]">
                      {m.role !== 'member' && <span className="capitalize text-[#00d4ff] mr-1">{m.role}</span>}
                      Joined {formatDistanceToNow(new Date(m.joined_at), { addSuffix: true })}
                    </p>
                  </div>
                  {m.trust_level && m.trust_level !== 'new' && (
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>{m.trust_level}</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Pending requests ── */}
        {activeTab === 'requests' && isOwner && (
          <div className="space-y-2">
            {pendingMembers.length === 0 ? (
              <p className="text-sm text-[#4a5068] text-center py-8">No pending requests</p>
            ) : (
              pendingMembers.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(234,179,8,0.1)' }}>
                  <div onClick={() => setSelectedMember(m)} className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold overflow-hidden cursor-pointer" style={{ background: 'rgba(234,179,8,0.1)', color: '#EAB308' }}>
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt={memberName(m)} className="w-full h-full object-cover" />
                    ) : (
                      memberName(m).charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedMember(m)}>
                    <p className="text-sm font-semibold text-white truncate">{memberName(m)}</p>
                    <p className="text-[10px] text-[#4a5068]">Requested {formatDistanceToNow(new Date(m.joined_at), { addSuffix: true })}</p>
                  </div>
                  <button
                    onClick={() => handleMemberAction(m.user_id, 'approve')}
                    disabled={actioningId === m.user_id}
                    className="rounded-lg px-3 py-1.5 text-[10px] font-semibold cursor-pointer disabled:opacity-50"
                    style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleMemberAction(m.user_id, 'reject')}
                    disabled={actioningId === m.user_id}
                    className="rounded-lg px-3 py-1.5 text-[10px] font-semibold cursor-pointer disabled:opacity-50"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}
                  >
                    Reject
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Member Profile Popup ── */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedMember(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: 'rgba(10,11,15,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="h-20" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(167,139,250,0.1))' }} />
            <button onClick={() => setSelectedMember(null)} className="absolute top-3 right-3 h-7 w-7 rounded-full flex items-center justify-center cursor-pointer" style={{ background: 'rgba(0,0,0,0.4)' }}>
              <X size={14} className="text-white" />
            </button>

            <div className="px-5 pb-5">
              {/* Avatar */}
              <div className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold overflow-hidden -mt-8 mb-3" style={{ background: '#111318', border: '3px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}>
                {selectedMember.avatar_url ? (
                  <img src={selectedMember.avatar_url} alt={memberName(selectedMember)} className="w-full h-full object-cover" />
                ) : (
                  memberName(selectedMember).charAt(0).toUpperCase()
                )}
              </div>

              {/* Info */}
              <h3 className="text-lg font-bold text-white">{memberName(selectedMember)}</h3>
              {selectedMember.username && (
                <p className="text-xs text-[#4a5068] mt-0.5">@{selectedMember.username}</p>
              )}
              {selectedMember.bio && (
                <p className="text-xs text-[#a3adc3] mt-2">{selectedMember.bio}</p>
              )}

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                  {selectedMember.role}
                </span>
                {selectedMember.trust_level && selectedMember.trust_level !== 'new' && (
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
                    {selectedMember.trust_level}
                  </span>
                )}
                {(selectedMember.trust_score ?? 0) > 0 && (
                  <span className="text-[9px] text-[#4a5068]">Trust: {selectedMember.trust_score}</span>
                )}
              </div>

              <p className="text-[10px] text-[#4a5068] mt-2">
                {selectedMember.status === 'pending' ? 'Requested' : 'Joined'}{' '}
                {formatDistanceToNow(new Date(selectedMember.joined_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
