'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { useLocationStore } from '@/stores/locationStore';
import { useMapStore } from '@/stores/mapStore';
import {
  ArrowLeft, Save, Plus, X, MapPin, Loader2, Clock, Phone, Globe, Eye,
  Store, Star, CheckCircle, Bookmark,
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  'Restaurant', 'Cafe', 'Bar', 'Beauty', 'Fitness', 'Health', 'Dental',
  'Retail', 'Grocery', 'Coworking', 'Repair', 'Education', 'Entertainment',
  'Real Estate', 'Auto', 'Pet', 'Cleaning', 'Photography', 'Other',
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface BusinessForm {
  name: string;
  category: string;
  description: string;
  address: string;
  city: string;
  phone: string;
  website: string;
  hours: Record<string, { open: string; close: string; closed: boolean }>;
  booking_enabled: boolean;
}

export default function BusinessEditPage() {
  const router = useRouter();
  const { lat, lng } = useLocationStore();
  const clearMarkers = useMapStore((s) => s.clearMarkers);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<BusinessForm>({
    name: '',
    category: '',
    description: '',
    address: '',
    city: '',
    phone: '',
    website: '',
    hours: Object.fromEntries(DAYS.map(d => [d, { open: '09:00', close: '18:00', closed: d === 'Sun' }])),
    booking_enabled: false,
  });

  useEffect(() => {
    fetch('/api/v1/businesses/me', {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
    })
      .then(r => r.json())
      .then(res => {
        if (res.data) {
          const b = res.data;
          setForm({
            name: b.name || '',
            category: b.category || '',
            description: b.description || '',
            address: b.address || '',
            city: b.city || '',
            phone: b.phone || '',
            website: b.website || '',
            hours: b.hours && Object.keys(b.hours).length > 0
              ? b.hours
              : Object.fromEntries(DAYS.map(d => [d, { open: '09:00', close: '18:00', closed: d === 'Sun' }])),
            booking_enabled: b.booking_enabled ?? false,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateField = <K extends keyof BusinessForm>(key: K, value: BusinessForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const updateHours = (day: string, field: string, value: string | boolean) => {
    setForm(prev => ({
      ...prev,
      hours: { ...prev.hours, [day]: { ...prev.hours[day], [field]: value } },
    }));
  };

  const handleSave = async () => {
    if (!form.name || !form.category) { toast.error('Name and category are required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
        body: JSON.stringify({
          name: form.name, category: form.category.toLowerCase(), description: form.description,
          location: { type: 'Point', coordinates: [lng || -96.797, lat || 32.7767] },
          address: form.address, city: form.city, phone: form.phone || undefined,
          website: form.website || undefined, hours: form.hours, booking_enabled: form.booking_enabled,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error?.message || 'Failed to save'); }
      mutate((key: string) => typeof key === 'string' && key.includes('/api/v1/businesses'));
      clearMarkers();
      toast.success('Business saved! Showing on map...');
      router.push('/world');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#00d4ff]" /></div>;

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 lg:px-8 py-3" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer"><ArrowLeft size={18} /> Back</button>
        <h1 className="text-sm font-bold text-white">My Business</h1>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>

      <div className="mx-auto max-w-6xl lg:flex lg:gap-8 px-4 lg:px-8 py-6 pb-32">
        {/* LEFT: Form */}
        <div className="flex-1 min-w-0 space-y-6 lg:max-w-2xl">
          <Section title="Business Info">
            <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-3 lg:space-y-0">
              <div className="lg:col-span-2">
                <Input label="Business Name" placeholder="e.g. Gao Coffee" value={form.name} onChange={v => updateField('name', v)} required />
              </div>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">Category *</span>
                <select value={form.category} onChange={e => updateField('category', e.target.value)} className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none cursor-pointer" style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <option value="">Select category</option>
                  {CATEGORIES.map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
                </select>
              </label>
              <Input label="City" placeholder="e.g. Dallas, TX" value={form.city} onChange={v => updateField('city', v)} icon={<MapPin size={14} />} />
              <div className="lg:col-span-2">
                <Textarea label="Description" placeholder="What does your business offer?" value={form.description} onChange={v => updateField('description', v)} maxLength={1000} />
              </div>
              <div className="lg:col-span-2">
                <Input label="Address" placeholder="123 Main St, Suite 100" value={form.address} onChange={v => updateField('address', v)} icon={<MapPin size={14} />} />
              </div>
              <Input label="Phone" placeholder="+1 (555) 000-0000" value={form.phone} onChange={v => updateField('phone', v)} icon={<Phone size={14} />} />
              <Input label="Website" placeholder="https://yourbusiness.com" value={form.website} onChange={v => updateField('website', v)} icon={<Globe size={14} />} />
            </div>
          </Section>

          {/* Hours */}
          <Section title="Business Hours">
            <div className="space-y-2">
              {DAYS.map(day => (
                <div key={day} className="flex items-center gap-3 rounded-xl px-4 py-2.5" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="w-10 text-xs font-semibold text-white">{day}</span>
                  <button
                    onClick={() => updateHours(day, 'closed', !form.hours[day]?.closed)}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer"
                    style={{
                      background: form.hours[day]?.closed ? 'rgba(239,68,68,0.15)' : 'rgba(52,211,153,0.15)',
                      color: form.hours[day]?.closed ? '#f87171' : '#34d399',
                    }}
                  >
                    {form.hours[day]?.closed ? 'Closed' : 'Open'}
                  </button>
                  {!form.hours[day]?.closed && (
                    <div className="flex items-center gap-2 ml-auto">
                      <input type="time" value={form.hours[day]?.open || '09:00'} onChange={e => updateHours(day, 'open', e.target.value)} className="rounded-lg px-2 py-1 text-xs text-white outline-none" style={{ background: 'rgba(10,11,15,0.8)', border: '1px solid rgba(255,255,255,0.07)' }} />
                      <span className="text-[#4a5068] text-xs">—</span>
                      <input type="time" value={form.hours[day]?.close || '18:00'} onChange={e => updateHours(day, 'close', e.target.value)} className="rounded-lg px-2 py-1 text-xs text-white outline-none" style={{ background: 'rgba(10,11,15,0.8)', border: '1px solid rgba(255,255,255,0.07)' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* Settings */}
          <Section title="Settings">
            <Toggle label="Enable Booking" desc="Allow customers to book appointments" value={form.booking_enabled} onChange={v => updateField('booking_enabled', v)} />
          </Section>
        </div>

        {/* RIGHT: Live Preview */}
        <div className="hidden lg:block w-[380px] shrink-0">
          <div className="sticky top-16">
            <div className="flex items-center gap-2 mb-3">
              <Eye size={14} className="text-[#4a5068]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068]">Live Preview</span>
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(10,11,15,0.97)', border: '1px solid rgba(34,197,94,0.08)', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
              <div className="relative px-5 pt-5 pb-4">
                <div className="absolute inset-x-0 top-0 h-20 opacity-40" style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(0,212,255,0.1))' }} />
                <div className="relative flex items-start gap-4">
                  <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #22C55E, #00d4ff)', color: 'white' }}>
                    <Store size={24} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-base font-bold text-white truncate">{form.name || 'Business Name'}</h3>
                    <p className="text-xs text-[#34d399] font-medium capitalize">{form.category || 'Category'}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {form.city && <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}><MapPin size={8} /> {form.city}</span>}
                      {form.booking_enabled && <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}><Bookmark size={8} /> Booking</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5 space-y-3">
                {form.description && <p className="text-xs text-[#a3adc3] leading-relaxed line-clamp-3">{form.description}</p>}

                {/* Hours preview */}
                <div>
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1.5">Hours Today</h4>
                  {(() => {
                    const today = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
                    const h = form.hours[today];
                    return h?.closed
                      ? <p className="text-xs text-[#f87171]">Closed today</p>
                      : <p className="text-xs text-[#34d399]">{h?.open} — {h?.close}</p>;
                  })()}
                </div>

                {/* Contact */}
                <div className="space-y-1.5">
                  {form.phone && <p className="flex items-center gap-1.5 text-[10px] text-[#a3adc3]"><Phone size={10} /> {form.phone}</p>}
                  {form.website && <p className="flex items-center gap-1.5 text-[10px] text-[#a3adc3] truncate"><Globe size={10} /> {form.website}</p>}
                  {form.address && <p className="flex items-center gap-1.5 text-[10px] text-[#a3adc3]"><MapPin size={10} /> {form.address}</p>}
                </div>
              </div>

              <div className="px-5 py-3 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex-1 rounded-xl py-2.5 text-center text-xs font-semibold" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>View</div>
                {form.booking_enabled && <div className="flex-1 rounded-xl py-2.5 text-center text-xs font-semibold" style={{ background: '#00d4ff', color: '#0a0b0f' }}>Book</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Components ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-3">{title}</h2><div className="space-y-3">{children}</div></div>;
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div><p className="text-sm font-medium text-white">{label}</p><p className="text-[11px] text-[#4a5068]">{desc}</p></div>
      <button onClick={() => onChange(!value)} className="h-6 w-11 rounded-full transition-colors cursor-pointer shrink-0 ml-3" style={{ background: value ? '#00d4ff' : 'rgba(255,255,255,0.1)' }}>
        <div className="h-5 w-5 rounded-full bg-white shadow transition-transform" style={{ transform: value ? 'translateX(21px)' : 'translateX(1px)' }} />
      </button>
    </div>
  );
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
