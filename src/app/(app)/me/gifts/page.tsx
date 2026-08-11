'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Plus, MapPin, Calendar, Lock, Sparkles, Trash2,
  Gift, LayoutGrid, BookOpen, Users, Clock, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import useSWR from 'swr';
import CapsuleCreateModal from '@/components/capsules/CapsuleCreateModal';
import CapsuleRevealOverlay from '@/components/capsules/CapsuleRevealOverlay';
import { BirthdayJourneyFlow } from '@/components/capsules/journey/BirthdayJourneyFlow';
import { THEME_LIST, getTheme, type CapsuleTheme } from '@/components/capsules/themes';
import { CoupleCardBuilder } from '@/components/gifts/CoupleCardBuilder';
import { HeartBuilder } from '@/components/gifts/HeartBuilder';

// ── Types ────────────────────────────────────────────────────────────────

interface Capsule {
  id: string;
  title: string;
  message: string;
  photos: string[];
  location_lat: number;
  location_lng: number;
  location_name?: string;
  buried_at: string;
  unlock_at: string;
  unlock_radius: number;
  status: string;
  opened_at?: string;
  my_opened_at?: string | null;
  can_open_now: boolean;
  time_until_unlock_ms: number;
  role?: 'sender' | 'recipient';
  sender_name?: string;
  sender_username?: string;
  sender_avatar?: string;
  theme?: string;
  recipient_ids?: string | string[];
}

const fetcher = async (url: string): Promise<Capsule[]> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Failed to load');
  return (data?.data as Capsule[]) || [];
};

type TabKey = 'mine' | 'templates' | 'howto';

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: 'mine',      label: 'My Gifts',     icon: <Gift size={14} /> },
  { key: 'templates', label: 'Templates',    icon: <LayoutGrid size={14} /> },
  { key: 'howto',     label: 'How it works', icon: <BookOpen size={14} /> },
];
const TAB_KEYS = new Set<TabKey>(['mine', 'templates', 'howto']);

