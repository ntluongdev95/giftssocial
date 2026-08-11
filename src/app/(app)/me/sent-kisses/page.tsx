'use client';

// User's SENT kisses — one card per kiss with the shareable pink-heart
// QR code, open counter (X / 5), and copy/share/download actions.
// Responsive: 1 column on mobile, 2 on tablet, 3 on desktop.
// Tapping "View QR" opens a modal (works cleanly at every breakpoint).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, X } from 'lucide-react';
import useSWR from 'swr';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface SentKiss {
  id: string;
  emoji: string;
  message: string;
  visibility: string;
  receiver_id: string;
  receiver_name?: string;
  receiver_avatar?: string;
  created_at: string;
  opened: number;
  opened_at?: string;
  open_count: number;
  max_opens: number;
  photos?: string; // JSON string
  music_url?: string;
  music_title?: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function SentKissesPage() {
  const { data, error, isLoading, mutate } = useSWR<{ data: SentKiss[] }>('/api/v1/kisses?sent=true&limit=100', fetcher);
  const kisses = data?.data || [];
  const [qrKiss, setQrKiss] = useState<SentKiss | null>(null);

  // Stats for the header
  const totalOpens = kisses.reduce((s, k) => s + (k.open_count || 0), 0);
  const exhaustedCount = kisses.filter(k => k.open_count >= k.max_opens).length;

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur bg-[#0a0b0f]/85 border-b border-white/5">
        <div className="max-w-6xl mx-auto flex items-center gap-3 px-4 lg:px-6 py-3">
          <Link href="/me" className="text-[#a3adc3] hover:text-white shrink-0"><ArrowLeft size={20} /></Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base lg:text-lg font-bold truncate">💝 Sent Kisses</h1>
            {kisses.length > 0 && (
              <p className="text-[10px] lg:text-[11px] text-[#4a5068] mt-0.5">
                {kisses.length} gift{kisses.length === 1 ? '' : 's'} sent · {totalOpens} total opens{exhaustedCount > 0 ? ` · ${exhaustedCount} used up` : ''}
              </p>
            )}
          </div>
          <Link href="/world" className="text-[10px] font-bold px-3 py-1.5 rounded-md flex items-center gap-1.5 shrink-0" style={{ background: 'linear-gradient(135deg, #f472b6, #ec4899)', color: '#fff' }}>
            <Send size={12} /> <span className="hidden sm:inline">Send new</span>
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 lg:p-6">
        {isLoading && (
          <div className="text-center py-12 text-[#4a5068] text-sm">Loading...</div>
        )}
        {error && (
          <div className="text-center py-12 text-red-400 text-sm">Failed to load</div>
        )}
        {!isLoading && !error && kisses.length === 0 && (
          <div className="text-center py-24">
            <div className="text-6xl mb-3">💝</div>
            <p className="text-sm text-[#a3adc3]">You haven&rsquo;t sent any gifts yet.</p>
            <Link href="/world" className="inline-block mt-4 text-xs font-bold px-4 py-2 rounded-lg" style={{ background: 'linear-gradient(135deg, #f472b6, #ec4899)', color: '#fff' }}>
              Send your first gift
            </Link>
          </div>
        )}

        {/* Responsive grid: 1 col mobile, 2 tablet, 3 desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
          {kisses.map(k => (
            <SentKissCard key={k.id} kiss={k} onOpenQr={() => setQrKiss(k)} onRefresh={mutate} />
          ))}
        </div>
      </div>

      {/* QR modal — shared for all cards */}
      {qrKiss && <QrModal kiss={qrKiss} onClose={() => setQrKiss(null)} />}
    </div>
  );
}

function SentKissCard({ kiss, onOpenQr }: { kiss: SentKiss; onOpenQr: () => void; onRefresh: () => void }) {
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/kiss/${kiss.id}`;
  }, [kiss.id]);

  const remaining = kiss.max_opens - kiss.open_count;
  const exhausted = remaining <= 0;
  const photos: string[] = (() => {
    try { return kiss.photos ? JSON.parse(kiss.photos) : []; } catch { return []; }
  })();

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3 transition-transform hover:-translate-y-0.5" style={{ background: 'rgba(17,19,24,0.7)', border: `1px solid ${exhausted ? 'rgba(239,68,68,0.25)' : 'rgba(236,72,153,0.15)'}` }}>
      {/* Row 1: emoji + recipient + counter */}
      <div className="flex items-start gap-3">
        <div className="text-4xl shrink-0 leading-none">{kiss.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">To {kiss.receiver_name || 'Recipient'}</div>
          <div className="text-[11px] text-[#a3adc3] mt-0.5">{formatDistanceToNow(new Date(kiss.created_at), { addSuffix: true })}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9px] uppercase tracking-widest text-[#4a5068]">Opened</div>
          <div className="text-lg font-bold leading-none mt-0.5" style={{ color: exhausted ? '#ef4444' : remaining <= 1 ? '#fbbf24' : '#34d399' }}>
            {kiss.open_count}<span className="text-xs text-[#4a5068]"> / {kiss.max_opens}</span>
          </div>
        </div>
      </div>

      {/* Message */}
      {kiss.message && (
        <div className="text-[11px] text-[#a3adc3] line-clamp-2 italic">&ldquo;{kiss.message}&rdquo;</div>
      )}

      {/* Photos preview */}
      {photos.length > 0 && (
        <div className="flex gap-1.5">
          {photos.slice(0, 3).map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p} alt="" className="w-12 h-12 rounded-md object-cover" style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
          ))}
        </div>
      )}

      {/* Music indicator */}
      {kiss.music_title && (
        <div className="text-[10px] text-[#a3adc3] flex items-center gap-1.5">
          <span>🎵</span>
          <span className="truncate">{kiss.music_title}</span>
        </div>
      )}

      {/* Spacer to push actions to bottom in grid layout */}
      <div className="flex-1" />

      {/* Progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${(kiss.open_count / kiss.max_opens) * 100}%`, background: exhausted ? '#ef4444' : 'linear-gradient(90deg, #34d399, #f472b6)' }} />
      </div>

      {/* Actions */}
      {exhausted ? (
        <div className="text-center text-[11px] text-red-400 font-semibold py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)' }}>
          💝 All {kiss.max_opens} opens used
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={onOpenQr} className="text-[10px] font-bold py-2 rounded-lg cursor-pointer" style={{ background: 'rgba(236,72,153,0.15)', color: '#f472b6', border: '1px solid rgba(236,72,153,0.35)' }}>
            View QR
          </button>
          <button onClick={async () => {
            try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); toast.success('Link copied'); }
            catch { toast.error('Copy failed'); }
          }} className="text-[10px] font-bold py-2 rounded-lg cursor-pointer" style={{ background: copied ? 'rgba(52,211,153,0.2)' : 'rgba(17,19,24,0.6)', color: copied ? '#34d399' : '#a3adc3', border: `1px solid ${copied ? '#34d39955' : 'rgba(255,255,255,0.08)'}` }}>
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
          <button onClick={async () => {
            if (navigator.share) {
              try { await navigator.share({ title: 'You have a gift 💝', text: 'Tap the link to unwrap it', url }); }
              catch { /* cancelled */ }
            } else {
              try { await navigator.clipboard.writeText(url); toast.success('Link copied'); } catch {}
            }
          }} className="text-[10px] font-bold py-2 rounded-lg cursor-pointer" style={{ background: 'linear-gradient(135deg, #f472b6, #ec4899)', color: '#fff' }}>
            📤 Share
          </button>
        </div>
      )}
    </div>
  );
}

