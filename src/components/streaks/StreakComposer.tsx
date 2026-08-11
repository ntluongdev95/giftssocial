'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ReminderSection } from './ReminderSection';
import { BondSpeciesPicker } from './BondSpeciesPicker';

const PRESET_ICONS = ['🔥', '🏃', '🧘', '💧', '🥗', '🚴', '💪', '📚', '🎧', '☕', '🧠', '🌱'];

// Each habit emoji gets a thematic micro-animation. Keys match PRESET_ICONS.
// All keyframes live in <IconKeyframes /> below — single inline <style> so
// the file is self-contained and the animations don't pollute global CSS.
const ICON_ANIMATIONS: Record<string, string> = {
  '🔥': 'streak-flicker 1.6s ease-in-out infinite',
  '🏃': 'streak-run 0.9s ease-in-out infinite',
  '🧘': 'streak-breathe 3.2s ease-in-out infinite',
  '💧': 'streak-drop 1.8s ease-in-out infinite',
  '🥗': 'streak-toss 4s linear infinite',
  '🚴': 'streak-lean 1.4s ease-in-out infinite',
  '💪': 'streak-flex 1.6s ease-in-out infinite',
  '📚': 'streak-sway 3s ease-in-out infinite',
  '🎧': 'streak-bob 1.1s ease-in-out infinite',
  '☕': 'streak-steam 2.2s ease-in-out infinite',
  '🧠': 'streak-pulse 2s ease-in-out infinite',
  '🌱': 'streak-grow 2.6s ease-in-out infinite',
};
const WEEKDAYS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

type FriendOption = { id: string; name: string; avatar?: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
};

/** Bottom sheet on mobile, centred modal on desktop. Same shell pattern as
 * StoryComposer + ConstellationComposer so the app feels consistent. */
