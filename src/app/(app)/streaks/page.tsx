'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Flame, Loader2, Mail, Check, X as XIcon, Calendar, Users, Camera } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { parseUTC } from '@/lib/date';
import { useStreakList, useStreakInvites, type StreakInvite } from '@/hooks/useStreaks';
import { localDateKey, parseSchedule } from '@/lib/streaks';
import { StreakRow } from '@/components/streaks/StreakRow';
import { StreakComposer } from '@/components/streaks/StreakComposer';

export default function StreaksPage() {
  const router = useRouter();
  const { streaks, isLoading, error, refresh } = useStreakList();
  const { invites, refresh: refreshInvites } = useStreakInvites();
  const [composerOpen, setComposerOpen] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  async function respond(invite: StreakInvite, action: 'accept' | 'decline') {
    setRespondingId(invite.id);
    try {
      const res = await fetch(`/api/v1/streaks/${invite.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message || 'Failed');
      }
      if (action === 'accept') {
        toast.success(`Joined "${invite.title}" ${invite.icon}`);
      } else {
        toast.success('Invite declined');
      }
      // Refresh both — invite list drops the item, main list picks it up
      // (or not, if declined).
      refreshInvites();
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setRespondingId(null);
    }
  }

  async function quickTick(id: string) {
    try {
      const date = localDateKey();
      const res = await fetch(`/api/v1/streaks/${id}/tick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ date }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message || 'Tick failed');
      }
      const json = (await res.json()) as { data: { current_streak: number } };
      toast.success(`🔥 ${json.data.current_streak} day streak!`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
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
        <div className="flex items-center gap-3 px-4 lg:px-8 xl:px-12 h-14 max-w-7xl 2xl:max-w-375 mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer"
          >
            <ArrowLeft size={18} /> Back
          </button>
          <div className="flex items-center gap-2 mx-auto text-white">
            <Flame size={16} className="text-[#fbbf24]" />
            <span className="text-sm font-bold">Streaks</span>
          </div>
          <button
            onClick={() => setComposerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer"
            style={{ background: '#00d4ff', color: '#0a0b0f' }}
          >
            <Plus size={14} /> New
          </button>
        </div>
      </header>

      <main className="max-w-7xl 2xl:max-w-375 mx-auto px-4 lg:px-8 xl:px-12 pt-6 xl:pt-8 pb-24">
        {/* Pending invites — surfaces first so users don't miss them. Each
            card has Accept + Decline buttons; tapping Decline removes the
            invite without joining the streak. */}
        {invites.length > 0 && (
          <section className="mb-6 xl:mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Mail size={14} className="text-[#00d4ff]" />
              <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[#00d4ff]">
                {invites.length} {invites.length === 1 ? 'pending invite' : 'pending invites'}
              </h2>
            </div>
            <ul className="grid grid-cols-1 xl:grid-cols-2 gap-4 xl:gap-5">
              {invites.map(inv => {
                const busy = respondingId === inv.id;
                const scheduleLabel = formatSchedule(inv.schedule_json);
                const targetLabel = inv.target_type === 'counter'
                  ? `${inv.target_value}${inv.target_unit ? ` ${inv.target_unit}` : ''} / day`
                  : 'Daily tick';
                const invitedAgo = (() => {
                  const d = parseUTC(inv.invited_at);
                  return d ? formatDistanceToNow(d, { addSuffix: true }) : '';
                })();
                const ownerLabel = inv.owner_name || inv.owner_username || 'A friend';
                return (
                  <li
                    key={inv.id}
                    className="rounded-2xl p-5 xl:p-6"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(0,212,255,0.10), rgba(168,85,247,0.06) 60%, rgba(236,72,153,0.04))',
                      border: '1px solid rgba(0,212,255,0.25)',
                      boxShadow: '0 8px 30px -8px rgba(0,212,255,0.15)',
                    }}
                  >
                    {/* Hero: icon halo + title + description */}
                    <div className="flex items-start gap-4 mb-4">
                      <div
                        className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 text-3xl leading-none"
                        style={{
                          background: 'radial-gradient(circle, rgba(0,212,255,0.22), rgba(168,85,247,0.06))',
                          border: '1px solid rgba(0,212,255,0.3)',
                        }}
                      >
                        {inv.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base xl:text-lg font-bold text-white truncate">
                          {inv.title}
                        </h3>
                        {inv.description ? (
                          <p className="text-xs text-[#a3adc3] mt-1 line-clamp-2">
                            {inv.description}
                          </p>
                        ) : (
                          <p className="text-xs text-[#4a5068] mt-1">
                            {targetLabel} · {scheduleLabel}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Owner row */}
                    <div className="flex items-center gap-2.5 mb-3">
                      {inv.owner_avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={inv.owner_avatar}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center text-xs text-[#a3adc3] shrink-0 font-medium"
                          style={{ background: 'rgba(255,255,255,0.06)' }}
                        >
                          {ownerLabel.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white">
                          <span className="font-semibold">{ownerLabel}</span>
                          <span className="text-[#a3adc3]"> invited you</span>
                        </div>
                        {invitedAgo && (
                          <div className="text-[10px] text-[#4a5068]">{invitedAgo}</div>
                        )}
                      </div>
                    </div>

                    {/* Info chips */}
                    <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                      <Chip icon={<Calendar size={10} />} label={scheduleLabel} />
                      {inv.partner_count > 1 && (
                        <Chip
                          icon={<Users size={10} />}
                          label={`${inv.partner_count} ${inv.partner_count === 1 ? 'person' : 'people'}`}
                        />
                      )}
                      {inv.target_type === 'counter' && (
                        <Chip label={targetLabel} />
                      )}
                      {inv.require_proof === 1 && (
                        <Chip
                          icon={<Camera size={10} />}
                          label="Photo proof"
                          tone="amber"
                        />
                      )}
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => respond(inv, 'accept')}
                        disabled={busy}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold cursor-pointer disabled:opacity-40 transition-transform active:scale-[0.98]"
                        style={{
                          background: 'linear-gradient(135deg, #00d4ff, #a855f7)',
                          color: '#0a0b0f',
                          boxShadow: '0 6px 20px -6px rgba(0,212,255,0.5)',
                        }}
                      >
                        {busy ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <>
                            <Check size={16} /> Accept
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => respond(inv, 'decline')}
                        disabled={busy}
                        className="flex items-center justify-center gap-1.5 rounded-xl px-5 py-3 text-sm font-semibold cursor-pointer disabled:opacity-40 transition-colors hover:bg-white/5"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          color: '#a3adc3',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        <XIcon size={14} /> Decline
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Empty / loading / error */}
        {isLoading && streaks.length === 0 && (
          <div className="flex items-center justify-center py-16 text-[#4a5068]">
            <Loader2 size={20} className="animate-spin text-[#00d4ff]" />
          </div>
        )}

        {error && !isLoading && (
          <div
            className="rounded-xl p-4 text-sm"
            style={{
              background: 'rgba(248,113,113,0.06)',
              border: '1px solid rgba(248,113,113,0.2)',
              color: '#fca5a5',
            }}
          >
            Couldn&apos;t load streaks. {String(error.message ?? error)}
          </div>
        )}

        {!isLoading && !error && streaks.length === 0 && (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="text-5xl mb-3">🔥</div>
            <p className="font-medium text-[#a3adc3] mb-1">No streaks yet</p>
            <p className="text-xs text-[#4a5068] mb-4">
              Build a daily habit. Invite a friend to keep the chain together.
            </p>
            <button
              onClick={() => setComposerOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold cursor-pointer"
              style={{ background: '#00d4ff', color: '#0a0b0f' }}
            >
              <Plus size={14} /> Create your first streak
            </button>
          </div>
        )}

        {/* Streaks grid — mobile stack, md+ 2-col, xl+ 3-col so odd counts
            (3, 5, 7) sit on one row instead of leaving huge holes. */}
        {streaks.length > 0 && (
          <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 xl:gap-4">
            {streaks.map(s => (
              <li key={s.id}>
                <StreakRow streak={s} onTick={quickTick} onProofSubmitted={refresh} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <StreakComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={() => {
          refresh();
        }}
      />
    </div>
  );
}

/** Small info chip used on the invite cards. Default tone is cyan; pass
 *  `tone='amber'` for special badges like Photo proof so they pop out. */
function Chip({
  icon,
  label,
  tone = 'cyan',
}: {
  icon?: React.ReactNode;
  label: string;
  tone?: 'cyan' | 'amber';
}) {
  const colors =
    tone === 'amber'
      ? {
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.25)',
          color: '#fbbf24',
        }
      : {
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: '#a3adc3',
        };
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium"
      style={colors}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}

/** Render the weekly schedule as a human label. */
function formatSchedule(scheduleJson: string): string {
  const set = parseSchedule(scheduleJson);
  const days = Array.from(set).sort();
  if (days.length === 7) return 'Every day';
  const isWeekdays = days.length === 5 && [1, 2, 3, 4, 5].every(d => set.has(d));
  if (isWeekdays) return 'Mon–Fri';
  const isWeekend = days.length === 2 && set.has(0) && set.has(6);
  if (isWeekend) return 'Weekends';
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (days.length <= 3) return days.map(d => labels[d]).join(' · ');
  return `${days.length}× per week`;
}
