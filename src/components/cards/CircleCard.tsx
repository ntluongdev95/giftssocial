'use client';

import { useState } from 'react';
import { Users, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import type { Circle } from '@/types';
import TrustBadgeRow from '@/components/trust/TrustBadgeRow';

const CATEGORY_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  Food:    { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', icon: '🍜' },
  Tech:    { bg: 'rgba(0,212,255,0.12)',   text: '#00d4ff', icon: '⚡' },
  Beauty:  { bg: 'rgba(236,72,153,0.12)',  text: '#f472b6', icon: '✨' },
  Fitness: { bg: 'rgba(52,211,153,0.12)',  text: '#34d399', icon: '💪' },
  Crypto:  { bg: 'rgba(167,139,250,0.12)', text: '#a78bfa', icon: '🔗' },
};

const DEFAULT_CAT = { bg: 'rgba(0,212,255,0.1)', text: '#00d4ff', icon: '⦿' };

interface CircleCardProps {
  circle: Circle;
  isMember?: boolean;
  isPending?: boolean;
  onClick?: () => void;
}

function formatDistance(km?: number): string {
  if (!km || km <= 0) return '';
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export default function CircleCard({ circle, isMember = false, isPending = false, onClick }: CircleCardProps) {
  const cat = CATEGORY_COLORS[circle.category] || DEFAULT_CAT;
  const distKm = (circle as unknown as Record<string, unknown>).distance_km as number | undefined;
  const [joinState, setJoinState] = useState<'idle' | 'loading' | 'joined' | 'pending'>(
    isMember ? 'joined' : isPending ? 'pending' : 'idle'
  );

  const handleJoin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (joinState !== 'idle') return;
    setJoinState('loading');
    try {
      const res = await fetch(`/api/v1/circles/${circle.id}/join`, {
        method: 'POST'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Failed to join');
      }
      const data = await res.json();
      setJoinState(data.data?.status === 'pending' ? 'pending' : 'joined');
      toast.success(data.data?.status === 'pending' ? 'Join request sent!' : `Joined ${circle.name}!`);
    } catch (err) {
      setJoinState('idle');
      toast.error(err instanceof Error ? err.message : 'Failed to join');
    }
  };

  return (
    <div
      onClick={onClick}
      className="group rounded-2xl p-4 transition-all duration-200 hover:translate-y-[-2px] cursor-pointer"
      style={{
        background: 'rgba(17,19,24,0.6)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
      }}
    >
      <div className="flex items-start gap-3.5">
        {/* Category icon */}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl overflow-hidden"
          style={{ background: cat.bg }}
        >
          {circle.avatar_url ? <img src={circle.avatar_url} alt={circle.name} className="w-full h-full object-cover" /> : cat.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="truncate text-sm font-semibold text-white group-hover:text-[#00d4ff] transition-colors">
              {circle.name}
            </h3>
            {joinState === 'joined' ? (
              <span className="shrink-0 ml-2 rounded-lg px-3 py-1 text-[11px] font-semibold text-[#34d399]"
                style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}
              >
                Joined ✓
              </span>
            ) : joinState === 'pending' ? (
              <span className="shrink-0 ml-2 rounded-lg px-3 py-1 text-[11px] font-semibold"
                style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)', color: '#EAB308' }}
              >
                Pending
              </span>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joinState === 'loading'}
                className="shrink-0 ml-2 rounded-lg px-3 py-1 text-[11px] font-semibold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(99,102,241,0.1))',
                  border: '1px solid rgba(0,212,255,0.25)',
                  color: '#00d4ff',
                }}
              >
                {joinState === 'loading' ? '...' : 'Join'}
              </button>
            )}
          </div>

          <p className="mt-1 text-xs" style={{ color: '#6b7a94' }}>
            <span style={{ color: cat.text }}>{circle.category}</span>
            {circle.city ? ` · ${circle.city}` : ''}
            {distKm != null && distKm > 0 && (
              <span className="ml-1 text-[#00d4ff]">· {formatDistance(distKm)}</span>
            )}
          </p>

          {/* Stats row */}
          <div className="mt-2 flex items-center gap-4 text-[11px]" style={{ color: '#4a5068' }}>
            <span className="flex items-center gap-1">
              <Users size={12} />
              {circle.member_count}
            </span>
            {circle.event_count > 0 && (
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {circle.event_count} events
              </span>
            )}
            {circle.trust_score > 0 && (
              <span className="flex items-center gap-1">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{
                    background: circle.trust_score >= 60 ? '#34d399' : circle.trust_score >= 30 ? '#3B82F6' : '#4a5068',
                  }}
                />
                {circle.trust_score}
              </span>
            )}
          </div>

          {circle.badges.length > 0 && (
            <div className="mt-2">
              <TrustBadgeRow badges={circle.badges} maxVisible={2} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
