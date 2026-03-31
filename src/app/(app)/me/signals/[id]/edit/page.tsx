'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  presence: { emoji: '📍', color: '#3B82F6', label: "I'm Here" },
  intent:   { emoji: '🔍', color: '#a78bfa', label: 'Looking For' },
  offer:    { emoji: '🏷', color: '#fbbf24', label: 'Offer' },
  event:    { emoji: '🎉', color: '#f87171', label: 'Event' },
  update:   { emoji: '📣', color: '#00d4ff', label: 'Update' },
  proof:    { emoji: '🛡', color: '#f0f4ff', label: 'Proof' },
};

export default function EditSignalPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signal, setSignal] = useState<Record<string, unknown> | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [visibility, setVisibility] = useState('public');

  useEffect(() => {
    fetch(`/api/v1/signals/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
    })
      .then(r => r.json())
      .then(res => {
        if (res.data) {
          const s = res.data;
          setSignal(s);
          setTitle(s.title || '');
          setDescription(s.description || '');
          setCategory(s.category || 'general');
          setVisibility(s.visibility || 'public');
        }
      })
      .catch(() => toast.error('Failed to load signal'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/signals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
        body: JSON.stringify({ title, description, category, visibility }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error?.message || 'Failed to save');
        return;
      }
      toast.success('Signal updated!');
      router.push('/me/signals');
    } catch {
      toast.error('Network error');
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#00d4ff]" /></div>;
  }

  if (!signal) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-[#4a5068]">Signal not found</p>
        <button onClick={() => router.back()} className="text-xs text-[#00d4ff] cursor-pointer">Go back</button>
      </div>
    );
  }

  const cfg = TYPE_CONFIG[signal.type as string] || TYPE_CONFIG.presence;

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 lg:px-8 py-3" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer">
          <ArrowLeft size={18} /> Back
        </button>
        <h1 className="text-sm font-bold text-white">Edit Signal</h1>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6 pb-24 space-y-5">
        {/* Type badge */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center text-xl" style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}20` }}>
            {cfg.emoji}
          </div>
          <div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${cfg.color}15`, color: cfg.color }}>{cfg.label}</span>
            <p className="text-[10px] text-[#4a5068] mt-1">Type cannot be changed</p>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#2d3548]"
            style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={2000}
            className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none resize-none placeholder:text-[#2d3548]"
            style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
          />
          <span className="text-[10px] text-[#2d3548] block text-right mt-0.5">{description.length}/2000</span>
        </div>

        {/* Category */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">Category</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#2d3548]"
            style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
          />
        </div>

        {/* Visibility */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-2 block">Visibility</label>
          <div className="flex gap-2">
            {['public', 'circle', 'private', 'trusted_only'].map(v => (
              <button
                key={v}
                onClick={() => setVisibility(v)}
                className="flex-1 rounded-xl py-2.5 text-xs font-semibold capitalize cursor-pointer transition-all"
                style={{
                  background: visibility === v ? 'rgba(0,212,255,0.15)' : 'rgba(17,19,24,0.8)',
                  border: `1px solid ${visibility === v ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  color: visibility === v ? '#00d4ff' : '#a3adc3',
                }}
              >
                {v.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