export function StreakComposer({ open, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('🔥');
  const [targetType, setTargetType] = useState<'check' | 'counter'>('check');
  const [targetValue, setTargetValue] = useState<number>(1);
  const [targetUnit, setTargetUnit] = useState('');
  const [schedule, setSchedule] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
  const [visibility, setVisibility] = useState<'private' | 'friends'>('friends');

  // Partners
  const [friends, setFriends] = useState<FriendOption[]>([]);
  const [selectedPartners, setSelectedPartners] = useState<Set<string>>(new Set());
  const [showPartnersPicker, setShowPartnersPicker] = useState(false);

  // Reminder
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('07:00');
  const [reminderTz, setReminderTz] = useState('');

  // Proof + peer approval
  const [requireProof, setRequireProof] = useState(false);

  // Couple/bond mode
  const [streakType, setStreakType] = useState<'solo' | 'group' | 'couple'>('solo');
  const [bondSpecies, setBondSpecies] = useState<string | null>(null);
  const [bondBreedId, setBondBreedId] = useState<string | null>(null);
  const [bondBreedLabel, setBondBreedLabel] = useState<string | null>(null);
  const [bondBreedImageUrl, setBondBreedImageUrl] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setTitle('');
      setIcon('🔥');
      setTargetType('check');
      setTargetValue(1);
      setTargetUnit('');
      setSchedule(new Set([0, 1, 2, 3, 4, 5, 6]));
      setVisibility('friends');
      setSelectedPartners(new Set());
      setShowPartnersPicker(false);
      setReminderEnabled(false);
      setReminderTime('07:00');
      setReminderTz('');
      setRequireProof(false);
      setStreakType('solo');
      setBondSpecies(null);
      setBondBreedId(null);
      setBondBreedLabel(null);
      setBondBreedImageUrl(null);
      setSubmitting(false);
    }
  }, [open]);

  // Couple mode auto-trims partners to exactly 1 — last selected wins.
  useEffect(() => {
    if (streakType === 'couple' && selectedPartners.size > 1) {
      const last = Array.from(selectedPartners).at(-1)!;
      setSelectedPartners(new Set([last]));
    }
  }, [streakType, selectedPartners]);

  // Fetch following list when opened
  useEffect(() => {
    if (!open) return;
    fetch('/api/v1/follows?type=following', { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d?.data) return;
        const mapped: FriendOption[] = (d.data as Array<Record<string, unknown>>).map(f => ({
          id: (f.following_user_id || f.id) as string,
          name: (f.user_name || f.display_name || 'User') as string,
          avatar: (f.user_avatar || f.avatar_url) as string | undefined,
        }));
        setFriends(mapped);
      })
      .catch(() => {});
  }, [open]);

  function toggleDay(d: number) {
    setSchedule(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      // Never allow empty schedule.
      if (next.size === 0) return prev;
      return next;
    });
  }

  function togglePartner(id: string) {
    setSelectedPartners(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!title.trim()) {
      toast.error('Add a title');
      return;
    }
    if (streakType === 'couple') {
      if (selectedPartners.size !== 1) {
        toast.error('Couple streaks need exactly one partner');
        return;
      }
      if (!bondSpecies) {
        toast.error('Pick a pet species to adopt together');
        return;
      }
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        icon,
        target_type: targetType,
        target_value: targetValue,
        target_unit: targetUnit,
        schedule: Array.from(schedule).sort(),
        visibility,
        partner_ids: Array.from(selectedPartners),
      };
      if (reminderEnabled && reminderTime && reminderTz) {
        body.reminder_at = reminderTime;
        body.reminder_tz = reminderTz;
      }
      if (requireProof) body.require_proof = true;
      if (streakType !== 'solo') body.streak_type = streakType;
      if (streakType === 'couple' && bondSpecies) body.bond_species = bondSpecies;
      if (streakType === 'couple' && bondBreedId) {
        body.bond_breed_id = bondBreedId;
        body.bond_breed_label = bondBreedLabel;
        body.bond_breed_image_url = bondBreedImageUrl;
      }
      const res = await fetch('/api/v1/streaks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message || `Create failed (${res.status})`);
      }
      const created = (await res.json()) as { data: { id: string } };
      toast.success(`Streak created ${icon}`);
      onCreated?.(created.data.id);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-260 flex items-end justify-center lg:items-center lg:p-6"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        // Intentionally NO onClick={onClose} on the backdrop — users were
        // losing half-filled forms by mis-tapping outside the modal. Close
        // only via the explicit ✕ button in the header.
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          onClick={e => e.stopPropagation()}
          className="w-full lg:max-w-4xl lg:min-w-215 max-h-[92vh] overflow-y-auto rounded-t-3xl lg:rounded-3xl flex flex-col"
          style={{
            background: '#0a0b0f',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 60px -10px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <button onClick={onClose} className="p-1 rounded-full cursor-pointer hover:bg-white/10">
              <X size={20} className="text-white" />
            </button>
            <div className="text-sm font-semibold text-white">New Streak 🔥</div>
            <button
              onClick={submit}
              disabled={submitting}
              className="px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer disabled:opacity-40"
              style={{ background: '#00d4ff', color: '#0a0b0f' }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
            </button>
          </div>

          {/* 2-column on desktop: LEFT = identity (preview + title + icon +
              target), RIGHT = scheduling/social (days + buddies + visibility +
              reminder). Mobile stays single-column. */}
          <div className="px-4 lg:px-8 pb-8 lg:grid lg:grid-cols-2 lg:gap-x-12 lg:items-start space-y-5 lg:space-y-0">
          <div className="space-y-5">
            {/* Mode picker — Solo / Group / Couple */}
            <Section label="Mode">
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: 'solo',   label: 'Solo',    sub: 'Just you',         icon: '🧑' },
                  { v: 'group',  label: 'Group',   sub: 'Friends',          icon: '👥' },
                  { v: 'couple', label: 'Couple',  sub: 'Adopt a pet',      icon: '💕' },
                ] as const).map(m => {
                  const active = streakType === m.v;
                  return (
                    <button
                      key={m.v}
                      onClick={() => setStreakType(m.v)}
                      className="flex flex-col items-center gap-1 rounded-xl py-3 cursor-pointer transition-colors"
                      style={
                        active
                          ? m.v === 'couple'
                            ? { background: 'rgba(236,72,153,0.12)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.4)' }
                            : { background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }
                          : { background: 'rgba(255,255,255,0.03)', color: '#a3adc3', border: '1px solid rgba(255,255,255,0.05)' }
                      }
                    >
                      <span className="text-xl">{m.icon}</span>
                      <span className="text-xs font-bold">{m.label}</span>
                      <span className="text-[9px] opacity-70">{m.sub}</span>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Adopt a pet — only for couple mode */}
            {streakType === 'couple' && (
              <Section label="Adopt a pet together">
                <BondSpeciesPicker
                  value={bondSpecies}
                  breedId={bondBreedId}
                  onChange={(species, breed) => {
                    setBondSpecies(species);
                    setBondBreedId(breed?.id ?? null);
                    setBondBreedLabel(breed?.label ?? null);
                    setBondBreedImageUrl(breed?.image_url ?? null);
                  }}
                />
                {bondBreedLabel && bondBreedImageUrl && (
                  <div
                    className="mt-3 flex items-center gap-3 rounded-xl p-2.5"
                    style={{
                      background: 'rgba(236,72,153,0.06)',
                      border: '1px solid rgba(236,72,153,0.25)',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={bondBreedImageUrl}
                      alt={bondBreedLabel}
                      className="h-12 w-12 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white">
                        You picked {bondBreedLabel} {bondSpecies}
                      </div>
                      <div className="text-[10px] text-[#ec4899]">
                        Tap the species again to change
                      </div>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-[#4a5068] mt-2">
                  Your partner will see your choice on the invite and adopt with you.
                </p>
              </Section>
            )}

            {/* Preview */}
            <div
              className="flex items-center gap-3 rounded-2xl p-4"
              style={{
                background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(168,85,247,0.08))',
                border: '1px solid rgba(0,212,255,0.15)',
              }}
            >
              <div className="text-4xl select-none">{icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">
                  {title || 'Untitled streak'}
                </div>
                <div className="text-[10px] text-[#a3adc3]">
                  {targetType === 'counter' && targetValue > 1
                    ? `${targetValue}${targetUnit ? ` ${targetUnit}` : ''} / day`
                    : 'Daily tick'}
                  {' · '}
                  {schedule.size === 7 ? 'every day' : `${schedule.size}× per week`}
                </div>
              </div>
            </div>

            {/* Title */}
            <Section label="Title">
              <input
                value={title}
                onChange={e => setTitle(e.target.value.slice(0, 80))}
                placeholder="e.g. Morning run, Drink 2L water"
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#4a5068]"
                style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
              />
            </Section>

            {/* Icon */}
            <Section label="Icon">
              <IconKeyframes />
              <div className="grid grid-cols-6 gap-2">
                {PRESET_ICONS.map((e, i) => {
                  const selected = icon === e;
                  return (
                    <button
                      key={e}
                      onClick={() => setIcon(e)}
                      className="aspect-square rounded-xl flex items-center justify-center text-2xl cursor-pointer transition-colors"
                      style={{
                        background: selected ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.03)',
                        border: selected ? '1px solid rgba(0,212,255,0.4)' : '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <span
                        className="inline-block leading-none"
                        style={{
                          // Stagger so all 12 icons aren't in lockstep — gives
                          // the grid a "swarm" feel rather than a marching one.
                          animation: ICON_ANIMATIONS[e] || undefined,
                          animationDelay: `${(i * 137) % 900}ms`,
                          // Selected icon gets a touch more amplitude via a
                          // gentle drop-shadow halo.
                          filter: selected
                            ? 'drop-shadow(0 0 8px rgba(0,212,255,0.55))'
                            : undefined,
                          willChange: 'transform',
                        }}
                      >
                        {e}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Target */}
            <Section label="Target">
              <div className="flex gap-2 mb-2">
                {(['check', 'counter'] as const).map(t => {
                  const active = targetType === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setTargetType(t)}
                      className="flex-1 rounded-xl py-2 text-xs font-semibold cursor-pointer"
                      style={
                        active
                          ? { background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }
                          : { background: 'rgba(255,255,255,0.03)', color: '#a3adc3', border: '1px solid rgba(255,255,255,0.05)' }
                      }
                    >
                      {t === 'check' ? 'Yes / No' : 'Count or amount'}
                    </button>
                  );
                })}
              </div>
              {targetType === 'counter' && (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={targetValue}
                    onChange={e => setTargetValue(Math.max(1, parseInt(e.target.value || '1', 10)))}
                    placeholder="8"
                    className="w-24 rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                    style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
                  />
                  <input
                    value={targetUnit}
                    onChange={e => setTargetUnit(e.target.value.slice(0, 20))}
                    placeholder="glasses, mins, km..."
                    className="flex-1 rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#4a5068]"
                    style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
                  />
                </div>
              )}
            </Section>
          </div>

          {/* RIGHT column on desktop */}
          <div className="space-y-5">
            {/* Schedule */}
            <Section label="Days">
              <div className="flex gap-1.5">
                {WEEKDAYS.map(d => {
                  const active = schedule.has(d.value);
                  return (
                    <button
                      key={d.value}
                      onClick={() => toggleDay(d.value)}
                      className="flex-1 rounded-lg py-2 text-[10px] font-semibold cursor-pointer transition-colors"
                      style={
                        active
                          ? { background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }
                          : { background: 'rgba(255,255,255,0.03)', color: '#4a5068', border: '1px solid rgba(255,255,255,0.05)' }
                      }
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Buddies */}
            <Section label={`Buddies (${selectedPartners.size})`}>
              <button
                onClick={() => setShowPartnersPicker(v => !v)}
                className="w-full flex items-center gap-2 rounded-xl px-3 py-3 cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <span className="flex-1 text-left text-sm text-[#a3adc3]">
                  {selectedPartners.size === 0
                    ? 'Invite friends to keep the chain together'
                    : `${selectedPartners.size} buddy${selectedPartners.size > 1 ? 's' : ''} selected`}
                </span>
                <ChevronDown size={16} className="text-[#4a5068]" />
              </button>
              {showPartnersPicker && (
                <div
                  className="mt-2 rounded-xl max-h-56 overflow-y-auto"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  {friends.length === 0 && (
                    <div className="px-3 py-3 text-xs text-[#4a5068]">No friends to invite</div>
                  )}
                  {friends.map(f => {
                    const selected = selectedPartners.has(f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => togglePartner(f.id)}
                        className="w-full text-left px-3 py-2.5 cursor-pointer hover:bg-white/5 flex items-center gap-2"
                      >
                        {f.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                        ) : (
                          <div
                            className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] text-[#a3adc3]"
                            style={{ background: 'rgba(255,255,255,0.05)' }}
                          >
                            {f.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="flex-1 text-sm font-medium text-white truncate">{f.name}</span>
                        {selected && (
                          <span className="text-[10px] font-semibold text-[#00d4ff]">✓ Added</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Visibility */}
            <Section label="Visibility">
              <div className="flex gap-2">
                {(['friends', 'private'] as const).map(v => {
                  const active = visibility === v;
                  return (
                    <button
                      key={v}
                      onClick={() => setVisibility(v)}
                      className="flex-1 rounded-xl py-2 text-xs font-semibold cursor-pointer"
                      style={
                        active
                          ? { background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }
                          : { background: 'rgba(255,255,255,0.03)', color: '#a3adc3', border: '1px solid rgba(255,255,255,0.05)' }
                      }
                    >
                      {v === 'friends' ? '👥 Friends' : '🔒 Private'}
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Photo proof + peer approval */}
            <Section label="Verification">
              <button
                onClick={() => setRequireProof(v => !v)}
                className="w-full flex items-start gap-3 rounded-xl px-3 py-3 cursor-pointer text-left"
                style={
                  requireProof
                    ? { background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)' }
                    : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }
                }
              >
                <span className="shrink-0 text-xl leading-none mt-0.5">📷</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-white">
                    Photo + buddy approval
                  </span>
                  <span className="block text-[10px] text-[#a3adc3] mt-0.5">
                    Each tick needs a proof photo. Majority of buddies must approve before it counts.
                  </span>
                </span>
                <span
                  className="inline-block h-5 w-9 rounded-full relative shrink-0 mt-1"
                  style={{
                    background: requireProof ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)',
                    border: requireProof ? '1px solid rgba(0,212,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <span
                    className="absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all"
                    style={{
                      left: requireProof ? 18 : 2,
                      background: requireProof ? '#00d4ff' : '#a3adc3',
                    }}
                  />
                </span>
              </button>
            </Section>

            {/* Reminder */}
            <Section label="Reminder">
              <ReminderSection
                enabled={reminderEnabled}
                time={reminderTime}
                timezone={reminderTz}
                onChangeEnabled={setReminderEnabled}
                onChangeTime={setReminderTime}
                onChangeTimezone={setReminderTz}
              />
            </Section>
          </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}

/** Per-emoji idle animations for the icon picker. Pure CSS keyframes —
 *  GPU-accelerated transforms only. Respects the user's
 *  `prefers-reduced-motion: reduce` setting. */
function IconKeyframes() {
  return (
    <style jsx global>{`
      @keyframes streak-flicker {
        0%, 100% { transform: scale(1) rotate(-2deg); }
        25%      { transform: scale(1.10) rotate(3deg); }
        50%      { transform: scale(0.94) rotate(-1deg); }
        75%      { transform: scale(1.06) rotate(4deg); }
      }
      @keyframes streak-run {
        0%, 100% { transform: translate(0, 0); }
        25%      { transform: translate(2px, -3px); }
        50%      { transform: translate(0, 0); }
        75%      { transform: translate(-2px, -3px); }
      }
      @keyframes streak-breathe {
        0%, 100% { transform: scale(1); }
        50%      { transform: scale(1.10); }
      }
      @keyframes streak-drop {
        0%, 100% { transform: translateY(0) scale(1); }
        40%      { transform: translateY(-4px) scale(0.96); }
        60%      { transform: translateY(0) scale(1.05); }
        80%      { transform: translateY(0) scale(1); }
      }
      @keyframes streak-toss {
        from { transform: rotate(0); }
        to   { transform: rotate(360deg); }
      }
      @keyframes streak-lean {
        0%, 100% { transform: rotate(-6deg) translateY(0); }
        50%      { transform: rotate(6deg) translateY(-2px); }
      }
      @keyframes streak-flex {
        0%, 100% { transform: scale(1); }
        15%, 60% { transform: scale(1.14); }
      }
      @keyframes streak-sway {
        0%, 100% { transform: rotate(-4deg); }
        50%      { transform: rotate(4deg); }
      }
      @keyframes streak-bob {
        0%, 100% { transform: translateY(0); }
        50%      { transform: translateY(-3px); }
      }
      @keyframes streak-steam {
        0%, 100% { transform: translateY(0) scale(1); }
        50%      { transform: translateY(-2px) scale(1.04); }
      }
      @keyframes streak-pulse {
        0%, 100% { transform: scale(1); filter: brightness(1); }
        50%      { transform: scale(1.08); filter: brightness(1.2); }
      }
      @keyframes streak-grow {
        0%, 100% { transform: rotate(-5deg) scale(1); }
        50%      { transform: rotate(5deg) scale(1.08); }
      }

      @media (prefers-reduced-motion: reduce) {
        .grid > button > span {
          animation: none !important;
        }
      }
    `}</style>
  );
}
