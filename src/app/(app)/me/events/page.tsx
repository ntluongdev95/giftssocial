'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { useLocationStore } from '@/stores/locationStore';
import { useMapStore } from '@/stores/mapStore';
import {
  ArrowLeft, Save, MapPin, Loader2, Calendar, Clock, Users, Eye,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const EVENT_CATEGORIES = [
  'Meetup', 'Workshop', 'Conference', 'Food & Drink', 'Fitness',
  'Music', 'Art', 'Networking', 'Tech', 'Sports', 'Community', 'Other',
];

interface EventForm {
  title: string;
  description: string;
  category: string;
  location_name: string;
  city: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  capacity: string;
  visibility: 'public' | 'private';
}

export default function EventCreatePage() {
  const router = useRouter();
  const { lat, lng } = useLocationStore();
  const clearMarkers = useMapStore((s) => s.clearMarkers);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState<EventForm>({
    title: '',
    description: '',
    category: 'meetup',
    location_name: '',
    city: '',
    start_date: today,
    start_time: '18:00',
    end_date: today,
    end_time: '20:00',
    capacity: '',
    visibility: 'public',
  });

  const updateField = <K extends keyof EventForm>(key: K, value: EventForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.title) { toast.error('Event title is required'); return; }
    setSaving(true);
    try {
      const startTime = `${form.start_date}T${form.start_time}:00`;
      const endTime = `${form.end_date}T${form.end_time}:00`;

      const res = await fetch('/api/v1/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
        body: JSON.stringify({
          title: form.title, description: form.description, category: form.category,
          location: { type: 'Point', coordinates: [lng || -96.797, lat || 32.7767] },
          location_name: form.location_name, city: form.city,
          start_time: startTime, end_time: endTime,
          capacity: form.capacity ? Number(form.capacity) : undefined,
          visibility: form.visibility,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error?.message || 'Failed to save'); }
      mutate((key: string) => typeof key === 'string' && key.includes('/api/v1/events'));
      clearMarkers();
      toast.success('Event created! Showing on map...');
      router.push('/world');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  const formatPreviewDate = () => {
    try {
      const d = new Date(`${form.start_date}T${form.start_time}`);
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 lg:px-8 py-3" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer"><ArrowLeft size={18} /> Back</button>
        <h1 className="text-sm font-bold text-white">Create Event</h1>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Publish
        </button>
      </div>

      <div className="mx-auto max-w-6xl lg:flex lg:gap-8 px-4 lg:px-8 py-6 pb-32">
        {/* LEFT: Form */}
        <div className="flex-1 min-w-0 space-y-6 lg:max-w-2xl">
          <Section title="Event Details">
            <Input label="Event Title" placeholder="e.g. AI Builders Meetup" value={form.title} onChange={v => updateField('title', v)} required />
            <Textarea label="Description" placeholder="What's this event about?" value={form.description} onChange={v => updateField('description', v)} maxLength={2000} />
            <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-3 lg:space-y-0">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">Category</span>
                <select value={form.category} onChange={e => updateField('category', e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none cursor-pointer" style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  {EVENT_CATEGORIES.map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
                </select>
              </label>
              <Input label="Capacity" type="number" placeholder="Unlimited" value={form.capacity} onChange={v => updateField('capacity', v)} icon={<Users size={14} />} />
            </div>
          </Section>

          <Section title="Date & Time">
            <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-3 lg:space-y-0">
              <Input label="Start Date" type="date" value={form.start_date} onChange={v => updateField('start_date', v)} icon={<Calendar size={14} />} />
              <Input label="Start Time" type="time" value={form.start_time} onChange={v => updateField('start_time', v)} icon={<Clock size={14} />} />
              <Input label="End Date" type="date" value={form.end_date} onChange={v => updateField('end_date', v)} icon={<Calendar size={14} />} />
              <Input label="End Time" type="time" value={form.end_time} onChange={v => updateField('end_time', v)} icon={<Clock size={14} />} />
            </div>
          </Section>

          <Section title="Location">
            <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-3 lg:space-y-0">
              <Input label="Venue Name" placeholder="e.g. WeWork Uptown" value={form.location_name} onChange={v => updateField('location_name', v)} />
              <Input label="City" placeholder="e.g. Dallas, TX" value={form.city} onChange={v => updateField('city', v)} icon={<MapPin size={14} />} />
            </div>
          </Section>

          <Section title="Visibility">
            <div className="flex gap-2">
              {(['public', 'private'] as const).map(v => (
                <button key={v} onClick={() => updateField('visibility', v)} className="flex-1 rounded-xl py-2.5 text-xs font-semibold transition-all cursor-pointer capitalize" style={{
                  background: form.visibility === v ? 'rgba(0,212,255,0.15)' : 'rgba(17,19,24,0.8)',
                  border: `1px solid ${form.visibility === v ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  color: form.visibility === v ? '#00d4ff' : '#a3adc3',
                }}>
                  {v}
                </button>
              ))}
            </div>
          </Section>
        </div>

        {/* RIGHT: Live Preview */}
        <div className="hidden lg:block w-[380px] shrink-0">
          <div className="sticky top-16">
            <div className="flex items-center gap-2 mb-3">
              <Eye size={14} className="text-[#4a5068]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068]">Live Preview</span>
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(10,11,15,0.97)', border: '1px solid rgba(239,68,68,0.08)', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
              <div className="relative px-5 pt-5 pb-4">
                <div className="absolute inset-x-0 top-0 h-20 opacity-40" style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(251,191,36,0.1))' }} />
                <div className="relative flex items-start gap-4">
                  <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #EF4444, #fbbf24)', color: 'white' }}>
                    <Calendar size={24} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-base font-bold text-white truncate">{form.title || 'Event Title'}</h3>
                    <p className="text-xs text-[#f87171] font-medium capitalize">{form.category}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {form.city && <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}><MapPin size={8} /> {form.city}</span>}
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full capitalize" style={{ background: 'rgba(255,255,255,0.05)', color: '#a3adc3' }}>{form.visibility}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5 space-y-3">
                {form.description && <p className="text-xs text-[#a3adc3] leading-relaxed line-clamp-3">{form.description}</p>}

                <div className="grid grid-cols-2 gap-2">
                  <PreviewStat icon={<Calendar size={12} />} label="Date" value={formatPreviewDate() || '—'} />
                  <PreviewStat icon={<Users size={12} />} label="Capacity" value={form.capacity || '∞'} />
                </div>

                {form.location_name && <p className="flex items-center gap-1.5 text-[10px] text-[#a3adc3]"><MapPin size={10} /> {form.location_name}</p>}
              </div>

              <div className="px-5 py-3 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex-1 rounded-xl py-2.5 text-center text-xs font-semibold" style={{ background: '#00d4ff', color: '#0a0b0f' }}>Join</div>
                <div className="rounded-xl py-2.5 px-4 text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.04)', color: '#a3adc3' }}>Save</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-3">{title}</h2><div className="space-y-3">{children}</div></div>;
}

function Input({ label, value, onChange, placeholder, type = 'text', required, icon }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean; icon?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">{label} {required && '*'}</span>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5068]">{icon}</div>}
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#2d3548]" style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)', paddingLeft: icon ? '2.25rem' : undefined }} />
      </div>
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder, maxLength }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">{label}</span>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} rows={3} className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none resize-none placeholder:text-[#2d3548]" style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }} />
      {maxLength && <span className="text-[10px] text-[#2d3548] mt-0.5 block text-right">{value.length}/{maxLength}</span>}
    </label>
  );
}

function PreviewStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex justify-center mb-0.5" style={{ color: '#f87171' }}>{icon}</div>
      <p className="text-[11px] font-bold text-white">{value}</p>
      <p className="text-[9px]" style={{ color: '#4a5068' }}>{label}</p>
    </div>
  );
}