function QrModal({ kiss, onClose }: { kiss: SentKiss; onClose: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const url = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/kiss/${kiss.id}`;
  }, [kiss.id]);

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: 500, margin: 1, errorCorrectionLevel: 'H',
      color: { dark: '#ec4899', light: '#ffffff' },
    }).then(setQrDataUrl).catch(() => {});
  }, [url]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'rgba(10,11,15,0.98)', border: '1px solid rgba(236,72,153,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #f9a8d4, #ec4899, #f9a8d4)' }} />
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-base font-bold text-white">💝 QR for {kiss.receiver_name || 'Recipient'}</h3>
          <button onClick={onClose} className="text-[#4a5068] cursor-pointer hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-[11px] text-[#a3adc3] leading-relaxed text-center">
            Share this heart QR with the recipient.<br />
            They scan it to unwrap the gift 💕
          </p>

          {/* Heart-shaped pink QR */}
          <div className="flex items-center justify-center">
            <div className="relative" style={{ width: 300, height: 280 }}>
              <svg viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 w-full h-full" style={{ filter: 'drop-shadow(0 8px 24px rgba(236,72,153,0.4))' }}>
                <defs>
                  <linearGradient id={`qrModalGrad-${kiss.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fbcfe8" />
                    <stop offset="50%" stopColor="#f472b6" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                <path
                  d="M100 42 C 78 12, 20 20, 20 62 C 20 108, 100 165, 100 165 C 100 165, 180 108, 180 62 C 180 20, 122 12, 100 42 Z"
                  fill={`url(#qrModalGrad-${kiss.id})`}
                  stroke="#be185d" strokeWidth="2.5"
                />
              </svg>
              <span className="absolute text-2xl" style={{ top: '10%', left: '18%', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>💕</span>
              <span className="absolute text-2xl" style={{ top: '10%', right: '18%', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>💕</span>
              <div className="absolute" style={{ top: '25%', left: '50%', transform: 'translateX(-50%)' }}>
                <div className="rounded-xl p-2.5 bg-white" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                  {qrDataUrl ? (
                    <div className="relative" style={{ width: 160, height: 160 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrDataUrl} alt="QR" className="block w-full h-full" />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="flex items-center justify-center rounded-full bg-white" style={{ width: 28, height: 28, boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
                          <span className="text-lg leading-none">💗</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-40 h-40 flex items-center justify-center text-[10px] text-slate-400">Generating QR...</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* URL box */}
          <div className="rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="flex-1 text-[11px] text-[#a3adc3] truncate">{url}</span>
            <button onClick={async () => {
              try { await navigator.clipboard.writeText(url); toast.success('Link copied'); }
              catch { toast.error('Copy failed'); }
            }} className="text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer whitespace-nowrap" style={{ background: 'rgba(236,72,153,0.15)', color: '#f472b6', border: '1px solid rgba(236,72,153,0.35)' }}>
              📋 Copy
            </button>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => {
              if (!qrDataUrl) return;
              const a = document.createElement('a');
              a.href = qrDataUrl;
              a.download = `gao-kiss-${kiss.id}.png`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }} disabled={!qrDataUrl} className="rounded-xl py-2.5 text-xs font-bold cursor-pointer disabled:opacity-40" style={{ background: 'rgba(17,19,24,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }}>
              ⬇️ Download QR
            </button>
            <button onClick={async () => {
              if (navigator.share) {
                try { await navigator.share({ title: 'You have a gift 💝', text: 'Tap the link to unwrap it', url }); } catch {}
              } else {
                try { await navigator.clipboard.writeText(url); toast.success('Link copied'); } catch {}
              }
            }} className="rounded-xl py-2.5 text-xs font-bold cursor-pointer" style={{ background: 'linear-gradient(135deg, #f472b6, #ec4899)', color: '#fff' }}>
              📤 Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
