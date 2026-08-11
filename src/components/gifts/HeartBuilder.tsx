'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import {
  X, Copy, ExternalLink, Loader2, Heart, Zap, Check,
  ImageIcon, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { CinematicVignette } from './CinematicVignette';
import { SkyWatcherSilhouette } from './SkyWatcherSilhouette';

// Same Three.js drone-show as the birthday capsule + the public heart
// viewer. Dynamic to keep Three.js out of the initial bundle.
const JourneyDroneShow = dynamic(
  () =>
    import('@/components/capsules/journey/JourneyDroneShow').then(
      (m) => m.JourneyDroneShow,
    ),
  { ssr: false },
);

type Props = {
  open: boolean;
  onClose: () => void;
};

type HeartColor = 'pink' | 'red' | 'gold';
type SenderRole = 'anh' | 'em';

const COLOR_OPTIONS: { key: HeartColor; label: string; swatch: string }[] = [
  { key: 'pink', label: 'Hồng ngọt', swatch: '#ff4d8b' },
  { key: 'red',  label: 'Đỏ nồng nàn', swatch: '#ef4444' },
  { key: 'gold', label: 'Vàng ánh dương', swatch: '#f2d97a' },
];

/** Text lines the drone-show morphs through. Kept short (≤15 chars
 *  per line) so a 1200-drone swarm has enough particles per character
 *  to actually read as glyphs at mobile-portrait width. Multi-line
 *  entries use `\n` — the drone renderer stacks them vertically. */
function narrativeLines(role: SenderRole): string[] {
  if (role === 'em') {
    return [
      'CHÀO ANH',
      'CẢM ƠN ANH',
      'ĐÃ ĐỒNG HÀNH\nCÙNG EM',
      'MÓN QUÀ NHỎ\nGỬI TẶNG ANH',
    ];
  }
  return [
    'CHÀO EM',
    'CẢM ƠN EM',
    'ĐÃ ĐỒNG HÀNH\nCÙNG ANH',
    'MÓN QUÀ NHỎ\nGỬI TẶNG EM',
  ];
}

/** Client-side image compression before base64 encoding. Shrinks any
 *  input to fit inside 800×800 and re-encodes as JPEG at quality 0.85.
 *  Cuts payload size 5–10× vs the raw file. */
async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Không đọc được ảnh'));
    el.src = url;
  });
  URL.revokeObjectURL(url);
  const maxDim = 800;
  const s = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * s);
  const h = Math.round(img.height * s);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas không hoạt động');
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.85);
}

