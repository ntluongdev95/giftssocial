'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Gift, Loader2, ShieldCheck, Clock, Users, Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import AuthPopup from '@/components/ui/AuthPopup';
import { GiftCardPreview, TYPE_LABEL, formatValue } from '@/components/gift-cards/GiftCardPreview';
import ClaimCelebration from '@/components/gift-cards/ClaimCelebration';
import { installCsrfInterceptor } from '@/lib/csrf-interceptor';
import { csrfHeaders } from '@/lib/csrf-client';

// CSRF interceptor is normally mounted in the (app) layout. This page lives
// outside that group, so we install it here too — calls are idempotent.
installCsrfInterceptor();

interface TemplateRow {
  id: string;
  name: string;
  description: string;
  type: 'voucher' | 'stored_value' | 'service' | 'loyalty';
  face_value: number;
  percent_off: number;
  amount_off: number;
  service_name: string | null;
  currency: string;
  gradient_from: string;
  gradient_to: string;
  // Visual customization (migration-008)
  cover_image: string | null;
  pattern: 'none' | 'dots' | 'waves' | 'stars' | 'grid';
  icon_emoji: string | null;
  tagline: string | null;
  claim_token: string;
  max_claims: number;
  current_claims: number;
  one_per_user: number;
  starts_at: string | null;
  ends_at: string | null;
  expires_in_days: number;
  status: 'draft' | 'active' | 'paused' | 'archived';
  business_name: string | null;
  business_cover: string | null;
}

type Eligibility = 'ok' | 'not_active' | 'not_started' | 'ended' | 'sold_out' | 'already_claimed';

interface ClaimLookup {
  template: TemplateRow;
  eligibility: Eligibility;
  is_logged_in: boolean;
  my_card_id: string | null;
}

const fetcher = (url: string) =>
  fetch(url, { credentials: 'same-origin' }).then(async (r) => {
    const j = await r.json();
    if (!r.ok) throw j?.error || { code: 'fetch_error' };
    return j.data as ClaimLookup;
  });

const ELIGIBILITY_COPY: Record<Exclude<Eligibility, 'ok'>, { title: string; sub: string }> = {
  not_active: { title: 'This drop is paused', sub: 'The merchant has temporarily disabled new claims.' },
  not_started: { title: 'Not yet open', sub: 'This card will be claimable a bit later. Check back soon.' },
  ended: { title: 'This drop has ended', sub: 'Sorry — claims for this card are now closed.' },
  sold_out: { title: 'All claimed', sub: 'Every available card has already been taken.' },
  already_claimed: { title: 'You already have this', sub: 'Open it from your wallet — it\'s ready to use.' },
};

