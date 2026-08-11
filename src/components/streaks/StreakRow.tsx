'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Flame, Users, Camera } from 'lucide-react';
import type { StreakListItem } from '@/hooks/useStreaks';
import { StreakHeatmap } from './StreakHeatmap';
import { TickPhotoModal } from './TickPhotoModal';

type Props = {
  streak: StreakListItem;
  onTick: (id: string) => void;
  /** Called after a proof tick is submitted so the parent can SWR-refresh. */
  onProofSubmitted?: () => void;
};

/** Single row in the streaks list. Shows: icon + title + my current streak +
 *  buddy avatars with their own streaks + a quick-tick button for today,
 *  and a tiny heatmap of the last 12 weeks. */
export function StreakRow({ streak, onTick, onProofSubmitted }: Props) {
  const allParticipants = [streak.owner, ...streak.partners.filter(p => p.id !== streak.owner.id)];
  const needsProof = streak.require_proof === 1;
  const [photoModal, setPhotoModal] = useState(false);

  // Stop the card's Link from firing when the user clicks something
  // interactive (Tick button, buddy chips). Without this every tap on
  // the row would navigate to detail.
  const swallow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <Link
        href={`/streaks/${streak.id}`}
        className="block rounded-2xl p-4 xl:p-5 cursor-pointer transition-colors hover:bg-white/2 focus-visible:outline-2 focus-visible:outline-[#00d4ff]"
        style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
      >
        {/* Top row — icon + title + my count */}
        <div className="flex items-start gap-3 mb-3">
          <div className="text-3xl select-none shrink-0 leading-none mt-1">{streak.icon}</div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{streak.title}</h3>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-[#4a5068]">
              <Flame size={12} className="text-[#fbbf24]" />
              <span className="font-semibold text-[#fbbf24]">
                {streak.my_current_streak} day{streak.my_current_streak === 1 ? '' : 's'}
              </span>
              <span>·</span>
              <span>{Math.round(streak.my_completion_30d * 100)}% (30d)</span>
              {streak.partners.length > 0 && (
                <>
                  <span>·</span>
                  <Users size={12} />
                  <span>{streak.partners.length + 1}</span>
                </>
              )}
            </div>
          </div>

          {/* Quick tick — swallow navigation so tapping the button only
              ticks (or opens the photo modal), never opens detail. */}
          <button
            onClick={e => {
              swallow(e);
              if (streak.my_ticked_today) return;
              if (needsProof) setPhotoModal(true);
              else onTick(streak.id);
            }}
            disabled={streak.my_ticked_today}
            className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:cursor-default transition-colors"
            style={
              streak.my_ticked_today
                ? { background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }
                : { background: '#00d4ff', color: '#0a0b0f', border: '1px solid #00d4ff' }
            }
            aria-label={streak.my_ticked_today ? 'Already ticked today' : 'Tick today'}
          >
            {streak.my_ticked_today ? '✓ Done' : (
              <>
                {needsProof && <Camera size={12} />}
                {needsProof ? 'Tick + photo' : 'Tick'}
              </>
            )}
          </button>
        </div>

        {/* Buddies row */}
        {allParticipants.length > 1 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {allParticipants.map(p => (
              <div
                key={p.id}
                className="flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1"
                style={{
                  background: p.ticked_today ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.03)',
                  border: p.ticked_today
                    ? '1px solid rgba(52,211,153,0.25)'
                    : '1px solid rgba(255,255,255,0.05)',
                }}
                title={`${p.name} · ${p.current} day streak${p.ticked_today ? ' · ticked today' : ''}`}
              >
                {p.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar} alt="" className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <div
                    className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] text-[#a3adc3]"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-[10px] font-semibold text-white">{p.current}</span>
                <Flame size={10} className={p.ticked_today ? 'text-[#34d399]' : 'text-[#4a5068]'} />
              </div>
            ))}
          </div>
        )}

        {/* Heatmap */}
        <StreakHeatmap
          ticks={streak.my_ticks}
          scheduleDays={streak.schedule}
          days={84}
          showLabels={false}
        />
      </Link>

      {/* Modal lives OUTSIDE the Link so opening it via the Tick button
          doesn't bubble a navigation. */}
      {needsProof && (
        <TickPhotoModal
          open={photoModal}
          streakId={streak.id}
          streakTitle={streak.title}
          streakIcon={streak.icon}
          onTicked={() => onProofSubmitted?.()}
          onClose={() => setPhotoModal(false)}
        />
      )}
    </>
  );
}
