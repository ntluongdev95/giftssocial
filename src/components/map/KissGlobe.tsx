'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import maplibregl from 'maplibre-gl';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useMap } from './WorldMap';
import { useFriendStore } from '@/stores/friendStore';
import SignInGateSheet from '@/components/auth/SignInGateSheet';
import { useAuthStore } from '@/stores/auth-store';
import { useMapStore } from '@/stores/mapStore';

const fetcher = (url: string) => fetch(url, {
  headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('access_token') || '' : ''}` },
}).then(r => r.json());

interface Kiss {
  id: string;
  sender_id: string; sender_name: string; sender_avatar?: string;
  receiver_id: string; receiver_name: string; receiver_avatar?: string;
  message: string; emoji: string; visibility: string;
  sender_lat: number; sender_lng: number;
  receiver_lat: number; receiver_lng: number;
  opened: boolean; created_at: string;
}

// ── Great circle interpolation ──
function interpolateGreatCircle(from: [number, number], to: [number, number], steps: number): [number, number][] {
  const toRad = (d: number) => d * Math.PI / 180;
  const toDeg = (r: number) => r * 180 / Math.PI;
  const [lng1, lat1] = from.map(toRad);
  const [lng2, lat2] = to.map(toRad);

  const d = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin((lat2 - lat1) / 2), 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin((lng2 - lng1) / 2), 2)
  ));

  if (d < 0.0001) return [from, to];

  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    points.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return points;
}


// ── Send Kiss Modal ──
function SendKissModal({ onClose, onSent, defaultReceiverId }: { onClose: () => void; onSent: () => void; defaultReceiverId?: string | null }) {
  const { friends, fetchFriends } = useFriendStore();
  const [following, setFollowing] = useState<{ id: string; name: string; avatar?: string }[]>([]);
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; avatar?: string }[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const [receiverId, setReceiverId] = useState(defaultReceiverId || '');
  const [friendSearch, setFriendSearch] = useState('');
  const [friendDropdownOpen, setFriendDropdownOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [message, setMessage] = useState('');
  const [emoji, setEmoji] = useState('💋');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    fetchFriends();
    // Also fetch following users as fallback
    const token = localStorage.getItem('access_token');
    if (token) {
      fetch('/api/v1/follows?type=following', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => {
          if (d.data) setFollowing(d.data.map((f: Record<string, unknown>) => ({
            id: (f.following_user_id || f.id) as string,
            name: (f.user_name || f.display_name || 'User') as string,
            avatar: (f.user_avatar || f.avatar_url) as string | undefined,
          })));
        })
        .catch(() => {});
    }
  }, [fetchFriends]);

  const handleSend = async () => {
    setSendError(null);
    if (!receiverId) { setSendError('Pick someone to send to'); return; }
    if (receiverId === useAuthStore.getState().user?.id) { setSendError("Can't send a kiss to yourself"); return; }
    if (!emoji) { setSendError('Choose a gift first'); return; }
    const token = localStorage.getItem('access_token');
    if (!token) { setSendError('Please login first'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/v1/kisses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ receiver_id: receiverId, message, emoji, visibility }),
      });
      if (res.ok) { toast.success('Kiss sent! ✈️💋'); onSent(); onClose(); }
      else { const d = await res.json(); setSendError(d.error?.message || 'Failed to send kiss'); }
    } catch { setSendError('Network error — please try again'); }
    finally { setSending(false); }
  };

  const GIFT_CATEGORIES = [
    { label: 'Love', gifts: [
      { emoji: '💋', name: 'Kiss', coins: 1 },
      { emoji: '❤️', name: 'Heart', coins: 1 },
      { emoji: '😘', name: 'Blow Kiss', coins: 5 },
      { emoji: '🥰', name: 'In Love', coins: 5 },
      { emoji: '💕', name: 'Two Hearts', coins: 10 },
      { emoji: '💖', name: 'Sparkling', coins: 20 },
      { emoji: '💝', name: 'Gift Heart', coins: 50 },
      { emoji: '❤️‍🔥', name: 'Fire Heart', coins: 100 },
    ]},
    { label: 'Flowers', gifts: [
      { emoji: '🌹', name: 'Rose', coins: 10 },
      { emoji: '🌸', name: 'Sakura', coins: 15 },
      { emoji: '💐', name: 'Bouquet', coins: 50 },
      { emoji: '🌻', name: 'Sunflower', coins: 10 },
      { emoji: '🌺', name: 'Hibiscus', coins: 15 },
      { emoji: '🪻', name: 'Lavender', coins: 20 },
    ]},
    { label: 'Luxury', gifts: [
      { emoji: '💎', name: 'Diamond', coins: 500 },
      { emoji: '👑', name: 'Crown', coins: 1000 },
      { emoji: '🏰', name: 'Castle', coins: 2000 },
      { emoji: '🛳️', name: 'Cruise', coins: 5000 },
      { emoji: '🚀', name: 'Rocket', coins: 10000 },
      { emoji: '🌍', name: 'The World', coins: 50000 },
    ]},
    { label: 'Fun', gifts: [
      { emoji: '🎁', name: 'Gift Box', coins: 5 },
      { emoji: '🧸', name: 'Teddy Bear', coins: 20 },
      { emoji: '🎂', name: 'Cake', coins: 30 },
      { emoji: '🍫', name: 'Chocolate', coins: 10 },
      { emoji: '🎵', name: 'Music', coins: 15 },
      { emoji: '⭐', name: 'Star', coins: 25 },
      { emoji: '🦋', name: 'Butterfly', coins: 50 },
      { emoji: '🌈', name: 'Rainbow', coins: 100 },
    ]},
  ];
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'rgba(10,11,15,0.98)', border: '1px solid rgba(239,68,68,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #f87171, #ec4899, #f87171)' }} />
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-base font-bold text-white">Send a Kiss ✈️💋</h3>
          <button onClick={onClose} className="text-[#4a5068] cursor-pointer"><X size={18} /></button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Pick recipient — search anyone */}
          <div className="relative">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">Send to</label>
            {(() => {
              const allPeople = [
                ...friends.map(f => ({ id: f.id, name: f.display_name, avatar: f.avatar_url, tag: 'Friend' as const })),
                ...following.filter(f => !friends.some(fr => fr.id === f.id)).map(f => ({ ...f, tag: 'Following' as const })),
                ...searchResults.filter(s => !friends.some(fr => fr.id === s.id) && !following.some(f => f.id === s.id)).map(s => ({ ...s, tag: 'User' as const })),
              ];
              const displayPerson = selectedPerson
                || allPeople.find(p => p.id === receiverId);
              const filtered = friendSearch
                ? allPeople.filter(p => p.name.toLowerCase().includes(friendSearch.toLowerCase()))
                : allPeople;

              const handleSearchInput = (q: string) => {
                setFriendSearch(q);
                if (searchTimer.current) clearTimeout(searchTimer.current);
                if (q.length >= 2) {
                  setSearching(true);
                  searchTimer.current = setTimeout(async () => {
                    try {
                      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}&tab=people&limit=10`);
                      if (res.ok) {
                        const data = await res.json();
                        setSearchResults((data.data?.people || []).map((r: Record<string, unknown>) => ({
                          id: r.id as string, name: r.title as string, avatar: r.image as string | undefined,
                        })));
                      }
                    } catch {}
                    setSearching(false);
                  }, 300);
                } else {
                  setSearchResults([]);
                }
              };

              const tagColor = { Friend: '#34d399', Following: '#00d4ff', User: '#4a5068' };

              return (
                <>
                  <button
                    type="button"
                    onClick={() => setFriendDropdownOpen(!friendDropdownOpen)}
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-left cursor-pointer"
                    style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {displayPerson ? (
                      <>
                        <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden text-[10px] font-bold" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                          {displayPerson.avatar ? <img src={displayPerson.avatar} alt="" className="h-full w-full object-cover" /> : displayPerson.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-white flex-1 truncate">{displayPerson.name}</span>
                      </>
                    ) : (
                      <span className="text-[#4a5068] flex-1">Search anyone...</span>
                    )}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4a5068" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                  </button>

                  {friendDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-50" style={{ background: 'rgba(10,11,15,0.98)', border: '1px solid rgba(0,212,255,0.12)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', maxHeight: '240px' }}>
                      <div className="px-2.5 pt-2.5 pb-1">
                        <input
                          value={friendSearch}
                          onChange={e => handleSearchInput(e.target.value)}
                          placeholder="Search people..."
                          className="w-full rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-[#4a5068] outline-none"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }}
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto" style={{ maxHeight: '195px' }}>
                        {searching && <p className="text-center text-[10px] text-[#00d4ff] py-2">Searching...</p>}
                        {!searching && filtered.length === 0 && friendSearch.length >= 2 && (
                          <p className="text-center text-[10px] text-[#4a5068] py-3">No results</p>
                        )}
                        {!searching && filtered.length === 0 && friendSearch.length < 2 && allPeople.length === 0 && (
                          <p className="text-center text-[10px] text-[#4a5068] py-3">Type to search people</p>
                        )}
                        {filtered.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setReceiverId(p.id); setSelectedPerson({ id: p.id, name: p.name, avatar: p.avatar }); setFriendDropdownOpen(false); setFriendSearch(''); setSearchResults([]); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-colors hover:bg-white/5"
                            style={p.id === receiverId ? { background: 'rgba(0,212,255,0.08)' } : {}}
                          >
                            <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 overflow-hidden text-[10px] font-bold" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                              {p.avatar ? <img src={p.avatar} alt="" className="h-full w-full object-cover" /> : p.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm text-white truncate flex-1">{p.name}</span>
                            {'tag' in p && <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: `${tagColor[p.tag as keyof typeof tagColor]}15`, color: tagColor[p.tag as keyof typeof tagColor] }}>{p.tag}</span>}
                            {p.id === receiverId && <span className="text-[#00d4ff] text-xs shrink-0">✓</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Gift picker — TikTok style */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-2 block">Choose a Gift</label>
            {/* Category tabs */}
            <div className="flex gap-1 mb-2">
              {GIFT_CATEGORIES.map((cat, idx) => (
                <button key={cat.label} onClick={() => setActiveCategory(idx)} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors" style={activeCategory === idx ? { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' } : { background: 'rgba(17,19,24,0.5)', color: '#4a5068', border: '1px solid rgba(255,255,255,0.04)' }}>
                  {cat.label}
                </button>
              ))}
            </div>
            {/* Gift grid */}
            <div className="grid grid-cols-4 gap-1.5 max-h-[140px] overflow-y-auto">
              {GIFT_CATEGORIES[activeCategory].gifts.map(g => (
                <button key={g.emoji} onClick={() => setEmoji(g.emoji)} className="flex flex-col items-center gap-0.5 rounded-xl py-2 cursor-pointer transition-all" style={emoji === g.emoji ? { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', transform: 'scale(1.05)' } : { background: 'rgba(17,19,24,0.4)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-2xl">{g.emoji}</span>
                  <span className="text-[8px] font-medium text-[#a3adc3] truncate w-full text-center px-1">{g.name}</span>
                  <span className="text-[8px] font-bold" style={{ color: '#fbbf24' }}>🪙 {g.coins}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">Message (optional)</label>
            <input
              value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="I miss you 💕"
              maxLength={200}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#2d3548]"
              style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
            />
          </div>

          {/* Visibility */}
          <div className="flex gap-2">
            {(['public', 'private'] as const).map(v => (
              <button key={v} onClick={() => setVisibility(v)} className="flex-1 rounded-xl py-2 text-xs font-semibold capitalize cursor-pointer" style={visibility === v ? { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' } : { background: 'rgba(17,19,24,0.5)', color: '#4a5068', border: '1px solid rgba(255,255,255,0.04)' }}>
                {v === 'public' ? '🌍 Public on Globe' : '🔒 Private'}
              </button>
            ))}
          </div>

          {/* Error */}
          {sendError && (
            <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div className="flex items-center gap-2">
                <span className="text-[12px]">⚠️</span>
                <p className="text-[11px] text-[#f87171] flex-1">{sendError}</p>
                <button onClick={() => setSendError(null)} className="text-[#f87171] cursor-pointer"><X size={12} /></button>
              </div>
              {sendError.includes('location sharing') && (
                <button
                  onClick={async () => {
                    setSendError(null);
                    try {
                      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
                        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
                      );
                      const token = localStorage.getItem('access_token');
                      if (!token) return;
                      const res = await fetch('/api/v1/users/me', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ location_lat: pos.coords.latitude, location_lng: pos.coords.longitude }),
                      });
                      if (res.ok) {
                        toast.success('Location updated!');
                        setSendError(null);
                      } else { setSendError('Failed to save location'); }
                    } catch {
                      setSendError('Location permission denied. Please enable it in browser settings.');
                    }
                  }}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-semibold cursor-pointer"
                  style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.15)' }}
                >
                  📍 Share my location now
                </button>
              )}
            </div>
          )}

          {/* Send */}
          <button onClick={handleSend} disabled={sending} className="w-full rounded-xl py-3 text-sm font-bold cursor-pointer disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #f87171, #ec4899)', color: 'white', boxShadow: '0 4px 20px rgba(236,72,153,0.3)' }}>
            {sending ? 'Sending…' : `Send ${emoji}`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Gift Effects Config ──
const GIFT_EFFECTS: Record<string, { particles: string[]; bg: string; sound?: string; animation?: string; subtitle?: string }> = {
  '💋': { particles: ['💋', '❤️', '💕', '✨'], bg: 'rgba(236,72,153,0.15)', subtitle: 'Mwah!' },
  '❤️': { particles: ['❤️', '💕', '💗', '✨'], bg: 'rgba(239,68,68,0.15)', subtitle: 'Love you!' },
  '😘': { particles: ['😘', '💋', '💕', '❤️'], bg: 'rgba(236,72,153,0.15)', subtitle: 'XOXO' },
  '🥰': { particles: ['🥰', '❤️', '✨', '💖'], bg: 'rgba(251,113,133,0.15)', subtitle: 'So sweet!' },
  '💕': { particles: ['💕', '💗', '💖', '❤️'], bg: 'rgba(236,72,153,0.15)', subtitle: 'Double love!' },
  '💖': { particles: ['💖', '✨', '⭐', '💫'], bg: 'rgba(236,72,153,0.2)', animation: 'sparkle', subtitle: '✨ Sparkling!' },
  '💝': { particles: ['💝', '🎀', '✨', '💖'], bg: 'rgba(236,72,153,0.15)', subtitle: 'A gift of love!' },
  '❤️‍🔥': { particles: ['🔥', '❤️‍🔥', '💥', '✨'], bg: 'rgba(239,68,68,0.2)', animation: 'fire', subtitle: '🔥 On fire!' },
  '🌹': { particles: ['🌹', '🌸', '🪻', '✨'], bg: 'rgba(225,29,72,0.15)', subtitle: 'A rose for you' },
  '🌸': { particles: ['🌸', '🌺', '✨', '💮'], bg: 'rgba(244,114,182,0.15)', subtitle: 'Cherry blossom' },
  '💐': { particles: ['🌹', '🌸', '🌺', '🌻', '💐', '✨'], bg: 'rgba(244,114,182,0.15)', subtitle: 'Beautiful bouquet!' },
  '🌻': { particles: ['🌻', '☀️', '✨', '🌼'], bg: 'rgba(234,179,8,0.15)', subtitle: 'Sunshine!' },
  '💎': { particles: ['💎', '✨', '⭐', '💫', '🔮'], bg: 'rgba(99,102,241,0.2)', animation: 'sparkle', subtitle: '💎 Flawless!' },
  '👑': { particles: ['👑', '✨', '⭐', '💎', '🏆'], bg: 'rgba(234,179,8,0.2)', animation: 'sparkle', subtitle: '👑 Royal gift!' },
  '🏰': { particles: ['🏰', '✨', '👑', '🌟', '🎆'], bg: 'rgba(167,139,250,0.2)', animation: 'fireworks', subtitle: '🏰 A castle for you!' },
  '🛳️': { particles: ['🛳️', '🌊', '⚓', '✨', '🐬'], bg: 'rgba(59,130,246,0.15)', subtitle: '⛵ Bon voyage!' },
  '🚀': { particles: ['🚀', '⭐', '🌟', '✨', '💫', '🪐'], bg: 'rgba(99,102,241,0.2)', animation: 'fireworks', subtitle: '🚀 To the moon!' },
  '🌍': { particles: ['🌍', '✨', '⭐', '🌟', '💫', '🎆', '🪐', '🌈'], bg: 'rgba(52,211,153,0.2)', animation: 'fireworks', subtitle: '🌍 The whole world!' },
  '🎁': { particles: ['🎁', '🎀', '✨', '🎉', '🎊'], bg: 'rgba(239,68,68,0.15)', subtitle: 'Surprise!' },
  '🧸': { particles: ['🧸', '❤️', '✨', '🎀'], bg: 'rgba(180,83,9,0.15)', subtitle: 'Cuddles!' },
  '🎂': { particles: ['🎂', '🎉', '🎊', '✨', '🕯️'], bg: 'rgba(234,179,8,0.15)', animation: 'fireworks', subtitle: '🎂 Make a wish!' },
  '🍫': { particles: ['🍫', '❤️', '✨', '😋'], bg: 'rgba(120,53,15,0.15)', subtitle: 'Sweet treat!' },
  '🎵': { particles: ['🎵', '🎶', '🎤', '✨', '🎧'], bg: 'rgba(167,139,250,0.15)', subtitle: '🎵 A song for you!' },
  '⭐': { particles: ['⭐', '✨', '🌟', '💫'], bg: 'rgba(234,179,8,0.15)', animation: 'sparkle', subtitle: 'You are a star!' },
  '🦋': { particles: ['🦋', '🌸', '✨', '🌺', '🌈'], bg: 'rgba(99,102,241,0.15)', subtitle: '🦋 Beautiful!' },
  '🌈': { particles: ['🌈', '✨', '⭐', '🦋', '☀️', '🌸'], bg: 'rgba(52,211,153,0.15)', animation: 'fireworks', subtitle: '🌈 Over the rainbow!' },
};

// ── Kiss Reveal Popup ──
function KissRevealPopup({ kiss, onClose, currentUserId, onSendBack }: { kiss: Kiss; onClose: () => void; currentUserId?: string; onSendBack?: (toId: string) => void }) {
  const senderDisplay = currentUserId === kiss.sender_id ? 'You' : kiss.sender_name;
  const receiverDisplay = currentUserId === kiss.receiver_id ? 'You' : kiss.receiver_name;
  const canSendBack = currentUserId === kiss.receiver_id && onSendBack;
  const fx = GIFT_EFFECTS[kiss.emoji] || GIFT_EFFECTS['💋'];
  const isFireworks = fx.animation === 'fireworks';
  const isSparkle = fx.animation === 'sparkle';
  const isFire = fx.animation === 'fire';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />

      {/* Full-screen particle shower */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.span
          key={`shower-${i}`}
          className="absolute text-3xl pointer-events-none"
          style={{ left: `${Math.random() * 100}%`, top: '-5%' }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: [0, 1, 1, 0], y: ['0vh', '110vh'], x: (Math.random() - 0.5) * 100 }}
          transition={{ duration: 3 + Math.random() * 2, delay: i * 0.15, repeat: Infinity, repeatDelay: Math.random() * 2 }}
        >
          {fx.particles[i % fx.particles.length]}
        </motion.span>
      ))}

      {/* Fireworks bursts */}
      {isFireworks && Array.from({ length: 5 }).map((_, i) => (
        <motion.div
          key={`fw-${i}`}
          className="absolute pointer-events-none"
          style={{ left: `${20 + Math.random() * 60}%`, top: `${20 + Math.random() * 40}%` }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: [0, 2.5, 3], opacity: [1, 1, 0] }}
          transition={{ duration: 1.5, delay: 0.5 + i * 0.4, repeat: Infinity, repeatDelay: 2 }}
        >
          {Array.from({ length: 8 }).map((_, j) => (
            <motion.span
              key={j}
              className="absolute text-xl"
              style={{ transform: `rotate(${j * 45}deg)` }}
              animate={{ x: [0, Math.cos(j * 45 * Math.PI / 180) * 60], y: [0, Math.sin(j * 45 * Math.PI / 180) * 60], opacity: [1, 0] }}
              transition={{ duration: 1, delay: 0.5 + i * 0.4 }}
            >
              {fx.particles[j % fx.particles.length]}
            </motion.span>
          ))}
        </motion.div>
      ))}

      <motion.div
        initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}
        transition={{ type: 'spring', damping: 15, stiffness: 200 }}
        className="relative flex flex-col items-center gap-4 px-12 py-10 rounded-3xl overflow-hidden w-full max-w-sm"
        style={{ background: 'rgba(10,11,15,0.95)', border: '1px solid rgba(236,72,153,0.2)', boxShadow: `0 0 80px ${fx.bg}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background glow */}
        <div className="absolute inset-0 rounded-3xl" style={{ background: `radial-gradient(circle at 50% 30%, ${fx.bg}, transparent 70%)` }} />

        {/* Main emoji — with special animations */}
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={isFire
            ? { scale: [0, 1.3, 1.1, 1.3, 1.1], rotate: [-30, 0, -3, 3, 0] }
            : isSparkle
              ? { scale: [0, 1.4, 1.2, 1.3, 1.2], rotate: [-30, 5, -5, 3, 0] }
              : { scale: [0, 1.3, 1], rotate: [-30, 5, 0] }
          }
          transition={isFire || isSparkle
            ? { duration: 2, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }
            : { delay: 0.2, duration: 0.6, ease: 'easeOut' }
          }
          className="relative text-8xl z-10"
        >
          {kiss.emoji}
          {/* Sparkle ring around emoji */}
          {isSparkle && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <motion.span key={i} className="absolute text-lg" style={{ transform: `rotate(${i * 60}deg) translateY(-50px)` }}
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 1.5, delay: i * 0.25, repeat: Infinity }}
                >✨</motion.span>
              ))}
            </motion.div>
          )}
          {/* Fire effect */}
          {isFire && (
            <>
              {Array.from({ length: 5 }).map((_, i) => (
                <motion.span key={i} className="absolute text-2xl" style={{ bottom: 0, left: `${10 + i * 18}%` }}
                  animate={{ y: [0, -30, -50], opacity: [0.8, 0.5, 0], scale: [1, 1.3, 0.5] }}
                  transition={{ duration: 0.8 + Math.random() * 0.5, delay: i * 0.15, repeat: Infinity }}
                >🔥</motion.span>
              ))}
            </>
          )}
        </motion.div>

        {/* ── Cinematic Scene — chibi characters run & hug ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="relative z-10 w-full"
        >
          <div className="relative h-48 w-full flex items-end justify-center overflow-hidden">
            {/* Ground line */}
            <div className="absolute bottom-6 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(236,72,153,0.2) 30%, rgba(0,212,255,0.2) 70%, transparent)' }} />

            {/* Quote */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0, 1, 1, 0] }}
              transition={{ duration: 3, times: [0, 0.1, 0.25, 0.75, 1], ease: 'easeInOut' }}
              className="absolute top-0 left-0 right-0 text-center text-[10px] italic text-[#4a5068] pointer-events-none"
            >
              distance means nothing when someone means everything
            </motion.p>

            {/* ── Sender chibi — runs from far left to receiver ── */}
            <motion.div
              initial={{ x: -130 }}
              animate={{ x: [-130, -40, 30, 65] }}
              transition={{ duration: 3, ease: 'easeOut', times: [0, 0.4, 0.8, 1] }}
              className="absolute bottom-6 z-10 flex flex-col items-center"
            >
              {/* Running bounce */}
              <motion.div
                animate={{ y: [0, -6, 0, -6, 0, -3, 0, 0] }}
                transition={{ duration: 2.8, ease: 'easeInOut', times: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1] }}
                className="flex flex-col items-center"
              >
                {/* Head = avatar */}
                <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold"
                  style={{ background: 'rgba(236,72,153,0.15)', border: '2.5px solid #ec4899', color: '#ec4899', boxShadow: '0 0 15px rgba(236,72,153,0.3)' }}>
                  {kiss.sender_avatar
                    ? <img src={kiss.sender_avatar} alt="" className="w-full h-full object-cover" />
                    : (kiss.sender_name || '?').charAt(0).toUpperCase()}
                </div>
                {/* Body — SVG stick figure */}
                <svg width="32" height="36" viewBox="0 0 32 36" className="-mt-1">
                  {/* Body */}
                  <line x1="16" y1="2" x2="16" y2="18" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* Arms — running pose, then open for hug */}
                  <motion.line x1="16" y1="8" x2="6" y2="4" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"
                    animate={{ x2: [6, 4, 6, 4, 2], y2: [4, 12, 4, 12, 2] }}
                    transition={{ duration: 2.8, times: [0, 0.15, 0.3, 0.7, 1] }}/>
                  <motion.line x1="16" y1="8" x2="26" y2="12" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"
                    animate={{ x2: [26, 28, 26, 28, 30], y2: [12, 4, 12, 4, 2] }}
                    transition={{ duration: 2.8, times: [0, 0.15, 0.3, 0.7, 1] }}/>
                  {/* Legs — running */}
                  <motion.line x1="16" y1="18" x2="10" y2="34" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"
                    animate={{ x2: [10, 20, 10, 20, 12] }}
                    transition={{ duration: 2.8, times: [0, 0.15, 0.3, 0.7, 1] }}/>
                  <motion.line x1="16" y1="18" x2="22" y2="34" stroke="#ec4899" strokeWidth="2" strokeLinecap="round"
                    animate={{ x2: [22, 12, 22, 12, 20] }}
                    transition={{ duration: 2.8, times: [0, 0.15, 0.3, 0.7, 1] }}/>
                </svg>
              </motion.div>
              <span className="text-[8px] font-semibold text-[#ec4899]">{senderDisplay}</span>
            </motion.div>

            {/* ── Receiver chibi — stands still, waiting ── */}
            <motion.div
              initial={{ x: 80, opacity: 0 }}
              animate={{ x: 80, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="absolute bottom-6 z-10 flex flex-col items-center"
            >
              <motion.div
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="flex flex-col items-center"
              >
                <div className="h-12 w-12 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold"
                  style={{ background: 'rgba(0,212,255,0.15)', border: '2.5px solid #00d4ff', color: '#00d4ff', boxShadow: '0 0 15px rgba(0,212,255,0.3)' }}>
                  {kiss.receiver_avatar
                    ? <img src={kiss.receiver_avatar} alt="" className="w-full h-full object-cover" />
                    : (kiss.receiver_name || '?').charAt(0).toUpperCase()}
                </div>
                {/* Standing pose — arms at side, slight wave when sender arrives */}
                <svg width="32" height="36" viewBox="0 0 32 36" className="-mt-1" style={{ transform: 'scaleX(-1)' }}>
                  <line x1="16" y1="2" x2="16" y2="18" stroke="#00d4ff" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* Arms: idle → open for hug */}
                  <motion.line x1="16" y1="8" x2="6" y2="14" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"
                    animate={{ x2: [6, 6, 6, 2], y2: [14, 14, 14, 3] }}
                    transition={{ duration: 3, times: [0, 0.7, 0.85, 1], ease: 'easeOut' }}/>
                  <motion.line x1="16" y1="8" x2="26" y2="14" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"
                    animate={{ x2: [26, 26, 26, 30], y2: [14, 14, 14, 3] }}
                    transition={{ duration: 3, times: [0, 0.7, 0.85, 1], ease: 'easeOut' }}/>
                  {/* Legs: standing still */}
                  <line x1="16" y1="18" x2="11" y2="34" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="16" y1="18" x2="21" y2="34" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </motion.div>
              <span className="text-[8px] font-semibold text-[#00d4ff]">{receiverDisplay}</span>
            </motion.div>

            {/* ── Glow when they meet ── */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 0, 0.8, 0.4], scale: [0, 0, 1.5, 2] }}
              transition={{ duration: 3.5, times: [0, 0.7, 0.85, 1], ease: 'easeOut' }}
              className="absolute w-24 h-24 rounded-full"
              style={{ bottom: '3rem', right: '20%', background: 'radial-gradient(circle, rgba(236,72,153,0.5), rgba(0,212,255,0.3), transparent 70%)' }}
            />

            {/* Particle burst when they meet */}
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * Math.PI * 2;
              return (
                <motion.span key={`hug-${i}`}
                  className="absolute text-lg pointer-events-none z-30"
                  style={{ bottom: '5rem', right: '25%' }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], x: [0, Math.cos(angle) * 80], y: [0, Math.sin(angle) * 80 - 20], scale: [0, 1.2, 0] }}
                  transition={{ delay: 2.9 + i * 0.04, duration: 1.2, ease: 'easeOut' }}
                >{fx.particles[i % fx.particles.length]}</motion.span>
              );
            })}
          </div>
        </motion.div>

        {/* Subtitle */}
        <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }}
          className="text-base font-bold z-10" style={{ color: '#ec4899' }}>{fx.subtitle}</motion.p>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6 }} className="z-10 flex flex-col items-center">
          <p className="text-base font-bold text-white text-center">
            From <span style={{ color: '#f87171' }}>{senderDisplay}</span>
          </p>
          {kiss.message && <p className="text-sm text-[#a3adc3] text-center mt-2 max-w-xs">{kiss.message}</p>}
          <p className="text-[10px] text-[#4a5068] text-center mt-2">
            {senderDisplay} → {receiverDisplay}
          </p>
          {canSendBack && (
            <button
              onClick={() => { onSendBack(kiss.sender_id); onClose(); }}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold cursor-pointer transition-transform active:scale-95"
              style={{ background: 'linear-gradient(135deg, #f87171, #ec4899)', color: 'white', boxShadow: '0 4px 16px rgba(236,72,153,0.3)' }}
            >
              💋 Send Back
            </button>
          )}
        </motion.div>

        {/* Orbiting particles around card */}
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.span
            key={`orbit-${i}`}
            className="absolute text-xl pointer-events-none z-0"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.8, 0],
              x: [0, (Math.random() - 0.5) * 250],
              y: [0, -100 - Math.random() * 150],
              scale: [0.5, 1.2, 0.3],
            }}
            transition={{ duration: 2.5 + Math.random() * 1.5, delay: i * 0.2, repeat: Infinity, repeatDelay: Math.random() }}
          >
            {fx.particles[i % fx.particles.length]}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}

// ── Flight HUD Overlay ──
function generateFlightCode(senderName: string, receiverName: string): string {
  const s = (senderName || 'X').charAt(0).toUpperCase();
  const r = (receiverName || 'Y').charAt(0).toUpperCase();
  const num = Math.abs(senderName.length * 37 + receiverName.length * 73) % 900 + 100;
  return `${s}${r}${num}`;
}

function FlightHUD({ from, to, progress, senderName, receiverName, emoji, turbulence }: {
  from: string; to: string; progress: number; senderName: string; receiverName: string; emoji: string; turbulence?: boolean;
}) {
  const pct = Math.round(progress * 100);
  const remaining = Math.max(0, Math.round((1 - progress) * 25));
  const flightCode = generateFlightCode(senderName, receiverName);
  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none" style={{ fontFamily: 'Inter, system-ui, monospace' }}>
      {/* Flight info card */}
      <div className="rounded-2xl px-5 py-3 flex flex-col items-center gap-2 min-w-[280px]" style={{ background: 'rgba(10,11,15,0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(236,72,153,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        {/* Flight title */}
        <div className="flex items-center gap-2 w-full">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(236,72,153,0.15)', color: '#ec4899' }}>FLIGHT</span>
          <span className="text-[11px] font-bold text-white tracking-wider">Love Air {flightCode}</span>
          <span className="text-[9px] text-[#4a5068] ml-auto">{emoji}</span>
        </div>
        {/* Route */}
        <div className="flex items-center gap-3 w-full">
          <div className="text-right flex-1">
            <p className="text-[10px] text-[#4a5068] uppercase tracking-wider">From</p>
            <p className="text-xs font-bold text-white truncate">{senderName}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-[#ec4899]" />
            <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, #ec4899, #f87171)' }} />
            <span className="text-sm">{emoji === '💋' ? '✈️' : emoji}</span>
            <div className="w-12 h-px" style={{ background: 'linear-gradient(90deg, #f87171, #ec4899)' }} />
            <div className="h-1.5 w-1.5 rounded-full bg-[#ec4899]" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-[#4a5068] uppercase tracking-wider">To</p>
            <p className="text-xs font-bold text-white truncate">{receiverName}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <div className="h-1 rounded-full overflow-hidden w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #ec4899, #f87171)' }} />
          </div>
        </div>

        {/* Turbulence warning */}
        {turbulence && (
          <div className="flex items-center gap-1.5 w-full rounded-lg px-2 py-1" style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.25)' }}>
            <span className="text-sm">⚠️</span>
            <span className="text-[9px] font-semibold" style={{ color: '#EAB308' }}>TURBULENCE — Fasten seatbelt</span>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between w-full text-[9px] text-[#4a5068]">
          <span>{from}</span>
          <span className="text-[#ec4899] font-semibold">{pct}% · ~{remaining}s</span>
          <span>{to}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──
export default function KissGlobe() {
  const { map } = useMap();
  const currentUserId = useAuthStore(s => s.user?.id);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendBackTo, setSendBackTo] = useState<string | null>(null);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [revealKiss, setRevealKiss] = useState<Kiss | null>(null);
  const [flightHUD, setFlightHUD] = useState<{ from: string; to: string; progress: number; senderName: string; receiverName: string; emoji: string; turbulence?: boolean } | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const animFrameRef = useRef<Map<string, number>>(new Map());
  const replayedRef = useRef<Set<string>>(new Set());
  const activeFollowRef = useRef<string | null>(null); // Only 1 kiss controls camera at a time

  const giftLayerOn = useMapStore(s => s.activeLayers.has('gift'));
  const searchParams = useSearchParams();
  const kissParam = searchParams.get('kiss');

  // Auto-enable gift layer when navigating with ?kiss= param
  useEffect(() => {
    if (kissParam && !useMapStore.getState().activeLayers.has('gift')) {
      useMapStore.getState().toggleLayer('gift');
    }
  }, [kissParam]);

  const { data, mutate } = useSWR<{ data: Kiss[] }>(giftLayerOn ? '/api/v1/kisses?limit=30' : null, fetcher, { refreshInterval: 30000 });
  const kisses = data?.data ?? [];

  // ── Place static gift marker (no animation) ──
  const placeGiftMarker = useCallback((kiss: Kiss) => {
    if (!map || markersRef.current.has(kiss.id)) return;

    const isReceiver = currentUserId === kiss.receiver_id;
    const isSender = currentUserId === kiss.sender_id;
    const to: [number, number] = [kiss.receiver_lng, kiss.receiver_lat];
    const displayName = isReceiver ? 'You' : (kiss.receiver_name || '?');
    const receiverInitial = displayName.charAt(0).toUpperCase();
    const hasOpened = kiss.opened;

    const el = document.createElement('div');
    el.style.cssText = 'cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;';

    if (!hasOpened) {
      // Unopened: receiver avatar with "waiting" animation
      el.innerHTML = `
        <div style="position:relative;">
          <div style="
            width:44px;height:44px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            background:rgba(236,72,153,0.15);
            border:2.5px solid #ec4899;
            box-shadow:0 0 16px rgba(236,72,153,0.3);
            font-size:16px;font-weight:700;color:#ec4899;
            overflow:hidden;
            animation:kiss-receiver-pulse 2s ease-in-out infinite;
          ">
            ${kiss.receiver_avatar
              ? `<img src="${kiss.receiver_avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
              : receiverInitial
            }
          </div>
          <span style="
            position:absolute;-top:6px;right:-6px;
            font-size:18px;
            animation:kiss-wave 1.5s ease-in-out infinite;
          ">🙌</span>
        </div>
        <span style="
          font-size:9px;font-weight:600;color:#ec4899;
          background:rgba(10,11,15,0.8);backdrop-filter:blur(4px);
          padding:1px 6px;border-radius:8px;
          white-space:nowrap;max-width:70px;overflow:hidden;text-overflow:ellipsis;
        ">${displayName}</span>
        <style>
          @keyframes kiss-receiver-pulse {
            0%,100% { box-shadow:0 0 16px rgba(236,72,153,0.3); }
            50% { box-shadow:0 0 24px rgba(236,72,153,0.6); }
          }
          @keyframes kiss-wave {
            0%,100% { transform:rotate(0deg); }
            25% { transform:rotate(15deg); }
            75% { transform:rotate(-15deg); }
          }
        </style>
      `;
    } else {
      // Opened: show the emoji with a happy glow
      el.innerHTML = `
        <div style="
          width:40px;height:40px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          background:rgba(236,72,153,0.1);
          border:2px solid rgba(236,72,153,0.3);
          font-size:22px;
        ">${kiss.emoji}</div>
        <span style="
          font-size:8px;font-weight:600;color:#a3adc3;
          background:rgba(10,11,15,0.7);
          padding:1px 5px;border-radius:6px;
          white-space:nowrap;
        ">${displayName}</span>
      `;
    }

    el.onclick = () => {
      if (isReceiver && !hasOpened) {
        setRevealKiss(kiss);
        fetch('/api/v1/kisses', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
          body: JSON.stringify({ id: kiss.id }),
        }).then(() => {
          mutate();
          // Update marker to opened state
          el.querySelector('div')!.innerHTML = `<span style="font-size:22px">${kiss.emoji}</span>`;
        });
      } else if (isReceiver || isSender) {
        setRevealKiss(kiss);
      }
    };

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(to).addTo(map);
    markersRef.current.set(kiss.id, marker);
  }, [map, currentUserId, mutate]);

  // ── Play flight animation (only when explicitly triggered) ──
  const playFlightAnimation = useCallback((kiss: Kiss) => {
    if (!map) return;

    // Cancel ALL existing flights first — only 1 flight at a time
    animFrameRef.current.forEach(f => { clearTimeout(f); cancelAnimationFrame(f); });
    animFrameRef.current.clear();
    markersRef.current.forEach((marker, key) => {
      if (key.startsWith('plane_')) { marker.remove(); marker.getElement().remove(); }
    });
    // Remove stale plane keys
    Array.from(markersRef.current.keys()).forEach(key => { if (key.startsWith('plane_')) markersRef.current.delete(key); });
    // Clean up all arc/trail layers
    kisses.forEach(k => {
      ['kiss-arc-', 'kiss-trail-'].forEach(prefix => {
        try { if (map.getLayer(`${prefix}${k.id}`)) map.removeLayer(`${prefix}${k.id}`); } catch {}
        try { if (map.getSource(`${prefix}${k.id}`)) map.removeSource(`${prefix}${k.id}`); } catch {}
      });
    });
    setFlightHUD(null);

    // Set this as the active followed kiss
    activeFollowRef.current = kiss.id;

    const from: [number, number] = [kiss.sender_lng, kiss.sender_lat];
    const to: [number, number] = [kiss.receiver_lng, kiss.receiver_lat];

    // Distance check
    const R = 6371;
    const dLat = (kiss.receiver_lat - kiss.sender_lat) * Math.PI / 180;
    const dLng = (kiss.receiver_lng - kiss.sender_lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(kiss.sender_lat * Math.PI / 180) * Math.cos(kiss.receiver_lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const isSameCity = distKm < 50;
    const isGlobe = useMapStore.getState().viewMode === '3d';

    // Route: great circle for all long distance (2D + 3D), short arc for same city
    const arcPoints = isSameCity
      ? interpolateGreatCircle(from, to, 80)
      : interpolateGreatCircle(from, to, 500);

    // Reverse geocode for HUD city names
    let senderCity = `${kiss.sender_lat.toFixed(1)}°`;
    let receiverCity = `${kiss.receiver_lat.toFixed(1)}°`;
    (async () => {
      try {
        const [sRes, rRes] = await Promise.all([
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${kiss.sender_lat}&lon=${kiss.sender_lng}&zoom=10`, { headers: { 'User-Agent': 'GaoSocial/1.0' } }).then(r => r.json()).catch(() => null),
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${kiss.receiver_lat}&lon=${kiss.receiver_lng}&zoom=10`, { headers: { 'User-Agent': 'GaoSocial/1.0' } }).then(r => r.json()).catch(() => null),
        ]);
        if (sRes?.address) senderCity = sRes.address.city || sRes.address.state || sRes.address.country || senderCity;
        if (rRes?.address) receiverCity = rRes.address.city || rRes.address.state || rRes.address.country || receiverCity;
      } catch {}
    })();

    // Remove existing gift marker — will re-place when plane arrives
    const existingGift = markersRef.current.get(kiss.id);
    if (existingGift) { existingGift.remove(); markersRef.current.delete(kiss.id); }

    // Animation element — airplane (long distance) or thrown gift (same city)
    const planeEl = document.createElement('div');
    if (isSameCity) {
      // Motorbike SVG pointing UP (North = 0°)
      planeEl.style.cssText = `pointer-events:none;width:44px;height:44px;`;
      planeEl.innerHTML = `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="mbglow-${kiss.id}" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <g filter="url(#mbglow-${kiss.id})">
          <!-- Back wheel -->
          <circle cx="22" cy="34" r="5" fill="none" stroke="#94a3b8" stroke-width="2"/>
          <circle cx="22" cy="34" r="1.5" fill="#64748b"/>
          <!-- Front wheel -->
          <circle cx="22" cy="10" r="5" fill="none" stroke="#94a3b8" stroke-width="2"/>
          <circle cx="22" cy="10" r="1.5" fill="#64748b"/>
          <!-- Frame -->
          <path d="M22 29 L22 15" stroke="#ec4899" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M22 15 L18 20 M22 15 L26 20" stroke="#ec4899" stroke-width="2" stroke-linecap="round"/>
          <!-- Rider body -->
          <ellipse cx="22" cy="22" rx="4" ry="3" fill="#ec4899" opacity="0.8"/>
          <!-- Rider head -->
          <circle cx="22" cy="17" r="3" fill="#fbbf24"/>
          <!-- Gift on back -->
          <rect x="17" y="26" width="10" height="8" rx="2" fill="#f87171" opacity="0.9"/>
          <path d="M17 30 L27 30 M22 26 L22 34" stroke="#fbbf24" stroke-width="1"/>
          <!-- Headlight glow -->
          <circle cx="22" cy="5" r="2" fill="#fbbf24" opacity="0.7">
            <animate attributeName="opacity" values="0.5;1;0.5" dur="0.6s" repeatCount="indefinite"/>
          </circle>
        </g>
      </svg>`;
    } else {
      planeEl.style.cssText = `pointer-events:none;width:64px;height:64px;`;
      const id = kiss.id.slice(0, 8);
      planeEl.innerHTML = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow-${id}" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.5"/>
          </filter>
          <linearGradient id="fuselage-${id}" x1="32" y1="6" x2="32" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#f8fafc"/><stop offset="40%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#cbd5e1"/>
          </linearGradient>
          <linearGradient id="wing-${id}" x1="6" y1="28" x2="58" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#64748b"/><stop offset="50%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#64748b"/>
          </linearGradient>
        </defs>
        <g filter="url(#shadow-${id})">
          <!-- Fuselage body -->
          <path d="M32 6 C29 6 27 10 27 16 L27 48 C27 52 29 56 32 58 C35 56 37 52 37 48 L37 16 C37 10 35 6 32 6Z" fill="url(#fuselage-${id})" stroke="#94a3b8" stroke-width="0.3"/>
          <!-- Fuselage center line -->
          <line x1="32" y1="8" x2="32" y2="54" stroke="#cbd5e1" stroke-width="0.5" opacity="0.5"/>
          <!-- Cockpit windows -->
          <ellipse cx="32" cy="10" rx="2" ry="2.5" fill="#0c4a6e" stroke="#0ea5e9" stroke-width="0.4"/>
          <ellipse cx="32" cy="10" rx="1.2" ry="1.5" fill="#38bdf8" opacity="0.6"/>
          <!-- Cabin windows (row of dots) -->
          <g fill="#64748b" opacity="0.6">
            <rect x="28" y="16" width="1" height="1" rx="0.5"/><rect x="28" y="19" width="1" height="1" rx="0.5"/>
            <rect x="28" y="22" width="1" height="1" rx="0.5"/><rect x="28" y="25" width="1" height="1" rx="0.5"/>
            <rect x="28" y="28" width="1" height="1" rx="0.5"/><rect x="28" y="31" width="1" height="1" rx="0.5"/>
            <rect x="35" y="16" width="1" height="1" rx="0.5"/><rect x="35" y="19" width="1" height="1" rx="0.5"/>
            <rect x="35" y="22" width="1" height="1" rx="0.5"/><rect x="35" y="25" width="1" height="1" rx="0.5"/>
            <rect x="35" y="28" width="1" height="1" rx="0.5"/><rect x="35" y="31" width="1" height="1" rx="0.5"/>
          </g>
          <!-- Main wings -->
          <path d="M27 24 L4 32 L6 34 L27 28Z" fill="url(#wing-${id})" stroke="#64748b" stroke-width="0.3"/>
          <path d="M37 24 L60 32 L58 34 L37 28Z" fill="url(#wing-${id})" stroke="#64748b" stroke-width="0.3"/>
          <!-- Wing tips -->
          <path d="M4 32 L3 30 L6 31Z" fill="#475569"/>
          <path d="M60 32 L61 30 L58 31Z" fill="#475569"/>
          <!-- Engines under wings -->
          <ellipse cx="16" cy="28" rx="2" ry="3.5" fill="#475569" stroke="#334155" stroke-width="0.3"/>
          <ellipse cx="48" cy="28" rx="2" ry="3.5" fill="#475569" stroke="#334155" stroke-width="0.3"/>
          <!-- Engine intake (front) -->
          <ellipse cx="16" cy="25" rx="1.8" ry="1" fill="#1e293b"/>
          <ellipse cx="48" cy="25" rx="1.8" ry="1" fill="#1e293b"/>
          <!-- Engine exhaust glow -->
          <ellipse cx="16" cy="32" rx="1.2" ry="1.5" fill="#f97316" opacity="0.5">
            <animate attributeName="opacity" values="0.3;0.7;0.3" dur="0.6s" repeatCount="indefinite"/>
          </ellipse>
          <ellipse cx="48" cy="32" rx="1.2" ry="1.5" fill="#f97316" opacity="0.5">
            <animate attributeName="opacity" values="0.3;0.7;0.3" dur="0.6s" repeatCount="indefinite" begin="0.3s"/>
          </ellipse>
          <!-- Horizontal stabilizer (tail wings) -->
          <path d="M27 46 L16 50 L18 51 L27 48Z" fill="#94a3b8" stroke="#64748b" stroke-width="0.3"/>
          <path d="M37 46 L48 50 L46 51 L37 48Z" fill="#94a3b8" stroke="#64748b" stroke-width="0.3"/>
          <!-- Vertical stabilizer (tail fin) -->
          <path d="M32 44 L32 56 L35 54 L35 46Z" fill="#ec4899" stroke="#be185d" stroke-width="0.3"/>
          <!-- Heart logo on tail -->
          <text x="33" y="52" font-size="5" text-anchor="middle">❤</text>
          <!-- Love Air stripe -->
          <line x1="28" y1="20" x2="28" y2="34" stroke="#ec4899" stroke-width="0.6" opacity="0.7"/>
          <line x1="36" y1="20" x2="36" y2="34" stroke="#ec4899" stroke-width="0.6" opacity="0.7"/>
          <!-- Navigation lights -->
          <circle cx="4" cy="32" r="0.8" fill="#ef4444">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite"/>
          </circle>
          <circle cx="60" cy="32" r="0.8" fill="#22c55e">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" begin="0.75s"/>
          </circle>
        </g>
      </svg>`;
    }
    // rotation=0 means pointing up (North). setRotation(bearing) points it in travel direction.
    const planeMarker = new maplibregl.Marker({ element: planeEl, anchor: 'center', rotationAlignment: 'map' })
      .setLngLat(from)
      .addTo(map);
    markersRef.current.set(`plane_${kiss.id}`, planeMarker);

    // Draw flight path
    const lineId = `kiss-arc-${kiss.id}`;
    try {
      if (!map.getSource(lineId)) {
        map.addSource(lineId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: arcPoints }, properties: {} } });
        if (isSameCity) {
          // Same city: subtle dotted arc
          map.addLayer({ id: lineId, type: 'line', source: lineId, paint: { 'line-color': '#ec4899', 'line-width': 1.5, 'line-opacity': 0.3, 'line-dasharray': [1, 2] } });
        } else {
          // Long distance: dashed flight path
          map.addLayer({ id: lineId, type: 'line', source: lineId, paint: { 'line-color': '#ec4899', 'line-width': 2, 'line-opacity': 0.5, 'line-dasharray': [2, 3] } });
        }
      }
    } catch {}

    // Trail line (shows where plane has been — solid)
    const trailId = `kiss-trail-${kiss.id}`;
    const trailCoords: [number, number][] = [];
    try {
      if (!map.getSource(trailId)) {
        map.addSource(trailId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} } });
        map.addLayer({ id: trailId, type: 'line', source: trailId, paint: { 'line-color': '#ec4899', 'line-width': 2.5, 'line-opacity': 0.7 } });
      }
    } catch {}

    const isFollowing = () => activeFollowRef.current === kiss.id;

    // ── Buttery smooth flight — direct camera control each frame ──
    const flightMs = isSameCity ? 3000 : isGlobe ? 25000 : 25000; // globe 1 orbit ~25s
    let t0 = 0;
    // Camera state — lerped every frame for zero jitter
    let camLng = from[0], camLat = from[1], camZoom = 9, camPitch = 0, camBearing = 0;
    let planeLng = from[0], planeLat = from[1], planeBrg = 0;

    // Turbulence zones — 2-3 random zones along the route
    const turbZones = isSameCity ? [] : Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => {
      const center = 0.15 + Math.random() * 0.6; // between 15%-75% of flight
      const width = 0.03 + Math.random() * 0.04; // 3-7% wide
      return { start: center - width, end: center + width };
    });
    let turbulenceActive = false;

    function fly(ts: number) {
      if (!t0) t0 = ts;
      const elapsed = ts - t0;
      // Ease-in-out-cubic for natural motion
      const lin = Math.min(elapsed / flightMs, 1);
      const t = lin < 0.5 ? 4 * lin * lin * lin : 1 - Math.pow(-2 * lin + 2, 3) / 2;

      if (t >= 1) {
        // Arrived — full cleanup
        planeMarker.remove();
        planeEl.remove();
        markersRef.current.delete(`plane_${kiss.id}`);
        animFrameRef.current.delete(kiss.id);
        placeGiftMarker(kiss);

        // Stop camera control + reset to normal view
        setFlightHUD(null);
        activeFollowRef.current = null;
        map?.jumpTo({ center: to, zoom: isGlobe ? 4 : 14, pitch: 0, bearing: 0 });

        // Clean arc/trail lines after delay
        setTimeout(() => {
          try {
            [trailId, lineId].forEach(lid => {
              try { if (map?.getLayer(lid)) map.removeLayer(lid); } catch {}
              try { if (map?.getSource(lid)) map.removeSource(lid); } catch {}
            });
          } catch {}
        }, 3000);
        return;
      }

      // ── Plane position: smooth sub-pixel interpolation ──
      const exactIdx = t * (arcPoints.length - 1);
      const i = Math.floor(exactIdx);
      const f = exactIdx - i;
      const a = arcPoints[i];
      const b = arcPoints[Math.min(i + 1, arcPoints.length - 1)];
      const tgtLng = a[0] + (b[0] - a[0]) * f;
      const tgtLat = a[1] + (b[1] - a[1]) * f;

      // Lerp plane position — handle dateline wrapping
      let dLng = tgtLng - planeLng;
      if (dLng > 180) dLng -= 360;
      if (dLng < -180) dLng += 360;
      planeLng += dLng * 0.12;
      planeLat += (tgtLat - planeLat) * 0.12;

      // ── Turbulence: shake when in bad weather zone ──
      turbulenceActive = turbZones.some(z => t >= z.start && t <= z.end);
      if (turbulenceActive) {
        // Gentle up/down bob
        const bob = Math.sin(elapsed * 0.008) * 6 + Math.sin(elapsed * 0.013) * 3;
        planeEl.style.marginTop = `${bob}px`;
      } else {
        planeEl.style.marginTop = '';
      }

      planeMarker.setLngLat([planeLng, planeLat]);

      // ── Plane bearing: look far ahead + heavy smoothing ──
      const lookIdx = Math.min(i + Math.max(15, Math.floor(arcPoints.length * 0.03)), arcPoints.length - 1);
      const lk = arcPoints[lookIdx];
      const dLn = (lk[0] - planeLng) * Math.PI / 180;
      const la1 = planeLat * Math.PI / 180;
      const la2 = lk[1] * Math.PI / 180;
      const rawBrg = Math.atan2(Math.sin(dLn) * Math.cos(la2), Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLn)) * 180 / Math.PI;
      let brgDiff = rawBrg - planeBrg;
      if (brgDiff > 180) brgDiff -= 360;
      if (brgDiff < -180) brgDiff += 360;
      planeBrg += brgDiff * 0.03; // ultra smooth
      planeMarker.setRotation(planeBrg);

      // ── Camera: lerp ALL properties every frame → zero jitter ──
      if (isFollowing() && !isSameCity) {
        let tgtZoom: number, tgtPitch: number;

        if (isGlobe) {
          // Globe: zoom out to see Earth, then zoom in for landing
          const orbitZ = 1.8; // see whole globe
          const landZ = 8;
          if (t < 0.1) { tgtZoom = 5 - (5 - orbitZ) * (t / 0.1); tgtPitch = 0; }
          else if (t > 0.9) { tgtZoom = orbitZ + (landZ - orbitZ) * ((t - 0.9) / 0.1); tgtPitch = ((t - 0.9) / 0.1) * 40; }
          else { tgtZoom = orbitZ; tgtPitch = 0; }
        } else {
          // 2D: closer fly-over
          const cruiseZ = 7;
          if (t < 0.12) { tgtZoom = 9 - (9 - cruiseZ) * (t / 0.12); tgtPitch = t / 0.12 * 50; }
          else if (t > 0.85) { tgtZoom = cruiseZ + (10.5 - cruiseZ) * ((t - 0.85) / 0.15); tgtPitch = ((1 - t) / 0.15) * 50; }
          else { tgtZoom = cruiseZ; tgtPitch = 50; }
        }

        // Camera looks ahead of plane
        const lookAmt = isGlobe ? 40 : 25;
        const camLookIdx = Math.min(i + lookAmt, arcPoints.length - 1);
        const cl = arcPoints[camLookIdx];

        // Lerp speed: globe is slower for grand sweeping motion
        const lerpSpeed = isGlobe ? 0.025 : 0.04;
        let camDLng = cl[0] - camLng;
        if (camDLng > 180) camDLng -= 360;
        if (camDLng < -180) camDLng += 360;
        camLng += camDLng * lerpSpeed;
        camLat += (cl[1] - camLat) * lerpSpeed;
        camZoom += (tgtZoom - camZoom) * lerpSpeed;
        camPitch += (tgtPitch - camPitch) * lerpSpeed;
        let camBrgDiff = planeBrg - camBearing;
        if (camBrgDiff > 180) camBrgDiff -= 360;
        if (camBrgDiff < -180) camBrgDiff += 360;
        camBearing += camBrgDiff * (isGlobe ? 0.02 : 0.03);

        map?.jumpTo({ center: [camLng, camLat], zoom: camZoom, pitch: camPitch, bearing: isGlobe ? 0 : camBearing });

        // HUD
        setFlightHUD({
          from: senderCity, to: receiverCity, progress: t,
          senderName: kiss.sender_name || 'Sender',
          receiverName: currentUserId === kiss.receiver_id ? 'You' : (kiss.receiver_name || 'Receiver'),
          emoji: kiss.emoji,
          turbulence: turbulenceActive,
        });
      } else if (isFollowing() && isSameCity) {
        // Street-level motorbike follow
        const camLookIdx = Math.min(i + 5, arcPoints.length - 1);
        const cl = arcPoints[camLookIdx];
        let scDLng = cl[0] - camLng;
        if (scDLng > 180) scDLng -= 360;
        if (scDLng < -180) scDLng += 360;
        camLng += scDLng * 0.06;
        camLat += (cl[1] - camLat) * 0.06;
        camBearing += (planeBrg - camBearing) * 0.04;
        camZoom += (15 - camZoom) * 0.05;
        camPitch += (45 - camPitch) * 0.05;
        map?.jumpTo({ center: [camLng, camLat], zoom: camZoom, pitch: camPitch, bearing: camBearing });
      }

      // Trail
      if (i % 10 === 0) {
        trailCoords.push([planeLng, planeLat]);
        try {
          const src = map?.getSource(trailId) as maplibregl.GeoJSONSource;
          if (src) src.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: trailCoords }, properties: {} });
        } catch {}
      }

      const frame = requestAnimationFrame(fly);
      animFrameRef.current.set(kiss.id, frame);
    }

    // Start
    if (isSameCity) {
      const mx = (from[0] + to[0]) / 2, my = (from[1] + to[1]) / 2;
      map?.flyTo({ center: [mx, my], zoom: 14, pitch: 30, bearing: 0, duration: 800 });
      setTimeout(() => requestAnimationFrame(fly), 1000);
    } else if (isGlobe) {
      // Globe: zoom to sender, then pull out to see whole Earth
      map?.flyTo({ center: from, zoom: 5, pitch: 0, bearing: 0, duration: 2000 });
      setTimeout(() => {
        camLng = from[0]; camLat = from[1]; camZoom = 5; camPitch = 0; camBearing = 0;
        requestAnimationFrame(fly);
      }, 2300);
    } else {
      // 2D: zoom to departure
      map?.flyTo({ center: from, zoom: 9, pitch: 40, bearing: 0, duration: 2500, easing: (x: number) => 1 - Math.pow(1 - x, 3) });
      setTimeout(() => {
        camLng = from[0]; camLat = from[1]; camZoom = 9; camPitch = 40; camBearing = 0;
        requestAnimationFrame(fly);
      }, 2800);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mutate, currentUserId, placeGiftMarker]);

  // Place/remove gift markers based on layer toggle
  // On 3D globe: don't auto-place markers (only show on ?kiss= replay)
  useEffect(() => {
    if (!map) return;
    const isGlobe = useMapStore.getState().viewMode === '3d';
    if (giftLayerOn && !isGlobe) {
      kisses.forEach(k => {
        if (markersRef.current.has(`plane_${k.id}`)) return;
        placeGiftMarker(k);
      });
    } else if (!giftLayerOn) {
      // Clean everything: markers, animations, map layers
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      animFrameRef.current.forEach(f => { clearTimeout(f); cancelAnimationFrame(f); });
      animFrameRef.current.clear();
      activeFollowRef.current = null;
      setFlightHUD(null);
      // Remove all kiss arc/trail layers
      kisses.forEach(k => {
        ['kiss-arc-', 'kiss-trail-'].forEach(prefix => {
          try { if (map.getLayer(`${prefix}${k.id}`)) map.removeLayer(`${prefix}${k.id}`); } catch {}
          try { if (map.getSource(`${prefix}${k.id}`)) map.removeSource(`${prefix}${k.id}`); } catch {}
        });
      });
    }
  }, [map, kisses, placeGiftMarker, giftLayerOn]);

  // Hide/show gift markers based on zoom level (prevent clutter on globe)
  useEffect(() => {
    if (!map || !giftLayerOn) return;
    const updateVisibility = () => {
      const zoom = map.getZoom();
      const isGlobe = useMapStore.getState().viewMode === '3d';
      const minZoom = isGlobe ? 4 : 0; // hide on globe when zoomed out
      markersRef.current.forEach((marker, key) => {
        if (key.startsWith('plane_')) return; // don't hide flying planes
        marker.getElement().style.display = zoom >= minZoom ? '' : 'none';
      });
    };
    map.on('zoom', updateVisibility);
    updateVisibility();
    return () => { map.off('zoom', updateVisibility); };
  }, [map, giftLayerOn]);

  // Listen for ?kiss=<id> URL param — replay that kiss animation
  useEffect(() => {
    if (!map || kisses.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const kissId = params.get('kiss');
    if (!kissId || replayedRef.current.has(kissId)) return;

    const kiss = kisses.find(k => k.id === kissId);
    if (kiss) {
      replayedRef.current.add(kissId);
      // Clean URL
      window.history.replaceState(null, '', '/world');
      // Small delay to let map settle, then replay
      setTimeout(() => playFlightAnimation(kiss), 1000);
    }
  }, [map, kisses, playFlightAnimation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();
      animFrameRef.current.forEach(f => { clearTimeout(f); cancelAnimationFrame(f); });
    };
  }, []);

  return (
    <>
      {/* Flight HUD overlay */}
      <AnimatePresence>
        {flightHUD && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <FlightHUD {...flightHUD} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send Kiss Button — only visible when gift layer is on */}
      {giftLayerOn && <button
        onClick={() => {
          const token = localStorage.getItem('access_token');
          if (!token) { setShowAuthGate(true); return; }
          setShowSendModal(true);
        }}
        className="absolute bottom-[calc(64px+env(safe-area-inset-bottom,0px)+100px)] lg:bottom-24 right-4 z-30 h-12 w-12 rounded-full flex items-center justify-center cursor-pointer shadow-lg"
        style={{ background: 'linear-gradient(135deg, #f87171, #ec4899)', boxShadow: '0 4px 20px rgba(236,72,153,0.4)' }}
        title="Send a Kiss"
      >
        <span className="text-xl">💋</span>
      </button>}

      {/* Send Modal */}
      <AnimatePresence>
        {showSendModal && <SendKissModal defaultReceiverId={sendBackTo} onClose={() => { setShowSendModal(false); setSendBackTo(null); }} onSent={async () => {
          const fresh = await mutate();
          const newest = (fresh as { data: Kiss[] } | undefined)?.data?.[0];
          if (newest) setTimeout(() => playFlightAnimation(newest), 500);
        }} />}
      </AnimatePresence>

      {/* Kiss Reveal */}
      <AnimatePresence>
        {revealKiss && <KissRevealPopup kiss={revealKiss} onClose={() => setRevealKiss(null)} currentUserId={currentUserId} onSendBack={(toId) => { setSendBackTo(toId); setShowSendModal(true); }} />}
      </AnimatePresence>

      {/* Auth Gate */}
      <SignInGateSheet action="default" isOpen={showAuthGate} onClose={() => setShowAuthGate(false)} />
    </>
  );
}
