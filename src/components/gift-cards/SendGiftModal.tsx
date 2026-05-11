'use client';

// Modal that lets a sender hand the gift card directly to another Gao
// Social user instead of dropping a link. The recipient gets a
// notification + the card appears in their /me/wallet immediately.
//
// Used from:
//   • /me/gift-cards — merchant gifts a customer
//   • /g/[token]    — friend forwards a discovered drop (future)
//   • /me/wallet    — re-gift a card (future)

import { useEffect, useRef, useState } from 'react';
import { Search, X, Send, Loader2, Check, AlertCircle, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { csrfHeaders } from '@/lib/csrf-client';

interface PersonResult {
  id: string;
  title: string;       // display_name (the /api/v1/search shape)
  subtitle?: string;   // @username
  image?: string | null;
}

// Two modes — both end in "another user gets this card with my message":
//   • template — the merchant flow: spin up a fresh card from a template
//     (`POST /api/v1/gift-cards/send`)
//   • card     — re-gift a card I already claimed; ownership transfers in
//     place (`POST /api/v1/gift-cards/:id/transfer`)
export interface SendGiftTarget {
  mode: 'template' | 'card';
  id: string;                  // template_id or card_id depending on mode
  template_name: string;       // display label for the modal header
  business_name?: string;
}

export default function SendGiftModal({
  target,
  onClose,
  onSent,
}: {
  target: SendGiftTarget;
  onClose: () => void;
  onSent?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [recipient, setRecipient] = useState<PersonResult | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Debounced search ─────────────────────────────────────────────────
  // Cancel the prior timer on every keystroke so we only hit the API
  // once typing settles for 220ms.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 1 || recipient) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/v1/search?q=${encodeURIComponent(q)}&tab=people&limit=8`,
          { credentials: 'same-origin' },
        );
        const json = await res.json();
        // The unified search returns { data: { people: [...] } }
        const people = (json?.data?.people || []) as PersonResult[];
        setResults(people);
      } catch (err) {
        console.error('[SendGiftModal] search failed', err);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, recipient]);

  // ─── Submit ───────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!recipient) return;
    setSending(true);
    setError(null);
    try {
      const url = target.mode === 'card'
        ? `/api/v1/gift-cards/${encodeURIComponent(target.id)}/transfer`
        : '/api/v1/gift-cards/send';
      const payload = target.mode === 'card'
        ? {
            recipient_user_id: recipient.id,
            gift_message: message.trim() || undefined,
          }
        : {
            template_id: target.id,
            recipient_user_id: recipient.id,
            gift_message: message.trim() || undefined,
          };
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message
          || (json?.error?.code === 'recipient_already_has'
                ? 'This person already has this card.'
                : json?.error?.code === 'sold_out'
                ? 'No claims left on this drop.'
                : json?.error?.code === 'not_active'
                ? 'This card can no longer be transferred.'
                : 'Could not send the gift.');
        setError(msg);
        return;
      }
      const successDesc = target.mode === 'card'
        ? `"${target.template_name}" is now in their wallet.`
        : `They'll find "${target.template_name}" in their wallet.`;
      toast.success(`🎁 Sent to ${recipient.title}`, { description: successDesc });
      onSent?.();
      onClose();
    } catch (err) {
      console.error('[SendGiftModal] send failed', err);
      setError('Network error — please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-3 sm:px-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #14161f 0%, #0a0b0f 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg, #ff6fa8, #c41e3a)' }}
            >
              <Gift size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                {target.mode === 'card' ? 'Re-gift this card' : 'Send as gift'}
              </h2>
              <p className="text-[10px] text-white/55">
                {target.template_name}
                {target.business_name && ` · ${target.business_name}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full cursor-pointer hover:bg-white/5"
            aria-label="Close"
          >
            <X size={16} className="text-white/70" />
          </button>
        </div>

        <div className="px-5 pb-5">
          {/* Recipient picker */}
          {!recipient ? (
            <>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/55">
                To
              </label>
              <div
                className="mt-1.5 flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <Search size={14} className="text-white/45" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or @username"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
                />
                {searching && <Loader2 size={14} className="animate-spin text-white/45" />}
              </div>

              {/* Search results */}
              <div className="mt-3 max-h-72 overflow-y-auto rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
              >
                {results.length === 0 && query.trim() && !searching && (
                  <p className="px-4 py-6 text-center text-xs text-white/45">
                    No one found for &ldquo;{query.trim()}&rdquo;
                  </p>
                )}
                {results.length === 0 && !query.trim() && (
                  <p className="px-4 py-6 text-center text-xs text-white/35">
                    Type to find a friend
                  </p>
                )}
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setRecipient(p);
                      setQuery('');
                      setResults([]);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-white/5"
                  >
                    <Avatar src={p.image} name={p.title} />
                    <div className="flex flex-col items-start text-left min-w-0">
                      <span className="truncate text-sm font-semibold text-white">{p.title}</span>
                      {p.subtitle && (
                        <span className="truncate text-[11px] text-white/45">{p.subtitle}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Selected recipient — chip-style */}
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/55">
                To
              </label>
              <div className="mt-1.5 flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.18)' }}
              >
                <Avatar src={recipient.image} name={recipient.title} />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="truncate text-sm font-semibold text-white">{recipient.title}</span>
                  {recipient.subtitle && (
                    <span className="truncate text-[11px] text-white/55">{recipient.subtitle}</span>
                  )}
                </div>
                <button
                  onClick={() => setRecipient(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-full cursor-pointer hover:bg-white/5"
                  aria-label="Pick someone else"
                >
                  <X size={14} className="text-white/55" />
                </button>
              </div>

              {/* Optional message */}
              <label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-white/55">
                Message (optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 280))}
                rows={3}
                placeholder="Add a personal note…"
                className="mt-1.5 w-full resize-none rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
              <p className="mt-1 text-right text-[10px] text-white/35">{message.length}/280</p>

              {/* Error inline */}
              {error && (
                <div
                  className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#fca5a5' }}
                >
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* CTA */}
              <button
                onClick={handleSend}
                disabled={sending}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold cursor-pointer transition-transform active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #ff6fa8, #c41e3a)',
                  color: 'white',
                  boxShadow: '0 6px 18px -8px rgba(196,30,58,0.55)',
                }}
              >
                {sending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Send gift
                  </>
                )}
              </button>
              <p className="mt-2 text-center text-[10px] text-white/45">
                <Check size={9} className="inline" />
                {' '}
                {target.mode === 'card'
                  ? 'The card will leave your wallet and land in theirs.'
                  : "They'll see it in their wallet instantly"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Small avatar component — falls back to an initial chip if no image.
function Avatar({ src, name }: { src?: string | null; name: string }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      />
    );
  }
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ background: 'linear-gradient(135deg, #6ec5ff, #5b8def)' }}
    >
      {initial}
    </div>
  );
}
