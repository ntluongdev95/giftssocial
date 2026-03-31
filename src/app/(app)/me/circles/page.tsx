'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Loader2, Users, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

const fetcher = (url: string) => fetch(url, {
  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
}).then(r => r.json());

export default function MyCirclesPage() {
  const router = useRouter();
  const { data, isLoading, mutate } = useSWR('/api/v1/circles/me', fetcher);
  const circles = (data?.data || []) as Record<string, unknown>[];
  const [leavingId, setLeavingId] = useState<string | null>(null);

  const handleLeave = async (circleId: string, circleName: string) => {
    if (!confirm(`Leave "${circleName}"?`)) return;
    setLeavingId(circleId);
    try {
      const res = await fetch(`/api/v1/circles/${circleId}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
      });
      if (res.ok) { toast.success(`Left ${circleName}`); mutate(); }
      else toast.error('Failed to leave');
    } catch { toast.error('Network error'); }
    finally { setLeavingId(null); }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 lg:px-8 py-3" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer">
          <ArrowLeft size={18} /> Back
        </button>
        <h1 className="text-sm font-bold text-white">My Circles</h1>
        <span className="ml-auto text-[11px] text-[#4a5068]">{circles.length} circle{circles.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Mobile ──────────────────────────────────────── */}
      <div className="lg:hidden max-w-lg mx-auto px-4 py-4 pb-24 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#00d4ff]" /></div>
        ) : circles.length === 0 ? (
          <EmptyState onExplore={() => router.push('/circles')} />
        ) : (
          circles.map((c) => <CircleListItem key={c.id as string} circle={c} onLeave={handleLeave} leavingId={leavingId} router={router} />)
        )}
      </div>

      {/* ── Desktop: Grid ───────────────────────────────── */}
      <div className="hidden lg:block max-w-5xl mx-auto px-8 py-6 pb-24">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#00d4ff]" /></div>
        ) : circles.length === 0 ? (
          <EmptyState onExplore={() => router.push('/circles')} />
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {circles.map((c) => (
              <div
                key={c.id as string}
                className="rounded-2xl overflow-hidden cursor-pointer transition-transform hover:scale-[1.01]"
                style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
                onClick={() => router.push('/circles')}
              >
                {/* Header gradient */}
                <div className="h-20 relative" style={{ background: `linear-gradient(135deg, rgba(0,212,255,0.15), rgba(167,139,250,0.1))` }}>
                  <div className="absolute -bottom-5 left-4">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center text-lg font-bold" style={{ background: '#111318', border: '2px solid rgba(0,212,255,0.2)', color: '#00d4ff' }}>
                      {(c.name as string).charAt(0)}
                    </div>
                  </div>
                </div>

                <div className="pt-7 px-4 pb-4">
                  <h3 className="text-sm font-bold text-white truncate">{c.name as string}</h3>
                  <p className="text-[10px] text-[#4a5068] mt-0.5">
                    {(c.member_count as number || 0).toLocaleString()} members
                    {c.city ? ` · ${c.city}` : ''}
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                      {c.my_role as string || 'member'}
                    </span>
                    <span className="text-[9px] text-[#4a5068] capitalize">{c.category as string}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={(ev) => { ev.stopPropagation(); router.push('/circles'); }}
                      className="flex-1 rounded-lg py-2 text-[10px] font-semibold text-center cursor-pointer"
                      style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}
                    >
                      <Users size={10} className="inline mr-1" /> View
                    </button>
                    {c.my_role !== 'owner' && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); handleLeave(c.id as string, c.name as string); }}
                        disabled={leavingId === c.id as string}
                        className="rounded-lg py-2 px-3 text-[10px] font-semibold cursor-pointer disabled:opacity-50"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}
                      >
                        <LogOut size={10} className="inline mr-1" /> Leave
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onExplore }: { onExplore: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,212,255,0.1)' }}>
        <Users size={24} className="text-[#00d4ff]" />
      </div>
      <p className="text-sm text-[#4a5068]">No circles joined yet</p>
      <button onClick={onExplore} className="text-xs font-semibold text-[#00d4ff] cursor-pointer">Explore circles</button>
    </div>
  );
}

function CircleListItem({ circle: c, onLeave, leavingId, router }: { circle: Record<string, unknown>; onLeave: (id: string, name: string) => void; leavingId: string | null; router: ReturnType<typeof useRouter> }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
          {(c.name as string).charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{c.name as string}</h3>
          <p className="text-[10px] text-[#4a5068]">
            {(c.member_count as number || 0).toLocaleString()} members{c.city ? ` · ${c.city}` : ''}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>{c.my_role as string || 'member'}</span>
            {c.category && <span className="text-[9px] text-[#4a5068] capitalize">{c.category as string}</span>}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={() => router.push('/circles')} className="rounded-lg px-3 py-1.5 text-[10px] font-semibold cursor-pointer" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
              <Users size={10} className="inline mr-1" /> View
            </button>
            {c.my_role !== 'owner' && (
              <button onClick={() => onLeave(c.id as string, c.name as string)} disabled={leavingId === c.id} className="rounded-lg px-3 py-1.5 text-[10px] font-semibold cursor-pointer disabled:opacity-50" style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}>
                <LogOut size={10} className="inline mr-1" /> Leave
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
