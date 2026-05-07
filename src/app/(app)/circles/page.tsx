'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Search, Plus, Users, Briefcase, Cpu, Heart, Plane, Calendar, Globe, Check, Loader2, X, Zap, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import CircleDetailSheet from '@/components/circles/CircleDetailSheet';
import EventDetailPage from '@/components/events/EventDetailPage';
import AuthPopup from '@/components/ui/AuthPopup';
import SignalSheet from '@/components/map/SignalSheet';
import { useJoinedCircles } from '@/hooks/useJoinedCircles';
import type { Circle, Event } from '@/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());
const authFetcher = (url: string) => fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` } }).then(r => r.json());

const TABS = ['For You', 'My Circles', 'Discover', 'Events'] as const;

const CATEGORIES = [
  { icon: <Briefcase size={18} />, label: 'Business', color: '#34d399' },
  { icon: <Cpu size={18} />, label: 'AI & Tech', color: '#00d4ff' },
  { icon: <Heart size={18} />, label: 'Lifestyle', color: '#f87171' },
  { icon: <Plane size={18} />, label: 'Travel', color: '#fbbf24' },
];


// ─── For You Feed ────────────────────────────────────────────────────────

type CircleGroup = { circle: Record<string, unknown>; events: Record<string, unknown>[]; signals: Record<string, unknown>[]; new_member_count: number; online_members: Record<string, unknown>[]; has_live: boolean };

const SIGNAL_ICON: Record<string, { icon: string; color: string }> = {
  presence: { icon: '📍', color: '#3B82F6' },
  intent:   { icon: '🔍', color: '#a78bfa' },
  offer:    { icon: '🏷', color: '#fbbf24' },
  event:    { icon: '🎉', color: '#f87171' },
  update:   { icon: '📣', color: '#00d4ff' },
};

function CircleGroupCard({ group, compact, onSelectCircle, onSelectEvent, onSelectSignal }: { group: CircleGroup; compact?: boolean; onSelectCircle: (c: Circle) => void; onSelectEvent: (e: Event) => void; onSelectSignal: (s: Record<string, unknown>) => void }) {
  const c = group.circle;
  const hasActivity = group.events.length > 0 || group.signals.length > 0 || group.new_member_count > 0;
  const totalItems = group.events.length + group.signals.length + (group.new_member_count > 0 ? 1 : 0);
  const needsScroll = totalItems > 3;

  return (
    <div
      onClick={() => onSelectCircle(c as unknown as Circle)}
      className="rounded-2xl overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5"
      style={{ background: 'rgba(17,19,24,0.5)', border: group.has_live ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
          {(c.name as string)?.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white truncate">{c.name as string}</h3>
          <p className="text-[10px] text-[#4a5068]">{c.category as string}{c.city ? ` · ${c.city}` : ''} · {(c.member_count as number)?.toLocaleString()} members</p>
        </div>
        {/* Status badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          {group.has_live && (
            <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
              <span className="h-1.5 w-1.5 rounded-full bg-[#f87171]" /> LIVE
            </span>
          )}
          {group.online_members.length > 0 && !group.has_live && (
            <span className="flex items-center gap-1 text-[9px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399' }}>
              <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" /> {group.online_members.length}
            </span>
          )}
          {/* Activity count badge */}
          {hasActivity && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(0,212,255,0.08)', color: '#4a5068' }}>
              {group.events.length + group.signals.length}
            </span>
          )}
        </div>
      </div>

      {/* Content — fixed max height, scrollable */}
      <div
        className={`px-4 pb-3 space-y-1 ${needsScroll ? 'overflow-y-auto scrollbar-hide' : ''}`}
        style={needsScroll ? { maxHeight: compact ? 120 : 160 } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Events — live first */}
        {group.events.map((evt) => (
          <div key={evt.id as string} onClick={() => onSelectEvent(evt as unknown as Event)} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-white/[0.02] cursor-pointer" style={{ background: evt.status === 'live' ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.03)' }}>
            <Calendar size={11} className="text-[#f87171] shrink-0" />
            <p className="text-[11px] text-[#a3adc3] truncate flex-1">
              <span className="text-white font-medium">{evt.title as string}</span>
              {evt.location_name ? ` · ${evt.location_name}` : ''}
            </p>
            <span className="text-[9px] shrink-0" style={{ color: evt.status === 'live' ? '#f87171' : '#4a5068' }}>
              {evt.status === 'live' ? 'LIVE' : `${evt.joined_count} joined`}
            </span>
          </div>
        ))}

        {/* Signals */}
        {group.signals.map((sig) => {
          const si = SIGNAL_ICON[sig.type as string] || SIGNAL_ICON.update;
          return (
            <div key={sig.id as string} onClick={() => onSelectSignal(sig)} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors hover:bg-white/[0.02]" style={{ background: `${si.color}06` }}>
              <span className="text-[11px] shrink-0">{si.icon}</span>
              <p className="text-[11px] text-[#a3adc3] truncate flex-1">
                <span className="text-white font-medium">{sig.author_name as string}</span>: &quot;{sig.title as string}&quot;
              </p>
              <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0" style={{ background: `${si.color}15`, color: si.color }}>{sig.type as string}</span>
            </div>
          );
        })}

        {/* New members */}
        {group.new_member_count > 0 && (
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(52,211,153,0.03)' }}>
            <UserPlus size={11} className="text-[#34d399] shrink-0" />
            <p className="text-[11px] text-[#a3adc3]"><span className="text-[#34d399] font-medium">+{group.new_member_count}</span> new members today</p>
          </div>
        )}

        {/* Quiet state */}
        {!hasActivity && (
          <p className="text-[11px] text-[#2d3548] italic px-2.5 py-1">No recent activity</p>
        )}
      </div>

      {/* Scroll hint */}
      {needsScroll && (
        <div className="h-4 mx-4 mb-2 flex items-center justify-center">
          <div className="w-8 h-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>
      )}
    </div>
  );
}

function ForYouFeed({ onSelectEvent, onSelectCircle, onNeedAuth }: { onSelectEvent: (e: Event) => void; onSelectCircle: (c: Circle) => void; onNeedAuth: () => void }) {
  const [selectedSignal, setSelectedSignal] = useState<Record<string, unknown> | null>(null);
  const { data, isLoading, mutate: mutateFeed } = useSWR('/api/v1/circles/feed', authFetcher, { revalidateOnFocus: false });
  const feed = data?.data;
  const { joinedCircleIds, refresh: refreshJoined } = useJoinedCircles();
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const handleQuickJoin = async (circleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cookieAuthed = typeof document !== 'undefined' && document.cookie.includes('gao_logged_in=1');
    if (!cookieAuthed) { onNeedAuth(); return; }
    const token = localStorage.getItem('access_token') || '';
    setJoiningId(circleId);
    try {
      const res = await fetch(`/api/v1/circles/${circleId}/join`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) { onNeedAuth(); return; }
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        refreshJoined();
        mutateFeed();
        toast.success('Joined!');
      } else if (res.status === 400 && d?.error?.code === 'already_member') {
        refreshJoined();
        mutateFeed();
      } else {
        toast.error(d?.error?.message || 'Failed');
      }
    } catch { toast.error('Network error'); }
    finally { setJoiningId(null); }
  };

  if (isLoading) return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'rgba(17,19,24,0.5)' }} />)}
    </div>
  );

  const circleGroups = (feed?.circle_groups || []) as CircleGroup[];
  // Defensive client-side filter: drop any recommended circle that we already joined.
  // The feed endpoint should already exclude these, but stale SWR cache or cross-tab joins
  // can let one slip through and showing a "Join" button on it triggers 400 already_member.
  const recommended = ((feed?.recommended || []) as Record<string, unknown>[])
    .filter(c => !joinedCircleIds.has(c.id as string));
  const isEmpty = circleGroups.length === 0 && recommended.length === 0;

  return (
    <div>
      {/* ── Desktop ── */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-4">
        {circleGroups.map((group) => (
          <CircleGroupCard key={group.circle.id as string} group={group} onSelectCircle={onSelectCircle} onSelectEvent={onSelectEvent} onSelectSignal={setSelectedSignal} />
        ))}

        {/* Recommended section spans full width */}
        {recommended.length > 0 && (
          <div className="col-span-2 mt-2">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-[#a78bfa]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#4a5068]">Recommended For You</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {recommended.map((c) => (
                <div key={c.id as string} onClick={() => onSelectCircle(c as unknown as Circle)} className="group rounded-2xl p-4 cursor-pointer transition-all hover:-translate-y-0.5" style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(167,139,250,0.08)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0" style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>{(c.name as string)?.charAt(0)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate group-hover:text-[#a78bfa] transition-colors">{c.name as string}</p>
                      <p className="text-[10px] text-[#4a5068]">{c.category as string} · {(c.member_count as number)?.toLocaleString()} members</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#6b7a94] mb-3 line-clamp-2">{c.description as string || `${c.city || ''}`}</p>
                  <button onClick={(e) => handleQuickJoin(c.id as string, e)} disabled={joiningId === c.id || joinedCircleIds.has(c.id as string)} className="w-full rounded-lg py-1.5 text-[10px] font-semibold cursor-pointer disabled:opacity-50" style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.15)' }}>
                    {joinedCircleIds.has(c.id as string) ? 'Joined ✓' : joiningId === c.id ? '...' : 'Join Circle'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile ── */}
      <div className="lg:hidden space-y-3">
        {circleGroups.map((group) => (
          <CircleGroupCard key={group.circle.id as string} group={group} compact onSelectCircle={onSelectCircle} onSelectEvent={onSelectEvent} onSelectSignal={setSelectedSignal} />
        ))}

        {recommended.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2"><Zap size={14} className="text-[#a78bfa]" /><h2 className="text-xs font-bold uppercase tracking-wider text-[#4a5068]">Recommended</h2></div>
            <div className="grid grid-cols-2 gap-2">
              {recommended.map((c) => (
                <div key={c.id as string} onClick={() => onSelectCircle(c as unknown as Circle)} className="rounded-xl p-3 cursor-pointer" style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>{(c.name as string)?.charAt(0)}</div>
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-white truncate">{c.name as string}</p><p className="text-[9px] text-[#4a5068]">{(c.member_count as number)?.toLocaleString()} members</p></div>
                  </div>
                  <button onClick={(e) => handleQuickJoin(c.id as string, e)} disabled={joiningId === c.id || joinedCircleIds.has(c.id as string)} className="w-full rounded-lg py-1.5 text-[10px] font-semibold cursor-pointer disabled:opacity-50" style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>
                    {joinedCircleIds.has(c.id as string) ? 'Joined ✓' : joiningId === c.id ? '...' : 'Join'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isEmpty && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(167,139,250,0.08))' }}>
            <Users size={28} className="text-[#00d4ff]" />
          </div>
          <h3 className="text-sm font-bold text-white">Your circle feed is empty</h3>
          <p className="text-xs text-[#4a5068] max-w-xs">Join circles to see live events, activity, and recommendations here</p>
        </div>
      )}

      {/* Signal detail sheet */}
      {selectedSignal && (
        <SignalSheet
          signal={{
            id: selectedSignal.id as string,
            title: selectedSignal.title as string,
            type: selectedSignal.type as string,
            description: selectedSignal.description as string,
            category: selectedSignal.category as string,
            owner_id: selectedSignal.author_id as string,
            author_id: selectedSignal.author_id as string,
            author_name: selectedSignal.author_name as string,
            author_username: selectedSignal.author_username as string,
            author_avatar: selectedSignal.author_avatar as string,
            author_trust_level: selectedSignal.author_trust_level as string,
            created_at: selectedSignal.created_at as string,
            expires_at: selectedSignal.expires_at as string,
          }}
          onClose={() => setSelectedSignal(null)}
        />
      )}
    </div>
  );
}

// ─── Components ──────────────────────────────────────────────────────────

function CircleRow({ circle, onClick, isJoined, isPending, onJoin, onLeave, joining, leaving }: { circle: Circle & { online?: number; posts_per_day?: number; has_event?: boolean }; onClick: () => void; isJoined: boolean; isPending: boolean; onJoin: () => void; onLeave: () => void; joining: boolean; leaving: boolean }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition-colors hover:bg-white/[0.01]"
      style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}
    >
      <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold overflow-hidden" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
        {circle.avatar_url ? <img src={circle.avatar_url} alt={circle.name} className="w-full h-full object-cover" /> : circle.name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{circle.name}</p>
        <p className="text-[10px] text-[#4a5068]">
          {circle.member_count.toLocaleString()} members
          {circle.online ? <span className="text-[#00d4ff]"> · +{circle.online} online</span> : ''}
          {circle.posts_per_day ? <span> · {circle.posts_per_day} posts/day</span> : ''}
        </p>
      </div>
      {isJoined ? (
        <button onClick={(ev) => { ev.stopPropagation(); onLeave(); }} disabled={leaving} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer transition-colors hover:bg-red-500/10" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
          {leaving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Joined
        </button>
      ) : isPending ? (
        <button onClick={(ev) => { ev.stopPropagation(); onLeave(); }} disabled={leaving} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer transition-colors hover:bg-red-500/10" style={{ background: 'rgba(234,179,8,0.12)', color: '#EAB308' }}>
          {leaving ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />} Pending
        </button>
      ) : circle.has_event ? (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>Event</span>
      ) : (
        <button onClick={(ev) => { ev.stopPropagation(); onJoin(); }} disabled={joining} className="rounded-lg px-3 py-1 text-[10px] font-semibold cursor-pointer disabled:opacity-50" style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }}>Join</button>
      )}
    </div>
  );
}


// ─── Page ────────────────────────────────────────────────────────────────

export default function CirclesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('For You');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const { joinedCircleIds, pendingCircleIds, refresh: refreshCircles } = useJoinedCircles();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [showAuthPopup, setShowAuthPopup] = useState(false);

  const isLoggedIn = () => typeof document !== 'undefined' && document.cookie.includes('gao_logged_in=1');

  const handleCreateCircle = () => {
    if (!isLoggedIn()) { setShowAuthPopup(true); return; }
    router.push('/circles/create');
  };

  // Fetch circles from API
  const { data: circlesData } = useSWR('/api/v1/circles?limit=30', fetcher);
  const apiCircles = (circlesData?.data || []) as (Circle & { online?: number; posts_per_day?: number; has_event?: boolean })[];

  // Events from API for Events tab
  const { data: eventsData } = useSWR<{ data: Record<string, unknown>[] }>(
    activeTab === 'Events' ? '/api/v1/events?limit=20' : null, fetcher
  );
  const apiEvents = eventsData?.data || [];

  const handleJoinCircle = async (circleId: string) => {
    if (!isLoggedIn()) { setShowAuthPopup(true); return; }
    const token = localStorage.getItem('access_token') || '';
    setJoiningId(circleId);
    try {
      const res = await fetch(`/api/v1/circles/${circleId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) { setShowAuthPopup(true); return; }
      const data = await res.json();
      if (res.ok) {
        refreshCircles();
        toast.success(data.data?.joined ? 'Joined circle! +2 trust 🛡' : 'Request sent! Waiting for approval.');
      } else {
        toast.error(data.error?.message || 'Failed to join');
      }
    } catch { toast.error('Network error'); }
    finally { setJoiningId(null); }
  };

  const handleLeaveCircle = async (circleId: string, isPending: boolean) => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    setLeavingId(circleId);
    try {
      const res = await fetch(`/api/v1/circles/${circleId}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        refreshCircles();
        toast.success(isPending ? 'Request cancelled' : 'Left circle');
      } else {
        const data = await res.json();
        toast.error(data.error?.message || 'Failed');
      }
    } catch { toast.error('Network error'); }
    finally { setLeavingId(null); }
  };

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Search circles via API (debounced)
  const [searchResults, setSearchResults] = useState<Circle[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults(null); setSearchLoading(false); return; }
    if (activeTab !== 'Discover') setActiveTab('Discover');
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, limit: '20' });
        if (selectedCategory) params.set('category', selectedCategory);
        const res = await fetch(`/api/v1/circles?${params}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.data || []);
        }
      } catch { /* ignore */ }
      setSearchLoading(false);
    }, 300);
  }, [selectedCategory]);

  // Use search results when searching, otherwise show all
  const allCircles = searchResults !== null ? searchResults : apiCircles;
  const filtered = selectedCategory && searchResults === null
    ? allCircles.filter((c: Circle) => c.category.toLowerCase() === selectedCategory.toLowerCase())
    : allCircles;

  return (
    <div className="h-full overflow-y-auto relative">
      <div className="aurora-gradient absolute inset-x-0 top-0 h-56 pointer-events-none" />

      {/* ══ MOBILE ════════════════════════════════════════ */}
      <div className="lg:hidden relative max-w-lg mx-auto px-4 pt-[calc(env(safe-area-inset-top,12px)+16px)] pb-24">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-white">Circles</h1>
          <button className="flex h-9 w-9 items-center justify-center rounded-xl cursor-pointer" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Globe size={16} className="text-[#a3adc3]" />
          </button>
        </div>

        <div className="relative mb-4">
          {searchLoading ? <Loader2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#00d4ff] animate-spin" /> : <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5068]" />}
          <input value={searchQuery} onChange={(e) => handleSearch(e.target.value)} placeholder="Search circles..." className="w-full rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder:text-[#2d3548] outline-none" style={{ background: 'rgba(17,19,24,0.6)', border: searchQuery ? '1px solid rgba(0,212,255,0.2)' : '1px solid rgba(255,255,255,0.05)' }} />
          {searchQuery && <button onClick={() => handleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a5068] hover:text-white cursor-pointer"><X size={14} /></button>}
        </div>

        <div className="flex gap-1 mb-5 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab} onClick={() => tab === 'My Circles' ? router.push('/me/circles') : setActiveTab(tab)} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${activeTab === tab ? 'bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20' : 'text-[#4a5068]'}`}>{tab}</button>
          ))}
        </div>

        {/* ── For You tab ── */}
        {activeTab === 'For You' && (
          <ForYouFeed onSelectEvent={setSelectedEvent} onSelectCircle={setSelectedCircle} onNeedAuth={() => setShowAuthPopup(true)} />
        )}

        {/* ── Discover tab ── */}
        {activeTab === 'Discover' && (<>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068] mb-3">Categories</h2>
          <div className="flex gap-3 mb-5 overflow-x-auto pb-1">
            <div onClick={() => setSelectedCategory(null)} className="flex flex-col items-center gap-1.5 shrink-0 w-16 cursor-pointer transition-transform active:scale-95">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center transition-all" style={selectedCategory === null ? { background: 'rgba(0,212,255,0.25)', color: '#00d4ff', border: '2px solid #00d4ff', boxShadow: '0 0 12px rgba(0,212,255,0.4)' } : { background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}>
                <Globe size={18} />
              </div>
              <span className="text-[10px] font-medium" style={{ color: selectedCategory === null ? '#00d4ff' : '#a3adc3' }}>All</span>
            </div>
            {CATEGORIES.map(({ icon, label, color }) => {
              const catKey = label === 'AI & Tech' ? 'tech' : label.toLowerCase();
              const isActive = selectedCategory === catKey;
              return (
                <div key={label} onClick={() => setSelectedCategory(isActive ? null : catKey)} className="flex flex-col items-center gap-1.5 shrink-0 w-16 cursor-pointer transition-transform active:scale-95">
                  <div className="h-12 w-12 rounded-2xl flex items-center justify-center transition-all" style={isActive ? { background: `${color}25`, color, border: `2px solid ${color}`, boxShadow: `0 0 12px ${color}40` } : { background: `${color}12`, color, border: `1px solid ${color}20` }}>{icon}</div>
                  <span className="text-[10px] font-medium" style={{ color: isActive ? color : '#a3adc3' }}>{label}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068]">All Circles{selectedCategory ? ` · ${selectedCategory}` : ''}</h2>
            <span className="text-[10px] text-[#4a5068]">{filtered.length} found</span>
          </div>
          <div className="space-y-2 mb-6">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="text-3xl">🔍</span>
                <p className="text-sm text-[#4a5068]">No circles found{selectedCategory ? ` in "${selectedCategory}"` : ''}</p>
                <button onClick={() => handleCreateCircle()} className="text-xs font-semibold text-[#00d4ff] cursor-pointer">Be the first to create one!</button>
              </div>
            ) : (
              filtered.map(c => <CircleRow key={c.id} circle={c} onClick={() => setSelectedCircle(c)} isJoined={joinedCircleIds.has(c.id)} isPending={pendingCircleIds.has(c.id)} onJoin={() => handleJoinCircle(c.id)} onLeave={() => handleLeaveCircle(c.id, pendingCircleIds.has(c.id))} joining={joiningId === c.id} leaving={leavingId === c.id} />)
            )}
          </div>
        </>)}

        {/* ── Events tab ── */}
        {activeTab === 'Events' && (<>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068] mb-3">Upcoming Events</h2>
          {apiEvents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="text-4xl">📅</span>
              <p className="text-sm text-[#4a5068]">No upcoming events</p>
              <p className="text-[10px] text-[#2d3548]">Join circles to see their events here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiEvents.map((evt) => (
                <div key={evt.id as string} onClick={() => setSelectedEvent(evt as unknown as Event)} className="rounded-xl p-4 cursor-pointer transition-colors hover:bg-white/[0.02]" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.1)' }}>
                      <Calendar size={16} className="text-[#f87171]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate">{evt.title as string}</h3>
                      <p className="text-[10px] text-[#4a5068] mt-0.5">
                        {evt.location_name ? `${evt.location_name}` : ''}{evt.city ? ` · ${evt.city}` : ''}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#4a5068]">
                        <span><Calendar size={9} className="inline mr-0.5" />{evt.start_time ? new Date(evt.start_time as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                        <span><Users size={9} className="inline mr-0.5" />{evt.joined_count as number || 0} joined</span>
                        {evt.status === 'live' && <span className="text-[#f87171] font-semibold animate-pulse">● LIVE</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>)}
      </div>

      {/* ══ DESKTOP ═══════════════════════════════════════ */}
      <div className="hidden lg:block relative max-w-6xl mx-auto px-8 pt-6 pb-24">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Circles</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              {searchLoading ? <Loader2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#00d4ff] animate-spin" /> : <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5068]" />}
              <input value={searchQuery} onChange={(e) => handleSearch(e.target.value)} placeholder="Search circles..." className="w-72 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder:text-[#2d3548] outline-none" style={{ background: 'rgba(17,19,24,0.6)', border: searchQuery ? '1px solid rgba(0,212,255,0.2)' : '1px solid rgba(255,255,255,0.05)' }} />
              {searchQuery && <button onClick={() => handleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a5068] hover:text-white cursor-pointer"><X size={14} /></button>}
            </div>
            <button onClick={() => handleCreateCircle()} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold cursor-pointer" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>
              <Plus size={16} /> Create Circle
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6">
          {TABS.map(tab => (
            <button key={tab} onClick={() => tab === 'My Circles' ? router.push('/me/circles') : setActiveTab(tab)} className={`rounded-lg px-4 py-2 text-xs font-medium cursor-pointer transition-colors ${activeTab === tab ? 'bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20' : 'text-[#4a5068] hover:text-[#a3adc3]'}`}>{tab}</button>
          ))}
        </div>

        {/* Desktop layout */}
        <div className="flex gap-6">
          {/* Left sidebar — show on Discover */}
          {activeTab === 'Discover' && (
          <div className="w-[300px] shrink-0 space-y-5">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068] mb-3">Categories</h2>
              <div className="grid grid-cols-2 gap-2">
                <div onClick={() => setSelectedCategory(null)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer transition-all" style={selectedCategory === null ? { background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.4)', boxShadow: '0 0 10px rgba(0,212,255,0.2)' } : { background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }}><Globe size={18} /></div>
                  <span className="text-xs font-medium" style={{ color: selectedCategory === null ? '#00d4ff' : '#a3adc3' }}>All</span>
                </div>
                {CATEGORIES.map(({ icon, label, color }) => {
                  const catKey = label === 'AI & Tech' ? 'tech' : label.toLowerCase();
                  const isActive = selectedCategory === catKey;
                  return (
                    <div key={label} onClick={() => setSelectedCategory(isActive ? null : catKey)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer transition-all" style={isActive ? { background: `${color}15`, border: `1px solid ${color}40`, boxShadow: `0 0 10px ${color}20` } : { background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: `${color}12`, color }}>{icon}</div>
                      <span className="text-xs font-medium" style={{ color: isActive ? color : '#a3adc3' }}>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          )}

          {/* Right: Content based on tab */}
          <div className="flex-1 min-w-0">
            {/* For You: Activity feed */}
            {activeTab === 'For You' && (
              <ForYouFeed onSelectEvent={setSelectedEvent} onSelectCircle={setSelectedCircle} onNeedAuth={() => setShowAuthPopup(true)} />
            )}

            {/* Discover: Circles grid */}
            {activeTab === 'Discover' && (<>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068]">All Circles{selectedCategory ? ` · ${selectedCategory}` : ''}</h2>
                <span className="text-[10px] text-[#4a5068]">{filtered.length} circles</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {filtered.length === 0 && (
                  <div className="col-span-2 flex flex-col items-center gap-3 py-12 text-center">
                    <span className="text-4xl">🔍</span>
                    <p className="text-sm text-[#4a5068]">No circles found{selectedCategory ? ` in "${selectedCategory}"` : ''}</p>
                    <button onClick={() => handleCreateCircle()} className="text-xs font-semibold text-[#00d4ff] cursor-pointer">Be the first to create one!</button>
                  </div>
                )}
                {filtered.map(circle => (
                  <div key={circle.id} onClick={() => setSelectedCircle(circle)} className="rounded-xl p-4 cursor-pointer transition-colors hover:bg-white/[0.02]" style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold overflow-hidden" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                        {circle.avatar_url ? <img src={circle.avatar_url} alt={circle.name} className="w-full h-full object-cover" /> : circle.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{circle.name}</p>
                        <p className="text-[10px] text-[#4a5068]">{circle.city}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-[#4a5068]">{circle.member_count.toLocaleString()} members</p>
                      {joinedCircleIds.has(circle.id) ? (
                        <button onClick={(ev) => { ev.stopPropagation(); handleLeaveCircle(circle.id, false); }} disabled={leavingId === circle.id} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                          {leavingId === circle.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Joined
                        </button>
                      ) : pendingCircleIds.has(circle.id) ? (
                        <button onClick={(ev) => { ev.stopPropagation(); handleLeaveCircle(circle.id, true); }} disabled={leavingId === circle.id} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer" style={{ background: 'rgba(234,179,8,0.12)', color: '#EAB308' }}>
                          {leavingId === circle.id ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />} Pending
                        </button>
                      ) : (
                        <button onClick={(ev) => { ev.stopPropagation(); handleJoinCircle(circle.id); }} disabled={joiningId === circle.id} className="rounded-lg px-3 py-1 text-[10px] font-semibold cursor-pointer disabled:opacity-50" style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }}>Join</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>)}

            {/* Events tab */}
            {activeTab === 'Events' && (<>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068]">Upcoming Events</h2>
                <span className="text-[10px] text-[#4a5068]">{apiEvents.length} events</span>
              </div>
              {apiEvents.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <span className="text-5xl">📅</span>
                  <p className="text-sm text-[#4a5068]">No upcoming events</p>
                  <p className="text-[10px] text-[#2d3548]">Join circles to see their events here</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {apiEvents.map((evt) => (
                    <div key={evt.id as string} onClick={() => setSelectedEvent(evt as unknown as Event)} className="rounded-xl p-4 cursor-pointer transition-colors hover:bg-white/[0.02]" style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div className="flex items-start gap-3">
                        <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.1)' }}>
                          <Calendar size={18} className="text-[#f87171]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-white truncate">{evt.title as string}</h3>
                          <p className="text-[10px] text-[#4a5068] mt-0.5">{evt.location_name ? `${evt.location_name}` : ''}{evt.city ? ` · ${evt.city}` : ''}</p>
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-[#4a5068]">
                            <span><Calendar size={9} className="inline mr-0.5" />{evt.start_time ? new Date(evt.start_time as string).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''}</span>
                            <span><Users size={9} className="inline mr-0.5" />{evt.joined_count as number || 0} joined</span>
                            {evt.status === 'live' && <span className="text-[#f87171] font-semibold animate-pulse">● LIVE</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>)}
          </div>
        </div>
      </div>

      {selectedCircle && <CircleDetailSheet circle={selectedCircle} onClose={() => setSelectedCircle(null)} />}
      {selectedEvent && <EventDetailPage event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
      <AuthPopup open={showAuthPopup} onClose={() => setShowAuthPopup(false)} />
    </div>
  );
}
