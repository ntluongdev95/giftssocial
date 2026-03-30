'use client';

import { Users, Calendar, ChevronRight } from 'lucide-react';
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
  onClick?: () => void;
}

export default function CircleCard({ circle, isMember = false, onClick }: CircleCardProps) {
  const cat = CATEGORY_COLORS[circle.category] || DEFAULT_CAT;

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
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ background: cat.bg }}
        >
          {cat.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="truncate text-sm font-semibold text-white group-hover:text-[#00d4ff] transition-colors">
              {circle.name}
            </h3>
            {!isMember && (
              <button
                className="shrink-0 ml-2 rounded-lg px-3 py-1 text-[11px] font-semibold transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(99,102,241,0.1))',
                  border: '1px solid rgba(0,212,255,0.25)',
                  color: '#00d4ff',
                }}
              >
                Join
              </button>
            )}
            {isMember && (
              <span className="shrink-0 ml-2 rounded-lg px-3 py-1 text-[11px] font-semibold text-[#34d399]"
                style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}
              >
                Joined ✓
              </span>
            )}
          </div>

          <p className="mt-1 text-xs" style={{ color: '#6b7a94' }}>
            <span style={{ color: cat.text }}>{circle.category}</span>
            {circle.city ? ` · ${circle.city}` : ''}
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
