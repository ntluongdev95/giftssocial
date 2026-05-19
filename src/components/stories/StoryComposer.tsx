'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, MapPin, Loader2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useLocationStore } from '@/stores/locationStore';

type NearbyBiz = {
  id: string;
  name: string;
  city: string | null;
  distance_m: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

/** Bottom sheet composer for a Now story. Required: media + GPS. The user
 * picks a nearby business (auto-suggested by /api/v1/businesses?nearby=) or
 * posts without a venue (rail-only — won't appear on map / biz page). */
export function StoryComposer({ open, onClose, onCreated }: Props) {
  const { lat, lng, granted, requestLocation } = useLocationStore();
  const [step, setStep] = useState<'capture' | 'edit'>('capture');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'friends'>('friends');
  const [nearby, setNearby] = useState<NearbyBiz[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<NearbyBiz | null>(null);
  const [showBizPicker, setShowBizPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setStep('capture');
      setFile(null);
      setPreviewUrl(null);
      setCaption('');
      setSelectedBiz(null);
      setNearby([]);
    }
  }, [open]);

  // Ask for GPS as soon as composer opens. Capture accuracy for the server check.
  useEffect(() => {
    if (!open) return;
    if (!granted) {
      requestLocation();
    }
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setAccuracy(pos.coords.accuracy),
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
      );
    }
  }, [open, granted, requestLocation]);

  // Fetch nearby businesses once we have a location and a captured photo.
  useEffect(() => {
    if (step !== 'edit' || lat == null || lng == null) return;
    const ctrl = new AbortController();
    fetch(`/api/v1/nearby?lat=${lat}&lng=${lng}&radius=300&limit=8`, {
      credentials: 'same-origin',
      signal: ctrl.signal,
    })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        // Endpoint returns either { data: [...] } or grouped; we normalise.
        const rows = (j?.data?.businesses ?? j?.data ?? []) as Array<Record<string, unknown>>;
        const mapped: NearbyBiz[] = rows
          .filter(r => r && (r.id || r.business_id))
          .map(r => ({
            id: String(r.id ?? r.business_id),
            name: String(r.name ?? r.title ?? ''),
            city: (r.city as string) ?? null,
            distance_m: Math.round(((r.distance as number) ?? 0) * 1000),
          }))
          .filter(b => b.name)
          .sort((a, b) => a.distance_m - b.distance_m);
        setNearby(mapped);
        if (mapped[0] && mapped[0].distance_m < 120) setSelectedBiz(mapped[0]);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [step, lat, lng]);

  function onFilePick(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast.error('Only images are supported');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('Image too large (max 10MB)');
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setStep('edit');
  }

  async function submit() {
    if (!file) return;
    if (lat == null || lng == null) {
      toast.error('Location required to post a Now story');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload media to storage → get URL
      const fd = new FormData();
      fd.append('file', file);
      const upRes = await fetch('/api/v1/upload', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      });
      if (!upRes.ok) {
        const err = await upRes.json().catch(() => null);
        throw new Error(err?.error?.message || `Upload failed (${upRes.status})`);
      }
      const upJson = (await upRes.json()) as { data: { url: string } };
      const mediaUrl = upJson.data.url;

      // 2. Create story
      const body = {
        business_id: selectedBiz?.id,
        location_lat: lat,
        location_lng: lng,
        accuracy: accuracy ?? undefined,
        media_url: mediaUrl,
        media_type: 'photo' as const,
        caption,
        visibility,
      };
      const res = await fetch('/api/v1/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message || `Create failed (${res.status})`);
      }

      toast.success('Story posted — visible for 24h');
      onCreated?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to post story');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;
  // Portal to document.body so the sheet sits above any bottom UI bar that
  // would otherwise win because of a parent stacking context.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[250] flex items-end justify-center lg:items-center lg:p-6"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          onClick={e => e.stopPropagation()}
          className="w-full lg:w-auto lg:max-w-lg lg:min-w-[440px] max-h-[90vh] overflow-y-auto rounded-t-3xl lg:rounded-3xl flex flex-col"
          style={{
            background: '#0a0b0f',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 60px -10px rgba(0,0,0,0.6)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4">
            <button
              onClick={onClose}
              className="p-1 rounded-full cursor-pointer hover:bg-white/10"
            >
              <X size={20} className="text-white" />
            </button>
            <div className="text-sm font-semibold text-white">Now · ⏱ 24h</div>
            <button
              onClick={submit}
              disabled={!file || submitting}
              className="px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer disabled:opacity-40"
              style={{ background: '#00d4ff', color: '#0a0b0f' }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : 'Post'}
            </button>
          </div>

          {/* Step: capture */}
          {step === 'capture' && (
            <div className="flex flex-col items-center justify-center p-8 gap-4">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center justify-center h-64 w-full max-w-sm rounded-2xl cursor-pointer"
                style={{
                  background: 'rgba(0,212,255,0.04)',
                  border: '1.5px dashed rgba(0,212,255,0.4)',
                }}
              >
                <Camera size={36} className="text-[#00d4ff] mb-2" />
                <span className="text-sm text-white font-medium">Capture / Choose photo</span>
                <span className="text-[10px] text-[#4a5068] mt-1">JPG/PNG/WebP, max 10MB</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => onFilePick(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          {/* Step: edit */}
          {step === 'edit' && previewUrl && (
            <div className="px-4 pb-6 space-y-4">
              {/* Preview — tall frame so the photo gets real visual weight.
                  object-contain matches the viewer's render so what you see
                  here = exactly what others will see. */}
              <div className="relative rounded-2xl overflow-hidden bg-black flex items-center justify-center"
                style={{ minHeight: '50vh', maxHeight: '70vh' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt=""
                  className="max-w-full max-h-[70vh] w-auto h-auto object-contain"
                />
                <button
                  onClick={() => {
                    setStep('capture');
                    setFile(null);
                    setPreviewUrl(null);
                  }}
                  className="absolute top-2 right-2 px-2.5 py-1.5 rounded-md text-[10px] font-semibold cursor-pointer backdrop-blur-md"
                  style={{ background: 'rgba(0,0,0,0.55)', color: 'white' }}
                >
                  Change photo
                </button>
              </div>

              {/* Venue picker */}
              <div>
                <button
                  onClick={() => setShowBizPicker(v => !v)}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-3 cursor-pointer"
                  style={{
                    background: 'rgba(0,212,255,0.04)',
                    border: '1px solid rgba(0,212,255,0.15)',
                  }}
                >
                  <MapPin size={16} className="text-[#00d4ff] shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    {selectedBiz ? (
                      <>
                        <div className="text-sm font-semibold text-white truncate">
                          {selectedBiz.name}
                        </div>
                        <div className="text-[10px] text-[#a3adc3]">
                          {selectedBiz.city ?? ''}{' '}
                          {selectedBiz.distance_m
                            ? `· ~${selectedBiz.distance_m}m away`
                            : ''}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-[#a3adc3]">Pick a nearby place (optional)</div>
                    )}
                  </div>
                  <ChevronDown size={16} className="text-[#4a5068]" />
                </button>

                {showBizPicker && (
                  <div
                    className="mt-2 rounded-xl divide-y max-h-64 overflow-y-auto"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      borderColor: 'rgba(255,255,255,0.05)',
                    }}
                  >
                    {selectedBiz && (
                      <button
                        onClick={() => {
                          setSelectedBiz(null);
                          setShowBizPicker(false);
                        }}
                        className="w-full text-left px-3 py-2.5 text-xs text-[#a3adc3] cursor-pointer hover:bg-white/5"
                      >
                        No venue
                      </button>
                    )}
                    {nearby.length === 0 && (
                      <div className="px-3 py-3 text-xs text-[#4a5068]">No places nearby</div>
                    )}
                    {nearby.map(b => (
                      <button
                        key={b.id}
                        onClick={() => {
                          setSelectedBiz(b);
                          setShowBizPicker(false);
                        }}
                        className="w-full text-left px-3 py-2.5 cursor-pointer hover:bg-white/5"
                      >
                        <div className="text-sm font-medium text-white truncate">{b.name}</div>
                        <div className="text-[10px] text-[#4a5068]">
                          {b.city ?? ''} {b.distance_m ? `· ~${b.distance_m}m` : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Caption */}
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value.slice(0, 280))}
                placeholder="Caption (type #hashtag to tag a topic)..."
                rows={3}
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none resize-none placeholder:text-[#4a5068]"
                style={{
                  background: 'rgba(17,19,24,0.8)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              />
              <div className="text-[10px] text-[#4a5068] text-right">{caption.length}/280</div>

              {/* Visibility */}
              <div className="flex gap-2">
                {(['friends', 'public'] as const).map(v => {
                  const active = visibility === v;
                  return (
                    <button
                      key={v}
                      onClick={() => setVisibility(v)}
                      className="flex-1 rounded-xl py-2 text-xs font-semibold cursor-pointer"
                      style={
                        active
                          ? { background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }
                          : { background: 'rgba(255,255,255,0.03)', color: '#a3adc3', border: '1px solid rgba(255,255,255,0.05)' }
                      }
                    >
                      {v === 'friends' ? '👥 Friends' : '🌐 Public'}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-[#4a5068] -mt-2">
                Public requires trust score ≥ 10 — if you don&apos;t qualify, the story falls back to Friends.
              </p>

              {/* Location status */}
              {lat == null || lng == null ? (
                <button
                  onClick={requestLocation}
                  className="w-full rounded-xl py-2 text-xs font-semibold cursor-pointer"
                  style={{
                    background: 'rgba(248,113,113,0.06)',
                    color: '#fca5a5',
                    border: '1px solid rgba(248,113,113,0.2)',
                  }}
                >
                  ⚠ Enable location to post
                </button>
              ) : (
                <p className="text-[10px] text-[#4a5068]">
                  📍 {lat.toFixed(4)}, {lng.toFixed(4)}
                  {accuracy != null ? ` · accuracy ~${Math.round(accuracy)}m` : ''}
                </p>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
