'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Search, Plus, Users, Briefcase, Cpu, Heart, Plane, Calendar, Globe, Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import CircleDetailSheet from '@/components/circles/CircleDetailSheet';
import SignInGateSheet from '@/components/auth/SignInGateSheet';
import { useJoinedCircles } from '@/hooks/useJoinedCircles';
import type { Circle } from '@/types';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// ─── Data ────────────────────────────────────────────────────────────────

const SEED_CIRCLES: (Circle & { online?: number; posts_per_day?: number; joined?: boolean; has_event?: boolean; event_label?: string })[] = [
  { id: 'circle_1', name: 'Startup Builders Saigon', slug: 'startup-builders-saigon', category: 'Tech', city: 'Ho Chi Minh City', owner_id: 'user_system', visibility: 'public', verification_level: 1, trust_score: 82, trust_level: 'trusted', badges: ['active_community'], member_count: 1200, event_count: 15, status: 'active', created_at: '', updated_at: '', online: 42 },
  { id: 'circle_2', name: 'Crypto Vietnam', slug: 'crypto-vietnam', category: 'Crypto', city: 'Vietnam', owner_id: 'user_system', visibility: 'public', verification_level: 1, trust_score: 75, trust_level: 'trusted', badges: ['active_community'], member_count: 856, event_count: 10, status: 'active', created_at: '', updated_at: '', online: 24 },
  { id: 'circle_3', name: 'Health & Wellness', slug: 'health-wellness', category: 'Lifestyle', city: 'Global', owner_id: 'user_system', visibility: 'public', verification_level: 0, trust_score: 60, trust_level: 'trusted', badges: [], member_count: 420, event_count: 6, status: 'active', created_at: '', updated_at: '', joined: true },
  { id: 'circle_4', name: 'Coffee Lovers', slug: 'coffee-lovers', category: 'Lifestyle', city: 'Ho Chi Minh City', owner_id: 'user_system', visibility: 'public', verification_level: 0, trust_score: 55, trust_level: 'verified', badges: [], member_count: 230, event_count: 4, status: 'active', created_at: '', updated_at: '', has_event: true, event_label: 'Today 7:00 PM' },
  { id: 'circle_5', name: 'Digital Nomads', slug: 'digital-nomads', category: 'Travel', city: 'Global', owner_id: 'user_system', visibility: 'public', verification_level: 1, trust_score: 70, trust_level: 'trusted', badges: ['active_community'], member_count: 1100, event_count: 8, status: 'active', created_at: '', updated_at: '', posts_per_day: 15 },
  { id: 'circle_6', name: 'Dallas Foodies', slug: 'dallas-foodies', category: 'Food', city: 'Dallas', owner_id: 'user_system', visibility: 'public', verification_level: 1, trust_score: 72, trust_level: 'trusted', badges: ['active_community'], member_count: 184, event_count: 12, status: 'active', created_at: '', updated_at: '' },
  { id: 'circle_7', name: 'DFW Beauty Network', slug: 'dfw-beauty', category: 'Beauty', city: 'Dallas', owner_id: 'user_system', visibility: 'public', verification_level: 0, trust_score: 48, trust_level: 'verified', badges: [], member_count: 95, event_count: 3, status: 'active', created_at: '', updated_at: '' },
];

const TABS = ['For You', 'My Circles', 'Discover', 'Events'] as const;

const CATEGORIES = [
  { icon: <Briefcase size={18} />, label: 'Business', color: '#34d399' },
  { icon: <Cpu size={18} />, label: 'AI & Tech', color: '#00d4ff' },
  { icon: <Heart size={18} />, label: 'Lifestyle', color: '#f87171' },
  { icon: <Plane size={18} />, label: 'Travel', color: '#fbbf24' },
];

const EVENTS_THIS_WEEK = [
  { title: 'Pitch Night', time: 'Fri 7:00 PM', circle: 'Startup Builders' },
  { title: 'Morning Run', time: 'Sun 6:00 AM', circle: 'Health & Wellness' },
  { title: 'Coffee Tasting', time: 'Sat 3:00 PM', circle: 'Coffee Lovers' },
];

// ─── Components ──────────────────────────────────────────────────────────

