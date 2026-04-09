'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { useLocationStore } from '@/stores/locationStore';
import { useMapStore } from '@/stores/mapStore';
import {
  ArrowLeft, Save, Plus, X, MapPin, Loader2, Clock, Phone, Globe, Eye,
  Store, Star, CheckCircle, Bookmark,
} from 'lucide-react';
import { toast } from 'sonner';
import { rewriteImageUrl } from '@/lib/image-url';

const CATEGORIES = [
  'Restaurant', 'Cafe', 'Bar', 'Beauty', 'Fitness', 'Health', 'Dental',
  'Retail', 'Grocery', 'Coworking', 'Repair', 'Education', 'Entertainment',
  'Real Estate', 'Auto', 'Pet', 'Cleaning', 'Photography', 'Other',
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Service {
  name: string;
  price: number;
  duration: number;
}

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
  services: Service[];
  social_links: { platform: string; url: string }[];
  cover_image: string;
  images: string[];
}

const SOCIAL_PLATFORMS = ['Facebook', 'Instagram', 'TikTok', 'Twitter/X', 'YouTube', 'LinkedIn', 'Zalo', 'Other'];

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
    services: [],
    social_links: [],
    cover_image: '',
    images: [],
  });

  const [uploading, setUploading] = useState(false);

  const uploadImage = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/v1/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
        body: fd,
      });
      if (res.ok) { const d = await res.json(); return d.data?.url; }
    } catch {}
    return null;
  };

  const handleAddImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of files.slice(0, 8 - form.images.length)) {
      const url = await uploadImage(file);
      if (url) urls.push(url);
    }
    updateField('images', [...form.images, ...urls]);
    setUploading(false);
    e.target.value = '';
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file);
    if (url) updateField('cover_image', url);
    setUploading(false);
  };

  // Address geocoding
  const [addressResults, setAddressResults] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [addressCoords, setAddressCoords] = useState<[number, number] | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchAddress = useCallback((q: string) => {
    updateField('address', q);
    setAddressCoords(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 3) { setAddressResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`, { headers: { 'User-Agent': 'GaoSocial/1.0' } });
        let data = await res.json();
        // Fallback: if no results and query has 3+ words, retry with fewer words
        if (data.length === 0 && q.split(/\s+/).length >= 3) {
          const shorter = q.split(/\s+/).slice(-2).join(' ');
          const res2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(shorter)}&limit=5&addressdetails=1`, { headers: { 'User-Agent': 'GaoSocial/1.0' } });
          data = await res2.json();
        }
        setAddressResults(data.map((r: Record<string, unknown>) => ({
          name: r.display_name as string,
          lat: parseFloat(r.lat as string),
          lng: parseFloat(r.lon as string),
        })));
      } catch { setAddressResults([]); }
    }, 400);
  }, []);

  const selectAddress = (r: { name: string; lat: number; lng: number }) => {
    updateField('address', r.name.split(',').slice(0, 2).join(',').trim());
    updateField('city', r.name.split(',').slice(2, 4).join(',').trim());
    setAddressCoords([r.lng, r.lat]);
    setAddressResults([]);
  };

  const removeImage = (index: number) => {
    updateField('images', form.images.filter((_, i) => i !== index));
  };

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
            services: b.services || [],
            social_links: b.social_links || [],
            cover_image: b.cover_image || '',
            images: b.images || [],
          });
          if (b.location_lng && b.location_lat) {
            setAddressCoords([b.location_lng, b.location_lat]);
          }
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
          location: { type: 'Point', coordinates: addressCoords || [lng || -96.797, lat || 32.7767] },
          address: form.address, city: form.city, phone: form.phone || undefined,
          website: form.website || undefined, hours: form.hours, booking_enabled: form.booking_enabled,
          services: form.services.filter(s => s.name), social_links: form.social_links.filter(l => l.url),
          cover_image: form.cover_image || undefined, images: form.images,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error?.message || 'Failed to save'); }
      mutate((key: string) => typeof key === 'string' && key.includes('/api/v1/businesses'));
      clearMarkers();
      toast.success('Business saved! Showing on map...');
      const coords = addressCoords || [lng || -96.797, lat || 32.7767];
      useMapStore.getState().setViewMode('2d');
      router.push(`/world?flyTo=${coords[0]},${coords[1]},16`);

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
              <div className="lg:col-span-2 relative">
                <Input label="Address" placeholder="Search address..." value={form.address} onChange={v => searchAddress(v)} icon={addressCoords ? <CheckCircle size={14} className="text-[#34d399]" /> : <MapPin size={14} />} />
                {addressResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl overflow-hidden max-h-[200px] overflow-y-auto" style={{ background: 'rgba(10,11,15,0.97)', border: '1px solid rgba(0,212,255,0.12)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
                    {addressResults.map((r, i) => (
                      <button key={i} onMouseDown={() => selectAddress(r)} className="w-full text-left px-3 py-2.5 text-xs text-[#a3adc3] hover:bg-[rgba(0,212,255,0.06)] cursor-pointer truncate" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        📍 {r.name}
                      </button>
                    ))}
                  </div>
                )}
                {addressCoords && <p className="text-[10px] text-[#4a5068] mt-1">{addressCoords[1].toFixed(4)}, {addressCoords[0].toFixed(4)}</p>}
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

          {/* Services */}
          <Section title="Services">
            <div className="space-y-2">
              {form.services.map((svc, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl px-4 py-2.5" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <input
                    value={svc.name}
                    onChange={e => { const s = [...form.services]; s[i] = { ...s[i], name: e.target.value }; updateField('services', s); }}
                    placeholder="Service name"
                    className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#2d3548]"
                  />
                  <input
                    type="number"
                    value={svc.price || ''}
                    onChange={e => { const s = [...form.services]; s[i] = { ...s[i], price: Number(e.target.value) }; updateField('services', s); }}
                    placeholder="$"
                    className="w-16 bg-transparent text-sm text-[#00d4ff] text-right outline-none placeholder:text-[#2d3548]"
                  />
                  <input
                    type="number"
                    value={svc.duration || ''}
                    onChange={e => { const s = [...form.services]; s[i] = { ...s[i], duration: Number(e.target.value) }; updateField('services', s); }}
                    placeholder="min"
                    className="w-14 bg-transparent text-sm text-[#a3adc3] text-right outline-none placeholder:text-[#2d3548]"
                  />
                  <button onClick={() => { const s = [...form.services]; s.splice(i, 1); updateField('services', s); }} className="text-[#f87171] cursor-pointer"><X size={14} /></button>
                </div>
              ))}
              <button
                onClick={() => updateField('services', [...form.services, { name: '', price: 0, duration: 30 }])}
                className="flex items-center gap-2 w-full rounded-xl px-4 py-2.5 text-xs font-semibold cursor-pointer"
                style={{ background: 'rgba(0,212,255,0.06)', border: '1px dashed rgba(0,212,255,0.2)', color: '#00d4ff' }}
              >
                <Plus size={14} /> Add Service
              </button>
            </div>
          </Section>

          {/* Social Links */}
          <Section title="Social Links">
            <div className="space-y-2">
              {form.social_links.map((link, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl px-4 py-2.5" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <select
                    value={link.platform}
                    onChange={e => { const l = [...form.social_links]; l[i] = { ...l[i], platform: e.target.value }; updateField('social_links', l); }}
                    className="bg-transparent text-xs text-[#a3adc3] outline-none cursor-pointer"
                  >
                    <option value="">Platform</option>
                    {SOCIAL_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input
                    value={link.url}
                    onChange={e => { const l = [...form.social_links]; l[i] = { ...l[i], url: e.target.value }; updateField('social_links', l); }}
                    placeholder="https://..."
                    className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#2d3548]"
                  />
                  <button onClick={() => { const l = [...form.social_links]; l.splice(i, 1); updateField('social_links', l); }} className="text-[#f87171] cursor-pointer"><X size={14} /></button>
                </div>
              ))}
              <button
                onClick={() => updateField('social_links', [...form.social_links, { platform: '', url: '' }])}
                className="flex items-center gap-2 w-full rounded-xl px-4 py-2.5 text-xs font-semibold cursor-pointer"
                style={{ background: 'rgba(0,212,255,0.06)', border: '1px dashed rgba(0,212,255,0.2)', color: '#00d4ff' }}
              >
                <Plus size={14} /> Add Link
              </button>
            </div>
          </Section>

          {/* Cover Image */}
          <Section title="Cover Image">
            <div className="relative rounded-xl overflow-hidden h-40" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
              {form.cover_image ? (
                <>
                  <img src={rewriteImageUrl(form.cover_image)} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => updateField('cover_image', '')} className="absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center cursor-pointer text-white text-xs font-bold" style={{ background: 'rgba(239,68,68,0.8)' }}>✕</button>
                </>
              ) : (
                <label className="flex flex-col items-center justify-center h-full cursor-pointer gap-2">
                  <Plus size={24} className="text-[#4a5068]" />
                  <span className="text-xs text-[#4a5068]">{uploading ? 'Uploading...' : 'Upload cover image'}</span>
                  <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" disabled={uploading} />
                </label>
              )}
            </div>
          </Section>

          {/* Business Photos */}
          <Section title={`Photos (${form.images.length}/8)`}>
            <div className="grid grid-cols-4 gap-2.5">
              {form.images.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                  <img src={rewriteImageUrl(url)} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => removeImage(i)} className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full flex items-center justify-center cursor-pointer text-white text-[10px] font-bold" style={{ background: 'rgba(239,68,68,0.85)' }}>✕</button>
                </div>
              ))}
              {form.images.length < 8 && (
                <label className="aspect-square rounded-xl flex flex-col items-center justify-center cursor-pointer gap-1" style={{ background: 'rgba(10,11,15,0.8)', border: '1px dashed rgba(255,255,255,0.08)' }}>
                  <Plus size={18} className="text-[#4a5068]" />
                  <span className="text-[9px] text-[#4a5068]">{uploading ? '...' : 'Add'}</span>
                  <input type="file" accept="image/*" multiple onChange={handleAddImages} className="hidden" disabled={uploading} />
                </label>
              )}
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
              {/* Cover preview */}
              {form.cover_image && (
                <div className="h-28 overflow-hidden">
                  <img src={rewriteImageUrl(form.cover_image)} alt="" className="h-full w-full object-cover" />
                </div>
              )}
              <div className="relative px-5 pt-5 pb-4">
                {!form.cover_image && <div className="absolute inset-x-0 top-0 h-20 opacity-40" style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(0,212,255,0.1))' }} />}
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

                {/* Services preview */}
                {form.services.filter(s => s.name).length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1.5">Services</h4>
                    <div className="space-y-1">
                      {form.services.filter(s => s.name).slice(0, 3).map((s, i) => (
                        <div key={i} className="flex items-center justify-between text-[10px]">
                          <span className="text-[#a3adc3]">{s.name} · {s.duration}min</span>
                          <span className="text-[#00d4ff] font-semibold">${s.price}</span>
                        </div>
                      ))}
                      {form.services.filter(s => s.name).length > 3 && <p className="text-[9px] text-[#4a5068]">+{form.services.filter(s => s.name).length - 3} more</p>}
                    </div>
                  </div>
                )}

                {/* Photos preview */}
                {form.images.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1.5">Photos</h4>
                    <div className="grid grid-cols-3 gap-1 rounded-lg overflow-hidden">
                      {form.images.slice(0, 3).map((url, i) => (
                        <div key={i} className="aspect-square overflow-hidden">
                          <img src={rewriteImageUrl(url)} alt="" className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                    {form.images.length > 3 && <p className="text-[9px] text-[#4a5068] mt-1">+{form.images.length - 3} more</p>}
                  </div>
                )}

                {/* Contact */}
                <div className="space-y-1.5">
                  {form.phone && <p className="flex items-center gap-1.5 text-[10px] text-[#a3adc3]"><Phone size={10} /> {form.phone}</p>}
                  {form.website && <p className="flex items-center gap-1.5 text-[10px] text-[#a3adc3] truncate"><Globe size={10} /> {form.website}</p>}
                  {form.address && <p className="flex items-center gap-1.5 text-[10px] text-[#a3adc3]"><MapPin size={10} /> {form.address}</p>}
                  {form.social_links.filter(l => l.url).map((l, i) => (
                    <p key={i} className="flex items-center gap-1.5 text-[10px] text-[#a3adc3] truncate"><Globe size={10} /> {l.platform}: {l.url}</p>
                  ))}
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