export function HeartBuilder({ open, onClose }: Props) {
  const [recipientName, setRecipientName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderRole, setSenderRole] = useState<SenderRole>('anh');
  const [heartColor, setHeartColor] = useState<HeartColor>('pink');
  // Single photo slot — data-URL (compressed JPEG) or null. This one
  // photo is rendered as a circle in the centre of the drone-formed
  // heart during the heart scene.
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setPublishedUrl(null);
      setCopied(false);
    }
  }, [open]);

  const lines = useMemo(() => narrativeLines(senderRole), [senderRole]);
  const previewLine1 = lines[0];

  const photoUrl = photo;

  // Preview drone stages — mirrors the public viewer's timing +
  // text-splitting so the sender sees exactly what the recipient
  // will get.
  const previewStages = useMemo(() => {
    const [l1, l2, l3, l4] = lines;
    // Per-stage palettes matching the public viewer.
    const PROM = ['#ff4488', '#ff77aa', '#ffaacc', '#ff5588', '#ff88bb'];
    const PGOLD = ['#ffd644', '#ffcd00', '#ffe088', '#ff9966'];
    const PHEART = ['#ff3366', '#ff5588', '#ff77aa', '#ffaadd', '#ff88bb'];
    const PSHELL = ['#ffffff', '#fff2cc', '#ffe088', '#ffffff'];
    const PFW = ['#ff4488', '#ff3344', '#ffaa22', '#22ee88', '#22aaff', '#bb66ff', '#ffffff'];
    const PPAST = ['#ffbbcc', '#ffddaa', '#ccddff', '#e8b3d9'];
    const PSUN = ['#ff8844', '#ffbb66', '#ffdd88', '#ff9966'];
    const PBQ = ['#ff2255', '#ff4488', '#ff77aa', '#ffbbdd', '#e83366', '#ffaa88'];
    const PFIN = ['#ff4488', '#ff6688', '#ffaa99', '#ff5577', '#ffcccc'];
    return [
      { kind: 'scatter' as const, durationMs: 1500, colors: PROM },
      { kind: 'text' as const, value: l1, fontPx: 140, durationMs: 3600, colors: PROM },
      { kind: 'text' as const, value: l2, fontPx: 128, durationMs: 3800, colors: PROM },
      { kind: 'text' as const, value: l3, fontPx: 100, durationMs: 4200, colors: PROM },
      { kind: 'text' as const, value: l4, fontPx: 96, durationMs: 4200, colors: PROM },
      { kind: 'text' as const, value: '3', fontPx: 220, yShift: 0, fitWidth: 90, durationMs: 1300, colors: PGOLD },
      { kind: 'text' as const, value: '2', fontPx: 220, yShift: 0, fitWidth: 90, durationMs: 1300, colors: PGOLD },
      { kind: 'text' as const, value: '1', fontPx: 220, yShift: 0, fitWidth: 90, durationMs: 1300, colors: PGOLD },
      { kind: 'scene' as const, sceneKey: 'heart' as const, durationMs: 5500, colors: PHEART },
      // Concise finale: hug → physics explosion → galaxy → dissolve.
      { kind: 'scene' as const, sceneKey: 'hug' as const, durationMs: 4200, colors: PFIN },
      // Physics-based firework burst — real velocity + gravity + trails
      { kind: 'physics' as const, durationMs: 3000, colors: PFW },
      { kind: 'scene' as const, sceneKey: 'galaxy' as const, durationMs: 4800, spin: 0.55, colors: PFW },
      { kind: 'dissolve' as const, durationMs: 1200, colors: PPAST },
    ];
  }, [lines]);

  const canPublish = !!recipientName.trim() && !publishing;

  async function handlePhotoPick(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ chấp nhận file ảnh');
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      setPhoto(dataUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không đọc được ảnh';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  function removePhoto() {
    setPhoto(null);
    const ref = fileInputRef.current;
    if (ref) ref.value = '';
  }

  async function publish() {
    if (!canPublish) return;
    setPublishing(true);
    try {
      const res = await fetch('/api/v1/gifts/hearts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          data: {
            recipientName: recipientName.trim(),
            senderName: senderName.trim(),
            senderRole,
            heartColor,
          },
          photosBase64: photo ? [photo] : [],
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || `HTTP ${res.status}`);
      }
      const url = json?.data?.url as string | undefined;
      if (!url) throw new Error('Server did not return a URL');
      setPublishedUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success('Đã tạo & copy link 💕');
      } catch {
        toast.success('Đã tạo trang tim yêu 💕');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể tạo, thử lại nhé';
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  }

  async function copyUrl() {
    if (!publishedUrl) return;
    try {
      await navigator.clipboard.writeText(publishedUrl);
      setCopied(true);
      toast.success('Đã copy link 🔗');
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Không copy được, thử paste thủ công');
    }
  }

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-400 bg-black overflow-y-auto"
      style={{ overscrollBehavior: 'contain' }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-white/10 backdrop-blur-md"
        style={{ background: 'rgba(0,0,0,0.75)' }}
      >
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 cursor-pointer"
          aria-label="Close"
        >
          <X size={18} className="text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-[0.2em] text-[#ff9dc4] font-semibold">
            Gao Gift · Drone Show
          </div>
          <div className="text-white font-bold text-sm truncate">
            Trái Tim 3D — Chữ & Ảnh Bay Trên Trời
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 lg:gap-6 p-4 lg:p-6 max-w-7xl mx-auto">
        {/* Form */}
        <div className="space-y-5 order-2 lg:order-1">
          {/* Sender role — controls all three narrative lines */}
          <section>
            <label className="text-[11px] uppercase tracking-widest text-[#a3adc3] font-semibold">
              Bạn là
            </label>
            <div className="mt-2 flex gap-2">
              {(['anh', 'em'] as SenderRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setSenderRole(r)}
                  className="flex-1 rounded-xl py-2 text-sm font-bold cursor-pointer transition-all"
                  style={{
                    background: senderRole === r
                      ? 'linear-gradient(135deg, #ff4d8b, #ec4899)'
                      : 'rgba(255,255,255,0.04)',
                    color: senderRole === r ? 'white' : '#a3adc3',
                    border: `1px solid ${senderRole === r ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {r === 'anh' ? 'Anh (gửi Em)' : 'Em (gửi Anh)'}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-[#4a5068]">
              Chọn xưng hô để chữ bay tự động: {previewLine1} · {lines[1]}…
            </p>
          </section>

          {/* Photo */}
          <section>
            <label className="text-[11px] uppercase tracking-widest text-[#a3adc3] font-semibold">
              Ảnh trái tim ({photo ? '1' : '0'}/1)
            </label>
            <p className="text-[10px] text-[#4a5068] mt-0.5 mb-2">
              Ảnh sẽ hiện tròn ở chính giữa trái tim khi drone xếp hình
            </p>
            <div className="relative w-40 mx-auto">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoPick(e.target.files?.[0] ?? null)}
              />
              {photo ? (
                <div
                  className="relative w-40 h-40 rounded-full overflow-hidden"
                  style={{
                    border: '2px solid rgba(255,180,210,0.7)',
                    boxShadow: '0 0 28px rgba(255,77,139,0.4)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={removePhoto}
                    className="absolute top-1.5 right-1.5 rounded-full p-1.5 cursor-pointer"
                    style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}
                    aria-label="Remove photo"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-40 h-40 rounded-full flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1.5px dashed rgba(255,180,210,0.4)',
                    color: '#a3adc3',
                  }}
                >
                  {uploading ? (
                    <Loader2 size={22} className="animate-spin" />
                  ) : (
                    <>
                      <ImageIcon size={24} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">
                        Thêm ảnh
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </section>

          <section>
            <label className="text-[11px] uppercase tracking-widest text-[#a3adc3] font-semibold">
              Gửi tới ai
            </label>
            <input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value.slice(0, 48))}
              placeholder={`Ví dụ: ${senderRole === 'anh' ? 'Em Bống của anh' : 'Anh Toàn của em'}`}
              className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm bg-white/4 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#ff4d8b]"
            />
          </section>

          <section>
            <label className="text-[11px] uppercase tracking-widest text-[#a3adc3] font-semibold">
              Ký tên (tuỳ chọn)
            </label>
            <input
              value={senderName}
              onChange={(e) => setSenderName(e.target.value.slice(0, 48))}
              placeholder="Người gửi..."
              className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm bg-white/4 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#ff4d8b]"
            />
          </section>

          <section>
            <label className="text-[11px] uppercase tracking-widest text-[#a3adc3] font-semibold">
              Màu trái tim
            </label>
            <div className="mt-2 flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setHeartColor(c.key)}
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all"
                  style={{
                    background: heartColor === c.key ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${heartColor === c.key ? c.swatch : 'rgba(255,255,255,0.08)'}`,
                    color: heartColor === c.key ? 'white' : '#a3adc3',
                  }}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: c.swatch, boxShadow: `0 0 10px ${c.swatch}` }}
                  />
                  {c.label}
                </button>
              ))}
            </div>
          </section>

          {/* Publish */}
          {!publishedUrl ? (
            <button
              onClick={publish}
              disabled={!canPublish}
              className="w-full rounded-2xl py-3.5 text-sm font-bold cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #ff4d8b 0%, #ec4899 50%, #d4145a 100%)',
                color: 'white',
                boxShadow: '0 12px 34px -8px rgba(255,77,139,0.55)',
              }}
            >
              {publishing ? (
                <><Loader2 size={16} className="animate-spin" /> Đang tạo trang tim yêu…</>
              ) : (
                <><Zap size={16} /> Tạo & lấy link chia sẻ</>
              )}
            </button>
          ) : (
            <div className="space-y-2">
              <div
                className="rounded-2xl px-3 py-3 flex items-center gap-2"
                style={{
                  background: 'rgba(255,77,139,0.08)',
                  border: '1px solid rgba(255,77,139,0.35)',
                }}
              >
                <Heart size={16} className="text-[#ff4d8b] shrink-0" />
                <div className="flex-1 min-w-0 text-[12px] text-white truncate font-mono">
                  {publishedUrl}
                </div>
                <button
                  onClick={copyUrl}
                  className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
                  aria-label="Copy"
                >
                  {copied ? <Check size={14} className="text-[#4ade80]" /> : <Copy size={14} className="text-white" />}
                </button>
              </div>
              <a
                href={publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-2xl py-3 text-sm font-bold cursor-pointer flex items-center justify-center gap-2 no-underline"
                style={{
                  background: 'linear-gradient(135deg, #ff4d8b, #ec4899)',
                  color: 'white',
                }}
              >
                <ExternalLink size={14} /> Xem trang trái tim của bạn
              </a>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-20 h-fit">
          <div
            className="rounded-2xl overflow-hidden relative"
            style={{
              background: '#000',
              border: '1px solid rgba(255,77,139,0.25)',
              boxShadow: '0 30px 70px -20px rgba(255,77,139,0.35)',
              aspectRatio: '9 / 14',
              maxHeight: '72vh',
            }}
          >
            {/* Same Three.js drone show as the public viewer — sender
                sees exactly what the recipient will get. */}
            <JourneyDroneShow
              stages={previewStages}
              inline
              loop
              droneColor="multicolor"
              heartPhotoUrl={photoUrl}
            />
            <SkyWatcherSilhouette variant="couple" height={0.22} />
            <div className="absolute inset-0">
              <CinematicVignette intensity={0.55} />
            </div>

            {/* Recipient name overlay */}
            <div className="absolute top-4 left-0 right-0 flex flex-col items-center px-4 pointer-events-none">
              <div
                className="text-[10px] uppercase tracking-[0.4em] mb-1"
                style={{ color: 'rgba(255,209,224,0.7)' }}
              >
                Gửi tới
              </div>
              <div
                className="text-2xl md:text-3xl font-bold text-center"
                style={{
                  fontFamily: '"Playfair Display", Georgia, serif',
                  color: '#fff',
                  textShadow: '0 0 20px rgba(255,77,139,0.75), 0 0 40px rgba(255,77,139,0.45)',
                }}
              >
                {recipientName.trim() || 'Người thương'}
              </div>
            </div>

            {senderName.trim() && (
              <div
                className="absolute bottom-4 right-5 pointer-events-none"
                style={{
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontStyle: 'italic',
                  fontSize: 14,
                  color: 'rgba(255,209,224,0.85)',
                  textShadow: '0 0 12px rgba(255,77,139,0.5)',
                }}
              >
                — {senderName.trim()}
              </div>
            )}
          </div>
          <div className="mt-2 text-[10px] text-[#4a5068] text-center">
            Preview · Cycle drone: chữ chào → cảm ơn → món quà → tim + ảnh → 2 người chạy
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
