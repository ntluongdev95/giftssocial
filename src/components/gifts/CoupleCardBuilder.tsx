'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Download, ImagePlus, Link2, Loader2, Plus, RefreshCw, Share2, Sparkles, Trash2, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { CoupleIdCard, type Milestone } from './CoupleIdCard';
import { PORTRAIT_STYLES, coupleArtUrl, type PortraitStyle } from '@/lib/couple-art';
import { useLocationStore } from '@/stores/locationStore';

type Props = {
  open: boolean;
  onClose: () => void;
};

const CARD_VARIANTS: Array<{ id: 'classic' | 'noir' | 'rose'; label: string; swatch: string }> = [
  { id: 'classic', label: 'Classic navy',  swatch: 'linear-gradient(135deg, #e6ecf5, #1e3a8a)' },
  { id: 'noir',    label: 'Midnight gold', swatch: 'linear-gradient(135deg, #16213e, #fbbf24)' },
  { id: 'rose',    label: 'Rose',          swatch: 'linear-gradient(135deg, #fce7ec, #be185d)' },
];

/** Generate a 12-digit card ID (4-4-4 with spaces) — stable across
 *  re-renders unless the user hits "shuffle". Purely cosmetic. */
function newId(): string {
  const bytes: number[] = [];
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(12);
    crypto.getRandomValues(arr);
    for (let i = 0; i < 12; i++) bytes.push(arr[i] % 10);
  } else {
    // Server render / fallback — deterministic zeros so hydration matches.
    for (let i = 0; i < 12; i++) bytes.push(0);
  }
  const digits = bytes.join('');
  return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
}

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function plusYearsISO(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function CoupleCardBuilder({ open, onClose }: Props) {
  const [name1, setName1] = useState('');
  const [name2, setName2] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [variant, setVariant] = useState<'classic' | 'noir' | 'rose'>('classic');
  const [cardId, setCardId] = useState('0000 0000 0000');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [exporting, setExporting] = useState(false);

  // Public-share state — separate from local export so both actions can
  // reuse the modal in different modes.
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishedCopied, setPublishedCopied] = useState(false);

  // Share-to-Story state (Gao Social feed).
  const [postingStory, setPostingStory] = useState(false);
  const [storyPosted, setStoryPosted] = useState(false);
  const { lat: userLat, lng: userLng } = useLocationStore();

  // A — AI Couple Portrait
  const [photoMode, setPhotoMode] = useState<'upload' | 'ai'>('upload');
  const [aiStyle, setAiStyle] = useState<PortraitStyle>('anime');
  const [aiLoading, setAiLoading] = useState(false);

  // B — Our Story
  const [togetherSince, setTogetherSince] = useState('');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [showStory, setShowStory] = useState(false);

  // Live days counter — recomputes every 60s so the number ticks when the
  // date rolls over without hammering the render loop.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    if (!togetherSince) return;
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [togetherSince]);
  const daysCount = useMemo(() => {
    if (!togetherSince || nowMs == null) return null;
    const [y, m, d] = togetherSince.split('-').map(Number);
    if (!y || !m || !d) return null;
    const start = new Date(y, m - 1, d).getTime();
    const diff = nowMs - start;
    if (diff < 0) return 0;
    return Math.floor(diff / (24 * 3600 * 1000));
  }, [togetherSince, nowMs]);

  const cardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset ID + dates whenever the modal opens (crypto only runs client-side).
  useEffect(() => {
    if (!open) return;
    setCardId(newId());
    setIssueDate(todayISO());
    setExpiryDate(plusYearsISO(5));
  }, [open]);

  // Lock page scroll while modal open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Free any pending blob URL on unmount to avoid memory leaks.
  useEffect(() => {
    return () => {
      if (photoUrl?.startsWith('blob:')) URL.revokeObjectURL(photoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please pick an image file');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image is too large (max 8 MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : null;
      setPhotoUrl(url);
    };
    reader.readAsDataURL(file);
  }

  async function download() {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      // html2canvas is heavy — dynamic import so it doesn't bloat the
      // page bundle for users who never open this modal.
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 3,      // 3x → crisp on retina + printable
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      const stamp = (name1 || 'couple').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      a.download = `gao-couple-card-${stamp}.png`;
      a.click();
      toast.success('Card downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setExporting(false);
    }
  }

  /** Compress the photo (if any) to keep the POST body small. Returns a
   *  data URL of a resized JPEG (max 800px, quality 0.85) or null. */
  async function compressedPhoto(): Promise<string | null> {
    if (!photoUrl) return null;
    if (photoUrl.startsWith('data:image')) {
      // Already a data URL from the file picker — compress by drawing
      // through a canvas.
    }
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const loaded: Promise<void> = new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('photo load failed'));
      });
      img.src = photoUrl;
      await loaded;
      const maxSide = 800;
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch {
      return null;
    }
  }

  /** Publish the card publicly — POST to /api/v1/gifts/cards, show the
   *  resulting shareable URL. Photo is compressed client-side first. */
  async function publishPublic() {
    if (!name1 || !name2) {
      toast.error('Enter both names before publishing');
      return;
    }
    setPublishing(true);
    setPublishedUrl(null);
    try {
      const photoBase64 = await compressedPhoto();
      const res = await fetch('/api/v1/gifts/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          kind: 'couple_card',
          data: {
            name1, name2, cardId, issueDate, expiryDate, variant,
            togetherSince: togetherSince || null,
            milestones: milestones.filter(m => m.date && m.label),
          },
          photoBase64: photoBase64 ?? undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j?.error?.message ?? 'Publish failed');
        return;
      }
      setPublishedUrl(j.data.url);
      toast.success('Card published — link ready!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }

  async function copyPublishedLink() {
    if (!publishedUrl) return;
    try {
      await navigator.clipboard.writeText(publishedUrl);
      setPublishedCopied(true);
      toast.success('Link copied');
      setTimeout(() => setPublishedCopied(false), 1800);
    } catch {
      toast.error('Copy failed');
    }
  }

  /** Share to Gao Social Story. Full flow:
   *  1. Publish the card publicly (if not already) → get card URL
   *  2. Render card to PNG via html2canvas → upload to R2 as story media
   *  3. Create Story with caption + link_url pointing at card viewer
   *
   *  Stories require a GPS coord (schema-level NOT NULL). We use the
   *  cached location from the store when available; if not, we still
   *  post with a placeholder (0,0) — the story just won't cluster on the
   *  map, which is fine for an item that's not tied to a physical place. */
  async function shareToStory() {
    if (!name1 || !name2) {
      toast.error('Enter both names first');
      return;
    }
    if (!cardRef.current) return;
    setPostingStory(true);
    try {
      // 1. Publish card if we don't already have a public URL
      let cardUrl = publishedUrl;
      let cardShortId: string | null = null;
      if (!cardUrl) {
        const photoBase64 = await compressedPhoto();
        const pubRes = await fetch('/api/v1/gifts/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            kind: 'couple_card',
            data: {
              name1, name2, cardId, issueDate, expiryDate, variant,
              togetherSince: togetherSince || null,
              milestones: milestones.filter(m => m.date && m.label),
            },
            photoBase64: photoBase64 ?? undefined,
          }),
        });
        const pubJ = await pubRes.json();
        if (!pubRes.ok) {
          toast.error(pubJ?.error?.message ?? 'Publish failed');
          return;
        }
        cardUrl = pubJ.data.url as string;
        cardShortId = pubJ.data.id as string;
        setPublishedUrl(cardUrl);
      }

      // 2. Render the current card to a PNG blob → upload as story media.
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });
      const blob: Blob | null = await new Promise(resolve =>
        canvas.toBlob(b => resolve(b), 'image/png', 0.92),
      );
      if (!blob) throw new Error('Could not render card');

      // Upload via the existing /api/v1/upload endpoint (multipart form).
      const form = new FormData();
      form.append('file',
        new File([blob], `couple-card-${cardShortId ?? 'x'}.png`, { type: 'image/png' }),
      );
      const upRes = await fetch('/api/v1/upload', {
        method: 'POST', body: form, credentials: 'same-origin',
      });
      const upJ = await upRes.json();
      if (!upRes.ok || !upJ?.data?.url) {
        toast.error(upJ?.error?.message ?? 'Story upload failed');
        return;
      }
      const mediaUrl = upJ.data.url as string;

      // 3. Create the Story with our CTA link. Stories require GPS —
      // fall back to (0,0) when the user hasn't granted location. That
      // still passes the NOT NULL check and simply won't cluster the
      // story on the nearby map (fine — a card share isn't a check-in).
      const lat = typeof userLat === 'number' ? userLat : 0;
      const lng = typeof userLng === 'number' ? userLng : 0;
      const storyRes = await fetch('/api/v1/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          location_lat: lat,
          location_lng: lng,
          media_url: mediaUrl,
          media_type: 'photo',
          caption: 'Cùng bấm xem tình yêu của tụi mình nè ❤️',
          visibility: 'friends',
          circle_ids: [],
          link_url: cardUrl,
          link_label: 'Khám phá now',
        }),
      });
      const storyJ = await storyRes.json();
      if (!storyRes.ok) {
        toast.error(storyJ?.error?.message ?? 'Could not post story');
        return;
      }
      setStoryPosted(true);
      toast.success('Đã đăng story! Bạn bè sẽ thấy trên feed 💕');
      // Reset the "posted" chip after 5s so the button can be reused.
      setTimeout(() => setStoryPosted(false), 5000);
    } catch (e) {
      console.error('[shareToStory]', e);
      toast.error(e instanceof Error ? e.message : 'Share to Story failed');
    } finally {
      setPostingStory(false);
    }
  }

  async function share() {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
      });
      if (navigator.share && canvas.toBlob) {
        canvas.toBlob(async blob => {
          if (!blob) return;
          const file = new File([blob], 'gao-couple-card.png', { type: 'image/png' });
          try {
            await navigator.share({
              files: [file],
              title: 'Our Couple ID card',
              text: `${name1 || 'Us'} & ${name2 || 'us'} 💕`,
            });
          } catch { /* user cancelled */ }
        });
      } else {
        // Fallback to download
        await download();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Share failed');
    } finally {
      setExporting(false);
    }
  }

  const dateWarning = useMemo(() => {
    if (!issueDate || !expiryDate) return null;
    return new Date(expiryDate) < new Date(issueDate)
      ? 'Expiry is before issue date' : null;
  }, [issueDate, expiryDate]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-500 flex items-center justify-center p-4"
          style={{ background: 'rgba(5,6,10,0.85)', backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 220 }}
            className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl"
            style={{
              background: 'linear-gradient(180deg, #0f1117, #0a0b0f)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 40px 90px -20px rgba(0,0,0,0.6)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
              style={{
                background: 'rgba(10,11,15,0.9)',
                backdropFilter: 'blur(8px)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">💑</span>
                <div>
                  <h2 className="text-base font-bold text-white">Couple ID card</h2>
                  <p className="text-[10px] text-[#4a5068]">Fill it in — the preview updates live</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer text-[#4a5068] hover:text-white"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Two-column body */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-5 lg:p-8">
              {/* Form */}
              <div className="space-y-4 order-2 lg:order-1">
                {/* Photo — Upload OR AI generate */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-[#4a5068] font-semibold">
                      Couple photo
                    </label>
                    {/* Segmented control: Upload | AI Portrait */}
                    <div
                      className="rounded-full flex text-[10px] font-semibold p-0.5"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      {(['upload', 'ai'] as const).map(m => {
                        const active = photoMode === m;
                        return (
                          <button
                            key={m}
                            onClick={() => setPhotoMode(m)}
                            className="px-2.5 py-1 rounded-full cursor-pointer transition-all flex items-center gap-1"
                            style={{
                              background: active ? 'linear-gradient(135deg, #a855f7, #ec4899)' : 'transparent',
                              color: active ? 'white' : '#a3adc3',
                            }}
                          >
                            {m === 'upload' ? <ImagePlus size={10} /> : <Sparkles size={10} />}
                            {m === 'upload' ? 'Upload' : 'AI'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {photoMode === 'upload' ? (
                    <div className="flex items-center gap-3">
                      <div
                        className="h-16 w-16 shrink-0 rounded-lg overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        {photoUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl opacity-40">💑</div>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handleFile(f);
                          e.target.value = '';
                        }}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer"
                        style={{ background: 'rgba(168,85,247,0.12)', color: '#c4b5fd', border: '1px solid rgba(168,85,247,0.3)' }}
                      >
                        <ImagePlus size={12} />
                        {photoUrl ? 'Change' : 'Upload'}
                      </button>
                      {photoUrl && (
                        <button onClick={() => setPhotoUrl(null)} className="text-xs text-[#f87171] cursor-pointer">
                          Remove
                        </button>
                      )}
                    </div>
                  ) : (
                    // AI portrait — style picker + generate button
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-3 gap-1.5">
                        {PORTRAIT_STYLES.map(s => {
                          const active = aiStyle === s.id;
                          return (
                            <button
                              key={s.id}
                              onClick={() => setAiStyle(s.id)}
                              className="rounded-lg py-2 flex flex-col items-center gap-0.5 cursor-pointer transition-transform hover:scale-[1.02]"
                              style={{
                                background: active
                                  ? 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(236,72,153,0.1))'
                                  : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${active ? '#a855f7' : 'rgba(255,255,255,0.06)'}`,
                              }}
                            >
                              <span className="text-base">{s.emoji}</span>
                              <span className="text-[9px] font-semibold" style={{ color: active ? '#fff' : '#a3adc3' }}>
                                {s.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={async () => {
                          if (!name1 || !name2) {
                            toast.error('Enter both names first');
                            return;
                          }
                          setAiLoading(true);
                          const url = coupleArtUrl({ name1, name2, style: aiStyle });
                          try {
                            const controller = new AbortController();
                            const timeout = setTimeout(() => controller.abort(), 120_000);
                            const r = await fetch(url, { signal: controller.signal });
                            clearTimeout(timeout);
                            if (!r.ok) throw new Error(`Pollinations returned HTTP ${r.status}`);
                            const blob = await r.blob();
                            const blobUrl = URL.createObjectURL(blob);
                            if (photoUrl?.startsWith('blob:')) URL.revokeObjectURL(photoUrl);
                            setPhotoUrl(blobUrl);
                            toast.success('AI portrait ready');
                          } catch (e) {
                            console.error('[AI portrait]', e);
                            const msg =
                              e instanceof Error && e.name === 'AbortError'
                                ? 'Generation timed out after 2 min — Flux is busy, retry in a moment.'
                                : e instanceof Error
                                  ? `AI generation failed: ${e.message}`
                                  : 'AI generation failed — try another style.';
                            toast.error(msg);
                          } finally {
                            setAiLoading(false);
                          }
                        }}
                        disabled={aiLoading}
                        className="w-full rounded-lg py-2.5 text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                        style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white' }}
                      >
                        {aiLoading ? (
                          <><Loader2 size={12} className="animate-spin" /> Painting your portrait (~10-60s)...</>
                        ) : (
                          <><Sparkles size={12} /> Generate {PORTRAIT_STYLES.find(s => s.id === aiStyle)?.label} portrait</>
                        )}
                      </button>
                      <p className="text-[10px] text-[#4a5068] italic">
                        Uses your names + style to generate a stylized couple illustration. Free, no upload.
                      </p>
                    </div>
                  )}
                </div>

                {/* Names */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Your name">
                    <input
                      type="text"
                      value={name1}
                      onChange={e => setName1(e.target.value.slice(0, 32))}
                      placeholder="Nt Luong"
                      className="w-full rounded-lg px-3 py-2 text-sm bg-transparent text-white outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    />
                  </FormField>
                  <FormField label="Partner name">
                    <input
                      type="text"
                      value={name2}
                      onChange={e => setName2(e.target.value.slice(0, 32))}
                      placeholder="Minh Anh"
                      className="w-full rounded-lg px-3 py-2 text-sm bg-transparent text-white outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    />
                  </FormField>
                </div>

                {/* Card ID + variant */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Card ID">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={cardId}
                        onChange={e => setCardId(e.target.value.slice(0, 19))}
                        className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm bg-transparent text-white outline-none tabular-nums"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      />
                      <button
                        onClick={() => setCardId(newId())}
                        title="Shuffle"
                        className="h-9 w-9 rounded-lg flex items-center justify-center cursor-pointer text-[#a3adc3] shrink-0"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        <RefreshCw size={13} />
                      </button>
                    </div>
                  </FormField>
                  <FormField label="Style">
                    <div className="flex items-center gap-2">
                      {CARD_VARIANTS.map(v => (
                        <button
                          key={v.id}
                          onClick={() => setVariant(v.id)}
                          title={v.label}
                          className="flex-1 h-9 rounded-lg cursor-pointer transition-transform hover:scale-[1.03]"
                          style={{
                            background: v.swatch,
                            border: variant === v.id
                              ? '2px solid #ec4899'
                              : '1px solid rgba(255,255,255,0.1)',
                            boxShadow: variant === v.id ? '0 6px 18px -6px rgba(236,72,153,0.5)' : undefined,
                          }}
                        />
                      ))}
                    </div>
                  </FormField>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Issue date">
                    <input
                      type="date"
                      value={issueDate}
                      onChange={e => setIssueDate(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm bg-transparent text-white outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        colorScheme: 'dark',
                      }}
                    />
                  </FormField>
                  <FormField label="Expiry date">
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={e => setExpiryDate(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm bg-transparent text-white outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        colorScheme: 'dark',
                      }}
                    />
                  </FormField>
                </div>

                {dateWarning && (
                  <p className="text-xs text-rose-400" role="alert">{dateWarning}</p>
                )}

                {/* ── B: Our Story — collapsible ── */}
                <div
                  className="rounded-xl p-3"
                  style={{ background: 'rgba(236,72,153,0.05)', border: '1px solid rgba(236,72,153,0.15)' }}
                >
                  <button
                    onClick={() => setShowStory(v => !v)}
                    className="w-full flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">❤️</span>
                      <span className="text-xs font-bold text-white">Our story</span>
                      {(togetherSince || milestones.length > 0) && (
                        <span className="text-[9px] font-semibold rounded-full px-1.5 py-0.5" style={{ background: 'rgba(236,72,153,0.15)', color: '#f9a8d4' }}>
                          on
                        </span>
                      )}
                    </div>
                    <span className="text-[#a3adc3] text-xs">{showStory ? '−' : '+'}</span>
                  </button>

                  {showStory && (
                    <div className="mt-3 space-y-3">
                      <FormField label="Together since">
                        <input
                          type="date"
                          value={togetherSince}
                          onChange={e => setTogetherSince(e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-sm bg-transparent text-white outline-none"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', colorScheme: 'dark' }}
                        />
                        {daysCount != null && (
                          <p className="text-[10px] text-[#f9a8d4] mt-1 font-semibold">
                            {daysCount.toLocaleString()} days & counting 💕
                          </p>
                        )}
                      </FormField>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] uppercase tracking-wider text-[#4a5068] font-semibold">
                            Milestones (up to 4)
                          </label>
                          <button
                            onClick={() => {
                              if (milestones.length >= 4) return;
                              setMilestones([...milestones, { emoji: '✨', date: todayISO(), label: '' }]);
                            }}
                            disabled={milestones.length >= 4}
                            className="flex items-center gap-1 text-[10px] font-semibold text-[#f9a8d4] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Plus size={10} /> Add
                          </button>
                        </div>
                        {milestones.length === 0 && (
                          <p className="text-[10px] text-[#4a5068] italic">
                            First met, first date, first trip, moved in — anything worth remembering.
                          </p>
                        )}
                        <div className="space-y-1.5">
                          {milestones.map((m, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={m.emoji}
                                onChange={e => {
                                  const copy = [...milestones];
                                  copy[i] = { ...m, emoji: e.target.value.slice(0, 4) };
                                  setMilestones(copy);
                                }}
                                className="w-11 text-center rounded-lg px-1 py-1.5 text-base bg-transparent outline-none"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                              />
                              <input
                                type="date"
                                value={m.date}
                                onChange={e => {
                                  const copy = [...milestones];
                                  copy[i] = { ...m, date: e.target.value };
                                  setMilestones(copy);
                                }}
                                className="rounded-lg px-2 py-1.5 text-xs bg-transparent text-white outline-none"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', colorScheme: 'dark', width: 130 }}
                              />
                              <input
                                type="text"
                                value={m.label}
                                placeholder="First met"
                                onChange={e => {
                                  const copy = [...milestones];
                                  copy[i] = { ...m, label: e.target.value.slice(0, 40) };
                                  setMilestones(copy);
                                }}
                                className="flex-1 min-w-0 rounded-lg px-2 py-1.5 text-xs bg-transparent text-white outline-none"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                              />
                              <button
                                onClick={() => setMilestones(milestones.filter((_, idx) => idx !== i))}
                                className="h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer text-[#f87171] shrink-0"
                                style={{ background: 'rgba(248,113,113,0.08)' }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-[#4a5068] italic">
                  Photos and names are only rendered client-side. Nothing gets
                  uploaded until you decide to save this card to your Gao Gifts.
                </p>
              </div>

              {/* Preview column */}
              <div className="order-1 lg:order-2 flex flex-col items-center">
                <div className="text-[10px] uppercase tracking-wider text-[#4a5068] font-semibold mb-3">
                  Live preview
                </div>
                <div className="lg:sticky lg:top-6 flex flex-col items-center gap-4">
                  <CoupleIdCard
                    ref={cardRef}
                    name1={name1}
                    name2={name2}
                    photoUrl={photoUrl}
                    cardId={cardId}
                    issueDate={issueDate}
                    expiryDate={expiryDate}
                    variant={variant}
                    togetherSince={togetherSince || null}
                    milestones={milestones.filter(m => m.date && m.label)}
                    daysCount={daysCount}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={share}
                      disabled={exporting}
                      className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.12)',
                      }}
                    >
                      {exporting ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />}
                      Share
                    </button>
                    <button
                      onClick={download}
                      disabled={exporting}
                      className="flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
                      style={{
                        background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                        color: 'white',
                        boxShadow: '0 8px 24px -8px rgba(168,85,247,0.5)',
                      }}
                    >
                      {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      Download PNG
                    </button>
                  </div>

                  {/* Publish publicly — gets a shareable URL that anyone
                      can view without logging in. Big gold button (matches
                      premium branding) so it stands out from the utility
                      Share / Download row above. */}
                  {publishedUrl ? (
                    <div
                      className="w-full rounded-2xl p-3.5 flex flex-col gap-2"
                      style={{
                        background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.06))',
                        border: '1px solid rgba(212,175,55,0.4)',
                      }}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#d4af37' }}>
                        <Link2 size={11} /> Public link — share anywhere
                      </div>
                      <div className="flex items-center gap-1.5">
                        <code
                          className="flex-1 min-w-0 text-[11px] font-mono px-2 py-1.5 rounded-lg truncate"
                          style={{
                            background: 'rgba(0,0,0,0.35)',
                            color: '#f5e6d3',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          {publishedUrl}
                        </code>
                        <button
                          onClick={copyPublishedLink}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-bold cursor-pointer shrink-0"
                          style={{
                            background: publishedCopied ? '#22c55e' : '#d4af37',
                            color: '#0a0a0a',
                          }}
                        >
                          {publishedCopied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                        <a
                          href={publishedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg px-2.5 py-1.5 text-xs font-bold cursor-pointer shrink-0 no-underline"
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            color: '#d4af37',
                            border: '1px solid rgba(212,175,55,0.35)',
                          }}
                          title="Open in new tab"
                        >
                          Open ↗
                        </a>
                      </div>
                      <p className="text-[10px] text-white/50">
                        Anyone with this link can see your card + tap &quot;Make my card&quot; to build their own.
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={publishPublic}
                      disabled={publishing || !name1 || !name2}
                      className="w-full rounded-2xl py-3 text-sm font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                      style={{
                        background: 'linear-gradient(135deg, #d4af37 0%, #f2d97a 50%, #d4af37 100%)',
                        color: '#0a0a0a',
                        boxShadow: '0 10px 28px -8px rgba(212,175,55,0.55)',
                      }}
                    >
                      {publishing ? (
                        <><Loader2 size={14} className="animate-spin" /> Publishing…</>
                      ) : (
                        <><Sparkles size={14} /> Publish &amp; share publicly</>
                      )}
                    </button>
                  )}

                  {/* Post the card as a Gao Social Story. The story
                      carries a "Khám phá now →" CTA that opens the card
                      viewer, giving followers a 1-tap reveal. Auto-
                      publishes the card first if that hasn't happened
                      yet, so the CTA link is always valid. */}
                  <button
                    onClick={shareToStory}
                    disabled={postingStory || !name1 || !name2}
                    className="w-full rounded-2xl py-3 text-sm font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                    style={{
                      background: storyPosted
                        ? 'linear-gradient(135deg, #10b981, #22c55e)'
                        : 'linear-gradient(135deg, #a855f7, #ec4899)',
                      color: 'white',
                      boxShadow: storyPosted
                        ? '0 10px 28px -8px rgba(16,185,129,0.55)'
                        : '0 10px 28px -8px rgba(168,85,247,0.55)',
                    }}
                  >
                    {postingStory ? (
                      <><Loader2 size={14} className="animate-spin" /> Posting to your Story…</>
                    ) : storyPosted ? (
                      <><Check size={14} /> Posted! Bạn bè sẽ thấy trên feed</>
                    ) : (
                      <><Zap size={14} /> Share to Gao Story</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-[#4a5068] font-semibold mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}
