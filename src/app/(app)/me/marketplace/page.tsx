'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, Store, CheckCircle, Clock, XCircle, Send,
  ShieldCheck, AlertTriangle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

type BusinessRow = {
  id: string;
  name: string;
  marketplace_enabled?: number;
};

type Application = {
  id: string;
  business_id: string;
  business_name: string;
  status: 'pending' | 'approved' | 'rejected';
  legal_name: string;
  tax_id: string;
  gao_domain: string;
  contact_phone: string;
  contact_email: string;
  description: string;
  reviewer_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

const fetcher = (url: string) =>
  fetch(url, { credentials: 'same-origin' }).then(async r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

// ─── Page ─────────────────────────────────────────────────────────────────

export default function MeMarketplacePage() {
  const router = useRouter();

  // Gao currently supports one business per owner. /me returns a single row.
  const { data: bizResp } = useSWR<{ data: BusinessRow | null }>(
    '/api/v1/businesses/me',
    fetcher,
  );
  const businesses = bizResp?.data ? [bizResp.data] : [];

  // Pull caller's applications (most recent per business).
  const { data: appsResp, mutate: refreshApps, isLoading: appsLoading } =
    useSWR<{ data: Application[] }>('/api/v1/marketplace/applications', fetcher);
  const applications = appsResp?.data ?? [];

  // Lookup helper — latest application per business_id
  const latestByBusiness = useMemo(() => {
    const m = new Map<string, Application>();
    for (const a of applications) {
      if (!m.has(a.business_id)) m.set(a.business_id, a);
    }
    return m;
  }, [applications]);

  return (
    <div className="h-full overflow-y-auto bg-[#0a0b0f] text-white">
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{
          background: 'rgba(10,11,15,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <button
          onClick={() => router.push('/me')}
          className="flex items-center gap-2 text-sm text-[#a3adc3] hover:text-white cursor-pointer transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-base lg:text-lg font-bold ml-auto mr-auto flex items-center gap-1.5">
          <ShieldCheck size={16} className="text-[#00d4ff]" />
          Marketplace Access
        </h1>
        <div className="w-14" />
      </header>

      <main className="max-w-3xl mx-auto px-4 lg:px-8 py-6 pb-20 space-y-5">
        {/* Intro */}
        <section
          className="rounded-2xl p-5"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(168,85,247,0.05))',
            border: '1px solid rgba(0,212,255,0.2)',
          }}
        >
          <h2 className="text-lg font-bold mb-1">List gift cards on the public marketplace</h2>
          <p className="text-sm text-[#a3adc3] leading-relaxed">
            To prevent spam, every business must be verified once by the Gao team before its cards
            appear on <span className="text-[#00d4ff]">/gift-cards/market</span>. Submit the form
            below — review typically takes a working day.
          </p>
        </section>

        {/* Loading */}
        {appsLoading && (
          <div className="flex justify-center py-8 text-[#4a5068]">
            <Loader2 size={20} className="animate-spin text-[#00d4ff]" />
          </div>
        )}

        {/* Per-business status / form */}
        {!appsLoading && businesses.length === 0 && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <Store size={28} className="mx-auto mb-2 text-[#2d3548]" />
            <p className="font-medium text-[#a3adc3] mb-1">You don&apos;t own any business yet</p>
            <p className="text-xs text-[#4a5068]">
              Create one at{' '}
              <button onClick={() => router.push('/me/business')} className="text-[#00d4ff] underline cursor-pointer">
                /me/business
              </button>{' '}
              first.
            </p>
          </div>
        )}

        {!appsLoading && businesses.map(biz => (
          <BusinessRow
            key={biz.id}
            business={biz}
            existing={latestByBusiness.get(biz.id) ?? null}
            onSubmitted={() => refreshApps()}
          />
        ))}
      </main>
    </div>
  );
}

// ─── Per-business card ────────────────────────────────────────────────────

