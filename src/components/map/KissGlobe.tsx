'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import maplibregl from 'maplibre-gl';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useMap } from './WorldMap';
import { useFriendStore } from '@/stores/friendStore';
import { useAuthStore } from '@/stores/auth-store';

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
function SendKissModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const { friends, fetchFriends } = useFriendStore();
  const [receiverId, setReceiverId] = useState('');
  const [message, setMessage] = useState('');
  const [emoji, setEmoji] = useState('💋');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [sending, setSending] = useState(false);

  useEffect(() => { if (friends.length === 0) fetchFriends(); }, [friends.length, fetchFriends]);

  const handleSend = async () => {
    if (!receiverId) { toast.error('Pick someone to send to'); return; }
    const token = localStorage.getItem('access_token');
    if (!token) return;
    setSending(true);
    try {
      const res = await fetch('/api/v1/kisses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ receiver_id: receiverId, message, emoji, visibility }),
      });
      if (res.ok) { toast.success('Kiss sent! ✈️💋'); onSent(); onClose(); }
      else { const d = await res.json(); toast.error(d.error?.message || 'Failed'); }
    } catch { toast.error('Network error'); }
    finally { setSending(false); }
  };

  const EMOJIS = ['💋', '❤️', '😘', '🥰', '💕', '🌹', '🎁', '✈️'];

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
          {/* Pick friend */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">Send to</label>
            <select
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none cursor-pointer"
              style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <option value="">Choose a friend…</option>
              {friends.filter(f => f.location).map(f => (
                <option key={f.id} value={f.id}>{f.display_name}</option>
              ))}
            </select>
          </div>

          {/* Emoji picker */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">Emoji</label>
            <div className="flex gap-2">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)} className="h-10 w-10 rounded-xl flex items-center justify-center text-xl cursor-pointer transition-transform" style={emoji === e ? { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', transform: 'scale(1.15)' } : { background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  {e}
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

          {/* Send */}
          <button onClick={handleSend} disabled={sending} className="w-full rounded-xl py-3 text-sm font-bold cursor-pointer disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #f87171, #ec4899)', color: 'white', boxShadow: '0 4px 20px rgba(236,72,153,0.3)' }}>
            {sending ? 'Sending…' : `Send ${emoji}`}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Kiss Reveal Popup ──
function KissRevealPopup({ kiss, onClose }: { kiss: Kiss; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <motion.div
        initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}
        transition={{ type: 'spring', damping: 15, stiffness: 200 }}
        className="relative flex flex-col items-center gap-4 p-8 rounded-3xl"
        style={{ background: 'rgba(10,11,15,0.95)', border: '1px solid rgba(236,72,153,0.2)', boxShadow: '0 0 60px rgba(236,72,153,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
          className="text-7xl"
        >
          {kiss.emoji}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <p className="text-lg font-bold text-white text-center">
            From <span style={{ color: '#f87171' }}>{kiss.sender_name}</span>
          </p>
          {kiss.message && <p className="text-sm text-[#a3adc3] text-center mt-2 max-w-xs">{kiss.message}</p>}
          <p className="text-[10px] text-[#4a5068] text-center mt-3">
            {kiss.sender_name} → {kiss.receiver_name}
          </p>
        </motion.div>
        {/* Floating hearts animation */}
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute text-2xl pointer-events-none"
            initial={{ opacity: 1, y: 0, x: (Math.random() - 0.5) * 100 }}
            animate={{ opacity: 0, y: -120 - Math.random() * 80, x: (Math.random() - 0.5) * 200 }}
            transition={{ duration: 2 + Math.random(), delay: 0.3 + i * 0.15, repeat: Infinity, repeatDelay: 1 }}
          >
            {['❤️', '💕', '💋', '✨'][i % 4]}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}

// ── Main Component ──
export default function KissGlobe() {
  const { map } = useMap();
  const currentUserId = useAuthStore(s => s.user?.id);
  const [showSendModal, setShowSendModal] = useState(false);
  const [revealKiss, setRevealKiss] = useState<Kiss | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const animFrameRef = useRef<Map<string, number>>(new Map());

  const { data, mutate } = useSWR<{ data: Kiss[] }>('/api/v1/kisses?limit=30', fetcher, { refreshInterval: 30000 });
  const kisses = data?.data ?? [];

  // Animate airplane along arc + place gift at destination
  const animateKiss = useCallback((kiss: Kiss) => {
    if (!map || markersRef.current.has(kiss.id)) return;

    const from: [number, number] = [kiss.sender_lng, kiss.sender_lat];
    const to: [number, number] = [kiss.receiver_lng, kiss.receiver_lat];
    const arcPoints = interpolateGreatCircle(from, to, 120);

    // Gift marker at destination
    const isReceiver = currentUserId === kiss.receiver_id;
    const isSender = currentUserId === kiss.sender_id;
    const showAsGift = isReceiver && !kiss.opened; // Only receiver sees unopened gift

    const giftEl = document.createElement('div');
    giftEl.style.cssText = 'font-size:28px;cursor:pointer;filter:drop-shadow(0 0 8px rgba(236,72,153,0.5));transition:transform 0.2s;';
    giftEl.textContent = showAsGift ? '🎁' : kiss.emoji;
    giftEl.onmouseenter = () => { giftEl.style.opacity = '0.85'; };
    giftEl.onmouseleave = () => { giftEl.style.opacity = '1'; };
    giftEl.onclick = () => {
      if (isReceiver && !kiss.opened) {
        // Receiver opens the gift
        setRevealKiss(kiss);
        fetch('/api/v1/kisses', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` },
          body: JSON.stringify({ id: kiss.id }),
        }).then(() => mutate());
        giftEl.textContent = kiss.emoji;
      } else if (isReceiver || isSender) {
        // Sender or receiver who already opened — show reveal again
        setRevealKiss(kiss);
      }
      // Others can't open — just see the emoji on globe
    };

    const giftMarker = new maplibregl.Marker({ element: giftEl, anchor: 'center' })
      .setLngLat(to)
      .addTo(map);
    markersRef.current.set(kiss.id, giftMarker);

    // Airplane animation
    const planeEl = document.createElement('div');
    planeEl.style.cssText = 'font-size:20px;pointer-events:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));';
    planeEl.textContent = '✈️';
    const planeMarker = new maplibregl.Marker({ element: planeEl, anchor: 'center' })
      .setLngLat(from)
      .addTo(map);
    markersRef.current.set(`plane_${kiss.id}`, planeMarker);

    // Draw arc line
    const lineId = `kiss-arc-${kiss.id}`;
    try {
      if (!map.getSource(lineId)) {
        map.addSource(lineId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: arcPoints }, properties: {} } });
        map.addLayer({ id: lineId, type: 'line', source: lineId, paint: { 'line-color': '#ec4899', 'line-width': 1.5, 'line-opacity': 0.4, 'line-dasharray': [2, 2] } });
      }
    } catch {}

    // Animate plane along arc
    let step = 0;
    const speed = 1;
    function fly() {
      if (step >= arcPoints.length) {
        // Arrived — remove plane
        planeMarker.remove();
        markersRef.current.delete(`plane_${kiss.id}`);
        return;
      }
      planeMarker.setLngLat(arcPoints[step]);
      step += speed;
      const frame = requestAnimationFrame(fly);
      animFrameRef.current.set(kiss.id, frame);
    }

    // Only animate recent kisses (last 1 hour)
    const age = Date.now() - new Date(kiss.created_at).getTime();
    if (age < 3600_000) {
      fly();
    } else {
      // Old kiss — just show gift, no animation
      planeMarker.remove();
      markersRef.current.delete(`plane_${kiss.id}`);
    }
  }, [map, mutate, currentUserId]);

  // Render kisses on map
  useEffect(() => {
    if (!map) return;
    kisses.forEach(k => animateKiss(k));
    return () => {
      animFrameRef.current.forEach(f => cancelAnimationFrame(f));
    };
  }, [map, kisses, animateKiss]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();
      animFrameRef.current.forEach(f => cancelAnimationFrame(f));
    };
  }, []);

  return (
    <>
      {/* Send Kiss Button — floating on map */}
      <button
        onClick={() => setShowSendModal(true)}
        className="absolute bottom-[calc(64px+env(safe-area-inset-bottom,0px)+100px)] lg:bottom-24 right-4 z-30 h-12 w-12 rounded-full flex items-center justify-center cursor-pointer shadow-lg"
        style={{ background: 'linear-gradient(135deg, #f87171, #ec4899)', boxShadow: '0 4px 20px rgba(236,72,153,0.4)' }}
        title="Send a Kiss"
      >
        <span className="text-xl">💋</span>
      </button>

      {/* Send Modal */}
      <AnimatePresence>
        {showSendModal && <SendKissModal onClose={() => setShowSendModal(false)} onSent={() => mutate()} />}
      </AnimatePresence>

      {/* Kiss Reveal */}
      <AnimatePresence>
        {revealKiss && <KissRevealPopup kiss={revealKiss} onClose={() => setRevealKiss(null)} />}
      </AnimatePresence>
    </>
  );
}
