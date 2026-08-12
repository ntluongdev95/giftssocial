'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import maplibregl from 'maplibre-gl';
import { escapeHtml, sanitizeUrl } from '@/lib/sanitize';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useMap } from './WorldMap';
import { useFriendStore } from '@/stores/friendStore';
import SignInGateSheet from '@/components/auth/SignInGateSheet';
import { useAuthStore } from '@/stores/auth-store';
import { useMapStore } from '@/stores/mapStore';
import { useGiftsPopupStore } from '@/stores/giftsPopupStore';
import { GiftsPopup } from '@/components/gifts/GiftsPopup';
import { HeartBuilder } from '@/components/gifts/HeartBuilder';
import { CoupleCardBuilder } from '@/components/gifts/CoupleCardBuilder';
import CapsuleCreateModal from '@/components/capsules/CapsuleCreateModal';
import { OCCASIONS, bundlePrice, featuredOccasion, type OccasionBundle, type OccasionTemplate } from '@/lib/occasions';
import { tracksForOccasion, type MusicTrack } from '@/lib/kiss-music';
import QRCode from 'qrcode';

const fetcher = (url: string) => fetch(url, {
  
}).then(r => r.json());

interface Kiss {
  id: string;
  sender_id: string; sender_name: string; sender_avatar?: string;
  receiver_id: string; receiver_name: string; receiver_avatar?: string;
  message: string; emoji: string; visibility: string;
  sender_lat: number; sender_lng: number;
  receiver_lat: number; receiver_lng: number;
  opened: boolean; created_at: string;
  // Occasion enrichments + open limit (may be missing on older kisses)
  photos?: string | null;
  music_url?: string | null;
  music_title?: string | null;
  open_count?: number;
  max_opens?: number;
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


// ── Distance-based delivery vehicle picker ──
type VehicleKind = 'dove' | 'motorbike' | 'car' | 'plane';

interface VehicleConfig {
  kind: VehicleKind;
  size: number;
  durationMs: number;
  arcSteps: number;
  cruiseZoom: number;
  landZoom: number;
  cruisePitch: number;
  lineColor: string;
  lineWidth: number;
  lineDash: [number, number] | null;
  emoji: string;
  displayName: string;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pickVehicle(distanceKm: number): VehicleConfig {
  if (distanceKm < 5) return {
    kind: 'dove', size: 60, durationMs: 14000, arcSteps: 120,
    cruiseZoom: 13, landZoom: 15, cruisePitch: 0, // flat 2D — no 3D tilt for dove
    lineColor: '#ef4444', lineWidth: 2.5, lineDash: [2, 3],
    emoji: '🕊️', displayName: 'Dove',
  };
  if (distanceKm < 100) return {
    kind: 'motorbike', size: 46, durationMs: 12000, arcSteps: 180,
    cruiseZoom: 13, landZoom: 14.5, cruisePitch: 50,
    lineColor: '#ec4899', lineWidth: 2.2, lineDash: [2, 3],
    emoji: '🏍️', displayName: 'Motorbike',
  };
  if (distanceKm < 1000) return {
    
    // kind: 'car', size: 52, durationMs: 20000, arcSteps: 300,
    // cruiseZoom: 12, landZoom: 14, cruisePitch: 45,
    // lineColor: '#f97316', lineWidth: 2.5, lineDash: [3, 3],
    // emoji: '🚗', displayName: 'Car',
  };
  return {
    kind: 'plane', size: 64, durationMs: 25000, arcSteps: 500,
    cruiseZoom: 12, landZoom: 14, cruisePitch: 50,
    lineColor: '#ef4444', lineWidth: 3, lineDash: [2, 3],
    emoji: '✈️', displayName: 'Plane',
  };
}

function ensureDoveCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('gao-dove-marker-css')) return;
  const st = document.createElement('style');
  st.id = 'gao-dove-marker-css';
  st.textContent = `
    /* Wing flap — birthday-style: scaleY squishes on the downstroke,
       scaleX widens slightly, upward bob, slight rotation. 0.85 s loop.
       scaleX(-1) baseline FLIPS the emoji so the bird faces RIGHT (east),
       matching its always-west→east flight direction. */
    @keyframes gaoDoveFlap {
      0%   { transform: scaleY(1)    scaleX(-1)    translateY(0); }
      18%  { transform: scaleY(0.62) scaleX(-1.08) translateY(-6px) rotate(2deg); }
      50%  { transform: scaleY(0.95) scaleX(-1.02) translateY(-1px) rotate(-1deg); }
      100% { transform: scaleY(1)    scaleX(-1)    translateY(0); }
    }
    @keyframes gaoDoveLetter {
      0%   { transform: rotate(-14deg) translateY(0); }
      50%  { transform: rotate(14deg)  translateY(-2px); }
      100% { transform: rotate(-14deg) translateY(0); }
    }
    .gao-dove-flap   { animation: gaoDoveFlap 0.85s ease-in-out infinite; transform-origin: center bottom; display: block; }
    .gao-dove-letter { animation: gaoDoveLetter 1.6s ease-in-out infinite; transform-origin: top center; display: block; }
  `;
  document.head.appendChild(st);
}

