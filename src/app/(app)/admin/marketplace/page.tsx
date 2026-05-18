'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  ArrowLeft, Loader2, Check, X, ShieldCheck, Store, Phone, Mail, Globe,
  Hash, FileText, Clock, AlertTriangle,
} from 'lucide-react';

type AdminApp = {
  id: string;
  business_id: string;
  owner_user_id: string;
  business_name: string;
  legal_name: string;
  tax_id: string;
  gao_domain: string;
  contact_phone: string;
  contact_email: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  business_cover: string | null;
  business_city: string | null;
  owner_display_name: string | null;
  owner_username: string | null;
  owner_trust_score: number | null;
};

const fetcher = (url: string) =>
  fetch(url, { credentials: 'same-origin' }).then(async r => {
    if (r.status === 404) throw new Error('forbidden');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export default function AdminMarketplacePage() {
  const router = useRouter();
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const key = `/api/v1/marketplace/applications?scope=admin&status=${tab}`;
  const { data, error, isLoading, mutate } = useSWR<{ data: AdminApp[] }>(key, fetcher);
  const items = data?.data ?? [];

  // Non-admin → API returns 404; treat as forbidden message
  if (error && (error.message === 'forbidden' || String(error).includes('404'))) {
    return (
      <div className="h-full overflow-y-auto bg-[#0a0b0f] text-white flex flex-col items-center justify-center px-6 text-center">
        <ShieldCheck size={32} className="text-[#4a5068] mb-2" />
        <h1 className="text-lg font-semibold mb-1">Admin only</h1>
        <p className="text-sm text-[#4a5068] mb-4">This area is restricted.</p>
        <button
          onClick={() => router.push('/me')}
          className="rounded-xl px-4 py-2 text-sm font-semibold cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          Back to /me
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#0a0b0f] text-white">
      <header
        className="sticky top-0 z-10"
        style={{
          background: 'rgba(10,11,15,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.push('/me')}
            className="flex items-center gap-2 text-sm text-[#a3adc3] hover:text-white cursor-pointer"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="text-base lg:text-lg font-bold ml-auto mr-auto flex items-center gap-1.5">
            <ShieldCheck size={16} className="text-[#00d4ff]" />
            Marketplace Admin
          </h1>
          <div className="w-14" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pb-3 max-w-4xl mx-auto">
          {(['pending', 'approved', 'rejected'] as const).map(t => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer capitalize"
                style={
                  active
                    ? { background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }
                    : { background: 'rgba(255,255,255,0.03)', color: '#a3adc3', border: '1px solid rgba(255,255,255,0.05)' }
                }
              >
                {t}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 lg:px-8 py-5 pb-20 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-12 text-[#4a5068]">
            <Loader2 size={20} className="animate-spin text-[#00d4ff]" />
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <ShieldCheck size={28} className="mx-auto mb-2 text-[#2d3548]" />
            <p className="font-medium text-[#a3adc3]">No {tab} applications</p>
          </div>
        )}

        {items.map(app => (
          <ApplicationRow key={app.id} app={app} onChanged={() => mutate()} />
        ))}
      </main>
    </div>
  );
}

function ApplicationRow({ app, onChanged }: { app: AdminApp; onChanged: () => void }) {
  const [notes, setNotes] = useState(app.reviewer_notes ?? '');
  const [showRejectNotes, setShowRejectNotes] = useState(false);
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null);

  async function decide(status: 'approved' | 'rejected') {
    if (status === 'rejected' && !notes.trim()) {
      toast.error('Reject requires a reviewer note');
      setShowRejectNotes(true);
      return;
    }
    setSubmitting(status === 'approved' ? 'approve' : 'reject');
    try {
      const res = await fetch(`/api/v1/marketplace/applications/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status, reviewer_notes: notes.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed');
      toast.success(status === 'approved' ? 'Approved' : 'Rejected');
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(null);
    }
  }

  const isPending = app.status === 'pending';

  return (
    <div
      className="rounded-2xl p-5 space-y-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {app.business_cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={app.business_cover}
            alt=""
            className="h-12 w-12 rounded-xl object-cover shrink-0"
          />
        ) : (
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(0,212,255,0.1)' }}
          >
            <Store size={18} className="text-[#00d4ff]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white truncate">{app.business_name}</div>
          <div className="text-[10px] text-[#4a5068]">
            Submitted by {app.owner_display_name || app.owner_username || app.owner_user_id}
            {' · '}trust {app.owner_trust_score ?? 0}
            {' · '}{new Date(app.submitted_at).toLocaleString()}
          </div>
        </div>
        <StatusPill status={app.status} />
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        <Row icon={<FileText size={12} />} label="Legal name" value={app.legal_name} />
        <Row icon={<Hash size={12} />} label="Tax ID" value={app.tax_id} />
        <Row icon={<Globe size={12} />} label="Gao domain" value={app.gao_domain} />
        <Row icon={<Store size={12} />} label="City" value={app.business_city ?? '—'} />
        <Row icon={<Phone size={12} />} label="Phone" value={app.contact_phone} />
        <Row icon={<Mail size={12} />} label="Email" value={app.contact_email} />
      </div>

      {app.description && (
        <div className="rounded-lg p-3 text-xs text-[#a3adc3] leading-relaxed"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
          {app.description}
        </div>
      )}

      {/* Already-reviewed badge */}
      {!isPending && (
        <div className="text-[10px] text-[#4a5068] flex items-center gap-1">
          <Clock size={10} />
          Reviewed {app.reviewed_at ? new Date(app.reviewed_at).toLocaleString() : '—'}
          {app.reviewer_notes && (
            <>
              <span>·</span>
              <span>{app.reviewer_notes}</span>
            </>
          )}
        </div>
      )}

      {/* Actions (pending only) */}
      {isPending && (
        <>
          {showRejectNotes && (
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Why reject? (visible to merchant)"
              rows={2}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none"
              style={{
                background: 'rgba(17,19,24,0.8)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'white',
              }}
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => decide('approved')}
              disabled={!!submitting}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
              style={{ background: '#34d399', color: '#0a0b0f' }}
            >
              {submitting === 'approve' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Approve
            </button>
            <button
              onClick={() => decide('rejected')}
              disabled={!!submitting}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
              style={{ background: 'rgba(248,113,113,0.12)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.3)' }}
            >
              {submitting === 'reject' ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
              Reject
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const map = {
    pending: { bg: 'rgba(251,191,36,0.12)', fg: '#fbbf24', icon: <Clock size={10} /> },
    approved: { bg: 'rgba(52,211,153,0.12)', fg: '#34d399', icon: <Check size={10} /> },
    rejected: { bg: 'rgba(248,113,113,0.12)', fg: '#fca5a5', icon: <AlertTriangle size={10} /> },
  };
  const { bg, fg, icon } = map[status];
  return (
    <span
      className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase shrink-0"
      style={{ background: bg, color: fg }}
    >
      {icon} {status}
    </span>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[#4a5068] mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-wider text-[#4a5068]">{label}</div>
        <div className="text-xs text-white truncate">{value}</div>
      </div>
    </div>
  );
}
