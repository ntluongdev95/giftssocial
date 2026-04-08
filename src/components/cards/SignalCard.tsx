'use client';

import { MapPin, Clock, User, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { parseUTC } from '@/lib/date';
import { useAuthStore } from '@/stores/auth-store';

const TYPE_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  presence: { emoji: '📍', color: '#3B82F6', label: "I'm Here" },
  intent:   { emoji: '🔍', color: '#a78bfa', label: 'Looking For' },
  offer:    { emoji: '🏷', color: '#fbbf24', label: 'Offer' },
  event:    { emoji: '🎉', color: '#f87171', label: 'Event' },
  update:   { emoji: '📣', color: '#00d4ff', label: 'Update' },
  proof:    { emoji: '🛡', color: '#f0f4ff', label: 'Proof' },
};

interface SignalCardProps {
  signal: Record<string, unknown>;
  onClick?: () => void;
}

export default function SignalCard({ signal: s, onClick }: SignalCardProps) {
  const myUserId = useAuthStore(st => st.user?.id);
  const isOwner = myUserId && (s.author_id === myUserId || s.owner_id === myUserId);
  const cfg = TYPE_CONFIG[s.type as string] || TYPE_CONFIG.presence;
  const createdDate = s.created_at ? parseUTC(s.created_at as string) : null;
  const timeAgo = createdDate ? formatDistanceToNow(createdDate, { addSuffix: true }) : '';
  const isLive = createdDate ? createdDate.getTime() > Date.now() - 30 * 60 * 1000 : false;

  return (
    <div
      onClick={onClick}
      className="rounded-2xl p-4 cursor-pointer transition-colors hover:bg-white/[0.02]"
      style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div className="flex items-start gap-3">
        {/* Emoji icon */}
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}20` }}
        >
          {cfg.emoji}
        </div>

        <div className="flex-1 min-w-0">
          {/* Type badge + live */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${cfg.color}15`, color: cfg.color }}>
              {cfg.label}
            </span>
            {isLive && (
              <span className="flex items-center gap-1 text-[9px] font-semibold text-[#00d4ff]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00d4ff] animate-pulse" /> Live
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold text-white truncate">{s.title as string}</h3>

          {/* Description preview */}
          {!!s.description && (
            <p className="text-[11px] text-[#4a5068] mt-0.5 line-clamp-2">{s.description as string}</p>
          )}

          {/* Author + time */}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-[#4a5068]">
            <span className="flex items-center gap-1">
              {s.author_avatar
                ? <img src={s.author_avatar as string} alt="" className="h-4 w-4 rounded-full object-cover" />
                : <User size={10} />
              }
              {(s.author_name || s.author_username || 'Anonymous') as string}
            </span>
            {timeAgo && (
              <span className="flex items-center gap-1">
                <Clock size={9} /> {timeAgo}
              </span>
            )}
          </div>
        </div>

        {/* Chat CTA — hide for signal owner */}
        {!isOwner && (
          <button
            onClick={(e) => { e.stopPropagation(); onClick?.(); }}
            className="shrink-0 h-9 w-9 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}
          >
            <MessageCircle size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