function buildVehicleSvg(kind: VehicleKind, kissId: string): string {
  const id = kissId.slice(0, 8);
  switch (kind) {
    case 'dove':
      ensureDoveCss();
      return `<div style="display:flex;flex-direction:column;align-items:center;line-height:1;font-family:'Apple Color Emoji','Segoe UI Emoji',sans-serif;">
      <span class="gao-dove-flap" style="font-size:44px;filter:drop-shadow(0 6px 10px rgba(0,0,0,0.55));">🕊️</span>
      <span class="gao-dove-letter" style="font-size:22px;margin-top:-6px;filter:drop-shadow(0 3px 5px rgba(0,0,0,0.4));">💌</span>
    </div>`;
    case 'motorbike': return `<svg viewBox="0 0 46 46" xmlns="http://www.w3.org/2000/svg"><g><circle cx="23" cy="35" r="5" fill="none" stroke="#94a3b8" stroke-width="2"/><circle cx="23" cy="11" r="5" fill="none" stroke="#94a3b8" stroke-width="2"/><path d="M23 30 L23 16" stroke="#ec4899" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="23" cy="23" rx="4" ry="3" fill="#ec4899"/><circle cx="23" cy="18" r="3" fill="#fbbf24"/><rect x="18" y="27" width="10" height="8" rx="2" fill="#f87171"/></g></svg>`;
    case 'car': {
  const hash = Array.from(kissId).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0
  );

  const cars = [
    '/cars/porsche.webp',
    '/cars/ferrari.webp',
    '/cars/lamborghini.webp',
  ];

  const carImage = cars[hash % cars.length];

  return `
    <div
      style="
        width:110px;
        height:75px;
        display:flex;
        align-items:center;
        justify-content:center;
        pointer-events:none;
      "
    >
      <img
        src="${carImage}"
        alt="Supercar"
        draggable="false"
        style="
          width:110px;
          height:75px;
          object-fit:contain;
          display:block;
          user-select:none;
          -webkit-user-drag:none;
          filter:
            drop-shadow(0 8px 6px rgba(0,0,0,.45))
            drop-shadow(0 0 5px rgba(255,255,255,.12));
        "
      />
    </div>
  `;
}
    // case 'car': return `<svg viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg"><g><rect x="12" y="4" width="28" height="44" rx="8" fill="#ef4444" stroke="#991b1b" stroke-width="0.5"/><path d="M15 12 L37 12 L35 20 L17 20Z" fill="#0c4a6e"/><rect x="17" y="20" width="18" height="12" fill="#b91c1c"/><path d="M17 32 L35 32 L37 40 L15 40Z" fill="#0c4a6e"/><rect x="21" y="23" width="10" height="6" fill="#fbbf24"/></g></svg>`;
    case 'plane': return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><g><path d="M32 6 C29 6 27 10 27 16 L27 48 C27 52 29 56 32 58 C35 56 37 52 37 48 L37 16 C37 10 35 6 32 6Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.3"/><path d="M27 24 L4 32 L6 34 L27 28Z" fill="#94a3b8"/><path d="M37 24 L60 32 L58 34 L37 28Z" fill="#94a3b8"/><path d="M32 44 L32 56 L35 54 L35 46Z" fill="#ec4899"/></g></svg>_${id.slice(0,0)}`;
  }
}

// Numbered section header used inside SendKissModal to break the form
// into three clear phases: (1) recipient → (2) occasion → (3) personal.
function SectionHeader({ num, title, optional }: { num: string; title: string; optional?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center rounded-full text-[10px] font-bold shrink-0" style={{ width: 20, height: 20, background: 'linear-gradient(135deg, #f472b6, #ec4899)', color: '#fff' }}>{num}</div>
      <h4 className="text-[13px] font-bold text-white flex-1">{title}</h4>
      {optional && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: '#4a5068' }}>OPTIONAL</span>}
    </div>
  );
}

// ── Send Kiss Modal ──
export function SendKissModal({ onClose, onSent, defaultReceiverId, inline = false, hideHeader = false }: { onClose: () => void; onSent: () => void; defaultReceiverId?: string | null; inline?: boolean; hideHeader?: boolean }) {
  // Compat props: `inline` and `hideHeader` are consumed by GiftsPopup
  // to render this modal inside its Kiss tab without an outer backdrop.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _inline = inline; const _hideHeader = hideHeader;
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
  const [kissType, setKissType] = useState<'kiss' | 'declaration'>('kiss');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [noLocationWarning, setNoLocationWarning] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const addressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchFriends();
    // Also fetch following users as fallback — auth flows through cookies, the
    // server returns 401 if the viewer isn't logged in (we just ignore that).
    if (typeof document !== 'undefined' && document.cookie.includes('gao_logged_in=1')) {
      fetch('/api/v1/follows?type=following')
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

  const doSend = async (overrideReceiverCoords?: { lat: number; lng: number }) => {
    if (typeof document === 'undefined' || !document.cookie.includes('gao_logged_in=1')) { setSendError('Please login first'); return; }
    setSending(true);
    try {
      const payload: Record<string, unknown> = { receiver_id: receiverId, message, emoji, visibility, kiss_type: kissType };
      if (kissType === 'declaration') payload.visibility = 'public'; // declarations are always public
      if (overrideReceiverCoords) {
        payload.receiver_lat = overrideReceiverCoords.lat;
        payload.receiver_lng = overrideReceiverCoords.lng;
      }
      // Occasion enrichments — only added when the sender actually attached them.
      if (occasionPhotos.length > 0) payload.photos = occasionPhotos;
      if (occasionMusic) {
        payload.music_url = occasionMusic.url;
        payload.music_title = `${occasionMusic.title} — ${occasionMusic.artist}`;
      }
      const res = await fetch('/api/v1/kisses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const d = await res.json();
        const kissId = d.data?.id as string | undefined;
        if (kissId) {
          // Generate a pink-heart-themed QR encoding /kiss/[id]
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          const url = `${origin}/kiss/${kissId}`;
          try {
            const qrDataUrl = await QRCode.toDataURL(url, {
              width: 400, margin: 1, errorCorrectionLevel: 'H',
              color: { dark: '#ec4899', light: '#ffffff' },
            });
            setSentKiss({ id: kissId, url, qrDataUrl });
          } catch {
            setSentKiss({ id: kissId, url, qrDataUrl: '' });
          }
          toast.success('Kiss sent! ✈️💋');
          // IMPORTANT: onSent() fires when the QR is dismissed, not now —
          // GiftsPopup's onSent closes the popup and would hide the QR.
        } else {
          toast.success('Kiss sent! ✈️💋');
          onSent();
          onClose();
        }
      } else {
        const d = await res.json();
        setSendError(d.error?.message || 'Failed to send kiss');
      }
    } catch { setSendError('Network error — please try again'); }
    finally { setSending(false); }
  };

  const handleSend = async () => {
    setSendError(null);
    setNoLocationWarning(false);
    if (!receiverId) { setSendError('Pick someone to send to'); return; }
    if (receiverId === useAuthStore.getState().user?.id) { setSendError("Can't send a kiss to yourself"); return; }
    if (!emoji) { setSendError('Choose a gift first'); return; }
    if (typeof document === 'undefined' || !document.cookie.includes('gao_logged_in=1')) { setSendError('Please login first'); return; }

    // Check if receiver has location
    try {
      const res = await fetch(`/api/v1/users/${receiverId}`, { });
      const data = await res.json();
      if (data.data && !data.data.location_lat) {
        // Receiver has no location → show warning
        setNoLocationWarning(true);
        return;
      }
    } catch { /* continue sending anyway */ }

    await doSend();
  };

  const handleSendWithAddress = async () => {
    if (addressCoords) {
      await doSend(addressCoords);
    } else {
      // Send anyway without coords — no fly animation
      await doSend();
    }
  };

  const handleAddressInput = (q: string) => {
    setCustomAddress(q);
    setAddressCoords(null);
    if (addressTimer.current) clearTimeout(addressTimer.current);
    if (q.length < 2) { setAddressSuggestions([]); return; }
    addressTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`, { headers: { 'User-Agent': 'GaoSocial/1.0' } });
        const data = await res.json();
        setAddressSuggestions(data || []);
      } catch { setAddressSuggestions([]); }
    }, 300);
  };

  // Gift picker is now purely occasion-driven — no more raw emoji categories.
  const [activeOccasionId, setActiveOccasionId] = useState<string>(() => featuredOccasion().id);
  const activeOccasion = OCCASIONS.find(o => o.id === activeOccasionId) ?? OCCASIONS[0];
  const [occasionPhotos, setOccasionPhotos] = useState<string[]>([]);
  const [occasionMusic, setOccasionMusic] = useState<MusicTrack | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  // Post-send: kiss ID + QR data URL. When set, modal swaps to share view.
  const [sentKiss, setSentKiss] = useState<{ id: string; url: string; qrDataUrl: string } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  // Collapsible "Add extras" section (Photos + Music).
  const [extrasOpen, setExtrasOpen] = useState(false);
  // Reveal template picked for the current occasion (visual theme only).
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  // Video preview modal for a template.
  const [previewTemplate, setPreviewTemplate] = useState<OccasionTemplate | null>(null);

  // Derive the selected gift's human name from current emoji + occasion,
  // used in the Send button preview ("Send 🎂 Birthday Cake to Nga").
  const selectedGiftName = (() => {
    const bundle = activeOccasion.bundles.find(b => b.emoji === emoji && message.includes(b.name));
    if (bundle) return bundle.name;
    const gift = activeOccasion.gifts.find(g => g.emoji === emoji);
    return gift?.name ?? '';
  })();

  // Selecting a bundle: set outgoing emoji to the bundle's representative
  // and prefill message with the bundle name + item emojis.
  const handleSelectBundle = (b: OccasionBundle) => {
    setEmoji(b.emoji);
    const items = b.items.map(it => it.emoji).join(' ');
    setMessage(`${b.emoji} ${b.name} — ${items}`);
  };

  // Dismiss handler for the QR view — fires onSent (parent close hook)
  // + onClose after the sender has had a chance to share.
  const dismissQr = () => {
    setSentKiss(null);
    onSent();
    onClose();
  };

  // ── QR success view — replaces the form after a successful send ──
  if (sentKiss) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={dismissQr}>
        <div className="absolute inset-0 bg-black/70" />
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-md rounded-2xl overflow-hidden"
          style={{ background: 'rgba(10,11,15,0.98)', border: '1px solid rgba(236,72,153,0.2)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #f9a8d4, #ec4899, #f9a8d4)' }} />
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h3 className="text-base font-bold text-white">💝 Sent</h3>
            <button onClick={dismissQr} className="text-[#4a5068] cursor-pointer"><X size={18} /></button>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-[11px] text-[#a3adc3] leading-relaxed text-center">
              Share this heart QR with the recipient.<br />
              They scan it to unwrap the gift 💕
            </p>

            {/* Pink heart-shaped QR container */}
            <div className="flex items-center justify-center">
              <div className="relative" style={{ width: 300, height: 280 }}>
                <svg viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 w-full h-full" style={{ filter: 'drop-shadow(0 8px 24px rgba(236,72,153,0.4))' }}>
                  <defs>
                    <linearGradient id="kissHeartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#fbcfe8" />
                      <stop offset="50%" stopColor="#f472b6" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M100 42 C 78 12, 20 20, 20 62 C 20 108, 100 165, 100 165 C 100 165, 180 108, 180 62 C 180 20, 122 12, 100 42 Z"
                    fill="url(#kissHeartGrad)"
                    stroke="#be185d" strokeWidth="2.5"
                  />
                </svg>
                <span className="absolute text-2xl" style={{ top: '10%', left: '18%', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>💕</span>
                <span className="absolute text-2xl" style={{ top: '10%', right: '18%', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>💕</span>
                <div className="absolute" style={{ top: '25%', left: '50%', transform: 'translateX(-50%)' }}>
                  <div className="rounded-xl p-2.5 bg-white" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                    {sentKiss.qrDataUrl ? (
                      <div className="relative" style={{ width: 160, height: 160 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sentKiss.qrDataUrl} alt="QR" className="block w-full h-full" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="flex items-center justify-center rounded-full bg-white" style={{ width: 28, height: 28, boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
                            <span className="text-lg leading-none">💗</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-40 h-40 flex items-center justify-center text-slate-400 text-xs">QR unavailable</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Info banner — 5-open limit */}
            <div className="rounded-lg px-3 py-2 flex items-center gap-2 text-[10px]" style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.3)' }}>
              <span className="text-base shrink-0">⚠️</span>
              <div className="flex-1 text-[#fed7aa]">
                This gift can be opened up to <b>5 times</b>. Manage your QR codes in <a href="/me/sent-kisses" className="underline font-bold">Sent Kisses</a>.
              </div>
            </div>

            {/* URL + copy */}
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="flex-1 text-[11px] text-[#a3adc3] truncate">{sentKiss.url}</span>
              <button onClick={async () => {
                try {
                  await navigator.clipboard.writeText(sentKiss.url);
                  setCopyFeedback(true);
                  setTimeout(() => setCopyFeedback(false), 1500);
                } catch { setSendError('Copy failed'); }
              }} className="text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer whitespace-nowrap" style={{ background: copyFeedback ? 'rgba(52,211,153,0.2)' : 'rgba(236,72,153,0.15)', color: copyFeedback ? '#34d399' : '#f472b6', border: `1px solid ${copyFeedback ? '#34d39955' : '#f472b655'}` }}>
                {copyFeedback ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => {
                const a = document.createElement('a');
                a.href = sentKiss.qrDataUrl;
                a.download = `gao-kiss-${sentKiss.id}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }} disabled={!sentKiss.qrDataUrl} className="rounded-xl py-2.5 text-xs font-bold cursor-pointer disabled:opacity-40" style={{ background: 'rgba(17,19,24,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }}>
                ⬇️ Download QR
              </button>
              <button onClick={async () => {
                if (navigator.share) {
                  try { await navigator.share({ title: 'You have a gift 💝', text: 'Tap the link to unwrap your gift', url: sentKiss.url }); } catch { /* cancelled */ }
                } else {
                  try {
                    await navigator.clipboard.writeText(sentKiss.url);
                    setCopyFeedback(true);
                    setTimeout(() => setCopyFeedback(false), 1500);
                  } catch { setSendError('Share failed'); }
                }
              }} className="rounded-xl py-2.5 text-xs font-bold cursor-pointer" style={{ background: 'linear-gradient(135deg, #f472b6, #ec4899)', color: '#fff' }}>
                📤 Share
              </button>
            </div>

            <button onClick={dismissQr} className="w-full rounded-xl py-3 text-sm font-bold cursor-pointer" style={{ background: 'rgba(255,255,255,0.06)', color: '#a3adc3', border: '1px solid rgba(255,255,255,0.08)' }}>
              Done
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md md:max-w-4xl rounded-2xl overflow-hidden"
        style={{ background: 'rgba(10,11,15,0.98)', border: '1px solid rgba(239,68,68,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #f87171, #ec4899, #f87171)' }} />
        <div className="flex items-center justify-between px-5 md:px-6 pt-4 pb-1">
          <div>
            <h3 className="text-base md:text-lg font-bold text-white leading-tight">Send a Gift 💌</h3>
            <p className="text-[10px] md:text-[11px] text-[#4a5068] mt-0.5">Pick an occasion, style with a template, share a heart QR</p>
          </div>
          <button onClick={onClose} className="text-[#4a5068] cursor-pointer"><X size={18} /></button>
        </div>

        <div className="px-5 md:px-6 pb-5 md:pb-6 md:grid md:grid-cols-2 md:gap-6 space-y-5 md:space-y-0 max-h-[85vh] overflow-y-auto">
          {/* On desktop, sections split into 2 columns; on mobile stacks vertically */}
          <div className="space-y-5">
          {/* ── Step 1: Recipient ── */}
          <div>
            <SectionHeader num="1" title="To whom?" />
          </div>

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

          {/* ── Step 2: Occasion ── */}
          <SectionHeader num="2" title="What's the occasion?" />

          {/* Occasion picker — grid of themed cards. Pick occasion, then
              bundles + gifts for that occasion appear in the panel below. */}
          <div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mb-3">
              {OCCASIONS.map(o => {
                const active = activeOccasionId === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => setActiveOccasionId(o.id)}
                    className="relative rounded-xl p-2 flex flex-col items-center gap-1 cursor-pointer transition-all"
                    style={active
                      ? { background: o.bgGradient, border: `1.5px solid ${o.themeColor}`, boxShadow: `0 0 12px ${o.themeColor}40`, transform: 'scale(1.03)' }
                      : { background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <span className="text-2xl leading-none">{o.emoji}</span>
                    <span className="text-[9px] font-bold text-center leading-tight" style={{ color: active ? '#0a0b0f' : '#a3adc3' }}>{o.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected occasion — description + bundles + gifts */}
            <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(17,19,24,0.4)', border: `1px solid ${activeOccasion.themeColor}25` }}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeOccasion.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">{activeOccasion.name}</div>
                  <div className="text-[10px] text-[#a3adc3] truncate">{activeOccasion.description}</div>
                </div>
              </div>

              {/* Bundle cards */}
              {activeOccasion.bundles.length > 0 && (
                <div className="space-y-1.5">
                  {activeOccasion.bundles.map(b => {
                    const gross = b.items.reduce((s, g) => s + g.coins, 0);
                    const net = bundlePrice(b);
                    const selected = emoji === b.emoji && message.includes(b.name);
                    return (
                      <button key={b.id} onClick={() => handleSelectBundle(b)} className="relative w-full flex items-center gap-2 rounded-xl p-2 cursor-pointer transition-all text-left" style={selected ? { background: `${activeOccasion.themeColor}25`, border: `1px solid ${activeOccasion.themeColor}` } : { background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <span className="absolute top-1 right-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: activeOccasion.themeColor, color: '#fff' }}>−{b.discountPct}%</span>
                        <div className="text-2xl shrink-0">{b.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-bold text-white truncate">{b.name}</div>
                          {b.tagline && <div className="text-[9px] text-[#a3adc3] truncate">{b.tagline}</div>}
                          <div className="flex items-center gap-0.5 mt-0.5">{b.items.map((it, i) => <span key={i} className="text-xs">{it.emoji}</span>)}</div>
                        </div>
                        <div className="text-right shrink-0 pr-8">
                          <div className="text-[8px] text-white/40 line-through">🪙 {gross}</div>
                          <div className="text-[11px] font-bold" style={{ color: '#fbbf24' }}>🪙 {net}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Reveal templates — themed animation styles per occasion.
                  Click thumbnail to preview video, click "Use" to select. */}
              {activeOccasion.templates && activeOccasion.templates.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1.5">🎬 Reveal templates</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {activeOccasion.templates.map(t => {
                      const active = selectedTemplateId === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setPreviewTemplate(t)}
                          className="relative aspect-video rounded-lg overflow-hidden cursor-pointer transition-transform hover:scale-[1.03] group text-left"
                          style={{ background: t.thumbnailBg, border: active ? `2px solid ${activeOccasion.themeColor}` : '1px solid rgba(255,255,255,0.08)', boxShadow: active ? `0 4px 16px ${activeOccasion.themeColor}55` : 'none' }}
                        >
                          {/* Play badge */}
                          <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white text-[10px] group-hover:bg-black/70">▶</div>
                          {/* Premium badge */}
                          {t.premium && (
                            <div className="absolute top-1.5 left-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.6)', color: '#fbbf24' }}>🪙{t.coins}</div>
                          )}
                          {/* Hero emoji */}
                          <div className="absolute inset-0 flex items-center justify-center text-4xl" style={{ textShadow: '0 4px 8px rgba(0,0,0,0.3)' }}>{t.emoji}</div>
                          {/* Bottom name bar */}
                          <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)' }}>
                            <div className="text-[9px] font-bold text-white truncate">{t.name}</div>
                          </div>
                          {/* Selected checkmark */}
                          {active && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ background: `${activeOccasion.themeColor}30` }}>
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: activeOccasion.themeColor }}>✓</div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          </div>

          </div>
          {/* ── RIGHT COLUMN (desktop) — Step 3 + visibility + send ── */}
          <div className="space-y-5">
          {/* ── Step 3: Personal touch ── */}
          <SectionHeader num="3" title="Add a personal touch" optional />

          {/* Message — textarea for longer notes */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[#4a5068]">💌 Your message</label>
              <span className="text-[9px] text-[#4a5068]">{message.length}/500</span>
            </div>
            <textarea
              value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Write a heartfelt note..."
              maxLength={500}
              rows={4}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-[#2d3548] resize-none leading-relaxed"
              style={{ background: 'rgba(17,19,24,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
            />
          </div>

          {/* Collapsible extras — Photos + Music (hidden by default) */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(17,19,24,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <button type="button" onClick={() => setExtrasOpen(v => !v)} className="w-full flex items-center gap-2 px-3 py-2.5 cursor-pointer text-left hover:bg-white/[0.03]">
              <span className="text-base">✨</span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-white">Add extras {(occasionPhotos.length + (occasionMusic ? 1 : 0)) > 0 && <span className="text-[#f472b6]">· {occasionPhotos.length + (occasionMusic ? 1 : 0)} added</span>}</div>
                <div className="text-[9px] text-[#4a5068]">Photos + music that appear during the reveal</div>
              </div>
              <span className="text-[#4a5068] text-xs">{extrasOpen ? '▲' : '▼'}</span>
            </button>
            {extrasOpen && (
              <div className="px-3 pb-3 pt-1 flex gap-2 border-t border-white/[0.04]">
                <div className="flex-1">
                  <label className="text-[9px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">📷 Photos ({occasionPhotos.length}/3)</label>
                  <div className="flex gap-1 flex-wrap">
                    {occasionPhotos.map((url, i) => (
                      <div key={i} className="relative w-11 h-11 rounded-md overflow-hidden shrink-0" style={{ background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setOccasionPhotos(occasionPhotos.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/80 text-white text-[10px] leading-none flex items-center justify-center cursor-pointer">×</button>
                      </div>
                    ))}
                    {occasionPhotos.length < 3 && (
                      <label className="w-11 h-11 rounded-md flex items-center justify-center cursor-pointer shrink-0" style={{ background: 'rgba(236,72,153,0.10)', border: '1px dashed rgba(236,72,153,0.35)' }}>
                        {photoUploading ? <span className="text-[9px]" style={{ color: '#f472b6' }}>...</span> : <span className="text-lg" style={{ color: '#f472b6' }}>+</span>}
                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setPhotoUploading(true);
                          try {
                            const fd = new FormData();
                            fd.append('file', file);
                            const res = await fetch('/api/v1/upload', { method: 'POST', body: fd });
                            const json = await res.json();
                            if (res.ok && json.data?.url) setOccasionPhotos(prev => [...prev, json.data.url]);
                            else setSendError(json.error?.message || 'Upload failed');
                          } catch { setSendError('Upload failed'); }
                          finally { setPhotoUploading(false); e.target.value = ''; }
                        }} />
                      </label>
                    )}
                  </div>
                </div>

                <div className="flex-1 relative">
                  <label className="text-[9px] font-semibold uppercase tracking-wider text-[#4a5068] mb-1 block">🎵 Music</label>
                  <button type="button" onClick={() => setMusicPickerOpen(v => !v)} className="w-full h-11 rounded-md px-2 flex items-center gap-1.5 cursor-pointer text-left" style={occasionMusic ? { background: 'rgba(236,72,153,0.10)', border: '1px solid rgba(236,72,153,0.35)' } : { background: 'rgba(17,19,24,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <span className="text-base">{occasionMusic ? '🎵' : '＋'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-white truncate">{occasionMusic?.title || 'Pick a track'}</div>
                      {occasionMusic && <div className="text-[8px] text-[#a3adc3] truncate">{occasionMusic.artist}</div>}
                    </div>
                    {occasionMusic && occasionMusic.coins > 0 && (
                      <span className="text-[8px] font-bold shrink-0" style={{ color: '#fbbf24' }}>🪙{occasionMusic.coins}</span>
                    )}
                  </button>
                  {musicPickerOpen && (
                    <div className="absolute top-full mt-1 left-0 right-0 z-20 rounded-md max-h-40 overflow-y-auto" style={{ background: 'rgba(17,19,24,0.98)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 20px rgba(0,0,0,0.5)' }}>
                      {occasionMusic && (
                        <button type="button" onClick={() => { setOccasionMusic(null); setMusicPickerOpen(false); }} className="w-full text-left px-2 py-1.5 text-[10px] text-[#f87171] hover:bg-white/5 cursor-pointer">✕ Clear</button>
                      )}
                      {tracksForOccasion(activeOccasion.id).map(t => (
                        <button key={t.id} type="button" onClick={() => { setOccasionMusic(t); setMusicPickerOpen(false); }} className="w-full text-left px-2 py-1.5 flex items-center gap-1.5 hover:bg-white/5 cursor-pointer" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <span className="text-sm">{t.mood === 'romantic' ? '💕' : t.mood === 'festive' ? '🎉' : t.mood === 'family' ? '👨‍👩‍👧' : t.mood === 'friendship' ? '🤝' : t.mood === 'sad' ? '😢' : '😊'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-white truncate">{t.title}</div>
                            <div className="text-[8px] text-[#a3adc3] truncate">{t.artist}</div>
                          </div>
                          {t.coins > 0
                            ? <span className="text-[8px] font-bold shrink-0" style={{ color: '#fbbf24' }}>🪙{t.coins}</span>
                            : <span className="text-[8px] font-bold shrink-0" style={{ color: '#4ade80' }}>FREE</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Visibility — Public / Private */}
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
                      const res = await fetch('/api/v1/users/me', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
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

          {/* No location warning */}
          {noLocationWarning && (
            <div className="rounded-xl px-4 py-3 space-y-2.5" style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)' }}>
              <div className="flex items-start gap-2">
                <span className="text-base">📍</span>
                <p className="text-[11px] text-[#EAB308] leading-relaxed">
                  This person hasn&apos;t shared their location. You can enter their address to see the flight, or send anyway — you will not see how it&apos;s delivered on the map.
                </p>
              </div>
              <div className="relative">
                <input
                  value={customAddress}
                  onChange={e => handleAddressInput(e.target.value)}
                  placeholder="Enter their city or address (optional)..."
                  className="w-full rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#4a5068] outline-none"
                  style={{ background: 'rgba(17,19,24,0.8)', border: addressCoords ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(255,255,255,0.06)' }}
                />
                {addressCoords && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#34d399]">✓</span>}
                {addressSuggestions.length > 0 && !addressCoords && (
                  <div className="absolute left-0 right-0 top-full mt-1 rounded-lg overflow-hidden z-50" style={{ background: 'rgba(10,11,15,0.98)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '150px', overflowY: 'auto' }}>
                    {addressSuggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setCustomAddress(s.display_name.split(',').slice(0, 2).join(','));
                          setAddressCoords({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
                          setAddressSuggestions([]);
                        }}
                        className="w-full text-left px-3 py-2 text-[10px] text-[#a3adc3] hover:bg-white/5 cursor-pointer truncate"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                      >
                        📍 {s.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSendWithAddress}
                  disabled={sending}
                  className="flex-1 rounded-lg py-2 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #f87171, #ec4899)', color: 'white' }}
                >
                  {sending ? 'Sending…' : addressCoords ? `Send to ${customAddress.split(',')[0]}` : 'Send anyway'}
                </button>
                <button
                  onClick={() => setNoLocationWarning(false)}
                  className="rounded-lg px-3 py-2 text-[11px] font-semibold cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#4a5068' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Send */}
          {!noLocationWarning && (() => {
            const targetName = selectedPerson?.name || (receiverId ? 'them' : '');
            const readyToSend = !!receiverId && !!emoji;
            return (
              <button onClick={handleSend} disabled={sending || !readyToSend} className="w-full rounded-xl py-3 text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all" style={{ background: readyToSend ? 'linear-gradient(135deg, #f87171, #ec4899)' : 'rgba(255,255,255,0.06)', color: readyToSend ? 'white' : '#4a5068', boxShadow: readyToSend ? '0 4px 20px rgba(236,72,153,0.3)' : 'none' }}>
                {sending
                  ? 'Sending…'
                  : !receiverId
                    ? 'Pick a recipient first'
                    : !emoji
                      ? 'Pick a gift first'
                      : (
                        <span className="flex items-center justify-center gap-1.5">
                          <span>Send</span>
                          <span className="text-lg leading-none">{emoji}</span>
                          {selectedGiftName && <span className="text-xs opacity-90">{selectedGiftName}</span>}
                          <span>to</span>
                          <span className="font-bold">{targetName}</span>
                          <span>→</span>
                        </span>
                      )}
              </button>
            );
          })()}
          </div>{/* /right column */}
        </div>
      </motion.div>

      {/* Template preview modal — plays video (or placeholder) + "Use this template" CTA */}
      {previewTemplate && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={() => setPreviewTemplate(null)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: 'rgba(10,11,15,0.98)', border: '1px solid rgba(236,72,153,0.2)' }} onClick={(e) => e.stopPropagation()}>
            {/* Video / thumbnail area (16:9) */}
            <div className="relative aspect-video" style={{ background: previewTemplate.thumbnailBg }}>
              {previewTemplate.videoUrl ? (
                <video src={previewTemplate.videoUrl} autoPlay loop muted controls className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <div className="text-6xl" style={{ textShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>{previewTemplate.emoji}</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/70 font-semibold">Preview video coming soon</div>
                </div>
              )}
              <button onClick={() => setPreviewTemplate(null)} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur text-white flex items-center justify-center cursor-pointer hover:bg-black/80"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-white flex-1">{previewTemplate.name}</h4>
                  {previewTemplate.premium && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.35)' }}>🪙 {previewTemplate.coins} PREMIUM</span>
                  )}
                </div>
                <p className="text-[12px] text-[#a3adc3] leading-relaxed mt-1">{previewTemplate.description}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPreviewTemplate(null)} className="flex-1 rounded-xl py-2.5 text-xs font-semibold cursor-pointer" style={{ background: 'rgba(255,255,255,0.06)', color: '#a3adc3', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setSelectedTemplateId(previewTemplate.id);
                    setPreviewTemplate(null);
                  }}
                  className="flex-[2] rounded-xl py-2.5 text-xs font-bold cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #f472b6, #ec4899)', color: '#fff', boxShadow: '0 4px 16px rgba(236,72,153,0.3)' }}
                >
                  {selectedTemplateId === previewTemplate.id ? '✓ Selected' : '🎬 Use this template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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

// Precomputed at module level — avoids impure Math.random() calls during render
const SHOWER_PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  left: `${Math.random() * 100}%`,
  x: (Math.random() - 0.5) * 100,
  duration: 3 + Math.random() * 2,
  repeatDelay: Math.random() * 2,
  delay: i * 0.15,
}));
const FIREWORKS_BURSTS = Array.from({ length: 5 }, (_, i) => ({
  left: `${20 + Math.random() * 60}%`,
  top: `${20 + Math.random() * 40}%`,
  delay: 0.5 + i * 0.4,
}));
const ORBIT_PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  x: (Math.random() - 0.5) * 250,
  y: -100 - Math.random() * 150,
  duration: 2.5 + Math.random() * 1.5,
  repeatDelay: Math.random(),
  delay: i * 0.2,
}));
const FIRE_DURATIONS = Array.from({ length: 5 }, () => 0.8 + Math.random() * 0.5);

// ── Kiss Reveal Popup ──
// ── JourneyReveal — stepped "journey" content shown BELOW the chibi hug.
// Intro → photos (if any) → message (if any) → CTA. Steps auto-collapse
// when there's no content. Music (if attached) autoplays for the whole
// journey through the compact player at the top.
function JourneyReveal({ kiss, senderDisplay, receiverDisplay, canSendBack, onSendBack, onClose }: {
  kiss: Kiss;
  senderDisplay: string;
  receiverDisplay: string;
  canSendBack: boolean;
  onSendBack?: (toId: string) => void;
  onClose: () => void;
}) {
  const photos: string[] = useMemo(() => {
    try { return kiss.photos ? JSON.parse(kiss.photos) : []; } catch { return []; }
  }, [kiss.photos]);

  type StepKind = 'intro' | 'photos' | 'message' | 'cta';
  const steps: StepKind[] = useMemo(() => {
    const s: StepKind[] = ['intro'];
    if (photos.length > 0) s.push('photos');
    if (kiss.message && kiss.message.trim().length > 0) s.push('message');
    s.push('cta');
    return s;
  }, [photos.length, kiss.message]);

  const [stepIdx, setStepIdx] = useState(0);
  const [photoIdx, setPhotoIdx] = useState(0);
  const current = steps[stepIdx];
  const canBack = stepIdx > 0;
  const canNext = stepIdx < steps.length - 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.6 }}
      className="z-10 flex flex-col items-center w-full gap-3"
    >
      {kiss.music_url && (
        <div className="w-full max-w-xs rounded-lg px-3 py-2" style={{ background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.25)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-base">🎵</span>
            <span className="text-[11px] font-bold text-white truncate flex-1">{kiss.music_title || 'Soundtrack'}</span>
          </div>
          <audio src={kiss.music_url} controls autoPlay className="w-full h-8" style={{ colorScheme: 'dark' }} />
        </div>
      )}

      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mt-1">
        {steps.map((_, i) => (
          <div key={i} className="rounded-full transition-all" style={{ width: i === stepIdx ? 20 : 6, height: 6, background: i === stepIdx ? '#ec4899' : i < stepIdx ? 'rgba(236,72,153,0.55)' : 'rgba(255,255,255,0.15)' }} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35 }}
          className="w-full flex flex-col items-center min-h-[8rem]"
        >
          {current === 'intro' && (
            <>
              <p className="text-base font-bold text-white text-center">
                From <span style={{ color: '#f87171' }}>{senderDisplay}</span>
              </p>
              <p className="text-[10px] text-[#4a5068] text-center mt-2">
                {senderDisplay} → {receiverDisplay}
              </p>
              {typeof kiss.open_count === 'number' && typeof kiss.max_opens === 'number' && (
                <div className="mt-2 flex items-center gap-1.5 text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: kiss.open_count >= kiss.max_opens ? 'rgba(239,68,68,0.15)' : 'rgba(236,72,153,0.12)', color: kiss.open_count >= kiss.max_opens ? '#f87171' : '#f472b6', border: `1px solid ${kiss.open_count >= kiss.max_opens ? '#ef444455' : '#f472b644'}` }}>
                  <span>💝</span>
                  <span>Opened {kiss.open_count} / {kiss.max_opens} times</span>
                </div>
              )}
            </>
          )}

          {current === 'photos' && photos.length > 0 && (
            <div className="w-full flex flex-col items-center gap-2">
              <div className="relative w-full max-w-xs aspect-square rounded-2xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(236,72,153,0.35)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photos[photoIdx]} alt="" className="absolute inset-0 w-full h-full object-cover" />
                {photos.length > 1 && (
                  <>
                    <button onClick={() => setPhotoIdx(i => (i - 1 + photos.length) % photos.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white text-lg leading-none flex items-center justify-center cursor-pointer">‹</button>
                    <button onClick={() => setPhotoIdx(i => (i + 1) % photos.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white text-lg leading-none flex items-center justify-center cursor-pointer">›</button>
                    <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1">
                      {photos.map((_, i) => (
                        <div key={i} className="rounded-full transition-all" style={{ width: i === photoIdx ? 12 : 6, height: 6, background: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.4)' }} />
                      ))}
                    </div>
                  </>
                )}
              </div>
              <p className="text-[10px] text-[#a3adc3] text-center">📸 Photo {photoIdx + 1} of {photos.length}</p>
            </div>
          )}

          {current === 'message' && kiss.message && (
            <div className="w-full max-w-xs px-4 py-4 rounded-2xl" style={{ background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.2)' }}>
              <div className="text-[9px] uppercase tracking-widest text-[#f472b6] font-bold mb-2 text-center">💌 A message for you</div>
              <p className="text-sm text-white text-center leading-relaxed whitespace-pre-wrap">{kiss.message}</p>
              <div className="text-[10px] text-[#4a5068] text-right mt-3 italic">— {senderDisplay}</div>
            </div>
          )}

          {current === 'cta' && (
            <div className="w-full flex flex-col items-center gap-3">
              <div className="text-4xl">💝</div>
              <p className="text-sm text-white text-center font-semibold">That&rsquo;s the journey!</p>
              <p className="text-[11px] text-[#a3adc3] text-center max-w-xs">Reply to {senderDisplay} with something of your own.</p>
              {canSendBack && onSendBack ? (
                <button
                  onClick={() => { onSendBack(kiss.sender_id); onClose(); }}
                  className="mt-1 flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold cursor-pointer transition-transform active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #f87171, #ec4899)', color: 'white', boxShadow: '0 4px 16px rgba(236,72,153,0.3)' }}
                >
                  💋 Send Back
                </button>
              ) : (
                <button onClick={onClose} className="mt-1 rounded-xl px-6 py-2.5 text-sm font-semibold cursor-pointer" style={{ background: 'rgba(255,255,255,0.08)', color: '#a3adc3', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Close
                </button>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Step nav */}
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={() => setStepIdx(i => Math.max(0, i - 1))}
          disabled={!canBack}
          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: 'rgba(255,255,255,0.06)', color: '#a3adc3', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          ‹ Back
        </button>
        {canNext ? (
          <button
            onClick={() => setStepIdx(i => Math.min(steps.length - 1, i + 1))}
            className="px-4 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #f472b6, #ec4899)', color: '#fff' }}
          >
            Continue ›
          </button>
        ) : (
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#a3adc3', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Done
          </button>
        )}
      </div>
    </motion.div>
  );
}

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
      {SHOWER_PARTICLES.map((p, i) => (
        <motion.span
          key={`shower-${i}`}
          className="absolute text-3xl pointer-events-none"
          style={{ left: p.left, top: '-5%' }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: [0, 1, 1, 0], y: ['0vh', '110vh'], x: p.x }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, repeatDelay: p.repeatDelay }}
        >
          {fx.particles[i % fx.particles.length]}
        </motion.span>
      ))}

      {/* Fireworks bursts */}
      {isFireworks && FIREWORKS_BURSTS.map((burst, i) => (
        <motion.div
          key={`fw-${i}`}
          className="absolute pointer-events-none"
          style={{ left: burst.left, top: burst.top }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: [0, 2.5, 3], opacity: [1, 1, 0] }}
          transition={{ duration: 1.5, delay: burst.delay, repeat: Infinity, repeatDelay: 2 }}
        >
          {Array.from({ length: 8 }).map((_, j) => (
            <motion.span
              key={j}
              className="absolute text-xl"
              style={{ transform: `rotate(${j * 45}deg)` }}
              animate={{ x: [0, Math.cos(j * 45 * Math.PI / 180) * 60], y: [0, Math.sin(j * 45 * Math.PI / 180) * 60], opacity: [1, 0] }}
              transition={{ duration: 1, delay: burst.delay }}
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
              {FIRE_DURATIONS.map((duration, i) => (
                <motion.span key={i} className="absolute text-2xl" style={{ bottom: 0, left: `${10 + i * 18}%` }}
                  animate={{ y: [0, -30, -50], opacity: [0.8, 0.5, 0], scale: [1, 1.3, 0.5] }}
                  transition={{ duration, delay: i * 0.15, repeat: Infinity }}
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

        {/* Stepped "journey" reveal — intro → photos → message → CTA */}
        <JourneyReveal
          kiss={kiss}
          senderDisplay={senderDisplay}
          receiverDisplay={receiverDisplay}
          canSendBack={!!canSendBack}
          onSendBack={onSendBack}
          onClose={onClose}
        />

        {/* Orbiting particles around card */}
        {ORBIT_PARTICLES.map((p, i) => (
          <motion.span
            key={`orbit-${i}`}
            className="absolute text-xl pointer-events-none z-0"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.8, 0],
              x: [0, p.x],
              y: [0, p.y],
              scale: [0.5, 1.2, 0.3],
            }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, repeatDelay: p.repeatDelay }}
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
  const isAuthed = useAuthStore(s => s.isAuthed);
  // Legacy local state kept for callers we haven't migrated yet.
  const [showSendModal] = useState(false);
  const [sendBackTo] = useState<string | null>(null);
  // Popup + builder state comes from the unified gifts popup store.
  const closeKissModal = useGiftsPopupStore(s => s.closeKissModal);
  const isHeartBuilderOpen = useGiftsPopupStore(s => s.isHeartBuilderOpen);
  const closeHeartBuilder = useGiftsPopupStore(s => s.closeHeartBuilder);
  const isCoupleBuilderOpen = useGiftsPopupStore(s => s.isCoupleBuilderOpen);
  const closeCoupleBuilder = useGiftsPopupStore(s => s.closeCoupleBuilder);
  const isBirthdayCapsuleOpen = useGiftsPopupStore(s => s.isBirthdayCapsuleOpen);
  const closeBirthdayCapsule = useGiftsPopupStore(s => s.closeBirthdayCapsule);
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

  // Auto-dismiss auth gate if user becomes authenticated (e.g. hydration completes or login succeeds)
  useEffect(() => {
    if (isAuthed && showAuthGate) setShowAuthGate(false);
  }, [isAuthed, showAuthGate]);

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
              ? `<img src="${sanitizeUrl(kiss.receiver_avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
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
        ">${escapeHtml(displayName)}</span>
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
        ">${escapeHtml(displayName)}</span>
      `;
    }

    el.onclick = () => {
      if (isReceiver && !hasOpened) {
        setRevealKiss(kiss);
        fetch('/api/v1/kisses', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: kiss.id }),
        }).then(() => {
          mutate();
          // Update marker to opened state
          el.querySelector('div')!.innerHTML = `<span style="font-size:22px">${escapeHtml(kiss.emoji)}</span>`;
        });
      } else if (isReceiver || isSender) {
        setRevealKiss(kiss);
      }
    };

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(to).addTo(map);
    markersRef.current.set(kiss.id, marker);
  }, [map, currentUserId, mutate]);

  // ── Play flight animation (only when explicitly triggered) ──
  const playFlightAnimation = useCallback(async (kiss: Kiss) => {
    if (!map) return;
    // Skip animation if no valid destination (receiver_lat = 0 means "send anyway")
    if (!kiss.receiver_lat || !kiss.receiver_lng) { placeGiftMarker(kiss); return; }

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

    const isGlobe = useMapStore.getState().viewMode === '3d';

    // Distance-based vehicle selection
    const distanceKm = haversineKm(kiss.sender_lat, kiss.sender_lng, kiss.receiver_lat, kiss.receiver_lng);
    const vehicle = pickVehicle(distanceKm);
    const openZoom = isGlobe ? 5 : Math.max(11, vehicle.cruiseZoom - 1);
    // Dove approach: enter from 30 km west of receiver
    const cosLat = Math.max(Math.cos(kiss.receiver_lat * Math.PI / 180), 0.05);
    const doveApproachStart: [number, number] = [
      kiss.receiver_lng - (30 / (111 * cosLat)),
      kiss.receiver_lat,
    ];

    // Reverse geocode to check same city + HUD names
    let senderCity = `${kiss.sender_lat.toFixed(1)}°`;
    let receiverCity = `${kiss.receiver_lat.toFixed(1)}°`;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let isSameCity = false;

    try {
      const [sRes, rRes] = await Promise.all([
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${kiss.sender_lat}&lon=${kiss.sender_lng}&zoom=10`, { headers: { 'User-Agent': 'GaoSocial/1.0' } }).then(r => r.json()).catch(() => null),
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${kiss.receiver_lat}&lon=${kiss.receiver_lng}&zoom=10`, { headers: { 'User-Agent': 'GaoSocial/1.0' } }).then(r => r.json()).catch(() => null),
      ]);
      if (sRes?.address) senderCity = sRes.address.city || sRes.address.town || sRes.address.state || sRes.address.country || senderCity;
      if (rRes?.address) receiverCity = rRes.address.city || rRes.address.town || rRes.address.state || rRes.address.country || receiverCity;
    } catch {}

    // Dove: straight approach line from off-screen west → receiver.
    // Every other vehicle: great-circle arc between sender/receiver.
    const arcPoints = vehicle.kind === 'dove'
      ? interpolateGreatCircle(doveApproachStart, to, 120)
      : interpolateGreatCircle(from, to, vehicle.arcSteps);

    // Remove existing gift marker — will re-place when plane arrives
    const existingGift = markersRef.current.get(kiss.id);
    if (existingGift) { existingGift.remove(); markersRef.current.delete(kiss.id); }

    // Animation element — vehicle SVG chosen by distance.
    // maplibre applies its OWN positioning transform to planeEl, so we
    // put motion offsets / altitude scale on an INNER wrapper. Otherwise
    // our transform would fight maplibre's and either be overwritten
    // (silent no-op) or throw the marker off-screen.
    const planeEl = document.createElement('div');
    planeEl.style.cssText = `pointer-events:none;width:${vehicle.size}px;height:${vehicle.size}px;`;
    const innerEl = document.createElement('div');
    innerEl.style.cssText = `width:100%;height:100%;`;
    innerEl.innerHTML = buildVehicleSvg(vehicle.kind, kiss.id);
    planeEl.appendChild(innerEl);
    // rotation=0 means pointing up (North). setRotation(bearing) points it in travel direction.
    const planeMarker = new maplibregl.Marker({ element: planeEl, anchor: 'center', rotationAlignment: 'map' })
      .setLngLat(arcPoints[0])
      .addTo(map);
    markersRef.current.set(`plane_${kiss.id}`, planeMarker);

    // ── Draw flight path ──
    // Dove: SOLID thick pink line with WHITE casing underneath so the
    //       route is unmistakable on satellite tiles (green/brown/blue).
    // Others: dashed line as before.
    // Layers are only added once the map's style is fully loaded —
    // otherwise addSource/addLayer can silently fail on cold-start.
    const lineId = `kiss-arc-${kiss.id}`;
    const casingId = `kiss-arc-cas-${kiss.id}`;
    const addArcLayers = () => {
      if (!map.getSource(lineId)) {
        map.addSource(lineId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: arcPoints }, properties: {} } });
      }
      if (!map.getLayer(lineId)) {
        const arcPaint: Record<string, unknown> = {
          'line-color': vehicle.lineColor,
          'line-width': vehicle.lineWidth,
          'line-opacity': 0.7,
        };
        if (vehicle.lineDash) arcPaint['line-dasharray'] = vehicle.lineDash;
        map.addLayer({ id: lineId, type: 'line', source: lineId, paint: arcPaint });
      }
    };
    if (map.isStyleLoaded()) addArcLayers();
    else map.once('idle', addArcLayers);

    // Dove has its own overlay flow (returned early above). Below only
    // runs for motorbike / car / plane. `doveEndpointKeys` is kept as an
    // empty array so shared cleanup code compiles unchanged.
    const doveEndpointKeys: string[] = [];

    // Trail line (shows where the vehicle has been — solid, vehicle-coloured).
    const trailId = `kiss-trail-${kiss.id}`;
    const trailCoords: [number, number][] = [];
    const addTrailLayers = () => {
      if (!map.getSource(trailId)) {
        map.addSource(trailId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} } });
        map.addLayer({ id: trailId, type: 'line', source: trailId,
          paint: { 'line-color': vehicle.lineColor, 'line-width': 2.5, 'line-opacity': 0.9 },
          layout: { 'line-cap': 'round', 'line-join': 'round' } });
      }
    };
    if (map.isStyleLoaded()) addTrailLayers();
    else map.once('idle', addTrailLayers);

    const isFollowing = () => activeFollowRef.current === kiss.id;

    // ── Buttery smooth flight — direct camera control each frame ──
    const flightMs = vehicle.durationMs;
    let t0 = 0;
    // Camera state — lerped every frame for zero jitter
    let camLng = from[0], camLat = from[1], camZoom = 9, camPitch = 0, camBearing = 0;
    let planeLng = arcPoints[0][0], planeLat = arcPoints[0][1], planeBrg = 0;

    // Turbulence zones — only for airliners; other vehicles use their own
    // signature motion (dove flutter, balloon sway, rocket ramrod) below.
    const turbZones = vehicle.kind === 'plane' ? Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => {
      const center = 0.15 + Math.random() * 0.6;
      const width = 0.03 + Math.random() * 0.04;
      return { start: center - width, end: center + width };
    }) : [];
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
        // Remove dove endpoint pulse markers (start + end pink dots)
        doveEndpointKeys.forEach(k => {
          const m = markersRef.current.get(k);
          if (m) { m.remove(); markersRef.current.delete(k); }
        });
        placeGiftMarker(kiss);

        // Stop camera control + reset to normal view. Dove keeps the
        // route-framed view so the finished route stays visible.
        setFlightHUD(null);
        activeFollowRef.current = null;
        // Dove keeps its 3D pitch on arrival (no flatten to 2D); other
        // vehicles level out to 0° at their final landing.
        const arrivalPitch = 0; // flat for all vehicles now (dove included)
        map?.jumpTo({ center: to, zoom: isGlobe ? 4 : vehicle.landZoom, pitch: arrivalPitch, bearing: 0 });

        // Clean arc/trail lines (and dove casing) after delay
        setTimeout(() => {
          [casingId, trailId, lineId].forEach(lid => {
            try { if (map?.getLayer(lid)) map.removeLayer(lid); } catch {}
          });
          [trailId, lineId].forEach(sid => {
            try { if (map?.getSource(sid)) map.removeSource(sid); } catch {}
          });
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

      // ── Per-vehicle motion signature ──
      //  dove      : constant fluttery Y/X sine + slow altitude illusion
      //              (scale + drop-shadow modulated by a sine so the bird
      //              visibly rises and dips across the map)
      //  motorbike : subtle high-freq wobble (bumps in the road)
      //  car       : very slight sway (smooth suspension)
      //  plane     : airliner turbulence bob only during weather zones
      let motionOffsetY = 0;
      let motionOffsetX = 0;
      const extraTransform = '';
      const extraFilter = '';
      turbulenceActive = false;
      if (vehicle.kind === 'plane') {
        turbulenceActive = turbZones.some(z => t >= z.start && t <= z.end);
        if (turbulenceActive) {
          motionOffsetY = Math.sin(elapsed * 0.008) * 6 + Math.sin(elapsed * 0.013) * 3;
        }
      } else if (vehicle.kind === 'motorbike') {
        motionOffsetY = Math.sin(elapsed * 0.03) * 1.2;
        motionOffsetX = Math.sin(elapsed * 0.026) * 0.8;
      } else if (vehicle.kind === 'car') {
        motionOffsetX = Math.sin(elapsed * 0.004) * 1;
      }
      innerEl.style.transform = (motionOffsetX || motionOffsetY || extraTransform)
        ? `translate(${motionOffsetX}px, ${motionOffsetY}px)${extraTransform}`
        : '';
      innerEl.style.filter = extraFilter;

      planeMarker.setLngLat([planeLng, planeLat]);

      // ── Vehicle bearing: look far ahead + heavy smoothing ──
      // Ground vehicles (motorbike/car) get slightly tighter smoothing than the plane
      // so they don't lag when the arc curves.
      const lookIdx = Math.min(i + Math.max(15, Math.floor(arcPoints.length * 0.03)), arcPoints.length - 1);
      const lk = arcPoints[lookIdx];
      const dLn = (lk[0] - planeLng) * Math.PI / 180;
      const la1 = planeLat * Math.PI / 180;
      const la2 = lk[1] * Math.PI / 180;
      const rawBrg = Math.atan2(Math.sin(dLn) * Math.cos(la2), Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLn)) * 180 / Math.PI;
      let brgDiff = rawBrg - planeBrg;
      if (brgDiff > 180) brgDiff -= 360;
      if (brgDiff < -180) brgDiff += 360;
      const brgSmooth = (vehicle.kind === 'motorbike' || vehicle.kind === 'car') ? 0.05 : 0.03;
      planeBrg += brgDiff * brgSmooth;
      // Dove: skip setRotation — the emoji is scaleX(-1) flipped to face
      // right (east). Rotating the marker would spin the emoji off-axis.
      if (vehicle.kind !== 'dove') planeMarker.setRotation(planeBrg);

      // ── Dove: LANDING approach. Camera fixed on RECEIVER (not follow
      // bird). Zoom eases 11 → 15 (approach → close). PITCH STAYS AT 45°
      // for the whole flight so the map keeps its 3D perspective — never
      // flattens to 2D. The bird visibly lands on the receiver's address
      // against the tilted city view.
      if (isFollowing() && vehicle.kind === 'dove') {
        // Dove: 2D flat map — no 3D tilt. Camera stays on receiver and
        // zoom lerps 11 → 15 as the bird approaches.
        const approachZoom = 11;
        const landingZoom = 15;
        const tgtZoom = approachZoom + (landingZoom - approachZoom) * t;
        camLng += (to[0] - camLng) * 0.08;
        camLat += (to[1] - camLat) * 0.08;
        camZoom += (tgtZoom - camZoom) * 0.08;
        camPitch += (0 - camPitch) * 0.08; // level out any residual pitch
        map?.jumpTo({ center: [camLng, camLat], zoom: camZoom, pitch: 0, bearing: 0 });
        setFlightHUD({
          from: senderCity, to: receiverCity, progress: t,
          senderName: kiss.sender_name || 'Sender',
          receiverName: currentUserId === kiss.receiver_id ? 'You' : (kiss.receiver_name || 'Receiver'),
          emoji: vehicle.emoji,
          turbulence: false,
        });
      }
      // ── Camera: lerp ALL properties every frame → zero jitter ──
      // Motorbike / car / plane use the cinematic follow camera so the trip
      // feels like a full journey with the vehicle in view the whole time.
      else if (isFollowing()) {
        let tgtZoom: number, tgtPitch: number;

        if (isGlobe) {
          // Globe: zoom out to see Earth, then zoom in for landing.
          const orbitZ = 1.8;
          const landZ = vehicle.landZoom;
          if (t < 0.1) { tgtZoom = 5 - (5 - orbitZ) * (t / 0.1); tgtPitch = 0; }
          else if (t > 0.9) { tgtZoom = orbitZ + (landZ - orbitZ) * ((t - 0.9) / 0.1); tgtPitch = ((t - 0.9) / 0.1) * 40; }
          else { tgtZoom = orbitZ; tgtPitch = 0; }
        } else {
          const cruiseZ = vehicle.cruiseZoom;
          const cruisePitch = vehicle.cruisePitch;
          const landZ = vehicle.landZoom;
          if (t < 0.12) { tgtZoom = openZoom - (openZoom - cruiseZ) * (t / 0.12); tgtPitch = t / 0.12 * cruisePitch; }
          else if (t > 0.85) { tgtZoom = cruiseZ + (landZ - cruiseZ) * ((t - 0.85) / 0.15); tgtPitch = ((1 - t) / 0.15) * cruisePitch; }
          else { tgtZoom = cruiseZ; tgtPitch = cruisePitch; }
        }

        // Camera looks ahead of the vehicle.
        const lookAmt = isGlobe ? 40 : 25;
        const camLookIdx = Math.min(i + lookAmt, arcPoints.length - 1);
        const cl = arcPoints[camLookIdx];

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

        setFlightHUD({
          from: senderCity, to: receiverCity, progress: t,
          senderName: kiss.sender_name || 'Sender',
          receiverName: currentUserId === kiss.receiver_id ? 'You' : (kiss.receiver_name || 'Receiver'),
          emoji: vehicle.emoji,
          turbulence: turbulenceActive,
        });
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

    // Start — three opening moves matched to vehicle behaviour:
    //  • dove   → fly to RECEIVER at approach zoom (11) FLAT (no 3D pitch).
    //             Fly loop then lerps camera to landing zoom while the
    //             bird flies in from off-screen and lands. 2D top-down.
    //  • globe  → fly to sender then pull out to see Earth
    //  • other  → swoop into the journey at cruise pitch
    if (vehicle.kind === 'dove') {
      map?.flyTo({
        center: to,
        zoom: 11,
        pitch: 0,
        bearing: 0,
        duration: 1200,
        easing: (x: number) => 1 - Math.pow(1 - x, 3),
      });
      camLng = to[0]; camLat = to[1]; camZoom = 11; camPitch = 0; camBearing = 0;
      setTimeout(() => requestAnimationFrame(fly), 1400);
    } else if (isGlobe) {
      map?.flyTo({ center: from, zoom: openZoom, pitch: 0, bearing: 0, duration: 2000 });
      setTimeout(() => {
        camLng = from[0]; camLat = from[1]; camZoom = openZoom; camPitch = 0; camBearing = 0;
        requestAnimationFrame(fly);
      }, 2300);
    } else {
      map?.flyTo({ center: from, zoom: openZoom, pitch: vehicle.cruisePitch, bearing: 0, duration: 2500, easing: (x: number) => 1 - Math.pow(1 - x, 3) });
      setTimeout(() => {
        camLng = from[0]; camLat = from[1]; camZoom = openZoom; camPitch = vehicle.cruisePitch; camBearing = 0;
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

      {/* Send Modal — full-screen fallback opened by KissRevealPopup's
          Send-Back flow via useGiftsPopupStore.openKissModalDirect().
          (The Gifts chip on the top filter bar uses the tabbed
          GiftsPopup below, which embeds this same SendKissModal
          inline in its Kiss tab.) */}
      <AnimatePresence>
        {showSendModal && <SendKissModal defaultReceiverId={sendBackTo} onClose={closeKissModal} onSent={async () => {
          const fresh = await mutate();
          const newest = (fresh as { data: Kiss[] } | undefined)?.data?.[0];
          if (newest) setTimeout(() => playFlightAnimation(newest), 500);
        }} />}
      </AnimatePresence>

      {/* Kiss Reveal */}
      <AnimatePresence>
        {revealKiss && <KissRevealPopup kiss={revealKiss} onClose={() => setRevealKiss(null)} currentUserId={currentUserId} onSendBack={(toId) => useGiftsPopupStore.getState().openKissModalDirect(toId)} />}
      </AnimatePresence>

      {/* Unified Gifts popup (tabbed: Kiss + Templates) — opened by
          the Gifts chip in LayerFilterPanel. */}
      <GiftsPopup />

      {/* Template builders — full-screen modals opened when the user
          picks a template card inside GiftsPopup's Templates tab. */}
      <HeartBuilder open={isHeartBuilderOpen} onClose={closeHeartBuilder} />
      <CoupleCardBuilder open={isCoupleBuilderOpen} onClose={closeCoupleBuilder} />
      {/* Birthday launches the time-capsule composer preloaded with
          the birthday theme. Recipients get the cinematic drone
          reveal via BirthdayJourneyFlow when they open the capsule. */}
      <CapsuleCreateModal
        open={isBirthdayCapsuleOpen}
        onClose={closeBirthdayCapsule}
        initialThemeId="birthday"
      />

      {/* Auth Gate */}
      <SignInGateSheet action="default" isOpen={showAuthGate} onClose={() => setShowAuthGate(false)} />
    </>
  );
}
