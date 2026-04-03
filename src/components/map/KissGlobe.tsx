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

// ── Flight HUD Overlay ──
function FlightHUD({ from, to, progress, senderName, receiverName, emoji }: {
  from: string; to: string; progress: number; senderName: string; receiverName: string; emoji: string;
}) {
  const pct = Math.round(progress * 100);
  const remaining = Math.max(0, Math.round((1 - progress) * 9)); // ~9s total flight
  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none" style={{ fontFamily: 'Inter, system-ui, monospace' }}>
      {/* Flight info card */}
      <div className="rounded-2xl px-5 py-3 flex flex-col items-center gap-2 min-w-[280px]" style={{ background: 'rgba(10,11,15,0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(236,72,153,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
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
  const [revealKiss, setRevealKiss] = useState<Kiss | null>(null);
  const [flightHUD, setFlightHUD] = useState<{ from: string; to: string; progress: number; senderName: string; receiverName: string; emoji: string } | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const animFrameRef = useRef<Map<string, number>>(new Map());
  const replayedRef = useRef<Set<string>>(new Set());
  const activeFollowRef = useRef<string | null>(null); // Only 1 kiss controls camera at a time

  const { data, mutate } = useSWR<{ data: Kiss[] }>('/api/v1/kisses?limit=30', fetcher, { refreshInterval: 30000 });
  const kisses = data?.data ?? [];

  // Animate airplane along arc + place gift at destination
  const animateKiss = useCallback((kiss: Kiss, forceReplay = false) => {
    if (!map) return;

    // If replaying, clean up existing markers first
    if (forceReplay) {
      const existing = markersRef.current.get(kiss.id);
      if (existing) { existing.remove(); markersRef.current.delete(kiss.id); }
      const plane = markersRef.current.get(`plane_${kiss.id}`);
      if (plane) { plane.remove(); markersRef.current.delete(`plane_${kiss.id}`); }
      const frame = animFrameRef.current.get(kiss.id);
      if (frame) cancelAnimationFrame(frame);
      // Clean up map layers
      try {
        if (map.getLayer(`kiss-arc-${kiss.id}`)) map.removeLayer(`kiss-arc-${kiss.id}`);
        if (map.getSource(`kiss-arc-${kiss.id}`)) map.removeSource(`kiss-arc-${kiss.id}`);
        if (map.getLayer(`kiss-trail-${kiss.id}`)) map.removeLayer(`kiss-trail-${kiss.id}`);
        if (map.getSource(`kiss-trail-${kiss.id}`)) map.removeSource(`kiss-trail-${kiss.id}`);
      } catch {}
    }

    if (!forceReplay && markersRef.current.has(kiss.id)) return;

    // City labels for HUD
    const senderCity = `${kiss.sender_lat.toFixed(1)}°, ${kiss.sender_lng.toFixed(1)}°`;
    const receiverCity = `${kiss.receiver_lat.toFixed(1)}°, ${kiss.receiver_lng.toFixed(1)}°`;
    // Async reverse geocode for nicer names
    (async () => {
      try {
        const [sRes, rRes] = await Promise.all([
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${kiss.sender_lat}&lon=${kiss.sender_lng}&zoom=10`, { headers: { 'User-Agent': 'GaoSocial/1.0' } }).then(r => r.json()).catch(() => null),
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${kiss.receiver_lat}&lon=${kiss.receiver_lng}&zoom=10`, { headers: { 'User-Agent': 'GaoSocial/1.0' } }).then(r => r.json()).catch(() => null),
        ]);
        if (sRes?.address) Object.assign(kiss, { _senderCity: sRes.address.city || sRes.address.state || sRes.address.country || senderCity });
        if (rRes?.address) Object.assign(kiss, { _receiverCity: rRes.address.city || rRes.address.state || rRes.address.country || receiverCity });
      } catch {}
    })();

    const from: [number, number] = [kiss.sender_lng, kiss.sender_lat];
    const to: [number, number] = [kiss.receiver_lng, kiss.receiver_lat];
    const arcPoints = interpolateGreatCircle(from, to, 300);

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

    // Airplane + gift animation — larger, more visible
    const planeEl = document.createElement('div');
    planeEl.style.cssText = `
      pointer-events:none;
      display:flex;align-items:center;gap:4px;
      filter:drop-shadow(0 4px 12px rgba(0,0,0,0.7)) drop-shadow(0 0 8px rgba(236,72,153,0.4));
      font-size:28px;
    `;
    planeEl.innerHTML = `<span style="font-size:32px">✈️</span><span style="font-size:18px;animation:pulse 1.5s ease-in-out infinite">🎁</span>
      <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}</style>`;
    const planeMarker = new maplibregl.Marker({ element: planeEl, anchor: 'center', rotationAlignment: 'map' })
      .setLngLat(from)
      .addTo(map);
    markersRef.current.set(`plane_${kiss.id}`, planeMarker);

    // Draw flight path (dashed pink line)
    const lineId = `kiss-arc-${kiss.id}`;
    try {
      if (!map.getSource(lineId)) {
        map.addSource(lineId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: arcPoints }, properties: {} } });
        map.addLayer({ id: lineId, type: 'line', source: lineId, paint: { 'line-color': '#ec4899', 'line-width': 2, 'line-opacity': 0.5, 'line-dasharray': [2, 3] } });
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

    // Animate plane along arc with camera follow
    let step = 0;
    const isFollowing = () => activeFollowRef.current === kiss.id;

    function fly() {
      if (step >= arcPoints.length) {
        // Arrived — remove plane, zoom to gift, clear HUD
        planeMarker.remove();
        markersRef.current.delete(`plane_${kiss.id}`);
        if (isFollowing()) {
          setFlightHUD(null);
          activeFollowRef.current = null;
          // Ease camera to destination
          map?.easeTo({ center: to, zoom: 12, pitch: 0, bearing: 0, duration: 1500, easing: (t: number) => 1 - Math.pow(1 - t, 3) });
        }
        // Clean up lines after delay
        setTimeout(() => {
          try {
            if (map.getLayer(trailId)) map.removeLayer(trailId);
            if (map.getSource(trailId)) map.removeSource(trailId);
            if (map.getLayer(lineId)) map.removeLayer(lineId);
            if (map.getSource(lineId)) map.removeSource(lineId);
          } catch {}
        }, 5000);
        return;
      }

      const pos = arcPoints[step];
      planeMarker.setLngLat(pos);

      // Calculate bearing to next point
      let bearing = 0;
      if (step < arcPoints.length - 1) {
        const next = arcPoints[step + 1];
        bearing = Math.atan2(next[0] - pos[0], next[1] - pos[1]) * 180 / Math.PI;
        planeEl.style.transform = `rotate(${90 - bearing}deg)`;
      }

      // Camera follows the plane — cinematic in-flight experience
      if (isFollowing()) {
        const progress = step / arcPoints.length;

        // Update HUD
        setFlightHUD({
          from: (kiss as unknown as Record<string, string>)._senderCity || senderCity,
          to: (kiss as unknown as Record<string, string>)._receiverCity || receiverCity,
          progress,
          senderName: kiss.sender_name || 'Sender',
          receiverName: kiss.receiver_name || 'Receiver',
          emoji: kiss.emoji,
        });

        // Dynamic zoom: close takeoff → pull back cruise → close landing
        const startZoom = 9.5;
        const cruiseZoom = 7;
        const endZoom = 10.5;
        let targetZoom: number;
        if (progress < 0.15) {
          // Takeoff — zoom out smoothly
          const t = progress / 0.15;
          targetZoom = startZoom + (cruiseZoom - startZoom) * (t * t); // ease-in
        } else if (progress > 0.85) {
          // Landing — zoom in smoothly
          const t = (progress - 0.85) / 0.15;
          targetZoom = cruiseZoom + (endZoom - cruiseZoom) * (1 - Math.pow(1 - t, 2)); // ease-out
        } else {
          targetZoom = cruiseZoom;
        }

        // Pitch: smooth takeoff → cruise → landing
        let pitch: number;
        if (progress < 0.12) {
          pitch = (progress / 0.12) * 55; // climb
        } else if (progress > 0.88) {
          pitch = ((1 - progress) / 0.12) * 55; // descend
        } else {
          pitch = 55; // cruise altitude view
        }

        // Slight camera offset ahead of plane for "looking forward" feel
        const lookAhead = Math.min(step + 8, arcPoints.length - 1);
        const aheadPos = arcPoints[lookAhead];

        map.easeTo({
          center: aheadPos as [number, number],
          zoom: targetZoom,
          bearing: 90 - bearing,
          pitch: Math.min(pitch, 55),
          duration: 60,
          easing: (t: number) => t,
        });
      }

      // Update trail
      trailCoords.push(pos);
      try {
        const src = map.getSource(trailId) as maplibregl.GeoJSONSource;
        if (src) src.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: trailCoords }, properties: {} });
      } catch {}

      step++;
      // Smooth flight: 25ms per step = 300 steps × 25ms ≈ 7.5 seconds
      const timer = setTimeout(fly, 25) as unknown as number;
      animFrameRef.current.set(kiss.id, timer);
    }

    // Only animate recent kisses (last 1 hour)
    const age = Date.now() - new Date(kiss.created_at).getTime();
    if (age < 3600_000 || forceReplay) {
      // Only follow camera if no other kiss is being followed
      if (!activeFollowRef.current || forceReplay) {
        activeFollowRef.current = kiss.id;
        map.flyTo({ center: from, zoom: 10, pitch: 45, bearing: 0, duration: 1500 });
        setTimeout(() => fly(), 1800);
      } else {
        // Other kisses just animate plane silently, no camera
        fly();
      }
    } else {
      // Old kiss — just show gift, no plane or lines
      planeMarker.remove();
      markersRef.current.delete(`plane_${kiss.id}`);
      try {
        if (map.getLayer(lineId)) map.removeLayer(lineId);
        if (map.getSource(lineId)) map.removeSource(lineId);
        if (map.getLayer(trailId)) map.removeLayer(trailId);
        if (map.getSource(trailId)) map.removeSource(trailId);
      } catch {}
    }
  }, [map, mutate, currentUserId]);

  // Render kisses on map
  useEffect(() => {
    if (!map) return;
    kisses.forEach(k => animateKiss(k));
    return () => {
      animFrameRef.current.forEach(f => { clearTimeout(f); cancelAnimationFrame(f); });
    };
  }, [map, kisses, animateKiss]);

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
      setTimeout(() => animateKiss(kiss, true), 1000);
    }
  }, [map, kisses, animateKiss]);

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