export default function GiftCardClaimPage() {
  const params = useParams<{ claim_token: string }>();
  const router = useRouter();
  const token = params?.claim_token;
  const isAuthed = useAuthStore((s) => s.isAuthed);
  // First name (with sane fallbacks) — used by the drone show formation.
  const firstName = useAuthStore((s) =>
    s.user?.firstName?.trim() ||
    (s.user?.fullName?.split(' ')[0] ?? '') ||
    s.user?.username ||
    'You'
  );

  const { data, error, isLoading, mutate: refresh } = useSWR<ClaimLookup>(
    token ? `/api/v1/gift-cards/claim/${token}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const [authOpen, setAuthOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [success, setSuccess] = useState<{ card_id: string } | null>(null);

  // After login, refresh the lookup so eligibility updates with the user.
  useEffect(() => {
    if (isAuthed) refresh();
  }, [isAuthed, refresh]);

  // If the popup was open and the user just became authed, close it and
  // automatically resume the claim. AuthPopup itself calls onClose on OAuth
  // success, but if it doesn't (e.g. closed via a fallback path) this watch
  // is the safety net.
  useEffect(() => {
    if (authOpen && isAuthed) {
      setAuthOpen(false);
      // small delay so any pending state from the auth flow settles
      const id = setTimeout(() => {
        if (useAuthStore.getState().isAuthed) claim();
      }, 200);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, authOpen]);

  const t = data?.template;
  const eligibility = data?.eligibility ?? 'ok';

  const claim = async () => {
    if (!token) return;
    if (!isAuthed) {
      setAuthOpen(true);
      return;
    }
    setClaiming(true);
    try {
      const res = await fetch(`/api/v1/gift-cards/claim/${token}`, {
        method: 'POST',
        credentials: 'same-origin',
        // Belt-and-suspenders: pass CSRF header explicitly even though the
        // interceptor should also inject it.
        headers: csrfHeaders(),
      });
      const json = await res.json();
      if (!res.ok) {
        // already_claimed comes with the existing card_id so we can deep-link.
        if (json?.error?.code === 'already_claimed' && json?.data?.card_id) {
          setSuccess({ card_id: json.data.card_id });
          toast.message('You already have this card');
          return;
        }
        throw new Error(json?.error?.message || 'Could not claim');
      }
      setSuccess({ card_id: json.data.id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not claim');
    } finally {
      setClaiming(false);
    }
  };

  const valueLabel = useMemo(() => (t ? formatValue(t) : ''), [t]);

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: '#0a0b0f', color: '#f0f4ff' }}
    >
      {/* Soft starfield-ish backdrop */}
      <Backdrop from={t?.gradient_from} to={t?.gradient_to} />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-4 py-4 lg:px-8 lg:py-6">
        <button
          onClick={() => router.push('/')}
          aria-label="Go home"
          className="flex h-9 w-9 items-center justify-center rounded-full cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <ArrowLeft size={16} />
        </button>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-white/55">
          <ShieldCheck size={12} className="text-[#00d4ff]" /> Gao Social Drop
        </span>
        <div className="h-9 w-9" />
      </header>

      <main className="relative z-10 mx-auto max-w-md px-5 pb-20 lg:max-w-5xl lg:px-8 lg:pb-24">
        {/* Loading */}
        {isLoading && !data && (
          <div className="flex items-center justify-center py-24 text-[#4a5068]">
            <Loader2 size={22} className="animate-spin" />
          </div>
        )}

        {/* Not found / fetch error */}
        {error && (
          <ErrorState
            title="Drop not found"
            sub="This link looks invalid or the drop has been removed."
            onBack={() => router.push('/')}
          />
        )}

        {/* Loaded */}
        {t && (
          <div className="grid gap-8 lg:grid-cols-[480px_minmax(0,1fr)] lg:items-center lg:gap-14 lg:py-8">
            {/* ── LEFT: card showcase ─────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              {/* Glow halo behind the card on desktop */}
              <div
                aria-hidden
                className="hidden lg:block absolute inset-0 -z-10 blur-3xl opacity-60"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${t.gradient_from}66 0%, transparent 60%)`,
                }}
              />
              {/* Wrapper enforces credit-card aspect on desktop; mobile uses
                  the component's natural sizing. */}
              <div className="mx-auto w-full max-w-md lg:max-w-none lg:aspect-[1.6/1]">
                <GiftCardPreview
                  className="lg:h-full lg:w-full"
                  type={t.type}
                  name={t.name}
                  businessName={t.business_name}
                  value={valueLabel}
                  gradientFrom={t.gradient_from}
                  gradientTo={t.gradient_to}
                  description={t.description}
                  footerLeft={`Valid ${t.expires_in_days}d`}
                  footerRight={
                    t.max_claims > 0 ? `${Math.max(t.max_claims - t.current_claims, 0)} left` : 'Open drop'
                  }
                  coverImage={t.cover_image}
                  pattern={t.pattern}
                  iconEmoji={t.icon_emoji}
                  tagline={t.tagline}
                />
              </div>

              {/* Trust strip — desktop only, sits under the card */}
              <div className="hidden lg:flex mt-5 items-center justify-center gap-2.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={11} className="text-[#00d4ff]" /> Verified merchant
                </span>
                <span className="h-1 w-1 rounded-full bg-white/25" />
                <span>Instant claim</span>
                <span className="h-1 w-1 rounded-full bg-white/25" />
                <span>Saved to wallet</span>
              </div>
            </motion.div>

            {/* ── RIGHT: hero copy + details + claim ──────────────────── */}
            <div className="min-w-0">
              {/* Hero copy */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="text-center lg:text-left"
              >
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]"
                  style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}
                >
                  <Gift size={11} /> A gift from {t.business_name || 'this business'}
                </span>
                <h1 className="mt-3 text-2xl font-black leading-tight lg:text-[2.25rem] lg:leading-[1.1] lg:mt-4">
                  You&apos;ve received a{' '}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: `linear-gradient(135deg, ${t.gradient_from}, ${t.gradient_to})` }}
                  >
                    gift card
                  </span>
                </h1>
                <p className="mt-1.5 text-sm text-[#a3adc3] lg:text-[15px] lg:leading-relaxed lg:mt-3">
                  Claim it now — show this card on your next visit to {t.business_name}.
                </p>
              </motion.div>

              {/* Description (full text — preview only shows 1 line) */}
              {t.description && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="mt-4 text-[13px] leading-relaxed text-[#cbd1e0] lg:text-[14px] lg:leading-relaxed"
                >
                  {t.description}
                </motion.p>
              )}

              {/* Detail strip */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
                className="mt-5 grid grid-cols-3 gap-2 lg:mt-6 lg:gap-3"
              >
                <DetailPill icon={<Sparkles size={14} />} label="Type" value={TYPE_LABEL[t.type]} />
                <DetailPill icon={<Clock size={14} />} label="Valid" value={`${t.expires_in_days} days`} />
                <DetailPill
                  icon={<Users size={14} />}
                  label="Available"
                  value={t.max_claims > 0 ? `${Math.max(t.max_claims - t.current_claims, 0)} left` : 'Open'}
                />
              </motion.div>

              {/* Eligibility / claim CTA */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="mt-6 lg:mt-7"
              >
                {eligibility === 'ok' && (
                  <button
                    onClick={claim}
                    disabled={claiming}
                    className="relative w-full overflow-hidden rounded-2xl py-4 text-base font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed lg:py-4 lg:text-base"
                    style={{ background: '#00d4ff', color: '#0a0b0f', boxShadow: '0 14px 40px -16px rgba(0,212,255,0.6)' }}
                  >
                    {claiming ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" /> Claiming…
                      </span>
                    ) : (
                      <>{isAuthed ? '🎁 Claim this card' : 'Sign in to claim'}</>
                    )}
                  </button>
                )}

                {eligibility !== 'ok' && (
                  <NotEligible
                    copy={ELIGIBILITY_COPY[eligibility]}
                    cardId={data?.my_card_id}
                    router={router}
                  />
                )}

                <p className="mt-3 text-center text-[11px] text-[#4a5068] lg:text-left lg:text-xs">
                  After claiming, your card lives in your Gao Social wallet — show it at the shop to redeem.
                </p>
              </motion.div>
            </div>
          </div>
        )}
      </main>

      {/* Auth popup — auto-closes via the isAuthed useEffect above when login
          succeeds. Manual close (X / outside-click) just dismisses. */}
      <AuthPopup open={authOpen} onClose={() => setAuthOpen(false)} />

      {/* Drone celebration on successful claim */}
      <AnimatePresence>
        {success && t && (
          <ClaimCelebration
            userName={firstName}
            template={t}
            valueLabel={valueLabel}
            onClose={() => setSuccess(null)}
            onOpenWallet={() => router.push('/me/wallet')}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function Backdrop({ from, to }: { from?: string; to?: string }) {
  const f = from || '#00d4ff';
  const tt = to || '#a78bfa';
  return (
    <>
      {/* Wash of the card's gradient at low opacity */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{ background: `radial-gradient(circle at 50% 0%, ${f}40 0%, transparent 55%)` }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none opacity-25"
        style={{ background: `radial-gradient(circle at 50% 100%, ${tt}40 0%, transparent 60%)` }}
      />
      {/* Tiny stars */}
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          backgroundImage:
            'radial-gradient(white 0.6px, transparent 0.7px), radial-gradient(white 0.4px, transparent 0.5px)',
          backgroundSize: '110px 110px, 60px 60px',
          backgroundPosition: '0 0, 30px 30px',
        }}
      />
    </>
  );
}

function DetailPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-center"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center justify-center text-[#00d4ff] mb-1">{icon}</div>
      <div className="text-[10px] uppercase tracking-wider text-[#4a5068]">{label}</div>
      <div className="mt-0.5 text-[12px] font-semibold truncate">{value}</div>
    </div>
  );
}

function NotEligible({
  copy,
  cardId,
  router,
}: {
  copy: { title: string; sub: string };
  cardId?: string | null;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div
      className="rounded-2xl p-5 text-center"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
        <AlertTriangle size={18} />
      </div>
      <h3 className="text-base font-bold">{copy.title}</h3>
      <p className="mt-1 text-xs text-[#a3adc3]">{copy.sub}</p>
      {cardId && (
        <button
          onClick={() => router.push('/me/wallet')}
          className="mt-4 w-full rounded-xl py-2.5 text-sm font-bold cursor-pointer"
          style={{ background: '#00d4ff', color: '#0a0b0f' }}
        >
          Open in wallet
        </button>
      )}
    </div>
  );
}

function ErrorState({ title, sub, onBack }: { title: string; sub: string; onBack: () => void }) {
  return (
    <div
      className="rounded-2xl p-6 text-center mt-10"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <AlertTriangle size={28} className="mx-auto mb-3 text-[#f87171]" />
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1 text-xs text-[#a3adc3]">{sub}</p>
      <button
        onClick={onBack}
        className="mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#f0f4ff' }}
      >
        Go to home
      </button>
    </div>
  );
}

