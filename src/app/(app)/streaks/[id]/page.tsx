'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Flame, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { parseUTC } from '@/lib/date';
import { useStreakDetail, type StreakParticipantDetail } from '@/hooks/useStreaks';
import { localDateKey } from '@/lib/streaks';
import { StreakHeatmap } from '@/components/streaks/StreakHeatmap';
import { TickPhotoModal } from '@/components/streaks/TickPhotoModal';
import { StreakInsights } from '@/components/streaks/StreakInsights';
import { BondPetDisplay } from '@/components/streaks/BondPetDisplay';
import { PetGreeting } from '@/components/streaks/PetGreeting';
import { PetDiary } from '@/components/streaks/PetDiary';
import { PetCarePanel } from '@/components/streaks/PetCarePanel';
import { PetStage } from '@/components/streaks/PetStage';
import { PetCharacter, type PetActionType } from '@/components/streaks/PetCharacter';
import { PetVideoControl } from '@/components/streaks/PetVideoControl';
import { PetRoomOverlay } from '@/components/streaks/PetRoomOverlay';
import { AnniversaryOverlay } from '@/components/streaks/AnniversaryOverlay';
import { parseAgreedBy, getBirthType } from '@/lib/bond-pet';
import { useAuthStore, selectUserId } from '@/stores/auth-store';

