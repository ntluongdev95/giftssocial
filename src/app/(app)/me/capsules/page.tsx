'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, MapPin, Calendar, Lock, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import useSWR from 'swr';
import CapsuleCreateModal from '@/components/capsules/CapsuleCreateModal';
import CapsuleRevealOverlay from '@/components/capsules/CapsuleRevealOverlay';

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
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : '';
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Failed to load');
  return (data?.data as Capsule[]) || [];
};

export default function CapsulesPage() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [reveal, setReveal] = useState<Capsule | null>(null);

  const { data: capsules = [], isLoading: loading, mutate } = useSWR<Capsule[]>(
    '/api/v1/capsules',
    fetcher,
    { onError: (err) => toast.error(err.message || 'Failed to load') },
  );

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this capsule? This cannot be undone.')) return;
    try {
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch(`/api/v1/capsules/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        toast.success('Capsule removed');
        mutate(prev => (prev || []).filter(x => x.id !== id), { revalidate: false });
      } else {
        const err = await res.json();
        toast.error(err.error?.message || 'Failed');
      }
    } catch { toast.error('Network error'); }
  };

  // Per-user open state — `my_opened_at` is set only when the current viewer
  // has personally dug up the capsule. The capsule's global `status` no longer
  // governs reveal: the sender opening their own capsule must not flip the
  // recipient's view to "Opened by you".
  const mine = capsules.filter(c => c.role !== 'recipient');
  const received = capsules.filter(c => c.role === 'recipient');
  const sealed = mine.filter(c => !c.my_opened_at && !c.can_open_now);
  const ready = mine.filter(c => !c.my_opened_at && c.can_open_now);
  const unlocked = mine.filter(c => !!c.my_opened_at);
  const receivedSealed = received.filter(c => !c.my_opened_at && !c.can_open_now);
  const receivedReady = received.filter(c => !c.my_opened_at && c.can_open_now);
  const receivedOpened = received.filter(c => !!c.my_opened_at);

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 lg:px-8 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-sm font-bold text-white flex items-center gap-2">🪦 Time Capsules</h1>
        <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer" style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white' }}>
          <Plus size={14} /> Bury
        </button>
      </div>

      <div className="max-w-2xl lg:max-w-6xl mx-auto px-4 lg:px-8 py-6 pb-24 space-y-6">
        {loading && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 border-2 border-[#a855f7] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && capsules.length === 0 && (
          <div className="text-center py-16 lg:py-24">
            <div className="text-6xl lg:text-7xl mb-4">🪦</div>
            <h2 className="text-lg lg:text-2xl font-bold text-white mb-2">No capsules yet</h2>
            <p className="text-sm text-[#4a5068] max-w-xs lg:max-w-md mx-auto mb-6">
              Write a message to your future self. It stays sealed until the date you choose.
            </p>
            <button onClick={() => setCreateOpen(true)} className="rounded-xl px-6 py-3 text-sm font-bold cursor-pointer" style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white' }}>
              Bury your first capsule
            </button>
          </div>
        )}

        {/* DESKTOP STATS BAR */}
        {!loading && capsules.length > 0 && (
          <div className="hidden lg:grid grid-cols-3 gap-4">
            <StatCard emoji="🔒" label="Buried & waiting" value={sealed.length} color="#a855f7" />
            <StatCard emoji="✨" label="Ready to dig up" value={ready.length} color="#fbbf24" highlight={ready.length > 0} />
            <StatCard emoji="💝" label="Memories" value={unlocked.length} color="#ec4899" />
          </div>
        )}

        {/* READY TO OPEN */}
        {ready.length > 0 && (
          <Section title="Ready to dig up" emoji="✨" color="#fbbf24">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-3">
              {ready.map(c => (
                <CapsuleCard key={c.id} capsule={c} onClick={() => setReveal(c)} action="dig" onDelete={() => handleDelete(c.id)} />
              ))}
            </div>
          </Section>
        )}

        {/* SEALED */}
        {sealed.length > 0 && (
          <Section title="Buried & waiting" emoji="🔒" color="#a855f7">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-3">
              {sealed.map(c => (
                <CapsuleCard key={c.id} capsule={c} onClick={() => toast.info(`Locked until ${new Date(c.unlock_at).toLocaleDateString()}`)} action="locked" onDelete={() => handleDelete(c.id)} />
              ))}
            </div>
          </Section>
        )}

        {/* UNLOCKED */}
        {unlocked.length > 0 && (
          <Section title="Memories" emoji="💝" color="#ec4899">
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-3 lg:gap-3">
              {unlocked.map(c => (
                <CapsuleCard key={c.id} capsule={c} onClick={() => setReveal(c)} action="opened" />
              ))}
            </div>
          </Section>
        )}

        {/* RECEIVED — capsules sent to me */}
        {received.length > 0 && (
          <div className="pt-4 mt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="text-base">💌</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#60a5fa' }}>Sent to you · {received.length}</span>
            </div>

            {receivedReady.length > 0 && (
              <Section title="Ready to open" emoji="✨" color="#fbbf24">
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-3">
                  {receivedReady.map(c => (
                    <CapsuleCard key={c.id} capsule={c} onClick={() => setReveal(c)} action="dig" />
                  ))}
                </div>
              </Section>
            )}

            {receivedSealed.length > 0 && (
              <Section title="Waiting to open" emoji="🔒" color="#60a5fa">
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-3">
                  {receivedSealed.map(c => (
                    <CapsuleCard key={c.id} capsule={c} onClick={() => toast.info(`Locked until ${new Date(c.unlock_at).toLocaleDateString()}`)} action="locked" />
                  ))}
                </div>
              </Section>
            )}

            {receivedOpened.length > 0 && (
              <Section title="Opened by you" emoji="💝" color="#ec4899">
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-3 lg:gap-3">
                  {receivedOpened.map(c => (
                    <CapsuleCard key={c.id} capsule={c} onClick={() => setReveal(c)} action="opened" />
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>

      <CapsuleCreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => mutate()} />
      {reveal && <CapsuleRevealOverlay capsule={reveal} onClose={() => { setReveal(null); mutate(); }} />}
    </div>
  );
}

function Section({ title, emoji, color, children }: { title: string; emoji: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="text-base">{emoji}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function StatCard({ emoji, label, value, color, highlight }: { emoji: string; label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-2xl px-5 py-4 flex items-center gap-4"
      style={{
        background: highlight ? `linear-gradient(135deg, ${color}14, transparent)` : 'rgba(17,19,24,0.5)',
        border: `1px solid ${highlight ? `${color}40` : 'rgba(255,255,255,0.04)'}`,
      }}
    >
      <div className="text-3xl shrink-0">{emoji}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-[#4a5068]">{label}</p>
        <p className="text-2xl font-bold" style={{ color: highlight ? color : 'white' }}>{value}</p>
      </div>
    </div>
  );
}

function CapsuleCard({ capsule, onClick, action, onDelete }: { capsule: Capsule; onClick: () => void; action: 'dig' | 'locked' | 'opened'; onDelete?: () => void }) {
  const unlock = new Date(capsule.unlock_at);

  return (
    <div className="rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.01] relative group" style={{ background: 'rgba(17,19,24,0.5)', border: action === 'dig' ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(255,255,255,0.04)' }} onClick={onClick}>
      <div className="flex items-start gap-3">
        <div className="text-3xl shrink-0">
          {action === 'dig' ? '✨' : action === 'opened' ? '📜' : '🪦'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white truncate">{capsule.title}</h3>
          <div className="flex items-center gap-2 text-[10px] text-[#4a5068] mt-1">
            <span className="flex items-center gap-1"><MapPin size={10} />{capsule.location_name || 'Hidden'}</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Calendar size={10} />{unlock.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}</span>
          </div>

          {capsule.role === 'recipient' && (
            <div className="flex items-center gap-1.5 mt-1.5">
              {capsule.sender_avatar
                ? <img src={capsule.sender_avatar} alt="" className="h-4 w-4 rounded-full object-cover" />
                : <div className="h-4 w-4 rounded-full flex items-center justify-center text-[8px]" style={{ background: 'rgba(96,165,250,0.2)' }}>👤</div>}
              <span className="text-[10px] text-[#60a5fa]">From {capsule.sender_name || capsule.sender_username || 'Someone'}</span>
            </div>
          )}

          {action === 'locked' && (
            <p className="text-[10px] text-[#a855f7] mt-1.5 flex items-center gap-1"><Lock size={10} /> Unlocks in {formatDistanceToNow(unlock)}</p>
          )}
          {action === 'dig' && (
            <p className="text-[10px] text-[#fbbf24] mt-1.5 flex items-center gap-1"><Sparkles size={10} /> Tap to dig up</p>
          )}
          {action === 'opened' && capsule.my_opened_at && (
            <p className="text-[10px] text-[#ec4899] mt-1.5">Opened {formatDistanceToNow(new Date(capsule.my_opened_at))} ago</p>
          )}
        </div>

        {onDelete && action !== 'opened' && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg cursor-pointer" style={{ color: '#f87171' }}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
