'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, MapPin, Image as ImageIcon, Lock, Loader2, Sparkles, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useLocationStore } from '@/stores/locationStore';
import { THEME_LIST, getTheme } from './themes';

interface RecipientUser {
  id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (capsule: Record<string, unknown>) => void;
}

const PRESETS = [
  { label: '1 month', months: 1 },
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
  { label: '5 years', months: 60 },
  { label: '10 years', months: 120 },
];

export default function CapsuleCreateModal({ open, onClose, onCreated }: Props) {
  const { lat: userLat, lng: userLng } = useLocationStore();
  const [step, setStep] = useState<'compose' | 'recipients' | 'location' | 'time' | 'review'>('compose');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [locationLat, setLocationLat] = useState<number | null>(userLat || null);
  const [locationLng, setLocationLng] = useState<number | null>(userLng || null);
  const [locationName, setLocationName] = useState('Current location');
  const [unlockMonths, setUnlockMonths] = useState(12);
  const [customDate, setCustomDate] = useState('');
  const [themeId, setThemeId] = useState('classic');
  const [recipients, setRecipients] = useState<RecipientUser[]>([]);
  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipientResults, setRecipientResults] = useState<RecipientUser[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [following, setFollowing] = useState<RecipientUser[]>([]);
  const [followingLoaded, setFollowingLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedTheme = getTheme(themeId);

  const reset = () => {
    setStep('compose');
    setTitle(''); setMessage(''); setPhotos([]);
    setUnlockMonths(12); setCustomDate('');
    setThemeId('classic');
    setRecipients([]); setRecipientQuery(''); setRecipientResults([]);
  };

  // Fetch following list once when modal opens — used as default suggestions
  useEffect(() => {
    if (!open || followingLoaded) return;
    (async () => {
      try {
        const token = localStorage.getItem('access_token') || '';
        const res = await fetch('/api/v1/follows?type=following', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const rows = (data?.data || []) as Array<Record<string, unknown>>;
        const users: RecipientUser[] = rows
          .filter(r => r.following_user_id)
          .map(r => ({
            id: r.following_user_id as string,
            username: r.user_username as string | undefined,
            display_name: r.user_name as string | undefined,
            avatar_url: r.user_avatar as string | undefined,
          }));
        setFollowing(users);
      } catch { /* fail silently — search still works */ }
      setFollowingLoaded(true);
    })();
  }, [open, followingLoaded]);

  // Debounced user search
  useEffect(() => {
    if (!recipientQuery.trim() || recipientQuery.trim().length < 2) {
      setRecipientResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const token = localStorage.getItem('access_token') || '';
        const res = await fetch(
          `/api/v1/search?q=${encodeURIComponent(recipientQuery.trim())}&tab=people&limit=8`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await res.json();
        const people = (data?.data?.people || []) as RecipientUser[];
        setRecipientResults(people);
      } catch { setRecipientResults([]); }
      setSearchingUsers(false);
    }, 280);
    return () => clearTimeout(handle);
  }, [recipientQuery]);

  const addRecipient = (u: RecipientUser) => {
    if (recipients.some(r => r.id === u.id)) return;
    if (recipients.length >= 10) { toast.error('Up to 10 recipients'); return; }
    setRecipients(rs => [...rs, u]);
    setRecipientQuery('');
    setRecipientResults([]);
  };

  const removeRecipient = (id: string) => setRecipients(rs => rs.filter(r => r.id !== id));

  const close = () => { reset(); onClose(); };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > 5) { toast.error('Max 5 photos'); return; }
    setUploading(true);
    try {
      const token = localStorage.getItem('access_token') || '';
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/v1/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data?.url) setPhotos(p => [...p, data.data.url]);
        }
      }
    } catch { toast.error('Upload failed'); }
    setUploading(false);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocationLat(pos.coords.latitude);
        setLocationLng(pos.coords.longitude);
        setLocationName('Current location');
        toast.success('Location set');
      },
      () => toast.error('Could not get location'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const computeUnlockDate = () => {
    if (customDate) return new Date(customDate);
    const d = new Date();
    d.setMonth(d.getMonth() + unlockMonths);
    return d;
  };

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) { toast.error('Title and message required'); return; }
    if (locationLat == null || locationLng == null) { toast.error('Location required'); return; }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch('/api/v1/capsules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title, message, photos,
          location_lat: locationLat, location_lng: locationLng, location_name: locationName,
          unlock_at: computeUnlockDate().toISOString(),
          unlock_radius: 100,
          capsule_type: recipients.length > 1 ? 'family' : recipients.length === 1 ? 'couple' : 'private',
          recipient_ids: recipients.map(r => r.id),
          theme: themeId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success('🪦 Capsule buried! See you in the future...');
        onCreated?.(data.data);
        close();
      } else {
        const err = await res.json();
        toast.error(err.error?.message || 'Failed to bury capsule');
      }
    } catch { toast.error('Network error'); }
    setSubmitting(false);
  };

  const unlockDate = computeUnlockDate();
  const formatUnlock = unlockDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-end justify-center lg:items-center"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="w-full max-w-lg max-h-[90dvh] rounded-t-3xl lg:rounded-3xl flex flex-col overflow-hidden"
          style={{ background: 'rgba(10,11,15,0.97)', border: '1px solid rgba(168,85,247,0.15)', boxShadow: '0 0 60px rgba(168,85,247,0.1)' }}
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-2">
              <span className="text-xl">🪦</span>
              <div>
                <h2 className="text-base font-bold text-white">Bury a Time Capsule</h2>
                <p className="text-[10px] text-[#4a5068]">Step {['compose','recipients','location','time','review'].indexOf(step) + 1} of 5</p>
              </div>
            </div>
            <button onClick={close} className="h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer text-[#4a5068] hover:text-white" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <X size={16} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-0.5 bg-white/5">
            <motion.div
              animate={{ width: `${((['compose','recipients','location','time','review'].indexOf(step) + 1) / 5) * 100}%` }}
              className="h-full"
              style={{ background: 'linear-gradient(90deg, #a855f7, #ec4899)' }}
            />
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {/* STEP 1: Compose */}
            {step === 'compose' && (
              <div className="space-y-4">
                {/* Theme picker */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-2 block">Occasion</label>
                  <div className="grid grid-cols-3 lg:grid-cols-6 gap-1.5">
                    {THEME_LIST.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setThemeId(t.id)}
                        type="button"
                        className="flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 cursor-pointer transition-all"
                        style={themeId === t.id
                          ? { background: 'rgba(168,85,247,0.12)', border: '1.5px solid rgba(168,85,247,0.5)', boxShadow: '0 0 16px rgba(168,85,247,0.15)' }
                          : { background: 'rgba(17,19,24,0.5)', border: '1.5px solid rgba(255,255,255,0.04)' }}
                      >
                        <span className="text-lg">{t.emoji}</span>
                        <span className="text-[9px] font-medium leading-tight text-center" style={{ color: themeId === t.id ? '#fff' : '#a3adc3' }}>{t.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#4a5068] mt-1.5 px-1">{selectedTheme.description}</p>
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1.5 block">Title</label>
                  <input
                    value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="A letter to my future self..."
                    maxLength={120}
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-[#2d3548]"
                    style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1.5 block">Message</label>
                  <textarea
                    value={message} onChange={e => setMessage(e.target.value)}
                    placeholder="Dear me from 10 years ago, today I am..."
                    maxLength={2000}
                    rows={6}
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-[#2d3548] resize-none"
                    style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
                  />
                  <p className="text-[9px] text-[#4a5068] mt-1 text-right">{message.length}/2000</p>
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1.5 block">Photos (optional, max 5)</label>
                  <div className="grid grid-cols-5 gap-2">
                    {photos.map((url, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        <button
                          onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full flex items-center justify-center cursor-pointer"
                          style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}
                        ><X size={11} /></button>
                      </div>
                    ))}
                    {photos.length < 5 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="aspect-square rounded-xl flex items-center justify-center cursor-pointer"
                        style={{ background: 'rgba(168,85,247,0.06)', border: '1px dashed rgba(168,85,247,0.2)' }}
                      >
                        {uploading ? <Loader2 size={16} className="animate-spin text-[#a855f7]" /> : <ImageIcon size={16} className="text-[#a855f7]" />}
                      </button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                </div>
              </div>
            )}

            {/* STEP 2: Recipients */}
            {step === 'recipients' && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="h-16 w-16 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.2)' }}>
                    <Users size={28} className="text-[#ec4899]" />
                  </div>
                  <h3 className="text-base font-bold text-white">Who is this for?</h3>
                  <p className="text-xs text-[#4a5068] mt-1 px-4">Leave empty to keep it just for yourself, or send it to someone — they&apos;ll be notified now and can open it on the unlock date.</p>
                </div>

                {/* Selected chips */}
                {recipients.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {recipients.map(r => (
                      <div key={r.id} className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1" style={{ background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.25)' }}>
                        {r.avatar_url
                          ? <img src={r.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                          : <div className="h-5 w-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: 'rgba(236,72,153,0.25)' }}>👤</div>}
                        <span className="text-xs text-white">{r.display_name || r.username || 'User'}</span>
                        <button onClick={() => removeRecipient(r.id)} className="text-[#ec4899] hover:text-white cursor-pointer">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5068] pointer-events-none" />
                  <input
                    autoFocus
                    value={recipientQuery}
                    onChange={e => setRecipientQuery(e.target.value)}
                    placeholder="Search by username or name..."
                    className="w-full rounded-xl pl-9 pr-9 py-2.5 text-sm text-white outline-none placeholder:text-[#2d3548]"
                    style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
                  />
                  {searchingUsers
                    ? <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#4a5068]" />
                    : recipientQuery && (
                      <button
                        onClick={() => { setRecipientQuery(''); setRecipientResults([]); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center cursor-pointer text-[#4a5068] hover:text-white hover:bg-white/[0.05]"
                        aria-label="Clear search"
                      >
                        <X size={12} />
                      </button>
                    )}
                </div>

                {(() => {
                  const querying = recipientQuery.trim().length >= 2;
                  const list = querying ? recipientResults : following.filter(u => !recipients.some(r => r.id === u.id));
                  const headerText = querying ? 'Search results' : 'From people you follow';

                  if (querying && !searchingUsers && recipientResults.length === 0) {
                    return <p className="text-[11px] text-[#4a5068] text-center py-2">No users found for &ldquo;{recipientQuery.trim()}&rdquo;</p>;
                  }
                  if (!querying && !followingLoaded) {
                    return (
                      <div className="space-y-1.5">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl animate-pulse" style={{ background: 'rgba(17,19,24,0.5)' }}>
                            <div className="h-8 w-8 rounded-full bg-white/[0.05]" />
                            <div className="flex-1 h-3 rounded bg-white/[0.05]" />
                          </div>
                        ))}
                      </div>
                    );
                  }
                  if (!querying && followingLoaded && list.length === 0) {
                    return <p className="text-[11px] text-[#4a5068] text-center py-2">Search by username to send to anyone on Gao</p>;
                  }
                  if (list.length === 0) return null;

                  return (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#4a5068] px-1 mb-1.5">{headerText}</p>
                      <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        {list.slice(0, 8).map(u => {
                          const already = recipients.some(r => r.id === u.id);
                          return (
                            <button
                              key={u.id}
                              onClick={() => addRecipient(u)}
                              disabled={already}
                              className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-white/[0.03] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {u.avatar_url
                                ? <img src={u.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                                : <div className="h-8 w-8 rounded-full flex items-center justify-center text-sm" style={{ background: 'rgba(255,255,255,0.05)' }}>👤</div>}
                              <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm text-white truncate">{u.display_name || u.username || 'User'}</p>
                                {u.username && <p className="text-[10px] text-[#4a5068] truncate">@{u.username}</p>}
                              </div>
                              {already && <span className="text-[10px] text-[#ec4899]">Added</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="rounded-xl px-3 py-2.5 text-[11px] leading-relaxed" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.12)', color: '#c4b5fd' }}>
                  💡 Recipients see the title now but the message + photos stay hidden until the unlock date. They&apos;ll get a notification when it&apos;s ready to open.
                </div>
              </div>
            )}

            {/* STEP 3: Location */}
            {step === 'location' && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="h-16 w-16 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
                    <MapPin size={28} className="text-[#a855f7]" />
                  </div>
                  <h3 className="text-base font-bold text-white">Where to bury it?</h3>
                  <p className="text-xs text-[#4a5068] mt-1">Tagged with this spot as a memory of where it was made</p>
                </div>

                <button
                  onClick={useCurrentLocation}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer"
                  style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}
                >
                  <MapPin size={18} className="text-[#a855f7]" />
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-white">Use current location</p>
                    <p className="text-[10px] text-[#4a5068]">
                      {locationLat != null ? `${locationLat.toFixed(4)}°, ${locationLng?.toFixed(4)}°` : 'Tap to set'}
                    </p>
                  </div>
                </button>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1.5 block">Place name (optional)</label>
                  <input
                    value={locationName} onChange={e => setLocationName(e.target.value)}
                    placeholder="Eiffel Tower, our cafe..."
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-[#2d3548]"
                    style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
                  />
                </div>
              </div>
            )}

            {/* STEP 3: Time */}
            {step === 'time' && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="h-16 w-16 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.2)' }}>
                    <Calendar size={28} className="text-[#ec4899]" />
                  </div>
                  <h3 className="text-base font-bold text-white">When to unlock?</h3>
                  <p className="text-xs text-[#4a5068] mt-1">Locked until this date — even from you</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.map(p => (
                    <button
                      key={p.months}
                      onClick={() => { setUnlockMonths(p.months); setCustomDate(''); }}
                      className="rounded-xl py-3 text-xs font-semibold cursor-pointer"
                      style={!customDate && unlockMonths === p.months
                        ? { background: 'rgba(236,72,153,0.15)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.25)' }
                        : { background: 'rgba(17,19,24,0.5)', color: '#a3adc3', border: '1px solid rgba(255,255,255,0.04)' }}
                    >{p.label}</button>
                  ))}
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1.5 block">Or pick a custom date</label>
                  <input
                    type="date"
                    value={customDate}
                    min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    onChange={e => setCustomDate(e.target.value)}
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                    style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
                  />
                </div>

                <div className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.12)' }}>
                  <p className="text-[10px] text-[#4a5068]">Will unlock on</p>
                  <p className="text-sm font-bold text-[#ec4899]">{formatUnlock}</p>
                </div>
              </div>
            )}

            {/* STEP 4: Review */}
            {step === 'review' && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="h-16 w-16 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(236,72,153,0.1))', border: '1px solid rgba(168,85,247,0.2)' }}>
                    <Sparkles size={28} className="text-[#a855f7]" />
                  </div>
                  <h3 className="text-base font-bold text-white">Ready to bury?</h3>
                  <p className="text-xs text-[#4a5068] mt-1">Once buried, you can&apos;t open it until the date</p>
                </div>

                <div className="space-y-2 rounded-xl px-4 py-3" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <Row label="Occasion" value={`${selectedTheme.emoji} ${selectedTheme.label}`} />
                  <Row label="Title" value={title} />
                  <Row label="Send to" value={recipients.length === 0 ? 'Just me' : recipients.map(r => r.display_name || r.username || 'User').join(', ')} />
                  <Row label="Location" value={locationName || `${locationLat?.toFixed(4)}°, ${locationLng?.toFixed(4)}°`} />
                  <Row label="Unlock date" value={formatUnlock} />
                  <Row label="Photos" value={`${photos.length} attached`} />
                </div>

                <div className="flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.12)' }}>
                  <Lock size={14} className="text-[#EAB308] mt-0.5 shrink-0" />
                  <p className="text-[10px] text-[#EAB308] leading-relaxed">
                    Sealed until {formatUnlock} — you can&apos;t peek before then, even from your future self.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 py-4 flex gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {step !== 'compose' && (
              <button
                onClick={() => {
                  const order = ['compose', 'recipients', 'location', 'time', 'review'] as const;
                  setStep(order[order.indexOf(step) - 1]);
                }}
                className="rounded-xl px-4 py-3 text-xs font-semibold cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#a3adc3' }}
              >Back</button>
            )}

            {step !== 'review' ? (
              <button
                onClick={() => {
                  if (step === 'compose' && (!title.trim() || !message.trim())) { toast.error('Fill title and message'); return; }
                  if (step === 'location' && (locationLat == null || locationLng == null)) { toast.error('Set location'); return; }
                  const order = ['compose', 'recipients', 'location', 'time', 'review'] as const;
                  setStep(order[order.indexOf(step) + 1]);
                }}
                className="flex-1 rounded-xl py-3 text-sm font-bold cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white' }}
              >Continue</button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-xl py-3 text-sm font-bold cursor-pointer disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white' }}
              >
                {submitting ? 'Burying...' : '🪦 Bury Capsule'}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-[#4a5068] uppercase tracking-wider">{label}</span>
      <span className="text-xs text-white text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}