const REACTIONS = ['🔥', '👏', '💪', '❤️', '🎉'] as const;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function StreakDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const myUserId = useAuthStore(selectUserId);
  const { streak, isLoading, error, refresh } = useStreakDetail(id);
  const [busy, setBusy] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [petRoomOpen, setPetRoomOpen] = useState(false);
  // Action trigger pipeline — bump on any pet interaction so PetCharacter
  // replays the matching motion + spawns the matching particle burst.
  const [petActionTick, setPetActionTick] = useState(0);
  const [lastPetAction, setLastPetAction] = useState<PetActionType | null>(null);
  function triggerPetAction(action: PetActionType) {
    setLastPetAction(action);
    setPetActionTick(n => n + 1);
  }
  // Stack of milestones to celebrate. Tick endpoint returns one at a time
  // but we keep this as state so multi-rapid-fire still feels right.
  const [celebratingMilestone, setCelebratingMilestone] = useState<{
    id: string; label: string; flair?: string | null; babies: number; species: string | null;
    syncedDays: number;
  } | null>(null);

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

  const me = streak.participants.find(p => p.id === myUserId);
  const others = streak.participants.filter(p => p.id !== myUserId);
  const ticked = !!me?.ticked_today;
  const isOwner = streak.owner_id === myUserId;

  async function tick() {
    if (busy) return;
    setBusy(true);
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
      const json = (await res.json()) as {
        data: {
          current_streak: number;
          synced_days?: number;
          milestone_reached?: {
            id: string; label: string; flair?: string | null; babies: number; species: string | null;
          } | null;
        };
      };
      toast.success(`🔥 ${json.data.current_streak} day streak!`);
      // Bond milestone hit → fire the anniversary celebration after the
      // SWR refresh so the underlying detail data is current.
      if (json.data.milestone_reached) {
        setCelebratingMilestone({
          ...json.data.milestone_reached,
          syncedDays: json.data.synced_days ?? 0,
        });
      }
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function untick() {
    if (busy) return;
    setBusy(true);
    try {
      const date = localDateKey();
      const res = await fetch(`/api/v1/streaks/${id}/tick?date=${date}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('Untick failed');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function react(participantId: string, date: string, emoji: string) {
    try {
      const res = await fetch(`/api/v1/streaks/${id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ user_id: participantId, date, emoji }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message || 'React failed');
      }
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function archive() {
    if (!confirm('Archive this streak? Buddies will lose access.')) return;
    try {
      const res = await fetch(`/api/v1/streaks/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('Archive failed');
      toast.success('Streak archived');
      router.push('/streaks');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function vote(participantId: string, date: string, voteType: 'approve' | 'reject') {
    try {
      const res = await fetch(`/api/v1/streaks/${id}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ user_id: participantId, date, vote: voteType }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message || 'Vote failed');
      }
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  }

  // Build live feed — all checkins across participants, newest first.
  const feed: Array<{
    participant: StreakParticipantDetail;
    date: string;
    note: string;
    created_at: string;
    photo_url: string | null;
    confirmation_state: 'pending' | 'confirmed' | 'rejected';
    votes: Array<{ voter_id: string; vote: 'approve' | 'reject' }>;
    reactions: Array<{ reactor_id: string; emoji: string }>;
  }> = [];
  for (const p of streak.participants) {
    for (const c of p.checkins) {
      feed.push({
        participant: p,
        date: c.date,
        note: c.note,
        created_at: c.created_at,
        photo_url: c.photo_url,
        confirmation_state: c.confirmation_state,
        votes: c.votes,
        reactions: c.reactions,
      });
    }
  }
  feed.sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Hoist pending-tick-needing-MY-vote out of the timeline so the user can
  // batch-verify several at once. They're scannable in a grid above the
  // regular activity, and disappear from there once they're resolved.
  const verifyQueue = feed.filter(f =>
    f.confirmation_state === 'pending' &&
    f.participant.id !== myUserId &&
    !f.votes.some(v => v.voter_id === myUserId)
  );
  // Remove the queue items from the main timeline — don't show twice.
  const verifyKeys = new Set(verifyQueue.map(f => `${f.participant.id}|${f.date}`));
  const recentFeed = feed
    .filter(f => !verifyKeys.has(`${f.participant.id}|${f.date}`))
    .slice(0, 30);

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
          <div className="flex items-center gap-2 mx-auto text-white truncate">
            <span className="text-base">{streak.icon}</span>
            <span className="text-sm font-bold truncate">{streak.title}</span>
          </div>
          {isOwner && (
            <button
              onClick={archive}
              className="p-1.5 rounded-full cursor-pointer hover:bg-white/10"
              aria-label="Archive"
            >
              <Trash2 size={14} className="text-[#fca5a5]" />
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl 2xl:max-w-375 mx-auto px-4 lg:px-8 xl:px-12 pt-6 xl:pt-8 pb-24">
        {/* 2-column on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-6 xl:gap-10">
          {/* LEFT: Hero + heatmap + feed */}
          <div className="space-y-6 xl:space-y-8 min-w-0">
            {/* Verify queue — surfaces when 1+ buddy submitted proof
                awaiting THIS viewer's vote. Hoisted above hero card so the
                user resolves them first, then sees the rest of the streak. */}
            {verifyQueue.length > 0 && (
              <section
                className="rounded-2xl p-4 lg:p-5 xl:p-6"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(248,113,113,0.04))',
                  border: '1px solid rgba(251,191,36,0.25)',
                }}
              >
                <div className="flex items-center gap-2 mb-3 lg:mb-4">
                  <span
                    className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full text-xs font-bold"
                    style={{
                      background: 'rgba(251,191,36,0.18)',
                      color: '#fbbf24',
                      border: '1px solid rgba(251,191,36,0.35)',
                    }}
                  >
                    {verifyQueue.length}
                  </span>
                  <h3 className="text-sm lg:text-base font-bold text-white">
                    waiting for your vote
                  </h3>
                </div>

                <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
                  {verifyQueue.map(f => {
                    const key = `${f.participant.id}|${f.date}`;
                    const ago = (() => {
                      const d = parseUTC(f.created_at);
                      return d ? formatDistanceToNow(d, { addSuffix: true }) : f.date;
                    })();
                    const approves = f.votes.filter(v => v.vote === 'approve').length;
                    const rejects = f.votes.filter(v => v.vote === 'reject').length;
                    return (
                      <li
                        key={key}
                        className="rounded-xl overflow-hidden flex flex-col"
                        style={{
                          background: 'rgba(10,11,15,0.5)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        {/* Photo — fixed aspect, fills width */}
                        {f.photo_url ? (
                          <div
                            className="bg-black flex items-center justify-center"
                            style={{ aspectRatio: '4 / 3' }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={f.photo_url}
                              alt="proof"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className="flex items-center justify-center text-[#4a5068] text-xs"
                            style={{ aspectRatio: '4 / 3', background: 'rgba(255,255,255,0.02)' }}
                          >
                            (no photo)
                          </div>
                        )}

                        {/* Meta + buttons */}
                        <div className="flex-1 flex flex-col p-3">
                          <div className="flex items-center gap-2 mb-2">
                            {f.participant.avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={f.participant.avatar}
                                alt=""
                                className="h-7 w-7 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div
                                className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] text-[#a3adc3] shrink-0 font-medium"
                                style={{ background: 'rgba(255,255,255,0.05)' }}
                              >
                                {f.participant.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-white truncate">
                                {f.participant.name}
                              </div>
                              <div className="text-[9px] text-[#4a5068]">
                                {ago}
                                {(approves > 0 || rejects > 0) && (
                                  <span className="ml-1">· {approves}↑ {rejects}↓</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {f.note && (
                            <p className="text-[11px] text-[#a3adc3] mb-2 line-clamp-2">
                              {f.note}
                            </p>
                          )}

                          <div className="flex gap-1.5 mt-auto">
                            <button
                              onClick={() => vote(f.participant.id, f.date, 'reject')}
                              className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold cursor-pointer transition-colors"
                              style={{
                                background: 'rgba(248,113,113,0.08)',
                                color: '#fca5a5',
                                border: '1px solid rgba(248,113,113,0.25)',
                              }}
                            >
                              ✕ Reject
                            </button>
                            <button
                              onClick={() => vote(f.participant.id, f.date, 'approve')}
                              className="flex-[1.6] flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold cursor-pointer transition-transform active:scale-95"
                              style={{
                                background: 'linear-gradient(135deg, #34d399, #00d4ff)',
                                color: '#0a0b0f',
                              }}
                            >
                              ✓ Approve
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* Bond pet — only for couple streaks. The hero is the big
                animated PetCharacter sitting on the sky+grass stage;
                BondPetDisplay drops below as a slim "family info" card
                with milestone progress. Care panel sits underneath. */}
            {streak.streak_type === 'couple' && (() => {
              const speciesEmoji = streak.bond_species ?? null;
              const breedImageUrl = streak.bond_breed_image_url ?? null;
              const breedLabel = streak.bond_breed_label ?? null;
              const participantIds = streak.participants.map(p => p.id);
              const agreed = parseAgreedBy(streak.bond_species_agreed_by ?? '[]');
              const fullyAgreed = participantIds.length > 0 &&
                participantIds.every(pid => agreed.includes(pid));
              const birthType = getBirthType(speciesEmoji);
              return (
                <div className="space-y-3">
                  <PetGreeting
                    streakId={streak.id}
                    initialGreeting={streak.pet_greeting ?? null}
                    initialGreetingAt={streak.pet_greeting_at ?? null}
                    speciesEmoji={speciesEmoji}
                  />
                  <PetStage
                    speciesEmoji={speciesEmoji}
                    onExpand={() => setPetRoomOpen(true)}
                    onTap={() => triggerPetAction('tap')}
                  >
                    <div
                      className="flex items-end justify-center"
                      style={{ minHeight: 280, paddingTop: 40, paddingBottom: 80 }}
                    >
                      {fullyAgreed && speciesEmoji ? (
                        <PetCharacter
                          speciesEmoji={speciesEmoji}
                          breedImageUrl={breedImageUrl}
                          breedLabel={breedLabel}
                          birthType={birthType}
                          actionTrigger={petActionTick}
                          lastAction={lastPetAction}
                          size={240}
                          videoUrl={streak.bond_breed_video_url ?? null}
                        />
                      ) : (
                        <div
                          className="flex items-center justify-center text-7xl"
                          style={{ height: 200 }}
                        >
                          {birthType === 'egg' ? '🥚' : (speciesEmoji ?? '💕')}
                        </div>
                      )}
                    </div>
                  </PetStage>
                  {fullyAgreed && breedImageUrl && (
                    <PetVideoControl
                      streakId={streak.id}
                      initialUrl={streak.bond_breed_video_url ?? null}
                      initialStatus={streak.bond_breed_video_status ?? null}
                      onReady={() => refresh()}
                    />
                  )}
                  <BondPetDisplay
                    species={speciesEmoji}
                    agreedByJson={streak.bond_species_agreed_by ?? '[]'}
                    participantIds={participantIds}
                    syncedDays={streak.synced_days ?? 0}
                    lastSyncDate={streak.last_sync_date ?? null}
                    todayKey={localDateKey()}
                    breedLabel={breedLabel}
                    breedImageUrl={breedImageUrl}
                  />
                  <PetCarePanel
                    streakId={streak.id}
                    speciesEmoji={speciesEmoji}
                    initialHappiness={streak.pet_happiness ?? 75}
                    initialEnergy={streak.pet_energy ?? 75}
                    initialBond={streak.pet_bond ?? 50}
                    initialLastAt={{
                      pet: streak.pet_last_pet_at ?? null,
                      feed: streak.pet_last_fed_at ?? null,
                      play: streak.pet_last_played_at ?? null,
                      walk: streak.pet_last_walked_at ?? null,
                    }}
                    onReaction={(_, __, action) => triggerPetAction(action)}
                  />
                </div>
              );
            })()}

            {/* Hero card */}
            <section
              className="rounded-2xl p-6 xl:p-8"
              style={{
                background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(168,85,247,0.06))',
                border: '1px solid rgba(0,212,255,0.2)',
              }}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="text-5xl shrink-0 select-none leading-none">{streak.icon}</div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-bold text-white">{streak.title}</h1>
                  {streak.description && (
                    <p className="text-sm text-[#a3adc3] mt-1">{streak.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-[#4a5068]">
                    <span>{streak.target_type === 'counter'
                      ? `${streak.target_value}${streak.target_unit ? ` ${streak.target_unit}` : ''} / day`
                      : 'Daily tick'}</span>
                    <span>·</span>
                    <span>
                      {streak.schedule.length === 7
                        ? 'Every day'
                        : streak.schedule.map(d => WEEKDAY_LABELS[d]).join(', ')}
                    </span>
                  </div>
                </div>
              </div>

              {/* My stats */}
              {me && (
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(10,11,15,0.5)' }}>
                    <div className="flex items-center gap-1 text-[#fbbf24]">
                      <Flame size={14} />
                      <span className="text-xl font-bold">{me.current_streak}</span>
                    </div>
                    <div className="text-[10px] text-[#4a5068] mt-0.5">Current</div>
                  </div>
                  <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(10,11,15,0.5)' }}>
                    <div className="text-xl font-bold text-white">{me.longest_streak}</div>
                    <div className="text-[10px] text-[#4a5068] mt-0.5">Longest</div>
                  </div>
                  <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(10,11,15,0.5)' }}>
                    <div className="text-xl font-bold text-[#34d399]">
                      {Math.round(me.completion_30d * 100)}%
                    </div>
                    <div className="text-[10px] text-[#4a5068] mt-0.5">30 days</div>
                  </div>
                </div>
              )}

              {/* Tick button — proof streaks open the photo compose modal
                  (FB-status style). Plain streaks tick instantly. */}
              {me && (
                <button
                  onClick={() => {
                    if (ticked) return untick();
                    if (streak.require_proof === 1) return setPhotoModalOpen(true);
                    return tick();
                  }}
                  disabled={busy}
                  className="w-full mt-4 rounded-xl py-3 text-sm font-bold cursor-pointer disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                  style={
                    ticked
                      ? { background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }
                      : { background: '#00d4ff', color: '#0a0b0f' }
                  }
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin mx-auto" />
                  ) : ticked ? (
                    '✓ Done today — tap to undo'
                  ) : streak.require_proof === 1 ? (
                    <>📷 Tick with photo</>
                  ) : (
                    <>🔥 Tick today</>
                  )}
                </button>
              )}
            </section>

            {/* My heatmap */}
            {me && (
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-3">
                  Your chain · last 12 weeks
                </h3>
                <div
                  className="rounded-2xl p-4 overflow-x-auto"
                  style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <StreakHeatmap ticks={me.checkins.map(c => c.date)} scheduleDays={streak.schedule} />
                </div>
              </section>
            )}

            {/* Pet diary — couple-only, shows AI-generated entries from
                the pet's POV. Auto-hides when no entries (e.g. AI not
                configured or no ticks yet). */}
            {streak.streak_type === 'couple' && (
              <PetDiary
                diaryJson={streak.pet_diary ?? null}
                petName={streak.bond_breed_label ?? null}
                speciesEmoji={streak.bond_species ?? null}
              />
            )}

            {/* Why it matters — AI-generated benefits + risks. Auto-fetches
                on first mount if not yet cached. */}
            <StreakInsights
              streakId={streak.id}
              initialBenefits={streak.insights_benefits ?? null}
              initialRisks={streak.insights_risks ?? null}
              initialGeneratedAt={streak.insights_generated_at ?? null}
              onRefresh={refresh}
            />

            {/* Live feed — modern timeline grouped by day, 2-col grid on lg. */}
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-3">
                Activity
              </h3>
              {recentFeed.length === 0 ? (
                <div className="rounded-2xl p-6 text-center text-xs text-[#4a5068]"
                  style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}
                >
                  No ticks yet. Be the first.
                </div>
              ) : (
                <ActivityTimeline
                  feed={recentFeed}
                  streakIcon={streak.icon}
                  myUserId={myUserId ?? null}
                  onReact={(uid, date, emoji) => react(uid, date, emoji)}
                />
              )}
            </section>
          </div>

          {/* RIGHT: Buddies leaderboard */}
          <aside className="space-y-4">
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-3">
                Buddies
              </h3>
              <div
                className="rounded-2xl divide-y"
                style={{
                  background: 'rgba(17,19,24,0.5)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any}
              >
                {others.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-[#4a5068]">
                    No buddies yet. Invite friends from the composer next time.
                  </div>
                ) : (
                  // Sort by current_streak desc — leaderboard
                  [...others, ...(me ? [me] : [])]
                    .sort((a, b) => b.current_streak - a.current_streak)
                    .map(p => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 px-4 py-3"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      >
                        {p.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.avatar} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                        ) : (
                          <div
                            className="h-9 w-9 rounded-full flex items-center justify-center text-sm text-[#a3adc3] shrink-0"
                            style={{ background: 'rgba(255,255,255,0.05)' }}
                          >
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-white truncate">
                            {p.id === myUserId ? 'You' : p.name}
                            {p.is_owner && (
                              <span className="ml-1.5 text-[9px] uppercase tracking-wider text-[#00d4ff]">owner</span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#4a5068]">
                            {Math.round(p.completion_30d * 100)}% · longest {p.longest_streak}
                          </div>
                        </div>
                        <div
                          className="flex items-center gap-1 rounded-full px-2.5 py-1 shrink-0"
                          style={{
                            background: p.ticked_today ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.08)',
                            border: p.ticked_today
                              ? '1px solid rgba(52,211,153,0.3)'
                              : '1px solid rgba(251,191,36,0.2)',
                          }}
                        >
                          <Flame size={12} className={p.ticked_today ? 'text-[#34d399]' : 'text-[#fbbf24]'} />
                          <span className="text-xs font-bold text-white">{p.current_streak}</span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </section>
          </aside>
        </div>
      </main>

      {/* FB-status-compose photo tick modal — only mounted for proof streaks */}
      {streak.require_proof === 1 && (
        <TickPhotoModal
          open={photoModalOpen}
          streakId={streak.id}
          streakTitle={streak.title}
          streakIcon={streak.icon}
          authorName={me?.name ?? null}
          authorAvatar={me?.avatar ?? null}
          onTicked={() => refresh()}
          onClose={() => setPhotoModalOpen(false)}
        />
      )}

      {/* Bond milestone celebration — fires after a tick that crossed a
          stage boundary on a couple streak. */}
      <AnniversaryOverlay
        open={!!celebratingMilestone}
        milestone={celebratingMilestone}
        syncedDays={celebratingMilestone?.syncedDays ?? 0}
        streakTitle={streak.title}
        streakId={streak.id}
        breedImageUrl={streak.bond_breed_image_url ?? null}
        breedLabel={streak.bond_breed_label ?? null}
        onClose={() => setCelebratingMilestone(null)}
      />

      {/* Fullscreen pet room — only relevant for couple streaks; the
          expand button on PetStage opens this. */}
      {streak.streak_type === 'couple' && (
        <PetRoomOverlay
          open={petRoomOpen}
          onClose={() => setPetRoomOpen(false)}
          streakId={streak.id}
          streakTitle={streak.title}
          speciesEmoji={streak.bond_species ?? null}
          breedImageUrl={streak.bond_breed_image_url ?? null}
          breedLabel={streak.bond_breed_label ?? null}
          birthType={getBirthType(streak.bond_species ?? null)}
          videoUrl={streak.bond_breed_video_url ?? null}
          petName={streak.bond_breed_label ?? null}
          greeting={(
            <PetGreeting
              streakId={streak.id}
              initialGreeting={streak.pet_greeting ?? null}
              initialGreetingAt={streak.pet_greeting_at ?? null}
              speciesEmoji={streak.bond_species ?? null}
            />
          )}
          initialHappiness={streak.pet_happiness ?? 75}
          initialEnergy={streak.pet_energy ?? 75}
          initialBond={streak.pet_bond ?? 50}
          initialLastAt={{
            pet: streak.pet_last_pet_at ?? null,
            feed: streak.pet_last_fed_at ?? null,
            play: streak.pet_last_played_at ?? null,
            walk: streak.pet_last_walked_at ?? null,
          }}
        />
      )}
    </div>
  );
}

// ── Activity timeline ────────────────────────────────────────────────────

type FeedItem = {
  participant: StreakParticipantDetail;
  date: string;
  note: string;
  created_at: string;
  photo_url: string | null;
  confirmation_state: 'pending' | 'confirmed' | 'rejected';
  votes: Array<{ voter_id: string; vote: 'approve' | 'reject' }>;
  reactions: Array<{ reactor_id: string; emoji: string }>;
};

/** Group consecutive feed items by date, render under a sticky day label.
 *  Cards are compact + grid on lg+ so wide screens don't waste space. */
function ActivityTimeline({
  feed,
  streakIcon,
  myUserId,
  onReact,
}: {
  feed: FeedItem[];
  streakIcon: string;
  myUserId: string | null;
  onReact: (uid: string, date: string, emoji: string) => void;
}) {
  // Group by f.date. Map preserves insertion order — feed comes pre-sorted
  // newest first, so day groups arrive in the right order.
  const groups = new Map<string, FeedItem[]>();
  for (const f of feed) {
    const arr = groups.get(f.date) ?? [];
    arr.push(f);
    groups.set(f.date, arr);
  }

  return (
    <div className="space-y-5 xl:space-y-6">
      {Array.from(groups.entries()).map(([date, items]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#a3adc3]">
              {humanDayLabel(date)}
            </div>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
            <div className="text-[10px] text-[#4a5068]">
              {items.length} {items.length === 1 ? 'tick' : 'ticks'}
            </div>
          </div>
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {items.map((f, i) => (
              <ActivityCard
                key={`${f.participant.id}-${f.date}-${i}`}
                item={f}
                streakIcon={streakIcon}
                myUserId={myUserId}
                onReact={onReact}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ActivityCard({
  item,
  streakIcon,
  myUserId,
  onReact,
}: {
  item: FeedItem;
  streakIcon: string;
  myUserId: string | null;
  onReact: (uid: string, date: string, emoji: string) => void;
}) {
  const isMyOwn = item.participant.id === myUserId;
  const isRejected = item.confirmation_state === 'rejected';
  const isPendingMine = item.confirmation_state === 'pending' && isMyOwn;
  const ago = (() => {
    const d = parseUTC(item.created_at);
    return d ? formatDistanceToNow(d, { addSuffix: true }) : item.date;
  })();
  const myReactions = new Set(
    item.reactions.filter(r => r.reactor_id === myUserId).map(r => r.emoji),
  );
  const reactionCounts = item.reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <li
      className="rounded-2xl overflow-hidden flex flex-col transition-colors hover:bg-white/2"
      style={{
        background: isRejected
          ? 'rgba(248,113,113,0.04)'
          : isPendingMine
            ? 'rgba(251,191,36,0.04)'
            : 'rgba(17,19,24,0.5)',
        border: isRejected
          ? '1px solid rgba(248,113,113,0.18)'
          : isPendingMine
            ? '1px solid rgba(251,191,36,0.18)'
            : '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Photo — capped height so it doesn't dominate */}
      {item.photo_url && (
        <div className="bg-black flex items-center justify-center" style={{ maxHeight: 220 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.photo_url}
            alt="proof"
            className="w-full h-auto object-cover"
            style={{ maxHeight: 220 }}
          />
        </div>
      )}

      <div className="p-3 flex flex-col gap-2">
        {/* Header: avatar + name + state + time */}
        <div className="flex items-center gap-2.5">
          {item.participant.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.participant.avatar}
              alt=""
              className="h-8 w-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs text-[#a3adc3] shrink-0 font-medium"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              {item.participant.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
              {isMyOwn ? 'You' : item.participant.name}
              <span className="text-[#a3adc3] font-normal text-xs">
                · {isPendingMine ? 'submitted' : isRejected ? 'rejected' : 'ticked'}
              </span>
              <span aria-hidden>{streakIcon}</span>
              {isRejected && (
                <span
                  className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                  style={{
                    background: 'rgba(248,113,113,0.12)',
                    color: '#fca5a5',
                    border: '1px solid rgba(248,113,113,0.25)',
                  }}
                >
                  rejected
                </span>
              )}
              {isPendingMine && (
                <span
                  className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                  style={{
                    background: 'rgba(251,191,36,0.12)',
                    color: '#fbbf24',
                    border: '1px solid rgba(251,191,36,0.25)',
                  }}
                >
                  pending
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#4a5068]">{ago}</div>
          </div>
        </div>

        {/* Note */}
        {item.note && (
          <p className="text-xs text-[#a3adc3] leading-relaxed">{item.note}</p>
        )}

        {/* Reactions row — counts + add picker (only others) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.entries(reactionCounts).map(([emoji, count]) => {
            const mine = myReactions.has(emoji);
            return (
              <span
                key={emoji}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                style={{
                  background: mine ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: mine ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(255,255,255,0.05)',
                  color: '#fff',
                }}
              >
                {emoji} <span className="text-[10px] text-[#a3adc3]">{count}</span>
              </span>
            );
          })}
          {!isMyOwn && (
            <div
              className="inline-flex items-center gap-0.5 rounded-full px-1 py-0.5"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {REACTIONS.map(e => (
                <button
                  key={e}
                  onClick={() => onReact(item.participant.id, item.date, e)}
                  disabled={myReactions.has(e)}
                  className="h-6 w-6 rounded-full flex items-center justify-center text-sm cursor-pointer hover:bg-white/10 disabled:opacity-30 disabled:cursor-default transition-colors"
                  aria-label={`React with ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/** "Today", "Yesterday", or "Mon, Jun 15" for older dates. Falls back to
 *  the raw YYYY-MM-DD if Date parsing fails. */
function humanDayLabel(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  if (!y || !m || !d) return yyyyMmDd;
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - target.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return target.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