function CircleRow({ circle, onClick, isJoined, isPending, onJoin, onLeave, joining, leaving }: { circle: typeof SEED_CIRCLES[0]; onClick: () => void; isJoined: boolean; isPending: boolean; onJoin: () => void; onLeave: () => void; joining: boolean; leaving: boolean }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition-colors hover:bg-white/[0.01]"
      style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}
    >
      <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
        {circle.name.charAt(0)}
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

function EventMiniCard({ title, time }: { title: string; time: string }) {
  return (
    <div className="shrink-0 w-40 lg:w-auto lg:flex-1 rounded-xl overflow-hidden cursor-pointer" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="h-20 w-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(167,139,250,0.06))' }}>
        <Calendar size={20} className="text-[#4a5068]" />
      </div>
      <div className="p-3">
        <p className="text-xs font-semibold text-white truncate">{title}</p>
        <p className="text-[10px] text-[#4a5068]">{time}</p>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────

export default function CirclesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('For You');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCircle, setSelectedCircle] = useState<Circle | null>(null);
  const { joinedCircleIds, pendingCircleIds, refresh: refreshCircles } = useJoinedCircles();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [showAuthGate, setShowAuthGate] = useState(false);

  // Fetch circles from API
  const { data: circlesData } = useSWR('/api/v1/circles?limit=30', fetcher);
  const apiCircles = (circlesData?.data || []) as (Circle & { online?: number; posts_per_day?: number; has_event?: boolean })[];

  const handleJoinCircle = async (circleId: string) => {
    const token = localStorage.getItem('access_token');
    if (!token) { setShowAuthGate(true); return; }
    setJoiningId(circleId);
    try {
      const res = await fetch(`/api/v1/circles/${circleId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
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

  const allCircles = apiCircles.length > 0 ? apiCircles : SEED_CIRCLES;
  const filtered = allCircles.filter((c) => {
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

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
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5068]" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search circles..." className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[#2d3548] outline-none" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.05)' }} />
        </div>

        <div className="flex gap-1 mb-5 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab} onClick={() => tab === 'My Circles' ? router.push('/me/circles') : setActiveTab(tab)} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${activeTab === tab ? 'bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20' : 'text-[#4a5068]'}`}>{tab}</button>
          ))}
        </div>

        {/* Featured */}
        <div className="rounded-2xl p-4 mb-5 cursor-pointer" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(0,212,255,0.08)' }} onClick={() => setSelectedCircle(SEED_CIRCLES[0])}>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(167,139,250,0.15))' }}><Users size={22} className="text-[#00d4ff]" /></div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white truncate">{SEED_CIRCLES[0].name}</h3>
              <p className="text-[10px] text-[#4a5068]">{SEED_CIRCLES[0].member_count.toLocaleString()} members · <span className="text-[#00d4ff]">● Online</span></p>
            </div>
            <button className="rounded-lg px-4 py-1.5 text-[11px] font-semibold cursor-pointer" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>Join</button>
          </div>
        </div>

        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068] mb-3">Categories</h2>
        <div className="flex gap-3 mb-6 overflow-x-auto pb-1">
          {CATEGORIES.map(({ icon, label, color }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 shrink-0 w-16 cursor-pointer">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: `${color}12`, color, border: `1px solid ${color}20` }}>{icon}</div>
              <span className="text-[10px] font-medium text-[#a3adc3]">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068]">Active Circles</h2>
          <button onClick={() => router.push('/circles/create')} className="flex items-center gap-1 text-[11px] font-semibold text-[#00d4ff] cursor-pointer"><Plus size={12} /> Create Circle</button>
        </div>
        <div className="space-y-2 mb-6">
          {filtered.slice(1).map(c => <CircleRow key={c.id} circle={c} onClick={() => setSelectedCircle(c)} isJoined={joinedCircleIds.has(c.id)} isPending={pendingCircleIds.has(c.id)} onJoin={() => handleJoinCircle(c.id)} onLeave={() => handleLeaveCircle(c.id, pendingCircleIds.has(c.id))} joining={joiningId === c.id} leaving={leavingId === c.id} />)}
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068]">Events This Week</h2>
          <button className="text-[11px] font-semibold text-[#00d4ff] cursor-pointer">See All</button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {EVENTS_THIS_WEEK.map(evt => <EventMiniCard key={evt.title} {...evt} />)}
        </div>
      </div>

      {/* ══ DESKTOP ═══════════════════════════════════════ */}
      <div className="hidden lg:block relative max-w-6xl mx-auto px-8 pt-6 pb-24">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Circles</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5068]" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search circles..." className="w-72 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[#2d3548] outline-none" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.05)' }} />
            </div>
            <button onClick={() => router.push('/circles/create')} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold cursor-pointer" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>
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

        {/* 3-column layout */}
        <div className="flex gap-6">
          {/* Left: Featured + Categories */}
          <div className="w-[300px] shrink-0 space-y-5">
            {/* Featured */}
            <div className="rounded-2xl p-5 cursor-pointer" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(0,212,255,0.08)' }} onClick={() => setSelectedCircle(SEED_CIRCLES[0])}>
              <div className="flex flex-col items-center text-center gap-3">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(167,139,250,0.15))', boxShadow: '0 0 20px rgba(0,212,255,0.15)' }}>
                  <Users size={28} className="text-[#00d4ff]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{SEED_CIRCLES[0].name}</h3>
                  <p className="text-[10px] text-[#4a5068] mt-0.5">{SEED_CIRCLES[0].member_count.toLocaleString()} members · <span className="text-[#00d4ff]">● {SEED_CIRCLES[0].online} Online</span></p>
                </div>
                <button className="w-full rounded-xl py-2.5 text-xs font-semibold cursor-pointer" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>Join Circle</button>
              </div>
            </div>

            {/* Categories */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068] mb-3">Categories</h2>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map(({ icon, label, color }) => (
                  <div key={label} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer transition-colors hover:bg-white/[0.02]" style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: `${color}12`, color }}>{icon}</div>
                    <span className="text-xs font-medium text-[#a3adc3]">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Events This Week */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068]">Events This Week</h2>
                <button className="text-[10px] font-semibold text-[#00d4ff] cursor-pointer">See All</button>
              </div>
              <div className="space-y-2">
                {EVENTS_THIS_WEEK.map(evt => (
                  <div key={evt.title} className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer" style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                      <Calendar size={15} className="text-[#f87171]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{evt.title}</p>
                      <p className="text-[10px] text-[#4a5068]">{evt.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Active Circles grid */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4a5068]">Active Circles</h2>
              <span className="text-[10px] text-[#4a5068]">{filtered.length} circles</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {filtered.slice(1).map(circle => (
                <div
                  key={circle.id}
                  onClick={() => setSelectedCircle(circle)}
                  className="rounded-xl p-4 cursor-pointer transition-colors hover:bg-white/[0.02]"
                  style={{ background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.03)' }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                      {circle.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{circle.name}</p>
                      <p className="text-[10px] text-[#4a5068]">{circle.city}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-[#4a5068]">
                      {circle.member_count.toLocaleString()} members
                      {circle.online ? <span className="text-[#00d4ff]"> · {circle.online} online</span> : ''}
                    </p>
                    {joinedCircleIds.has(circle.id) ? (
                      <button onClick={(ev) => { ev.stopPropagation(); handleLeaveCircle(circle.id, false); }} disabled={leavingId === circle.id} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer transition-colors hover:bg-red-500/10" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                        {leavingId === circle.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Joined
                      </button>
                    ) : pendingCircleIds.has(circle.id) ? (
                      <button onClick={(ev) => { ev.stopPropagation(); handleLeaveCircle(circle.id, true); }} disabled={leavingId === circle.id} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer transition-colors hover:bg-red-500/10" style={{ background: 'rgba(234,179,8,0.12)', color: '#EAB308' }}>
                        {leavingId === circle.id ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />} Pending
                      </button>
                    ) : circle.has_event ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>Event</span>
                    ) : (
                      <button onClick={(ev) => { ev.stopPropagation(); handleJoinCircle(circle.id); }} disabled={joiningId === circle.id} className="rounded-lg px-3 py-1 text-[10px] font-semibold cursor-pointer disabled:opacity-50" style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }}>Join</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selectedCircle && <CircleDetailSheet circle={selectedCircle} onClose={() => setSelectedCircle(null)} />}
      <SignInGateSheet action="join" isOpen={showAuthGate} onClose={() => setShowAuthGate(false)} />
    </div>
  );
}