export default function CapsulesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [createThemeId, setCreateThemeId] = useState<string | undefined>();
  const [coupleCardOpen, setCoupleCardOpen] = useState(false);
  const [heartOpen, setHeartOpen] = useState(false);
  const [reveal, setReveal] = useState<Capsule | null>(null);
  // Tab state is URL-backed: `?tab=templates` survives refresh, is
  // shareable, and works with browser back/forward. Falls back to 'mine'
  // when the query is missing or unrecognized.
  const urlTab = searchParams.get('tab');
  const initialTab: TabKey = urlTab && TAB_KEYS.has(urlTab as TabKey)
    ? (urlTab as TabKey)
    : 'mine';
  const [tab, setTabState] = useState<TabKey>(initialTab);
  function setTab(next: TabKey) {
    setTabState(next);
    // Use replaceState (not router.replace) — same-URL rewrite without
    // triggering Next's data revalidation or scroll reset.
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (next === 'mine') url.searchParams.delete('tab');
      else url.searchParams.set('tab', next);
      window.history.replaceState({}, '', url.toString());
    }
  }

  const { data: capsules = [], isLoading: loading, mutate } = useSWR<Capsule[]>(
    '/api/v1/capsules',
    fetcher,
    { onError: (err) => toast.error(err.message || 'Failed to load') },
  );

  // If a first-time user hits the page with zero capsules, drop them
  // straight into the discovery tabs instead of a lonely empty state.
  const effectiveTab: TabKey =
    tab === 'mine' && !loading && capsules.length === 0 ? 'templates' : tab;

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this gift? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/v1/capsules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Gift removed');
        mutate(prev => (prev || []).filter(x => x.id !== id), { revalidate: false });
      } else {
        const err = await res.json();
        toast.error(err.error?.message || 'Failed');
      }
    } catch { toast.error('Network error'); }
  };

  function openComposerWithTheme(themeId?: string) {
    setCreateThemeId(themeId);
    setCreateOpen(true);
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 px-4 lg:px-8 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-0"
        style={{
          background: 'rgba(10,11,15,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-sm font-bold text-white flex items-center gap-2">
            🎁 Gao Gifts
          </h1>
          <button
            onClick={() => openComposerWithTheme(undefined)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #a855f7, #ec4899)',
              color: 'white',
            }}
          >
            <Plus size={14} /> New gift
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 pb-0.5">
          {TABS.map(t => {
            const active = effectiveTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap relative"
                style={{
                  color: active ? '#fff' : '#4a5068',
                }}
              >
                {t.icon}
                {t.label}
                {active && (
                  <span
                    className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #a855f7, #ec4899)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-2xl lg:max-w-6xl mx-auto px-4 lg:px-8 py-6 pb-24">
        {effectiveTab === 'mine' && (
          <MyGiftsTab
            loading={loading}
            capsules={capsules}
            onCreate={() => openComposerWithTheme(undefined)}
            onOpen={c => setReveal(c)}
            onDelete={handleDelete}
          />
        )}
        {effectiveTab === 'templates' && (
          <TemplatesTab
            onPickCapsule={themeId => openComposerWithTheme(themeId)}
            onPickCard={id => {
              if (id === 'couple_card') setCoupleCardOpen(true);
              else if (id === 'heart_3d') setHeartOpen(true);
            }}
          />
        )}
        {effectiveTab === 'howto' && (
          <HowItWorksTab onStart={() => openComposerWithTheme(undefined)} />
        )}
      </div>

      <CapsuleCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => mutate()}
        initialThemeId={createThemeId}
      />
      <CoupleCardBuilder
        open={coupleCardOpen}
        onClose={() => setCoupleCardOpen(false)}
      />
      <HeartBuilder
        open={heartOpen}
        onClose={() => setHeartOpen(false)}
      />
      {reveal && (
        reveal.theme === 'birthday'
          ? <BirthdayJourneyFlow capsule={reveal} onClose={() => { setReveal(null); mutate(); }} />
          : <CapsuleRevealOverlay capsule={reveal} onClose={() => { setReveal(null); mutate(); }} />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Tab 1: My Gifts
// ═════════════════════════════════════════════════════════════════════════

function MyGiftsTab({
  loading, capsules, onCreate, onOpen, onDelete,
}: {
  loading: boolean;
  capsules: Capsule[];
  onCreate: () => void;
  onOpen: (c: Capsule) => void;
  onDelete: (id: string) => void;
}) {
  const mine = capsules.filter(c => c.role !== 'recipient');
  const received = capsules.filter(c => c.role === 'recipient');
  const sealed = mine.filter(c => !c.my_opened_at && !c.can_open_now);
  const ready = mine.filter(c => !c.my_opened_at && c.can_open_now);
  const unlocked = mine.filter(c => !!c.my_opened_at);
  const receivedSealed = received.filter(c => !c.my_opened_at && !c.can_open_now);
  const receivedReady = received.filter(c => !c.my_opened_at && c.can_open_now);
  const receivedOpened = received.filter(c => !!c.my_opened_at);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 border-2 border-[#a855f7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (capsules.length === 0) {
    return (
      <div className="text-center py-16 lg:py-24">
        <div className="text-6xl lg:text-7xl mb-4">🎁</div>
        <h2 className="text-lg lg:text-2xl font-bold text-white mb-2">No gifts yet</h2>
        <p className="text-sm text-[#4a5068] max-w-xs lg:max-w-md mx-auto mb-6">
          Wrap a message for someone you love. It stays sealed until the day you choose.
        </p>
        <button
          onClick={onCreate}
          className="rounded-xl px-6 py-3 text-sm font-bold cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #a855f7, #ec4899)',
            color: 'white',
          }}
        >
          Wrap your first gift
        </button>
      </div>
    );
  }

  const allReady = [...ready, ...receivedReady];

  return (
    <div className="space-y-6">
      {/* Stats — desktop only */}
      <div className="hidden lg:grid grid-cols-4 gap-3">
        <StatCard emoji="✨" label="Ready to open" value={allReady.length} color="#fbbf24" highlight={allReady.length > 0} />
        <StatCard emoji="🔒" label="Sealed & waiting" value={sealed.length + receivedSealed.length} color="#a855f7" />
        <StatCard emoji="💝" label="Memories" value={unlocked.length + receivedOpened.length} color="#ec4899" />
        <StatCard emoji="💌" label="Sent to you" value={received.length} color="#60a5fa" />
      </div>

      {/* HERO: Ready to open — glowing gold band, always full-width across
          both columns because opening gifts is the whole point of the page. */}
      {allReady.length > 0 && (
        <ReadyHero
          myReady={ready}
          receivedReady={receivedReady}
          onOpen={onOpen}
          onDelete={onDelete}
        />
      )}

      {/* Desktop two-column split: your outgoing gifts on the left (wider
          because you'll have more), incoming on the right. Mobile falls
          back to a single stacked column. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-5">
        {/* ── LEFT: My outgoing gifts ── */}
        <div className="space-y-6 min-w-0">
          {sealed.length === 0 && unlocked.length === 0 && (
            <EmptyColumn
              emoji="🎁"
              title="You haven't wrapped a gift yet"
              body="Send a message to future you or someone you love. It stays sealed until the date you choose."
              cta="Wrap a gift"
              onCta={onCreate}
            />
          )}

          {sealed.length > 0 && (
            <Section title="Sealed & waiting" emoji="🔒" color="#a855f7" count={sealed.length}>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {sealed.map(c => (
                  <CapsuleCard
                    key={c.id}
                    capsule={c}
                    onClick={() => toast.info(`Locked until ${new Date(c.unlock_at).toLocaleDateString()}`)}
                    action="locked"
                    onDelete={() => onDelete(c.id)}
                  />
                ))}
              </div>
            </Section>
          )}

          {unlocked.length > 0 && (
            <Section title="Memories" emoji="💝" color="#ec4899" count={unlocked.length}>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {unlocked.map(c => (
                  <CapsuleCard
                    key={c.id}
                    capsule={c}
                    onClick={() => onOpen(c)}
                    action="opened"
                    variant="compact"
                  />
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* ── RIGHT: Received rail — always visible on desktop so the
             right column carries weight even when empty. ── */}
        <aside className="space-y-4 min-w-0">
          <div
            className="rounded-2xl p-4 lg:p-5"
            style={{
              background:
                'linear-gradient(180deg, rgba(96,165,250,0.06), rgba(17,19,24,0.5))',
              border: '1px solid rgba(96,165,250,0.15)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-base">💌</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#60a5fa' }}>
                Sent to you
              </span>
              <span
                className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: 'rgba(96,165,250,0.15)', color: '#93c5fd' }}
              >
                {received.length}
              </span>
            </div>

            {received.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-3xl mb-2 opacity-60">📭</div>
                <p className="text-xs text-[#4a5068] max-w-[220px] mx-auto">
                  When friends send you a gift, it lands here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {receivedSealed.length > 0 && (
                  <SubSection title="Waiting to open" color="#60a5fa">
                    {receivedSealed.map(c => (
                      <CapsuleCard
                        key={c.id}
                        capsule={c}
                        onClick={() => toast.info(`Locked until ${new Date(c.unlock_at).toLocaleDateString()}`)}
                        action="locked"
                        variant="compact"
                      />
                    ))}
                  </SubSection>
                )}

                {receivedOpened.length > 0 && (
                  <SubSection title="Opened by you" color="#ec4899">
                    {receivedOpened.map(c => (
                      <CapsuleCard
                        key={c.id}
                        capsule={c}
                        onClick={() => onOpen(c)}
                        action="opened"
                        variant="compact"
                      />
                    ))}
                  </SubSection>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Big golden band showing all "openable right now" gifts. Sits above
 *  the two-column split because unwrapping is the primary action. */
function ReadyHero({
  myReady, receivedReady, onOpen, onDelete,
}: {
  myReady: Capsule[];
  receivedReady: Capsule[];
  onOpen: (c: Capsule) => void;
  onDelete: (id: string) => void;
}) {
  const all = [...myReady, ...receivedReady];
  return (
    <section
      className="rounded-3xl p-5 lg:p-6 relative overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at top left, rgba(251,191,36,0.18), transparent 50%), radial-gradient(ellipse at bottom right, rgba(236,72,153,0.14), transparent 55%), rgba(17,19,24,0.55)',
        border: '1px solid rgba(251,191,36,0.28)',
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center text-xl relative"
          style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.35), rgba(251,191,36,0.05))' }}
        >
          <span className="animate-pulse">✨</span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base lg:text-lg font-bold text-white">Ready to open now</h2>
          <p className="text-[11px] text-[#fbbf24]">
            {all.length} gift{all.length === 1 ? '' : 's'} waiting for you · tap to unwrap
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {myReady.map(c => (
          <CapsuleCard key={c.id} capsule={c} onClick={() => onOpen(c)} action="dig" onDelete={() => onDelete(c.id)} />
        ))}
        {receivedReady.map(c => (
          <CapsuleCard key={c.id} capsule={c} onClick={() => onOpen(c)} action="dig" />
        ))}
      </div>
    </section>
  );
}

function SubSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-[9px] font-semibold uppercase tracking-widest mb-2 px-0.5"
        style={{ color }}
      >
        {title}
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

function EmptyColumn({ emoji, title, body, cta, onCta }: {
  emoji: string;
  title: string;
  body: string;
  cta: string;
  onCta: () => void;
}) {
  return (
    <div
      className="rounded-2xl px-6 py-10 text-center"
      style={{
        background: 'rgba(17,19,24,0.5)',
        border: '1px dashed rgba(255,255,255,0.08)',
      }}
    >
      <div className="text-5xl mb-3 opacity-70">{emoji}</div>
      <h3 className="text-base font-bold text-white mb-1">{title}</h3>
      <p className="text-xs text-[#4a5068] max-w-sm mx-auto mb-5">{body}</p>
      <button
        onClick={onCta}
        className="rounded-xl px-5 py-2.5 text-xs font-bold cursor-pointer"
        style={{
          background: 'linear-gradient(135deg, #a855f7, #ec4899)',
          color: 'white',
        }}
      >
        {cta}
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Tab 2: Templates
// ═════════════════════════════════════════════════════════════════════════

/** Template extras layered on top of each CapsuleTheme — copy that helps
 *  users decide + a suggested unlock horizon. Keys match theme.id. */
const TEMPLATE_META: Record<string, {
  tagline: string;
  useCase: string;
  suggestedUnlock: string;
  category: 'legacy' | 'love' | 'milestone' | 'self' | 'travel';
}> = {
  classic:  { tagline: 'A letter to who you become',       useCase: 'Life reflection, career shifts, big decisions',      suggestedUnlock: '5–10 years',  category: 'self' },
  child:    { tagline: 'A keepsake your child will read',  useCase: 'Newborn, first day, 18th birthday, wedding day',     suggestedUnlock: '10–25 years', category: 'legacy' },
  love:     { tagline: 'For someone who has your heart',   useCase: 'Anniversary, long-distance, first meeting',           suggestedUnlock: '1–5 years',   category: 'love' },
  travel:   { tagline: 'A postcard from a place in time',  useCase: 'Trip souvenir, study abroad, honeymoon',              suggestedUnlock: '1–3 years',   category: 'travel' },
  milestone:{ tagline: 'For a big day yet to come',        useCase: 'Graduation, first job, promotion, retirement',       suggestedUnlock: '3–10 years',  category: 'milestone' },
  birthday: { tagline: 'A birthday wish — with a drone show', useCase: 'Birthday gift with cinematic reveal',              suggestedUnlock: 'Their next birthday', category: 'milestone' },
};

const CATEGORY_LABELS: Record<string, string> = {
  all:      'All',
  legacy:   'Legacy',
  love:     'Love & family',
  milestone:'Milestone',
  self:     'Self reflection',
  travel:   'Travel',
};

/** Instant-creation cards — these open a specialized builder (not the
 *  time-capsule composer) because the output is a downloadable image,
 *  not a sealed message. `kind: 'card'` distinguishes them at render. */
type InstantCard = {
  id: string;
  label: string;
  emoji: string;
  tagline: string;
  price: string;         // 'Free' | '29k₫' | 'Premium'
  previewBg: string;
  accentColor: string;
  category: 'love';
};

const INSTANT_CARDS: InstantCard[] = [
  {
    id: 'couple_card',
    label: 'Couple ID card',
    emoji: '💑',
    tagline: 'Create a couple ID card in seconds — download as PNG or share',
    price: 'Free',
    previewBg: 'linear-gradient(135deg, #f5f7fb 0%, #ffffff 50%, #e6ecf5 100%)',
    accentColor: '#1e3a8a',
    category: 'love',
  },
  {
    id: 'heart_3d',
    label: 'Web Trái Tim 3D',
    emoji: '💖',
    tagline: 'Trái tim 3D gồm hàng nghìn đốm sáng, những lời yêu thương bay lên. Gửi link cho người thương.',
    price: 'Free',
    previewBg: 'radial-gradient(circle at 50% 55%, rgba(255,77,139,0.25), #000 70%)',
    accentColor: '#ff4d8b',
    category: 'love',
  },
];

function TemplatesTab({
  onPickCapsule, onPickCard,
}: {
  onPickCapsule: (themeId: string) => void;
  onPickCard: (id: string) => void;
}) {
  const [category, setCategory] = useState<string>('all');

  const filtered = useMemo(() => {
    if (category === 'all') return THEME_LIST;
    return THEME_LIST.filter(t => TEMPLATE_META[t.id]?.category === category);
  }, [category]);

  const filteredCards = useMemo(() => {
    if (category === 'all') return INSTANT_CARDS;
    return INSTANT_CARDS.filter(c => c.category === category);
  }, [category]);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div
        className="rounded-2xl p-5 lg:p-8"
        style={{
          background:
            'linear-gradient(135deg, rgba(168,85,247,0.14), rgba(236,72,153,0.1) 60%, rgba(0,212,255,0.06))',
          border: '1px solid rgba(168,85,247,0.25)',
        }}
      >
        <div className="flex items-start gap-4">
          <div className="text-4xl lg:text-5xl">🎁</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg lg:text-2xl font-bold text-white mb-1">
              Pick a template, we&apos;ll handle the rest
            </h2>
            <p className="text-xs lg:text-sm text-[#a3adc3]">
              Each template ships with a custom reveal animation, paper design,
              stamp, and cinematic delivery. Tap one to start with everything
              pre-filled.
            </p>
          </div>
        </div>
      </div>

      {/* Category filter chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
          const active = category === key;
          return (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
              style={{
                background: active ? 'linear-gradient(135deg, #a855f7, #ec4899)' : 'rgba(255,255,255,0.04)',
                color: active ? 'white' : '#a3adc3',
                border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Instant cards — free, downloadable, no time-lock. Separate section
          because they open a different flow (builder, not composer). */}
      {filteredCards.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3 px-0.5">
            <span className="text-base">⚡</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#fbbf24]">
              Instant cards
            </span>
            <span className="text-[10px] text-[#4a5068]">— create + download in seconds</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            {filteredCards.map(card => (
              <InstantCardTemplate
                key={card.id}
                card={card}
                onPick={() => onPickCard(card.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Time-capsule templates */}
      {filtered.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3 px-0.5">
            <span className="text-base">🎁</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#a855f7]">
              Time-sealed gifts
            </span>
            <span className="text-[10px] text-[#4a5068]">— write now, delivered on the day you choose</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            {filtered.map(theme => (
              <TemplateCard
                key={theme.id}
                theme={theme}
                onPick={() => onPickCapsule(theme.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Small SVG heart made of dots — used only in the templates tab card
 *  preview. Points are sampled once via the classic 2D heart parametric
 *  curve; we distribute them inside the shape (0..1 radial factor) so it
 *  reads as a filled particle heart, not just an outline. */
const HEART_MINI_DOTS = (() => {
  const pts: { cx: number; cy: number; r: number; alpha: number }[] = [];
  // Deterministic pseudo-random so the mockup looks the same on every render
  // (SSR-safe: no Math.random on hydration mismatch risk).
  let seed = 137;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < 55; i++) {
    const t = rnd() * Math.PI * 2;
    const rad = 0.35 + rnd() * 0.65;
    const px = 16 * Math.pow(Math.sin(t), 3);
    const py = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push({
      cx: 50 + (px / 17) * 38 * rad,
      cy: 44 + (py / 17) * 32 * rad,
      r: 1.4 + rnd() * 1.6,
      alpha: 0.55 + rnd() * 0.45,
    });
  }
  return pts;
})();

function HeartMiniMockup({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 100 100" width="72%" height="88%" style={{ display: 'block' }}>
      <defs>
        <radialGradient id="hmm-dot" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="60%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Main heart dots */}
      {HEART_MINI_DOTS.map((d, i) => (
        <circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r={d.r * 2.2}
          fill="url(#hmm-dot)"
          opacity={d.alpha}
        />
      ))}
      {/* Reflection dots — mirrored across y=78 with strong fade */}
      {HEART_MINI_DOTS.map((d, i) => {
        const ry = 78 + (78 - d.cy);
        if (ry > 100) return null;
        return (
          <circle
            key={`r${i}`}
            cx={d.cx}
            cy={ry}
            r={d.r * 1.8}
            fill="url(#hmm-dot)"
            opacity={d.alpha * 0.22 * (1 - (ry - 78) / 22)}
          />
        );
      })}
    </svg>
  );
}

function InstantCardTemplate({ card, onPick }: { card: InstantCard; onPick: () => void }) {
  return (
    <div
      onClick={onPick}
      className="rounded-2xl overflow-hidden flex flex-col cursor-pointer transition-all hover:scale-[1.015] group"
      style={{
        background: 'rgba(17,19,24,0.5)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Preview: shrink of the actual card */}
      <div
        className="h-32 relative flex items-center justify-center"
        style={{ background: card.previewBg }}
      >
        {card.id === 'heart_3d' ? (
          // Particle-heart mini mockup — SVG heart filled with tiny dots
          // + a fading reflection below to hint at the 3D viewer.
          <HeartMiniMockup color={card.accentColor} />
        ) : (
          <div
            className="rounded-lg shadow-xl relative"
            style={{
              width: '78%',
              aspectRatio: '1.586 / 1',
              background: 'rgba(255,255,255,0.9)',
              border: `1px solid ${card.accentColor}20`,
              padding: '10px 12px',
            }}
          >
            <div className="text-[7px] font-semibold tracking-[0.14em]" style={{ color: card.accentColor }}>
              COUPLE MEMBERSHIP CARD
            </div>
            <div className="h-px my-1.5" style={{ background: `${card.accentColor}25` }} />
            <div className="flex gap-2">
              <div className="h-10 w-10 rounded flex items-center justify-center text-base" style={{ background: `${card.accentColor}15` }}>
                💑
              </div>
              <div className="flex-1">
                <div className="text-[6px] font-semibold tracking-wider" style={{ color: '#64748b' }}>NAME / PARTNER</div>
                <div className="text-[8px] font-bold text-slate-800 mt-0.5">You & Partner</div>
              </div>
            </div>
          </div>
        )}
        {/* "Try" pill top-right of preview area */}
        <div
          className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-[10px] font-bold flex items-center gap-1"
          style={{
            background: 'rgba(255,255,255,0.95)',
            color: '#1e293b',
            boxShadow: '0 4px 12px -2px rgba(0,0,0,0.15)',
          }}
        >
          ▶ Try
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="text-sm lg:text-base font-bold text-white">
            {card.label}
          </h3>
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{
              background: 'rgba(34,197,94,0.15)',
              color: '#4ade80',
              border: '1px solid rgba(34,197,94,0.3)',
            }}
          >
            {card.price}
          </span>
        </div>
        <p className="text-xs text-[#a3adc3] mb-3">{card.tagline}</p>

        <button
          className="mt-auto rounded-lg py-2 text-xs font-bold cursor-pointer transition-transform group-hover:scale-[1.02]"
          style={{
            background: `linear-gradient(135deg, ${card.accentColor}, ${card.accentColor}dd)`,
            color: 'white',
          }}
        >
          ⚡ Create card →
        </button>
      </div>
    </div>
  );
}

function TemplateCard({ theme, onPick }: { theme: CapsuleTheme; onPick: () => void }) {
  const meta = TEMPLATE_META[theme.id];
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col cursor-pointer transition-all hover:scale-[1.015] group"
      onClick={onPick}
      style={{
        background: 'rgba(17,19,24,0.5)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Preview — mini paper card in theme colors */}
      <div
        className="h-32 relative flex items-center justify-center"
        style={{ background: theme.bgGradient }}
      >
        <div className="text-4xl" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>
          {theme.emoji}
        </div>
        {/* Stamp mock */}
        <div
          className="absolute top-2 right-2 rounded px-1.5 py-0.5 text-[8px] font-bold rotate-6"
          style={{
            border: `1.5px solid ${theme.stampColor}`,
            color: theme.stampColor,
            background: 'rgba(255,255,255,0.35)',
          }}
        >
          {theme.stampText}
        </div>
        {/* Corner flourish */}
        <span
          className="absolute left-2 bottom-2 text-lg opacity-70"
          style={{ color: theme.accentColor }}
        >
          {theme.flourish[0]}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-sm lg:text-base font-bold text-white mb-1">
          {theme.label}
        </h3>
        <p className="text-xs text-[#a3adc3] mb-3 line-clamp-2">{meta?.tagline ?? theme.description}</p>

        {meta && (
          <div className="mt-auto space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] text-[#4a5068]">
              <Users size={10} />
              <span className="line-clamp-1">{meta.useCase}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-[#4a5068]">
              <Clock size={10} />
              <span>Suggested: {meta.suggestedUnlock}</span>
            </div>
          </div>
        )}

        <button
          className="mt-4 rounded-lg py-2 text-xs font-bold cursor-pointer transition-transform group-hover:scale-[1.02]"
          style={{
            background: theme.buttonGradient,
            color: 'white',
          }}
        >
          Use this template →
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Tab 3: How it works
// ═════════════════════════════════════════════════════════════════════════

const STEPS = [
  { emoji: '📝', title: 'Write your message', body: 'Text, photos, and (soon) voice or video. This is what future you or your recipient reads on unlock day.' },
  { emoji: '👥', title: 'Pick recipients',    body: 'Send to yourself, one person, or a whole group. Everyone gets their own private copy on unlock day.' },
  { emoji: '📍', title: 'Choose a location',  body: 'Optional GPS pin — the gift only opens when the recipient stands within the radius you set. Or skip for anytime open.' },
  { emoji: '📅', title: 'Set unlock date',    body: 'From 1 day to 100 years. Nobody — not even us — can open it before that day.' },
  { emoji: '🎁', title: 'Seal it',            body: 'Sit back. When the day arrives, we send a push notification and play a full cinematic reveal.' },
];

const FAQ = [
  { q: 'Can I edit the message after sealing?', a: 'No. That&apos;s the whole point — the message you seal today is what future you reads. If you keep tweaking it, it stops being a gift and becomes a draft.' },
  { q: 'What if I delete my Gao account?',     a: 'Your sealed gifts stay locked and safe. Nominate a legacy contact in settings and they inherit access on unlock day.' },
  { q: 'Is my message private?',               a: 'Yes. Content is encrypted at rest. Even if our database is compromised, sealed messages remain unreadable until the unlock date.' },
  { q: 'Can I send anonymously?',              a: 'For now no — recipients see who sent them the gift. Anonymous mode is coming with the Legacy tier.' },
  { q: 'What happens if my recipient never opens it?', a: 'It stays available forever. Legacy contacts you nominate can also see it if the primary recipient goes inactive.' },
];

function HowItWorksTab({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div
        className="rounded-2xl p-6 lg:p-10 text-center"
        style={{
          background:
            'linear-gradient(135deg, rgba(236,72,153,0.14), rgba(168,85,247,0.1) 60%, rgba(0,212,255,0.06))',
          border: '1px solid rgba(236,72,153,0.25)',
        }}
      >
        <div className="text-5xl lg:text-6xl mb-3">🎁</div>
        <h2 className="text-xl lg:text-3xl font-bold text-white mb-2">
          Send a gift through time
        </h2>
        <p className="text-sm text-[#a3adc3] max-w-lg mx-auto">
          Wrap a message today. We deliver it on the day you choose — birthdays,
          anniversaries, milestones, or a decade from now.
        </p>
      </div>

      {/* Steps */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-3 px-1">
          5 steps to seal a gift
        </div>
        <div className="space-y-2">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className="flex items-start gap-3 lg:gap-4 rounded-2xl p-4 lg:p-5"
              style={{
                background: 'rgba(17,19,24,0.5)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div
                className="shrink-0 h-10 w-10 lg:h-12 lg:w-12 rounded-full flex items-center justify-center text-lg lg:text-xl relative"
                style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.14), rgba(236,72,153,0.1))' }}
              >
                {s.emoji}
                <span
                  className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)' }}
                >
                  {i + 1}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm lg:text-base font-bold text-white mb-0.5">{s.title}</h3>
                <p className="text-xs text-[#a3adc3] leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trust bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <TrustCard icon={<Lock size={14} />}        label="End-to-end sealed" body="Encrypted at rest, unreadable until unlock date." />
        <TrustCard icon={<Clock size={14} />}       label="1 day → 100 years" body="Pick any horizon. We&apos;ll be here when the day comes." />
        <TrustCard icon={<ShieldCheck size={14} />} label="Legacy-safe"       body="Nominate a contact — your gifts survive." />
      </div>

      {/* FAQ */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-3 px-1">
          Frequently asked
        </div>
        <div className="space-y-2">
          {FAQ.map((item, i) => (
            <details
              key={i}
              className="rounded-xl p-3 lg:p-4 cursor-pointer group"
              style={{
                background: 'rgba(17,19,24,0.5)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <summary className="text-sm font-semibold text-white list-none flex items-center justify-between">
                {item.q}
                <span className="text-[#4a5068] group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <p className="text-xs text-[#a3adc3] mt-2 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="flex justify-center pt-2">
        <button
          onClick={onStart}
          className="rounded-xl px-8 py-3.5 text-sm lg:text-base font-bold cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #a855f7, #ec4899)',
            color: 'white',
            boxShadow: '0 12px 32px -8px rgba(168,85,247,0.5)',
          }}
        >
          🎁 Wrap your first gift
        </button>
      </div>
    </div>
  );
}

function TrustCard({ icon, label, body }: { icon: React.ReactNode; label: string; body: string }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'rgba(17,19,24,0.5)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div className="flex items-center gap-2 mb-1.5" style={{ color: '#a855f7' }}>
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xs text-[#a3adc3] leading-relaxed">{body}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Shared building blocks (unchanged from previous version)
// ═════════════════════════════════════════════════════════════════════════

function Section({ title, emoji, color, count, children }: {
  title: string; emoji: string; color: string; count?: number; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 px-0.5">
        <span className="text-base">{emoji}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>{title}</span>
        {typeof count === 'number' && count > 0 && (
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold tabular-nums"
            style={{ background: `${color}18`, color }}
          >
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function StatCard({ emoji, label, value, color, highlight }: { emoji: string; label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center gap-3 relative overflow-hidden"
      style={{
        background: highlight
          ? `linear-gradient(135deg, ${color}18, rgba(17,19,24,0.55))`
          : 'rgba(17,19,24,0.5)',
        border: `1px solid ${highlight ? `${color}55` : 'rgba(255,255,255,0.04)'}`,
        boxShadow: highlight ? `0 8px 24px -12px ${color}55` : undefined,
      }}
    >
      {highlight && (
        <div
          aria-hidden
          className="absolute -top-6 -right-6 h-16 w-16 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${color}30, transparent 70%)` }}
        />
      )}
      <div className="text-2xl shrink-0">{emoji}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] uppercase tracking-widest text-[#4a5068] truncate">{label}</p>
        <p className="text-xl font-bold tabular-nums" style={{ color: highlight ? color : 'white' }}>{value}</p>
      </div>
    </div>
  );
}

function CapsuleCard({ capsule, onClick, action, onDelete, variant = 'default' }: {
  capsule: Capsule;
  onClick: () => void;
  action: 'dig' | 'locked' | 'opened';
  onDelete?: () => void;
  /** compact = tighter padding, single-line message preview. Used in the
   *  right-column "Sent to you" rail + memory grids. */
  variant?: 'default' | 'compact';
}) {
  const unlock = new Date(capsule.unlock_at);
  const theme = getTheme(capsule.theme);
  const isCompact = variant === 'compact';

  // Action drives accent color: gold when ready, purple when sealed,
  // pink when a memory. Falls back to the theme's own accent for the
  // large "hero" surface so different themes read as visually distinct.
  const accent =
    action === 'dig'     ? '#fbbf24'
    : action === 'locked' ? '#a855f7'
    : '#ec4899';

  const showRibbon = action === 'dig';

  return (
    <div
      onClick={onClick}
      className="rounded-2xl cursor-pointer transition-all hover:scale-[1.01] relative group overflow-hidden"
      style={{
        background:
          action === 'dig'
            ? `linear-gradient(180deg, ${accent}12, rgba(17,19,24,0.6))`
            : 'rgba(17,19,24,0.55)',
        border: `1px solid ${action === 'dig' ? `${accent}45` : 'rgba(255,255,255,0.05)'}`,
        boxShadow: action === 'dig' ? `0 8px 24px -12px ${accent}55` : undefined,
      }}
    >
      {/* Theme-accent side stripe — makes cards feel visually distinct
          per occasion at a glance without dominating the layout. */}
      <div
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: theme.accentColor, opacity: 0.7 }}
      />

      {showRibbon && (
        <div
          aria-hidden
          className="absolute -top-6 -right-6 h-20 w-20 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${accent}30, transparent 70%)`,
          }}
        />
      )}

      <div className={`${isCompact ? 'p-3' : 'p-4'} pl-4`}>
        <div className="flex items-start gap-3">
          <div
            className={`${isCompact ? 'text-2xl' : 'text-3xl'} shrink-0`}
            style={{ filter: `drop-shadow(0 2px 6px ${accent}55)` }}
          >
            {theme.emoji}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <h3 className={`${isCompact ? 'text-xs' : 'text-sm'} font-bold text-white truncate flex-1`}>
                {capsule.title}
              </h3>
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider"
                style={{ background: `${theme.accentColor}18`, color: theme.accentColor }}
              >
                {theme.label}
              </span>
            </div>

            <div className={`flex items-center gap-2 ${isCompact ? 'text-[9px]' : 'text-[10px]'} text-[#4a5068] mt-1`}>
              <span className="flex items-center gap-1 truncate">
                <MapPin size={isCompact ? 9 : 10} className="shrink-0" />
                <span className="truncate">{capsule.location_name || 'Hidden'}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 shrink-0">
                <Calendar size={isCompact ? 9 : 10} />
                {unlock.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
              </span>
            </div>

            {/* Message preview — only on default/wide cards, not compact */}
            {!isCompact && action === 'opened' && capsule.message && (
              <p className="text-[11px] text-[#a3adc3] mt-2 line-clamp-2 italic">
                &ldquo;{capsule.message.length > 120 ? capsule.message.slice(0, 118) + '…' : capsule.message}&rdquo;
              </p>
            )}

            {capsule.role === 'recipient' && (
              <div className="flex items-center gap-1.5 mt-1.5">
                {capsule.sender_avatar
                  ? /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={capsule.sender_avatar} alt="" className={`${isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} rounded-full object-cover`} />
                  : <div className={`${isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} rounded-full flex items-center justify-center text-[8px]`} style={{ background: 'rgba(96,165,250,0.2)' }}>👤</div>}
                <span className={`${isCompact ? 'text-[9px]' : 'text-[10px]'} text-[#60a5fa] truncate`}>
                  From {capsule.sender_name || capsule.sender_username || 'Someone'}
                </span>
              </div>
            )}

            {action === 'locked' && (
              <p
                className={`${isCompact ? 'text-[9px]' : 'text-[10px]'} mt-1.5 flex items-center gap-1`}
                style={{ color: accent }}
              >
                <Lock size={isCompact ? 9 : 10} /> Unlocks in {formatDistanceToNow(unlock)}
              </p>
            )}
            {action === 'dig' && (
              <p
                className={`${isCompact ? 'text-[9px]' : 'text-[11px]'} mt-2 font-bold flex items-center gap-1`}
                style={{ color: accent }}
              >
                <Sparkles size={isCompact ? 9 : 11} /> Tap to unwrap →
              </p>
            )}
            {action === 'opened' && capsule.my_opened_at && (
              <p
                className={`${isCompact ? 'text-[9px]' : 'text-[10px]'} mt-1.5`}
                style={{ color: accent }}
              >
                Opened {formatDistanceToNow(new Date(capsule.my_opened_at))} ago
              </p>
            )}
          </div>

          {onDelete && action !== 'opened' && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg cursor-pointer shrink-0"
              style={{ color: '#f87171' }}
            >
              <Trash2 size={isCompact ? 12 : 14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