function BusinessRow({
  business,
  existing,
  onSubmitted,
}: {
  business: BusinessRow;
  existing: Application | null;
  onSubmitted: () => void;
}) {
  const isApproved = business.marketplace_enabled === 1 || existing?.status === 'approved';
  const isPending = existing?.status === 'pending';
  const wasRejected = existing?.status === 'rejected';

  if (isApproved) {
    return (
      <div
        className="rounded-2xl p-5"
        style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.2)' }}
      >
        <div className="flex items-center gap-3">
          <CheckCircle size={22} className="text-[#34d399] shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{business.name}</div>
            <div className="text-xs text-[#34d399]">Approved — list cards anytime</div>
          </div>
        </div>
      </div>
    );
  }

  if (isPending) {
    return (
      <div
        className="rounded-2xl p-5"
        style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.2)' }}
      >
        <div className="flex items-center gap-3">
          <Clock size={22} className="text-[#fbbf24] shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{business.name}</div>
            <div className="text-xs text-[#fbbf24]">
              Under review — submitted {existing && new Date(existing.submitted_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Either rejected or never submitted → show form
  return (
    <ApplicationForm
      business={business}
      prior={wasRejected ? existing : null}
      onSubmitted={onSubmitted}
    />
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────

function ApplicationForm({
  business,
  prior,
  onSubmitted,
}: {
  business: BusinessRow;
  prior: Application | null;
  onSubmitted: () => void;
}) {
  const [legalName, setLegalName] = useState(prior?.legal_name ?? '');
  const [taxId, setTaxId] = useState(prior?.tax_id ?? '');
  const [gaoDomain, setGaoDomain] = useState(prior?.gao_domain ?? '');
  const [phone, setPhone] = useState(prior?.contact_phone ?? '');
  const [email, setEmail] = useState(prior?.contact_email ?? '');
  const [description, setDescription] = useState(prior?.description ?? '');
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill gao_domain from the user's record if available
  useEffect(() => {
    if (gaoDomain) return;
    fetch('/api/v1/users/me', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(j => {
        const dom = j?.data?.gao_domain || j?.data?.gaoDomain;
        if (dom) setGaoDomain(dom);
      })
      .catch(() => {});
  }, [gaoDomain]);

  async function submit() {
    if (!legalName.trim() || !taxId.trim() || !gaoDomain.trim() || !phone.trim() || !email.trim()) {
      toast.error('All fields are required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/marketplace/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          business_id: business.id,
          legal_name: legalName.trim(),
          tax_id: taxId.trim(),
          gao_domain: gaoDomain.trim(),
          contact_phone: phone.trim(),
          contact_email: email.trim(),
          description: description.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to submit');
      toast.success('Application submitted — we\'ll review shortly');
      onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(17,19,24,0.8)',
    border: '1px solid rgba(255,255,255,0.07)',
    color: 'white',
  };

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-3">
        <Store size={20} className="text-[#00d4ff] shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{business.name}</div>
          {prior && (
            <div className="text-[10px] text-[#f87171] flex items-center gap-1 mt-0.5">
              <XCircle size={10} /> Previously rejected — resubmit with updated info
            </div>
          )}
        </div>
      </div>

      {prior?.reviewer_notes && (
        <div
          className="rounded-lg p-3 text-xs flex items-start gap-2"
          style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}
        >
          <AlertTriangle size={12} className="text-[#fca5a5] shrink-0 mt-0.5" />
          <div className="text-[#fca5a5]">
            <div className="font-semibold mb-0.5">Reviewer feedback</div>
            <div className="text-[#a3adc3]">{prior.reviewer_notes}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Legal business name" required>
          <input
            value={legalName}
            onChange={e => setLegalName(e.target.value)}
            placeholder="Cong Ty TNHH ABC"
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            style={inputStyle}
          />
        </Field>
        <Field label="Tax ID (MST)" required>
          <input
            value={taxId}
            onChange={e => setTaxId(e.target.value)}
            placeholder="0123456789"
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            style={inputStyle}
          />
        </Field>
        <Field label="Gao domain" required hint="Must be purchased on Gao">
          <input
            value={gaoDomain}
            onChange={e => setGaoDomain(e.target.value)}
            placeholder="yourbiz.gao"
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            style={inputStyle}
          />
        </Field>
        <Field label="Contact phone" required>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+84 90 123 4567"
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            style={inputStyle}
          />
        </Field>
        <Field label="Contact email" required>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="ops@yourbiz.com"
            className="w-full rounded-lg px-3 py-2.5 text-sm md:col-span-2"
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="What will you sell?" hint="Optional — helps speed up review">
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value.slice(0, 1000))}
          rows={3}
          placeholder="E.g. monthly stored-value cards for our coffee shop, occasional discount vouchers for new menu launches..."
          className="w-full rounded-lg px-3 py-2.5 text-sm resize-none"
          style={inputStyle}
        />
        <div className="text-[10px] text-[#4a5068] text-right mt-0.5">{description.length}/1000</div>
      </Field>

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: '#00d4ff', color: '#0a0b0f' }}
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        Submit for review
      </button>
    </div>
  );
}

// ─── Tiny field wrapper ───────────────────────────────────────────────────

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-[#a3adc3]">
          {label}
          {required && <span className="text-[#f87171] ml-0.5">*</span>}
        </span>
        {hint && <span className="text-[10px] text-[#4a5068]">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
