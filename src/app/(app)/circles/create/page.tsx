'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, Globe, Lock, UserPlus, MapPin, Search, X } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  'Tech', 'Business', 'Food', 'Beauty', 'Fitness', 'Crypto',
  'Travel', 'Art', 'Music', 'Lifestyle', 'Health', 'Education', 'Other',
];

const VISIBILITY = [
  { value: 'public', label: 'Public', icon: <Globe size={14} />, desc: 'Anyone can find and see' },
  { value: 'private', label: 'Private', icon: <Lock size={14} />, desc: 'Only members can see' },
  { value: 'invite_only', label: 'Invite Only', icon: <UserPlus size={14} />, desc: 'Must be invited' },
];

const JOIN_MODE = [
  { value: 'open', label: 'Open', desc: 'Anyone can join instantly' },
  { value: 'request', label: 'Request', desc: 'Admin approval needed' },
  { value: 'invite_only', label: 'Invite', desc: 'By invitation only' },
];

export default function CreateCirclePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [joinMode, setJoinMode] = useState('open');

  // ── Address geocoding ──
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<Array<{ id: string; display_name: string; lat: number; lng: number }>>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [selectedAddress, setSelectedAddress] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchAddress = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setAddressResults([]); return; }
    setAddressLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`,
        { headers: { 'User-Agent': 'GaoSocial/1.0' } }
      );
      const data = await res.json();
      setAddressResults(data.map((r: any) => ({
        id: r.place_id,
        display_name: r.display_name,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
      })));
    } catch {
      setAddressResults([]);
    } finally {
      setAddressLoading(false);
    }
  }, []);

  const handleAddressInput = useCallback((val: string) => {
    setAddressQuery(val);
    setSelectedAddress('');
    setLocationLat(null);
    setLocationLng(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchAddress(val), 300);
  }, [searchAddress]);

  const handleSelectAddress = useCallback((result: typeof addressResults[0]) => {
    setAddressQuery(result.display_name);
    setSelectedAddress(result.display_name);
    setLocationLat(result.lat);
    setLocationLng(result.lng);
    setAddressResults([]);
    // Auto-fill city from address
    const parts = result.display_name.split(',').map(s => s.trim());
    if (parts.length >= 2 && !city) {
      setCity(parts[parts.length - 3] || parts[parts.length - 2] || parts[0]);
    }
  }, [city]);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Circle name is required'); return; }
    if (!category) { toast.error('Pick a category'); return; }

    const token = localStorage.getItem('access_token');
    if (!token) { toast.error('Please login first'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/v1/circles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name,
          category: category.toLowerCase(),
          description,
          city,
          visibility,
          join_mode: joinMode,
          location_lat: locationLat,
          location_lng: locationLng,
        }),
      });
      if (res.ok) {
        toast.success('Circle created!');
        router.push('/circles');
      } else {
        const err = await res.json();
        toast.error(err.error?.message || 'Failed to create');
      }
    } catch { toast.error('Network error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 lg:px-8 py-3" style={{ background: 'rgba(10,11,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#a3adc3] cursor-pointer"><ArrowLeft size={18} /> Back</button>
        <h1 className="text-sm font-bold text-white">Create Circle</h1>
        <button onClick={handleCreate} disabled={saving} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer" style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Create
        </button>
      </div>

      <div className="mx-auto max-w-lg lg:max-w-2xl px-4 lg:px-8 py-6 pb-24 space-y-5">
        {/* Name */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">Circle Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dallas AI Builders" maxLength={200} className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#2d3548]" style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }} />
        </div>

        {/* Category */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-2 block">Category *</label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)} className="rounded-full px-3 py-1.5 text-[11px] font-medium cursor-pointer transition-all" style={category === cat ? { background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' } : { background: 'rgba(17,19,24,0.8)', color: '#4a5068', border: '1px solid rgba(255,255,255,0.06)' }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this circle about?" maxLength={2000} rows={3} className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none resize-none placeholder:text-[#2d3548]" style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }} />
        </div>

        {/* Address with geocoding */}
        <div className="relative">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">Address / Location</label>
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-2.5"
            style={{
              background: 'rgba(17,19,24,0.8)',
              border: selectedAddress ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {addressLoading ? (
              <Loader2 size={14} className="shrink-0 animate-spin text-[#00d4ff]" />
            ) : (
              <Search size={14} className="shrink-0" style={{ color: selectedAddress ? '#00d4ff' : '#4a5068' }} />
            )}
            <input
              value={addressQuery}
              onChange={(e) => handleAddressInput(e.target.value)}
              placeholder="Search address, city, or place…"
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#2d3548]"
            />
            {addressQuery && (
              <button onClick={() => { setAddressQuery(''); setSelectedAddress(''); setLocationLat(null); setLocationLng(null); setAddressResults([]); }} className="shrink-0 cursor-pointer" style={{ color: '#4a5068' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Selected address confirmation */}
          {selectedAddress && locationLat !== null && (
            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)' }}>
              <MapPin size={12} className="shrink-0" style={{ color: '#00d4ff' }} />
              <span className="text-[11px] text-[#a3adc3] truncate flex-1">{selectedAddress}</span>
              <span className="text-[9px] text-[#4a5068] shrink-0">{locationLat.toFixed(4)}, {locationLng!.toFixed(4)}</span>
            </div>
          )}

          {/* Autocomplete results */}
          {addressResults.length > 0 && !selectedAddress && (
            <div
              className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl overflow-hidden"
              style={{ background: 'rgba(10,11,15,0.98)', border: '1px solid rgba(0,212,255,0.12)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}
            >
              {addressResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelectAddress(r)}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-[rgba(0,212,255,0.06)] cursor-pointer"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <MapPin size={13} className="shrink-0" style={{ color: '#00d4ff' }} />
                  <span className="text-xs text-[#a3adc3] truncate">{r.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* City */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">City / Region</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Dallas, TX or Global" className="w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder:text-[#2d3548]" style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }} />
        </div>

        {/* Visibility */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-2 block">Visibility</label>
          <div className="space-y-2">
            {VISIBILITY.map(v => (
              <button key={v.value} onClick={() => setVisibility(v.value)} className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left cursor-pointer" style={visibility === v.value ? { background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' } : { background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: visibility === v.value ? '#00d4ff' : '#4a5068' }}>{v.icon}</span>
                <div>
                  <p className="text-sm font-medium" style={{ color: visibility === v.value ? '#00d4ff' : 'white' }}>{v.label}</p>
                  <p className="text-[10px] text-[#4a5068]">{v.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Join mode */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#4a5068] mb-2 block">Join Mode</label>
          <div className="flex gap-2">
            {JOIN_MODE.map(j => (
              <button key={j.value} onClick={() => setJoinMode(j.value)} className="flex-1 rounded-xl py-2.5 text-center cursor-pointer" style={joinMode === j.value ? { background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' } : { background: 'rgba(17,19,24,0.8)', color: '#4a5068', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs font-semibold">{j.label}</p>
                <p className="text-[9px] mt-0.5" style={{ color: joinMode === j.value ? 'rgba(0,212,255,0.7)' : '#2d3548' }}>{j.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
