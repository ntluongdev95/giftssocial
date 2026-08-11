'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Check, X as XIcon, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { parseUTC } from '@/lib/date';
import { useStreakDetail } from '@/hooks/useStreaks';
import { useAuthStore, selectUserId } from '@/stores/auth-store';

/** Focused verification page. Shows every pending tick on this streak that
 *  the viewer hasn't already voted on. One big card per tick with a large
 *  photo + Approve/Reject. After voting, the card animates out (via SWR
 *  refresh removing it from `pendingItems`). When nothing's left,
 *  shows a "you're all caught up" celebration and a link back to the
 *  streak detail. */
export default function StreakVerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const myUserId = useAuthStore(selectUserId);
  const { streak, isLoading, error, refresh } = useStreakDetail(id);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  if (isLoading && !streak) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0b0f]">
        <Loader2 size={20} className="animate-spin text-[#00d4ff]" />
      </div>
    );
  }

  if (error || !streak) {
    return (
      <div className="h-full bg-[#0a0b0f] flex items-center justify-center px-6 text-center">
        <div className="text-sm text-[#fca5a5]">
          Couldn&apos;t load streak. {error ? String(error.message ?? error) : ''}
        </div>
      </div>
    );
  }

  // Build the queue of pending ticks needing THIS viewer's vote. Excludes:
  //   - the viewer's own ticks (can't vote on self)
  //   - ticks already resolved (confirmed/rejected)
  //   - ticks where the viewer has already voted
  type QueueItem = {
    participantId: string;
    participantName: string;
    participantAvatar: string | null;
    date: string;
    note: string;
    photo_url: string | null;
    created_at: string;
    approves: number;
    rejects: number;
  };
  const queue: QueueItem[] = [];
  for (const p of streak.participants) {
    if (p.id === myUserId) continue;
    for (const c of p.checkins) {
      if (c.confirmation_state !== 'pending') continue;
      const alreadyVoted = c.votes.some(v => v.voter_id === myUserId);
      if (alreadyVoted) continue;
      queue.push({
        participantId: p.id,
        participantName: p.name,
        participantAvatar: p.avatar,
        date: c.date,
        note: c.note,
        photo_url: c.photo_url,
        created_at: c.created_at,
        approves: c.votes.filter(v => v.vote === 'approve').length,
        rejects: c.votes.filter(v => v.vote === 'reject').length,
      });
    }
  }
  // Newest pending first
  queue.sort((a, b) => b.created_at.localeCompare(a.created_at));

  async function vote(item: QueueItem, action: 'approve' | 'reject') {
    const key = `${item.participantId}|${item.date}`;
    setBusyKey(key);
    try {
      const res = await fetch(`/api/v1/streaks/${id}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ user_id: item.participantId, date: item.date, vote: action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message || 'Vote failed');
      }
      toast.success(action === 'approve' ? 'Approved ✓' : 'Rejected ✕');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#0a0b0f]">
      {/* Header */}
      <header
        className="sticky top-0 z-10"
        style={{
          background: 'rgba(10,11,15,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center gap-3 px-4 lg:px-8 xl:px-12 h-14 max-w-4xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer"
          >
            <ArrowLeft size={18} /> Back
          </button>
          <div className="flex items-center gap-2 mx-auto text-white truncate">
            <ShieldCheck size={16} className="text-[#00d4ff]" />
            <span className="text-sm font-bold truncate">Verify · {streak.title}</span>
          </div>
          <Link
            href={`/streaks/${id}`}
            className="text-[11px] font-semibold text-[#00d4ff] hover:underline"
          >
            Full feed →
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 lg:px-8 xl:px-12 pt-6 xl:pt-8 pb-24">
        {queue.length === 0 ? (
          <div
            className="rounded-2xl p-10 xl:p-14 text-center"
            style={{
              background:
                'linear-gradient(135deg, rgba(52,211,153,0.06), rgba(0,212,255,0.05))',
              border: '1px solid rgba(52,211,153,0.2)',
            }}
          >
            <div className="text-5xl mb-3">✓</div>
            <h2 className="text-lg font-bold text-white mb-1">All caught up</h2>
            <p className="text-sm text-[#a3adc3] mb-5">
              No pending ticks to verify on{' '}
              <span className="text-white font-medium">{streak.title}</span> right now.
            </p>
            <Link
              href={`/streaks/${id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold cursor-pointer"
              style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}
            >
              Open the streak
            </Link>
          </div>
        ) : (
          <>
            {/* Counter banner */}
            <div className="flex items-center gap-2 mb-4 text-[11px] text-[#a3adc3]">
              <span
                className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full text-xs font-bold"
                style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
              >
                {queue.length}
              </span>
              <span>tick{queue.length === 1 ? '' : 's'} waiting for your vote</span>
            </div>

            <ul className="space-y-4 xl:space-y-5">
              {queue.map(item => {
                const key = `${item.participantId}|${item.date}`;
                const ago = (() => {
                  const d = parseUTC(item.created_at);
                  return d ? formatDistanceToNow(d, { addSuffix: true }) : item.date;
                })();
                const busy = busyKey === key;
                return (
                  <li
                    key={key}
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: 'rgba(251,191,36,0.04)',
                      border: '1px solid rgba(251,191,36,0.22)',
                    }}
                  >
                    {/* Card header */}
                    <div className="flex items-center gap-3 px-4 lg:px-6 py-3 lg:py-4">
                      {item.participantAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.participantAvatar}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium text-[#a3adc3] shrink-0"
                          style={{ background: 'rgba(255,255,255,0.05)' }}
                        >
                          {item.participantName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-white truncate">
                          {item.participantName}
                        </div>
                        <div className="text-[11px] text-[#a3adc3] italic">
                          &ldquo;Just finished {streak.title} {streak.icon} — can you confirm?&rdquo;
                        </div>
                        <div className="text-[10px] text-[#4a5068] mt-0.5">
                          {item.date} · {ago}
                          {(item.approves > 0 || item.rejects > 0) && (
                            <span className="ml-2">
                              · {item.approves}↑ {item.rejects}↓
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Photo */}
                    {item.photo_url && (
                      <div className="bg-black flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.photo_url}
                          alt="proof"
                          className="max-h-[60vh] w-auto object-contain"
                        />
                      </div>
                    )}

                    {/* Note */}
                    {item.note && (
                      <p className="px-4 lg:px-6 py-3 text-sm text-[#a3adc3]">
                        {item.note}
                      </p>
                    )}

                    {/* Big action buttons */}
                    <div className="flex gap-2 lg:gap-3 px-4 lg:px-6 py-4 lg:py-5">
                      <button
                        onClick={() => vote(item, 'reject')}
                        disabled={busy}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 lg:py-3.5 text-sm font-bold cursor-pointer disabled:opacity-40 transition-transform active:scale-[0.98]"
                        style={{
                          background: 'rgba(248,113,113,0.1)',
                          color: '#fca5a5',
                          border: '1px solid rgba(248,113,113,0.3)',
                        }}
                      >
                        <XIcon size={18} /> Reject
                      </button>
                      <button
                        onClick={() => vote(item, 'approve')}
                        disabled={busy}
                        className="flex-[2] flex items-center justify-center gap-2 rounded-xl py-3 lg:py-3.5 text-sm font-bold cursor-pointer disabled:opacity-40 transition-transform active:scale-[0.98]"
                        style={{
                          background: 'linear-gradient(135deg, #34d399, #00d4ff)',
                          color: '#0a0b0f',
                          boxShadow: '0 6px 20px -6px rgba(52,211,153,0.5)',
                        }}
                      >
                        {busy ? <Loader2 size={18} className="animate-spin" /> : <><Check size={18} /> Approve</>}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
