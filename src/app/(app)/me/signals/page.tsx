'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Loader2, MapPin, Clock, Pencil, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const TYPE_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  presence: { emoji: '📍', color: '#3B82F6', label: "I'm Here" },
  intent:   { emoji: '🔍', color: '#a78bfa', label: 'Looking For' },
  offer:    { emoji: '🏷', color: '#fbbf24', label: 'Offer' },
  event:    { emoji: '🎉', color: '#f87171', label: 'Event' },
  update:   { emoji: '📣', color: '#00d4ff', label: 'Update' },
  proof:    { emoji: '🛡', color: '#f0f4ff', label: 'Proof' },
};

const fetcher = (url: string) => fetch(url, {
  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
}).then(r => r.json());

export default function MySignalsPage() {
  const router = useRouter();
  const { data, isLoading, mutate } = useSWR('/api/v1/signals/me', fetcher);
  const signals = (data?.data || []) as Record<string, unknown>[];

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this signal?')) return;
    try {
      const res = await fetch(`/api/v1/signals/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
      });
      if (res.ok) {
        toast.success('Signal deleted');
        mutate();
      } else {
        toast.error('Failed to delete');
      }
    } catch { toast.error('Network error'); }
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 lg:px-8 py-3" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer">
          <ArrowLeft size={18} /> Back
        </button>
        <h1 className="text-sm font-bold text-white">My Signals</h1>
        <span className="ml-auto text-[11px] text-[#4a5068]">{signals.length} signal{signals.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-8 py-4 pb-24">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#00d4ff]" /></div>
        ) : signals.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <MapPin size={32} className="text-[#4a5068]" />
            <p className="text-sm text-[#4a5068]">No signals yet</p>
            <button onClick={() => router.push('/create')} className="text-xs font-semibold text-[#00d4ff] cursor-pointer">Create your first signal</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {signals.map((s) => {
            const cfg = TYPE_CONFIG[s.type as string] || TYPE_CONFIG.presence;
            const isActive = s.status === 'active' && new Date(s.expires_at as string) > new Date();
            const timeAgo = s.created_at ? formatDistanceToNow(new Date(s.created_at as string), { addSuffix: true }) : '';
            const expiresIn = s.expires_at ? formatDistanceToNow(new Date(s.expires_at as string), { addSuffix: true }) : '';

            return (
              <div key={s.id as string} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="h-1" style={{ background: isActive ? cfg.color : '#4a5068' }} />
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start gap-3.5 mb-3">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}20` }}>
                      {cfg.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${cfg.color}15`, color: cfg.color }}>{cfg.label}</span>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${isActive ? 'bg-[#00d4ff]/10 text-[#00d4ff]' : 'bg-[#4a5068]/15 text-[#4a5068]'}`}>
                          {isActive ? '● Active' : '○ Expired'}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white truncate">{s.title as string}</h3>
                    </div>
                  </div>

                  {/* Description */}
                  {s.description && <p className="text-xs text-[#a3adc3] mb-3 line-clamp-2">{s.description as string}</p>}

                  {/* Meta */}
                  <div className="flex items-center gap-4 mb-4 text-xs text-[#a3adc3]">
                    <span className="flex items-center gap-1"><Clock size={11} className="text-[#4a5068]" /> {timeAgo}</span>
                    {isActive && <span className="flex items-center gap-1 text-[#00d4ff]"><MapPin size={11} /> {expiresIn}</span>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    {isActive && (
                      <button
                        onClick={() => router.push(`/me/signals/${s.id}/edit`)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold cursor-pointer"
                        style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(s.id as string)}
                      className="rounded-xl py-2.5 px-4 flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer"
                      style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
}
